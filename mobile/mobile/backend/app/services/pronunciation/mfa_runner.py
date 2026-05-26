from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

from app.core.config import MFA_BINARY, MFA_DICTIONARY_PATH, MFA_MODEL_PATH, MFA_WORK_DIR
from app.services.pronunciation.audio_prep import prepare_audio_for_alignment


def run_mfa_alignment(session_id: str, expected_text: str, audio_path: str | None) -> dict:
    mfa_binary = MFA_BINARY or shutil.which("mfa")
    if not mfa_binary or not Path(mfa_binary).exists():
        return {"ok": False, "reason": "mfa_binary_missing"}
    if not MFA_MODEL_PATH or not MFA_DICTIONARY_PATH:
        return {"ok": False, "reason": "mfa_config_missing"}
    if not audio_path:
        return {"ok": False, "reason": "audio_missing"}

    work_dir = MFA_WORK_DIR / session_id
    corpus_dir = work_dir / "corpus"
    output_dir = work_dir / "output"
    corpus_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    prepared_audio, prep_info = prepare_audio_for_alignment(audio_path, corpus_dir)
    if not prepared_audio:
        return {"ok": False, "reason": prep_info.get("reason", "audio_prep_failed")}

    prepared_audio_path = Path(prepared_audio)
    transcript_path = corpus_dir / f"{prepared_audio_path.stem}.lab"
    transcript_path.write_text(expected_text.strip() + "\n", encoding="utf-8")

    command = [
        mfa_binary,
        "align",
        str(corpus_dir),
        MFA_DICTIONARY_PATH,
        MFA_MODEL_PATH,
        str(output_dir),
        "--clean",
        "--single_speaker",
    ]
    env = os.environ.copy()
    mfa_bin_dir = str(Path(mfa_binary).resolve().parent)
    env["PATH"] = mfa_bin_dir + os.pathsep + env.get("PATH", "")

    completed = subprocess.run(command, capture_output=True, text=True, env=env)
    textgrid_path = output_dir / f"{prepared_audio_path.stem}.TextGrid"

    return {
        "ok": completed.returncode == 0 and textgrid_path.exists(),
        "reason": "ok" if completed.returncode == 0 and textgrid_path.exists() else "mfa_failed",
        "command": command,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "prepared_audio_path": str(prepared_audio_path),
        "textgrid_path": str(textgrid_path),
        "prep": prep_info,
        "meta_path": str((work_dir / "meta.json")),
    }
