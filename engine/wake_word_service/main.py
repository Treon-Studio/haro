import asyncio
import httpx
import numpy as np
from audio_stream import mic_stream, SAMPLE_RATE, CHUNK_SIZE
from detector import WakeWordDetector

BACKEND_TRIGGER_URL = "http://localhost:8000/trigger"
MAX_RECORD_SECONDS = 10
SILENCE_THRESHOLD = 500
SILENCE_CHUNKS = 12


def rms(chunk: np.ndarray) -> float:
    return float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2)))


async def run():
    detector = WakeWordDetector()
    print("[wake_word_service] Listening for wake word...")

    for chunk in mic_stream():
        if detector.predict(chunk):
            print("[wake_word_service] Wake word detected! Recording utterance...")
            audio_frames = []
            silence_count = 0
            max_chunks = int(MAX_RECORD_SECONDS * SAMPLE_RATE / CHUNK_SIZE)

            for utterance_chunk in mic_stream():
                audio_frames.append(utterance_chunk)
                if rms(utterance_chunk) < SILENCE_THRESHOLD:
                    silence_count += 1
                else:
                    silence_count = 0
                if silence_count >= SILENCE_CHUNKS or len(audio_frames) >= max_chunks:
                    break

            audio_bytes = np.concatenate(audio_frames).tobytes()
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    BACKEND_TRIGGER_URL,
                    content=audio_bytes,
                    headers={"Content-Type": "application/octet-stream"},
                    timeout=30,
                )
                print(f"[wake_word_service] Sent to backend: {resp.status_code}")


if __name__ == "__main__":
    asyncio.run(run())