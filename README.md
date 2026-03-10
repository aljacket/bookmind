# BookMind

AI-powered book recommendation engine that helps readers discover their next favorite book based on personal preferences.

## Architecture

**Frontend** — Vue 3 + TypeScript + Tailwind CSS
- Composition API with `<script setup>` syntax
- Pinia for state management (auth, language)
- Vue Router with auth guards
- Vue I18n (English, Italian, Spanish)
- IndexedDB for client-side preference caching

**Backend** — FastAPI (Python)
- OpenAI GPT-3.5-turbo for generating recommendations
- Google Books API for metadata enrichment (covers, ISBNs, page counts)
- Multilingual prompt engineering

**Auth & Storage** — Firebase
- Email/password authentication with local persistence
- Password recovery flow

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+

### Frontend

```sh
npm install
cp .env.example .env   # Fill in your API keys
npm run dev
```

### Backend

```sh
cd bookmind-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Add your OpenAI API key
uvicorn main:app --reload
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:8000/docs`.

## Features

- **Personalized Recommendations** — Configure genre, book length, historical period, complexity, and reading purpose
- **AI-Powered** — GPT-3.5-turbo generates curated book suggestions based on your criteria
- **Book Metadata** — Automatic enrichment with covers, page counts, and purchase links via Google Books API
- **Multilingual** — Full support for English, Italian, and Spanish
- **Daily Limits** — Built-in API usage tracking to manage costs
- **Mobile Ready** — Capacitor support for iOS and Android (coming soon)
