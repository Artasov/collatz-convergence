# LotharCollatz (3n + 1) Visualizer

Проект разделен на `backend` и `frontend`.

## Backend архитектура (слоистая DDD)

- `api`: HTTP-роуты и pydantic-схемы.
- `services`: сервисный слой (оркестрация сценариев).
- `dto`: pydantic DTO для ответов API.
- `domain`: доменные модели, генератор LotharCollatz, билдеры графиков, интерфейсы репозиториев.
- `infrastructure`: Postgres-репозиторий и детали хранения.
- `core`: настройки приложения.

Текущие эндпоинты:
- `POST /api/generate?limit=...&persist=true|false`
- `GET /api/charts/xy?limit=...&metric=steps|max_value&source=auto|fresh|cache`
- `GET /api/charts/tree?limit=...&source=auto|fresh|cache`
- `GET /api/health`

## Хранение данных

Используется PostgreSQL.

Схема: `collatz`
- `collatz.generations`: метаданные генерации по `limit`.
- `collatz.sequences`: значения по каждому старту (`start_n`, `steps`, `max_value`, `path`).
- `collatz.edges`: агрегированный граф переходов (`source_value`, `target_value`, `weight`).

Важно:
- API не создает таблицы и схему при старте.
- Структуру БД нужно поддерживать миграциями (Alembic) или вручную SQL-скриптами.
- Репозиторий ожидает, что схема `collatz` и таблицы уже существуют.

## Запуск

### Backend

```bash
cd backend
poetry install
set DATABASE_URL=postgresql+psycopg://postgres:adminadmin@localhost:5432/lothar_collatz
poetry run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Если API не на `http://localhost:8000`, укажи:

```bash
set VITE_API_BASE=http://your-host:port
```

## Alembic

Инициализация уже добавлена в `backend` (`backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/`).

Пример команд:

```bash
alembic revision -m 'create collatz schema'
alembic upgrade head
```

Файлы ревизий в `backend/alembic/versions` ты ведешь вручную.
