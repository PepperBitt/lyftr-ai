"""Tests for input validation."""


class TestValidation:
    """Validation tests for POST /chat."""

    def test_missing_session_id(self, client):
        """Missing session_id produces 422."""
        resp = client.post("/chat", json={"message": "hello"})
        assert resp.status_code == 422
        assert "detail" in resp.json()

    def test_empty_session_id(self, client):
        """Empty session_id produces 422."""
        resp = client.post("/chat", json={"session_id": "", "message": "hello"})
        assert resp.status_code == 422
        assert "detail" in resp.json()

    def test_whitespace_session_id(self, client):
        """Whitespace-only session_id produces 422."""
        resp = client.post("/chat", json={"session_id": "   ", "message": "hello"})
        assert resp.status_code == 422
        assert "detail" in resp.json()

    def test_missing_message(self, client):
        """Missing message produces 422."""
        resp = client.post("/chat", json={"session_id": "s-test"})
        assert resp.status_code == 422
        assert "detail" in resp.json()

    def test_empty_message(self, client):
        """Empty message produces 422."""
        resp = client.post("/chat", json={"session_id": "s-test", "message": ""})
        assert resp.status_code == 422
        assert "detail" in resp.json()

    def test_whitespace_only_message(self, client):
        """Whitespace-only message produces 422."""
        resp = client.post("/chat", json={"session_id": "s-test", "message": "   "})
        assert resp.status_code == 422
        assert "detail" in resp.json()

    def test_message_over_4000_chars(self, client):
        """Message exceeding 4000 characters produces 422."""
        long_msg = "x" * 4001
        resp = client.post("/chat", json={"session_id": "s-test", "message": long_msg})
        assert resp.status_code == 422
        assert "detail" in resp.json()

    def test_message_exactly_4000_chars(self, client):
        """Message of exactly 4000 characters is accepted."""
        msg = "x" * 4000
        resp = client.post("/chat", json={"session_id": "s-test", "message": msg})
        # Should not be a 422; could be 200 or another code depending on mocks
        assert resp.status_code != 422

    def test_malformed_json(self, client):
        """Malformed JSON produces 422."""
        resp = client.post(
            "/chat",
            content=b"not json",
            headers={"content-type": "application/json"},
        )
        assert resp.status_code == 422
        assert "detail" in resp.json()
