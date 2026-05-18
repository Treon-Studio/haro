import httpx
import json
import os
from typing import AsyncGenerator

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
MINIMAX_GROUP_ID = os.getenv("MINIMAX_GROUP_ID")

TTS_URL = f"https://api.minimax.io/v1/t2a_v2?GroupId={MINIMAX_GROUP_ID}"

HEADERS = {
    "Authorization": f"Bearer {MINIMAX_API_KEY}",
    "Content-Type": "application/json",
}

DEFAULT_VOICE = "Calm_Woman"


async def synthesize_stream(text: str, voice_id: str = DEFAULT_VOICE) -> AsyncGenerator[bytes, None]:
    payload = {
        "model": "speech-2.6-turbo",
        "text": text,
        "stream": True,
        "stream_options": {
            "exclude_aggregated_audio": True,
        },
        "voice_setting": {
            "voice_id": voice_id,
            "speed": 1.0,
            "vol": 1.0,
            "pitch": 0,
            "emotion": "neutral",
        },
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("POST", TTS_URL, json=payload, headers=HEADERS) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw or raw == "[DONE]":
                    continue
                try:
                    chunk_data = json.loads(raw)
                    hex_audio = chunk_data.get("data", {}).get("audio", "")
                    status = chunk_data.get("data", {}).get("status")
                    if hex_audio:
                        yield bytes.fromhex(hex_audio)
                    if status == 2:
                        break
                except Exception:
                    continue


async def synthesize_full(text: str, voice_id: str = DEFAULT_VOICE) -> bytes:
    chunks = []
    async for chunk in synthesize_stream(text, voice_id):
        chunks.append(chunk)
    return b"".join(chunks)