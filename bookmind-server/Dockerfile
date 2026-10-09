# BookMind backend image for Cloud Run. Build context is this directory (bookmind-server/).
#
#   docker build -t bookmind-server bookmind-server
#   docker run --rm -p 8080:8080 bookmind-server
#
# Nothing secret is baked in: LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, CORS_ALLOWED_ORIGINS,
# DAILY_LLM_CALL_LIMIT, DAILY_REPORT_LIMIT and FIREBASE_PROJECT_ID are injected at run time
# (see DEPLOY.md).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first, so this layer is cached until requirements.txt changes.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Only the application modules are copied. tests/, .env, venv and the rest are never in the image,
# and .dockerignore (an allowlist) keeps everything else out of the build context too.
COPY main.py auth.py quota.py reports.py llm.py prompts.py ./

# Run as an unprivileged user.
RUN useradd --system --no-create-home --uid 10001 bookmind
USER bookmind

# Cloud Run sends requests to $PORT (8080 by default) on 0.0.0.0.
# https://docs.cloud.google.com/run/docs/container-contract
ENV PORT=8080
EXPOSE 8080

# Shell form on purpose: $PORT must be expanded. exec makes uvicorn PID 1 so it receives SIGTERM.
CMD exec uvicorn main:app --host 0.0.0.0 --port "${PORT}"
