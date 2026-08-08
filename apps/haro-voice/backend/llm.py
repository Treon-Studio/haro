import httpx
import os
from typing import AsyncGenerator

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

FREE_MODELS = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemma-2-9b-it:free",
    "qwen/qwen-2.5-7b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
]

SYSTEM_PROMPT = """Kamu adalah asisten pribadi bernama Ara. Jawab dalam bahasa Indonesia.
Jawaban singkat dan langsung — maksimal 3 kalimat kecuali diminta lebih.
Jika diminta melakukan sesuatu (matikan lampu, buat pengingat, kirim pesan),
konfirmasi dengan singkat bahwa kamu akan melakukannya.
Selalu ramah dan natural seperti asisten rumah tangga yang pintar."""


async def chat_stream(
    messages: list[dict],
    model: str = FREE_MODELS[0],
) -> AsyncGenerator[str, None]:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
    }
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages],
        "stream": True,
        "max_tokens": 300,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("POST", OPENROUTER_URL, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    try:
                        import json
                        delta = json.loads(chunk)
                        token = delta["choices"][0]["delta"].get("content", "")
                        if token:
                            yield token
                    except Exception:
                        continue