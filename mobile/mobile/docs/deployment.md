# Deployment plan

## Goal
This project must be deployable, not just runnable on localhost.

## Mobile deployment
### Recommended path
- Use Expo Application Services (EAS)
- Generate Android and iOS builds from the same codebase
- Publish preview builds early for design and flow review

### Requirements
- Expo account
- Apple Developer account for App Store / iOS device distribution
- Google Play Console account for Android release

## Backend deployment
### Recommended hosts
- Railway
- Render
- Fly.io
- VPS with Docker

### Requirements
- Public HTTPS URL
- Persistent database
- Audio file storage
- Environment variable management

## Suggested production components
- FastAPI app container
- PostgreSQL database
- S3-compatible storage for uploads
- Optional background worker for heavier scoring jobs
- Persistent volume or object storage for raw audio and alignment artifacts

## Pronunciation engine rollout
### Current state
- v1 uses saved uploads, session metadata, heuristic feature extraction, and placeholder alignment services
- backend is structured so forced alignment can replace the placeholder without changing mobile contracts

### MFA integration plan
- enable with `MFA_ENABLED=true`
- provide `MFA_MODEL_PATH` and `MFA_DICTIONARY_PATH`
- run alignment in a dedicated worker or job container if startup size becomes too large
- keep scoring response schema stable while replacing the internal alignment engine

### Production recommendation
- do not run heavy alignment directly in the request path once MFA is integrated at scale
- move alignment/scoring to a queue-backed worker when concurrent usage increases
- store uploaded audio outside the app container filesystem in production

## Storage and runtime config
- `UPLOAD_DIR` and `SESSION_DIR` are suitable for local or single-instance testing
- production should move these to durable storage or database-backed metadata


## Deployment stages
### Stage 1
- Deploy backend with mock scoring
- Connect mobile app to production API base URL
- Share preview build with testers

### Stage 2
- Add real pronunciation scoring services
- Move uploads to persistent object storage
- Add auth and user data persistence

### Stage 3
- Add monitoring, retries, analytics, and scaling
- Expose internal runtime counters for abuse/error visibility

## Environment variables
### Backend
- `APP_ENV`
- `PORT`
- `DATABASE_URL`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `API_ALLOWED_ORIGINS`
- `METRICS_TOKEN` (required if `/metrics` is reachable beyond private network)
- `SSO_VERIFY_SIGNATURE` (`true` in production)
- `SSO_GOOGLE_AUDIENCE` (required when Google SSO signature verification is enabled)
- `SSO_GOOGLE_ISSUER` (default `https://accounts.google.com`)
- `SSO_APPLE_AUDIENCE` (required when Apple SSO signature verification is enabled)
- `SSO_APPLE_ISSUER` (default `https://appleid.apple.com`)
- Mobile OAuth config:
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` must be set for real Google login redirect flow

### Mobile
- `EXPO_PUBLIC_API_BASE_URL`

## Runtime metrics endpoint
- Backend exposes `GET /metrics` with in-memory counters.
- Recommended operations:
  - scrape from private network only
  - alert on spikes:
    - `auth.login.failed`
    - `auth.login.ratelimited`
    - `practice.upload.ratelimited`
    - `practice.score.ratelimited`
- Do not expose `/metrics` publicly without network/auth controls.

## Content seeding pipeline
- Content source files:
  - `backend/content/lessons.json`
  - `backend/content/drills.json`
- Seed command (upsert):
  - `cd backend && .mfa-venv/bin/python scripts/seed_content.py`
- Dry-run validation:
  - `cd backend && .mfa-venv/bin/python scripts/seed_content.py --dry-run`
- Validation rules include:
  - unique IDs
  - allowed lesson levels (`Beginner`, `Intermediate`, `Advanced`)
  - allowed drill sounds (`TH`, `R`, `L`) and modes
  - drill `lesson_id` must reference an existing lesson

## Release risks
- Mobile localhost URLs do not work for real devices
- Pronunciation engine dependencies can increase container size
- iOS review may require clear microphone usage disclosure
