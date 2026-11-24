"""LLM client with LiteLLM caching and key failover."""

import logging
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import litellm
from litellm import completion
from litellm.caching.caching import Cache
from litellm.exceptions import (
    APIConnectionError,
    APIError,
    RateLimitError,
    ServiceUnavailableError,
)

from app.config import Settings

logger = logging.getLogger(__name__)

# Suppress verbose LiteLLM logging
litellm.suppress_debug_info = True
logging.getLogger("LiteLLM").setLevel(logging.WARNING)


@dataclass
class InferenceResult:
    """Result of an LLM inference call."""

    reply: str
    model: str
    input_tokens: int
    output_tokens: int
    key_id: Optional[str]
    fallback_attempts: int
    resolution_source: str  # LIVE_INFERENCE or LLM_CACHE
    latency_ms: int


def parse_simulation_header(header_value: str) -> Dict[str, int]:
    """Parse X-Simulate-Failure header into a dict of key_id -> status_code.

    Examples:
        'key_1=429'           -> {'key_1': 429}
        'key_1=429,key_2=500' -> {'key_1': 429, 'key_2': 500}
        '*=429'               -> {'*': 429}
    """
    failures = {}
    if not header_value:
        return failures

    for part in header_value.split(","):
        part = part.strip()
        if "=" not in part:
            continue
        key_id, status_str = part.split("=", 1)
        key_id = key_id.strip()
        try:
            status_code = int(status_str.strip())
            if status_code in (429, 500, 502, 503):
                failures[key_id] = status_code
        except ValueError:
            continue

    return failures


