from __future__ import annotations

import json
from pathlib import Path

from app.services import session_store as ss


def test_load_session_legacy_file_not_found(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(ss, "SESSION_DIR", tmp_path)
    assert ss._load_session_legacy_file("missing") is None


def test_load_session_legacy_file_invalid_json(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(ss, "SESSION_DIR", tmp_path)
    path = tmp_path / "s1.json"
    path.write_text("{bad json", encoding="utf-8")
    assert ss._load_session_legacy_file("s1") is None


def test_load_session_legacy_file_saves_and_returns(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(ss, "SESSION_DIR", tmp_path)
    payload = {
        "session_id": "s2",
        "lesson_id": "l1",
        "expected_text": "hello",
        "user_id": "u1",
    }
    (tmp_path / "s2.json").write_text(json.dumps(payload), encoding="utf-8")

    saved = []
    monkeypatch.setattr(ss, "save_session", lambda sid, data: saved.append((sid, data)))
    out = ss._load_session_legacy_file("s2")
    assert out == payload
    assert saved and saved[0][0] == "s2"


def test_migrate_legacy_sessions_counts_valid_only(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(ss, "SESSION_DIR", tmp_path)

    valid = {
        "session_id": "session-1",
        "lesson_id": "l1",
        "expected_text": "hello",
        "user_id": "u1",
    }
    (tmp_path / "session-1.json").write_text(json.dumps(valid), encoding="utf-8")
    (tmp_path / "session-2.json").write_text("{bad", encoding="utf-8")
    (tmp_path / "session-3.json").write_text(json.dumps({"x": 1}), encoding="utf-8")

    saved = []
    monkeypatch.setattr(ss, "save_session", lambda sid, data: saved.append((sid, data)))

    migrated = ss.migrate_legacy_sessions()
    assert migrated == 1
    assert saved and saved[0][0] == "session-1"
