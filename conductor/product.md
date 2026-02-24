# Initial Concept
A high-fidelity French "Brevet 2026" exam simulator using local AI (Kokoro TTS via MLX) for natural human-like speech.

# Vision
To provide French 3ème students with a premium, accessible, and distraction-free environment to master the dictation portion of the National Diploma (Brevet). By leveraging local-first AI technology, the tool ensures high-quality pedagogical support without dependency on cloud services or internet connectivity.

# Target Audience
- **3ème Students:** Preparing for the official French exam.
- **Independent Learners:** Looking to improve their French spelling and grammar through structured dictation.

# Key Features
- **AI-Powered Dictation Protocol:** Strictly adheres to the official 3-phase exam format (Lecture, Dictation, Relecture).
- **Human-like Speech:** Utilizes Kokoro-82M (MLX) for natural prosody and pronunciation.
- **Dynamic Content Generation:** Ability to generate new, level-appropriate dictation texts using a local LLM (Qwen2.5-3B) to ensure an infinite supply of practice material.
- **Intelligent Correction:** An automated system that identifies errors and links them directly to relevant French grammar rules for immediate learning.
- **Local Progress Tracking:** Persistent storage of exam history and scores within the user's browser (localStorage) to monitor improvement over time.
- **Premium UI:** A modern, immersive interface designed to reduce stress and improve focus during practice.

# Success Criteria
- **Fidelity:** 100% compliance with the official Brevet protocol.
- **Privacy:** All audio generation and data storage remain strictly local to the user's machine.
- **Pedagogy:** Students can identify recurring error patterns through rule-linked feedback.
