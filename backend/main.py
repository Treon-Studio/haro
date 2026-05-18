import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from ws_manager import WebSocketManager
from pipeline import run_pipeline

ws_manager = WebSocketManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Assistant Hub Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/trigger")
async def trigger(request: Request):
    audio_bytes = await request.body()
    asyncio.create_task(run_pipeline(audio_bytes, ws_manager))
    return {"status": "processing"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            import json
            msg = json.loads(data)
            if msg.get("event") == "tap_trigger":
                import base64
                audio_bytes = base64.b64decode(msg["audio"])
                asyncio.create_task(run_pipeline(audio_bytes, ws_manager))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@app.get("/health")
async def health():
    return {"status": "ok"}