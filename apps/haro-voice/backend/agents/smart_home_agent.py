import httpx
import os
from .base_agent import BaseAgent
from llm import chat_stream

HA_URL = os.getenv("HOME_ASSISTANT_URL", "http://homeassistant.local:8123")
HA_TOKEN = os.getenv("HOME_ASSISTANT_TOKEN", "")

SMART_HOME_SYSTEM = """Kamu mengontrol smart home. User memberi perintah suara.
Ekstrak: entity (lampu_kamar, ac_ruang_tamu, dll) dan action (turn_on/turn_off).
Balas singkat konfirmasi tindakan dalam bahasa Indonesia."""


class SmartHomeAgent(BaseAgent):
    async def handle(self, text: str, history: list[dict]) -> dict:
        if not HA_TOKEN:
            return {
                "text": "Home Assistant belum dikonfigurasi. Tambahkan token di file .env.",
                "action": "config_missing",
                "agent": "smart_home",
            }

        parse_messages = [{"role": "user", "content": f"Perintah: {text}\nEkstrak entity dan action dalam format JSON: {{\"entity\": \"...\", \"action\": \"turn_on/turn_off\"}}"}]
        parsed_str = ""
        async for token in chat_stream(parse_messages):
            parsed_str += token

        try:
            import json, re
            match = re.search(r"\{.*\}", parsed_str, re.DOTALL)
            parsed = json.loads(match.group()) if match else {}
            entity = parsed.get("entity", "")
            action = parsed.get("action", "")

            if entity and action:
                await self._call_ha(entity, action)
                action_text = "dinyalakan" if action == "turn_on" else "dimatikan"
                return {
                    "text": f"Oke, {entity.replace('_', ' ')} sudah {action_text}.",
                    "action": f"{action}:{entity}",
                    "agent": "smart_home",
                }
        except Exception as e:
            pass

        return {
            "text": "Maaf, saya tidak bisa memahami perintah smart home tersebut.",
            "action": "parse_error",
            "agent": "smart_home",
        }

    async def _call_ha(self, entity_id: str, service: str):
        domain = entity_id.split("_")[0]
        url = f"{HA_URL}/api/services/{domain}/{service}"
        headers = {"Authorization": f"Bearer {HA_TOKEN}", "Content-Type": "application/json"}
        async with httpx.AsyncClient() as client:
            await client.post(url, json={"entity_id": entity_id}, headers=headers)