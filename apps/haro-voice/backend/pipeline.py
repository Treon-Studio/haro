import asyncio
import base64
from ws_manager import WebSocketManager
from stt import transcribe
from tts import synthesize_stream
from agent_router import AgentRouter

router = AgentRouter()

conversation_history: list[dict] = []
MAX_HISTORY = 10


async def run_pipeline(audio_bytes: bytes, ws_manager: WebSocketManager):
    global conversation_history

    await ws_manager.broadcast("state", {"state": "thinking"})

    try:
        user_text = await transcribe(audio_bytes)
        print(f"[pipeline] STT: {user_text}")
    except Exception as e:
        await ws_manager.broadcast("error", {"message": f"STT error: {e}"})
        await ws_manager.broadcast("state", {"state": "idle"})
        return

    if not user_text.strip():
        await ws_manager.broadcast("state", {"state": "idle"})
        return

    await ws_manager.broadcast("user_text", {"text": user_text})

    try:
        result = await router.route(user_text, conversation_history)
        response_text = result["text"]
        agent_name = result["agent"]
    except Exception as e:
        await ws_manager.broadcast("error", {"message": f"LLM error: {e}"})
        await ws_manager.broadcast("state", {"state": "idle"})
        return

    conversation_history.append({"role": "user", "content": user_text})
    conversation_history.append({"role": "assistant", "content": response_text})
    if len(conversation_history) > MAX_HISTORY * 2:
        conversation_history = conversation_history[-MAX_HISTORY * 2:]

    await ws_manager.broadcast("state", {"state": "speaking", "agent": agent_name})
    await ws_manager.broadcast("assistant_text", {"text": response_text})

    try:
        async for audio_chunk in synthesize_stream(response_text):
            audio_b64 = base64.b64encode(audio_chunk).decode()
            await ws_manager.broadcast("audio_chunk", {"data": audio_b64})
    except Exception as e:
        print(f"[pipeline] TTS error: {e}")

    await ws_manager.broadcast("audio_end", {})
    await ws_manager.broadcast("state", {"state": "idle"})