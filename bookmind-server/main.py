from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Literal
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
from enum import Enum

from prompts import (
    CLARIFIER_SYSTEM_PROMPT,
    RECOMMENDATION_SYSTEM_PROMPT,
    build_clarifier_prompt,
    build_recommendation_prompt,
)

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "http://10.0.2.2:8000",
        "https://10.0.2.2:8000",
        "http://10.0.2.2",
        "https://10.0.2.2",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class RecommendationRequest(BaseModel):
    lang: SupportedLanguage
    transcript: List[TranscriptTurn] = Field(..., min_length=2, max_length=3)


class BookRecommendation(BaseModel):
    title: str
    author: str
    reason: str = ""


def _user_messages(transcript: List[TranscriptTurn]) -> List[str]:
    return [turn.content for turn in transcript]


@app.post("/recommendations/clarify", response_model=ClarifyResponse)
async def clarify(request: ClarifyRequest) -> ClarifyResponse:
    user_prompt = build_clarifier_prompt(request.lang.value, _user_messages(request.transcript))
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": CLARIFIER_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=80,
        )
        question = (response.choices[0].message.content or "").strip()
        if not question:
            raise HTTPException(status_code=502, detail="Empty clarifier response from model")
        return ClarifyResponse(question=question)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recommendations", response_model=List[BookRecommendation])
async def get_recommendations(request: RecommendationRequest) -> List[BookRecommendation]:
    user_prompt = build_recommendation_prompt(
        request.lang.value, _user_messages(request.transcript)
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": RECOMMENDATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=400,
        )
        content = (response.choices[0].message.content or "").strip()
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
        raise HTTPException(status_code=500, detail=str(e))