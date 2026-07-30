import React, { useState, useEffect } from 'react';
import { Sparkles, Terminal, Shield, Cpu, Activity, Search, Menu, X, Settings, Move, Palette, Sliders, Save, Check, Volume2 } from 'lucide-react';

export const Nabbar = ({ activeTab = 'overview', onTabChange, blobConfig, setBlobConfig, onSaveBlobConfig }) => {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('blob');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const colorPresets = [
    { name: 'Cyan Glow', bright: '#00ffe1', mid: '#0084ff', deep: '#001433' },
    { name: 'Neon Purple', bright: '#d946ef', mid: '#8b5cf6', deep: '#2e1065' },
    { name: 'Emerald Wave', bright: '#00ff88', mid: '#10b981', deep: '#022c22' },
    { name: 'Solar Amber', bright: '#ffbb00', mid: '#f59e0b', deep: '#451a03' },
    { name: 'Crimson Core', bright: '#ff2a5f', mid: '#e11d48', deep: '#4c0519' },
  ];

  const navItems = [
    { id: 'overview', label: 'OVERVIEW', icon: Activity },
    { id: 'neural', label: 'NEURAL CORE', icon: Cpu },
    { id: 'security', label: 'SECURITY', icon: Shield },
    { id: 'terminal', label: 'TERMINAL', icon: Terminal },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (id) => {
    setCurrentTab(id);
    if (onTabChange) onTabChange(id);
    setIsMobileMenuOpen(false);
  };

  const handleColorSelect = (preset) => {
    setBlobConfig((prev) => ({
      ...prev,
      brightColor: preset.bright,
      midColor: preset.mid,
      deepColor: preset.deep,
    }));
  };

  const handleScaleChange = (e) => {
    const newScale = parseFloat(e.target.value);
    setBlobConfig((prev) => ({
      ...prev,
      scale: newScale,
    }));
  };

  const handleSensitivityChange = (e) => {
    const newSensitivity = parseFloat(e.target.value);
    setBlobConfig((prev) => ({
      ...prev,
      sensitivity: newSensitivity,
    }));
  };

  const handleSpeedChange = (e) => {
    const speed = parseFloat(e.target.value);
    setBlobConfig((prev) => ({
      ...prev,
      speed,
    }));
  };

  const handleSpikesChange = (e) => {
    const spikes = parseFloat(e.target.value);
    setBlobConfig((prev) => ({
      ...prev,
      spikes,
    }));
  };

  const handleProcessingChange = (e) => {
    const processing = parseFloat(e.target.value);
    setBlobConfig((prev) => ({
      ...prev,
      processing,
    }));
  };

  const toggleDragMode = () => {
    setBlobConfig((prev) => ({
      ...prev,
      isDragEnabled: !prev.isDragEnabled,
    }));
  };

  const handleSave = () => {
    if (onSaveBlobConfig) onSaveBlobConfig();
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  return (
    <nav className="fixed top-4 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 transition-all duration-500">
      {/* Outer Wrapper for Drop-Shadow glow on Clipped Polygon & High Z-Index Modal */}
      <div className="max-w-7xl mx-auto filter drop-shadow-[0_8px_24px_rgba(0,240,255,0.25)] relative z-50">
        
        {/* Futuristic Angular Sci-Fi HUD Polygon Container */}
        <div
          className={`transition-all duration-500 relative backdrop-blur-2xl py-3.5 px-6 border-y border-cyan-400/40 ${
            isScrolled ? 'bg-slate-950/80 py-2.5 px-5' : 'bg-slate-900/50'
          }`}
          style={{
            clipPath: 'polygon(22px 0%, 100% 0%, calc(100% - 28px) 100%, 0% 100%)',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.12) 0%, rgba(15, 23, 42, 0.85) 50%, rgba(112, 0, 255, 0.1) 100%)',
          }}
        >
          {/* Futuristic HUD Corner Accent Lines */}
          <div className="absolute top-0 left-[22px] w-8 h-[2px] bg-gradient-to-r from-cyan-400 to-transparent"></div>
          <div className="absolute bottom-0 right-[28px] w-8 h-[2px] bg-gradient-to-l from-cyan-400 to-transparent"></div>

          <div className="flex items-center justify-between pl-4 pr-6">
            
            {/* Brand Logo */}
            <div className="flex items-center space-x-3 cursor-pointer group">
              <div 
                className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-cyan-500/30 via-slate-900 to-purple-500/30 border border-cyan-400/50 shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-transform duration-300 group-hover:scale-105"
                style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}
              >
                <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse relative z-10" />
              </div>
              <div>
                <span className="font-mono text-xl font-black tracking-widest bg-gradient-to-r from-cyan-300 via-blue-200 to-purple-300 bg-clip-text text-transparent">
                  J.A.R.V.I.S.
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(0,255,136,0.8)] animate-pulse"></span>
                  <span className="tracking-wider">ANGULAR HUD FRAME</span>
                </div>
              </div>
            </div>

            {/* Navigation Links - Futuristic Polygon Tabs */}
            <div className="hidden md:flex items-center space-x-1.5 p-1 bg-slate-950/60 border border-cyan-500/30 backdrop-blur-md" style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`relative flex items-center space-x-2 px-4 py-2 text-xs font-mono font-medium transition-all duration-300 ${
                      isActive
                        ? 'text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    style={isActive ? { clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' } : {}}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-blue-500/20 to-purple-500/30 border-y border-cyan-400/60 backdrop-blur-xl"></div>
                    )}
                    <Icon className={`w-3.5 h-3.5 relative z-10 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                    <span className="relative z-10 tracking-wider">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Settings Trigger & Action Controls */}
            <div className="flex items-center space-x-3">
              
              {/* Settings Button */}
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-mono font-medium transition-all duration-300 border backdrop-blur-md cursor-pointer ${
                  isSettingsOpen
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                    : 'bg-slate-950/60 border-cyan-500/30 text-slate-300 hover:text-white hover:border-cyan-400/60'
                }`}
                style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}
              >
                <Settings className={`w-4 h-4 text-cyan-400 ${isSettingsOpen ? 'rotate-90 transition-transform duration-300' : ''}`} />
                <span className="hidden sm:inline">SETTINGS</span>
              </button>

              {/* Mobile Menu Toggle */}
              <div className="md:hidden flex items-center">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 rounded-xl bg-slate-900/60 border border-white/10 text-cyan-300 hover:bg-cyan-500/10"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>

            </div>

          </div>

          {/* Mobile Dropdown Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-white/10 flex flex-col space-y-2 font-mono">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center space-x-3 px-4 py-3 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                    style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
                  >
                    <Icon className="w-4 h-4 text-cyan-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Liquid Glass Settings Dropdown Floating Modal — Placed Outside clipPath Container */}
        {isSettingsOpen && (
          <div className="absolute top-16 right-4 w-80 sm:w-96 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_16px_48px_rgba(0,240,255,0.35)] backdrop-blur-3xl p-5 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center space-x-2 font-mono text-sm font-bold text-cyan-300">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span>SYSTEM SETTINGS</span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Settings Tab Pill */}
            <div className="flex space-x-2 p-1 rounded-lg bg-slate-900 border border-white/10 mb-4 text-xs font-mono">
              <button
                onClick={() => setActiveSettingsTab('blob')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  activeSettingsTab === 'blob'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                BLOB OPTIONS
              </button>
            </div>

            {/* BLOB OPTIONS SECTION */}
            {activeSettingsTab === 'blob' && (
              <div className="space-y-4 text-xs font-mono">
                
                {/* 1. COLOR OPTION */}
                <div>
                  <label className="flex items-center space-x-2 text-slate-300 font-semibold mb-2">
                    <Palette className="w-3.5 h-3.5 text-cyan-400" />
                    <span>1. BLOB COLOR PALETTE</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleColorSelect(preset)}
                        title={preset.name}
                        className={`h-8 rounded-lg border transition-all flex items-center justify-center relative ${
                          blobConfig?.brightColor === preset.bright
                            ? 'border-white shadow-[0_0_12px_rgba(255,255,255,0.8)] scale-105'
                            : 'border-white/20 hover:border-white/50'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${preset.bright}, ${preset.mid})`,
                        }}
                      >
                        {blobConfig?.brightColor === preset.bright && (
                          <span className="w-2 h-2 rounded-full bg-white shadow-sm"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. SIZE OPTION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center space-x-2 text-slate-300 font-semibold">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>2. BLOB SIZE SCALE</span>
                    </label>
                    <span className="text-cyan-300 font-bold">
                      {blobConfig?.scale ? blobConfig.scale.toFixed(1) : '1.0'}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={blobConfig?.scale || 1.0}
                    onChange={handleScaleChange}
                    className="jarvis-range w-full"
                  />
                </div>

                {/* 3. SENSITIVITY OPTION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center space-x-2 text-slate-300 font-semibold">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>3. MIC SENSITIVITY</span>
                    </label>
                    <span className="text-cyan-300 font-bold">
                      {blobConfig?.sensitivity !== undefined ? blobConfig.sensitivity.toFixed(1) : '5.5'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="12.0"
                    step="0.5"
                    value={blobConfig?.sensitivity !== undefined ? blobConfig.sensitivity : 5.5}
                    onChange={handleSensitivityChange}
                    className="jarvis-range w-full"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1.0 (Low)</span>
                    <span>5.5 (Responsive)</span>
                    <span>12.0 (High)</span>
                  </div>
                </div>

                {/* 4. SPEED OPTION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center space-x-2 text-slate-300 font-semibold">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>4. BLOB SPEED</span>
                    </label>
                    <span className="text-cyan-300 font-bold">
                      {blobConfig?.speed !== undefined ? blobConfig.speed.toFixed(0) : '13'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="1"
                    value={blobConfig?.speed !== undefined ? blobConfig.speed : 13}
                    onChange={handleSpeedChange}
                    className="jarvis-range w-full"
                  />
                </div>

                {/* 5. SPIKES OPTION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center space-x-2 text-slate-300 font-semibold">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>5. BLOB SPIKES</span>
                    </label>
                    <span className="text-cyan-300 font-bold">
                      {blobConfig?.spikes !== undefined ? blobConfig.spikes.toFixed(2) : '0.60'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="2"
                    step="0.05"
                    value={blobConfig?.spikes !== undefined ? blobConfig.spikes : 0.6}
                    onChange={handleSpikesChange}
                    className="jarvis-range w-full"
                  />
                </div>

                {/* 6. PROCESSING OPTION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center space-x-2 text-slate-300 font-semibold">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>6. BLOB PROCESSING</span>
                    </label>
                    <span className="text-cyan-300 font-bold">
                      {blobConfig?.processing !== undefined ? blobConfig.processing.toFixed(2) : '1.00'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="2.4"
                    step="0.01"
                    value={blobConfig?.processing !== undefined ? blobConfig.processing : 1.0}
                    onChange={handleProcessingChange}
                    className="jarvis-range w-full"
                  />
                </div>

                {/* 7. DRAG & DROP POSITION OPTION */}
                <div className="pt-2 border-t border-white/10">
                  <label className="flex items-center justify-between text-slate-300 font-semibold mb-2">
                    <span className="flex items-center space-x-2">
                      <Move className="w-3.5 h-3.5 text-cyan-400" />
                      <span>7. DRAG & DROP POSITION</span>
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      blobConfig?.isDragEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {blobConfig?.isDragEnabled ? 'DRAG ACTIVE' : 'LOCKED'}
                    </span>
                  </label>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={toggleDragMode}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        blobConfig?.isDragEnabled
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                          : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Move className="w-3.5 h-3.5 inline mr-1.5" />
                      {blobConfig?.isDragEnabled ? 'DISABLE DRAGGING' : 'ENABLE DRAG MODE'}
                    </button>

                    <button
                      onClick={handleSave}
                      className="py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-400 text-slate-950 font-bold hover:from-cyan-300 hover:to-blue-300 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all flex items-center gap-1.5"
                    >
                      {isSavedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      <span>{isSavedNotice ? 'SAVED!' : 'SAVE'}</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </nav>
  );
};

export default Nabbar;
