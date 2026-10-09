"""Score the raw runs of `run_eval.py`: quality, JSON reliability, latency and cost.

    python eval/score.py                       # all candidates found in results/raw
    python eval/score.py --candidates a,b      # a subset
    python eval/score.py --refresh-books       # re-verify every book (use after adding GOOGLE_BOOKS_API_KEY)

Reads `results/raw/*.jsonl`, writes `results/summary.json`, `results/summary.md` and
`results/unverified_books.md`, and prints the markdown tables. The book cache is
`results/books_cache.json`. No LLM call is made here.
"""

import argparse
import json
import math
import os
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from books import BookVerifier  # noqa: E402
from checks import already_read, clarifier_checks, language_ok, lenient_json, reason_cites_reader  # noqa: E402

CHATS_PER_USER_PER_DAY = 5  # the quota is 10 LLM calls a day; one chat = clarify + recommendations
DAYS_PER_MONTH = 30
DAU = 100
P95_THRESHOLD_S = 15.0  # design decision 10
CLIENT_TIMEOUT_S = 30.0


def percentile(values: List[float], pct: float) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    pos = (len(ordered) - 1) * pct / 100
    lo, hi = math.floor(pos), math.ceil(pos)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def call_cost(cand: Dict[str, Any], rec: Dict[str, Any]) -> float:
    usage = (rec.get("llm") or {}).get("usage")
    if not usage:
        return 0.0
    base = ((usage.get("prompt_tokens") or 0) * cand["price_in"] + (usage.get("completion_tokens") or 0) * cand["price_out"]) / 1e6
    return base * cand.get("router_fee_multiplier", 1.0)


def load_records(raw_dir: Path, wanted: Optional[List[str]]) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {}
    for path in sorted(raw_dir.glob("*.jsonl")):
        if wanted and path.stem not in wanted:
            continue
        out[path.stem] = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return out


def fmt(value: Optional[float], digits: int = 2) -> str:
    return "n/a" if value is None else f"{value:.{digits}f}"


