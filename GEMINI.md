# GEMINI.md — Project Context & Instructions

## 🎙️ Project Overview
**Dictée Brevet 2026** is a high-fidelity exam simulator designed for French 3ème students. It uses a local AI engine (**Kokoro TTS via MLX**) to provide natural human-like speech while strictly adhering to the official French "Diplôme National du Brevet" protocol.

### Key Technologies
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Modular ES Modules).
- **Backend:** Node.js (Express) acting as a caching proxy and static file server.
- **Testing:** Vitest (Unit testing for core logic).
- **TTS Engine:** Python (FastAPI) + `mlx-audio` (Kokoro-82M-bf16 model).
- **Infrastructure:** Docker (for web app) and native host execution (for Metal GPU access).

---

## 🏗️ Architecture & System Invariants

### 1. Hybrid Execution Model
- **Web App (Docker):** Runs the Node.js server and serves the frontend. Accessible at `http://localhost:8081`.
- **TTS Server (Native):** **MUST** run natively on the host Mac to access the Apple Silicon Metal GPU (MPS). Docker cannot access these hardware shaders.
- **Networking:** The Docker container reaches the TTS server via `http://host.docker.internal:8000`.

### 2. Official Dictation Protocol (Brevet 2026)
The application logic in `src/exam-flow.js` (**runDictee**) MUST preserve this structure:
1.  **Phase 1 (Lecture intégrale):** Full text read once at 1.0x speed.
2.  **Phase 2 (Dictée effective):** 
    - Text split into sentences using regex: `/(?<=[.!?])\s+/`.
    - Each sentence is read **twice** with punctuation announced (e.g., "virgule", "point").
    - Hardcoded pauses: 2.5s after 1st read, 3.5s after 2nd read.
3.  **Phase 3 (Relecture):** Full text read once more at 1.0x speed without punctuation announcements.

---

## 🚀 Building and Running

### Full Stack Orchestration
The recommended way to start/stop the project is using the orchestrator:
```bash
./dev_stack.sh start docker   # Starts Native TTS + Docker Web (Port 8081)
./dev_stack.sh start npm      # Starts Native TTS + Local Node (Port 3001)
./dev_stack.sh stop           # Stops all services
```

### Manual Commands
- **TTS Server (Native):**
  ```bash
  chmod +x tts_server.sh
  ./tts_server.sh
  ```
- **Web App (Docker):**
  ```bash
  docker-compose up --build
  ```

---

## 📂 Key File Map
- `src/main.js`: Main entry point and application bootstrapper.
- `src/exam-flow.js`: Dictation state machine and Brevet protocol logic.
- `src/ui.js`: DOM manipulation, event bindings, and navigation.
- `src/tts.js`: Audio fetching, caching, and playback logic.
- `src/correction.js`: Diff scoring and grammar rule rendering.
- `src/state.js`: Centralized application state.
- `server.js`: Node.js proxy with MD5-based audio caching and dictation API.
- `tts_server.py`: FastAPI bridge for the MLX model (Kokoro).
- `dictees.js`: Data store for dictation texts (exported as ES module).
- `TECHNICAL_SPEC.md`: Detailed architectural and protocol documentation.
- `AGENTS.md`: Specific instructions for AI coding agents.

---

## 🛠️ Development Conventions
- **Language:** UI and dictation content are in **French**.
- **Indentation:** 4 spaces for both JavaScript and Python.
- **Code Style:** ES Modules (`import/export`) in Node.js.
- **UI Design:** Maintains a "Modern Premium" look with deep blue gradients and blurred backgrounds.
- **Testing:** Currently manual. Verify the 3-phase flow and check `GET /api/health` for service connectivity.

---

## ⚠️ Safety & Constraints
- **Metal GPU:** Never attempt to move `tts_server.py` into Docker; it will lose GPU acceleration and become unusable for real-time dictation.
- **Secrets:** Do not commit API keys or personal paths.
- **Protocol:** Any changes to `app.js` must respect the "phrase par phrase" splitting logic to remain compliant with the official exam format.
