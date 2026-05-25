from __future__ import annotations

from pathlib import Path


def extract_features(expected_text: str, audio_path: str | None = None) -> dict:
    words = expected_text.replace('.', '').replace('?', '').split()
    average_word_length = sum(len(word) for word in words) / max(len(words), 1)
    energy = min(0.95, 0.74 + average_word_length / 25)
    rhythm = min(0.95, 0.7 + len(words) / 40)

    audio_penalty = 0
    if audio_path:
        path = Path(audio_path)
        if path.exists():
            size_kb = max(1, path.stat().st_size // 1024)
            audio_penalty = 0 if size_kb > 30 else 4
        else:
            audio_penalty = 6

    return {
        "word_count": len(words),
        "estimated_duration_ms": len(words) * 360,
        "energy": round(energy, 2),
        "rhythm": round(rhythm, 2),
        "audio_penalty": audio_penalty,
    }
