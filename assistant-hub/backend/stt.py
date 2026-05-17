import httpx
import os
import base64

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
STT_URL = "https://api.minimaxi.com/v1/speech_to_text"


async def transcribe(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    audio_b64 = base64.b64encode(audio_bytes).decode()

    payload = {
        "model": "speech-02-hd",
        "audio": audio_b64,
        "format": "pcm",
        "sample_rate": sample_rate,
        "language": "Indonesian",
    }
    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(STT_URL, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("text", "")