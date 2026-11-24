"""Tests for GET /health endpoint."""


class TestHealth:
    """Health endpoint tests."""

    def test_health_returns_200(self, client):
        """Health returns 200 when DB, keys and cache are initialized."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    def test_health_key_count(self, client):
        """Key count matches configured keys."""
        resp = client.get("/health")
        data = resp.json()
        assert data["keys_configured"] == 2

    def test_health_no_api_key_values(self, client):
        """No API key values appear in health response."""
        resp = client.get("/health")
        body = resp.text
        assert "fake_key_1" not in body
        assert "fake_key_2" not in body

    def test_health_cache_enabled(self, client):
        """Cache is reported as enabled."""
        resp = client.get("/health")
        data = resp.json()
        assert data["cache_enabled"] is True

    def test_health_no_keys_returns_503(self, app):
        """Health reports error when no keys are configured."""
        app.state.settings = Settings(
            llm_api_keys=[],
            database_url=app.state.settings.database_url,
        )
        from fastapi.testclient import TestClient

        c = TestClient(app, raise_server_exceptions=False)
        resp = c.get("/health")
        assert resp.status_code == 503
        assert "detail" in resp.json()

    def test_health_provider_metadata_present(self, client):
        """Health reports provider name, model, and inference verification status."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "provider" in data
        assert "model" in data
        assert "provider_status" in data
        assert "last_inference_verified" in data
        # A configured key must NOT automatically be considered verified
        assert data["last_inference_verified"] is False
        assert data["provider_status"] == "configured"

    def test_health_updates_after_successful_inference(self, client, mock_completion):
        """Health transitions to verified live after successful chat inference."""
        from tests.conftest import make_mock_response
        mock_completion.return_value = make_mock_response("LYFTR Gemini connected")

        # Before inference: not verified
        r0 = client.get("/health").json()
        assert r0["last_inference_verified"] is False

        # Execute chat inference
        c_resp = client.post("/chat", json={
            "session_id": "s-health-verify",
            "message": "Reply with exactly: LYFTR Gemini connected",
        })
        assert c_resp.status_code == 200

        # After inference: verified live
        r1 = client.get("/health").json()
        assert r1["last_inference_verified"] is True
        assert r1["provider_status"] == "verified"


# Import at module level for the test that modifies settings
from app.config import Settings
