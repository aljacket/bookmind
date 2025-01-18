from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
from enum import Enum

# Load environment variables
load_dotenv()

# Initialize OpenAI with your API key
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
        "capacitor://localhost",
        "*"  # During development only - remove in production
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SupportedLanguage(str, Enum):
    en = "en"
    es = "es"
    it = "it"

class UserPreferences(BaseModel):
    genre: str
    bookLength: str
    period: str
    complexity: str
    purpose: str
    learningGoal: str = ""
    lang: SupportedLanguage = SupportedLanguage.en

class BookRecommendation(BaseModel):
    title: str
    author: str

@app.post("/recommendations")
async def get_recommendations(preferences: UserPreferences) -> List[BookRecommendation]:
    # Validate learning goal if purpose is learning or skill development
    if preferences.purpose in ["learning", "skill_development"]:
        if not preferences.learningGoal:
            raise HTTPException(
                status_code=400,
                detail="Learning goal is required when purpose is learning or skill development"
            )
    
    # Keep all existing language-specific prompts but optimized
    if preferences.lang == "en":
        prompt = (
            f"3 Books matching:\n"
            f"Genre: {preferences.genre}\n"
            f"Length: {preferences.bookLength}\n"
            f"Period: {preferences.period}\n"
            f"Level: {preferences.complexity}\n"
            f"Purpose: {preferences.purpose}"
        )
        if preferences.learningGoal and preferences.purpose in ["learning", "skill_development"]:
            prompt += f"\nGoal: {preferences.learningGoal}"
        prompt += "\nReturn 3: {\"b\":[{\"t\":\"title\",\"a\":\"author\"}]}"
    elif preferences.lang == "es":
        prompt = (
            f"3 Libros que coincidan:\n"
            f"Género: {preferences.genre}\n"
            f"Largo: {preferences.bookLength}\n"
            f"Época: {preferences.period}\n"
            f"Nivel: {preferences.complexity}\n"
            f"Fin: {preferences.purpose}"
        )
        if preferences.learningGoal and preferences.purpose in ["learning", "skill_development"]:
            prompt += f"\nMeta: {preferences.learningGoal}"
        prompt += "\nDevolver 3: {\"b\":[{\"t\":\"título\",\"a\":\"autor\"}]}"
    elif preferences.lang == "it":
        prompt = (
            f"3 Libri corrispondenti:\n"
            f"Genere: {preferences.genre}\n"
            f"Lunghezza: {preferences.bookLength}\n"
            f"Periodo: {preferences.period}\n"
            f"Livello: {preferences.complexity}\n"
            f"Scopo: {preferences.purpose}"
        )
        if preferences.learningGoal and preferences.purpose in ["learning", "skill_development"]:
            prompt += f"\nObiettivo: {preferences.learningGoal}"
        prompt += "\nRitorna 3: {\"b\":[{\"t\":\"titolo\",\"a\":\"autore\"}]}"
    
    
    try:
        # Create chat completion with OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a book recommendation expert. For learning-related requests, focus on educational and practical books that match the specific learning goal. Always return recommendations in the exact JSON format requested."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        
        # Get the response content
        content = response.choices[0].message.content.strip()
        
        try:
            # Try to parse the JSON response
            data = json.loads(content)
            recommendations = data.get('b', [])
            
            if not recommendations:
                raise HTTPException(
                    status_code=500,
                    detail="No recommendations found in the response"
                )
            
            # Validate and return recommendations
            validated_recommendations = []
            for rec in recommendations:
                title = rec.get('t')
                author = rec.get('a')
                if title and author:
                    validated_recommendations.append(BookRecommendation(title=title, author=author))
            
            if not validated_recommendations:
                raise HTTPException(
                    status_code=500,
                    detail="Invalid recommendations format"
                )
            
            return validated_recommendations
            
        except json.JSONDecodeError as json_err:
            raise HTTPException(
                status_code=500,
                detail="Failed to parse OpenAI response as JSON"
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )