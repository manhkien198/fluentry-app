import pytest

import app.services.mailer as mailer


def test_send_verification_email_requires_host(monkeypatch: pytest.MonkeyPatch):
  monkeypatch.setattr(mailer, "SMTP_HOST", "")

  with pytest.raises(RuntimeError):
    mailer.send_verification_email("a@example.com", "token")


def test_send_verification_email_sends(monkeypatch: pytest.MonkeyPatch):
  class FakeSMTP:
    def __init__(self, host: str, port: int, timeout: int):
      self.host = host
      self.port = port
      self.timeout = timeout
      self.started_tls = False
      self.logged_in = False
      self.sent = False

    def __enter__(self):
      return self

    def __exit__(self, exc_type, exc, tb):
      return False

    def starttls(self):
      self.started_tls = True

    def login(self, user: str, password: str | None):
      self.logged_in = True

    def send_message(self, message):
      self.sent = True

  fake = FakeSMTP("", 0, 0)

  def fake_smtp(host: str, port: int, timeout: int):
    nonlocal fake
    fake = FakeSMTP(host, port, timeout)
    return fake

  monkeypatch.setattr(mailer, "SMTP_HOST", "smtp.example.com")
  monkeypatch.setattr(mailer, "SMTP_PORT", 587)
  monkeypatch.setattr(mailer, "SMTP_STARTTLS", True)
  monkeypatch.setattr(mailer, "SMTP_USER", "u")
  monkeypatch.setattr(mailer, "SMTP_PASS", "p")
  monkeypatch.setattr(mailer.smtplib, "SMTP", fake_smtp)

  mailer.send_verification_email("a@example.com", "token")

  assert fake.started_tls is True
  assert fake.logged_in is True
  assert fake.sent is True


def test_send_verification_email_without_login(monkeypatch: pytest.MonkeyPatch):
  class FakeSMTP:
    def __init__(self, host: str, port: int, timeout: int):
      self.started_tls = False
      self.logged_in = False
      self.sent = False

    def __enter__(self):
      return self

    def __exit__(self, exc_type, exc, tb):
      return False

    def starttls(self):
      self.started_tls = True

    def login(self, user: str, password: str | None):
      self.logged_in = True

    def send_message(self, message):
      self.sent = True

  monkeypatch.setattr(mailer, "SMTP_HOST", "smtp.example.com")
  monkeypatch.setattr(mailer, "SMTP_STARTTLS", False)
  monkeypatch.setattr(mailer, "SMTP_USER", "")
  monkeypatch.setattr(mailer.smtplib, "SMTP", lambda *_a, **_k: FakeSMTP("", 0, 0))

  mailer.send_verification_email("a@example.com", "token")
