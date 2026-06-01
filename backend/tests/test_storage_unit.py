from app.services import storage


def test_materialize_audio_path_passthrough_none_and_non_db():
  assert storage.materialize_audio_path(None) is None
  assert storage.materialize_audio_path("/tmp/a.m4a") == "/tmp/a.m4a"


def test_save_upload_persists_asset_and_returns_db_url(monkeypatch):
  class DB:
    def __init__(self):
      self.added = []
      self.committed = False

    def add(self, obj):
      self.added.append(obj)

    def commit(self):
      self.committed = True

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  db = DB()
  monkeypatch.setattr(storage, "SessionLocal", lambda: db)
  monkeypatch.setattr(storage, "uuid4", lambda: "xyz")

  out = storage.save_upload("s1", "voice.m4a", b"abc")
  assert out == "db://audio/asset-xyz"
  assert db.committed is True
  assert len(db.added) == 1
  assert db.added[0].content_type == "audio/m4a"


def test_save_upload_non_m4a_uses_octet_stream(monkeypatch):
  class DB:
    def __init__(self):
      self.added = []

    def add(self, obj):
      self.added.append(obj)

    def commit(self):
      pass

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  db = DB()
  monkeypatch.setattr(storage, "SessionLocal", lambda: db)
  monkeypatch.setattr(storage, "uuid4", lambda: "abc")

  storage.save_upload("s1", "voice.wav", b"abc")
  assert db.added[0].content_type == "application/octet-stream"


def test_materialize_audio_path_missing_asset_returns_none(monkeypatch):
  class DB:
    def get(self, _model, _id):
      return None

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  monkeypatch.setattr(storage, "SessionLocal", lambda: DB())
  assert storage.materialize_audio_path("db://audio/missing") is None


def test_materialize_audio_path_writes_payload_with_filename_suffix(monkeypatch):
  class Row:
    filename = "clip.m4a"
    payload = b"audio-bytes"

  class DB:
    def get(self, _model, _id):
      return Row()

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  class Tmp:
    def __init__(self):
      self.name = "/tmp/generated.m4a"
      self.written = None

    def write(self, data):
      self.written = data

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  tmp = Tmp()

  def _temp(delete=False, suffix=""):
    assert delete is False
    assert suffix == ".m4a"
    return tmp

  monkeypatch.setattr(storage, "SessionLocal", lambda: DB())
  monkeypatch.setattr(storage, "NamedTemporaryFile", _temp)

  out = storage.materialize_audio_path("db://audio/asset-1")
  assert out == "/tmp/generated.m4a"
  assert tmp.written == b"audio-bytes"


def test_materialize_audio_path_uses_bin_suffix_when_filename_has_no_extension(monkeypatch):
  class Row:
    filename = "clip"
    payload = b"x"

  class DB:
    def get(self, _model, _id):
      return Row()

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  class Tmp:
    name = "/tmp/generated.bin"

    def write(self, _data):
      pass

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  def _temp(delete=False, suffix=""):
    assert suffix == ".bin"
    return Tmp()

  monkeypatch.setattr(storage, "SessionLocal", lambda: DB())
  monkeypatch.setattr(storage, "NamedTemporaryFile", _temp)

  out = storage.materialize_audio_path("db://audio/asset-1")
  assert out == "/tmp/generated.bin"

