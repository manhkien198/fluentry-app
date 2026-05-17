from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

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
from app.services.storage import save_upload
from app.tasks.practice_tasks import run_practice_scoring

router = APIRouter()


@router.post("/sessions", response_model=PracticeSessionCreateResponse)
def create_session(payload: PracticeSessionCreateRequest) -> PracticeSessionCreateResponse:
    session_id = f"session-{uuid4()}"
    save_session(
        session_id,
        {
            "session_id": session_id,
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
async def upload_audio(session_id: str, file: UploadFile = File(...)) -> UploadAudioResponse:
    session = load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    content = await file.read()
    saved_path = save_upload(session_id, file.filename or "attempt.wav", content)
    session["audio_path"] = str(saved_path)
    session["status"] = "uploaded"
    save_session(session_id, session)

    return UploadAudioResponse(
        session_id=session_id,
        filename=file.filename or "attempt.wav",
        bytes_received=len(content),
        status="uploaded",
    )


@router.post("/sessions/{session_id}/score", response_model=PracticeSessionScoreResponse)
def score_session(session_id: str) -> PracticeSessionScoreResponse:
    session = load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.get("audio_path"):
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
    return PracticeSessionScoreProcessingResponse(session_id=session_id, status="processing")


@router.get("/sessions/{session_id}/result", response_model=PracticeResultResponse)
def get_result(session_id: str) -> PracticeResultResponse:
    session = load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    score_status = session.get("score_status")

    if score_status == "done" and session.get("score_result"):
        return PracticeResultDoneResponse(**session["score_result"], status="done")

    if score_status == "failed":
        return PracticeResultFailedResponse(session_id=session_id, status="failed", error=session.get("score_error"))

    return PracticeResultProcessingResponse(session_id=session_id, status="processing")
