import React from 'react';
import { Cpu, HardDrive, Zap, Server } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const StatusPanel = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* Metric 1: CPU Neural Core */}
      <Card className="glass-panel glass-panel-hover border-cyan-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-mono text-slate-400">NEURAL CORE</p>
                <h4 className="text-xl font-bold font-mono text-slate-100">84.2 %</h4>
              </div>
            </div>
            <Badge variant="cyan" className="font-mono">3.8 GHz</Badge>
          </div>
          <div className="mt-4 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full w-[84%] transition-all duration-500 shadow-[0_0_10px_rgba(0,240,255,0.5)]"></div>
          </div>
        </CardContent>
      </Card>

      {/* Metric 2: Memory Matrix */}
      <Card className="glass-panel glass-panel-hover border-purple-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-mono text-slate-400">HOLOGRAPHIC RAM</p>
                <h4 className="text-xl font-bold font-mono text-slate-100">42.8 GB</h4>
              </div>
            </div>
            <Badge variant="violet" className="font-mono">64 GB MAX</Badge>
          </div>
          <div className="mt-4 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full w-[67%] transition-all duration-500 shadow-[0_0_10px_rgba(112,0,255,0.5)]"></div>
          </div>
        </CardContent>
      </Card>

      {/* Metric 3: Arc Reactor Energy */}
      <Card className="glass-panel glass-panel-hover border-emerald-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-mono text-slate-400">ARC REACTOR</p>
                <h4 className="text-xl font-bold font-mono text-slate-100">99.8 %</h4>
              </div>
            </div>
            <Badge variant="emerald" className="font-mono">STABLE</Badge>
          </div>
          <div className="mt-4 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full w-[99.8%] transition-all duration-500 shadow-[0_0_10px_rgba(0,255,136,0.5)]"></div>
          </div>
        </CardContent>
      </Card>

      {/* Metric 4: Cluster Nodes */}
      <Card className="glass-panel glass-panel-hover border-blue-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-mono text-slate-400">ACTIVE NODES</p>
                <h4 className="text-xl font-bold font-mono text-slate-100">128 / 128</h4>
              </div>
            </div>
            <Badge variant="cyan" className="font-mono">100% ONLINE</Badge>
          </div>
          <div className="mt-4 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full w-[100%] transition-all duration-500 shadow-[0_0_10px_rgba(0,114,255,0.5)]"></div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};
