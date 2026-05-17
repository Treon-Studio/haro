import re
from agents.general_agent import GeneralAgent
from agents.smart_home_agent import SmartHomeAgent
from agents.calendar_agent import CalendarAgent

INTENT_PATTERNS = {
    "smart_home": [
        r"\b(lampu|kipas|ac|tv|listrik|matik|nyalakan|matikan|hidupkan)\b",
        r"\b(suhu|temperature|brightness|dim|bright)\b",
    ],
    "calendar": [
        r"\b(jadwal|kalender|meeting|appointment|reminder|pengingat|besok|hari ini)\b",
        r"\b(jam berapa|kapan|schedule|agenda)\b",
    ],
}


class AgentRouter:
    def __init__(self):
        self.agents = {
            "smart_home": SmartHomeAgent(),
            "calendar": CalendarAgent(),
            "general": GeneralAgent(),
        }

    def detect_intent(self, text: str) -> str:
        text_lower = text.lower()
        for intent, patterns in INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return intent
        return "general"

    async def route(self, text: str, history: list[dict]) -> dict:
        intent = self.detect_intent(text)
        agent = self.agents[intent]
        return await agent.handle(text, history)