from __future__ import annotations

from app.services import db as dbmod


class _Result:
  def __init__(self, rows):
    self._rows = rows

  def fetchall(self):
    return self._rows


class _Conn:
  def __init__(self, rows_by_table, fail_table=None):
    self.rows_by_table = rows_by_table
    self.fail_table = fail_table
    self.executed = []

  def execute(self, clause):
    q = str(clause)
    self.executed.append(q)
    if "PRAGMA table_info(practice_sessions)" in q:
      if self.fail_table == "practice_sessions":
        raise RuntimeError("boom")
      return _Result(self.rows_by_table.get("practice_sessions", []))
    if "PRAGMA table_info(users)" in q:
      if self.fail_table == "users":
        raise RuntimeError("boom")
      return _Result(self.rows_by_table.get("users", []))
    return _Result([])


class _BeginCtx:
  def __init__(self, conn):
    self.conn = conn

  def __enter__(self):
    return self.conn

  def __exit__(self, *args):
    return False


class _Engine:
  def __init__(self, conn):
    self._conn = conn

  def begin(self):
    return _BeginCtx(self._conn)


def test_ensure_runtime_schema_compat_adds_missing_columns(monkeypatch):
  conn = _Conn(
    {
      "practice_sessions": [(0, "session_id"), (1, "lesson_id")],
      "users": [(0, "id"), (1, "email")],
    }
  )
  monkeypatch.setattr(dbmod, "engine", _Engine(conn))

  dbmod._ensure_runtime_schema_compat()

  combined = "\n".join(conn.executed)
  assert "ALTER TABLE practice_sessions ADD COLUMN user_id" in combined
  assert "ALTER TABLE users ADD COLUMN email_verified" in combined
  assert "ALTER TABLE users ADD COLUMN email_verify_token" in combined
  assert "ALTER TABLE users ADD COLUMN email_verify_expires_at" in combined


def test_ensure_runtime_schema_compat_skips_when_columns_exist(monkeypatch):
  conn = _Conn(
    {
      "practice_sessions": [(0, "session_id"), (1, "user_id")],
      "users": [
        (0, "id"),
        (1, "email_verified"),
        (2, "email_verify_token"),
        (3, "email_verify_expires_at"),
      ],
    }
  )
  monkeypatch.setattr(dbmod, "engine", _Engine(conn))

  dbmod._ensure_runtime_schema_compat()

  combined = "\n".join(conn.executed)
  assert "ALTER TABLE practice_sessions ADD COLUMN user_id" not in combined
  assert "ALTER TABLE users ADD COLUMN email_verified" not in combined


def test_ensure_runtime_schema_compat_swallows_practice_sessions_errors(monkeypatch):
  conn = _Conn({"users": [(0, "id")]}, fail_table="practice_sessions")
  monkeypatch.setattr(dbmod, "engine", _Engine(conn))

  dbmod._ensure_runtime_schema_compat()

  combined = "\n".join(conn.executed)
  assert "PRAGMA table_info(practice_sessions)" in combined
  assert "PRAGMA table_info(users)" in combined


def test_ensure_runtime_schema_compat_swallows_users_errors(monkeypatch):
  conn = _Conn({"practice_sessions": [(0, "session_id")]}, fail_table="users")
  monkeypatch.setattr(dbmod, "engine", _Engine(conn))

  dbmod._ensure_runtime_schema_compat()

  combined = "\n".join(conn.executed)
  assert "PRAGMA table_info(users)" in combined


def test_init_db_creates_metadata_and_runs_runtime_compat(monkeypatch):
  calls = {"create_all": 0, "compat": 0}

  class Meta:
    def create_all(self, bind=None):
      calls["create_all"] += 1
      assert bind is dbmod.engine

  class Base:
    metadata = Meta()

  monkeypatch.setattr(dbmod, "Base", Base)
  monkeypatch.setattr(dbmod, "_ensure_runtime_schema_compat", lambda: calls.__setitem__("compat", calls["compat"] + 1))

  dbmod.init_db()
  assert calls["create_all"] == 1
  assert calls["compat"] == 1
