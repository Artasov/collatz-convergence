# Collatz Convergence Explorer

Interactive project for exploring the `3n + 1` (Collatz) conjecture with a FastAPI backend and a React + Vite frontend.

## What is this project

`Collatz Convergence Explorer` computes Collatz trajectories and shows them in several chart types:

- `XY line`: one point per start value `n`, metric is either `steps to 1` or `peak value`.
- `Transition network (hairball)`: dense directed graph of transitions `n -> f(n)`.
- `Convergence tree (2D)`: reverse layered tree from root `1`.
- `3D coral tree`: 3D reverse tree projection for spatial exploration.
- `Single number trace`: full path for one chosen start value.

The goal is to make behavior, scale, and structure of trajectories easier to inspect visually.

## Collatz conjecture (short)

For positive integer `n`:

- if `n` is even: next value is `n / 2`
- if `n` is odd: next value is `3n + 1`

The conjecture states that every positive starting value eventually reaches the cycle `4 -> 2 -> 1`.

## Why this topic is interesting

- Very simple rule, highly non-trivial global behavior.
- Strong mix of number theory, graph structure, and computation.
- Easy to experiment with, hard to prove in full generality.

## Useful references

- Wikipedia: https://en.wikipedia.org/wiki/Collatz_conjecture
- MathWorld: https://mathworld.wolfram.com/CollatzProblem.html
- OEIS (Collatz-related sequences): https://oeis.org/wiki/Collatz_conjecture
- Numberphile video intro: https://www.youtube.com/watch?v=094y1Z2wpJg

## Architecture

Project structure:

- `backend`: FastAPI, domain/services/repositories, PostgreSQL persistence
- `frontend`: React + Vite + MUI charts and interaction UI

Backend layers:

- `api`: routes and request/response contracts
- `services`: orchestration and use-cases
- `domain`: generation logic and chart builders
- `infrastructure`: PostgreSQL models/repository
- `core`: app settings

## API endpoints

- `POST /api/generate?limit=...&persist=true|false`
- `GET /api/charts/xy?limit=...&metric=steps|max_value&source=auto|fresh|cache`
- `GET /api/charts/network?limit=...&source=auto|fresh|cache`
- `GET /api/charts/tree?layers=...&source=auto|fresh|cache`
- `GET /api/path?start_n=...`
- `GET /api/health`

## Data storage

PostgreSQL schema: `collatz`

- `collatz.generations`: generation metadata per limit
- `collatz.sequences`: trajectories per start value (`steps`, `max_value`, `path`)
- `collatz.edges`: aggregated transition graph (`source`, `target`, `weight`)

## Local run

### Backend

```bash
cd backend
poetry install
# set DATABASE_URL in backend/.env
poetry run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

If API host differs from default:

```bash
set VITE_API_BASE=http://your-host:port
```
