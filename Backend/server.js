import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Groq from 'groq-sdk';
import fs from 'fs/promises';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ───
const PORT = process.env.PORT || 3001;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY not found in .env');
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Temp directory for audio files
const TEMP_DIR = path.join(__dirname, 'tmp');
if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

// Noise/silence transcripts to filter out
const NOISE_PHRASES = new Set([
  'thank you.', 'thanks.', 'you', 'thank you', 'thanks',
  'bye.', 'bye', '', '.', '..', 'the end.', 'the end',
  'hmm', 'um', 'uh', 'oh', 'ah', 'hm',
  'subtitles by', 'subscribe', 'like and subscribe',
  'thanks for watching', 'thank you for watching',
]);

// ─── Express App ───
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'online', service: 'J.A.R.V.I.S. Backend', timestamp: new Date().toISOString() });
});

// ─── HTTP Server + WebSocket ───
const server = createServer(app);
const wss = new WebSocketServer({ server });

console.log('🔧 J.A.R.V.I.S. Backend initializing...');

// ─── Google TTS: Fast, reliable text-to-speech ───
async function generateSpeech(text) {
  try {
    const googleTTS = await import('google-tts-api');
    const url = googleTTS.getAudioUrl(text, {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 5000,
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);

    const arrayBuf = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);

    console.log(`🔊 TTS generated: ${(audioBuffer.length / 1024).toFixed(1)} KB`);
    return audioBuffer;
  } catch (err) {
    console.error('❌ Google TTS error:', err.message);
    return null;
  }
}

// ─── Groq Whisper: Transcribe audio ───
async function transcribeAudio(audioBuffer) {
  try {
    const tempFile = path.join(TEMP_DIR, `audio_${Date.now()}.webm`);
    await fs.writeFile(tempFile, audioBuffer);

    const transcription = await groq.audio.transcriptions.create({
      file: createReadStream(tempFile),
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
      language: 'en',
    });

    // Clean up
    await fs.unlink(tempFile).catch(() => {});

    const text = transcription.text?.trim() || '';
    console.log(`📝 Whisper: "${text}"`);

    // Filter out noise/silence hallucinations
    if (NOISE_PHRASES.has(text.toLowerCase()) || text.length < 3) {
      console.log('   ↳ Filtered as noise/silence');
      return '';
    }

    return text;
  } catch (err) {
    console.error('❌ Whisper error:', err.message);
    return '';
  }
}

// ─── Groq LLM: J.A.R.V.I.S. response ───
async function generateResponse(userMessage) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You are J.A.R.V.I.S., a sleek personal AI assistant. You are concise, direct, helpful, warm, and highly intelligent. Keep responses under 2 sentences. Never mention Tony Stark, Avengers, or Marvel. You are a real AI assistant, not a fictional character. Respond naturally like a smart helpful friend.',
        },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const reply = chatCompletion.choices?.[0]?.message?.content?.trim();
    console.log(`🤖 LLM: "${reply}"`);
    return reply || 'I received your message but could not generate a response.';
  } catch (err) {
    console.error('❌ LLM error:', err.message);
    return 'Network issue encountered. Please try again.';
  }
}

// ─── Full voice pipeline: audio → text → LLM → TTS → audio ───
async function processVoiceInput(ws, audioBuffer) {
  const startTime = Date.now();

  // Step 1: Transcribe
  ws.send(JSON.stringify({ type: 'status', status: 'transcribing' }));
  const transcript = await transcribeAudio(audioBuffer);

  if (!transcript) {
    ws.send(JSON.stringify({ type: 'status', status: 'idle' }));
    return;
  }

  // Send transcript to client
  ws.send(JSON.stringify({ type: 'transcript', text: transcript }));

  // Step 2: LLM response
  ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));
  const reply = await generateResponse(transcript);
  ws.send(JSON.stringify({ type: 'reply', text: reply }));

  // Step 3: TTS audio
  ws.send(JSON.stringify({ type: 'status', status: 'speaking' }));
  const ttsAudio = await generateSpeech(reply);

  if (ttsAudio) {
    ws.send(ttsAudio, { binary: true });
  }

  ws.send(JSON.stringify({ type: 'status', status: 'idle' }));

  const elapsed = Date.now() - startTime;
  console.log(`⚡ Pipeline complete in ${elapsed}ms\n`);
}

// ─── Full text pipeline: text → LLM → TTS → audio ───
async function processTextInput(ws, text) {
  const startTime = Date.now();

  ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));
  const reply = await generateResponse(text);
  ws.send(JSON.stringify({ type: 'reply', text: reply }));

  ws.send(JSON.stringify({ type: 'status', status: 'speaking' }));
  const ttsAudio = await generateSpeech(reply);

  if (ttsAudio) {
    ws.send(ttsAudio, { binary: true });
  }

  ws.send(JSON.stringify({ type: 'status', status: 'idle' }));

  const elapsed = Date.now() - startTime;
  console.log(`⚡ Text pipeline complete in ${elapsed}ms\n`);
}

// ─── WebSocket Handler ───
wss.on('connection', (ws) => {
  console.log('🟢 Client connected');

  ws.on('message', async (data, isBinary) => {
    try {
      // Text messages (JSON)
      if (!isBinary) {
        const msg = data.toString();
        try {
          const parsed = JSON.parse(msg);

          if (parsed.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            return;
          }

          if (parsed.type === 'text' && parsed.content) {
            console.log(`⌨️  Text: "${parsed.content}"`);
            await processTextInput(ws, parsed.content);
            return;
          }
        } catch {}
        return;
      }

      // Binary = mic audio
      const audioBuffer = Buffer.from(data);
      console.log(`🎤 Audio: ${(audioBuffer.length / 1024).toFixed(1)} KB`);

      // Skip tiny audio (silence/noise)
      if (audioBuffer.length < 2000) {
        console.log('   ↳ Too small, skipping');
        return;
      }

      await processVoiceInput(ws, audioBuffer);
    } catch (err) {
      console.error('❌ Handler error:', err);
      try {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      } catch {}
    }
  });

  ws.on('close', () => console.log('🔴 Client disconnected'));
  ws.on('error', (err) => console.error('❌ WS error:', err.message));

  // Welcome
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'J.A.R.V.I.S. Backend online. Voice pipeline ready.',
  }));
});

// ─── Start ───
server.listen(PORT, () => {
  console.log(`\n🚀 J.A.R.V.I.S. Backend — http://localhost:${PORT}`);
  console.log(`   WS: ws://localhost:${PORT}`);
  console.log(`   STT: Groq Whisper (whisper-large-v3-turbo)`);
  console.log(`   LLM: Groq (llama-3.1-8b-instant)`);
  console.log(`   TTS: Edge Neural (en-US-GuyNeural)\n`);
});
