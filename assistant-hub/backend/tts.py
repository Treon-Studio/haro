import httpx
import os
from typing import AsyncGenerator

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
TTS_URL = "https://api.minimaxi.com/v1/t2a_v2"


async def synthesize_stream(text: str, voice_id: str = "Chinese (Mandarin)_Nannan-Ziqiao") -> AsyncGenerator[bytes, None]:
    payload = {
        "model": "speech-2.8-turbo",
        "text": text,
        "stream": True,
        "voice_setting": {
            "voice_id": voice_id,
            "speed": 1.0,
            "vol": 1.0,
            "pitch": 0,
        },
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
        },
    }
    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("POST", TTS_URL, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    chunk_str = line[6:]
                    if chunk_str == "[DONE]":
                        break
                    try:
                        import json
                        chunk = json.loads(chunk_str)
                        audio_hex = chunk.get("data", {}).get("audio")
                        if audio_hex:
                            yield bytes.fromhex(audio_hex)
                        status = chunk.get("data", {}).get("status")
                        if status == 2:
                            break
                    except Exception:
                        continue


async def synthesize_full(text: str, voice_id: str = "Chinese (Mandarin)_Nannan-Ziqiao") -> bytes:
    chunks = []
    async for chunk in synthesize_stream(text, voice_id):
        chunks.append(chunk)
    return b"".join(chunks)