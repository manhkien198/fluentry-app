# API contract

## Base URL
- Local: `http://localhost:8000`
- Production: to be assigned during deployment

## Endpoints

### `POST /auth/login`
Authenticate a user or simulate login in early builds.

#### Request
```json
{
  "email": "demo@example.com",
  "password": "secret123"
}
```

#### Response
```json
{
  "access_token": "demo-token",
  "user": {
    "id": "user-1",
    "email": "demo@example.com",
    "display_name": "Demo Learner"
  }
}
```

### `GET /lessons`
Return the lesson catalog.

#### Response
```json
{
  "items": [
    {
      "id": "lesson-1",
      "title": "Confident Introductions",
      "level": "Beginner",
      "duration_minutes": 8,
      "xp": 30,
      "prompt": "Hello, my name is Anna and I love learning English every day."
    }
  ]
}
```

### `POST /practice/sessions`
Create a new practice session.

#### Request
```json
{
  "lesson_id": "lesson-1",
  "expected_text": "Hello, my name is Anna and I love learning English every day."
}
```

#### Response
```json
{
  "session_id": "session-123",
  "lesson_id": "lesson-1",
  "expected_text": "Hello, my name is Anna and I love learning English every day.",
  "status": "created"
}
```

### `POST /practice/sessions/{session_id}/upload-audio`
Upload recorded speech.

#### Response
```json
{
  "session_id": "session-123",
  "filename": "attempt.wav",
  "bytes_received": 218304,
  "status": "uploaded"
}
```

### `POST /practice/sessions/{session_id}/score`
Score a recorded attempt.

#### Response
```json
{
  "session_id": "session-123",
  "overall_score": 86,
  "pronunciation_score": 84,
  "fluency_score": 88,
  "words": [
    { "text": "Hello", "score": 92, "status": "good" },
    { "text": "Anna", "score": 73, "status": "warning" }
  ],
  "analysis": {
    "alignment_status": "mocked",
    "word_count": 10,
    "estimated_duration_ms": 3600,
    "phoneme_preview": [
      { "word": "Hello", "phonemes": ["H", "E", "L", "L"] }
    ],
    "audio_path": "app/data/uploads/session-123.m4a",
    "audio_detected": true
  },
  "tips": [
    "Open vowels more clearly on stressed words.",
    "Practice the sentence again with smoother pacing from the middle to the end."
  ]
}
```

### `GET /users/me/progress`
Return user learning summary.

#### Response
```json
{
  "streak": 12,
  "xp": 1480,
  "level": "B1",
  "pronunciation_score": 84,
  "fluency_score": 87,
  "confidence_score": 91,
  "weak_sounds": ["/θ/", "/d/ endings", "word stress"]
}
```

## Contract rules
- Scores use a 0-100 scale
- Early backend versions may return deterministic mock scoring
- The mobile contract should stay stable even when the scoring engine becomes more advanced
