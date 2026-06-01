from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.services import auth_service as svc


def test_verify_email_token_expired_returns_none(monkeypatch):
    class User:
        email_verify_token = "h"
        email_verify_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)

    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return User()

    class DB:
        def query(self, _m):
            return Q()

        def commit(self):
            pass

        def refresh(self, _u):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(svc, "SessionLocal", lambda: DB())
    monkeypatch.setattr(svc.hashlib, "sha256", lambda *_: type("H", (), {"hexdigest": lambda self: "h"})())
    assert svc.verify_email_token("t") is None


def test_rotate_refresh_token_missing_user_returns_none(monkeypatch):
    now = datetime.now(timezone.utc)

    class Row:
        expires_at = now + timedelta(days=1)
        revoked_at = None
        user_id = "u1"

    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return Row()

    class DB:
        def query(self, _m):
            return Q()

        def get(self, _m, _id):
            return None

        def commit(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(svc, "SessionLocal", lambda: DB())
    monkeypatch.setattr(svc, "_hash_token", lambda _t: "hash")
    assert svc.rotate_refresh_token("rt") is None


def test_revoke_refresh_token_noop_when_already_revoked(monkeypatch):
    class Row:
        revoked_at = datetime.now(timezone.utc)

    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return Row()

    class DB:
        committed = False

        def query(self, _m):
            return Q()

        def commit(self):
            self.committed = True

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    db = DB()
    monkeypatch.setattr(svc, "SessionLocal", lambda: db)
    monkeypatch.setattr(svc, "_hash_token", lambda _t: "hash")
    svc.revoke_refresh_token("rt")
    assert db.committed is False


def test_authenticate_user_success_returns_user(monkeypatch):
    class User:
        password_hash = "h"

    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return User()

    class DB:
        def query(self, _m):
            return Q()

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(svc, "SessionLocal", lambda: DB())
    monkeypatch.setattr(svc, "verify_password", lambda _p, _h: True)
    assert svc.authenticate_user("a@example.com", "secret") is not None


def test_get_or_create_sso_user_returns_new_user_when_db_get_misses(monkeypatch):
    class User:
        id = "u1"
        email = "a@example.com"
        display_name = "Learner"

    class DB:
        def get(self, _m, _id):
            return None

        def commit(self):
            pass

        def refresh(self, _row):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(svc, "get_user_by_email", lambda _e: None)
    monkeypatch.setattr(svc, "create_user", lambda **_k: User())
    monkeypatch.setattr(svc, "SessionLocal", lambda: DB())
    out = svc.get_or_create_sso_user("a@example.com", "")
    assert out.id == "u1"


def test_get_or_create_sso_user_marks_verified_when_row_exists(monkeypatch):
    class User:
        id = "u1"
        email = "a@example.com"
        display_name = "Old"
        email_verified = "false"

    class DB:
        committed = False

        def get(self, _m, _id):
            return User()

        def commit(self):
            self.committed = True

        def refresh(self, _row):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    db = DB()
    monkeypatch.setattr(svc, "get_user_by_email", lambda _e: None)
    monkeypatch.setattr(svc, "create_user", lambda **_k: User())
    monkeypatch.setattr(svc, "SessionLocal", lambda: db)
    out = svc.get_or_create_sso_user("a@example.com", "")
    assert out.email_verified == "true"
    assert db.committed is True


def test_get_or_create_sso_user_returns_existing(monkeypatch):
    class User:
        id = "u1"

    monkeypatch.setattr(svc, "get_user_by_email", lambda _e: User())
    out = svc.get_or_create_sso_user("a@example.com", "Name")
    assert out.id == "u1"


def test_create_user_existing_email_raises(monkeypatch):
    class Existing:
        pass

    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return Existing()

    class DB:
        def query(self, _m):
            return Q()

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(svc, "SessionLocal", lambda: DB())
    try:
        svc.create_user("a@example.com", "p", "n")
        assert False
    except ValueError as exc:
        assert "Email already exists" in str(exc)


def test_create_user_success(monkeypatch):
    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return None

    class DB:
        def __init__(self):
            self.added = []

        def query(self, _m):
            return Q()

        def add(self, obj):
            self.added.append(obj)

        def commit(self):
            pass

        def refresh(self, _u):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    db = DB()
    monkeypatch.setattr(svc, "SessionLocal", lambda: db)
    monkeypatch.setattr(svc, "hash_password", lambda _p: "h")
    monkeypatch.setattr(svc, "uuid4", lambda: "x")
    out = svc.create_user("a@example.com", "p", "n")
    assert out.email == "a@example.com"
    assert len(db.added) == 1


def test_create_refresh_token_persists(monkeypatch):
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
    seq = iter(["a", "b", "c"])
    monkeypatch.setattr(svc, "SessionLocal", lambda: db)
    monkeypatch.setattr(svc, "uuid4", lambda: next(seq))
    monkeypatch.setattr(svc, "_hash_token", lambda _t: "hashed")
    token = svc.create_refresh_token("u1")
    assert token.startswith("rt-")
    assert len(db.added) == 1


def test_create_email_verification_token_user_missing_returns_none(monkeypatch):
    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return None

    class DB:
        def query(self, _m):
            return Q()

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(svc, "SessionLocal", lambda: DB())
    assert svc.create_email_verification_token("none@example.com") is None


def test_create_email_verification_token_success(monkeypatch):
    class User:
        email_verify_token = None
        email_verify_expires_at = None

    class Q:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return User()

    class DB:
        committed = False

        def query(self, _m):
            return Q()

        def commit(self):
            self.committed = True

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    db = DB()
    vals = iter(["a", "b"])
    monkeypatch.setattr(svc, "SessionLocal", lambda: db)
    monkeypatch.setattr(svc, "uuid4", lambda: next(vals))
    token = svc.create_email_verification_token("a@example.com")
    assert token.startswith("ev-")
    assert db.committed is True
