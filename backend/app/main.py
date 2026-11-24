"""FastAPI application entry point."""

import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import Settings, load_settings
from app.database import Database
from app.llm.client import LLMClient
from app.services.chat_service import ChatService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    if settings is None:
        settings = load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info("Initializing LYFTR AI backend...")

        # Ensure directory exists for SQLite
        db_path = settings.database_url.replace("sqlite:////", "/").replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path)
        actual_db_url = settings.database_url
        if db_dir:
            try:
                os.makedirs(db_dir, exist_ok=True)
                # Verify directory is writable
                probe_path = os.path.join(db_dir, ".probe_write")
                try:
                    with open(probe_path, "w") as f:
                        f.write("ok")
                    os.remove(probe_path)
                except (PermissionError, OSError) as write_err:
                    raise PermissionError(f"Directory '{db_dir}' exists but is not writable: {write_err}") from write_err
            except (PermissionError, OSError) as e:
                # Fallback for local environments where /data is not permitted or writable
                local_dir = os.path.abspath("./data")
                os.makedirs(local_dir, exist_ok=True)
                actual_db_url = f"sqlite:///{os.path.join(local_dir, 'app.db')}"
                logger.warning(
                    f"Configured database path '{db_path}' is not writable ({e}). "
                    f"Falling back to local path '{actual_db_url}'."
                )

        # Database
        db = Database(actual_db_url)
        db.create_tables()
        logger.info("Database initialized")

        # LLM Client
        llm = LLMClient(settings)
        logger.info(f"LLM client initialized with {settings.key_count} keys")

        # Chat Service
        chat_service = ChatService(settings, db, llm)

        # Store on app state
        app.state.settings = settings
        app.state.db = db
        app.state.llm = llm
        app.state.chat_service = chat_service
        app.state.last_inference_verified = False
        app.state.provider_status = "configured" if settings.key_count > 0 else "unconfigured"

        logger.info("LYFTR AI backend ready")
        yield
        logger.info("LYFTR AI backend shutting down")

    app = FastAPI(
        title="LYFTR AI",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Simulate-Failure"],
    )

    # --- Custom validation error handler ---
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        # Build a human-readable detail message
        messages = []
        for err in errors:
            field = ".".join(str(loc) for loc in err.get("loc", []) if loc != "body")
            msg = err.get("msg", "validation error")
            if field:
                messages.append(f"{field}: {msg}")
            else:
                messages.append(msg)
        detail = "; ".join(messages) if messages else "validation error"
        return JSONResponse(
            status_code=422,
            content={"detail": detail},
        )

    # --- Generic exception handler ---
    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {type(exc).__name__}")
        return JSONResponse(
            status_code=500,
            content={"detail": "internal server error"},
        )

    # --- Routes ---
    app.include_router(router)

    return app


# Default app instance for uvicorn
app = create_app()
