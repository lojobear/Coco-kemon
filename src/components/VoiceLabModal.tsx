/**
 * ODDKIN FOUNDRY - Voice Lab Modal
 * Natural speech interaction with speech recognition
 * directly feeding into the synthesis engine.
 */

import React, { useState, useEffect } from 'react';
import { useGame } from '../lib/gameStore';
import { requestJson } from '../lib/api';
import { sound } from '../lib/audio';
import { Mic, MicOff, X, Sparkles, Volume2, ArrowRight } from 'lucide-react';

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function VoiceLabModal({ onClose }: { onClose: () => void }) {
  const {
    materials,
    processes,
    setSlotA,
    setSlotB,
    setSelectedProcess,
    runSynthesis,
    setActiveTab,
  } = useGame();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Tap microphone to speak an experiment command');

  // Voice recognition setup
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechClass) {
      const rec = new SpeechClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (e: SpeechRecognitionEvent) => {
        const text = e.results[0][0].transcript;
        setTranscript(text);
        setIsListening(false);
        processVoiceCommand(text);
      };

      rec.onerror = () => {
        setIsListening(false);
        setStatusMessage('Could not recognize voice. Try sample commands below.');
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    sound.playClick();
    if (!recognitionRef.current) {
      setStatusMessage('Speech recognition not supported in this browser. Use sample commands below.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setStatusMessage('Listening for laboratory command...');
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const processVoiceCommand = async (text: string) => {
    setIsAnalyzing(true);
    sound.playSpark();
    setStatusMessage(`Interpreting: "${text}"...`);

    try {
      const data = await requestJson<any>('/api/voice-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          // The server only needs ids and names; full materials carry sprite images.
          availableMaterials: materials.map(m => ({ id: m.id, displayName: m.displayName })),
          availableProcesses: processes.map(p => ({ id: p.id, name: p.name })),
        }),
      });

      if (data.recognized && data.processId && data.materialAId) {
        const matA = materials.find(m => m.id === data.materialAId);
        const matB = materials.find(m => m.id === data.materialBId);
        const proc = processes.find(p => p.id === data.processId);

        if (matA && proc) {
          setSlotA(matA);
          setSlotB(matB || null);
          setSelectedProcess(proc);
          setActiveTab('foundry');
          onClose();
          setTimeout(() => {
            runSynthesis();
          }, 300);
          return;
        }
      }

      setStatusMessage(`Interpreted command. Matched ingredients: ${data.recognized ? 'Configured!' : 'Could not fully match.'}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to parse voice command. Please retry.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sampleCommands = [
    'Mix Soil and Water',
    'Freeze Water into Ice',
    'Dry Mud into Clay',
    'Incubate Plant matter',
    'Heat Clay into Ceramic',
    'Crush Stone into Sand',
  ];

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none animate-fadeIn"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[#181b22] border-2 border-[#333b4b] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 relative"
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#282f3d]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#f59e0b]">
            <Mic className="w-4 h-4" />
            <span>VOICE LAB INTERFACE</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#222733] text-[#9ca3af] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#cbd5e1] leading-relaxed">
          Speak natural experimental hypotheses directly to the foundry (e.g., "Mix soil and water", "Freeze water", "Incubate plant matter").
        </p>

        {/* Big Microphone button */}
        <div className="py-6 flex flex-col items-center justify-center space-y-3">
          <button
            onClick={toggleListening}
            className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all ${
              isListening
                ? 'bg-red-600 border-red-400 text-white animate-pulse shadow-[0_0_24px_rgba(239,68,68,0.5)]'
                : 'bg-[#222733] hover:bg-[#2b3240] border-[#3e4659] text-amber-400'
            }`}
          >
            {isListening ? <Mic className="w-8 h-8 animate-bounce" /> : <MicOff className="w-8 h-8" />}
          </button>

          <div className="text-xs text-center font-bold text-[#e5e7eb]">
            {isListening ? 'LISTENING NOW...' : statusMessage}
          </div>

          {transcript && (
            <div className="text-xs text-[#f59e0b] bg-[#111317] px-3 py-1.5 rounded-lg border border-[#2b3140]">
              "{transcript}"
            </div>
          )}
        </div>

        {/* Quick Sample Voice Prompts */}
        <div className="space-y-1.5 pt-2 border-t border-[#282f3d]">
          <div className="text-[10px] font-bold text-[#9ca3af] uppercase">
            OR TEST VOICE PHRASES:
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            {sampleCommands.map(cmd => (
              <button
                key={cmd}
                onClick={() => {
                  sound.playClick();
                  setTranscript(cmd);
                  processVoiceCommand(cmd);
                }}
                className="p-2 rounded-lg bg-[#14161c] hover:bg-[#202532] border border-[#282e3c] text-left text-stone-300 hover:text-white truncate transition-colors flex items-center justify-between"
              >
                <span className="truncate">{cmd}</span>
                <ArrowRight className="w-3 h-3 text-[#f59e0b] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
