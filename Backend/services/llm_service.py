from groq import Groq
from config import GROQ_API_KEY, GROQ_LLM_MODEL, JARVIS_SYSTEM_PROMPT

class LLMService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)

    def generate_response(self, user_prompt: str) -> str:
        """Generate refined British J.A.R.V.I.S. response using Groq LLaMA 3.1"""
        try:
            completion = self.client.chat.completions.create(
                model=GROQ_LLM_MODEL,
                messages=[
                    {"role": "system", "content": JARVIS_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=100,
                temperature=0.7,
            )
            reply = (completion.choices[0].message.content or "").strip()
            print(f"🤖 LLM Reply: \"{reply}\"")
            return reply or "I'm ready to assist you, sir."
        except Exception as e:
            print(f"❌ LLM error: {e}")
            return "Apologies, I encountered a network issue. Please try again."

llm_service = LLMService()
