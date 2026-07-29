import React, { useState, useEffect } from 'react';
import { ShieldCheck, Bell, Sparkles, Terminal, Activity, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export const Header = () => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Reactor Core Logo */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full border border-cyan-400/50 bg-cyan-950/40 shadow-[0_0_15px_rgba(0,240,255,0.4)] group cursor-pointer">
            <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping opacity-25"></div>
            <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-lg font-extrabold tracking-widest bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                J.A.R.V.I.S.
              </span>
              <Badge variant="cyan" className="font-mono text-[10px]">v3.6 ULTRA</Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              SYSTEM ONLINE
            </p>
          </div>
        </div>

        {/* Telemetry Status Indicators */}
        <div className="hidden md:flex items-center space-x-6 text-xs font-mono">
          <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">LATENCY:</span>
            <span className="text-cyan-300 font-bold">12ms</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">SECURITY:</span>
            <span className="text-emerald-400 font-bold">LEVEL 5 ACTIVE</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">CLOCK:</span>
            <span className="text-slate-200 font-bold">{time || '00:00:00'}</span>
          </div>
        </div>

        {/* Action Controls & Profile */}
        <div className="flex items-center space-x-3">
          <Button variant="glow" size="sm" className="hidden sm:flex items-center gap-2 font-mono">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            HUD CONSOLE
          </Button>

          <Button variant="ghost" size="icon" className="relative text-slate-300 hover:text-cyan-400">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          </Button>

          <Avatar className="cursor-pointer border border-cyan-500/40">
            <AvatarFallback>ST</AvatarFallback>
          </Avatar>
        </div>

      </div>
    </header>
  );
};
