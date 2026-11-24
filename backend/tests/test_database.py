"""Tests for SQLite database operations."""

import os


class TestDatabase:
    """SQLite database tests."""

    def test_database_file_created(self, settings, db):
        """Database file is created automatically."""
        db_path = settings.database_url.replace("sqlite:///", "")
        assert os.path.exists(db_path)

    def test_schema_exists(self, db):
        """Schema exists after initialization."""
        assert db.check_connection()

    def test_save_and_retrieve_exchange(self, db):
        """Messages can be saved and retrieved."""
        db.save_exchange(
            session_id="s-db-1",
            user_content="Hello",
            assistant_content="Hi there",
            assistant_metadata={"resolution_source": "LIVE_INFERENCE", "input_tokens": 10},
            system_prompt="Test prompt",
        )

        messages = db.get_messages("s-db-1")
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Hello"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["content"] == "Hi there"

    def test_session_exists(self, db):
        """Session existence check works."""
        assert not db.session_exists("nonexistent")

        db.save_exchange(
            session_id="s-db-exists",
            user_content="Hello",
            assistant_content="Hi",
            assistant_metadata={},
            system_prompt="Test",
        )
        assert db.session_exists("s-db-exists")

    def test_system_prompt_stored(self, db):
        """System prompt is stored in session table."""
        db.save_exchange(
            session_id="s-db-sp",
            user_content="Hello",
            assistant_content="Hi",
            assistant_metadata={},
            system_prompt="Custom prompt",
        )

        session = db.get_session("s-db-sp")
        assert session is not None
        assert session.system_prompt == "Custom prompt"

    def test_messages_ordered_chronologically(self, db):
        """Messages are retrieved in chronological order."""
        db.save_exchange(
            session_id="s-db-order",
            user_content="First",
            assistant_content="Reply 1",
            assistant_metadata={},
            system_prompt="Test",
        )
        db.save_exchange(
            session_id="s-db-order",
            user_content="Second",
            assistant_content="Reply 2",
            assistant_metadata={},
            system_prompt="Test",
        )

        messages = db.get_messages("s-db-order")
        assert len(messages) == 4
        assert messages[0]["content"] == "First"
        assert messages[1]["content"] == "Reply 1"
        assert messages[2]["content"] == "Second"
        assert messages[3]["content"] == "Reply 2"
