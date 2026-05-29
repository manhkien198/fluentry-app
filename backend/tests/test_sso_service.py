import pytest

import app.services.sso_service as sso


def test_decode_sso_claims_google_non_jwt_uses_tokeninfo(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(
    sso,
    "_google_tokeninfo_fallback",
    lambda token: {"email": "a@example.com", "name": "A"},
  )

  claims = sso.decode_sso_claims("google", "not-a-jwt")
  assert claims["email"] == "a@example.com"


def test_decode_sso_claims_non_google_non_jwt_raises():
  with pytest.raises(ValueError):
    sso.decode_sso_claims("apple", "not-a-jwt")


def test_decode_sso_claims_without_signature_verification(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(sso, "SSO_VERIFY_SIGNATURE", False)
  monkeypatch.setattr(
    sso.jwt,
    "decode",
    lambda token, options=None: {"email": "b@example.com", "iss": "x"},
  )

  claims = sso.decode_sso_claims("google", "a.b.c")
  assert claims["email"] == "b@example.com"


def test_decode_sso_claims_unknown_provider_raises(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(sso, "SSO_VERIFY_SIGNATURE", True)
  with pytest.raises(ValueError):
    sso.decode_sso_claims("github", "a.b.c")

