"""Tests for LiteLLM response caching."""

from tests.conftest import make_mock_response
from app.llm.client import LLMClient


class TestCaching:
    """LiteLLM caching tests."""

    def test_first_request_is_live(self, client, mock_completion):
        """The first request is LIVE_INFERENCE."""
        mock_completion.return_value = make_mock_response("First reply")
        resp = client.post("/chat", json={
            "session_id": "s-cache-1",
            "message": "Hello cache test live",
        })
        assert resp.status_code == 200
        assert resp.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    def test_cache_hit_returns_llm_cache_source(self, client, mock_completion):
        """Same message in a different session returns LLM_CACHE with null key_id."""
        mock_completion.return_value = make_mock_response("Identical cached response", prompt_tokens=25, completion_tokens=10)

        # First request in session 1 -> LIVE_INFERENCE
        resp1 = client.post("/chat", json={
            "session_id": "s-cache-hit-1",
            "message": "Explain how LiteLLM caching works.",
        })
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["metadata"]["resolution_source"] == "LIVE_INFERENCE"
        assert data1["metadata"]["key_id"] == "key_1"
        assert data1["reply"] == "Identical cached response"

        # Second request in brand new session 2 with identical message and system prompt -> LLM_CACHE
        resp2 = client.post("/chat", json={
            "session_id": "s-cache-hit-2",
            "message": "Explain how LiteLLM caching works.",
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["metadata"]["resolution_source"] == "LLM_CACHE"
        assert data2["metadata"]["key_id"] is None
        assert data2["metadata"]["fallback_attempts"] == 0
        assert data2["reply"] == "Identical cached response"
        assert data2["metadata"]["input_tokens"] == 25
        assert data2["metadata"]["output_tokens"] == 10

    def test_cache_preserves_tokens(self, client, mock_completion):
        """Cached response preserves original token counts."""
        mock_completion.return_value = make_mock_response("Tokens reply", prompt_tokens=42, completion_tokens=18)

        # First request
        resp1 = client.post("/chat", json={
            "session_id": "s-token-1",
            "message": "Count these tokens please.",
        })
        assert resp1.status_code == 200
        assert resp1.json()["metadata"]["input_tokens"] == 42
        assert resp1.json()["metadata"]["output_tokens"] == 18

        # Cache hit in new session
        resp2 = client.post("/chat", json={
            "session_id": "s-token-2",
            "message": "Count these tokens please.",
        })
        assert resp2.status_code == 200
        assert resp2.json()["metadata"]["resolution_source"] == "LLM_CACHE"
        assert resp2.json()["metadata"]["input_tokens"] == 42
        assert resp2.json()["metadata"]["output_tokens"] == 18

    def test_different_message_cache_miss(self, client, mock_completion):
        """A different message causes a cache miss."""
        mock_completion.return_value = make_mock_response("Reply A")
        resp1 = client.post("/chat", json={
            "session_id": "s-cache-miss-1",
            "message": "Message A for cache miss test",
        })
        assert resp1.status_code == 200

        mock_completion.return_value = make_mock_response("Reply B")
        resp2 = client.post("/chat", json={
            "session_id": "s-cache-miss-2",
            "message": "Message B for cache miss test",
        })
        assert resp2.status_code == 200
        assert resp2.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    def test_different_system_prompt_cache_miss(self, client, mock_completion):
        """Changing the system prompt causes a cache miss."""
        mock_completion.return_value = make_mock_response("Reply 1")
        resp1 = client.post("/chat", json={
            "session_id": "s-cache-sp1",
            "message": "Same user message for prompt test",
            "system_prompt": "Prompt A",
        })
        assert resp1.status_code == 200

        mock_completion.return_value = make_mock_response("Reply 2")
        resp2 = client.post("/chat", json={
            "session_id": "s-cache-sp2",
            "message": "Same user message for prompt test",
            "system_prompt": "Prompt B",
        })
        assert resp2.status_code == 200
        assert resp2.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    def test_simulation_bypasses_cache(self, client, mock_completion):
        """Failure simulation bypasses cache."""
        mock_completion.return_value = make_mock_response("Cached bypass answer")

        # First populate cache
        resp1 = client.post("/chat", json={
            "session_id": "s-bypass-1",
            "message": "Bypass simulation query",
        })
        assert resp1.status_code == 200
        assert resp1.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

        # Same message with simulation header must bypass cache and fail over to key_2
        mock_completion.return_value = make_mock_response("Live response from key 2")
        resp2 = client.post(
            "/chat",
            json={"session_id": "s-bypass-2", "message": "Bypass simulation query"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
        assert resp2.status_code == 200
        assert resp2.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"
        assert resp2.json()["metadata"]["key_id"] == "key_2"
        assert resp2.json()["metadata"]["fallback_attempts"] == 1

    def test_cache_hit_fallback_zero(self, client, mock_completion):
        """fallback_attempts is zero on cache hit."""
        mock_completion.return_value = make_mock_response("Fallback zero answer")
        resp1 = client.post("/chat", json={
            "session_id": "s-fa-zero-1",
            "message": "Zero fallback query test",
        })
        assert resp1.status_code == 200

        resp2 = client.post("/chat", json={
            "session_id": "s-fa-zero-2",
            "message": "Zero fallback query test",
        })
        assert resp2.status_code == 200
        assert resp2.json()["metadata"]["resolution_source"] == "LLM_CACHE"
        assert resp2.json()["metadata"]["fallback_attempts"] == 0

    def test_different_history_causes_cache_miss(self, client, mock_completion):
        """Different conversation history causes a cache miss."""
        mock_completion.return_value = make_mock_response("Reply 1")
        client.post("/chat", json={
            "session_id": "s-hist-c1",
            "message": "Initial message in thread 1",
        })

        mock_completion.return_value = make_mock_response("Reply 2")
        client.post("/chat", json={
            "session_id": "s-hist-c2",
            "message": "A completely different earlier message",
        })

        # Second message in thread 2 with same text as thread 1's initial message
        mock_completion.return_value = make_mock_response("Reply 3")
        resp = client.post("/chat", json={
            "session_id": "s-hist-c2",
            "message": "Initial message in thread 1",
        })
        assert resp.status_code == 200
        assert resp.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"
