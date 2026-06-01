from __future__ import annotations

import importlib
import sys
from pathlib import Path

from app.services.pronunciation import aligner
from app.tasks import practice_tasks


def test_aligner_mock_and_fallback_and_mfa(monkeypatch):
  monkeypatch.setattr(aligner, "MFA_ENABLED", False)
  out = aligner.align_expected_text("hello world")
  assert out["alignment_status"] == "mocked"
  assert len(out["segments"]) == 2

  monkeypatch.setattr(aligner, "MFA_ENABLED", True)
  monkeypatch.setattr(aligner, "run_mfa_alignment", lambda *_a, **_k: {"ok": False, "reason": "bad"})
  out2 = aligner.align_expected_text("hello", session_id="s1", audio_path="a.wav")
  assert out2["alignment_status"] == "fallback_heuristic"
  assert out2["engine_meta"]["failure_reason"] == "bad"

  monkeypatch.setattr(
    aligner,
    "run_mfa_alignment",
    lambda *_a, **_k: {"ok": True, "textgrid_path": "/tmp/x.TextGrid", "prepared_audio_path": "/tmp/a.wav"},
  )
  monkeypatch.setattr(aligner, "parse_textgrid", lambda _p: {"words": [{"text": "hello"}], "phones": []})
  out3 = aligner.align_expected_text("hello", session_id="s1", audio_path="a.wav")
  assert out3["alignment_status"] == "mfa"


def test_practice_task_failure_and_tmp_cleanup(monkeypatch):
  session = {
    "session_id": "s1",
    "expected_text": "hello",
    "audio_path": "db://audio/asset",
    "score_status": "uploaded",
  }
  saved = []

  monkeypatch.setattr(practice_tasks, "load_session", lambda _sid: dict(session))
  monkeypatch.setattr(practice_tasks, "save_session", lambda sid, payload: saved.append((sid, dict(payload))))

  tmp_audio = Path("/tmp/practice-task-cleanup.wav")
  tmp_audio.write_bytes(b"x")
  monkeypatch.setattr(practice_tasks, "materialize_audio_path", lambda _p: str(tmp_audio))

  def _boom(**_k):
    raise RuntimeError("boom")

  monkeypatch.setattr(practice_tasks, "score_pronunciation", _boom)

  out = practice_tasks.run_practice_scoring.run("s1")
  assert out["status"] == "failed"
  assert any(p.get("score_status") == "failed" for _, p in saved)
  assert not tmp_audio.exists()


def test_config_production_guards(monkeypatch):
  module_name = "app.core.config"
  old = sys.modules.pop(module_name, None)
  try:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "*")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("METRICS_TOKEN", "token")
    monkeypatch.setenv("SSO_VERIFY_SIGNATURE", "false")
    try:
      importlib.import_module(module_name)
      assert False
    except RuntimeError as exc:
      assert "CORS_ALLOW_ORIGINS" in str(exc)

    sys.modules.pop(module_name, None)
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "https://a.com")
    monkeypatch.setenv("JWT_SECRET", "short")
    try:
      importlib.import_module(module_name)
      assert False
    except RuntimeError as exc:
      assert "JWT_SECRET" in str(exc)

    sys.modules.pop(module_name, None)
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("METRICS_TOKEN", "")
    try:
      importlib.import_module(module_name)
      assert False
    except RuntimeError as exc:
      assert "METRICS_TOKEN" in str(exc)
  finally:
    sys.modules.pop(module_name, None)
    if old is not None:
      sys.modules[module_name] = old
