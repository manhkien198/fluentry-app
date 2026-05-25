from __future__ import annotations

from collections import deque
from time import time

_BUCKETS: dict[str, deque[float]] = {}


def allow_request(key: str, limit: int, window_seconds: int) -> bool:
    now = time()
    bucket = _BUCKETS.setdefault(key, deque())
    while bucket and now - bucket[0] > window_seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    return True

