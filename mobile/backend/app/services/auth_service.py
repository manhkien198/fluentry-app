from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
from uuid import uuid4

import jwt
from passlib.context import CryptContext

from app.core.config import JWT_ALG, JWT_EXPIRES_MINUTES, JWT_SECRET
from app.services.db import RefreshTokenRecord, SessionLocal, UserRecord, init_db

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
init_db()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: str, email: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_refresh_token(user_id: str) -> str:
    raw = f"rt-{uuid4()}-{uuid4()}"
    token_hash = _hash_token(raw)
    expires_at = datetime.now(timezone.utc) + timedelta(days=14)
    with SessionLocal() as db:
        row = RefreshTokenRecord(
            id=f"refresh-{uuid4()}",
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked_at=None,
        )
        db.add(row)
        db.commit()
    return raw


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


def create_user(email: str, password: str, display_name: str) -> UserRecord:
    with SessionLocal() as db:
        existing = db.query(UserRecord).filter(UserRecord.email == email).first()
        if existing:
            raise ValueError("Email already exists")
        user = UserRecord(
            id=f"user-{uuid4()}",
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            email_verified="false",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def authenticate_user(email: str, password: str) -> UserRecord | None:
    with SessionLocal() as db:
        user = db.query(UserRecord).filter(UserRecord.email == email).first()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user


def get_user_by_id(user_id: str) -> UserRecord | None:
    with SessionLocal() as db:
        return db.get(UserRecord, user_id)


def get_user_by_email(email: str) -> UserRecord | None:
    with SessionLocal() as db:
        return db.query(UserRecord).filter(UserRecord.email == email).first()


def get_or_create_sso_user(email: str, display_name: str) -> UserRecord:
    existing = get_user_by_email(email)
    if existing:
        return existing
    random_password = f"sso-{uuid4()}-{uuid4()}"
    user = create_user(email=email, password=random_password, display_name=display_name or "Learner")
    with SessionLocal() as db:
        row = db.get(UserRecord, user.id)
        if row:
            row.email_verified = "true"
            db.commit()
            db.refresh(row)
            return row
    return user


def create_email_verification_token(email: str) -> str | None:
    with SessionLocal() as db:
        user = db.query(UserRecord).filter(UserRecord.email == email).first()
        if not user:
            return None
        token = f"ev-{uuid4()}-{uuid4()}"
        user.email_verify_token = hashlib.sha256(token.encode("utf-8")).hexdigest()
        user.email_verify_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        db.commit()
        return token


def verify_email_token(token: str) -> UserRecord | None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        user = db.query(UserRecord).filter(UserRecord.email_verify_token == token_hash).first()
        if not user:
            return None
        expires = user.email_verify_expires_at
        if expires is not None and expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires is not None and expires < now:
            return None
        user.email_verified = "true"
        user.email_verify_token = None
        user.email_verify_expires_at = None
        db.commit()
        db.refresh(user)
        return user


def rotate_refresh_token(refresh_token: str) -> dict | None:
    token_hash = _hash_token(refresh_token)
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        row = db.query(RefreshTokenRecord).filter(RefreshTokenRecord.token_hash == token_hash).first()
        expires_at = row.expires_at if row else None
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if row is None or row.revoked_at is not None or (expires_at is not None and expires_at < now):
            return None
        user = db.get(UserRecord, row.user_id)
        if user is None:
            return None
        row.revoked_at = now
        db.commit()
        return {"id": user.id, "email": user.email, "display_name": user.display_name}


def revoke_refresh_token(refresh_token: str) -> None:
    token_hash = _hash_token(refresh_token)
    with SessionLocal() as db:
        row = db.query(RefreshTokenRecord).filter(RefreshTokenRecord.token_hash == token_hash).first()
        if row and row.revoked_at is None:
            row.revoked_at = datetime.now(timezone.utc)
            db.commit()
