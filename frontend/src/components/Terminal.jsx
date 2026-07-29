import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Sparkles, Trash2, Mic, MicOff, Send, ChevronDown, ChevronUp, Loader2, Radio } from 'lucide-react';

const WS_URL = 'ws://localhost:3001/ws';

export const Terminal = ({ blobConfig, onAiSpeakingChange, onMicStatusChange, onListeningChange }) => {
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'JARVIS',
      text: 'Voice pipeline active. Click MIC to speak.',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [interimText, setInterimText] = useState('');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [micStatus, setMicStatus] = useState('idle');
  const [backendStatus, setBackendStatus] = useState('disconnected');
  const [pipelineStatus, setPipelineStatus] = useState('idle');

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);
  const isMicActiveRef = useRef(false);
  const audioChunksRef = useRef([]);

  // Voice Activity Detection refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const vadFrameRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm;codecs=opus');

  // Active audio element ref for playback
  const currentAudioRef = useRef(null);

  // Notify parent
  useEffect(() => { if (onMicStatusChange) onMicStatusChange(micStatus); }, [micStatus, onMicStatusChange]);
  useEffect(() => { if (onListeningChange) onListeningChange(isListening); }, [isListening, onListeningChange]);

  // ─── WebSocket Connection ───
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[WS] ✅ Connected to J.A.R.V.I.S. Python Backend');
        setBackendStatus('connected');
        setErrorMessage('');
      };

      ws.onmessage = async (event) => {
        // Binary = British Neural / ONNX J.A.R.V.I.S. TTS Audio from Python Backend
        if (event.data instanceof Blob) {
          console.log('[WS] 🔊 Received J.A.R.V.I.S. voice audio:', event.data.size, 'bytes');
          try {
            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current = null;
            }

            const audioBlob = new Blob([event.data], { type: event.data.type || 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;

            if (onAiSpeakingChange) onAiSpeakingChange(true);

            audio.onended = () => {
              console.log('[WS] 🔊 Voice playback completed');
              if (onAiSpeakingChange) onAiSpeakingChange(false);
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
            };

            audio.onerror = (e) => {
              console.error('[WS] ❌ Audio playback error:', e);
              if (onAiSpeakingChange) onAiSpeakingChange(false);
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
            };

            await audio.play();
            console.log('[WS] 🔊 Playing J.A.R.V.I.S. voice out loud!');
          } catch (e) {
            console.warn('[WS] Audio play failed:', e);
            if (onAiSpeakingChange) onAiSpeakingChange(false);
          }
          return;
        }

        // Text = JSON status & transcripts
        try {
          const msg = JSON.parse(event.data);
          const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

          switch (msg.type) {
            case 'connected':
              console.log('[WS]', msg.message);
              break;

            case 'status':
              setPipelineStatus(msg.status);
              if (msg.status === 'transcribing') {
                // If not already showing interim text
              } else if (msg.status === 'thinking') {
                setIsThinking(true);
                setInterimText('');
              } else if (msg.status === 'speaking') {
                setIsThinking(false);
                setInterimText('');
              } else if (msg.status === 'idle') {
                setIsThinking(false);
                setInterimText('');
                setPipelineStatus('idle');
              }
              break;

            case 'transcript':
              setInterimText('');
              setMessages(prev => {
                // Avoid duplicating transcript if real-time engine already pushed it
                const last = prev[prev.length - 1];
                if (last && last.sender === 'USER' && last.text === msg.text) return prev;
                return [...prev, {
                  id: Date.now().toString(),
                  sender: 'USER',
                  text: msg.text,
                  timestamp: timeStr,
                }];
              });
              break;

            case 'reply':
              setIsThinking(false);
              setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                sender: 'JARVIS',
                text: msg.text,
                timestamp: timeStr,
              }]);
              break;

            case 'error':
              console.warn('[WS] Backend error:', msg.message);
              setErrorMessage(msg.message);
              setIsThinking(false);
              setInterimText('');
              break;

            default:
              break;
          }
        } catch {}
      };

      ws.onclose = () => {
        console.log('[WS] 🔴 Disconnected');
        setBackendStatus('disconnected');
        setTimeout(() => {
          if (wsRef.current === ws) connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        setBackendStatus('error');
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      setBackendStatus('error');
    }
  }, [onAiSpeakingChange]);

  useEffect(() => {
    connectWebSocket();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [connectWebSocket]);

  // ─── Start a fresh MediaRecorder instance for a single speech segment ───
  const startRecordingSegment = useCallback(() => {
    if (!mediaStreamRef.current || !isMicActiveRef.current) return;

    try {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: mimeTypeRef.current });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        console.log('[MIC] 🛑 Segment stopped. Chunks:', audioChunksRef.current.length);
        if (audioChunksRef.current.length > 0) {
          const completeBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
          audioChunksRef.current = [];

          if (completeBlob.size > 2000) {
            console.log('[MIC] 📤 Sending audio segment to Python backend:', (completeBlob.size / 1024).toFixed(1), 'KB');
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(completeBlob);
            }
          }
        }
        mediaRecorderRef.current = null;
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      console.log('[MIC] 🎙️ MediaRecorder segment started');
    } catch (e) {
      console.warn('[MIC] Could not start MediaRecorder segment:', e);
    }
  }, []);

  const stopRecordingSegment = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('[MIC] Error stopping segment:', e);
      }
    }
  }, []);

  // ─── Real-Time Client-Side STT Recognition Stream ───
  const startRealtimeSTT = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let liveInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            console.log('[STT] 🎯 Real-time final transcript:', transcript.trim());
          } else {
            liveInterim += transcript;
          }
        }
        if (liveInterim.trim()) {
          setInterimText(liveInterim.trim());
        }
      };

      rec.onerror = (e) => {
        console.warn('[STT] Real-time STT notice:', e.error);
      };

      rec.onend = () => {
        if (isMicActiveRef.current) {
          try { rec.start(); } catch {}
        }
      };

      rec.start();
      recognitionRef.current = rec;
      console.log('[STT] ⚡ Real-time instant STT stream active');
    } catch (e) {
      console.warn('[STT] Real-time STT init failed:', e);
    }
  }, []);

  const stopRealtimeSTT = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  // ─── Voice Activity Detection (VAD) loop ───
  const startVAD = useCallback((stream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.25;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const SPEECH_THRESHOLD = 14;
      const SILENCE_MS = 1000; // Fast 1000ms silence detection for snappy response

      const checkVAD = () => {
        if (!isMicActiveRef.current) return;

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        const startBin = Math.floor(300 / (audioCtx.sampleRate / analyser.fftSize));
        const endBin = Math.min(Math.floor(3400 / (audioCtx.sampleRate / analyser.fftSize)), dataArray.length);
        for (let i = startBin; i < endBin; i++) sum += dataArray[i];
        const avgEnergy = sum / (endBin - startBin);

        if (avgEnergy > SPEECH_THRESHOLD) {
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            console.log('[VAD] 🗣️ Speech started');
            startRecordingSegment();
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (isSpeakingRef.current) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log('[VAD] 🔇 Silence detected — finalizing segment');
              isSpeakingRef.current = false;
              stopRecordingSegment();
              silenceTimerRef.current = null;
            }, SILENCE_MS);
          }
        }

        vadFrameRef.current = requestAnimationFrame(checkVAD);
      };

      vadFrameRef.current = requestAnimationFrame(checkVAD);
    } catch (e) {
      console.warn('[VAD] VAD setup failed:', e);
    }
  }, [startRecordingSegment, stopRecordingSegment]);

  const stopVAD = useCallback(() => {
    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    isSpeakingRef.current = false;
  }, []);

  // ─── Turn Microphone On / Off ───
  const startMic = useCallback(async () => {
    try {
      setMicStatus('requesting');

      // Pre-unlock browser HTML5 audio playback on user gesture
      const dummyAudio = new Audio();
      dummyAudio.play().catch(() => {});

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      mimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

      isMicActiveRef.current = true;
      setMicStatus('active');
      setIsListening(true);
      setErrorMessage('');

      startVAD(stream);
      startRealtimeSTT();
      console.log('[MIC] ✅ Microphone activated with real-time streaming');
    } catch (e) {
      console.error('[MIC] ❌ Mic activation failed:', e);
      setErrorMessage('Microphone access denied. Allow mic access and retry.');
      setMicStatus('error');
      setIsListening(false);
      isMicActiveRef.current = false;
    }
  }, [startVAD, startRealtimeSTT]);

  const stopMic = useCallback(() => {
    isMicActiveRef.current = false;
    stopVAD();
    stopRealtimeSTT();
    stopRecordingSegment();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    setMicStatus('idle');
    setIsListening(false);
    setInterimText('');
    console.log('[MIC] 🔴 Microphone deactivated');
  }, [stopVAD, stopRealtimeSTT, stopRecordingSegment]);

  const toggleMic = useCallback(() => {
    if (isMicActiveRef.current) {
      stopMic();
    } else {
      startMic();
    }
  }, [startMic, stopMic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMicActiveRef.current = false;
      stopVAD();
      stopRealtimeSTT();
      stopRecordingSegment();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [stopVAD, stopRealtimeSTT, stopRecordingSegment]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, interimText, isThinking]);

  // Text submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'USER',
      text: inputText.trim(),
      timestamp: timeStr,
    }]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', content: inputText.trim() }));
      setIsThinking(true);
    }
    setInputText('');
  };

  const clearFeed = () => {
    setMessages([]);
    setInterimText('');
  };

  // Mic button styling
  const micBtnClass = (() => {
    if (micStatus === 'active') return 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 shadow-[0_0_12px_rgba(0,255,136,0.4)]';
    if (micStatus === 'requesting') return 'bg-amber-500/20 border-amber-400/60 text-amber-300 animate-pulse';
    if (micStatus === 'error') return 'bg-red-500/20 border-red-400/60 text-red-300';
    return 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 hover:bg-cyan-500/30';
  })();

  const micLabel = (() => {
    if (micStatus === 'active') {
      if (pipelineStatus === 'transcribing') return 'TRANSCRIBING';
      if (pipelineStatus === 'thinking') return 'THINKING';
      if (pipelineStatus === 'speaking') return 'J.A.R.V.I.S. SPEAKING';
      return 'LISTENING LIVE';
    }
    if (micStatus === 'requesting') return 'REQUESTING...';
    if (micStatus === 'error') return 'MIC ERROR';
    return 'START MIC';
  })();

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 sm:w-96 max-w-[calc(100vw-2rem)] font-mono">
      <div className="filter drop-shadow-[0_0_35px_rgba(0,240,255,0.3)] relative">
        <div
          className="group relative bg-slate-950/90 border-y border-cyan-500/60 backdrop-blur-3xl transition-all duration-300 flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.25)]"
          style={{
            clipPath: 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.1) 0%, rgba(10, 15, 30, 0.95) 50%, rgba(120, 0, 255, 0.1) 100%)',
          }}
        >
          <div className="absolute top-0 left-[14px] w-10 h-[2px] bg-gradient-to-r from-cyan-400 to-transparent shadow-[0_0_10px_rgba(0,240,255,0.9)]"></div>
          <div className="absolute bottom-0 right-[14px] w-10 h-[2px] bg-gradient-to-l from-cyan-400 to-transparent shadow-[0_0_10px_rgba(0,240,255,0.9)]"></div>

          {/* Header */}
          <div className="px-4 py-2.5 border-b border-white/10 bg-slate-950/80 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-cyan-400 font-extrabold tracking-wider flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(0,240,255,0.6)] text-[11px]">
                <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>JARVIS</span>
              </span>

              <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(0,255,136,0.8)]' : 'bg-red-400 shadow-[0_0_6px_rgba(255,60,60,0.8)] animate-pulse'}`}></div>

              <button
                onClick={toggleMic}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${micBtnClass}`}
              >
                {micStatus === 'active' ? <Mic className="w-3 h-3 text-emerald-400 animate-pulse" /> : <MicOff className="w-3 h-3" />}
                <span>{micLabel}</span>
              </button>
            </div>

            <div className="flex items-center space-x-1.5">
              <button onClick={clearFeed} title="Clear" className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-colors">
                {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-[10px] flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage('')} className="text-amber-200 hover:text-white font-bold ml-2">✕</button>
            </div>
          )}

          {!isCollapsed && (
            <>
              <div ref={scrollRef} className="p-3 overflow-y-auto space-y-2 text-xs h-[190px]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start justify-between gap-2 p-2 rounded-xl transition-all ${
                      msg.sender === 'USER'
                        ? 'bg-purple-950/40 border border-purple-500/40 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.12)]'
                        : 'bg-slate-900/80 border border-cyan-500/40 text-cyan-100 shadow-[0_0_15px_rgba(0,240,255,0.12)]'
                    }`}
                  >
                    <div className="flex items-start gap-1.5 flex-1">
                      {msg.sender === 'JARVIS' ? (
                        <span className="text-cyan-400 font-bold shrink-0 flex items-center gap-1 drop-shadow-[0_0_6px_rgba(0,240,255,0.6)] text-[11px]">
                          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                          JARVIS &gt;
                        </span>
                      ) : (
                        <span className="text-purple-400 font-bold shrink-0 flex items-center gap-1 text-[11px]">
                          <Mic className="w-3 h-3 text-purple-400" />
                          YOU &gt;
                        </span>
                      )}
                      <span className={`leading-relaxed text-[11px] ${msg.sender === 'JARVIS' ? 'text-cyan-100 font-medium' : 'text-purple-100'}`}>
                        {msg.text}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0 self-center">{msg.timestamp}</span>
                  </div>
                ))}

                {/* Real-time live streaming text as user speaks */}
                {interimText && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-950/50 border border-cyan-400/60 text-cyan-200 animate-pulse shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                    <span className="text-cyan-400 font-bold shrink-0 flex items-center gap-1 text-[10px]">
                      <Radio className="w-3 h-3 text-cyan-400 animate-spin" />
                      SPEAKING &gt;
                    </span>
                    <span className="italic text-cyan-300 font-bold text-[11px]">{interimText}</span>
                    <span className="w-1.5 h-3 bg-cyan-400 animate-pulse ml-auto"></span>
                  </div>
                )}

                {isThinking && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-cyan-400/50 text-cyan-300 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    <span className="text-[11px] font-bold">JARVIS is thinking...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="px-3 py-1.5 border-t border-white/10 bg-slate-950/95 flex items-center gap-2 text-xs">
                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-cyan-500/40 focus-within:border-cyan-400">
                  <span className="text-cyan-400 font-extrabold text-[11px]">&gt;</span>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a command..."
                    className="w-full bg-transparent text-cyan-200 outline-none text-[11px] placeholder:text-slate-600"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.3)] text-[11px]"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Terminal;
