"""Operator check: does the daily quota hold under concurrent requests on REAL Firestore?

Card #60's tests run the quota transaction against a fake Firestore server, which cannot show
how real Firestore resolves two transactions that race on one document. This script does, with
the production code path (`quota.FirestoreQuotaStore`), against the database you point it at.

It writes only synthetic documents ``llmQuota/quotacheck-<run>-...``: never a real user's counter,
and no LLM is called. The documents are deleted at the end, and carry ``expireAt`` one hour ahead
so the TTL policy removes them even if the script is interrupted.

    cd bookmind-server
    gcloud auth application-default login          # operator account, once
    venv/bin/python scripts/check_quota_concurrency.py --project <firebase-project-id>

Two phases:

1. pair   several rounds of TWO simultaneous requests from the same user with a limit of 1:
          exactly one must be allowed in every round (never two).
2. burst  many simultaneous requests with a limit of 5: at most 5 allowed, and the stored count
          must equal the number allowed.

Exit code 0: PASS. 1: FAIL (the quota let more calls through than the limit, or the stored count
disagrees). 2: usage error. Requests that raise (for example a transaction that exhausted its
retries under contention) are reported but are not a failure: in the API they become 503, a
refused request, never an extra LLM call.
"""

import argparse
import os
import sys
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, List

# Allow `python scripts/check_quota_concurrency.py` from bookmind-server/.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


@dataclass
class RaceResult:
    doc_id: str
    limit: int
    requests: int
    allowed: int
    refused: int
    errors: int
    stored_count: int

    @property
    def over_limit(self) -> bool:
        return self.allowed > self.limit or self.stored_count > self.limit

    @property
    def count_mismatch(self) -> bool:
        # A request that raised may still have committed (the reply was lost), so it can add one.
        return not (self.allowed <= self.stored_count <= self.allowed + self.errors)

    @property
    def failed(self) -> bool:
        return self.over_limit or self.count_mismatch


@dataclass
class CheckReport:
    pair: List[RaceResult] = field(default_factory=list)
    burst: List[RaceResult] = field(default_factory=list)

    @property
    def results(self) -> List[RaceResult]:
        return self.pair + self.burst

    @property
    def passed(self) -> bool:
        return not any(r.failed for r in self.results)


def race(
    store,
    read_count: Callable[[str], int],
    doc_id: str,
    limit: int,
    requests: int,
    expire_at: datetime,
) -> RaceResult:
    """Fire `requests` simultaneous try_consume calls on one document and read the outcome."""
    barrier = threading.Barrier(requests)

    def one_request() -> object:
        barrier.wait()  # release every thread at the same moment
        try:
            return store.try_consume(doc_id, limit, expire_at)
        except Exception as exc:  # noqa: BLE001 - reported, see module docstring
            return exc

    with ThreadPoolExecutor(max_workers=requests) as pool:
        outcomes = list(pool.map(lambda _: one_request(), range(requests)))

    return RaceResult(
        doc_id=doc_id,
        limit=limit,
        requests=requests,
        allowed=sum(1 for o in outcomes if o is True),
        refused=sum(1 for o in outcomes if o is False),
        errors=sum(1 for o in outcomes if isinstance(o, Exception)),
        stored_count=read_count(doc_id),
    )


def run_check(
    store,
    read_count: Callable[[str], int],
    delete: Callable[[str], None],
    *,
    rounds: int = 5,
    burst_requests: int = 20,
    burst_limit: int = 5,
    run_id: str | None = None,
) -> CheckReport:
    run_id = run_id or uuid.uuid4().hex[:8]
    expire_at = datetime.now(timezone.utc) + timedelta(hours=1)
    report = CheckReport()
    created: List[str] = []
    try:
        for i in range(rounds):
            doc_id = f"quotacheck-{run_id}-pair-{i}"
            created.append(doc_id)
            report.pair.append(race(store, read_count, doc_id, 1, 2, expire_at))
        doc_id = f"quotacheck-{run_id}-burst"
        created.append(doc_id)
        report.burst.append(
            race(store, read_count, doc_id, burst_limit, burst_requests, expire_at)
        )
    finally:
        for doc_id in created:
            try:
                delete(doc_id)
            except Exception as exc:  # noqa: BLE001
                print(f"warning: could not delete {doc_id} ({type(exc).__name__}); TTL will", file=sys.stderr)
    return report


def print_report(report: CheckReport) -> None:
    for phase, results in (("pair ", report.pair), ("burst", report.burst)):
        for r in results:
            status = "FAIL" if r.failed else "ok  "
            print(
                f"{status} {phase} limit={r.limit} requests={r.requests} "
                f"allowed={r.allowed} refused={r.refused} errors={r.errors} stored_count={r.stored_count}"
            )
    errors = sum(r.errors for r in report.results)
    if errors:
        print(f"note: {errors} request(s) raised (transaction retries exhausted?): refused, not over-counted")
    print("PASS" if report.passed else "FAIL: the quota allowed more calls than its limit")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--project", required=True, help="Firebase / GCP project id whose Firestore is used")
    parser.add_argument("--rounds", type=int, default=5, help="rounds of the two-request race (default 5)")
    parser.add_argument("--burst", type=int, default=20, help="simultaneous requests in the burst (default 20)")
    args = parser.parse_args(argv)
    if args.rounds < 1 or args.burst < 2:
        parser.error("--rounds must be >= 1 and --burst >= 2")

    os.environ["FIREBASE_PROJECT_ID"] = args.project
    import quota  # imported late: it reads FIREBASE_PROJECT_ID when the client is first used

    store = quota.FirestoreQuotaStore()
    try:
        client = store._get_client()
    except Exception as exc:  # noqa: BLE001
        print(
            f"Cannot create the Firestore client ({type(exc).__name__}). "
            "Run `gcloud auth application-default login` first.",
            file=sys.stderr,
        )
        return 2
    collection = client.collection(quota.COLLECTION)

    def read_count(doc_id: str) -> int:
        snapshot = collection.document(doc_id).get()
        return int((snapshot.to_dict() or {}).get("count", 0)) if snapshot.exists else 0

    def delete(doc_id: str) -> None:
        collection.document(doc_id).delete()

    print(f"Firestore project {args.project}: writing synthetic llmQuota/quotacheck-* documents")
    report = run_check(store, read_count, delete, rounds=args.rounds, burst_requests=args.burst)
    print_report(report)
    return 0 if report.passed else 1


if __name__ == "__main__":
    sys.exit(main())
