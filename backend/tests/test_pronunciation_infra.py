from __future__ import annotations

from pathlib import Path

from app.services.pronunciation.audio_prep import prepare_audio_for_alignment
from app.services.pronunciation.mfa_runner import run_mfa_alignment
from app.tasks.practice_tasks import run_practice_scoring


def test_prepare_audio_missing_and_not_found(tmp_path: Path):
    out = tmp_path / "out"
    p, info = prepare_audio_for_alignment(None, out)
    assert p is None
    assert info["reason"] == "missing_audio"

    p, info = prepare_audio_for_alignment(str(tmp_path / "none.m4a"), out)
    assert p is None
    assert info["reason"] == "audio_not_found"


def test_prepare_audio_copies_when_no_ffmpeg(monkeypatch, tmp_path: Path):
    src = tmp_path / "a.m4a"
    src.write_bytes(b"abc")
    out = tmp_path / "out"

    monkeypatch.setattr("app.services.pronunciation.audio_prep.FFMPEG_BINARY", None)
    monkeypatch.setattr("app.services.pronunciation.audio_prep.shutil.which", lambda *_: None)

    prepared, info = prepare_audio_for_alignment(str(src), out)
    assert prepared is not None
    assert Path(prepared).exists()
    assert info["reason"] == "copied_without_ffmpeg"


def test_run_mfa_alignment_early_returns(monkeypatch):
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_BINARY", None)
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.shutil.which", lambda *_: None)
    res = run_mfa_alignment("s1", "hello", "/tmp/a.wav")
    assert res["reason"] == "mfa_binary_missing"


def test_run_mfa_alignment_config_missing(monkeypatch, tmp_path: Path):
    fake_bin = tmp_path / "mfa"
    fake_bin.write_text("", encoding="utf-8")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_BINARY", str(fake_bin))
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_MODEL_PATH", "")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_DICTIONARY_PATH", "")
    res = run_mfa_alignment("s1", "hello", "/tmp/a.wav")
    assert res["reason"] == "mfa_config_missing"


def test_run_mfa_alignment_audio_missing(monkeypatch, tmp_path: Path):
    fake_bin = tmp_path / "mfa"
    fake_bin.write_text("", encoding="utf-8")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_BINARY", str(fake_bin))
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_MODEL_PATH", "model")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_DICTIONARY_PATH", "dict")
    res = run_mfa_alignment("s1", "hello", None)
    assert res["reason"] == "audio_missing"


def test_run_mfa_alignment_audio_prep_failed(monkeypatch, tmp_path: Path):
    fake_bin = tmp_path / "mfa"
    fake_bin.write_text("", encoding="utf-8")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_BINARY", str(fake_bin))
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_MODEL_PATH", "model")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_DICTIONARY_PATH", "dict")
    monkeypatch.setattr(
        "app.services.pronunciation.mfa_runner.prepare_audio_for_alignment",
        lambda *_args, **_kwargs: (None, {"reason": "prep_failed"}),
    )

    res = run_mfa_alignment("s1", "hello", "/tmp/a.wav")
    assert res["reason"] == "prep_failed"


def test_run_mfa_alignment_success_and_failed_paths(monkeypatch, tmp_path: Path):
    fake_bin = tmp_path / "mfa"
    fake_bin.write_text("", encoding="utf-8")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_BINARY", str(fake_bin))
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_MODEL_PATH", "model")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_DICTIONARY_PATH", "dict")
    monkeypatch.setattr("app.services.pronunciation.mfa_runner.MFA_WORK_DIR", tmp_path / "work")

    prepared = tmp_path / "prepared.wav"
    prepared.write_bytes(b"wav")
    monkeypatch.setattr(
        "app.services.pronunciation.mfa_runner.prepare_audio_for_alignment",
        lambda *_args, **_kwargs: (str(prepared), {"reason": "ok"}),
    )

    class Completed:
        def __init__(self, returncode: int):
            self.returncode = returncode
            self.stdout = "out"
            self.stderr = "err"

    def _run_ok(command, capture_output, text, env):
        assert command[1] == "align"
        out_dir = Path(command[5])
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "prepared.TextGrid").write_text("grid", encoding="utf-8")
        return Completed(0)

    monkeypatch.setattr("app.services.pronunciation.mfa_runner.subprocess.run", _run_ok)
    ok_res = run_mfa_alignment("s_ok", "hello world", "/tmp/a.wav")
    assert ok_res["ok"] is True
    assert ok_res["reason"] == "ok"

    monkeypatch.setattr(
        "app.services.pronunciation.mfa_runner.subprocess.run",
        lambda *_args, **_kwargs: Completed(1),
    )
    fail_res = run_mfa_alignment("s_fail", "hello world", "/tmp/a.wav")
    assert fail_res["ok"] is False
    assert fail_res["reason"] == "mfa_failed"


def test_run_practice_scoring_session_not_found(monkeypatch):
    monkeypatch.setattr("app.tasks.practice_tasks.load_session", lambda _sid: None)
    result = run_practice_scoring.run("missing")
    assert result["status"] == "failed"
    assert result["error"] == "Session not found"


def test_run_practice_scoring_success(monkeypatch, tmp_path: Path):
    state = {
        "session_id": "s1",
        "expected_text": "hello world",
        "audio_path": str(tmp_path / "audio.m4a"),
        "score_status": "uploaded",
    }
    (tmp_path / "audio.m4a").write_bytes(b"x")
    saved = []

    monkeypatch.setattr("app.tasks.practice_tasks.load_session", lambda _sid: dict(state))
    monkeypatch.setattr("app.tasks.practice_tasks.save_session", lambda sid, payload: saved.append((sid, dict(payload))))
    monkeypatch.setattr("app.tasks.practice_tasks.materialize_audio_path", lambda p: p)
    monkeypatch.setattr(
        "app.tasks.practice_tasks.score_pronunciation",
        lambda **_kwargs: {"session_id": "s1", "words": [{"text": "hello", "status": "good"}]},
    )
    monkeypatch.setattr("app.tasks.practice_tasks.generate_tips", lambda _res: ["tip"])

    result = run_practice_scoring.run("s1")
    assert result == {"status": "done"}
    assert any(payload.get("score_status") == "done" for _, payload in saved)


def test_run_practice_scoring_failure_path(monkeypatch):
    state = {
        "session_id": "s2",
        "expected_text": "hello",
        "audio_path": "/tmp/a.m4a",
        "score_status": "uploaded",
    }
    saved = []


    monkeypatch.setattr("app.tasks.practice_tasks.load_session", lambda _sid: dict(state))
    monkeypatch.setattr("app.tasks.practice_tasks.save_session", lambda sid, payload: saved.append((sid, dict(payload))))
    monkeypatch.setattr("app.tasks.practice_tasks.materialize_audio_path", lambda p: p)

    def _boom(**_kwargs):
        raise ValueError("boom")

    monkeypatch.setattr("app.tasks.practice_tasks.score_pronunciation", _boom)

    result = run_practice_scoring.run("s2")
    assert result["status"] == "failed"
    assert "boom" in result["error"]
    assert any(payload.get("score_status") == "failed" for _, payload in saved)
