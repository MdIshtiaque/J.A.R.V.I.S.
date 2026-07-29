import React, { useState } from 'react';
import { Terminal, Send, Mic, Cpu, Sparkles, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const defaultLogs = [
  { id: '1', sender: 'JARVIS', text: 'Good day, Boss. All subsystems are operating at peak efficiency. Ready for your command.', timestamp: '14:30:05', type: 'info' },
  { id: '2', sender: 'USER', text: 'Run full system diagnostic on neural core subgrid.', timestamp: '14:31:12' },
  { id: '3', sender: 'JARVIS', text: 'Diagnostic initiated. Neural core integrity: 100%. Quantum decoherence rate: 0.002%. Zero anomalies detected.', timestamp: '14:31:15', type: 'success' },
];

export const CommandCenter = () => {
  const [logs, setLogs] = useState(defaultLogs);
  const [inputCommand, setInputCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const handleSendCommand = (cmdText) => {
    const textToSend = cmdText || inputCommand;
    if (!textToSend.trim() || isProcessing) return;

    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const userLog = {
      id: Date.now().toString(),
      sender: 'USER',
      text: textToSend,
      timestamp: timeStr,
    };

    setLogs((prev) => [...prev, userLog]);
    setInputCommand('');
    setIsProcessing(true);

    setTimeout(() => {
      let responseText = `Understood, Boss. Processing standard protocol for "${textToSend}".`;
      let logType = 'info';

      if (textToSend.toLowerCase().includes('diagnostic')) {
        responseText = 'Running high-precision telemetry scan... All 128 nodes returned optimal status code 200 OK.';
        logType = 'success';
      } else if (textToSend.toLowerCase().includes('defense') || textToSend.toLowerCase().includes('security')) {
        responseText = 'Shield perimeter upgraded to Level 5. Mark 85 automated sentry drones deployed to standby.';
        logType = 'warning';
      } else if (textToSend.toLowerCase().includes('optimize') || textToSend.toLowerCase().includes('clean')) {
        responseText = 'Quantum cache purged. Defragmented 14.2 GB of temporary tensor registers. Processing speed +15%.';
        logType = 'success';
      }

      const jarvisLog = {
        id: (Date.now() + 1).toString(),
        sender: 'JARVIS',
        text: responseText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: logType,
      };

      setLogs((prev) => [...prev, jarvisLog]);
      setIsProcessing(false);
    }, 800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Main Terminal Output (2 columns) */}
      <Card className="lg:col-span-2 glass-panel border-cyan-500/30 flex flex-col h-[520px]">
        <CardHeader className="border-b border-cyan-500/10 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2 font-mono text-cyan-300">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <span>COMMAND CONSOLE FEED</span>
            </CardTitle>
            <CardDescription className="font-mono text-xs text-slate-400">
              Direct neural interface & telemetry output log
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogs(defaultLogs)}
              className="text-xs font-mono text-slate-400 hover:text-cyan-300"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              CLEAR LOGS
            </Button>
          </div>
        </CardHeader>

        {/* Console Log Scroll Box */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-3.5 rounded-lg border transition-all ${
                log.sender === 'USER'
                  ? 'bg-slate-900/80 border-slate-700/60 ml-8 text-slate-200'
                  : 'bg-slate-950/90 border-cyan-500/30 mr-4 text-cyan-100 shadow-[0_0_12px_rgba(0,240,255,0.08)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5">
                  {log.sender === 'JARVIS' ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      <span className="text-cyan-400 font-mono">J.A.R.V.I.S. AI</span>
                    </>
                  ) : (
                    <span className="text-purple-400 font-mono">USER (BOSS)</span>
                  )}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{log.timestamp}</span>
              </div>
              <p className="leading-relaxed text-sm">{log.text}</p>
            </div>
          ))}
          {isProcessing && (
            <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs p-3 bg-cyan-950/30 rounded-lg border border-cyan-500/30">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>JARVIS is calculating response vectors...</span>
            </div>
          )}
        </CardContent>

        {/* Input Bar */}
        <div className="p-4 border-t border-cyan-500/20 bg-slate-950/60 flex items-center gap-3">
          <Button
            variant={isVoiceActive ? 'glow' : 'glass'}
            size="icon"
            onClick={() => setIsVoiceActive(!isVoiceActive)}
            title={isVoiceActive ? 'Voice Assistant Active' : 'Toggle Voice Mic'}
            className={isVoiceActive ? 'border-cyan-400 text-cyan-300 animate-pulse' : ''}
          >
            <Mic className="w-4 h-4" />
          </Button>

          <Input
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
            placeholder={isVoiceActive ? 'Listening for voice prompt...' : 'Type a command for JARVIS (e.g. Run diagnostics)...'}
            className="font-mono text-sm text-cyan-100 bg-slate-900/90 border-slate-800 focus:border-cyan-400"
          />

          <Button
            variant="default"
            onClick={() => handleSendCommand()}
            disabled={!inputCommand.trim() || isProcessing}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold"
          >
            <Send className="w-4 h-4 mr-1.5" />
            EXECUTE
          </Button>
        </div>
      </Card>

      {/* Quick Action Matrix & System Control Tabs */}
      <Card className="glass-panel border-purple-500/30 flex flex-col justify-between p-6">
        <div>
          <h3 className="text-base font-mono font-bold text-slate-100 mb-1 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            QUICK PROTOCOLS
          </h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">Preset JARVIS command macros</p>

          <div className="space-y-3">
            <Button
              variant="glow"
              className="w-full justify-start font-mono text-xs py-5"
              onClick={() => handleSendCommand('Run full system diagnostic')}
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-cyan-400" />
              RUN DIAGNOSTICS
            </Button>

            <Button
              variant="glass"
              className="w-full justify-start font-mono text-xs py-5 text-purple-300 hover:border-purple-500/40"
              onClick={() => handleSendCommand('Optimize neural cache & registers')}
            >
              <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
              OPTIMIZE CACHE
            </Button>

            <Button
              variant="glass"
              className="w-full justify-start font-mono text-xs py-5 text-emerald-300 hover:border-emerald-500/40"
              onClick={() => handleSendCommand('Deploy perimeter defense protocols')}
            >
              <ShieldAlert className="w-4 h-4 mr-2 text-emerald-400" />
              DEFENSE PROTOCOL
            </Button>
          </div>
        </div>

        {/* System Status Summary Widget */}
        <div className="mt-6 p-4 rounded-xl bg-slate-950/70 border border-slate-800 font-mono">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400">JARVIS STATUS:</span>
            <span className="text-emerald-400 font-bold">READY</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">SYSTEM HEALTH:</span>
            <span className="text-cyan-400 font-bold">100% PERFECT</span>
          </div>
        </div>
      </Card>

    </div>
  );
};
