from __future__ import annotations

from threading import Lock

_COUNTERS: dict[str, int] = {}
_LOCK = Lock()


def inc(metric: str, value: int = 1) -> None:
    with _LOCK:
        _COUNTERS[metric] = _COUNTERS.get(metric, 0) + value


def snapshot() -> dict[str, int]:
    with _LOCK:
        return dict(_COUNTERS)


def reset() -> None:
    with _LOCK:
        _COUNTERS.clear()
