"""Application configuration loaded from environment variables."""

import os
from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class Settings:
    """Immutable application settings."""

    # LLM configuration
    llm_api_keys: List[str] = field(default_factory=list)
    llm_model: str = "gemini/gemini-3.5-flash-lite"
    llm_timeout_seconds: int = 60

    # Database
    database_url: str = "sqlite:////data/app.db"

    # CORS
    allowed_origins: List[str] = field(default_factory=lambda: ["http://localhost:3000"])

    # Failure simulation
    enable_failure_simulation: bool = False

    # Defaults
    default_system_prompt: str = "You are a helpful AI assistant."

    # Server
    port: int = 8000

    @property
    def key_count(self) -> int:
        return len(self.llm_api_keys)

    def key_id(self, index: int) -> str:
        """Return the human-readable key identifier for a given index."""
        return f"key_{index + 1}"


def load_settings() -> Settings:
    """Load settings from environment variables and .env file if available."""
    try:
        from dotenv import load_dotenv
        # Check standard locations for .env
        for env_path in [".env", "../.env", "../../.env"]:
            if os.path.exists(env_path):
                load_dotenv(env_path, override=False)
                break
    except Exception:
        pass

    raw_keys = os.environ.get("LLM_API_KEYS", "")
    keys = [k.strip() for k in raw_keys.split(",") if k.strip()] if raw_keys else []

    raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

    return Settings(
        llm_api_keys=keys,
        llm_model=os.environ.get("LLM_MODEL", "gemini/gemini-3.5-flash-lite"),
        llm_timeout_seconds=int(os.environ.get("LLM_TIMEOUT_SECONDS", "60")),
        database_url=os.environ.get("DATABASE_URL", "sqlite:////data/app.db"),
        allowed_origins=origins,
        enable_failure_simulation=os.environ.get("ENABLE_FAILURE_SIMULATION", "false").lower() == "true",
        default_system_prompt=os.environ.get("DEFAULT_SYSTEM_PROMPT", "You are a helpful AI assistant."),
        port=int(os.environ.get("PORT", "8000")),
    )
