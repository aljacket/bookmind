"""Tests of the offline LLM-provider evaluation helpers in `eval/` (card #71).

Nothing here touches the network or a real LLM.
"""

import json
import os
import sys
from pathlib import Path

import pytest

EVAL_DIR = Path(__file__).resolve().parent.parent / "eval"
sys.path.insert(0, str(EVAL_DIR))

import checks  # noqa: E402
import run_eval  # noqa: E402
import score  # noqa: E402


def test_discriminating_stopwords_are_disjoint():
    sets = list(checks.DISCRIMINATING.values())
    for i, a in enumerate(sets):
        for b in sets[i + 1 :]:
            assert not (a & b)


@pytest.mark.parametrize(
    "text,lang",
    [
        ("Perché hai amato Montalbano, questo libro è più leggero.", "it"),
        ("Because you loved the warm friendships, this is a book with humour.", "en"),
        ("Porque te gustó la atmósfera, este libro es más actual y muy corto.", "es"),
    ],
)
def test_language_ok_accepts_the_right_language_only(text, lang):
    assert checks.language_ok(text, lang)
    assert not any(checks.language_ok(text, other) for other in ("it", "en", "es") if other != lang)


def test_clarifier_checks():
    good = checks.clarifier_checks("Preferisci una storia breve o più lunga?", "it", off_topic=False)
    assert all(good.values())
    assert not checks.clarifier_checks("Vuoi un giallo? Oppure altro?", "it", False)["single_question"]
    assert not checks.clarifier_checks("Che genere preferisci?", "it", False)["not_about_genre"]
    assert checks.clarifier_checks("Che genere preferisci?", "it", True)["not_about_genre"]
    assert not checks.clarifier_checks('{"question": "Preferisci una storia breve?"}', "it", False)["plain_text"]
    long_question = " ".join(["parole"] * 25) + "?"
    assert not checks.clarifier_checks(long_question, "it", False)["under_25_words"]
    assert checks.clarifier_checks(" ".join(["la"] * 24) + "?", "it", False)["under_25_words"]


def test_reason_must_share_a_word_stem_with_the_reader():
    reader = "Ho adorato Montalbano di Camilleri: mi è rimasta l'ironia"
    assert checks.reason_cites_reader("Se hai amato l'ironia di Camilleri, ti piacerà", reader)
    assert not checks.reason_cites_reader("Un libro molto bello e di successo", reader)


def test_title_and_author_matching():
    assert checks.titles_match("Il nome della rosa", "Nome della rosa")
    assert checks.titles_match("Sapiens: da animali a dèi", "Sapiens")
    assert not checks.titles_match("Il nome del vento", "Il nome della rosa")
    assert checks.author_matches("Maurizio de Giovanni", ["Maurizio De Giovanni"])
    assert checks.author_matches("J. K. Rowling", ["Rowling, J.K."])
    assert not checks.author_matches("Andrea Camilleri", ["Umberto Eco"])


def test_already_read_matches_by_title():
    liked = [{"title": "La forma dell'acqua", "author": "Andrea Camilleri"}]
    assert checks.already_read("La forma dell'acqua", liked)
    assert not checks.already_read("Il ladro di merendine", liked)


def test_lenient_json_is_only_a_diagnostic():
    fenced = '```json\n{"b":[{"t":"A","a":"B","r":"C"}]}\n```'
    with pytest.raises(json.JSONDecodeError):
        json.loads(fenced)  # the production parser rejects it
    assert checks.lenient_json(fenced) == {"b": [{"t": "A", "a": "B", "r": "C"}]}
    assert checks.lenient_json("no json here") is None


def test_percentile_interpolates():
    assert score.percentile([1, 2, 3, 4], 50) == 2.5
    assert score.percentile([5], 95) == 5
    assert score.percentile([], 50) is None
    values = list(range(1, 101))
    assert score.percentile(values, 95) == pytest.approx(95.05)


