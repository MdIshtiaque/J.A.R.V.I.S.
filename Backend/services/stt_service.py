import os
import tempfile
from groq import Groq
from config import GROQ_API_KEY, GROQ_STT_MODEL, NOISE_PHRASES

class STTService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)

    def transcribe_audio_bytes(self, audio_bytes: bytes) -> str:
        """Transcribe WebM/Opus audio bytes using Groq Whisper model"""
        try:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_file_path = tmp_file.name

            try:
                with open(tmp_file_path, "rb") as file_stream:
                    transcription = self.client.audio.transcriptions.create(
                        file=(tmp_file_path, file_stream.read()),
                        model=GROQ_STT_MODEL,
                        response_format="json",
                        language="en",
                    )
                
                text = (transcription.text or "").strip()
                print(f"📝 Whisper STT: \"{text}\"")

                if text.lower() in NOISE_PHRASES or len(text) < 3:
                    print("   ↳ Filtered as silence/noise")
                    return ""

                return text
            finally:
                if os.path.exists(tmp_file_path):
                    os.remove(tmp_file_path)
        except Exception as e:
            print(f"❌ STT error: {e}")
            return ""

stt_service = STTService()
