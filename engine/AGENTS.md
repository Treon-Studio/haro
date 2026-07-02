# Ara — Personal Assistant Hub

Stack: Python 3.11+ / FastAPI / React 18 + Vite / openWakeWord / MiniMax STT+TTS / OpenRouter LLM

## Dev Commands

```bash
# Run all 3 services with PM2 (dev mode, watch + reload)
./start.sh                         # checks venv + node_modules, then pm2 start
pm2 start ecosystem.config.js      # backend (uvicorn :8000), wakeword, webapp (:3000)

# Or run individually
cd backend && ../venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
cd wake_word_service && ../venv/bin/python main.py
cd webapp && npm run dev            # Vite on :3000

# CI checks (run before pushing)
ruff check .                        # lint (no local config, uses defaults)
mypy .                              # type-check (no local config)
cd webapp && npm run build          # webapp build check
```

## Architecture

```
Mic → openWakeWord (offline, "hey_mycroft") → FastAPI /trigger
  → MiniMax STT → OpenRouter LLM → MiniMax TTS (streaming MP3)
    → WebSocket → React webapp
```

- **3 PM2 processes**: `assistant-backend`, `assistant-wakeword`, `assistant-webapp`
- WebSocket (`/ws`) carries JSON events: `user_text`, `assistant_text`, `audio_chunk` (base64), state changes
- Broadcast endpoint at `/trigger` receives raw PCM from wake word service
- Backend uses `venv/` at repo root (shared across all Python services)

## Key Conventions

- **Language**: Indonesian — UI labels, LLM system prompt, agent keywords, agent responses
- **Config files**: `config/models.yml` (LLM/STT/TTS/wake_word), `config/agents.yml` (agent routing)
- **Agent routing**: `backend/agent_router.py` detects intent by Indonesian keyword regex, routes to SmartHomeAgent, CalendarAgent, GeneralAgent
- **LLM default**: `meta-llama/llama-3.1-8b-instruct:free` via OpenRouter (free tier)
- **Conversation history**: max 10 turns in pipeline.py
- **Assistant name**: "Ara"
- **Wake word model**: `hey_mycroft_v0.1.onnx` (included in repo)

## Notable Gaps

- No root `.gitignore` — `venv/` and `node_modules/` are not ignored
- `Dockerfile.backend` and `Dockerfile.wakeword` referenced by `docker-compose.yml` but do not exist
- No lint/typecheck config files (ruff/mypy run with defaults in CI)
- CI workflows are in `workflows/` (not `.github/workflows/`)
- No tests exist in the repo yet

## API Keys (env)

- `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` — required for STT/TTS
- `OPENROUTER_API_KEY` — required for LLM
- `HOME_ASSISTANT_URL` / `HOME_ASSISTANT_TOKEN` — optional, only for smart home agent
