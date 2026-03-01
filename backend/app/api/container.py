from __future__ import annotations

from ..core.settings import AppSettings, AppSettingsFactory
from ..services.lothar_collatz_service import LotharCollatzService
from ..domain.lothar_collatz import LotharCollatzGenerator
from ..infrastructure.db.session import SqlAlchemySessionFactory
from ..infrastructure.repositories.postgres_lothar_collatz_repository import (
    PostgresLotharCollatzRepository,
)


class ApiContainer:
    _settings: AppSettings | None = None
    _session_factory: SqlAlchemySessionFactory | None = None
    _repository: PostgresLotharCollatzRepository | None = None
    _generator: LotharCollatzGenerator | None = None
    _service: LotharCollatzService | None = None

    @classmethod
    def settings(cls) -> AppSettings:
        if cls._settings is None:
            cls._settings = AppSettingsFactory.build()
        return cls._settings

    @classmethod
    def lothar_collatz_service(cls) -> LotharCollatzService:
        if cls._session_factory is None:
            cls._session_factory = SqlAlchemySessionFactory(cls.settings().database_url)
        if cls._repository is None:
            cls._repository = PostgresLotharCollatzRepository(cls._session_factory)
        if cls._generator is None:
            cls._generator = LotharCollatzGenerator()
        if cls._service is None:
            cls._service = LotharCollatzService(
                generator=cls._generator,
                repository=cls._repository,
            )
        return cls._service
