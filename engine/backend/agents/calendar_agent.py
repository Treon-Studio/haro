from .base_agent import BaseAgent


class CalendarAgent(BaseAgent):
    async def handle(self, text: str, history: list[dict]) -> dict:
        return {
            "text": "Fitur kalender sedang dalam pengembangan. Untuk sekarang, tanya saya hal lain!",
            "action": "not_implemented",
            "agent": "calendar",
        }