def score_candidate(cid: str, cand: Dict[str, Any], recs: List[Dict[str, Any]], cases: Dict[str, Any], verifier: BookVerifier, refresh: bool) -> Dict[str, Any]:
    plain = [r for r in recs if r["variant"] == "plain"]
    clar = [r for r in plain if r["endpoint"] == "clarify"]
    rec_plain = [r for r in plain if r["endpoint"] == "recommend"]
    rec_rf = [r for r in recs if r["variant"] == "rf" and r["endpoint"] == "recommend"]

    summary: Dict[str, Any] = {"id": cid, "model": cand["model"], "router": cand["router"], "pinned_provider": cand["pinned_provider"]}

    # -- clarifier --------------------------------------------------------------------------------
    def clarify_stats(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        ok_rows = [r for r in rows if r["http_status"] == 200]
        fail_checks: Counter = Counter()
        passed = 0
        for r in ok_rows:
            case = cases[r["case"]]
            checks = clarifier_checks(r["response"]["question"], case["lang"], case["off_topic"])
            for name, ok in checks.items():
                if not ok:
                    fail_checks[name] += 1
            passed += all(checks.values())
        return {
            "calls": len(rows),
            "http_ok": len(ok_rows),
            "all_checks_pass": passed,
            "failed_checks": dict(fail_checks),
            "score_pct": round(100 * passed / len(rows), 1) if rows else None,
        }

    clar_ok = [r for r in clar if r["http_status"] == 200]
    summary["clarify"] = clarify_stats(clar)
    clar_rfall = [r for r in recs if r["variant"] == "rfall" and r["endpoint"] == "clarify"]
    summary["clarify_response_format_all"] = clarify_stats(clar_rfall) if clar_rfall else None

    # -- recommendations: JSON reliability ---------------------------------------------------------
    def json_stats(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        ok = [r for r in rows if r["http_status"] == 200]
        fails = [r for r in rows if r["http_status"] != 200]
        fail_kinds = Counter()
        cosmetic = 0
        for r in fails:
            llm = r.get("llm") or {}
            if llm.get("error_class"):
                fail_kinds[f"provider error {llm.get('error_status')}"] += 1
            elif llm.get("finish_reason") == "length":
                fail_kinds["truncated (finish_reason=length)"] += 1
            else:
                fail_kinds[str((r.get("response") or {}).get("detail"))] += 1
                if lenient_json(llm.get("content", "")) is not None:
                    cosmetic += 1
        return {
            "calls": len(rows),
            "accepted": len(ok),
            "failed": len(fails),
            "accept_rate_pct": round(100 * len(ok) / len(rows), 1) if rows else None,
            "failure_kinds": dict(fail_kinds),
            "failures_fixed_by_lenient_parser": cosmetic,
        }

    summary["json_plain"] = json_stats(rec_plain)
    summary["json_response_format"] = json_stats(rec_rf) if rec_rf else None
    rec_rfall = [r for r in recs if r["variant"] == "rfall" and r["endpoint"] == "recommend"]
    summary["json_response_format_all"] = json_stats(rec_rfall) if rec_rfall else None

    # -- recommendations: quality ------------------------------------------------------------------
    # Quality is judged on every answer the production parser accepted, whatever the variant: a
    # formatting failure (markdown fences) says nothing about the books, and a larger sample makes the
    # existence rate steadier. Acceptance itself is reported separately and applied to the overall score.
    answers = []
    for r in [x for x in recs if x["endpoint"] == "recommend" and x["http_status"] == 200]:
        case = cases[r["case"]]
        books = r["response"]
        reader_text = " ".join(case["transcript"]) + " " + " ".join(lb["title"] for lb in case["liked_books"])
        status = [verifier.status(b["title"], b["author"]) for b in books]
        strict = [s in ("found", "real") for s in status]
        reasons = " ".join(b.get("reason", "") for b in books)
        cites = [reason_cites_reader(b.get("reason", ""), reader_text) for b in books]
        read = [already_read(b["title"], case["liked_books"]) for b in books]
        ans = {
            "case": r["case"],
            "run": r["run"],
            "off_topic": case["off_topic"],
            "three_books": len(books) == 3,
            "language_ok": language_ok(reasons, case["lang"]),
            "cite_fraction": None if case["off_topic"] else sum(cites) / max(len(books), 1),
            "no_already_read": not any(read),
            "already_read_count": sum(read),
            "verified_fraction": sum(strict) / max(len(books), 1),
            "catalogue_fraction": sum(s == "found" for s in status) / max(len(books), 1),
            "lenient_fraction": sum(s in ("found", "real", "title_off") for s in status) / max(len(books), 1),
            "invented_fraction": sum(s == "invented" for s in status) / max(len(books), 1),
            "status": status,
            "unverified": [(b["title"], b["author"]) for b, ok in zip(books, strict) if not ok],
        }
        parts = [ans["three_books"], ans["language_ok"], ans["no_already_read"], ans["verified_fraction"]]
        if ans["cite_fraction"] is not None:
            parts.append(ans["cite_fraction"])
        ans["score_pct"] = round(100 * sum(float(p) for p in parts) / len(parts), 1)
        answers.append(ans)

    def mean(xs: List[float]) -> Optional[float]:
        return sum(xs) / len(xs) if xs else None

    on_topic = [a for a in answers if not a["off_topic"]]
    summary["recommend_quality"] = {
        "scored_answers": len(answers),
        "three_books_pct": round(100 * mean([float(a["three_books"]) for a in answers]), 1) if answers else None,
        "language_ok_pct": round(100 * mean([float(a["language_ok"]) for a in answers]), 1) if answers else None,
        "reason_cites_reader_pct": round(100 * mean([a["cite_fraction"] for a in on_topic]), 1) if on_topic else None,
        "answers_with_already_read_pct": round(100 * mean([float(not a["no_already_read"]) for a in answers]), 1) if answers else None,
        "books_verified_pct": round(100 * mean([a["verified_fraction"] for a in answers]), 1) if answers else None,
        "books_in_catalogue_pct": round(100 * mean([a["catalogue_fraction"] for a in answers]), 1) if answers else None,
        "books_exist_lenient_pct": round(100 * mean([a["lenient_fraction"] for a in answers]), 1) if answers else None,
        "books_invented_pct": round(100 * mean([a["invented_fraction"] for a in answers]), 1) if answers else None,
        "books_not_reviewed": sum(s == "not_found" for a in answers for s in a["status"]),
        "answers_all_three_verified_pct": round(100 * mean([float(a["verified_fraction"] == 1) for a in answers]), 1) if answers else None,
        "answers_all_three_verified_on_topic_pct": round(100 * mean([float(a["verified_fraction"] == 1) for a in on_topic]), 1) if on_topic else None,
        "books_verified_on_topic_pct": round(100 * mean([a["verified_fraction"] for a in on_topic]), 1) if on_topic else None,
        "score_pct": round(mean([a["score_pct"] for a in answers]), 1) if answers else None,
        "unverified": sorted({f"{t} — {a}" for ans in answers for t, a in ans["unverified"]}),
    }
    rq, cq = summary["recommend_quality"]["score_pct"], summary["clarify"]["score_pct"]
    # A failed call scores 0 (the user would see an error). The clarifier score already counts every
    # call; the recommendation score covers accepted answers only, so it is weighted by acceptance.
    rec_accept = (summary["json_plain"]["accepted"] / summary["json_plain"]["calls"]) if summary["json_plain"]["calls"] else 0
    summary["recommend_quality"]["score_all_calls_pct"] = round((rq or 0) * rec_accept, 1)
    summary["quality_overall_pct"] = round(0.7 * (rq or 0) * rec_accept + 0.3 * (cq or 0), 1)

    # -- latency -------------------------------------------------------------------------------------
    def lat(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        vals = [r["endpoint_latency_s"] for r in rows if r["http_status"] == 200]
        return {
            "n": len(vals),
            "p50": percentile(vals, 50),
            "p95": percentile(vals, 95),
            "max": max(vals) if vals else None,
            "over_30s": sum(v > CLIENT_TIMEOUT_S for v in vals),
        }

    summary["latency_clarify"] = lat(clar)
    summary["latency_recommend"] = lat(rec_plain)

    # -- cost ----------------------------------------------------------------------------------------
    def mean_cost(rows: List[Dict[str, Any]]) -> Optional[float]:
        usable = [r for r in rows if (r.get("llm") or {}).get("usage")]
        return mean([call_cost(cand, r) for r in usable])

    def mean_tokens(rows: List[Dict[str, Any]], field: str) -> Optional[float]:
        vals = [r["llm"]["usage"][field] for r in rows if (r.get("llm") or {}).get("usage") and r["llm"]["usage"].get(field) is not None]
        return mean(vals)

    c_clar, c_rec = mean_cost(clar), mean_cost(rec_plain)
    chat = (c_clar or 0) + (c_rec or 0)
    summary["cost"] = {
        "clarify_usd": c_clar,
        "recommend_usd": c_rec,
        "per_chat_usd": chat,
        "per_user_day_usd": chat * CHATS_PER_USER_PER_DAY,
        "per_month_100dau_usd": chat * CHATS_PER_USER_PER_DAY * DAYS_PER_MONTH * DAU,
        "tokens_in_clarify": mean_tokens(clar, "prompt_tokens"),
        "tokens_out_clarify": mean_tokens(clar, "completion_tokens"),
        "tokens_in_recommend": mean_tokens(rec_plain, "prompt_tokens"),
        "tokens_out_recommend": mean_tokens(rec_plain, "completion_tokens"),
        "reasoning_tokens_recommend": mean_tokens(rec_plain, "reasoning_tokens"),
        "total_spent_usd": sum(call_cost(cand, r) for r in recs),
    }

    # -- pin evidence --------------------------------------------------------------------------------
    served = Counter()
    for r in recs:
        llm = r.get("llm") or {}
        if llm.get("served_model"):
            served[(llm.get("served_provider"), llm.get("served_model"))] += 1
    summary["served_by"] = {f"{p} / {m}": n for (p, m), n in served.items()}
    return summary


def tables(results: List[Dict[str, Any]]) -> str:
    def pct(v: Optional[float]) -> str:
        return fmt(v, 1)

    def rate(s: Dict[str, Any], key: str) -> str:
        block = s.get(key)
        return f"{pct(block['accept_rate_pct'])} ({block['accepted']}/{block['calls']})" if block else "n/a"

    out = []
    out.append("**Quality** (percent; rubric score is the mean of five checks per answer)\n")
    out.append(
        "| Candidate | Rec. score | Books found in catalogues | Books that exist (catalogue + manual review) | Real book, wrong title | Invented | Answers with 3/3 existing | "
        "Reasons cite reader | Already-read repeats | Clarifier score | Overall (70/30 x acceptance) |"
    )
    out.append("|---|---|---|---|---|---|---|---|---|---|---|")
    for s in results:
        q = s["recommend_quality"]
        wrong_title = None if q["books_exist_lenient_pct"] is None else round(q["books_exist_lenient_pct"] - q["books_verified_pct"], 1)
        out.append(
            f"| {s['id']} | {pct(q['score_pct'])} | {pct(q['books_in_catalogue_pct'])} | {pct(q['books_verified_pct'])} | {pct(wrong_title)} | {pct(q['books_invented_pct'])} | "
            f"{pct(q['answers_all_three_verified_pct'])} | {pct(q['reason_cites_reader_pct'])} | {pct(q['answers_with_already_read_pct'])} | "
            f"{pct(s['clarify']['score_pct'])} | {pct(s['quality_overall_pct'])} |"
        )
    out.append("\n**JSON reliability of /recommendations** (share of calls the unchanged parser accepted)\n")
    out.append("| Candidate | Plain (production request) | + response_format on /recommendations only | + response_format on both endpoints | Clarifier checks with response_format on both |")
    out.append("|---|---|---|---|---|")
    for s in results:
        cl = s.get("clarify_response_format_all")
        clar = f"{pct(cl['score_pct'])} ({cl['all_checks_pass']}/{cl['calls']})" if cl else "n/a"
        out.append(f"| {s['id']} | {rate(s, 'json_plain')} | {rate(s, 'json_response_format')} | {rate(s, 'json_response_format_all')} | {clar} |")
    out.append("\n**Latency** (seconds, HTTP 200 only, measured from the operator's machine)\n")
    out.append("| Candidate | /recommendations p50 | p95 | max | /clarify p50 | p95 | calls over 30 s |")
    out.append("|---|---|---|---|---|---|---|")
    for s in results:
        r, c = s["latency_recommend"], s["latency_clarify"]
        out.append(f"| {s['id']} | {fmt(r['p50'])} | {fmt(r['p95'])} | {fmt(r['max'])} | {fmt(c['p50'])} | {fmt(c['p95'])} | {r['over_30s'] + c['over_30s']} |")
    out.append("\n**Cost** (measured tokens x listed price, plus the credit fee where it exists)\n")
    out.append("| Candidate | Tokens in/out clarify | Tokens in/out recommend | $/chat | $/user/day (5 chats = 10 calls) | $/month (100 DAU) | Spent in this evaluation |")
    out.append("|---|---|---|---|---|---|---|")
    for s in results:
        c = s["cost"]
        out.append(
            f"| {s['id']} | {fmt(c['tokens_in_clarify'], 0)} / {fmt(c['tokens_out_clarify'], 0)} | {fmt(c['tokens_in_recommend'], 0)} / {fmt(c['tokens_out_recommend'], 0)} | "
            f"{fmt(c['per_chat_usd'], 5)} | {fmt(c['per_user_day_usd'], 4)} | {fmt(c['per_month_100dau_usd'], 2)} | {fmt(c['total_spent_usd'], 4)} |"
        )
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", default=str(HERE / "results" / "raw"))
    parser.add_argument("--candidates", help="comma-separated candidate ids")
    parser.add_argument("--refresh-books", action="store_true")
    parser.add_argument("--recheck-unverified", action="store_true", help="re-run the lookups only for books cached as not found")
    parser.add_argument("--env-file", help="env file that may hold GOOGLE_BOOKS_API_KEY")
    args = parser.parse_args()

    google_key = None
    env_path = Path(args.env_file or os.environ.get("BOOKMIND_ENV_FILE") or HERE.parent / ".env")
    if env_path.exists():
        from dotenv import dotenv_values

        google_key = (dotenv_values(env_path).get("GOOGLE_BOOKS_API_KEY") or "").strip() or None

    candidates = {c["id"]: c for c in json.loads((HERE / "candidates.json").read_text(encoding="utf-8"))["candidates"]}
    cases = {c["id"]: c for c in json.loads((HERE / "cases.json").read_text(encoding="utf-8"))["cases"]}
    wanted = args.candidates.split(",") if args.candidates else None
    records = load_records(Path(args.raw), wanted)

    verifier = BookVerifier(HERE / "results" / "books_cache.json", google_key=google_key)
    # Verify every distinct book first, in parallel; scoring then reads the cache.
    todo = {}
    for cid, recs in records.items():
        for r in recs:
            if r["endpoint"] == "recommend" and r["http_status"] == 200:
                for b in r["response"]:
                    todo[BookVerifier.key(b["title"], b["author"])] = (b["title"], b["author"])
    pending = [
        (t, a)
        for k, (t, a) in todo.items()
        if args.refresh_books or k not in verifier.cache or (args.recheck_unverified and not verifier.cache[k]["verified"])
    ]
    print(f"{len(todo)} distinct books, {len(pending)} to verify (Google Books key: {'yes' if google_key else 'no'})", file=sys.stderr)
    refresh = args.refresh_books or args.recheck_unverified
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda ta: verifier.verify(ta[0], ta[1], refresh=refresh), pending))
    verifier.save()
    verifier.load_review(HERE / "book_review.tsv")

    results = [score_candidate(cid, candidates[cid], recs, cases, verifier, False) for cid, recs in records.items() if cid in candidates]
    out_dir = HERE / "results"
    (out_dir / "summary.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    table = tables(results)
    (out_dir / "summary.md").write_text(table + "\n", encoding="utf-8")

    # Books no catalogue found and nobody reviewed yet: the work list for `book_review.json`.
    waiting: Dict[str, Dict[str, Any]] = {}
    for cid, recs in records.items():
        for r in recs:
            if r["endpoint"] == "recommend" and r["http_status"] == 200:
                for b in r["response"]:
                    key = BookVerifier.key(b["title"], b["author"])
                    if verifier.status(b["title"], b["author"]) == "not_found":
                        entry = waiting.setdefault(key, {"title": b["title"], "author": b["author"], "count": 0, "candidates": set()})
                        entry["count"] += 1
                        entry["candidates"].add(cid)
    todo_rows = [{"key": k, **{**v, "candidates": sorted(v["candidates"])}} for k, v in sorted(waiting.items())]
    (out_dir / "review_todo.json").write_text(json.dumps(todo_rows, ensure_ascii=False, indent=1), encoding="utf-8")

    lines = ["# Books that no catalogue found, with the manual review label (per candidate)\n"]
    for s in results:
        lines.append(f"\n## {s['id']} ({len(s['recommend_quality']['unverified'])})\n")
        lines.extend(f"- {u}" for u in s["recommend_quality"]["unverified"])
    (out_dir / "unverified_books.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(table)
    print(f"\n{len(todo_rows)} books still waiting for review (results/review_todo.json)", file=sys.stderr)


if __name__ == "__main__":
    main()
