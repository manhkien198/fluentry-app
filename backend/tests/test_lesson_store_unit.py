from __future__ import annotations

import types

import app.services.lesson_store as lesson_store


class _FakeOrderQuery:
  def __init__(self, rows, count=1):
    self._rows = rows
    self._count = count

  def count(self):
    return self._count

  def order_by(self, _expr):
    return self

  def all(self):
    return self._rows


class _FakeDB:
  def __init__(self, rows, count=1, row_by_id=None):
    self._rows = rows
    self._count = count
    self._row_by_id = row_by_id or {}
    self.added = []
    self.committed = False

  def query(self, _model):
    return _FakeOrderQuery(self._rows, count=self._count)

  def get(self, _model, key):
    return self._row_by_id.get(key)

  def add(self, obj):
    self.added.append(obj)

  def commit(self):
    self.committed = True

  def __enter__(self):
    return self

  def __exit__(self, exc_type, exc, tb):
    return False


def test_ensure_default_lessons_respects_seed_flag(monkeypatch):
  monkeypatch.setattr(lesson_store, "SEED_CONTENT_ENABLED", False)
  called = {"load": 0}
  monkeypatch.setattr(lesson_store, "load_seed_content", lambda: ([], []))

  def _session():
    called["load"] += 1
    return _FakeDB([])

  monkeypatch.setattr(lesson_store, "SessionLocal", _session)
  lesson_store.ensure_default_lessons()
  assert called["load"] == 0


def test_ensure_default_lessons_seeds_when_empty(monkeypatch):
  monkeypatch.setattr(lesson_store, "SEED_CONTENT_ENABLED", True)

  l = types.SimpleNamespace(
    id="l1",
    title="Intro",
    level="A1",
    duration_minutes=10,
    xp=20,
    prompt="hello",
  )
  monkeypatch.setattr(lesson_store, "load_seed_content", lambda: ([l], []))

  fake_db = _FakeDB([], count=0)
  monkeypatch.setattr(lesson_store, "SessionLocal", lambda: fake_db)

  lesson_store.ensure_default_lessons()
  assert len(fake_db.added) == 1
  assert fake_db.committed is True


def test_list_lessons_and_get_lesson(monkeypatch):
  monkeypatch.setattr(lesson_store, "ensure_default_lessons", lambda: None)
  monkeypatch.setattr(
    lesson_store,
    "compute_lesson_rubric",
    lambda level, prompt: {
      "cefr": level,
      "complexity_score": 10,
      "phoneme_coverage": 60,
      "fluency_demand": 40,
    },
  )

  row = types.SimpleNamespace(
    id="l1",
    title="Intro",
    level="A1",
    duration_minutes=10,
    xp=20,
    prompt="hello",
  )

  fake_db = _FakeDB([row], row_by_id={"l1": row})
  monkeypatch.setattr(lesson_store, "SessionLocal", lambda: fake_db)

  lessons = lesson_store.list_lessons()
  assert len(lessons) == 1
  assert lessons[0].id == "l1"
  assert lessons[0].rubric.cefr == "A1"

  lesson = lesson_store.get_lesson("l1")
  assert lesson is not None
  assert lesson.id == "l1"

  assert lesson_store.get_lesson("missing") is None