def test_cost_includes_the_router_fee():
    cand = {"price_in": 1.0, "price_out": 2.0, "router_fee_multiplier": 1.055}
    usage = {"prompt_tokens": 1000, "completion_tokens": 500}
    assert run_eval.call_cost_usd(cand, usage) == pytest.approx((1000 * 1 + 500 * 2) / 1e6 * 1.055)
    assert run_eval.call_cost_usd(cand, None) == 0.0
    assert score.call_cost(cand, {"llm": {"usage": usage}}) == pytest.approx(run_eval.call_cost_usd(cand, usage))


def test_redact_removes_keys_and_bearer_tokens():
    run_eval._LITERAL_SECRETS.append("literal-secret-value")
    # Built from pieces so that secret scanners do not flag the fixture.
    text = f"key {'sk' + '-abcdefghijklmnop1234'} {'hf' + '_abcdefghijklmnop1234'} {'Bear' + 'er abcdefgh12345678'} literal-secret-value"
    cleaned = run_eval.redact(text)
    for leaked in ("sk-abcdefgh", "hf_abcdefgh", "abcdefgh12345678", "literal-secret-value"):
        assert leaked not in cleaned
    run_eval._LITERAL_SECRETS.remove("literal-secret-value")


def test_configure_env_uses_the_production_variables(monkeypatch):
    for name in ("LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY", "LLM_EXTRA_BODY"):
        monkeypatch.delenv(name, raising=False)
    cand = {
        "key_env": "OPENROUTER_KEY",
        "model": "m/x",
        "base_url": "https://openrouter.ai/api/v1",
        "extra_body": {"provider": {"only": ["p"], "allow_fallbacks": False}},
    }
    run_eval.configure_env(cand, {"OPENROUTER_KEY": " test-key "}, "rf")
    assert os.environ["LLM_MODEL"] == "m/x"
    assert os.environ["LLM_BASE_URL"] == "https://openrouter.ai/api/v1"
    assert os.environ["LLM_API_KEY"] == "test-key"
    body = json.loads(os.environ["LLM_EXTRA_BODY"])
    assert body["provider"]["only"] == ["p"] and body["response_format"] == {"type": "json_object"}
    run_eval.configure_env(cand, {"OPENROUTER_KEY": "test-key"}, "plain")
    assert "response_format" not in json.loads(os.environ["LLM_EXTRA_BODY"])
    with pytest.raises(SystemExit):
        run_eval.configure_env(cand, {"OPENROUTER_KEY": ""}, "plain")
    run_eval._LITERAL_SECRETS.clear()


def test_book_review_overrides_decide_the_status(tmp_path):
    from books import BookVerifier

    verifier = BookVerifier(tmp_path / "cache.json")
    verifier.cache[BookVerifier.key("La strada", "Cormac McCarthy")] = {"verified": True, "source": "open_library"}
    verifier.cache[BookVerifier.key("Il segreto del lago", "Holly Seddon")] = {"verified": False, "source": None}
    review = tmp_path / "review.tsv"
    review.write_text(
        "label\ttitle\tauthor\tnote\n"
        "I\tIl segreto del lago\tHolly Seddon\tno such book\n"
        "T\tPensare veloce, pensare lento\tDaniel Kahneman\twrong Italian title\n"
        "R\tLa città e la città\tChina Miéville\tItalian title\n"
        "X\tIgnored\tUnknown label\tnot a label\n",
        encoding="utf-8",
    )
    verifier.load_review(review)
    assert verifier.status("La strada", "Cormac McCarthy") == "found"
    assert verifier.status("Il segreto del lago", "Holly Seddon") == "invented"
    assert verifier.status("Pensare veloce, pensare lento", "Daniel Kahneman") == "title_off"
    assert verifier.status("La città e la città", "China Miéville") == "real"
    assert verifier.status("Ignored", "Unknown label") == "not_found"


