"""SQLite database setup with SQLAlchemy."""

import json
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, List, Optional

from sqlalchemy import (
    Column,
    Integer,
    Text,
    create_engine,
    event,
    text,
)
from sqlalchemy.orm import Session, declarative_base, sessionmaker

Base = declarative_base()


class MessageRow(Base):
    """Conversation message storage."""

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Text, nullable=False, index=True)
    role = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    meta = Column("metadata", Text, nullable=True)  # maps to 'metadata' column in DB
    created_at = Column(Text, nullable=False, index=True)


class SessionRow(Base):
    """Session metadata storage for system prompt persistence."""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Text, nullable=False, unique=True, index=True)
    system_prompt = Column(Text, nullable=True)
    created_at = Column(Text, nullable=False)
    updated_at = Column(Text, nullable=False)


class Database:
    """Database manager with connection pooling and WAL mode."""

    def __init__(self, database_url: str):
        # Convert sqlite:////data/app.db -> proper connect args
        self._engine = create_engine(
            database_url,
            connect_args={
                "check_same_thread": False,
                "timeout": 30,  # busy timeout in seconds
            },
            pool_pre_ping=True,
            echo=False,
        )

        # Enable WAL mode for better concurrent access
        @event.listens_for(self._engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

        self._SessionFactory = sessionmaker(bind=self._engine)

    def create_tables(self):
        """Create all tables if they don't exist."""
        Base.metadata.create_all(self._engine)

    def check_connection(self) -> bool:
        """Verify database connectivity."""
        try:
            with self._engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    @contextmanager
    def session(self) -> Generator[Session, None, None]:
        """Provide a transactional database session."""
        db_session = self._SessionFactory()
        try:
            yield db_session
            db_session.commit()
        except Exception:
            db_session.rollback()
            raise
        finally:
            db_session.close()

    # --- Session operations ---

    def get_session(self, session_id: str) -> Optional[SessionRow]:
        """Retrieve session metadata."""
        with self.session() as s:
            row = s.query(SessionRow).filter(SessionRow.session_id == session_id).first()
            if row:
                # Detach from session
                s.expunge(row)
            return row

    def upsert_session(self, session_id: str, system_prompt: str) -> None:
        """Create or update session metadata."""
        now = datetime.now(timezone.utc).isoformat()
        with self.session() as s:
            existing = s.query(SessionRow).filter(SessionRow.session_id == session_id).first()
            if existing:
                existing.system_prompt = system_prompt
                existing.updated_at = now
            else:
                s.add(SessionRow(
                    session_id=session_id,
                    system_prompt=system_prompt,
                    created_at=now,
                    updated_at=now,
                ))

    # --- Message operations ---

    def get_messages(self, session_id: str) -> List[dict]:
        """Retrieve all messages for a session, oldest first."""
        with self.session() as s:
            rows = (
                s.query(MessageRow)
                .filter(MessageRow.session_id == session_id)
                .order_by(MessageRow.created_at.asc(), MessageRow.id.asc())
                .all()
            )
            result = []
            for row in rows:
                msg = {
                    "role": row.role,
                    "content": row.content,
                }
                if row.role == "assistant" and row.meta:
                    try:
                        msg["metadata"] = json.loads(row.meta)
                    except json.JSONDecodeError:
                        pass
                result.append(msg)
            return result

    def session_exists(self, session_id: str) -> bool:
        """Check if any messages exist for a session."""
        with self.session() as s:
            count = s.query(MessageRow).filter(MessageRow.session_id == session_id).count()
            return count > 0

    def save_exchange(
        self,
        session_id: str,
        user_content: str,
        assistant_content: str,
        assistant_metadata: dict,
        system_prompt: str,
    ) -> None:
        """Atomically save a user message and assistant reply, plus session metadata."""
        now = datetime.now(timezone.utc).isoformat()
        with self.session() as s:
            # Upsert session
            existing_session = s.query(SessionRow).filter(SessionRow.session_id == session_id).first()
            if existing_session:
                existing_session.system_prompt = system_prompt
                existing_session.updated_at = now
            else:
                s.add(SessionRow(
                    session_id=session_id,
                    system_prompt=system_prompt,
                    created_at=now,
                    updated_at=now,
                ))

            # Save user message
            s.add(MessageRow(
                session_id=session_id,
                role="user",
                content=user_content,
                meta=None,
                created_at=now,
            ))

            # Save assistant message with metadata
            s.add(MessageRow(
                session_id=session_id,
                role="assistant",
                content=assistant_content,
                meta=json.dumps(assistant_metadata),
                created_at=now,
            ))
