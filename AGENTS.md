# Repository Guidelines

## Project Structure & Module Organization
This project is a single-repo web app with a local TTS backend:
- `index.html`, `style.css`, `app.js`: frontend UI and dictation flow.
- `dictees.js`: dictation content and metadata.
- `server.js`: Node.js API/static server (`/api/tts`, `/api/tts/batch`, `/api/health`).
- `tts_server.py`, `tts_server.sh`: native macOS FastAPI TTS service (Apple Silicon/Metal).
- `docker-compose.yml`, `Dockerfile`: containerized web runtime.
- `README.md`, `TECHNICAL_SPEC.md`: product and architecture docs.

## Build, Test, and Development Commands
- `./tts_server.sh`: start local Python TTS server on `:8000` (required for MLX voice).
- `docker-compose up --build`: run the web app in Docker at `http://localhost:8081`.
- `npm start`: run `server.js` directly (no Docker) for backend debugging.
- `docker-compose down`: stop containers.

Run TTS server first, then web app, to avoid fallback to browser speech synthesis.

## Coding Style & Naming Conventions
- JavaScript uses ES modules and mostly 4-space indentation; keep existing formatting when editing.
- Python follows 4-space indentation and PEP 8-style naming.
- Use `camelCase` for JS variables/functions, `UPPER_SNAKE_CASE` for constants, and descriptive IDs/classes in HTML/CSS.
- Keep comments purposeful (phase logic, protocol constraints, hardware assumptions).

No lint/formatter config is committed yet; keep diffs small and consistent with neighboring code.

## Testing Guidelines
There is no automated test suite yet. Validate changes manually:
1. `GET /api/health` returns `status: "ok"` and expected TTS reachability.
2. Full dictation flow works (lecture, phrase-by-phrase dictée, relecture).
3. Correction and pronunciation tabs still function after UI/logic edits.

When adding tests, place them in a new `tests/` directory and name files by feature (example: `server.tts.test.js`).

## Commit & Pull Request Guidelines
Recent history uses concise, prefixed messages (for example `Docs: ...`, `Fix: ...`). Follow:
- Commit format: `<Type>: <short imperative summary>`.
- Keep commits focused (one logical change per commit).
- PRs should include: purpose, key changes, manual validation steps, linked issue, and screenshots for UI updates.

## Security & Configuration Notes
- Do not commit secrets or local machine paths.
- Keep `TTS_SERVER_URL` environment-driven; default is `http://host.docker.internal:8000` for Docker-to-host bridging.
- Preserve the official 3-phase dictation protocol behavior when modifying `app.js`.
