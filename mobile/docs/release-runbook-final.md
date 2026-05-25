# Final Release Runbook

## 1) Database source of truth (PostgreSQL)
- Ensure backend `.env` uses:
  - `DATABASE_URL=postgresql://<user>@127.0.0.1:5432/speakup_ai`
- Apply migrations:
  - `cd backend && source .mfa-venv/bin/activate && alembic upgrade head`
- Seed single-source content:
  - `python scripts/seed_content.py`
- Verify:
  - `psql -h 127.0.0.1 -p 5432 -U <user> -d speakup_ai -c "select * from alembic_version;"`
  - `psql -h 127.0.0.1 -p 5432 -U <user> -d speakup_ai -c "\\dt public.*"`

## 2) Secret rotation (required before go-live)
- Rotate and update all environments for:
  - `JWT_SECRET`
  - `RESEND_API_KEY` (or chosen provider key)
  - `SSO_GOOGLE_AUDIENCE` / OAuth provider client IDs
- Remove any old/revoked keys from local `.env` and CI secrets.

## 3) Backend quality gate
- `cd backend && source .mfa-venv/bin/activate`
- `pytest -q`
- Health check:
  - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
  - `curl http://127.0.0.1:8000/health`

## 4) Mobile quality gate
- `cd mobile`
- `npm run lint`
- `npm run format:check`
- `npm run typecheck`
- `npm test -- --runInBand`

## 5) CI + Sonar (release branch)
- Push release branch and ensure `.github/workflows/quality-gate.yml` passes:
  - backend tests
  - mobile lint/format/typecheck/test
  - sonar scan + quality gate
- Required secrets in CI:
  - `SONAR_TOKEN`
  - `SONAR_HOST_URL`

## 6) E2E smoke test (real flow)
- Sign up with email/password
- Verify email token
- Sign in
- Start practice
- Upload audio
- Wait scoring complete
- Validate result screen scores + feedback blocks

## 7) Release tagging
- Create release tag after all checks pass:
  - `git tag v1.0.0`
  - `git push origin v1.0.0`
- Attach this runbook and go-live checklist to release notes.
