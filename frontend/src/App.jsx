import React, { useState } from 'react';
import Nabbar from './components/Nabbar';
import VoiceReactiveOrb from './components/blob';
import Terminal from './components/Terminal';
import Status from './components/Status';
import './App.css';

const DEFAULT_BLOB_CONFIG = {
  brightColor: '#00ffe1',
  midColor: '#0084ff',
  deepColor: '#001433',
  scale: 1.0,
  sensitivity: 5.5,
  position: { x: 0, y: 0 },
  isDragEnabled: false,
};

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [micStatus, setMicStatus] = useState('idle');
  const [isListening, setIsListening] = useState(false);
  const [blobConfig, setBlobConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('jarvis_blob_config');
      return saved ? JSON.parse(saved) : DEFAULT_BLOB_CONFIG;
    } catch {
      return DEFAULT_BLOB_CONFIG;
    }
  });

  const handleSaveBlobConfig = () => {
    try {
      localStorage.setItem('jarvis_blob_config', JSON.stringify(blobConfig));
    } catch (e) {
      console.warn('Could not save blob config to localStorage:', e);
    }
  };

  const handlePositionChange = (newPos) => {
    setBlobConfig((prev) => ({
      ...prev,
      position: newPos,
    }));
  };

  return (
    <div className="App min-h-screen relative flex flex-col justify-between overflow-x-hidden">
      {/* Floating Liquid Glass Navigation Bar */}
      <Nabbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        blobConfig={blobConfig}
        setBlobConfig={setBlobConfig}
        onSaveBlobConfig={handleSaveBlobConfig}
      />

      {/* Top-Right System Status HUD Panel */}
      <Status
        micStatus={micStatus}
        isListening={isListening}
        isAiSpeaking={isAiSpeaking}
      />

      {/* Main Center Area: Centered Voice Reactive Blob Component */}
      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-4">
        <div className="w-full max-w-5xl flex items-center justify-center">
          <VoiceReactiveOrb
            blobConfig={blobConfig}
            onPositionChange={handlePositionChange}
            isAiSpeaking={isAiSpeaking}
            isMicActive={isListening}
          />
        </div>
      </main>

      {/* Bottom Right Area: Speech Recognition Terminal */}
      <Terminal
        blobConfig={blobConfig}
        onAiSpeakingChange={setIsAiSpeaking}
        onMicStatusChange={setMicStatus}
        onListeningChange={setIsListening}
      />
    </div>
  );
}

export default App;
