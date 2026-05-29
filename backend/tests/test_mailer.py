import pytest

import app.services.mailer as mailer


def test_send_verification_email_requires_host(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(mailer, "SMTP_HOST", "")

  with pytest.raises(RuntimeError):
    mailer.send_verification_email("a@example.com", "token")

