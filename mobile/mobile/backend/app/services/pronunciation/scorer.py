from __future__ import annotations

from pathlib import Path
import re

from app.services.pronunciation.engine import run_pronunciation_engine

_PUNCT_TRIM_RE = re.compile(r"^[\s\"'“”‘’\(\)\[\]{}<>.,!?;:]+|[\s\"'“”‘’\(\)\[\]{}<>.,!?;:]+$")
_VOWEL_PHONE_RE = re.compile(r"^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)")
_VOWEL_CLUSTER_RE = re.compile(r"[aeiouy]+", re.IGNORECASE)


def _trim_punctuation(word_text: str) -> tuple[str, int, int]:
    left_trimmed = re.sub(r"^[\s\"'“”‘’\(\)\[\]{}<>.,!?;:]+", "", word_text)
    left = len(word_text) - len(left_trimmed)
    both_trimmed = re.sub(r"[\s\"'“”‘’\(\)\[\]{}<>.,!?;:]+$", "", left_trimmed)
    right = len(word_text) - left - len(both_trimmed)
    return both_trimmed, left, right


def _build_word_feedback(words: list[dict], phonemes: list[dict]) -> list[dict]:
    by_word: dict[str, list[dict]] = {}
    for ph in phonemes:
        w = ph.get("word")
        if not w:
            continue
        by_word.setdefault(str(w).lower(), []).append(ph)

    feedback: list[dict] = []
    for w in words:
        word_text = str(w.get("text", ""))
        trimmed, left_offset, _right = _trim_punctuation(word_text)
        if not trimmed:
            continue

        key = trimmed.lower()
        word_phonemes = by_word.get(key) or []
        warnings = [p for p in word_phonemes if p.get("status") != "good"]
        if not warnings:
            continue

        # Prefer last warning phoneme as a proxy for "ending" issues.
        chosen = warnings[-1]
        symbol = str(chosen.get("symbol") or "")

        # Default span: first 2 chars.
        start_in_trimmed = 0
        end_in_trimmed = min(2, len(trimmed))

        if _VOWEL_PHONE_RE.match(symbol):
            m = _VOWEL_CLUSTER_RE.search(trimmed)
            if m:
                start_in_trimmed, end_in_trimmed = m.start(), m.end()
        else:
            # If chosen phoneme is the last phoneme in word, highlight ending.
            if word_phonemes and chosen is word_phonemes[-1]:
                end_in_trimmed = len(trimmed)
                start_in_trimmed = max(0, end_in_trimmed - 2)

        start = left_offset + start_in_trimmed
        end = left_offset + end_in_trimmed
        start = max(0, min(start, len(word_text)))
        end = max(start + 1, min(end, len(word_text)))

        feedback.append({"word": key, "spans": [{"start": start, "end": end, "severity": "warning"}]})

    return feedback




def _score_phonemes(phones: list[dict], audio_penalty: int) -> list[dict]:
    phonemes: list[dict] = []
    for index, phone in enumerate(phones):
        duration_ms = phone.get("duration_ms", max(0, phone.get("end_ms", 0) - phone.get("start_ms", 0)))
        score = max(55, min(98, 92 - audio_penalty - (0 if duration_ms >= 50 else 12) - (index % 3) * 3))
        status = "good" if score >= 85 else "warning"
        issue = None if status == "good" else "timing_or_clarity"
        tip = None if status == "good" else f"Refine the /{phone.get('text', '')}/ sound with a steadier duration."
        phonemes.append(
            {
                "symbol": phone.get("text", ""),
                "word": phone.get("word"),
                "start_ms": phone.get("start_ms", 0),
                "end_ms": phone.get("end_ms", 0),
                "duration_ms": duration_ms,
                "score": score,
                "status": status,
                "issue": issue,
                "tip": tip,
            }
        )
    return phonemes


def score_pronunciation(
    session_id: str,
    expected_text: str = "Hello, my name is Anna and I love learning English every day.",
    audio_path: str | None = None,
) -> dict:
    engine_result = run_pronunciation_engine(expected_text, audio_path, session_id=session_id)
    alignment = engine_result["alignment"]
    phoneme_map = engine_result["phoneme_map"]
    features = engine_result["features"]

    words = []
    base_score = 92
    for index, segment in enumerate(alignment["segments"]):
        score = max(70, base_score - (index % 5) * 4 - features["audio_penalty"])
        status = "good" if score >= 85 else "warning"
        words.append(
            {
                "text": segment["text"],
                "score": score,
                "status": status,
            }
        )

    phonemes = _score_phonemes(alignment.get("phones", []), features["audio_penalty"])
    word_feedback = _build_word_feedback(words, phonemes)
    pronunciation_score = max(75, min(96, int(features["energy"] * 100) + 2 - features["audio_penalty"]))
    fluency_score = max(74, min(97, int(features["rhythm"] * 100) + 9 - features["audio_penalty"]))
    overall_score = round((pronunciation_score + fluency_score) / 2)

    return {
        "session_id": session_id,
        "overall_score": overall_score,
        "pronunciation_score": pronunciation_score,
        "fluency_score": fluency_score,
        "words": words,
        "phonemes": phonemes,
        "word_feedback": word_feedback,
        "analysis": {
            "alignment_status": alignment["alignment_status"],
            "word_count": features["word_count"],
            "estimated_duration_ms": features["estimated_duration_ms"],
            "phoneme_preview": phoneme_map[:3],
            "audio_path": audio_path,
            "audio_detected": bool(audio_path and Path(audio_path).exists()),
            "engine_meta": alignment.get("engine_meta", {}),
        },
    }
