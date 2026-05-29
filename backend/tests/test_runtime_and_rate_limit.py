from app.services import rate_limit, runtime_metrics


def test_runtime_metrics_inc_snapshot_reset():
  runtime_metrics.reset()
  runtime_metrics.inc("a")
  runtime_metrics.inc("a", 2)
  runtime_metrics.inc("b", 3)
  snap = runtime_metrics.snapshot()
  assert snap["a"] == 3
  assert snap["b"] == 3
  runtime_metrics.reset()
  assert runtime_metrics.snapshot() == {}


def test_rate_limit_window_behavior():
  rate_limit._BUCKETS.clear()
  key = "u:1"
  assert rate_limit.allow_request(key, limit=2, window_seconds=60) is True
  assert rate_limit.allow_request(key, limit=2, window_seconds=60) is True
  assert rate_limit.allow_request(key, limit=2, window_seconds=60) is False


def test_rate_limit_expires_old_entries(monkeypatch):
  rate_limit._BUCKETS.clear()
  timeline = iter([100.0, 101.0, 500.0])
  monkeypatch.setattr(rate_limit, "time", lambda: next(timeline))
  key = "u:2"
  assert rate_limit.allow_request(key, limit=1, window_seconds=60) is True
  assert rate_limit.allow_request(key, limit=1, window_seconds=60) is False
  assert rate_limit.allow_request(key, limit=1, window_seconds=60) is True
