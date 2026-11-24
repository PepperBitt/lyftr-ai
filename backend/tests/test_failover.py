"""Tests for key failover and failure simulation."""

from unittest.mock import MagicMock
import httpx
from litellm.exceptions import (
    APIConnectionError,
    BadRequestError,
    InternalServerError,
    RateLimitError,
    Timeout,
)

from tests.conftest import make_mock_response


class TestFailover:
    """Failover and failure simulation tests."""

    def test_primary_succeeds(self, client, mock_completion):
        """Primary key succeeds on first attempt."""
        mock_completion.return_value = make_mock_response("Success")
        resp = client.post("/chat", json={
            "session_id": "s-fo-1",
            "message": "Hello",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_1"
        assert data["metadata"]["fallback_attempts"] == 0

    def test_primary_429_secondary_succeeds(self, client, mock_completion):
        """Primary fails with 429, secondary succeeds."""
        mock_completion.return_value = make_mock_response("From backup")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-2", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_2"
        assert data["metadata"]["fallback_attempts"] == 1
        assert data["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    def test_primary_500_secondary_succeeds(self, client, mock_completion):
        """Primary fails with 500, secondary succeeds."""
        mock_completion.return_value = make_mock_response("From backup")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-3", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=500"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_2"

    def test_primary_502_secondary_succeeds(self, client, mock_completion):
        """Primary fails with 502 Bad Gateway, secondary succeeds."""
        mock_completion.return_value = make_mock_response("From backup 502")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-502", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=502"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_2"
        assert data["metadata"]["fallback_attempts"] == 1

    def test_primary_503_secondary_succeeds(self, client, mock_completion):
        """Primary fails with 503 Service Unavailable, secondary succeeds."""
        mock_completion.return_value = make_mock_response("From backup 503")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-503", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=503"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_2"
        assert data["metadata"]["fallback_attempts"] == 1

    def test_malformed_simulation_header_is_ignored(self, client, mock_completion):
        """Malformed or unrecognized simulation header does not crash and is ignored."""
        mock_completion.return_value = make_mock_response("Normal reply")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-mal", "message": "Hello"},
            headers={"X-Simulate-Failure": "invalid_key=999,not_a_pair"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_1"
        assert data["metadata"]["fallback_attempts"] == 0

    def test_all_keys_fail_returns_503(self, client, mock_completion):
        """All keys failing returns 503."""
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-4", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=429,key_2=500"},
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "all providers unavailable"

    def test_wildcard_fails_all_keys(self, client, mock_completion):
        """Wildcard *=429 causes all keys to fail."""
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-5", "message": "Hello"},
            headers={"X-Simulate-Failure": "*=429"},
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "all providers unavailable"

    def test_correct_key_id_returned(self, client, mock_completion):
        """Correct key_id is returned on failover."""
        mock_completion.return_value = make_mock_response("From key 2")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-6", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
        assert resp.status_code == 200
        assert resp.json()["metadata"]["key_id"] == "key_2"

    def test_correct_fallback_attempts(self, client, mock_completion):
        """Correct fallback_attempts count on failover."""
        mock_completion.return_value = make_mock_response("From key 2")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-7", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
        assert resp.json()["metadata"]["fallback_attempts"] == 1

    def test_real_inference_on_unsimulated_key(self, client, mock_completion):
        """Real provider inference is invoked for the unsimulated key."""
        mock_completion.return_value = make_mock_response("Real response")
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-8", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
        assert resp.status_code == 200
        assert mock_completion.called

    def test_simulation_is_request_scoped(self, client, mock_completion):
        """Simulation affects only one request."""
        # First request with simulation
        mock_completion.return_value = make_mock_response("Fallback response")
        resp1 = client.post(
            "/chat",
            json={"session_id": "s-fo-9a", "message": "Hello"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
        assert resp1.status_code == 200
        assert resp1.json()["metadata"]["key_id"] == "key_2"

        # Second request without simulation should use key_1
        mock_completion.return_value = make_mock_response("Normal response")
        resp2 = client.post(
            "/chat",
            json={"session_id": "s-fo-9b", "message": "Hello again"},
        )
        assert resp2.status_code == 200
        assert resp2.json()["metadata"]["key_id"] == "key_1"

    def test_failed_requests_not_stored(self, client, mock_completion):
        """Failed requests are not persisted in history."""
        resp = client.post(
            "/chat",
            json={"session_id": "s-fo-10", "message": "Hello"},
            headers={"X-Simulate-Failure": "*=429"},
        )
        assert resp.status_code == 503

        hist = client.get("/sessions/s-fo-10/messages")
        assert hist.status_code == 404

    def test_non_retryable_error_does_not_failover(self, client, mock_completion):
        """Non-retryable error (e.g. 400 BadRequest) aborts immediately without trying key_2."""
        bad_req = BadRequestError(
            message="Invalid parameter format",
            model="gpt-3.5-turbo",
            llm_provider="test",
        )
        mock_completion.side_effect = bad_req

        resp = client.post(
            "/chat",
            json={"session_id": "s-non-retryable", "message": "Trigger bad request"},
        )
        # Should return error status (500), NOT failover to key_2
        assert resp.status_code == 500
        # mock_completion should have only been attempted ONCE (for key_1), not retried for key_2
        assert mock_completion.call_count == 1

        # Nothing persisted to history
        hist = client.get("/sessions/s-non-retryable/messages")
        assert hist.status_code == 404

    def test_retryable_connection_error_fails_over(self, client, mock_completion):
        """APIConnectionError on key_1 triggers failover to key_2."""
        conn_err = APIConnectionError(
            message="Connection refused to primary",
            llm_provider="test",
            model="gpt-3.5-turbo",
        )
        success_resp = make_mock_response("Success on key_2")

        # First call fails with connection error, second succeeds
        mock_completion.side_effect = [conn_err, success_resp]

        resp = client.post(
            "/chat",
            json={"session_id": "s-retry-conn", "message": "Testing connection failover"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_2"
        assert data["metadata"]["fallback_attempts"] == 1
        assert mock_completion.call_count == 2

    def test_retryable_timeout_fails_over(self, client, mock_completion):
        """Timeout on key_1 triggers failover to key_2."""
        timeout_err = Timeout(
            message="Provider request timed out",
            model="gpt-3.5-turbo",
            llm_provider="test",
        )
        success_resp = make_mock_response("Success on key_2 after timeout")

        mock_completion.side_effect = [timeout_err, success_resp]

        resp = client.post(
            "/chat",
            json={"session_id": "s-retry-timeout", "message": "Testing timeout failover"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["metadata"]["key_id"] == "key_2"
        assert data["metadata"]["fallback_attempts"] == 1

    def test_missing_or_partial_tokens_are_estimated(self, client, mock_completion):
        """When provider returns zero/missing usage, tokens are estimated accurately."""
        # Create a response with 0 prompt_tokens and 0 completion_tokens
        resp_obj = make_mock_response(
            content="Estimated token response text that has multiple words.",
            prompt_tokens=0,
            completion_tokens=0,
        )
        mock_completion.return_value = resp_obj

        resp = client.post(
            "/chat",
            json={"session_id": "s-token-est", "message": "What is the token estimation?"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Must not be 0; must be estimated positive integers
        assert data["metadata"]["input_tokens"] > 0
        assert data["metadata"]["output_tokens"] > 0

    def test_simulation_disabled_ignores_header(self, app, client, mock_completion):
        """When ENABLE_FAILURE_SIMULATION is False, X-Simulate-Failure header is ignored."""
        # Temporarily disable failure simulation on app settings
        original_setting = app.state.settings.enable_failure_simulation
        from app.config import Settings
        app.state.settings = Settings(
            llm_api_keys=app.state.settings.llm_api_keys,
            database_url=app.state.settings.database_url,
            enable_failure_simulation=False,
        )
        try:
            mock_completion.return_value = make_mock_response("Ignored simulation")
            resp = client.post(
                "/chat",
                json={"session_id": "s-sim-disabled", "message": "Hello"},
                headers={"X-Simulate-Failure": "key_1=429"},
            )
            assert resp.status_code == 200
            data = resp.json()
            # Since simulation was disabled, key_1 succeeded without failing over
            assert data["metadata"]["key_id"] == "key_1"
            assert data["metadata"]["fallback_attempts"] == 0
        finally:
            app.state.settings = Settings(
                llm_api_keys=app.state.settings.llm_api_keys,
                database_url=app.state.settings.database_url,
                enable_failure_simulation=original_setting,
            )
