import openwakeword
from openwakeword.model import Model
import numpy as np

WAKE_WORD_MODEL = "hey_mycroft"
THRESHOLD = 0.5


class WakeWordDetector:
    def __init__(self, model_name: str = WAKE_WORD_MODEL, threshold: float = THRESHOLD):
        self.threshold = threshold
        self.model = Model(
            wakeword_models=[model_name],
            inference_framework="onnx",
        )

    def predict(self, audio_chunk: np.ndarray) -> bool:
        prediction = self.model.predict(audio_chunk)
        scores = list(prediction.values())
        return any(score > self.threshold for score in scores)