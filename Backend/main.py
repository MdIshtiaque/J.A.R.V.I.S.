import asyncio
import time
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from config import PORT, DEFAULT_TTS_VOICE
from services.stt_service import stt_service
from services.llm_service import llm_service
from services.tts_service import tts_service

app = FastAPI(
    title="J.A.R.V.I.S. Modular Python Backend",
    description="Refactored modular backend with British Neural Voice (en-GB-RyanNeural)"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": "J.A.R.V.I.S. Modular Python Backend",
        "voice": DEFAULT_TTS_VOICE,
        "timestamp": time.time()
    }


async def _run_llm_with_progress(websocket: WebSocket, prompt: str) -> str:
    """Run LLM in a worker thread while streaming spoken progress to the client."""
    loop = asyncio.get_running_loop()
    status_queue: asyncio.Queue = asyncio.Queue()

    def on_status(status: str, detail: str = None, speak: bool = False):
        loop.call_soon_threadsafe(
            status_queue.put_nowait,
            {"status": status, "detail": detail, "speak": speak},
        )

    async def drain_status():
        while True:
            event = await status_queue.get()
            if event is None:
                break

            payload = {"type": "status", "status": event["status"]}
            if event.get("detail"):
                payload["detail"] = event["detail"]
            await websocket.send_text(json.dumps(payload))

            if event.get("detail"):
                await websocket.send_text(json.dumps({
                    "type": "progress",
                    "text": event["detail"],
                    "speak": bool(event.get("speak")),
                }))

                # Speak progress lines out loud (On it… / Found it…)
                if event.get("speak"):
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "status": "speaking",
                    }))
                    tts_bytes = await tts_service.generate_speech_bytes(event["detail"])
                    if tts_bytes:
                        await websocket.send_bytes(tts_bytes)
                    # Return to working/searching status after short spoken beat
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "status": event["status"],
                    }))

    drain_task = asyncio.create_task(drain_status())
    try:
        reply = await asyncio.to_thread(llm_service.generate_response, prompt, on_status)
        return reply
    finally:
        await status_queue.put(None)
        await drain_task


async def handle_websocket_connection(websocket: WebSocket):
    await websocket.accept()
    print("🟢 Client connected to J.A.R.V.I.S. Python WebSocket")

    await websocket.send_text(json.dumps({
        "type": "connected",
        "message": f"J.A.R.V.I.S. British AI active ({DEFAULT_TTS_VOICE}). Voice pipeline ready."
    }))

    try:
        while True:
            message = await websocket.receive()
            start_time = time.time()

            # Handle text input commands
            if "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                        continue

                    if data.get("type") == "text" and data.get("content"):
                        prompt = data["content"]
                        print(f"⌨️ Text command: \"{prompt}\"")

                        await websocket.send_text(json.dumps({"type": "status", "status": "thinking"}))
                        reply = await _run_llm_with_progress(websocket, prompt)
                        await websocket.send_text(json.dumps({"type": "reply", "text": reply}))

                        await websocket.send_text(json.dumps({"type": "status", "status": "speaking"}))
                        tts_bytes = await tts_service.generate_speech_bytes(reply)
                        if tts_bytes:
                            await websocket.send_bytes(tts_bytes)

                        await websocket.send_text(json.dumps({"type": "status", "status": "idle"}))
                        print(f"⚡ Text pipeline complete in {(time.time() - start_time) * 1000:.0f}ms\n")
                        continue
                except Exception as e:
                    print(f"⚠️ Text handler exception: {e}")

            # Handle binary audio segments from microphone
            if "bytes" in message and message["bytes"]:
                audio_bytes = message["bytes"]
                print(f"🎤 Audio segment received: {len(audio_bytes) / 1024:.1f} KB")

                if len(audio_bytes) < 2000:
                    print("   ↳ Audio segment too small, skipping")
                    continue

                # 1. Speech-to-Text
                await websocket.send_text(json.dumps({"type": "status", "status": "transcribing"}))
                transcript = await asyncio.to_thread(
                    stt_service.transcribe_audio_bytes, audio_bytes
                )

                if not transcript:
                    await websocket.send_text(json.dumps({"type": "status", "status": "idle"}))
                    continue

                await websocket.send_text(json.dumps({"type": "transcript", "text": transcript}))

                # 2. LLM Response (with live searching/working progress)
                await websocket.send_text(json.dumps({"type": "status", "status": "thinking"}))
                reply = await _run_llm_with_progress(websocket, transcript)
                await websocket.send_text(json.dumps({"type": "reply", "text": reply}))

                # 3. British Neural Speech Generation
                await websocket.send_text(json.dumps({"type": "status", "status": "speaking"}))
                tts_bytes = await tts_service.generate_speech_bytes(reply)
                if tts_bytes:
                    await websocket.send_bytes(tts_bytes)

                await websocket.send_text(json.dumps({"type": "status", "status": "idle"}))
                print(f"⚡ Full voice pipeline complete in {(time.time() - start_time) * 1000:.0f}ms\n")

    except WebSocketDisconnect:
        print("🔴 Client disconnected from J.A.R.V.I.S. WebSocket")
    except Exception as e:
        print(f"❌ WebSocket session exception: {e}")


@app.websocket("/ws")
async def websocket_endpoint_ws(websocket: WebSocket):
    await handle_websocket_connection(websocket)


@app.websocket("/")
async def websocket_endpoint_root(websocket: WebSocket):
    await handle_websocket_connection(websocket)


if __name__ == "__main__":
    import uvicorn
    print(f"\n🚀 J.A.R.V.I.S. Modular Python Backend online at http://localhost:{PORT}")
    print(f"   WebSocket: ws://localhost:{PORT}/ws")
    print(f"   STT: Groq Whisper ({stt_service.client})")
    print(f"   LLM: Groq LLaMA 3.1")
    print(f"   TTS Voice: British Neural ({DEFAULT_TTS_VOICE})\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
