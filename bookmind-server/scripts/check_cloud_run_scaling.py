"""Operator check: is the deployed service capped at the SERVICE-level min 0 / max 2?

Reads the output of ``gcloud run services describe <service> --format export`` on stdin and fails
visibly (exit 1, a line starting with FAIL) unless:

- ``run.googleapis.com/maxScale`` (service-level maximum instances) is present and equals the
  expected maximum (default 2);
- ``run.googleapis.com/minScale`` (service-level minimum instances) is absent or 0;
- the revision-level annotations ``autoscaling.knative.dev/minScale`` / ``maxScale``, if present,
  do not undo the cap (min 0, max not above the expected maximum).

The annotation names are the ones documented at
https://docs.cloud.google.com/run/docs/configuring/max-instances and
https://docs.cloud.google.com/run/docs/configuring/min-instances (checked 2026-10-09).

    gcloud run services describe bookmind-server --region europe-west1 --format export \
      | python3 scripts/check_cloud_run_scaling.py

Exit code 0: OK. 1: FAIL. 2: usage error.
"""

import argparse
import re
import sys
from typing import Dict, List, Optional

SERVICE_MAX = "run.googleapis.com/maxScale"
SERVICE_MIN = "run.googleapis.com/minScale"
REVISION_MAX = "autoscaling.knative.dev/maxScale"
REVISION_MIN = "autoscaling.knative.dev/minScale"

_LINE = re.compile(
    r"""^\s*(?P<key>run\.googleapis\.com/(?:max|min)Scale|autoscaling\.knative\.dev/(?:max|min)Scale)\s*:\s*['"]?(?P<value>\d+)['"]?\s*(?:#.*)?$"""
)


def parse_scaling(text: str) -> Dict[str, int]:
    found: Dict[str, int] = {}
    for line in text.splitlines():
        match = _LINE.match(line)
        if match:
            found[match.group("key")] = int(match.group("value"))
    return found


def verify(text: str, expected_max: int = 2) -> List[str]:
    """Return the list of problems; empty means the cap is in place."""
    found = parse_scaling(text)
    problems: List[str] = []

    service_max: Optional[int] = found.get(SERVICE_MAX)
    if service_max is None:
        problems.append(
            f"{SERVICE_MAX} not found: no service-level maximum is set (or this is not "
            "`gcloud run services describe ... --format export` output)"
        )
    elif service_max != expected_max:
        problems.append(f"{SERVICE_MAX} is {service_max}, expected {expected_max}")

    service_min = found.get(SERVICE_MIN, 0)
    if service_min != 0:
        problems.append(f"{SERVICE_MIN} is {service_min}, expected 0 (or unset)")

    revision_min = found.get(REVISION_MIN, 0)
    if revision_min != 0:
        problems.append(f"{REVISION_MIN} (revision-level) is {revision_min}, expected 0 (or unset)")
    revision_max = found.get(REVISION_MAX)
    if revision_max is not None and revision_max > expected_max:
        problems.append(
            f"{REVISION_MAX} (revision-level) is {revision_max}, above the expected maximum {expected_max}"
        )
    return problems


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--max", type=int, default=2, dest="expected_max", help="expected service-level maximum (default 2)")
    args = parser.parse_args(argv)
    if args.expected_max < 1:
        parser.error("--max must be >= 1")

    text = sys.stdin.read()
    found = parse_scaling(text)
    problems = verify(text, args.expected_max)
    print("scaling annotations found: " + (", ".join(f"{k}={v}" for k, v in sorted(found.items())) or "none"))
    for problem in problems:
        print(f"FAIL: {problem}")
    if problems:
        print("FAIL: the spend cap is NOT in place. Fix with: gcloud run services update <service> --min 0 --max 2")
        return 1
    print(f"OK: service-level scaling is min 0 / max {args.expected_max}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
