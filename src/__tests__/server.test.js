import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('API Endpoints', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('POST /api/generate-dictee', () => {
        it('should return a generated dictation text from the TTS server', async () => {
            // Mock the fetch call to the Python TTS server
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ text: 'Ceci est une dictée générée par IA.' })
            });
            global.fetch = mockFetch;

            const response = await request(app)
                .post('/api/generate-dictee')
                .send({ theme: 'la nature' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ text: 'Ceci est une dictée générée par IA.' });
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should return 400 if theme is missing or invalid', async () => {
            const response = await request(app)
                .post('/api/generate-dictee')
                .send({ theme: 123 });

            expect(response.status).toBe(400);
        });
    });
});
