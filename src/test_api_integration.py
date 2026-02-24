from fastapi.testclient import TestClient
import sys
import os

# Import the app from tts_server.py
# We need to mock the model loading if we don't want to actually load them, 
# but here we want to verify the real thing if possible, or at least the logic.
# Since we already verified setup, let's try to test the endpoint logic.

# To avoid loading models twice or during import, we might need to restructure tts_server.py
# But for a quick check, I'll just check if the endpoint is defined.

try:
    from tts_server import app
    client = TestClient(app)

    def test_list_models():
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        models = [m["id"] for m in data["data"]]
        assert "mlx-community/Kokoro-82M-bf16" in models
        assert "mlx-community/Qwen2.5-3B-Instruct-4bit" in models
        print("test_list_models passed")

    # We won't run a full generation test here because it takes time and GPU,
    # but we verified the logic in src/test_generation.py

    if __name__ == "__main__":
        test_list_models()
        
except Exception as e:
    print(f"Error: {e}")
    # If models are being loaded on import, this might take a while
    sys.exit(1)
