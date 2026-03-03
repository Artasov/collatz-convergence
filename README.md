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
- `docs/er-diagram.md`: ER diagram for PostgreSQL schema `collatz`

## Database ER diagram

- File: `docs/er-diagram.md`
- Covers tables:
  - `collatz.generations`
  - `collatz.sequences`
  - `collatz.edges`

## Docker Compose (one command)

- Copy example env:

```bash
cp .env.example .env
```

- Start all services (`db + backend + frontend`):

```bash
docker compose up --build
```

- URLs:
  - Frontend: `http://localhost:5173`
  - Backend API: `http://localhost:8000`
  - Swagger: `http://localhost:8000/docs`

- Note: backend container runs `alembic upgrade head` automatically before `uvicorn` start.

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
