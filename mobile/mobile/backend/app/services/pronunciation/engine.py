from __future__ import annotations

from app.core.config import MFA_DICTIONARY_PATH, MFA_ENABLED, MFA_MODEL_PATH
from app.services.pronunciation.aligner import align_expected_text
from app.services.pronunciation.features import extract_features
from app.services.pronunciation.phonemizer import phonemize_text


def run_pronunciation_engine(expected_text: str, audio_path: str | None = None, session_id: str | None = None) -> dict:
    alignment = align_expected_text(expected_text, session_id=session_id, audio_path=audio_path)
    phoneme_map = phonemize_text(expected_text)
    features = extract_features(expected_text, audio_path)

    return {
        "engine": "mfa" if MFA_ENABLED and alignment["alignment_status"] == "mfa" else "heuristic",
        "alignment": alignment,
        "phoneme_map": phoneme_map,
        "features": features,
        "config": {
            "mfa_enabled": MFA_ENABLED,
            "mfa_model_path": MFA_MODEL_PATH,
            "mfa_dictionary_path": MFA_DICTIONARY_PATH,
        },
    }
