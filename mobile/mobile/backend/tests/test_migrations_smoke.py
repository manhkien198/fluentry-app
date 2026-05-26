from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path


def test_alembic_upgrade_head_smoke():
    backend_dir = Path(__file__).resolve().parent.parent
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "smoke.db"
        env = os.environ.copy()
        env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
        result = subprocess.run(
            [str(backend_dir / ".mfa-venv/bin/alembic"), "upgrade", "head"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
