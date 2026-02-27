"""
AF Server V2 — FastAPI
Replaces: af-cloud-webserver (Python 3.7 / Flask / GAE)
Deployed:  Cloud Run — asia-northeast1
"""

import logging

# Configure root logger to INFO so all logger.info() calls are visible in uvicorn output
logging.basicConfig(level=logging.INFO)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.exceptions import af_exception_handler, AFException
from routers import shipments, companies, users, geography, files

app = FastAPI(
    title="AcceleFreight Server V2",
    description="Internal API for the AF Platform (alfred.accelefreight.com → appv2.accelefreight.com)",
    version="2.0.0",
    # Disable docs in production via env var
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# V1 Vue TMS stays on alfred.accelefreight.com — it does NOT call this server.
# Only the new Next.js platform (appv2) and localhost dev call this server.
ALLOWED_ORIGINS = [
    "https://appv2.accelefreight.com",
    "http://localhost:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
app.add_exception_handler(AFException, af_exception_handler)

# ---------------------------------------------------------------------------
# Routers  —  all versioned under /api/v2
# ---------------------------------------------------------------------------
app.include_router(shipments.router, prefix="/api/v2/shipments", tags=["Shipments"])
app.include_router(companies.router, prefix="/api/v2/companies", tags=["Companies"])
app.include_router(users.router,     prefix="/api/v2/users",     tags=["Users"])
app.include_router(geography.router, prefix="/api/v2/geography", tags=["Geography"])
app.include_router(files.router,     prefix="/api/v2/files",     tags=["Files"])


# ---------------------------------------------------------------------------
# Health check  —  unauthenticated, used by Cloud Run
# ---------------------------------------------------------------------------
@app.get("/", tags=["Health"])
def health():
    return {"status": "OK", "version": "2.0.0", "service": "af-server"}
