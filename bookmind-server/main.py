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

# Language-specific system messages with explicit instructions for language
system_messages = {
    "en": "You are a book expert. Recommend 3 books based on the user's preferences. Provide titles and authors in English.",
    "es": "Eres un experto en libros. Recomienda 3 libros basados en las preferencias del usuario. Proporciona títulos y autores en español.",
    "it": "Sei un esperto bibliotecario. Consiglia 3 libri in base alle preferenze dell'utente. Fornisci titoli e autori in italiano."
}

@app.post("/recommendations", response_model=List[BookRecommendation])
async def get_recommendations(preferences: UserPreferences):
    lang = preferences.lang
    system_message = system_messages.get(lang, system_messages["en"])

    # Construct the prompt based on the selected language
    if lang == "en":
        prompt = (
            f"Recommend 3 books based on the following preferences:\n"
            f"Genre: {preferences.genre}\n"
            f"Length: {preferences.bookLength}\n"
            f"Period: {preferences.period}\n"
            f"Complexity: {preferences.complexity}\n"
            f"Purpose: {preferences.purpose}"
        )
        if preferences.learningGoal:
            prompt += f"\nLearning Goal: {preferences.learningGoal}"
        prompt += "\nOnly return JSON in the format: {\"b\":[{\"t\":\"title\",\"a\":\"author\"}]}"
    elif lang == "es":
        prompt = (
            f"Recomienda 3 libros basados en las siguientes preferencias:\n"
            f"Género: {preferences.genre}\n"
            f"Longitud: {preferences.bookLength}\n"
            f"Período: {preferences.period}\n"
            f"Complejidad: {preferences.complexity}\n"
            f"Propósito: {preferences.purpose}"
        )
        if preferences.learningGoal:
            prompt += f"\nObjetivo de aprendizaje: {preferences.learningGoal}"
        prompt += "\nSolo devuelve JSON en el formato: {\"b\":[{\"t\":\"título\",\"a\":\"autor\"}]}"
    elif lang == "it":
        prompt = (
            f"Consiglia 3 libri in base alle seguenti preferenze:\n"
            f"Genere: {preferences.genre}\n"
            f"Lunghezza: {preferences.bookLength}\n"
            f"Periodo: {preferences.period}\n"
            f"Complessità: {preferences.complexity}\n"
            f"Scopo: {preferences.purpose}"
        )
        if preferences.learningGoal:
            prompt += f"\nObiettivo di apprendimento: {preferences.learningGoal}"
        prompt += "\nRestituisci solo JSON nel formato: {\"b\":[{\"t\":\"titolo\",\"a\":\"autore\"}]}"
    else:
        # Fallback to English
        prompt = (
            f"Recommend 3 books based on the following preferences:\n"
            f"Genre: {preferences.genre}\n"
            f"Length: {preferences.bookLength}\n"
            f"Period: {preferences.period}\n"
            f"Complexity: {preferences.complexity}\n"
            f"Purpose: {preferences.purpose}"
        )
        if preferences.learningGoal:
            prompt += f"\nLearning Goal: {preferences.learningGoal}"
        prompt += "\nOnly return JSON in the format: {\"b\":[{\"t\":\"title\",\"a\":\"author\"}]}"
    
    try:
        # Create chat completion with OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )

        content = response.choices[0].message.content.strip() or '{}'
        recommendations = json.loads(content).get('b', [])

        # Validate and return recommendations
        validated_recommendations = []
        for rec in recommendations:
            title = rec.get('t')
            author = rec.get('a')
            if title and author:
                validated_recommendations.append({"title": title, "author": author})

        if not validated_recommendations:
            raise HTTPException(status_code=500, detail="No valid recommendations found.")

        return validated_recommendations
    except json.JSONDecodeError:
        print("Failed to parse JSON response from OpenAI.")
        raise HTTPException(status_code=500, detail="Invalid response format from recommendation engine.")
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recommendations")