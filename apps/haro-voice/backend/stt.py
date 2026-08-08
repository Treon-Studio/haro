import httpx
import asyncio
import os
import struct

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
MINIMAX_GROUP_ID = os.getenv("MINIMAX_GROUP_ID")

BASE_URL = "https://api.minimax.io/v1"
HEADERS = {
    "Authorization": f"Bearer {MINIMAX_API_KEY}",
}


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(pcm_bytes)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, num_channels, sample_rate,
        byte_rate, block_align, bits_per_sample,
        b"data", data_size,
    )
    return header + pcm_bytes


def _extract_text(data: dict) -> str:
    if "results" in data:
        results = data["results"]
        if isinstance(results, list) and results:
            return results[0].get("transcript", "")
    if "alternatives" in data:
        alts = data["alternatives"]
        if isinstance(alts, list) and alts:
            return alts[0].get("transcript", "")
    if "text" in data:
        return data["text"]
    return ""


async def transcribe(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    wav_bytes = _pcm_to_wav(audio_bytes, sample_rate)

    async with httpx.AsyncClient(timeout=60) as client:
        create_resp = await client.post(
            f"{BASE_URL}/stt/create?GroupId={MINIMAX_GROUP_ID}",
            headers=HEADERS,
            files={"audio": ("audio.wav", wav_bytes, "audio/wav")},
            data={"model": "speech-2.6", "language": "id"},
        )
        create_resp.raise_for_status()
        create_data = create_resp.json()

        if create_data.get("base_resp", {}).get("status_code") != 0:
            raise Exception(f"STT create error: {create_data}")

        generation_id = create_data.get("id") or create_data.get("generation_id")
        if not generation_id:
            raise Exception(f"No generation_id in STT response: {create_data}")

        for attempt in range(30):
            await asyncio.sleep(1)
            status_resp = await client.get(
                f"{BASE_URL}/stt/{generation_id}?GroupId={MINIMAX_GROUP_ID}",
                headers=HEADERS,
            )
            status_resp.raise_for_status()
            status_data = status_resp.json()
            status = status_data.get("status", "")

            if status == "succeeded" or status == "Success":
                text = (
                    status_data.get("text")
                    or status_data.get("transcript")
                    or _extract_text(status_data)
                    or ""
                )
                return text.strip()
            elif status in ("failed", "error", "Failed"):
                raise Exception(f"STT job failed: {status_data}")

        raise Exception("STT timeout: job tidak selesai dalam 30 detik")