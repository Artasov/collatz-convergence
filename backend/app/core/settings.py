from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    database_url: str = Field(
        default='postgresql+psycopg://postgres:adminadmin@localhost:5432/lothar_collatz',
        validation_alias='DATABASE_URL',
    )
    api_cors_origins: str = Field(
        default='http://localhost:5173',
        validation_alias='API_CORS_ORIGINS',
    )

    model_config = SettingsConfigDict(
        extra='ignore',
        env_file='.env',
        env_file_encoding='utf-8',
        populate_by_name=True,
    )

    @property
    def cors_origins(self) -> tuple[str, ...]:
        origins = tuple(item.strip() for item in self.api_cors_origins.split(',') if item.strip())
        if origins:
            return origins
        return ('http://localhost:5173',)


class AppSettingsFactory:
    @staticmethod
    def build() -> AppSettings:
        return AppSettings()
