"""Tests for error safety and response format."""


class TestErrorSafety:
    """Error safety tests."""

    def test_no_stack_trace_in_422(self, client):
        """No stack trace in 422 responses."""
        resp = client.post("/chat", json={"session_id": "s-err", "message": ""})
        body = resp.text
        assert "Traceback" not in body
        assert "File " not in body

    def test_every_error_has_detail(self, client):
        """Every error response contains detail."""
        # 422
        resp = client.post("/chat", json={})
        assert "detail" in resp.json()

        # 404
        resp = client.get("/sessions/nonexistent/messages")
        assert "detail" in resp.json()

        # 503
        resp = client.post(
            "/chat",
            json={"session_id": "s-err-503", "message": "Hello"},
            headers={"X-Simulate-Failure": "*=429"},
        )
        assert "detail" in resp.json()

    def test_failed_provider_no_persistence(self, client, mock_completion):
        """Failed provider request does not persist messages."""
        resp = client.post(
            "/chat",
            json={"session_id": "s-err-nopersist", "message": "Hello"},
            headers={"X-Simulate-Failure": "*=429"},
        )
        assert resp.status_code == 503

        hist = client.get("/sessions/s-err-nopersist/messages")
        assert hist.status_code == 404

    def test_no_unintended_endpoints(self, client):
        """No unintended application endpoints are exposed."""
        # FastAPI docs should be disabled
        assert client.get("/docs").status_code == 404 or client.get("/docs").status_code == 405
        assert client.get("/redoc").status_code == 404 or client.get("/redoc").status_code == 405
        assert client.get("/openapi.json").status_code == 404 or client.get("/openapi.json").status_code == 405
