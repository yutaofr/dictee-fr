# Technology Stack

## Frontend
- **Language:** JavaScript (ES Modules / ES2022+).
- **Styling:** Vanilla CSS3 (Modular/Scoped via main.css).
- **Structure:** HTML5 (Single Page Application architecture).
- **Key APIs:** Web Audio API, LocalStorage.

## Backend (Proxy & Static Server)
- **Runtime:** Node.js.
- **Framework:** Express.
- **Responsibilities:** 
  - Serving static frontend assets.
  - Proxying TTS requests to the native Python server.
  - MD5-based audio caching.

## TTS Engine (AI Speech)
- **Language:** Python 3.10+.
- **Framework:** FastAPI.
- **AI Model:** Kokoro-82M (v0.19) via MLX.
- **Hardware Acceleration:** Metal (MPS) on Apple Silicon.

## Infrastructure & Tooling
- **Containerization:** Docker & Docker Compose (Web App & Node Server).
- **Orchestration:** Shell scripts (`dev_stack.sh`, `tts_server.sh`) for hybrid native/containerized execution.
- **Testing:** Vitest (Unit & Integration).
- **Package Management:** npm.