class LLMClient:
    """LLM client with key failover and LiteLLM caching."""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._keys = settings.llm_api_keys
        self._model = settings.llm_model
        self._timeout = settings.llm_timeout_seconds
        self._cache_enabled = False

        # Initialize LiteLLM cache
        self._setup_cache()

    def _setup_cache(self):
        """Initialize LiteLLM built-in local cache."""
        try:
            litellm.cache = Cache(type="local")
            litellm.enable_cache = True
            self._cache_enabled = True
            logger.info("LiteLLM local cache initialized")
        except Exception as e:
            logger.error(f"Failed to initialize LiteLLM cache: {e}")
            self._cache_enabled = False

    @property
    def cache_enabled(self) -> bool:
        return self._cache_enabled

    @property
    def key_count(self) -> int:
        return len(self._keys)

    def _should_simulate_failure(
        self, key_index: int, simulation: Dict[str, int]
    ) -> Optional[int]:
        """Check if a key should have a simulated failure."""
        if not simulation:
            return None

        key_id = self._settings.key_id(key_index)

        # Wildcard applies to all keys
        if "*" in simulation:
            return simulation["*"]

        if key_id in simulation:
            return simulation[key_id]

        return None

    def _is_retryable_error(self, error: Exception) -> bool:
        """Determine if an error should trigger key failover."""
        if isinstance(error, RateLimitError):
            return True
        if isinstance(error, ServiceUnavailableError):
            return True
        if isinstance(error, APIConnectionError):
            return True
        if isinstance(error, APIError):
            status = getattr(error, "status_code", None)
            if status in (429, 500, 502, 503):
                return True
            msg = str(error).lower()
            if any(term in msg for term in ("quota", "rate limit", "exceeded", "resource exhausted")):
                return True
        status = getattr(error, "status_code", None)
        if status in (429, 500, 502, 503):
            return True
        return False

    def _build_cache_kwargs(self, messages: List[dict]) -> dict:
        """Build the kwargs for cache key generation and lookup."""
        return {
            "model": self._model,
            "messages": messages,
            "caching": True,
        }

    def _try_cache_lookup(self, messages: List[dict]) -> Optional[object]:
        """Try to find a cached response. Returns the cached response or None."""
        if not self._cache_enabled or not litellm.cache:
            return None

        try:
            cache_kwargs = self._build_cache_kwargs(messages)
            cached_result = litellm.cache.get_cache(**cache_kwargs)
            return cached_result
        except Exception as e:
            logger.debug(f"Cache lookup failed: {e}")
            return None

    def _store_in_cache(self, messages: List[dict], response: object) -> None:
        """Store a response in the cache."""
        if not self._cache_enabled or not litellm.cache:
            return

        try:
            cache_kwargs = self._build_cache_kwargs(messages)
            litellm.cache.add_cache(result=response, **cache_kwargs)
        except Exception as e:
            logger.debug(f"Cache store failed: {e}")

    def _attempt_completion(
        self, messages: List[dict], api_key: str
    ) -> object:
        """Make a single LiteLLM completion call. Returns the raw response."""
        response = completion(
            model=self._model,
            messages=messages,
            api_key=api_key,
            timeout=self._timeout,
            caching=False,  # We handle cache manually for more control
        )
        return response

    def _extract_response_data(self, response: object) -> Tuple[str, str, int, int]:
        """Extract reply text, model, and token counts from a response (object or dict)."""
        if isinstance(response, dict):
            reply_text = ""
            choices = response.get("choices") or []
            if choices and len(choices) > 0:
                first = choices[0]
                if isinstance(first, dict):
                    msg = first.get("message") or {}
                    reply_text = msg.get("content") or "" if isinstance(msg, dict) else getattr(msg, "content", "")
                else:
                    msg = getattr(first, "message", None)
                    reply_text = getattr(msg, "content", "") if msg else ""

            model = response.get("model") or self._model
            usage = response.get("usage") or {}
            if isinstance(usage, dict):
                input_tokens = usage.get("prompt_tokens", 0) or 0
                output_tokens = usage.get("completion_tokens", 0) or 0
            else:
                input_tokens = getattr(usage, "prompt_tokens", 0) or 0
                output_tokens = getattr(usage, "completion_tokens", 0) or 0
        else:
            reply_text = ""
            choices = getattr(response, "choices", None) or []
            if choices and len(choices) > 0:
                first = choices[0]
                msg = getattr(first, "message", None)
                if msg:
                    reply_text = getattr(msg, "content", "") or ""
                elif isinstance(first, dict):
                    msg = first.get("message", {})
                    reply_text = msg.get("content", "") if isinstance(msg, dict) else ""

            model = getattr(response, "model", None) or self._model
            usage = getattr(response, "usage", None)
            input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
            output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0

        try:
            input_tokens = int(input_tokens or 0)
        except (TypeError, ValueError):
            input_tokens = 0
        try:
            output_tokens = int(output_tokens or 0)
        except (TypeError, ValueError):
            output_tokens = 0

        return str(reply_text or ""), str(model or self._model), input_tokens, output_tokens

    def infer(
        self,
        messages: List[dict],
        simulation: Optional[Dict[str, int]] = None,
    ) -> InferenceResult:
        """Run inference with key failover.

        Args:
            messages: Complete message list including system prompt and history.
            simulation: Parsed simulation failure map (key_id -> status_code).

        Returns:
            InferenceResult with reply and metadata.

        Raises:
            AllProvidersUnavailable: When all keys have failed.
        """
        start_time = time.monotonic()
        is_simulating = bool(simulation)

        # --- Cache check (bypass if simulating) ---
        if not is_simulating:
            cached_result = self._try_cache_lookup(messages)
            if cached_result is not None:
                latency_ms = int((time.monotonic() - start_time) * 1000)
                reply_text, model, input_tokens, output_tokens = self._extract_response_data(cached_result)

                return InferenceResult(
                    reply=reply_text,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    key_id=None,
                    fallback_attempts=0,
                    resolution_source="LLM_CACHE",
                    latency_ms=latency_ms,
                )

        # --- Live inference with key failover ---
        fallback_attempts = 0
        last_error: Optional[Exception] = None

        for i, api_key in enumerate(self._keys):
            key_id = self._settings.key_id(i)

            # Check simulation
            if is_simulating:
                sim_status = self._should_simulate_failure(i, simulation)
                if sim_status is not None:
                    logger.info(f"Simulated failure for {key_id}: HTTP {sim_status}")
                    fallback_attempts += 1
                    last_error = APIError(
                        message=f"Simulated {sim_status} for {key_id}",
                        status_code=sim_status,
                        llm_provider="simulated",
                        model=self._model,
                    )
                    continue

            try:
                response = self._attempt_completion(messages, api_key)
                latency_ms = int((time.monotonic() - start_time) * 1000)

                reply_text, model, input_tokens, output_tokens = self._extract_response_data(response)

                # Store in cache (skip if simulating)
                if not is_simulating:
                    self._store_in_cache(messages, response)

                return InferenceResult(
                    reply=reply_text,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    key_id=key_id,
                    fallback_attempts=fallback_attempts,
                    resolution_source="LIVE_INFERENCE",
                    latency_ms=latency_ms,
                )

            except Exception as e:
                logger.warning(f"Key {key_id} failed: {type(e).__name__}")
                last_error = e
                fallback_attempts += 1
                continue

        # All keys exhausted
        raise AllProvidersUnavailable(
            f"All {len(self._keys)} provider keys failed. Last error: {type(last_error).__name__}"
            if last_error
            else f"All {len(self._keys)} provider keys failed."
        )


class AllProvidersUnavailable(Exception):
    """Raised when all configured API keys have failed."""

    pass