def test_sbn_lookup_matches_title_and_author(tmp_path, monkeypatch):
    import books
    from books import BookVerifier

    records = {
        "briefRecords": [
            {"titolo": "Il labirinto degli spiriti / Carlos Ruiz Zafón", "autorePrincipale": "Ruiz Zafón, Carlos"},
            {"titolo": "Il mistero della casa del tempo / regia di Eli Roth", "autorePrincipale": ""},
        ]
    }
    monkeypatch.setattr(books, "_get_json", lambda url, retries=3: records)
    verifier = BookVerifier(tmp_path / "cache.json", pause_s=0)
    assert verifier._sbn("Il labirinto degli spiriti", "Carlos Ruiz Zafón")["source"] == "sbn"
    assert verifier._sbn("Il mistero della casa del tempo", "John Bellairs") is None  # film record, no author
    assert verifier.recheck_sbn("Il labirinto degli spiriti", "Carlos Ruiz Zafón")
    assert verifier.status("Il labirinto degli spiriti", "Carlos Ruiz Zafón") == "found"


def test_bootstrap_gap_is_clustered_by_case_and_reproducible():
    results = [
        {"id": "a", "case_means": {"c1": {"exist": 1.0, "invented": 0.0}, "c2": {"exist": 0.8, "invented": 0.1}, "c3": {"exist": 0.9, "invented": 0.0}}},
        {"id": "b", "case_means": {"c1": {"exist": 0.7, "invented": 0.2}, "c2": {"exist": 0.6, "invented": 0.3}, "c3": {"exist": 0.8, "invented": 0.1}}},
    ]
    first = score.bootstrap_gap(results, "a", "b", n=500)
    assert first == score.bootstrap_gap(results, "a", "b", n=500)
    assert first["cases"] == 3
    assert first["exist"]["gap_pts"] == pytest.approx(20.0)
    assert first["invented"]["gap_pts"] == pytest.approx(-16.7, abs=0.05)
    low, high = first["exist"]["ci95"]
    assert low <= 20.0 <= high


def test_committed_review_file_is_well_formed():
    from books import BookVerifier

    lines = (EVAL_DIR / "book_review.tsv").read_text(encoding="utf-8").splitlines()
    assert lines[0].split("\t")[:3] == ["label", "title", "author"]
    keys = set()
    for number, line in enumerate(lines[1:], start=2):
        parts = line.split("\t")
        assert len(parts) == 4, f"line {number}: expected 4 tab-separated columns"
        assert parts[0] in BookVerifier.LABELS, f"line {number}: unknown label {parts[0]!r}"
        key = BookVerifier.key(parts[1], parts[2])
        assert key not in keys, f"line {number}: duplicate review entry"
        keys.add(key)


def test_every_candidate_is_pinned_and_priced():
    data = json.loads((EVAL_DIR / "candidates.json").read_text(encoding="utf-8"))["candidates"]
    ids = [c["id"] for c in data]
    assert len(ids) == len(set(ids))
    for c in data:
        assert c["price_in"] > 0 and c["price_out"] > 0 and c["price_url"]
        if c["router"] == "OpenRouter":
            provider = c["extra_body"]["provider"]
            assert provider["only"] and provider["allow_fallbacks"] is False
            assert provider["data_collection"] == "deny" and provider["zdr"] is True
        if c["router"].startswith("Hugging Face"):
            assert ":" in c["model"], "the Hugging Face provider must be pinned with a :provider suffix"


def test_test_set_meets_the_card():
    cases = json.loads((EVAL_DIR / "cases.json").read_text(encoding="utf-8"))["cases"]
    assert len(cases) >= 12
    assert sum(c["lang"] == "it" for c in cases) > len(cases) / 2
    assert {"en", "es"} <= {c["lang"] for c in cases}
    assert sum(c["off_topic"] for c in cases) == 2
    for c in cases:
        assert len(c["transcript"]) == 3 and all(0 < len(t) <= 500 for t in c["transcript"])
