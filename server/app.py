"""Run with: python -m uvicorn server.app:app --host 127.0.0.1 --port 8765"""

import asyncio
import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .assessment import AssessmentError, assess


MAX_BYTES = 50 * 1024 * 1024
ALLOWED_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
app = FastAPI(title="ReBuild video assessment")
allowed_origins = os.getenv(
    "REBUILD_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in allowed_origins.split(",") if item.strip()],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)
inference_lock = asyncio.Semaphore(1)


@app.post("/api/assessments")
async def create_assessment(video: UploadFile = File(...), listing: str = Form(...)):
    if video.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Choose an MP4, WebM, or MOV video.")
    try:
        details = json.loads(listing)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, "Listing details are invalid.") from exc
    if not isinstance(details, dict) or not details.get("title") or not details.get("type"):
        raise HTTPException(400, "Enter a listing title and category before analyzing.")
    details = {key: str(details.get(key, ""))[:300] for key in
               ("title", "type", "material", "model", "dimensions", "condition", "notes")}

    with tempfile.TemporaryDirectory(prefix="rebuild-assessment-") as workspace:
        video_path = Path(workspace) / "uploaded-video"
        size = 0
        try:
            with video_path.open("wb") as destination:
                while chunk := await video.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, "Video must be 50 MB or smaller.")
                    destination.write(chunk)
        finally:
            await video.close()
        if size == 0:
            raise HTTPException(400, "Choose a non-empty video.")
        try:
            async with inference_lock:
                return await asyncio.to_thread(assess, video_path, Path(workspace), details)
        except AssessmentError as exc:
            raise HTTPException(503, str(exc)) from exc
