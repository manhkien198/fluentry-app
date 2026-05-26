from __future__ import annotations

from app.core.config import MFA_ENABLED
from app.services.pronunciation.mfa_runner import run_mfa_alignment
from app.services.pronunciation.textgrid_parser import parse_textgrid


def _mock_alignment(expected_text: str) -> dict:
    words = expected_text.split()
    return {
        "alignment_status": "mocked",
        "segments": [
            {"text": word, "start_ms": index * 320, "end_ms": (index + 1) * 320, "duration_ms": 320}
            for index, word in enumerate(words)
        ],
        "phones": [],
        "engine_meta": {},
    }


def align_expected_text(expected_text: str, session_id: str | None = None, audio_path: str | None = None) -> dict:
    if not MFA_ENABLED or not session_id or not audio_path:
        return _mock_alignment(expected_text)

    mfa_result = run_mfa_alignment(session_id, expected_text, audio_path)
    if not mfa_result.get("ok"):
        fallback = _mock_alignment(expected_text)
        fallback["alignment_status"] = "fallback_heuristic"
        fallback["engine_meta"] = {"failure_reason": mfa_result.get("reason")}
        return fallback

    parsed = parse_textgrid(mfa_result["textgrid_path"])
    return {
        "alignment_status": "mfa",
        "segments": parsed["words"],
        "phones": parsed["phones"],
        "engine_meta": {
            "prepared_audio_path": mfa_result.get("prepared_audio_path"),
            "textgrid_path": mfa_result.get("textgrid_path"),
        },
    }
