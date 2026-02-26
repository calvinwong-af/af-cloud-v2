# AF Server V2
# Python 3.12 / FastAPI / Cloud Run — asia-northeast1
#
# Replaces: python:3.8 Flask Dockerfile on GAE

FROM python:3.12-slim

# Don't write .pyc files; don't buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install deps first (layer caching — only rebuilds if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080

# Uvicorn — single worker per container instance.
# Cloud Run handles horizontal scaling at the container level.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
