"""Blind rating sheet for the operator (card #71, checklist step 5).

    python eval/blind.py make [--cases a,b,c] [--candidates x,y] [--seed 71]
        writes results/blind/blind_sheet.md   (outputs under neutral labels, shuffled per case)
               results/blind/blind_scores.csv (template to fill in)
               results/blind/blind_key.json   (label -> candidate; do NOT open before rating)

    python eval/blind.py join results/blind/blind_scores.csv
        prints the mean score per candidate.

The sheet shows only the model output for one run per case (chosen by the seed). The labels are
re-drawn for every case, so a letter never means the same model twice.
"""

import argparse
import csv
import json
import random
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List

HERE = Path(__file__).resolve().parent
RAW = HERE / "results" / "raw"
OUT = HERE / "results" / "blind"
DEFAULT_CASES = "it-giallo,it-fantasy,it-consolante,en-cozy,es-historica"

RUBRIC = """\
Rate each output from 1 to 5 (whole numbers). Do not look up the model names.

Recommendations (3 books)
- 5: three real books that clearly fit what the reader wrote; every reason uses the reader's own words.
- 3: acceptable, but generic, or one book is a weak fit or looks invented.
- 1: wrong language, invented books, ignores the request, or repeats a book the reader already loved.

Question (the follow-up the reader is asked)
- 5: one natural question that opens a new angle (length, tone, novelty), not about genre.
- 3: fine but obvious, clumsy or slightly long.
- 1: not a question, several questions, about genre, or off-topic.
"""


def load(candidate: str) -> List[Dict[str, Any]]:
    path = RAW / f"{candidate}.jsonl"
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def make(args: argparse.Namespace) -> None:
    cases = {c["id"]: c for c in json.loads((HERE / "cases.json").read_text(encoding="utf-8"))["cases"]}
    excluded = {"openai-gpt-6-luna", "or-claude-haiku-5.5-bedrock-eu"}  # the as-configured runs that fail by design
    candidate_ids = args.candidates.split(",") if args.candidates else sorted(p.stem for p in RAW.glob("*.jsonl") if p.stem not in excluded)
    data = {cid: load(cid) for cid in candidate_ids}
    rng = random.Random(args.seed)
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = ["# Blind rating sheet\n", RUBRIC, "\nFill in `blind_scores.csv`: one row per output.\n"]
    key: Dict[str, Dict[str, Dict[str, Any]]] = {}
    rows: List[List[str]] = []
    for case_id in args.cases.split(","):
        case = cases[case_id]
        outputs = []
        for cid in candidate_ids:
            # The question comes from the production request; for the books, a formatting failure of
            # the plain request must not remove a candidate, so any accepted variant is used.
            recs = [r for r in data[cid] if r["case"] == case_id and r["http_status"] == 200]
            by_run = defaultdict(dict)
            for r in sorted(recs, key=lambda x: x["variant"] != "plain"):
                if r["endpoint"] == "clarify" and r["variant"] != "plain":
                    continue
                by_run[r["run"]].setdefault(r["endpoint"], r)
            complete = [run for run, d in by_run.items() if {"clarify", "recommend"} <= set(d)]
            if not complete:
                continue
            run = rng.choice(sorted(complete))
            outputs.append((cid, run, by_run[run]["clarify"]["response"]["question"], by_run[run]["recommend"]["response"]))
        rng.shuffle(outputs)
        sheet.append(f"\n## Case `{case_id}` ({case['lang']})\n")
        sheet.append("**Reader said**\n")
        for label, text in zip(("Mood", "Anchor book", "Answer to the follow-up"), case["transcript"]):
            sheet.append(f"- {label}: {text}")
        if case["liked_books"]:
            sheet.append("- Already read and loved: " + "; ".join(f"{b['title']} ({b['author']})" for b in case["liked_books"]))
        key[case_id] = {}
        for index, (cid, run, question, books) in enumerate(outputs):
            label = chr(ord("A") + index)
            key[case_id][label] = {"candidate": cid, "run": run}
            sheet.append(f"\n### {case_id} / {label}\n")
            sheet.append(f"Question: {question}\n")
            for n, book in enumerate(books, 1):
                sheet.append(f"{n}. *{book['title']}* — {book['author']}: {book.get('reason', '')}")
            rows.append([case_id, label, "", ""])
    (OUT / "blind_sheet.md").write_text("\n".join(sheet) + "\n", encoding="utf-8")
    (OUT / "blind_key.json").write_text(json.dumps(key, indent=1), encoding="utf-8")
    with (OUT / "blind_scores.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["case", "label", "question_score_1_5", "recommendations_score_1_5"])
        writer.writerows(rows)
    print(f"{len(rows)} outputs to rate -> {OUT / 'blind_sheet.md'}")


def join(args: argparse.Namespace) -> None:
    key = json.loads((OUT / "blind_key.json").read_text(encoding="utf-8"))
    totals: Dict[str, Dict[str, List[int]]] = defaultdict(lambda: {"question": [], "recommendations": []})
    with open(args.scores, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            cid = key[row["case"]][row["label"]]["candidate"]
            for field, name in (("question_score_1_5", "question"), ("recommendations_score_1_5", "recommendations")):
                if row[field].strip():
                    totals[cid][name].append(int(row[field]))
    print("| Candidate | Recommendations (mean 1-5) | Question (mean 1-5) | n |")
    print("|---|---|---|---|")
    for cid, d in sorted(totals.items()):
        mean = lambda xs: f"{sum(xs) / len(xs):.2f}" if xs else "n/a"  # noqa: E731
        print(f"| {cid} | {mean(d['recommendations'])} | {mean(d['question'])} | {len(d['recommendations'])} |")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    mk = sub.add_parser("make")
    mk.add_argument("--cases", default=DEFAULT_CASES)
    mk.add_argument("--candidates")
    mk.add_argument("--seed", type=int, default=71)
    mk.set_defaults(func=make)
    jn = sub.add_parser("join")
    jn.add_argument("scores")
    jn.set_defaults(func=join)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
