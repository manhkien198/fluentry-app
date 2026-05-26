# Fluentry

Fluentry is a cross-platform mobile pronunciation coaching app inspired by ELSA. This project uses a React Native Expo mobile client and a FastAPI backend so it can be developed quickly and deployed beyond local-only usage.

## Project goals
- Build a Fluentry-branded guided speaking experience that still mimics ELSA for Android and iOS
- Provide lesson-based pronunciation practice
- Return detailed pronunciation feedback, not just a single score
- Keep the backend self-hosted and open-source friendly
- Be deployable for real usage, not just a local prototype

## Repository structure
- `mobile/` — Expo React Native app
- `backend/` — FastAPI application and pronunciation scoring pipeline
- `infra/` — deployment and local infrastructure files
- `docs/` — architecture, API contract, roadmap, and deployment notes

## Current stack
### Mobile
- Expo React Native
- TypeScript
- React Navigation
- React Native Paper
- Zustand
- TanStack Query
- Axios

### Backend
- Python
- FastAPI
- Uvicorn
- Planned pronunciation pipeline:
  - Montreal Forced Aligner
  - CMUdict
  - g2p-en
  - librosa / parselmouth
  - rule-based scoring first, ML scoring later

## Core product flow
1. User opens the app and starts a lesson.
2. User reads a guided word or sentence.
3. App records audio and uploads it to the backend.
4. Backend aligns speech with the expected text.
5. Backend scores words, phonemes, and fluency.
6. App displays detailed feedback and learning progress.

## Documentation
- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [API contract](docs/api-contract.md)
- [Deployment plan](docs/deployment.md)
- [Roadmap](docs/roadmap.md)

- [SonarQube setup](docs/sonarqube.md)
- [Analytics taxonomy](docs/analytics-taxonomy.md)
- [Go-live checklist](docs/go-live-checklist.md)

## Quick start
### Mobile
1. `cd mobile`
2. `cp .env.example .env`
3. `npm install`
4. `npm run start`

For iOS simulator and web, `localhost` is fine. For a physical phone, set `EXPO_PUBLIC_API_BASE_URL` to your computer LAN IP or a deployed HTTPS backend before launching Expo.

The result screen now renders backend analysis data, including alignment status, estimated duration, and a phoneme preview block.

The app uses environment-only API configuration (`EXPO_PUBLIC_API_BASE_URL`) and no in-app API override.

### Backend
1. `cd backend`
2. `cp .env.example .env`
3. `python3 -m venv .venv`
4. `.venv/bin/pip install -e .`
5. `PYTHONPATH=$(pwd) .venv/bin/uvicorn app.main:app --reload`

For production, set a strong `JWT_SECRET` (minimum 32 characters), explicit `CORS_ALLOW_ORIGINS`, `APP_ENV=production`, and enable SSO signature verification with provider audiences.

Backend v1 now persists session metadata and uploaded audio under `app/data/` for local development.


### Docker backend
1. `cd infra`
2. `docker compose up --build`

## Notes
The machine used for scaffolding did not have Flutter installed, so the project was bootstrapped with Expo React Native to keep cross-platform delivery fast and deployable.

## Engineering standard
- All delivered code must be production-grade and complete (not prototype-grade).
- Every behavior change must include meaningful automated tests (backend and/or mobile) for normal flow and critical failure paths.
- UI changes must preserve accessibility/contrast and consistent interaction states (pressed, disabled, loading).
- Network-dependent flows must include timeout handling, retry strategy, and user-facing recovery UX.


## Quality scanning
- SonarQube configuration is provided at `sonar-project.properties`.
- Setup and run instructions: `docs/sonarqube.md`.
