from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from app.core.config import FFMPEG_BINARY


def prepare_audio_for_alignment(audio_path: str | None, output_dir: Path) -> tuple[str | None, dict]:
    if not audio_path:
        return None, {"prepared": False, "reason": "missing_audio"}

    source = Path(audio_path)
    if not source.exists():
        return None, {"prepared": False, "reason": "audio_not_found"}

    output_dir.mkdir(parents=True, exist_ok=True)
    prepared_path = output_dir / f"{source.stem}.wav"

    ffmpeg_path = FFMPEG_BINARY or shutil.which("ffmpeg")
    if ffmpeg_path and Path(ffmpeg_path).exists():
        command = [
            ffmpeg_path,
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(prepared_path),
        ]
        completed = subprocess.run(command, capture_output=True, text=True)
        if completed.returncode == 0 and prepared_path.exists():
            return str(prepared_path), {"prepared": True, "reason": "ffmpeg"}

    shutil.copyfile(source, prepared_path)
    return str(prepared_path), {"prepared": True, "reason": "copied_without_ffmpeg"}
