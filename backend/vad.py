import numpy as np
import torch
import os
from typing import AsyncGenerator

torch.set_num_threads(2)

class SileroVADProcessor:
    def __init__(self, threshold: float = 0.5, min_speech_ms: int = 250, min_silence_ms: int = 500):
        self.threshold = threshold
        self.min_speech_samples = int(16000 * min_speech_ms / 1000)
        self.min_silence_samples = int(16000 * min_silence_ms / 1000)
        self.model = None
        self._load()

    def _load(self):
        from silero_vad import load_silero_vad
        self.model = load_silero_vad()
        self.model.eval()

    def is_speech(self, audio: np.ndarray) -> bool:
        audio_float = audio.astype(np.float32) / 32768.0
        with torch.no_grad():
            speech_prob = self.model(audio_float, 16000).item()
        return speech_prob > self.threshold

    async def detect_speech_stream(
        self, audio_chunks: AsyncGenerator[np.ndarray, None]
    ) -> AsyncGenerator[tuple[np.ndarray, bool], None]:
        buffer = np.array([], dtype=np.int16)
        speech_active = False
        silence_streak = 0

        async for chunk in audio_chunks:
            buffer = np.concatenate([buffer, chunk]) if buffer.size else chunk
            is_speech = self.is_speech(chunk)

            if is_speech:
                speech_active = True
                silence_streak = 0
            elif speech_active:
                silence_streak += len(chunk)

            yield chunk, is_speech or speech_active

            if speech_active and silence_streak >= self.min_silence_samples:
                break

    def get_speech_chunks(self, audio: np.ndarray) -> list[dict]:
        from silero_vad import get_speech_timestamps
        audio_float = audio.astype(np.float32) / 32768.0
        timestamps = get_speech_timestamps(
            audio_float, self.model, threshold=self.threshold,
            min_speech_duration_ms=250, sampling_rate=16000
        )
        return timestamps