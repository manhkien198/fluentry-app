import pytest
import io
import json

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
    sso.decode_sso_claims("github", "not-a-jwt")


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


def test_google_tokeninfo_fallback_success(monkeypatch: pytest.MonkeyPatch):
  class _Resp:
    def __enter__(self):
      payload = {"email": "g@example.com", "aud": sso.SSO_GOOGLE_AUDIENCE}
      self._b = json.dumps(payload).encode("utf-8")
      return self

    def __exit__(self, exc_type, exc, tb):
      return False

    def read(self):
      return self._b

  monkeypatch.setattr(sso.urllib.request, "urlopen", lambda *_args, **_kwargs: _Resp())
  claims = sso._google_tokeninfo_fallback("token")
  assert claims["email"] == "g@example.com"


def test_google_tokeninfo_fallback_missing_email_raises(monkeypatch: pytest.MonkeyPatch):
  class _Resp:
    def __enter__(self):
      self._b = json.dumps({"aud": sso.SSO_GOOGLE_AUDIENCE}).encode("utf-8")
      return self

    def __exit__(self, exc_type, exc, tb):
      return False

    def read(self):
      return self._b

  monkeypatch.setattr(sso.urllib.request, "urlopen", lambda *_args, **_kwargs: _Resp())
  with pytest.raises(ValueError):
    sso._google_tokeninfo_fallback("token")


def test_google_tokeninfo_fallback_audience_mismatch_raises(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(sso, "SSO_GOOGLE_AUDIENCE", "expected-aud")

  class _Resp:
    def __enter__(self):
      self._b = json.dumps({"email": "x@example.com", "aud": "wrong"}).encode("utf-8")
      return self

    def __exit__(self, exc_type, exc, tb):
      return False

    def read(self):
      return self._b

  monkeypatch.setattr(sso.urllib.request, "urlopen", lambda *_args, **_kwargs: _Resp())
  with pytest.raises(ValueError):
    sso._google_tokeninfo_fallback("token")


def test_google_tokeninfo_fallback_http_error_raises(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(
    sso.urllib.request,
    "urlopen",
    lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
  )
  with pytest.raises(ValueError):
    sso._google_tokeninfo_fallback("token")


def test_decode_sso_claims_signature_verify_google(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(sso, "SSO_VERIFY_SIGNATURE", True)
  monkeypatch.setattr(sso, "SSO_GOOGLE_AUDIENCE", "google-aud")

  class _Jwk:
    key = "k"

  class _JwkClient:
    def __init__(self, *_args, **_kwargs):
      pass

    def get_signing_key_from_jwt(self, _token):
      return _Jwk()

  monkeypatch.setattr(sso, "PyJWKClient", _JwkClient)

  def _decode(token, key, algorithms, audience, issuer):
    return {"token": token, "aud": audience, "iss": issuer}

  monkeypatch.setattr(sso.jwt, "decode", _decode)

  g = sso.decode_sso_claims("google", "a.b.c")
  assert g["aud"] == "google-aud"


def test_decode_sso_claims_signature_verify_missing_audience(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(sso, "SSO_VERIFY_SIGNATURE", True)
  monkeypatch.setattr(sso, "SSO_GOOGLE_AUDIENCE", "")
  with pytest.raises(ValueError):
    sso.decode_sso_claims("google", "a.b.c")
