# Analytics taxonomy

## Event naming
- snake_case, verb-first, domain-scoped when needed

## Core events
- `practice_session_started`
- `practice_audio_uploaded`
- `practice_score_processing`
- `practice_score_done`
- `practice_score_failed`
- `practice_result_status`
- `drill_start`

## Required common fields
- `timestamp` (ISO string)
- `sessionId` (if available)
- `lessonId` (if available)
- `source` (screen or action trigger)

## Quality rules
- Never send PII in payload
- Keep payload keys stable
- Add new events only with docs update and tests
