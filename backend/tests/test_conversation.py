"""Tests for conversation history and session management."""

from tests.conftest import make_mock_response


class TestConversationHistory:
    """Conversation history tests."""

    def test_first_message_persisted(self, client, mock_completion):
        """Successful first message is persisted."""
        mock_completion.return_value = make_mock_response("Paris is the capital.")
        resp = client.post("/chat", json={
            "session_id": "s-hist-1",
            "message": "What is the capital of France?",
        })
        assert resp.status_code == 200

        hist = client.get("/sessions/s-hist-1/messages")
        assert hist.status_code == 200
        msgs = hist.json()["messages"]
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert msgs[1]["role"] == "assistant"

    def test_assistant_metadata_persisted(self, client, mock_completion):
        """Assistant reply metadata is persisted."""
        mock_completion.return_value = make_mock_response("Reply here.", prompt_tokens=20, completion_tokens=8)
        client.post("/chat", json={
            "session_id": "s-meta-1",
            "message": "Test message unique",
        })

        hist = client.get("/sessions/s-meta-1/messages")
        msgs = hist.json()["messages"]
        assistant_msg = msgs[1]
        assert "metadata" in assistant_msg
        assert "resolution_source" in assistant_msg["metadata"]
        assert "input_tokens" in assistant_msg["metadata"]
        assert "output_tokens" in assistant_msg["metadata"]

    def test_multi_turn_includes_history(self, client, mock_completion):
        """Subsequent messages include previous conversation context."""
        mock_completion.return_value = make_mock_response("First reply")
        client.post("/chat", json={
            "session_id": "s-multi-1",
            "message": "First message",
        })

        mock_completion.return_value = make_mock_response("Second reply")
        client.post("/chat", json={
            "session_id": "s-multi-1",
            "message": "Second message",
        })

        # Verify completion was called with history
        last_call = mock_completion.call_args
        messages = last_call.kwargs.get("messages") or last_call[1].get("messages")
        # Should have: system, user1, assistant1, user2
        assert len(messages) >= 4

    def test_different_sessions_independent(self, client, mock_completion):
        """Different sessions remain isolated."""
        mock_completion.return_value = make_mock_response("Reply A")
        client.post("/chat", json={"session_id": "s-a", "message": "Session A message"})

        mock_completion.return_value = make_mock_response("Reply B")
        client.post("/chat", json={"session_id": "s-b", "message": "Session B message"})

        hist_a = client.get("/sessions/s-a/messages").json()["messages"]
        hist_b = client.get("/sessions/s-b/messages").json()["messages"]

        assert len(hist_a) == 2
        assert len(hist_b) == 2
        assert hist_a[1]["content"] == "Reply A"
        assert hist_b[1]["content"] == "Reply B"

    def test_messages_oldest_first(self, client, mock_completion):
        """Messages are returned in chronological order."""
        mock_completion.return_value = make_mock_response("Reply 1")
        client.post("/chat", json={"session_id": "s-order", "message": "Msg 1"})

        mock_completion.return_value = make_mock_response("Reply 2")
        client.post("/chat", json={"session_id": "s-order", "message": "Msg 2"})

        hist = client.get("/sessions/s-order/messages").json()["messages"]
        assert hist[0]["content"] == "Msg 1"
        assert hist[1]["content"] == "Reply 1"
        assert hist[2]["content"] == "Msg 2"
        assert hist[3]["content"] == "Reply 2"

    def test_system_prompt_excluded_from_history(self, client, mock_completion):
        """System prompt never appears in history output."""
        mock_completion.return_value = make_mock_response("Reply")
        client.post("/chat", json={
            "session_id": "s-sys-1",
            "message": "Hello",
            "system_prompt": "Custom system prompt",
        })

        hist = client.get("/sessions/s-sys-1/messages").json()["messages"]
        for msg in hist:
            assert msg["role"] in ("user", "assistant")

    def test_unknown_session_returns_404(self, client):
        """Unknown session returns 404."""
        resp = client.get("/sessions/nonexistent-session/messages")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "session not found"

    def test_system_prompt_persistence(self, client, mock_completion):
        """System prompt is retained for subsequent turns."""
        mock_completion.return_value = make_mock_response("Reply 1")
        client.post("/chat", json={
            "session_id": "s-sp-1",
            "message": "Hello",
            "system_prompt": "You are a pirate.",
        })

        mock_completion.return_value = make_mock_response("Reply 2")
        client.post("/chat", json={
            "session_id": "s-sp-1",
            "message": "Tell me more",
        })

        last_call = mock_completion.call_args
        messages = last_call.kwargs.get("messages") or last_call[1].get("messages")
        system_msg = messages[0]
        assert system_msg["role"] == "system"
        assert system_msg["content"] == "You are a pirate."

    def test_system_prompt_update(self, client, mock_completion):
        """Supplying a new system_prompt updates the session's effective prompt."""
        mock_completion.return_value = make_mock_response("Reply 1")
        client.post("/chat", json={
            "session_id": "s-sp-upd",
            "message": "Hello",
            "system_prompt": "Prompt A",
        })

        mock_completion.return_value = make_mock_response("Reply 2")
        client.post("/chat", json={
            "session_id": "s-sp-upd",
            "message": "More",
            "system_prompt": "Prompt B",
        })

        last_call = mock_completion.call_args
        messages = last_call.kwargs.get("messages") or last_call[1].get("messages")
        assert messages[0]["content"] == "Prompt B"
