"""
core/exceptions.py

Custom exception classes and FastAPI exception handlers.

Replaces: V1's ad-hoc abort(4xx) calls inside route handlers.
"""

from fastapi import Request
from fastapi.responses import JSONResponse


class AFException(Exception):
    """Base exception for AF Server errors."""

    def __init__(self, status_code: int, detail: str, code: str = "ERROR"):
        self.status_code = status_code
        self.detail = detail
        self.code = code
        super().__init__(detail)


class NotFoundError(AFException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=404, detail=detail, code="NOT_FOUND")


class ForbiddenError(AFException):
    def __init__(self, detail: str = "Access denied"):
        super().__init__(status_code=403, detail=detail, code="FORBIDDEN")


class ValidationError(AFException):
    def __init__(self, detail: str):
        super().__init__(status_code=422, detail=detail, code="VALIDATION_ERROR")


class ConflictError(AFException):
    def __init__(self, detail: str):
        super().__init__(status_code=409, detail=detail, code="CONFLICT")


async def af_exception_handler(request: Request, exc: AFException) -> JSONResponse:
    """
    Return AF-style JSON error envelope so the Next.js layer
    can handle errors consistently.

    Shape matches what V1 Flask returned:
      { "status": "ERROR", "msg": "...", "data": null }
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": exc.code,
            "msg": exc.detail,
            "data": None,
        },
    )
