# backend/api.py

import os
import logging
import asyncio
import json
import signal
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import torch
from transformers import BertTokenizer
from passlib.context import CryptContext
import jwt
# Import our DB setup, models, and helper for saving moderator actions
from backend.database import SessionLocal, engine, Base
from backend.models import User, ModeratorAction
from backend.model import CyberbullyModel
from backend.moderator_db import save_moderator_action

# ─── 1) Logging setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ─── 2) Load environment variables & validate JWT settings ───────────────────
load_dotenv()  # reads .env into process.env
JWT_SECRET    = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
if not JWT_SECRET:
    # Fail fast if secret missing
    raise RuntimeError("⚠️  JWT_SECRET is not set or invalid in your .env!")

# ─── 3) FastAPI instantiation & CORS ───────────────────────────────────────────
app = FastAPI(title="Cyberbully Detection API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 4) Database initialization ────────────────────────────────────────────────
# Create tables if they don’t already exist
Base.metadata.create_all(bind=engine)

def get_db():
    """
    FastAPI dependency: yields a SQLAlchemy session and ensures it’s closed.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── 5) Authentication utilities & Pydantic schemas ───────────────────────────
pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

class AuthRequest(BaseModel):
    """Incoming payload for /auth/register and /auth/login."""
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    """Response from /auth/login."""
    access_token: str
    token_type: str = "bearer"

def create_access_token(
    data: dict,
    expires_delta: timedelta = timedelta(hours=1)
) -> str:
    """
    Create a signed JWT with an expiration.
    """
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + expires_delta})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ─── 6) Authentication endpoints ──────────────────────────────────────────────
@app.post("/auth/register", tags=["Auth"])
def register(req: AuthRequest, db: Session = Depends(get_db)):
    """
    Register a new moderator user.
    Hashes the password and stores email+hash.
    """
    hashed_pw = pwd_context.hash(req.password)
    user = User(email=req.email, hashed=hashed_pw)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Raised if email already exists
        raise HTTPException(400, "Email already registered")
    return {"msg": "User registered"}

@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(req: AuthRequest, db: Session = Depends(get_db)):
    """
    Verify credentials and return a JWT on success.
    """
    user = db.query(User).filter_by(email=req.email).first()
    if not user or not pwd_context.verify(req.password, user.hashed):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token}

# ─── 7) Cyberbully detection setup ─────────────────────────────────────────────
class DetectRequest(BaseModel):
    """Payload for /detect: unique comment_id + text to classify."""
    comment_id: str
    text: str

class DetectResponse(DetectRequest):
    """Response from /detect: echoes request + label + confidence."""
    label: str
    confidence: float

class ActionRequest(BaseModel):
    """Incoming payload for /action (approve/reject)."""
    comment_id: str
    action: str

# Load trained PyTorch model + tokenizer once at startup
model     = CyberbullyModel()
model.load_state_dict(torch.load("backend/best_model.pt", map_location="cpu"))
model.eval()
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

# In-memory queue of pending cyberbully flags
pending_queue: dict[str, dict] = {}
_current_proc = None  # for retraining subprocess

# ─── 8) Detection endpoints ────────────────────────────────────────────────────
@app.options("/detect")
def detect_preflight():
    """
    Support CORS preflight for POST /detect.
    """
    return Response(status_code=200)

@app.post("/detect", response_model=DetectResponse, tags=["Detection"])
def detect(req: DetectRequest):
    """
    Classify incoming text as cyberbully/non-cyberbully.
    If flagged, enqueue in pending_queue.
    """
    try:
        # Tokenize input
        enc = tokenizer(
            req.text,
            max_length=128,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )
        # Model inference
        with torch.no_grad():
            logits = model(enc.input_ids, attention_mask=enc.attention_mask)
            probs  = torch.softmax(logits, dim=1)[0]
        # Decide label
        label     = "cyberbully" if probs[1] > 0.5 else "non-cyberbully"
        confidence = float(probs.max())
        # Enqueue if flagged
        if label == "cyberbully":
            pending_queue[req.comment_id] = {
                "text": req.text,
                "confidence": confidence
            }
        return DetectResponse(
            **req.dict(),
            label=label,
            confidence=confidence
        )
    except Exception:
        logger.exception("Error in /detect")
        raise HTTPException(500, "Internal detection error")

# ─── 9) Queue & Moderation endpoints ──────────────────────────────────────────
@app.get("/queue", response_model=list[DetectResponse], tags=["Moderation"])
def get_queue():
    """
    Return the current list of flagged comments.
    (Does NOT clear the queue so UI can re-fetch)
    """
    return [
        DetectResponse(
            comment_id=cid,
            text=data["text"],
            label="cyberbully",
            confidence=data["confidence"]
        )
        for cid, data in pending_queue.items()
    ]

@app.delete("/queue/{comment_id}", tags=["Moderation"])
def delete_from_queue(comment_id: str):
    """
    Remove a flagged comment (e.g. if moderator chose to ignore it).
    """
    if comment_id in pending_queue:
        del pending_queue[comment_id]
        return {"message": f"{comment_id} removed from queue."}
    raise HTTPException(404, "Comment not found in queue")

@app.post("/action", tags=["Moderation"])
async def handle_action(request: Request, db: Session = Depends(get_db)):
    """
    Approve or reject a flagged comment permanently.
    Persists the decision in moderator_actions table.
    """
    data    = ActionRequest(**(await request.json()))
    comment = pending_queue.pop(data.comment_id, None)
    if not comment:
        raise HTTPException(404, "Comment not found")
    # Save to DB
    save_moderator_action(
        comment_id=data.comment_id,
        text=comment["text"],
        action=data.action,
        db=db
    )
    logger.info(f"[ACTION] {data.comment_id} → {data.action}")
    return {"message": "Action recorded"}

@app.get("/history", tags=["Moderation"])
def get_history(db: Session = Depends(get_db)):
    """
    Return full history of all moderator actions,
    ordered by most recent first.
    """
    rows = db.query(ModeratorAction).order_by(
        ModeratorAction.timestamp.desc()
    ).all()
    return [
        {
            "comment_id": r.comment_id,
            "text":       r.text,
            "action":     r.action,
            "timestamp":  r.timestamp.isoformat()
        }
        for r in rows
    ]

# ─── 10) Retraining endpoints ─────────────────────────────────────────────────
@app.post("/retrain", tags=["Retraining"])
def retrain_trigger():
    """
    Kick off an asynchronous retraining process.
    """
    logger.info("Retrain triggered")
    return {"message": "Retraining started"}

@app.get("/retrain/stream", tags=["Retraining"])
async def retrain_stream():
    """
    Stream JSON‐encoded progress events from retrain_model.py
    via server‐sent events.
    """
    global _current_proc

    async def gen():
        # Launch subprocess
        _current_proc = await asyncio.create_subprocess_exec(
            "python3", "-u", "retrain_model.py",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        # Read lines and yield as SSE
        while True:
            line = await _current_proc.stdout.readline()
            if not line:
                break
            text = line.decode().strip()
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                payload = {"type": "raw", "line": text}
            # Log progress messages to console
            if payload.get("type") == "progress":
                logger.info(f"[RETRAIN PROGRESS] {payload.get('progress')}%")
            yield f"data: {json.dumps(payload)}\n\n"
        # Wait for process to exit
        await _current_proc.wait()
        logger.info("Retraining process completed")
        yield "data: {\"type\":\"complete\"}\n\n"

    return StreamingResponse(
        gen(),
        headers={
            "Cache-Control": "no-cache",
            "Content-Type":  "text/event-stream",
            "Connection":    "keep-alive"
        }
    )

@app.post("/retrain/cancel", tags=["Retraining"])
def cancel_retrain():
    """
    Send SIGINT to the retraining subprocess, if running.
    """
    global _current_proc
    if _current_proc and _current_proc.returncode is None:
        _current_proc.send_signal(signal.SIGINT)
        logger.info("Retrain cancellation requested")
        return {"message": "Cancel requested"}
    return {"message": "No training in progress"}
