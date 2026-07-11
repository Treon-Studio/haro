# Ubuntu Phone Personal Assistant Hub

Stack: openWakeWord + MiniMax STT/TTS + OpenRouter LLM + FastAPI + React

## Architecture

```
Mic (always on)
  → openWakeWord (offline, local Python service)
    → [trigger] → FastAPI backend
      → MiniMax STT (audio → text)
      → OpenRouter LLM (text → response)
      → MiniMax TTS (response → audio stream)
        → WebSocket → React webapp (display + play audio)
```

## Prerequisites

- OS: Ubuntu 22.04+ (or Ubuntu Touch on phone)
- Python: 3.11+, Node.js: 20+
- RAM: 2GB minimum, 4GB recommended
- Mic and speaker

## Quick Start

### 1. Install system dependencies

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip \
  portaudio19-dev libportaudio2 ffmpeg \
  nodejs npm curl git
```

### 2. Configure API keys

```bash
cp .env.example .env
# Edit .env with your API keys:
# - OPENROUTER_API_KEY from openrouter.ai
# - MINIMAX_API_KEY and MINIMAX_GROUP_ID from minimaxi.com
```

### 3. Install Python dependencies

```bash
cd assistant-hub
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Run services

**Backend:**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Wake word service:**
```bash
cd wake_word_service
python main.py
```

**Webapp:**
```bash
cd webapp
npm install
npm run dev
# Open http://localhost:3000
```

### 5. Kiosk mode (always-on display)

```bash
sudo apt install -y chromium-browser

chromium-browser \
  --kiosk \
  --app=http://localhost:3000 \
  --disable-infobars \
  --no-first-run \
  --disable-translate \
  --autoplay-policy=no-user-gesture-required
```

## Remote Access via Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4

# Access from anywhere:
# http://<tailscale-ip>:3000
```

## Project Structure

```
assistant-hub/
├── .env                          # API keys (never commit)
├── .env.example                  # Template
├── docker-compose.yml
├── requirements.txt
├── wake_word_service/
│   ├── main.py
│   ├── detector.py
│   └── audio_stream.py
├── backend/
│   ├── main.py
│   ├── ws_manager.py
│   ├── pipeline.py
│   ├── stt.py, tts.py, llm.py
│   └── agents/
├── webapp/
│   ├── package.json
│   └── src/
└── config/
    ├── agents.yml
    └── models.yml
```

## Testing Checklist

```bash
# 1. Test mic capture
python -c "
import pyaudio, numpy as np
p = pyaudio.PyAudio()
s = p.open(rate=16000, channels=1, format=pyaudio.paInt16, input=True, frames_per_buffer=1280)
chunk = np.frombuffer(s.read(1280), dtype=np.int16)
print('Mic OK, RMS:', np.sqrt(np.mean(chunk**2)))
s.close(); p.terminate()
"

# 2. Test backend health
curl http://localhost:8000/health

# 3. Test WebSocket connection
# Open ws://localhost:8000/ws in browser devtools
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `PortAudio not found` | `sudo apt install portaudio19-dev` |
| `openWakeWord model not found` | First run auto-downloads; or pre-download: `python -c "import openwakeword; openwakeword.utils.download_models(['hey_mycroft'])"` |
| STT returns empty | Check mic RMS > 200 before sending |
| TTS no audio in browser | Pass `--autoplay-policy=no-user-gesture-required` to Chromium |
| WebSocket disconnects | Disable sleep: `sudo systemctl mask sleep.target suspend.target` |