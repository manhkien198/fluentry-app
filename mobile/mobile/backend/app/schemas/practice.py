from typing import Literal

from pydantic import BaseModel


ScoreStatus = Literal["processing", "done", "failed"]


class PracticeSessionCreateRequest(BaseModel):
    lesson_id: str
    expected_text: str


class PracticeSessionCreateResponse(BaseModel):
    session_id: str
    lesson_id: str
    expected_text: str
    status: str


class WordScore(BaseModel):
    text: str
    score: int
    status: str


class PhonemePreview(BaseModel):
    word: str
    phonemes: list[str]


class PhonemeScore(BaseModel):
    symbol: str
    word: str | None = None
    start_ms: int
    end_ms: int
    duration_ms: int
    score: int
    status: str
    issue: str | None = None
    tip: str | None = None


class PracticeAnalysis(BaseModel):
    alignment_status: str
    word_count: int
    estimated_duration_ms: int
    phoneme_preview: list[PhonemePreview]
    audio_path: str | None
    audio_detected: bool
    engine_meta: dict = {}


class WordFeedbackSpan(BaseModel):
    start: int
    end: int
    severity: Literal["warning", "danger"] = "warning"


class WordFeedback(BaseModel):
    word: str
    spans: list[WordFeedbackSpan]


class PracticeScoreBase(BaseModel):
    session_id: str
    overall_score: int
    pronunciation_score: int
    fluency_score: int
    words: list[WordScore]
    phonemes: list[PhonemeScore]
    word_feedback: list[WordFeedback] = []
    analysis: PracticeAnalysis


class PracticeSessionScoreProcessingResponse(BaseModel):
    session_id: str
    status: ScoreStatus


class PracticeSessionScoreDoneResponse(PracticeScoreBase):
    status: ScoreStatus
    tips: list[str]


PracticeSessionScoreResponse = PracticeSessionScoreProcessingResponse | PracticeSessionScoreDoneResponse


class PracticeResultProcessingResponse(BaseModel):
    session_id: str
    status: ScoreStatus


class PracticeResultFailedResponse(BaseModel):
    session_id: str
    status: ScoreStatus
    error: str | None = None


class PracticeResultDoneResponse(PracticeScoreBase):
    status: ScoreStatus
    tips: list[str]


PracticeResultResponse = PracticeResultProcessingResponse | PracticeResultFailedResponse | PracticeResultDoneResponse


class UploadAudioResponse(BaseModel):
    session_id: str
    filename: str
    bytes_received: int
    status: str
