from .base_agent import BaseAgent
from llm import chat_stream


class GeneralAgent(BaseAgent):
    async def handle(self, text: str, history: list[dict]) -> dict:
        messages = history + [{"role": "user", "content": text}]
        response_text = ""
        async for token in chat_stream(messages):
            response_text += token
        return {
            "text": response_text,
            "action": None,
            "agent": "general",
        }

    async def stream_handle(self, text: str, history: list[dict]):
        messages = history + [{"role": "user", "content": text}]
        async for token in chat_stream(messages):
            yield token