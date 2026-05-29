from app.services.storage import materialize_audio_path


def test_materialize_audio_path_passthrough_none_and_non_db():
  assert materialize_audio_path(None) is None
  assert materialize_audio_path("/tmp/a.m4a") == "/tmp/a.m4a"

