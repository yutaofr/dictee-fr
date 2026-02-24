# Specification: AI-Driven Dictation Text Generation

## Objective
Enable the application to dynamically generate French dictation texts suitable for the "Brevet" level (3ème) using a local MLX-optimized language model.

## Requirements
- **Local Execution:** Generation must run locally on Apple Silicon via MLX.
- **Language Quality:** Generated text must be grammatically correct and stylistically appropriate for a French 14-15 year old student.
- **Pedagogical Alignment:** Texts should focus on common "Brevet" themes (memory, childhood, society, etc.) and include targeted grammatical difficulties (accords, conjugaisons).
- **Efficiency:** The model should balance quality with memory usage, ensuring it can run alongside the Kokoro TTS server.
- **Integration:** A new API endpoint `/api/generate-dictee` in `server.js` that triggers the generation.

## Technical Approach
1. **Model Selection:** Identify the best small-to-medium French-capable LLM compatible with MLX (e.g., Mistral-7B, Qwen2.5, or similar 4-bit quantized versions).
2. **Prompt Engineering:** Develop robust system prompts to enforce the "Brevet" style and constraints.
3. **Backend Service:** Add a generation service to the existing Python FastAPI server or create a lightweight companion service.
4. **Frontend Integration:** Add a "Générer une dictée" button in the UI.
