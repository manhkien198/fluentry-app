from __future__ import annotations

import os

from celery import Celery


def make_celery() -> Celery:
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
    backend_url = os.getenv("CELERY_RESULT_BACKEND", broker_url)

    celery_app = Celery(
        "speakup",
        broker=broker_url,
        backend=backend_url,
        include=["app.tasks.practice_tasks"],
    )
    celery_app.conf.update(
        task_track_started=True,
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
    )
    return celery_app


celery_app = make_celery()
