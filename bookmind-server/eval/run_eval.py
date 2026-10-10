"""Offline LLM-provider evaluation runner (card #71). Not part of the production image.

It drives the REAL FastAPI endpoints (`/recommendations/clarify` and `/recommendations`) through
FastAPI's TestClient, so the unchanged `prompts.py`, the unchanged `llm.py` configuration path
(`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_EXTRA_BODY`, `LLM_TOKEN_LIMIT_PARAM`,
`LLM_JSON_MODE`) and the unchanged response parser of
`main.py` are exercised exactly as in production. Only auth and quota are stubbed (no Firebase, no
Firestore). A recorder around the OpenAI SDK's `create()` captures token usage, the served model and
provider, and the raw text; it changes nothing except a per-call timeout that protects the budget.

One process runs one candidate (the provider is configured through process environment variables):

    python eval/run_eval.py --candidate or-mistral-small-2603-eu --runs 3

Keys are read from the env file (default: $BOOKMIND_ENV_FILE, else bookmind-server/.env). Only the
one variable named by the candidate's `key_env` is used; nothing is printed, and everything written
to disk passes through `redact()`.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).resolve().parent
SERVER_DIR = HERE.parent
sys.path.insert(0, str(SERVER_DIR))

from dotenv import dotenv_values  # noqa: E402

CALL_TIMEOUT_S = 90.0  # protects the budget; the app's own client timeout is 30 s
BOTH_ENDPOINTS = ("plain", "prod", "rfall")  # variants that call clarify and recommend
DEFAULT_MAX_USD = 0.40  # per candidate process
DEFAULT_GLOBAL_CAP_USD = 1.50  # across every raw file in the results directory
SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_\-]{10,}"),
    re.compile(r"hf_[A-Za-z0-9]{10,}"),
    re.compile(r"Bearer\s+[A-Za-z0-9._\-]{8,}"),
]
_LITERAL_SECRETS: List[str] = []


def redact(text: Any) -> str:
    out = str(text)
    for secret in _LITERAL_SECRETS:
        out = out.replace(secret, "[REDACTED]")
    for pattern in SECRET_PATTERNS:
        out = pattern.sub("[REDACTED]", out)
    return out


def load_json(name: str) -> Dict[str, Any]:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def call_cost_usd(candidate: Dict[str, Any], usage: Optional[Dict[str, Any]]) -> float:
    if not usage:
        return 0.0
    cost = (
        (usage.get("prompt_tokens") or 0) * candidate["price_in"]
        + (usage.get("completion_tokens") or 0) * candidate["price_out"]
    ) / 1_000_000
    return cost * candidate.get("router_fee_multiplier", 1.0)


def total_spent_usd(results_dir: Path, candidates: Dict[str, Dict[str, Any]]) -> float:
    total = 0.0
    for path in results_dir.glob("*.jsonl"):
        cand = candidates.get(path.stem)
        if cand is None:
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            total += call_cost_usd(cand, (rec.get("llm") or {}).get("usage"))
    return total


class Recorder:
    """Collects one entry per `Completions.create` call made by `llm.chat`."""

    def __init__(self) -> None:
        self.calls: List[Dict[str, Any]] = []


def install_sdk_recorder(recorder: Recorder) -> None:
    """Wrap the SDK call to record usage, latency and raw text, and to add a per-call timeout. It
    changes no request parameter: the token-limit name and `response_format` come from `llm.py`
    (`LLM_TOKEN_LIMIT_PARAM`, `LLM_JSON_MODE`), exactly as in production (card #73)."""
    import openai.resources.chat.completions as completions

    original = completions.Completions.create

    def patched(self, *args, **kwargs):  # noqa: ANN001
        kwargs.setdefault("timeout", CALL_TIMEOUT_S)
        started = time.perf_counter()
        try:
            response = original(self, *args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            recorder.calls.append(
                {
                    "error_class": type(exc).__name__,
                    "error_status": getattr(exc, "status_code", None),
                    "error_message": redact(exc)[:400],
                    "latency_s": round(time.perf_counter() - started, 3),
                }
            )
            raise
        elapsed = time.perf_counter() - started
        usage = getattr(response, "usage", None)
        details = getattr(usage, "completion_tokens_details", None) if usage else None
        extra = getattr(response, "model_extra", None) or {}
        recorder.calls.append(
            {
                "latency_s": round(elapsed, 3),
                "generation_id": getattr(response, "id", None),
                "served_model": getattr(response, "model", None),
                "served_provider": extra.get("provider"),
                "finish_reason": response.choices[0].finish_reason if response.choices else None,
                "content": ((response.choices[0].message.content or "") if response.choices else "").strip(),
                "usage": {
                    "prompt_tokens": getattr(usage, "prompt_tokens", None),
                    "completion_tokens": getattr(usage, "completion_tokens", None),
                    "reasoning_tokens": getattr(details, "reasoning_tokens", None) if details else None,
                }
                if usage
                else None,
            }
        )
        return response

    completions.Completions.create = patched  # type: ignore[method-assign]


def configure_env(candidate: Dict[str, Any], env: Dict[str, Optional[str]], variant: str) -> None:
    """Set the production environment variables for this candidate and variant.

    Variants (what `/recommendations` and `/recommendations/clarify` send):
    - `plain`: no `response_format` anywhere (`LLM_JSON_MODE=false`), the request before card #73;
    - `rf`: `llm.py`'s default, `json_object` on `/recommendations` only (recommendations only run);
    - `prod`: the same configuration as `rf`, but both endpoints are exercised (card #73 re-run);
    - `rfall`: `json_object` on both endpoints, forced through `LLM_EXTRA_BODY` (what the #71
      report called the clarifier failure).
    """
    for name in (
        "LLM_BASE_URL",
        "LLM_MODEL",
        "LLM_API_KEY",
        "LLM_EXTRA_BODY",
        "LLM_TOKEN_LIMIT_PARAM",
        "LLM_JSON_MODE",
        "OPENAI_BASE_URL",
    ):
        os.environ.pop(name, None)
    key = (env.get(candidate["key_env"]) or "").strip()
    if not key:
        raise SystemExit(f"{candidate['key_env']} is empty or missing in the env file")
    _LITERAL_SECRETS.append(key)
    os.environ["LLM_API_KEY"] = key
    os.environ["LLM_MODEL"] = candidate["model"]
    if candidate.get("base_url"):
        os.environ["LLM_BASE_URL"] = candidate["base_url"]
    if candidate.get("token_limit_param"):
        os.environ["LLM_TOKEN_LIMIT_PARAM"] = candidate["token_limit_param"]
    if variant == "plain":
        os.environ["LLM_JSON_MODE"] = "false"
    body: Dict[str, Any] = dict(candidate.get("extra_body") or {})
    if variant == "rfall":
        body["response_format"] = {"type": "json_object"}
    if body:
        os.environ["LLM_EXTRA_BODY"] = json.dumps(body)


def run_candidate(args: argparse.Namespace) -> None:
    candidates = {c["id"]: c for c in load_json("candidates.json")["candidates"]}
    candidate = candidates[args.candidate]
    cases = load_json("cases.json")["cases"]
    if args.cases:
        wanted = set(args.cases.split(","))
        cases = [c for c in cases if c["id"] in wanted]
    variants = args.variants.split(",")
    env_path = Path(args.env_file or os.environ.get("BOOKMIND_ENV_FILE") or SERVER_DIR / ".env")
    env = dotenv_values(env_path)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{candidate['id']}.jsonl"

    per_call_estimate = 0.0004  # rough upper bound used only for --dry-run
    n_calls = len(cases) * args.runs * sum(2 if v in BOTH_ENDPOINTS else 1 for v in variants)
    if args.dry_run:
        print(f"{candidate['id']}: {n_calls} calls, <= ~${n_calls * per_call_estimate:.3f} (rough)")
        return

    # Import the app only now, after the env guard, so no provider variable leaks in from `.env`.
    import auth  # noqa: F401
    import main
    import llm
    import quota
    from fastapi.testclient import TestClient

    recorder = Recorder()
    install_sdk_recorder(recorder)
    quota.consume_llm_call = lambda store, uid: None  # no quota in the offline harness
    main.quota.consume_llm_call = quota.consume_llm_call
    main.app.dependency_overrides[main.get_current_uid] = lambda: "eval-user"
    main.app.dependency_overrides[quota.get_quota_store] = lambda: object()
    client = TestClient(main.app, raise_server_exceptions=False)

    spent = 0.0
    consecutive_auth_errors = 0
    mode = "a" if args.append else "w"
    with out_path.open(mode, encoding="utf-8") as sink:
        for variant in variants:
            configure_env(candidate, env, variant)
            llm._client_for.cache_clear()
            endpoints = ["clarify", "recommend"] if variant in BOTH_ENDPOINTS else ["recommend"]
            for run in range(1, args.runs + 1):
                for case in cases:
                    for endpoint in endpoints:
                        if spent > args.max_usd:
                            raise SystemExit(f"STOP: per-candidate cap ${args.max_usd} reached")
                        lang = case["lang"]
                        turns = [{"role": "user", "content": t} for t in case["transcript"]]
                        if endpoint == "clarify":
                            url = "/recommendations/clarify"
                            body: Dict[str, Any] = {"lang": lang, "transcript": turns[:2]}
                        else:
                            url = "/recommendations"
                            body = {"lang": lang, "transcript": turns}
                            if case["liked_books"]:
                                body["liked_books"] = case["liked_books"]
                        recorder.calls.clear()
                        started = time.perf_counter()
                        response = client.post(url, json=body, headers={"Authorization": "Bearer eval"})
                        endpoint_latency = time.perf_counter() - started
                        try:
                            payload = response.json()
                        except ValueError:
                            payload = {"detail": "non-JSON response"}
                        llm_call = recorder.calls[-1] if recorder.calls else None
                        record = {
                            "candidate": candidate["id"],
                            "variant": variant,
                            "case": case["id"],
                            "run": run,
                            "endpoint": endpoint,
                            "http_status": response.status_code,
                            "endpoint_latency_s": round(endpoint_latency, 3),
                            "response": payload,
                            "llm": llm_call,
                            "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                        }
                        sink.write(redact(json.dumps(record, ensure_ascii=False)) + "\n")
                        sink.flush()
                        spent += call_cost_usd(candidate, (llm_call or {}).get("usage"))
                        status = (llm_call or {}).get("error_status")
                        consecutive_auth_errors = consecutive_auth_errors + 1 if status in (401, 402, 403) else 0
                        if consecutive_auth_errors >= 3:
                            raise SystemExit("STOP: 3 consecutive 401/402/403 from the provider")
                        done = f"{variant}/{run}/{case['id']}/{endpoint}"
                        print(f"{candidate['id']} {done} http={response.status_code} {endpoint_latency:.1f}s spent=${spent:.4f}", flush=True)
                if run % 1 == 0 and total_spent_usd(out_dir, candidates) > args.global_cap_usd:
                    raise SystemExit(f"STOP: global cap ${args.global_cap_usd} reached")
    print(f"{candidate['id']}: done, computed spend ${spent:.4f}")


def main_cli() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--candidate", required=True, help="id from candidates.json")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--cases", help="comma-separated case ids (default: all)")
    parser.add_argument(
        "--variants",
        default="plain,rf",
        help="plain = no response_format (LLM_JSON_MODE=false); rf = llm.py default, json_object on /recommendations only (recommendations run only); "
        "prod = same configuration as rf, both endpoints run (card #73 re-run); "
        "rfall = response_format on both endpoints, forced through LLM_EXTRA_BODY",
    )
    parser.add_argument("--out", default=str(HERE / "results" / "raw"))
    parser.add_argument("--env-file", help="path of the env file holding the keys")
    parser.add_argument("--max-usd", type=float, default=DEFAULT_MAX_USD)
    parser.add_argument("--global-cap-usd", type=float, default=DEFAULT_GLOBAL_CAP_USD)
    parser.add_argument("--append", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    run_candidate(parser.parse_args())


if __name__ == "__main__":
    main_cli()
