from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_current_user
from app.schemas.practice import (
    PracticeResultDoneResponse,
    PracticeResultFailedResponse,
    PracticeResultProcessingResponse,
    PracticeResultResponse,
    PracticeSessionCreateRequest,
    PracticeSessionCreateResponse,
    PracticeSessionScoreDoneResponse,
    PracticeSessionScoreProcessingResponse,
    PracticeSessionScoreResponse,
    UploadAudioResponse,
)
from app.services.session_store import load_session, save_session
from app.services.rate_limit import allow_request
from app.services.storage import save_upload
from app.services.runtime_metrics import inc
from app.tasks.practice_tasks import run_practice_scoring

router = APIRouter()


@router.post("/sessions", response_model=PracticeSessionCreateResponse)
def create_session(payload: PracticeSessionCreateRequest, current_user=Depends(get_current_user)) -> PracticeSessionCreateResponse:
    session_id = f"session-{uuid4()}"
    save_session(
        session_id,
        {
            "session_id": session_id,
            "user_id": current_user.id,
            "lesson_id": payload.lesson_id,
            "expected_text": payload.expected_text,
            "status": "created",
            "audio_path": None,
            "score_status": None,
            "score_task_id": None,
            "score_result": None,
            "score_error": None,
        },
    )
    return PracticeSessionCreateResponse(
        session_id=session_id,
        lesson_id=payload.lesson_id,
        expected_text=payload.expected_text,
        status="created",
    )


@router.post("/sessions/{session_id}/upload-audio", response_model=UploadAudioResponse)
async def upload_audio(session_id: str, file: UploadFile = File(...), current_user=Depends(get_current_user)) -> UploadAudioResponse:
    session = load_session(session_id, user_id=current_user.id)
    if session is None:
        inc("practice.upload.not_found")
        raise HTTPException(status_code=404, detail="Session not found")
    if not allow_request(f"upload:{current_user.id}", limit=30, window_seconds=60):
        inc("practice.upload.ratelimited")
        raise HTTPException(status_code=429, detail="Too many uploads")
    if file.content_type and not file.content_type.startswith("audio/"):
        inc("practice.upload.invalid_type")
        raise HTTPException(status_code=400, detail="Invalid file type")

    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        inc("practice.upload.too_large")
        raise HTTPException(status_code=413, detail="Audio file too large")
    saved_path = save_upload(session_id, file.filename or "attempt.wav", content)
    session["audio_path"] = str(saved_path)
    session["status"] = "uploaded"
    save_session(session_id, session)
    inc("practice.upload.success")

    return UploadAudioResponse(
        session_id=session_id,
        filename=file.filename or "attempt.wav",
        bytes_received=len(content),
        status="uploaded",
    )


@router.post("/sessions/{session_id}/score", response_model=PracticeSessionScoreResponse)
def score_session(session_id: str, current_user=Depends(get_current_user)) -> PracticeSessionScoreResponse:
    session = load_session(session_id, user_id=current_user.id)
    if session is None:
        inc("practice.score.not_found")
        raise HTTPException(status_code=404, detail="Session not found")
    if not allow_request(f"score:{current_user.id}", limit=20, window_seconds=60):
        inc("practice.score.ratelimited")
        raise HTTPException(status_code=429, detail="Too many scoring requests")

    if not session.get("audio_path"):
        inc("practice.score.no_audio")
        raise HTTPException(status_code=400, detail="Audio not uploaded")

    score_status = session.get("score_status")
    if score_status == "done" and session.get("score_result"):
        return PracticeSessionScoreDoneResponse(**session["score_result"], status="done")

    if score_status in {"processing"}:
        return PracticeSessionScoreProcessingResponse(session_id=session_id, status="processing")

    task_id = session.get("score_task_id")
    if task_id:
        async_result = run_practice_scoring.AsyncResult(task_id)
        if async_result.successful() and session.get("score_status") == "done" and session.get("score_result"):
            return PracticeSessionScoreDoneResponse(**session["score_result"], status="done")
        if async_result.failed():
            session["score_status"] = "failed"
            save_session(session_id, session)
            return PracticeSessionScoreProcessingResponse(session_id=session_id, status="failed")

    async_result = run_practice_scoring.delay(session_id)
    session["score_status"] = "processing"
    session["score_task_id"] = async_result.id
    save_session(session_id, session)
    inc("practice.score.processing")
    return PracticeSessionScoreProcessingResponse(session_id=session_id, status="processing")


@router.get("/sessions/{session_id}/result", response_model=PracticeResultResponse)
def get_result(session_id: str, current_user=Depends(get_current_user)) -> PracticeResultResponse:
    session = load_session(session_id, user_id=current_user.id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    score_status = session.get("score_status")

    if score_status == "done" and session.get("score_result"):
        return PracticeResultDoneResponse(**session["score_result"], status="done")

    if score_status == "failed":
        return PracticeResultFailedResponse(session_id=session_id, status="failed", error=session.get("score_error"))

    return PracticeResultProcessingResponse(session_id=session_id, status="processing")
