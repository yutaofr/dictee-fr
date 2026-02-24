import sys
try:
    from mlx_lm import load, generate
    print("mlx-lm is installed and working.")
    
    # We won't download the full model here as it's large, 
    # but we verify we can import everything.
    MODEL = "mlx-community/Qwen2.5-3B-Instruct-4bit"
    print(f"Ready to use model: {MODEL}")
    
except ImportError as e:
    print(f"Error: {e}")
    sys.exit(1)
