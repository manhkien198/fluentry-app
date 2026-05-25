from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_STARTTLS, SMTP_USER


def send_verification_email(recipient: str, token: str) -> None:
    subject = "Verify your Fluentry account"
    body = (
        "Welcome to Fluentry!\n\n"
        "Use this verification token to activate your account:\n\n"
        f"{token}\n\n"
        "If you did not create this account, you can ignore this email."
    )

    if not SMTP_HOST:
        raise RuntimeError("SMTP_HOST is required for email verification flow.")

    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        if SMTP_STARTTLS:
            server.starttls()
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASS)
        server.send_message(message)
