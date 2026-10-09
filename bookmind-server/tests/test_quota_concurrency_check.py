"""The operator's concurrency check (scripts/check_quota_concurrency.py), tested on its own logic.

The real run needs Firestore. Here the store is replaced by an atomic one (the check must PASS)
and by a read-then-write one without a transaction (the check must FAIL): proof that the script
can actually detect a quota that leaks under concurrency.
"""

import threading
import time
from datetime import datetime

import pytest

from scripts import check_quota_concurrency as check


class Backing:
    def __init__(self) -> None:
        self.docs: dict[str, int] = {}
        self.deleted: list[str] = []

    def read_count(self, doc_id: str) -> int:
        return self.docs.get(doc_id, 0)

    def delete(self, doc_id: str) -> None:
        self.deleted.append(doc_id)
        self.docs.pop(doc_id, None)


class AtomicStore:
    def __init__(self, backing: Backing) -> None:
        self.backing = backing
        self.lock = threading.Lock()

    def try_consume(self, doc_id: str, limit: int, expire_at: datetime) -> bool:
        with self.lock:
            count = self.backing.docs.get(doc_id, 0)
            if count >= limit:
                return False
            self.backing.docs[doc_id] = count + 1
            return True


class RacyStore(AtomicStore):
    """Read, pause, then write: what a counter without a transaction does."""

    def try_consume(self, doc_id: str, limit: int, expire_at: datetime) -> bool:
        count = self.backing.docs.get(doc_id, 0)
        if count >= limit:
            return False
        time.sleep(0.05)
        self.backing.docs[doc_id] = count + 1
        return True


class FlakyStore(AtomicStore):
    """Every call after the first raises, like a transaction that ran out of retries."""

    def __init__(self, backing: Backing) -> None:
        super().__init__(backing)
        self.calls = 0

    def try_consume(self, doc_id: str, limit: int, expire_at: datetime) -> bool:
        with self.lock:
            self.calls += 1
            if self.calls % 2 == 0:
                raise RuntimeError("aborted")
        return super().try_consume(doc_id, limit, expire_at)


def run(store_cls):
    backing = Backing()
    report = check.run_check(
        store_cls(backing), backing.read_count, backing.delete, rounds=3, burst_requests=12
    )
    return report, backing


def test_atomic_store_passes_with_exactly_one_allowed_per_pair():
    report, backing = run(AtomicStore)
    assert report.passed
    assert all(r.allowed == 1 and r.refused == 1 for r in report.pair)
    assert report.burst[0].allowed == 5 and report.burst[0].refused == 7
    assert report.burst[0].stored_count == 5


def test_racy_store_is_detected_as_over_limit():
    report, _ = run(RacyStore)
    assert not report.passed
    assert any(r.over_limit for r in report.pair)  # both of the two simultaneous calls got through


def test_errors_are_reported_but_never_counted_as_allowed():
    report, _ = run(FlakyStore)
    assert sum(r.errors for r in report.results) > 0
    assert not any(r.over_limit for r in report.results)


def test_synthetic_documents_are_deleted_even_when_a_round_blows_up():
    backing = Backing()

    class Boom(AtomicStore):
        def try_consume(self, doc_id, limit, expire_at):
            raise KeyboardInterrupt  # not an Exception: escapes the per-request handler

    with pytest.raises(BaseException):
        check.run_check(Boom(backing), backing.read_count, backing.delete, rounds=1, burst_requests=2)
    assert backing.deleted, "cleanup must run in a finally block"
    assert all(d.startswith("quotacheck-") for d in backing.deleted)


def test_project_is_required(capsys):
    with pytest.raises(SystemExit) as exc:
        check.main([])
    assert exc.value.code == 2
