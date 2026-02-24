# Implementation Plan: AI-Driven Dictation Text Generation

## Phase 1: Research & Setup [checkpoint: 0134089]
- [x] Task: Research and select the most adequate local MLX model for French text generation (balancing memory vs. quality).
- [x] Task: Setup the inference environment (dependencies, model download script).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Research & Setup' (Protocol in workflow.md)

## Phase 2: Core Generation Logic [checkpoint: cc46691]
- [x] Task: Implement the Python inference script for text generation.
    - [x] Write unit tests for the generation prompt and output format.
    - [x] Implement the generation logic with MLX.
- [x] Task: Expose the generation logic via a FastAPI endpoint on the TTS server.
- [~] Task: Conductor - User Manual Verification 'Phase 2: Core Generation Logic' (Protocol in workflow.md)

## Phase 3: Backend & API Integration
- [ ] Task: Add the `/api/generate-dictee` endpoint to `server.js`.
    - [ ] Write integration tests for the proxy endpoint.
    - [ ] Implement the proxy logic to call the Python generation service.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Backend & API Integration' (Protocol in workflow.md)

## Phase 4: Frontend Implementation
- [ ] Task: Add UI elements for triggering AI generation.
    - [ ] Implement the "Générer une dictée" button and loading state.
    - [ ] Bind the UI to the new API endpoint.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Frontend Implementation' (Protocol in workflow.md)
