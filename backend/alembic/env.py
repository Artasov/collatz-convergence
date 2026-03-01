from __future__ import annotations

from logging.config import fileConfig
from os import getenv
from pathlib import Path
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.infrastructure.db.base import Base  # noqa: E402
from app.infrastructure.db import models as models  # noqa: E402,F401

config = context.config
database_url = getenv(
    'DATABASE_URL',
    'postgresql+psycopg://postgres:adminadmin@localhost:5432/lothar_collatz',
)
config.set_main_option('sqlalchemy.url', database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_name(name: str | None, type_: str, parent_names: dict[str, str]) -> bool:
    del parent_names
    if type_ == 'schema':
        return name in (None, 'collatz')
    return True


def get_configure_kwargs() -> dict[str, object]:
    return {
        'target_metadata': target_metadata,
        'include_schemas': True,
        'version_table_schema': 'collatz',
        'compare_type': True,
        'compare_server_default': True,
        'include_name': include_name,
    }


def run_migrations_offline() -> None:
    url = config.get_main_option('sqlalchemy.url')
    configure_kwargs = get_configure_kwargs()
    context.configure(
        url=url,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
        **configure_kwargs,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        configure_kwargs = get_configure_kwargs()
        context.configure(
            connection=connection,
            **configure_kwargs,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
