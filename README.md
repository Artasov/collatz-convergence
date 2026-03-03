# Collatz Convergence Explorer

Client-side project for exploring the `3n + 1` (Collatz) conjecture with `React + TypeScript + Vite + MUI`.

## What it does

`Collatz Convergence Explorer` computes trajectories directly in the browser and visualizes them in multiple chart
types:

- `XY line`
- `Transition network`
- `Convergence tree (2D)`
- `3D tree`
- `3D flow arcs`
- `Single number trace`

The UI and chart behavior stay the same, but no backend is required.

## Serverless mode

- All calculations run in the client in real time.
- Heavy computed artifacts are cached in browser `IndexedDB`.
- Cache info (size + entry count) and cache cleanup are available from the control panel.

## Collatz conjecture (short)

For positive integer `n`:

- if `n` is even: next value is `n / 2`
- if `n` is odd: next value is `3n + 1`

The conjecture states that every positive starting value eventually reaches the cycle `4 -> 2 -> 1`.

## Useful references

- Wikipedia: https://en.wikipedia.org/wiki/Collatz_conjecture
- MathWorld: https://mathworld.wolfram.com/CollatzProblem.html
- OEIS: https://oeis.org/wiki/Collatz_conjecture

## Local run

```bash
cd frontend
npm install
npm run dev
```
