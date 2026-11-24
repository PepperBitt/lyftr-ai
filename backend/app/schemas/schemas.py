"""Pydantic request and response schemas."""

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    """POST /chat request body."""

    session_id: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1, max_length=4000)
    system_prompt: Optional[str] = None

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("session_id must not be empty or whitespace")
        return stripped

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("message must not be empty or whitespace")
        if len(stripped) > 4000:
            raise ValueError("message must not exceed 4000 characters")
        return stripped


class MetadataResponse(BaseModel):
    """Inference metadata."""

    resolution_source: str  # LIVE_INFERENCE or LLM_CACHE
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    key_id: Optional[str] = None
    fallback_attempts: int


class ChatResponse(BaseModel):
    """POST /chat response body."""

    session_id: str
    reply: str
    metadata: MetadataResponse


class HealthResponse(BaseModel):
    """GET /health response body."""

    status: str
    keys_configured: int
    cache_enabled: bool


class MessageItem(BaseModel):
    """A single message in conversation history."""

    role: str
    content: str
    metadata: Optional[dict] = None


class MessagesResponse(BaseModel):
    """GET /sessions/{session_id}/messages response body."""

    session_id: str
    messages: list[MessageItem]


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str
