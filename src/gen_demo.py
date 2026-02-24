from mlx_lm import load, generate

MODEL = "mlx-community/Qwen2.5-3B-Instruct-4bit"
print(f"Loading model: {MODEL}...")
model, tokenizer = load(MODEL)

prompt = "Écris une phrase courte pour une dictée de niveau 3ème sur le thème de la nature."
messages = [{"role": "user", "content": prompt}]
text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

print("Generating...")
response = generate(model, tokenizer, prompt=text, verbose=True, max_tokens=50)
print("\nGenerated Text:")
print(response)
