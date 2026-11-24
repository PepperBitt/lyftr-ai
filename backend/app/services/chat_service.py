"""Chat service — orchestrates conversation flow."""

import logging
from typing import Dict, List, Optional

from app.config import Settings
from app.database import Database
from app.llm.client import InferenceResult, LLMClient
from app.schemas.schemas import ChatResponse, MetadataResponse

logger = logging.getLogger(__name__)


class ChatService:
    """Manages conversation state and LLM inference."""

    def __init__(self, settings: Settings, db: Database, llm: LLMClient):
        self._settings = settings
        self._db = db
        self._llm = llm

    def _resolve_system_prompt(
        self, session_id: str, supplied_prompt: Optional[str]
    ) -> str:
        """Determine the effective system prompt for a session."""
        if supplied_prompt is not None:
            return supplied_prompt

        # Check if the session already has a stored prompt
        session_row = self._db.get_session(session_id)
        if session_row and session_row.system_prompt:
            return session_row.system_prompt

        # Fall back to default
        return self._settings.default_system_prompt

    def _build_messages(
        self,
        session_id: str,
        new_message: str,
        system_prompt: str,
    ) -> List[dict]:
        """Construct the full messages list for the LLM request."""
        messages = [{"role": "system", "content": system_prompt}]

        # Retrieve existing conversation history
        history = self._db.get_messages(session_id)
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

        # Add the new user message
        messages.append({"role": "user", "content": new_message})

        return messages

    def chat(
        self,
        session_id: str,
        message: str,
        system_prompt: Optional[str] = None,
        simulation: Optional[Dict[str, int]] = None,
    ) -> ChatResponse:
        """Process a chat request.

        Args:
            session_id: The conversation session identifier.
            message: The new user message.
            system_prompt: Optional system prompt override.
            simulation: Parsed failure simulation map.

        Returns:
            ChatResponse with reply and metadata.

        Raises:
            AllProvidersUnavailable: When inference fails completely.
        """
        # Resolve effective system prompt
        effective_prompt = self._resolve_system_prompt(session_id, system_prompt)

        # Build complete messages list
        messages = self._build_messages(session_id, message, effective_prompt)

        # Run inference with failover
        result: InferenceResult = self._llm.infer(
            messages=messages,
            simulation=simulation,
        )

        # Build metadata
        metadata_dict = {
            "resolution_source": result.resolution_source,
            "model": result.model,
            "latency_ms": result.latency_ms,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
            "key_id": result.key_id,
            "fallback_attempts": result.fallback_attempts,
        }

        # Persist exchange only on success
        self._db.save_exchange(
            session_id=session_id,
            user_content=message,
            assistant_content=result.reply,
            assistant_metadata=metadata_dict,
            system_prompt=effective_prompt,
        )

        return ChatResponse(
            session_id=session_id,
            reply=result.reply,
            metadata=MetadataResponse(**metadata_dict),
        )

    def get_messages(self, session_id: str) -> List[dict]:
        """Retrieve conversation history for a session."""
        return self._db.get_messages(session_id)

    def session_exists(self, session_id: str) -> bool:
        """Check if a session has any stored messages."""
        return self._db.session_exists(session_id)
