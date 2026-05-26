from fastapi import APIRouter

from app.services.content_loader import load_content_manifest

router = APIRouter()


@router.get("/version")
def get_content_version() -> dict[str, str]:
    return load_content_manifest()
