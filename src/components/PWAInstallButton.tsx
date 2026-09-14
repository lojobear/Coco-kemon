import React, { useState } from 'react';
import { usePWAInstall } from '../lib/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';
import { haptics } from '../lib/haptics';
import { sound } from '../lib/audio';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'settings' | 'banner' }> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed or running standalone, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    sound.playClick();
    haptics.mediumTap();
    await install();
  };

  // Chromium / Android / Google Pixel flow
  if (isInstallable) {
    if (variant === 'settings') {
      return (
        <button
          onClick={handleInstallClick}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-mono font-bold text-xs shadow-md active:scale-95 transition-all"
        >
          <Smartphone className="w-4 h-4" />
          <span>Install App to Home Screen</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleInstallClick}
        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
        title="Install Oddkin Foundry as Android / Pixel App"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => {
            sound.playClick();
            haptics.lightTap();
            setShowIOSGuide(true);
          }}
          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#3e4451] bg-[#1e2229] hover:bg-[#282e38] text-[#d1d5db] font-mono text-xs flex items-center gap-1.5 transition-colors"
          title="Install on iOS"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="w-full max-w-sm rounded-2xl bg-[#181b20] border border-[#2e3440] p-6 shadow-2xl text-slate-100 font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-[#282d37]">
                <h3 className="text-sm font-bold text-[#f3f4f6] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" /> Install on iOS
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
                1. Tap the <strong className="text-amber-400">Share</strong> icon in Safari toolbar.<br />
                2. Scroll down and select <strong className="text-amber-400">Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs active:scale-95 transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
