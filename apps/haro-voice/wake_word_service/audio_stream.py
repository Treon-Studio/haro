import pyaudio
import numpy as np
from typing import Generator

SAMPLE_RATE = 16000
CHUNK_SIZE = 1280
FORMAT = pyaudio.paInt16
CHANNELS = 1


def mic_stream() -> Generator[np.ndarray, None, None]:
    p = pyaudio.PyAudio()
    stream = p.open(
        rate=SAMPLE_RATE,
        channels=CHANNELS,
        format=FORMAT,
        input=True,
        frames_per_buffer=CHUNK_SIZE,
    )
    try:
        while True:
            raw = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            yield np.frombuffer(raw, dtype=np.int16)
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()