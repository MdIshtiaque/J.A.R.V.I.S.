import React, { useState, useEffect, useRef } from 'react';
import { Shield, Cpu, Mic, MicOff, Key, Wifi, WifiOff, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const GROQ_API_KEY = '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';

// Status indicator icons by state
const StatusIcon = ({ status }) => {
  if (status === 'online' || status === 'granted' || status === 'connected') {
    return <CheckCircle2 className="w-3 h-3 text-emerald-400 drop-shadow-[0_0_4px_rgba(0,255,136,0.6)]" />;
  }
  if (status === 'error' || status === 'denied' || status === 'offline') {
    return <XCircle className="w-3 h-3 text-red-400 drop-shadow-[0_0_4px_rgba(255,60,60,0.6)]" />;
  }
  return <AlertCircle className="w-3 h-3 text-amber-400 animate-pulse drop-shadow-[0_0_4px_rgba(255,180,0,0.6)]" />;
};

// Dot color by state
const dotColor = (status) => {
  if (status === 'online' || status === 'granted' || status === 'connected') {
    return 'bg-emerald-400 shadow-[0_0_6px_rgba(0,255,136,0.8)]';
  }
  if (status === 'error' || status === 'denied' || status === 'offline') {
    return 'bg-red-400 shadow-[0_0_6px_rgba(255,60,60,0.8)]';
  }
  return 'bg-amber-400 shadow-[0_0_6px_rgba(255,180,0,0.8)] animate-pulse';
};

const labelColor = (status) => {
  if (status === 'online' || status === 'granted' || status === 'connected') return 'text-emerald-300';
  if (status === 'error' || status === 'denied' || status === 'offline') return 'text-red-300';
  return 'text-amber-300';
};

export default function Status({ micStatus, isListening, isAiSpeaking }) {
  const [systemOnline] = useState(true);
  const [jarvisOnline, setJarvisOnline] = useState('checking');
  const [micPermission, setMicPermission] = useState('checking');
  const [apiConnected, setApiConnected] = useState('checking');
  const checkedRef = useRef(false);

  // Check mic permission
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' });
          setMicPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'checking');

          result.onchange = () => {
            setMicPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'checking');
          };
        }
      } catch {
        // Firefox doesn't support microphone permission query
        setMicPermission(isListening ? 'granted' : 'checking');
      }
    };

    checkMicPermission();
  }, [isListening]);

  // Update mic permission when mic becomes active
  useEffect(() => {
    if (micStatus === 'active' || isListening) {
      setMicPermission('granted');
    }
  }, [micStatus, isListening]);

  // Ping Groq API on mount to check connectivity
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const pingGroq = async () => {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
        });
        if (res.ok) {
          setApiConnected('connected');
          setJarvisOnline('online');
        } else {
          setApiConnected('error');
          setJarvisOnline('offline');
        }
      } catch {
        setApiConnected('error');
        setJarvisOnline('offline');
      }
    };

    // Small delay so UI renders first
    setTimeout(pingGroq, 800);
  }, []);

  // Derive microphone status label
  const micStatusLabel = (() => {
    if (micStatus === 'active' || isListening) return 'Active';
    if (micStatus === 'error') return 'Error';
    return 'Inactive';
  })();

  const micState = (() => {
    if (micStatus === 'active' || isListening) return 'online';
    if (micStatus === 'error') return 'error';
    return 'offline';
  })();

  const statuses = [
    {
      icon: <Shield className="w-3.5 h-3.5 text-cyan-400" />,
      label: 'SYSTEM',
      value: systemOnline ? 'Online' : 'Offline',
      status: systemOnline ? 'online' : 'offline',
    },
    {
      icon: <Cpu className="w-3.5 h-3.5 text-cyan-400" />,
      label: 'J.A.R.V.I.S.',
      value: jarvisOnline === 'online' ? 'Online' : jarvisOnline === 'checking' ? 'Checking...' : 'Offline',
      status: jarvisOnline,
    },
    {
      icon: isListening ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />,
      label: 'MICROPHONE',
      value: micStatusLabel,
      status: micState,
    },
    {
      icon: <Key className="w-3.5 h-3.5 text-cyan-400" />,
      label: 'MIC PERMISSION',
      value: micPermission === 'granted' ? 'Granted' : micPermission === 'denied' ? 'Denied' : 'Pending',
      status: micPermission === 'granted' ? 'granted' : micPermission === 'denied' ? 'denied' : 'checking',
    },
    {
      icon: apiConnected === 'connected' ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-slate-400" />,
      label: 'GROQ API',
      value: apiConnected === 'connected' ? 'Connected' : apiConnected === 'checking' ? 'Checking...' : 'Disconnected',
      status: apiConnected,
    },
  ];

  return (
    <div className="fixed top-20 right-6 z-30 w-56 font-mono">
      {/* Outer Glow Filter */}
      <div className="filter drop-shadow-[0_0_25px_rgba(0,240,255,0.2)] relative">
        {/* Angular Sci-Fi HUD Panel — clip-path polygon with beveled corners */}
        <div
          className="relative bg-slate-950/85 border-y border-cyan-500/50 backdrop-blur-3xl transition-all duration-300 overflow-hidden"
          style={{
            clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
            background: 'linear-gradient(160deg, rgba(0, 240, 255, 0.08) 0%, rgba(10, 15, 30, 0.92) 50%, rgba(120, 0, 255, 0.06) 100%)',
          }}
        >
          {/* Glowing Corner Accent Brackets */}
          <div className="absolute top-0 left-[12px] w-8 h-[2px] bg-gradient-to-r from-cyan-400 to-transparent shadow-[0_0_8px_rgba(0,240,255,0.9)]"></div>
          <div className="absolute bottom-0 right-[12px] w-8 h-[2px] bg-gradient-to-l from-cyan-400 to-transparent shadow-[0_0_8px_rgba(0,240,255,0.9)]"></div>

          {/* Header */}
          <div className="px-4 py-2 border-b border-white/10 bg-slate-950/70 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
            <span className="text-cyan-400 font-extrabold tracking-widest text-[10px] drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]">
              SYSTEM STATUS
            </span>
          </div>

          {/* Status Rows */}
          <div className="px-3 py-2 space-y-1.5">
            {statuses.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/50 border border-white/5 hover:border-cyan-500/30 transition-all group"
              >
                <div className="flex items-center gap-2">
                  {/* Pulsing dot */}
                  <div className={`w-1.5 h-1.5 rounded-full ${dotColor(s.status)}`}></div>
                  {s.icon}
                  <span className="text-[10px] text-slate-300 font-bold tracking-wide">{s.label}</span>
                </div>
                <span className={`text-[9px] font-extrabold tracking-wider ${labelColor(s.status)}`}>
                  {s.value.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          {/* Footer glow bar */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
        </div>
      </div>
    </div>
  );
}
