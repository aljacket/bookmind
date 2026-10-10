"""Check a small `run_eval.py --variants prod` run against the acceptance criteria of card #73.

    python eval/check_rerun.py --raw eval/results/rerun-73 --candidate openai-gpt-6-luna-noreason

Criteria (card #73, tasks 11.5): 0 provider/HTTP errors, 100 % of the /recommendations answers
accepted by the production parser, clarifier passing every check in at least 13 of 14 cases, p95
of /recommendations <= 15 s. It also prints a few quality checks and the spend. Book existence is
not re-checked (it needs the catalogue lookups of `score.py`, which are not part of this card).
No network, no LLM call. Exit status 1 when a criterion fails.
"""

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from checks import already_read, clarifier_checks, language_ok, reason_cites_reader  # noqa: E402

P95_THRESHOLD_S = 15.0
CLARIFIER_MIN_PASS = 13
CLARIFIER_CASES = 14


def percentile(values: List[float], pct: float) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    pos = (len(ordered) - 1) * pct / 100
    lo, hi = math.floor(pos), math.ceil(pos)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def spend_usd(candidate: Dict[str, Any], rows: List[Dict[str, Any]]) -> float:
    total = 0.0
    for row in rows:
        usage = (row.get("llm") or {}).get("usage")
        if usage:
            total += (
                (usage.get("prompt_tokens") or 0) * candidate["price_in"]
                + (usage.get("completion_tokens") or 0) * candidate["price_out"]
            ) / 1_000_000
    return total * candidate.get("router_fee_multiplier", 1.0)


def evaluate(rows: List[Dict[str, Any]], cases: Dict[str, Any], candidate: Dict[str, Any], smoke: bool = False) -> Dict[str, Any]:
    """`smoke` is for a few-case run: every clarifier call must pass, instead of 13 of 14 cases."""
    clarify = [r for r in rows if r["endpoint"] == "clarify"]
    recommend = [r for r in rows if r["endpoint"] == "recommend"]
    http_errors = [r for r in rows if r["http_status"] != 200 or (r.get("llm") or {}).get("error_class")]

    clarifier_passed = 0
    for row in clarify:
        if row["http_status"] != 200:
            continue
        case = cases[row["case"]]
        clarifier_passed += all(clarifier_checks(row["response"]["question"], case["lang"], case["off_topic"]).values())

    accepted = [r for r in recommend if r["http_status"] == 200]
    latencies = [r["endpoint_latency_s"] for r in accepted]
    quality: Dict[str, List[float]] = {"three_books": [], "language_ok": [], "no_already_read": [], "cites_reader": []}
    for row in accepted:
        case = cases[row["case"]]
        books = row["response"]
        reader_text = " ".join(case["transcript"]) + " " + " ".join(lb["title"] for lb in case["liked_books"])
        reasons = " ".join(b.get("reason", "") for b in books)
        quality["three_books"].append(float(len(books) == 3))
        quality["language_ok"].append(float(language_ok(reasons, case["lang"])))
        quality["no_already_read"].append(float(not any(already_read(b["title"], case["liked_books"]) for b in books)))
        if not case["off_topic"]:
            quality["cites_reader"].append(sum(reason_cites_reader(b.get("reason", ""), reader_text) for b in books) / max(len(books), 1))

    p95 = percentile(latencies, 95)
    if smoke:
        clarifier_label, clarifier_needed = "clarifier passes all checks in every call (smoke run)", len(clarify)
    else:
        clarifier_label = f"clarifier passes all checks in >= {CLARIFIER_MIN_PASS} of {CLARIFIER_CASES} cases"
        clarifier_needed = CLARIFIER_MIN_PASS
    result = {
        "candidate": candidate["id"],
        "model": candidate["model"],
        "calls": len(rows),
        "http_errors": len(http_errors),
        "recommend_calls": len(recommend),
        "recommend_accepted": len(accepted),
        "clarify_calls": len(clarify),
        "clarify_all_checks_pass": clarifier_passed,
        "recommend_p50_s": percentile(latencies, 50),
        "recommend_p95_s": p95,
        "recommend_max_s": max(latencies) if latencies else None,
        "clarify_p50_s": percentile([r["endpoint_latency_s"] for r in clarify if r["http_status"] == 200], 50),
        "quality_pct": {k: (round(100 * sum(v) / len(v), 1) if v else None) for k, v in quality.items()},
        "spend_usd": round(spend_usd(candidate, rows), 6),
        "tokens_in_out": [
            sum(((r.get("llm") or {}).get("usage") or {}).get("prompt_tokens") or 0 for r in rows),
            sum(((r.get("llm") or {}).get("usage") or {}).get("completion_tokens") or 0 for r in rows),
        ],
        "finish_reasons": sorted({(r.get("llm") or {}).get("finish_reason") or "none" for r in rows}),
        "served_models": sorted({(r.get("llm") or {}).get("served_model") or "none" for r in rows}),
    }
    result["criteria"] = {
        "0 HTTP errors": result["http_errors"] == 0,
        "100% of /recommendations accepted by the parser": bool(recommend) and len(accepted) == len(recommend),
        clarifier_label: clarifier_passed >= clarifier_needed,
        f"p95 of /recommendations <= {P95_THRESHOLD_S:.0f} s": p95 is not None and p95 <= P95_THRESHOLD_S,
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", required=True, help="directory with the jsonl written by run_eval.py --out")
    parser.add_argument("--candidate", required=True, help="id from candidates.json")
    parser.add_argument("--variant", default="prod")
    parser.add_argument("--smoke", action="store_true", help="few-case run: every clarifier call must pass")
    args = parser.parse_args()

    candidates = {c["id"]: c for c in json.loads((HERE / "candidates.json").read_text(encoding="utf-8"))["candidates"]}
    cases = {c["id"]: c for c in json.loads((HERE / "cases.json").read_text(encoding="utf-8"))["cases"]}
    path = Path(args.raw) / f"{args.candidate}.jsonl"
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    rows = [r for r in rows if r["variant"] == args.variant]
    result = evaluate(rows, cases, candidates[args.candidate], smoke=args.smoke)
    print(json.dumps(result, indent=1, ensure_ascii=False))
    if not all(result["criteria"].values()):
        print("CRITERIA NOT MET", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
