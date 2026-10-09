"""The operator's scaling check (scripts/check_cloud_run_scaling.py) on sample `--format export` YAML."""

import io

import pytest

from scripts import check_cloud_run_scaling as check

GOOD = """\
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  annotations:
    run.googleapis.com/maxScale: '2'
    run.googleapis.com/minScale: '0'
  name: bookmind-server
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/startup-cpu-boost: 'true'
"""


def run_main(monkeypatch, capsys, text, *argv):
    monkeypatch.setattr("sys.stdin", io.StringIO(text))
    code = check.main(list(argv))
    return code, capsys.readouterr().out


def test_service_level_min_0_max_2_is_ok(monkeypatch, capsys):
    code, out = run_main(monkeypatch, capsys, GOOD)
    assert code == 0
    assert out.splitlines()[-1].startswith("OK")


def test_unset_min_is_ok():
    assert check.verify(GOOD.replace("    run.googleapis.com/minScale: '0'\n", "")) == []


def test_missing_service_level_max_fails_even_with_a_revision_level_max(monkeypatch, capsys):
    text = GOOD.replace("    run.googleapis.com/maxScale: '2'\n", "") + (
        "        autoscaling.knative.dev/maxScale: '2'\n"
    )
    code, out = run_main(monkeypatch, capsys, text)
    assert code == 1
    assert "FAIL" in out and "run.googleapis.com/maxScale not found" in out


@pytest.mark.parametrize("value", ["1", "3", "100"])
def test_wrong_service_level_max_fails(value):
    problems = check.verify(GOOD.replace("maxScale: '2'", f"maxScale: '{value}'"))
    assert any("expected 2" in p for p in problems)


def test_service_level_min_above_zero_fails():
    assert check.verify(GOOD.replace("minScale: '0'", "minScale: '1'"))


def test_revision_level_override_that_undoes_the_cap_fails():
    assert check.verify(GOOD + "        autoscaling.knative.dev/minScale: '1'\n")
    assert check.verify(GOOD + "        autoscaling.knative.dev/maxScale: '100'\n")


def test_unquoted_and_double_quoted_values_are_read():
    assert check.verify(GOOD.replace("maxScale: '2'", "maxScale: 2")) == []
    assert check.verify(GOOD.replace("maxScale: '2'", 'maxScale: "2"')) == []


def test_empty_or_unrelated_input_fails(monkeypatch, capsys):
    code, out = run_main(monkeypatch, capsys, "")
    assert code == 1 and "FAIL" in out
