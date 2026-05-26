from __future__ import annotations

import jwt
import logging
from jwt import PyJWKClient
import json
import urllib.parse
import urllib.request

from app.core.config import (
    SSO_APPLE_AUDIENCE,
    SSO_APPLE_ISSUER,
    SSO_GOOGLE_AUDIENCE,
    SSO_GOOGLE_ISSUER,
    SSO_VERIFY_SIGNATURE,
)

logger = logging.getLogger("fluentry.sso")


def decode_sso_claims(provider: str, id_token: str) -> dict:
    provider_name = provider.strip().lower()
    if id_token.count(".") != 2:
        if provider_name == "google":
            logger.info("SSO decode using google tokeninfo fallback (non-JWT token)")
            return _google_tokeninfo_fallback(id_token)
        raise ValueError("Invalid JWT token format")
    if not SSO_VERIFY_SIGNATURE:
        return jwt.decode(id_token, options={"verify_signature": False, "verify_exp": False})

    if provider_name == "google":
        if not SSO_GOOGLE_AUDIENCE:
            raise ValueError("Missing SSO_GOOGLE_AUDIENCE for signature verification")
        jwks_client = PyJWKClient("https://www.googleapis.com/oauth2/v3/certs")
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        return jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=SSO_GOOGLE_AUDIENCE,
            issuer=SSO_GOOGLE_ISSUER,
        )

    if provider_name == "apple":
        if not SSO_APPLE_AUDIENCE:
            raise ValueError("Missing SSO_APPLE_AUDIENCE for signature verification")
        jwks_client = PyJWKClient("https://appleid.apple.com/auth/keys")
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        return jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=SSO_APPLE_AUDIENCE,
            issuer=SSO_APPLE_ISSUER,
        )

    raise ValueError(f"Provider not configured for signature verification: {provider_name}")


def _google_tokeninfo_fallback(access_token: str) -> dict:
    query = urllib.parse.urlencode({"access_token": access_token})
    url = f"https://oauth2.googleapis.com/tokeninfo?{query}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Google tokeninfo request failed: {exc}")
    logger.info("Google tokeninfo payload keys=%s", ",".join(sorted(payload.keys())))

    email = payload.get("email")
    aud = payload.get("aud")
    if not isinstance(email, str) or not email:
        raise ValueError("Google tokeninfo missing email")
    if SSO_GOOGLE_AUDIENCE and aud != SSO_GOOGLE_AUDIENCE:
        raise ValueError("Google tokeninfo audience mismatch")

    return {
        "email": email,
        "name": payload.get("name") or "Learner",
        "aud": aud,
        "iss": payload.get("iss") or "https://accounts.google.com",
    }
