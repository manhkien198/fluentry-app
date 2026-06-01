import types

import app.services.drill_store as drill_store


class _FakeQuery:
  def __init__(self, rows, count=1):
    self._rows = rows
    self._count = count

  def count(self):
    return self._count

  def filter(self, _expr):
    return self

  def limit(self, _limit: int):
    return self

  def all(self):
    return self._rows


class _FakeDB:
  def __init__(self, rows, count=1):
    self._rows = rows
    self._count = count
    self.added = []
    self.committed = False

  def query(self, _model):
    return _FakeQuery(self._rows, count=self._count)

  def add(self, obj):
    self.added.append(obj)

  def commit(self):
    self.committed = True

  def __enter__(self):
    return self

  def __exit__(self, exc_type, exc, tb):
    return False


def test_ensure_default_drills_respects_seed_flag(monkeypatch):
  monkeypatch.setattr(drill_store, "SEED_CONTENT_ENABLED", False)
  called = {"load": 0}
  monkeypatch.setattr(drill_store, "load_seed_content", lambda: ([], []))

  def fake_session_local():
    called["load"] += 1
    return _FakeDB([])

  monkeypatch.setattr(drill_store, "SessionLocal", fake_session_local)
  drill_store.ensure_default_drills()
  assert called["load"] == 0


def test_list_drills_returns_items(monkeypatch):
  monkeypatch.setattr(drill_store, "ensure_default_drills", lambda: None)

  row = types.SimpleNamespace(
    id="1",
    sound="TH",
    mode="repeat",
    title="t",
    prompt="p",
    lesson_id="L1",
  )

  monkeypatch.setattr(drill_store, "SessionLocal", lambda: _FakeDB([row]))
  items = drill_store.list_drills(sound=" th ", mode=" REPEAT ", limit=10)
  assert len(items) == 1
  assert items[0].sound == "TH"
  assert items[0].mode == "repeat"


def test_ensure_default_drills_seeds_when_empty(monkeypatch):
  monkeypatch.setattr(drill_store, "SEED_CONTENT_ENABLED", True)

  seed_drill = types.SimpleNamespace(
    model_dump=lambda: {
      "id": "d1",
      "sound": "TH",
      "mode": "repeat",
      "title": "Title",
      "prompt": "Prompt",
      "lesson_id": "L1",
    }
  )
  monkeypatch.setattr(drill_store, "load_seed_content", lambda: ([], [seed_drill]))

  fake_db = _FakeDB([], count=0)
  monkeypatch.setattr(drill_store, "SessionLocal", lambda: fake_db)

  drill_store.ensure_default_drills()
  assert len(fake_db.added) == 1
  assert fake_db.committed is True


def test_ensure_default_drills_skips_when_existing(monkeypatch):
  monkeypatch.setattr(drill_store, "SEED_CONTENT_ENABLED", True)
  monkeypatch.setattr(drill_store, "load_seed_content", lambda: ([], []))

  fake_db = _FakeDB([], count=2)
  monkeypatch.setattr(drill_store, "SessionLocal", lambda: fake_db)

  drill_store.ensure_default_drills()
  assert fake_db.added == []
  assert fake_db.committed is False

