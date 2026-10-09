import json
import logging
import os
from enum import Enum
from typing import List, Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import llm
import quota
from auth import get_current_uid
from prompts import (
    CLARIFIER_SYSTEM_PROMPT,
    RECOMMENDATION_SYSTEM_PROMPT,
    build_clarifier_prompt,
    build_recommendation_prompt,
)

load_dotenv()

logger = logging.getLogger("bookmind.api")

# Local development origins. Production sets CORS_ALLOWED_ORIGINS and must not include these.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,"
    "http://localhost:3000,"
    "http://localhost,"
    "https://localhost,"
    "capacitor://localhost,"
    "http://10.0.2.2:8000,"
    "https://10.0.2.2:8000,"
    "http://10.0.2.2,"
    "https://10.0.2.2"
)


def get_cors_origins() -> List[str]:
    raw = os.getenv("CORS_ALLOWED_ORIGINS")
    if raw is None or not raw.strip():
        raw = DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=False,  # auth is a bearer header, never a cookie
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class SupportedLanguage(str, Enum):
    en = "en"
    es = "es"
    it = "it"


class TranscriptTurn(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str = Field(..., min_length=1, max_length=500)


class ClarifyRequest(BaseModel):
    lang: SupportedLanguage
    transcript: List[TranscriptTurn] = Field(..., min_length=2, max_length=2)


class ClarifyResponse(BaseModel):
    question: str


class LikedBook(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=200)


class RecommendationRequest(BaseModel):
    lang: SupportedLanguage
    transcript: List[TranscriptTurn] = Field(..., min_length=2, max_length=3)
    liked_books: List[LikedBook] | None = Field(default=None, max_length=20)


class BookRecommendation(BaseModel):
    title: str
    author: str
    reason: str = ""


def _user_messages(transcript: List[TranscriptTurn]) -> List[str]:
    return [turn.content for turn in transcript]


@app.post("/recommendations/clarify", response_model=ClarifyResponse)
def clarify(
    request: ClarifyRequest,
    uid: str = Depends(get_current_uid),
    quota_store: quota.QuotaStore = Depends(quota.get_quota_store),
) -> ClarifyResponse:
    quota.consume_llm_call(quota_store, uid)
    user_prompt = build_clarifier_prompt(request.lang.value, _user_messages(request.transcript))
    try:
        question = llm.chat(
            [
                {"role": "system", "content": CLARIFIER_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=80,
        )
        if not question:
            raise HTTPException(status_code=502, detail="Empty clarifier response from model")
        return ClarifyResponse(question=question)
    except HTTPException:
        raise
    except Exception as e:
        # Log the error class only: provider errors can echo parts of the request or the key.
        logger.error("LLM call failed: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Recommendation service error")


@app.post("/recommendations", response_model=List[BookRecommendation])
def get_recommendations(
    request: RecommendationRequest,
    uid: str = Depends(get_current_uid),
    quota_store: quota.QuotaStore = Depends(quota.get_quota_store),
) -> List[BookRecommendation]:
    quota.consume_llm_call(quota_store, uid)
    liked_books_payload = (
        [{"title": lb.title, "author": lb.author} for lb in request.liked_books]
        if request.liked_books
        else None
    )
    user_prompt = build_recommendation_prompt(
        request.lang.value,
        _user_messages(request.transcript),
        liked_books=liked_books_payload,
    )
    try:
        content = llm.chat(
            [
                {"role": "system", "content": RECOMMENDATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=400,
        )
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=502, detail="Failed to parse model response as JSON")
        items = data.get("b", [])
        if not items:
            raise HTTPException(status_code=502, detail="No recommendations in model response")
        validated: List[BookRecommendation] = []
        for rec in items:
            title = rec.get("t")
            author = rec.get("a")
            reason = rec.get("r", "")
            if title and author:
                validated.append(BookRecommendation(title=title, author=author, reason=reason))
        if not validated:
            raise HTTPException(status_code=502, detail="Invalid recommendations format")
        return validated
    except HTTPException:
        raise
    except Exception as e:
        # Log the error class only: provider errors can echo parts of the request or the key.
        logger.error("LLM call failed: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Recommendation service error")
