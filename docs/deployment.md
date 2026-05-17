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

## Environment variables
### Backend
- `APP_ENV`
- `PORT`
- `DATABASE_URL`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `API_ALLOWED_ORIGINS`

### Mobile
- `EXPO_PUBLIC_API_BASE_URL`

## Release risks
- Mobile localhost URLs do not work for real devices
- Pronunciation engine dependencies can increase container size
- iOS review may require clear microphone usage disclosure
