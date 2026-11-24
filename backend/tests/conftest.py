"""Pytest configuration and shared fixtures."""

import os
import tempfile
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from litellm.types.utils import Choices, Message, ModelResponse, Usage

from app.config import Settings
from app.database import Database
from app.llm.client import LLMClient
from app.main import create_app
from app.services.chat_service import ChatService


def make_mock_response(
    content="Test response",
    model="gpt-3.5-turbo",
    prompt_tokens=10,
    completion_tokens=5,
) -> ModelResponse:
    """Create a real ModelResponse object for LiteLLM mocking."""
    return ModelResponse(
        id="test-mock-id",
        choices=[Choices(message=Message(content=content, role="assistant"))],
        model=model,
        usage=Usage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        ),
    )


@pytest.fixture(autouse=True)
def reset_litellm_cache():
    """Ensure LiteLLM cache is clean for every test."""
    import litellm
    from litellm.caching.caching import Cache

    litellm.cache = Cache(type="local")
    yield
    litellm.cache = None


@pytest.fixture
def temp_db_path():
    """Create a temporary database file."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def settings(temp_db_path):
    """Test settings with fake API keys."""
    return Settings(
        llm_api_keys=["fake_key_1", "fake_key_2"],
        llm_model="gpt-3.5-turbo",
        llm_timeout_seconds=30,
        database_url=f"sqlite:///{temp_db_path}",
        allowed_origins=["http://localhost:3000"],
        enable_failure_simulation=True,
        default_system_prompt="You are a test assistant.",
        port=8000,
    )


@pytest.fixture
def db(settings):
    """Initialize a test database."""
    database = Database(settings.database_url)
    database.create_tables()
    return database


@pytest.fixture
def mock_completion():
    """Patch litellm.completion to return a mock response."""
    with patch("app.llm.client.completion") as mock:
        mock.return_value = make_mock_response()
        yield mock


@pytest.fixture
def llm(settings, mock_completion):
    """Create an LLM client with mocked completion."""
    client = LLMClient(settings)
    return client


@pytest.fixture
def chat_service(settings, db, llm):
    """Create a chat service."""
    return ChatService(settings, db, llm)


@pytest.fixture
def app(settings, db, llm, chat_service):
    """Create a test FastAPI app with injected dependencies."""
    test_app = create_app(settings)

    test_app.state.settings = settings
    test_app.state.db = db
    test_app.state.llm = llm
    test_app.state.chat_service = chat_service

    return test_app


@pytest.fixture
def client(app):
    """Create a test HTTP client."""
    return TestClient(app, raise_server_exceptions=False)
