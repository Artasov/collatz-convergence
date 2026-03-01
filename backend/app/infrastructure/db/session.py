from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


class SqlAlchemySessionFactory:
    def __init__(self, dsn: str) -> None:
        self.engine = create_engine(dsn, pool_pre_ping=True)
        self._session_maker = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )

    def create_session(self) -> Session:
        return self._session_maker()
