# Implementation Plan: AI-Driven Dictation Text Generation

## Phase 1: Research & Setup
- [ ] Task: Research and select the most adequate local MLX model for French text generation (balancing memory vs. quality).
- [ ] Task: Setup the inference environment (dependencies, model download script).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Research & Setup' (Protocol in workflow.md)

## Phase 2: Core Generation Logic
- [ ] Task: Implement the Python inference script for text generation.
    - [ ] Write unit tests for the generation prompt and output format.
    - [ ] Implement the generation logic with MLX.
- [ ] Task: Expose the generation logic via a FastAPI endpoint on the TTS server.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Generation Logic' (Protocol in workflow.md)

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
