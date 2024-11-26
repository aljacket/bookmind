from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
# Initialize OpenAI with your API key
client = OpenAI(api_key = os.getenv('OPENAI_API_KEY'))

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow your frontend's origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

class UserPreferences(BaseModel):
    genre: str
    bookLength: str
    period: str
    complexity: str
    purpose: str
    learningGoal: str = ""

class BookRecommendation(BaseModel):
    title: str
    author: str

@app.post("/recommendations", response_model=List[BookRecommendation])
async def get_recommendations(preferences: UserPreferences):
    system_message = "You are a book expert. Recommend 3 books based on preferences."
    prompt = f"3 books: g:{preferences.genre},l:{preferences.bookLength},p:{preferences.period},c:{preferences.complexity},s:{preferences.purpose}{',o:' + preferences.learningGoal if preferences.learningGoal else ''}. Only JSON:{{b:[{{t,a}}]}}"

    try:
        response = client.chat.completions.create(model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=150)

        content = response.choices[0].message.content.strip() or '{}'
        recommendations = eval(content).get('b', [])

        return [{"title": rec['t'], "author": rec['a']} for rec in recommendations]
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recommendations")