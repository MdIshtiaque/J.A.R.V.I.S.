import io
import wave
import edge_tts
import urllib.parse
import urllib.request
from pathlib import Path
from huggingface_hub import hf_hub_download
import piper
from config import DEFAULT_TTS_VOICE

class TTSService:
    def __init__(self):
        self.piper_voice = None
        self._init_jarvis_model()

    def _init_jarvis_model(self):
        """Download & load official custom J.A.R.V.I.S. voice model from HuggingFace"""
        try:
            print("📦 Initializing custom J.A.R.V.I.S. voice model (jgkawell/jarvis)...")
            model_path = hf_hub_download(repo_id="jgkawell/jarvis", filename="en/en_GB/jarvis/high/jarvis-high.onnx")
            config_path = hf_hub_download(repo_id="jgkawell/jarvis", filename="en/en_GB/jarvis/high/jarvis-high.onnx.json")
            self.piper_voice = piper.PiperVoice.load(model_path, config_path)
            print("✅ Custom J.A.R.V.I.S. voice model loaded successfully!")
        except Exception as e:
            print(f"⚠️ Could not load custom J.A.R.V.I.S. ONNX voice model: {e}")
            self.piper_voice = None

    async def generate_speech_bytes(self, text: str) -> bytes:
        """Generate official custom J.A.R.V.I.S. voice audio bytes (WAV/MP3)"""
        # Tier 1: Custom Trained J.A.R.V.I.S. Voice Model (jgkawell/jarvis ONNX)
        if self.piper_voice is not None:
            try:
                wav_buffer = io.BytesIO()
                with wave.open(wav_buffer, "wb") as wav_file:
                    self.piper_voice.synthesize_wav(text, wav_file)

                audio_bytes = wav_buffer.getvalue()
                if len(audio_bytes) > 100:
                    print(f"🔊 Official J.A.R.V.I.S. Movie Voice generated: {len(audio_bytes) / 1024:.1f} KB")
                    return audio_bytes
            except Exception as e:
                print(f"⚠️ Custom J.A.R.V.I.S. synthesis error: {e}. Falling back to Microsoft British Neural Voice...")

        # Tier 2: Microsoft Ryan British Neural Voice (en-GB-RyanNeural)
        try:
            communicate = edge_tts.Communicate(text, voice=DEFAULT_TTS_VOICE, rate="-2%", pitch="-6Hz")
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])

            if len(audio_data) > 0:
                print(f"🔊 Microsoft British Neural Voice ({DEFAULT_TTS_VOICE}) generated: {len(audio_data) / 1024:.1f} KB")
                return bytes(audio_data)
        except Exception as e:
            print(f"⚠️ Edge TTS failed: {e}. Switching to Google British Speech fallback...")

        # Tier 3: Google British Speech (en-GB)
        try:
            encoded_text = urllib.parse.quote(text)
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_text}&tl=en-GB&total=1&idx=0&textlen={len(text)}&client=tw-ob"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as response:
                fallback_data = response.read()
                print(f"🔊 Fallback Google British Voice generated: {len(fallback_data) / 1024:.1f} KB")
                return fallback_data
        except Exception as fallback_err:
            print(f"❌ Fallback Google TTS error: {fallback_err}")
            return b""

tts_service = TTSService()
