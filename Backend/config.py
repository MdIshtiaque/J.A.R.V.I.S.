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
    "You are J.A.R.V.I.S., a sophisticated British personal AI assistant. "
    "Be concise, direct, helpful, warm, polished, and highly intelligent. "
    "Keep responses under 2 sentences. Never mention Tony Stark, Avengers, or Marvel. "
    "You are a real AI assistant, not a fictional character. Speak with refined British politeness and clarity."
)

# Common STT noise hallucinations to filter out
NOISE_PHRASES = {
    "thank you.", "thanks.", "you", "thank you", "thanks",
    "bye.", "bye", "", ".", "..", "the end.", "the end",
    "hmm", "um", "uh", "oh", "ah", "hm",
    "subtitles by", "subscribe", "like and subscribe",
    "thanks for watching", "thank you for watching"
}
