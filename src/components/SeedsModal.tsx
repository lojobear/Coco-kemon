/**
 * ODDKIN FOUNDRY - Seeds Modal (Photo Seed & Sketch Seed)
 * Real-world camera capture -> material seed
 * Interactive canvas doodle pad -> latent morphology glyph
 */

import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../lib/gameStore';
import { sound } from '../lib/audio';
import { Camera, Edit3, X, Sparkles, Upload, RotateCcw } from 'lucide-react';

export function SeedsModal({ onClose }: { onClose: () => void }) {
  const { addPhotoSeedMaterial, applySketchSeedBonus } = useGame();

  const [activeMode, setActiveMode] = useState<'photo' | 'sketch'>('photo');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Sketch canvas refs & state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState<string>('#f59e0b');

  // File upload input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize sketch canvas
  useEffect(() => {
    if (activeMode === 'sketch' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [activeMode]);

  const clearCanvas = () => {
    sound.playClick();
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = brushColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // Submit Photo Seed
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processPhotoSeed = async () => {
    if (!photoPreview) return;
    setIsProcessing(true);
    sound.playSpark();

    try {
      const res = await fetch('/api/photo-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photoPreview }),
      });
      const data = await res.json();
      addPhotoSeedMaterial(data);
      onClose();
    } catch (err) {
      console.error(err);
      sound.playSpark();
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Sketch Seed
  const processSketchSeed = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    sound.playSpark();

    try {
      const drawingBase64 = canvasRef.current.toDataURL('image/png');
      const res = await fetch('/api/sketch-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingBase64 }),
      });
      const data = await res.json();
      applySketchSeedBonus(data);
      onClose();
    } catch (err) {
      console.error(err);
      sound.playSpark();
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Escape key
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
        {/* Header & Close */}
        <div className="flex items-center justify-between pb-2 border-b border-[#282f3d]">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => { sound.playClick(); setActiveMode('photo'); }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                activeMode === 'photo'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#212633] text-[#9ca3af] hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> PHOTO SEED
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveMode('sketch'); }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                activeMode === 'sketch'
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#212633] text-[#9ca3af] hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> SKETCH SEED
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#222733] text-[#9ca3af] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. PHOTO SEED TAB */}
        {activeMode === 'photo' && (
          <div className="space-y-3 text-xs">
            <p className="text-[#cbd5e1] leading-relaxed">
              Digitize a real-world object (e.g. coffee grounds, pebble, rusty washer, leaf) into an elemental material matrix seed.
            </p>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#343d4f] rounded-xl p-4 bg-[#121419] min-h-[180px]">
              {photoPreview ? (
                <div className="relative flex flex-col items-center">
                  <img
                    src={photoPreview}
                    alt="Seed specimen"
                    className="max-h-40 rounded-lg object-contain shadow"
                  />
                  <button
                    onClick={() => setPhotoPreview(null)}
                    className="mt-2 text-[10px] text-red-400 hover:underline"
                  >
                    Clear photo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 text-center">
                  <Camera className="w-8 h-8 text-[#9ca3af]" />
                  <span className="text-[11px] text-[#9ca3af]">Take or upload a specimen photo</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[#252b38] hover:bg-[#303848] text-amber-400 font-bold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Choose Photo
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <button
              onClick={processPhotoSeed}
              disabled={!photoPreview || isProcessing}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isProcessing ? 'ANALYZING SPECIMEN...' : 'DIGITIZE MATERIAL SEED'}
            </button>
          </div>
        )}

        {/* 2. SKETCH SEED TAB */}
        {activeMode === 'sketch' && (
          <div className="space-y-3 text-xs">
            <p className="text-[#cbd5e1] leading-relaxed">
              Doodle a morphological glyph (spirals, antennae, shell coils, horns). Gemini extracts its visual genome into a bio-morphology catalyst.
            </p>

            {/* Drawing Canvas */}
            <div className="relative border-2 border-[#374151] rounded-xl overflow-hidden bg-[#0f1115] flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={320}
                height={200}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
                className="w-full h-48 cursor-crosshair touch-none"
              />
            </div>

            {/* Colors & Clear */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {['#f59e0b', '#38bdf8', '#a855f7', '#10b981', '#ffffff'].map(c => (
                  <button
                    key={c}
                    onClick={() => setBrushColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      brushColor === c ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <button
                onClick={clearCanvas}
                className="px-2 py-1 rounded bg-[#252b38] hover:bg-[#303848] text-[10px] text-[#9ca3af] flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Clear Canvas
              </button>
            </div>

            <button
              onClick={processSketchSeed}
              disabled={isProcessing}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isProcessing ? 'INTERPRETING MORPHOLOGY...' : 'SYNTHESIZE MORPHOLOGY GLYPH'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
