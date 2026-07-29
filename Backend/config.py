import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configuration Constants
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "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")
PORT = int(os.getenv("PORT", 3001))

# Default British J.A.R.V.I.S. Voice (Microsoft Ryan British Neural)
DEFAULT_TTS_VOICE = os.getenv("TTS_VOICE", "en-GB-RyanNeural")

# Groq Model Specs
GROQ_STT_MODEL = "whisper-large-v3-turbo"
GROQ_LLM_MODEL = "llama-3.1-8b-instant"

# System Persona
JARVIS_SYSTEM_PROMPT = (
    "You are JARVIS, a real, highly intelligent personal AI assistant. "
    "Be concise, direct, helpful, warm, polite, and completely truthful. "
    "CRITICAL RULE: NEVER lie, fabricate, or hallucinate access to external personal accounts (like emails, calendars, phone calls, or smart devices) that are not connected. "
    "If asked to check emails, messages, or private data, state politely and honestly that external account integrations are not currently connected. "
    "Speak with refined politeness and clarity."
)

# Common STT noise hallucinations to filter out
NOISE_PHRASES = {
    "thank you.", "thanks.", "you", "thank you", "thanks",
    "bye.", "bye", "", ".", "..", "the end.", "the end",
    "hmm", "um", "uh", "oh", "ah", "hm",
    "subtitles by", "subscribe", "like and subscribe",
    "thanks for watching", "thank you for watching"
}
