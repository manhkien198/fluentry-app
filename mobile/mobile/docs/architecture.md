# Architecture

## Overview
The system is split into a mobile client and a backend API.

- Mobile app: renders lessons, records audio, uploads attempts, and visualizes results
- Backend API: handles lesson data, practice sessions, uploads, scoring, and progress summaries

## Monorepo layout
```text
fluentry/
├── mobile/
├── backend/
├── infra/
└── docs/
```

## Mobile architecture
### Main choices
- Expo React Native for Android + iOS delivery
- TypeScript for safety and maintainability
- React Navigation for screen flow
- React Native Paper for fast polished UI
- Zustand for lightweight client state
- TanStack Query for server data caching

### Feature modules
- `auth/`
- `home/`
- `lesson/`
- `practice/`
- `result/`
- `progress/`

### Main UX flow
`Auth -> Home -> Lesson -> Practice -> Result -> Progress`

## Backend architecture
### Main choices
- FastAPI for a clean deployable REST API
- Uvicorn for serving
- Python services for pronunciation pipeline orchestration

### Planned modules
- `app/api/auth.py`
- `app/api/lessons.py`
- `app/api/practice.py`
- `app/api/users.py`
- `app/schemas/`
- `app/services/pronunciation/`

## Pronunciation pipeline
### Request flow
1. Mobile sends expected text and recorded audio.
2. Backend normalizes audio.
3. Backend aligns the audio with the target text.
4. Backend converts target text into phoneme sequence.
5. Backend computes phoneme, word, and fluency scores.
6. Backend generates human-readable feedback.
7. Mobile renders scores and tips.

### Planned components
- `engine.py` — orchestration layer for heuristic mode now and MFA/Whisper later
- `aligner.py` — forced alignment integration
- `phonemizer.py` — CMUdict and g2p-en mapping
- `features.py` — duration, energy, pitch, spectral features
- `scorer.py` — scoring logic
- `feedback.py` — user-facing coaching output

## Data model
### Core entities
- User
- Lesson
- PracticeSession
- AudioSubmission
- PronunciationResult
- UserProgress

## Deployment shape
### Mobile
- Expo / EAS build for Android and iOS artifacts

### Backend
- Containerized FastAPI app
- Deployable on Railway, Render, Fly.io, or VPS
- Object storage for uploaded audio
- Database for users and results
