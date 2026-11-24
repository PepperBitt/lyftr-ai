"""API route handlers."""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from starlette.concurrency import run_in_threadpool

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
    """Health check endpoint.

    Returns HTTP 200 once the app is running, the database is reachable,
    and the key pool is loaded.
    """
    app = request.app
    db = app.state.db
    settings = app.state.settings
    llm = app.state.llm

    # Check database connectivity in thread pool to prevent blocking event loop
    db_reachable = await run_in_threadpool(db.check_connection)
    if not db_reachable:
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

    last_inference_verified = getattr(app.state, "last_inference_verified", False)
    provider_status = getattr(app.state, "provider_status", "configured")

    return HealthResponse(
        status="ok",
        keys_configured=settings.key_count,
        cache_enabled=llm.cache_enabled,
        provider="gemini" if "gemini" in settings.llm_model.lower() else "llm_gateway",
        model=settings.llm_model,
        provider_status=provider_status,
        last_inference_verified=last_inference_verified,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure"),
):
    """Process a chat message with key failover, response caching, and threadpool offload."""
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
        # Offload synchronous LiteLLM and SQLite calls to the threadpool
        response = await run_in_threadpool(
            chat_service.chat,
            session_id=body.session_id,
            message=body.message,
            system_prompt=body.system_prompt,
            simulation=simulation,
        )
        if response.metadata.resolution_source == "LIVE_INFERENCE":
            app.state.last_inference_verified = True
            app.state.provider_status = "verified"
        return response

    except AllProvidersUnavailable as e:
        logger.warning(f"All providers unavailable: {e}")
        app.state.provider_status = "unavailable"
        raise HTTPException(
            status_code=503,
            detail="all providers unavailable",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {type(e).__name__}: {e}")
        app.state.provider_status = "error"
        raise HTTPException(
            status_code=500,
            detail="internal server error",
        )


@router.get("/sessions/{session_id}/messages", response_model=MessagesResponse)
async def get_session_messages(session_id: str, request: Request):
    """Retrieve conversation history for a session from SQLite in oldest-first order."""
    app = request.app
    chat_service = app.state.chat_service

    session_exists = await run_in_threadpool(chat_service.session_exists, session_id)
    if not session_exists:
        raise HTTPException(
            status_code=404,
            detail="session not found",
        )

    messages = await run_in_threadpool(chat_service.get_messages, session_id)
    items = [MessageItem(**msg) for msg in messages]

    return MessagesResponse(
        session_id=session_id,
        messages=items,
    )
