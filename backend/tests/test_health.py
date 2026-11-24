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


# Import at module level for the test that modifies settings
from app.config import Settings
