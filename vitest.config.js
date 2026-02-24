// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // jsdom provides a browser-like environment (window, document, etc.)
        // so imports that reference browser APIs don't crash at module load time.
        environment: 'jsdom',
        // Only run files in src/__tests__/
        include: ['src/__tests__/**/*.test.js'],
    },
});
