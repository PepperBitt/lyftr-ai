"""API route handlers."""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

from app.llm.client import AllProvidersUnavailable, parse_simulation_header
from app.schemas.schemas import (
    ChatRequest,
    ChatResponse,
    ErrorResponse,
    HealthResponse,
    MessageItem,
    MessagesResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(request: Request):
    """Health check endpoint."""
    app = request.app
    db = app.state.db
    settings = app.state.settings
    llm = app.state.llm

    # Check database connectivity
    if not db.check_connection():
        raise HTTPException(
            status_code=503,
            detail="database unavailable",
        )

    # Check key configuration
    if settings.key_count == 0:
        raise HTTPException(
            status_code=503,
            detail="no API keys configured",
        )

    return HealthResponse(
        status="ok",
        keys_configured=settings.key_count,
        cache_enabled=llm.cache_enabled,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure"),
):
    """Process a chat message with key failover and caching."""
    app = request.app
    settings = app.state.settings
    chat_service = app.state.chat_service

    # Parse simulation header if enabled
    simulation = None
    if x_simulate_failure and settings.enable_failure_simulation:
        simulation = parse_simulation_header(x_simulate_failure)
        if not simulation:
            simulation = None

    try:
        response = chat_service.chat(
            session_id=body.session_id,
            message=body.message,
            system_prompt=body.system_prompt,
            simulation=simulation,
        )
        return response

    except AllProvidersUnavailable:
        raise HTTPException(
            status_code=503,
            detail="all providers unavailable",
        )
    except Exception as e:
        logger.error(f"Chat error: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="internal server error",
        )


@router.get("/sessions/{session_id}/messages", response_model=MessagesResponse)
async def get_session_messages(session_id: str, request: Request):
    """Retrieve conversation history for a session."""
    app = request.app
    chat_service = app.state.chat_service

    if not chat_service.session_exists(session_id):
        raise HTTPException(
            status_code=404,
            detail="session not found",
        )

    messages = chat_service.get_messages(session_id)
    items = [MessageItem(**msg) for msg in messages]

    return MessagesResponse(
        session_id=session_id,
        messages=items,
    )
