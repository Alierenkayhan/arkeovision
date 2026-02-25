import React, { useEffect, useState } from 'react';

const SCAN_LABELS = ['Obje Algılanıyor...', 'Doku Analizi...', 'Kenar Tespiti...', 'Tarih Hesaplanıyor...'];

export const ScannerOverlay: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [labelIndex, setLabelIndex] = useState(0);
  const [boxPosition, setBoxPosition] = useState({ x: 20, y: 20, w: 60, h: 40 });

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setBoxPosition({
        x: 10 + Math.random() * 40,
        y: 10 + Math.random() * 30,
        w: 30 + Math.random() * 30,
        h: 30 + Math.random() * 30,
      });
      setLabelIndex(prev => (prev + 1) % SCAN_LABELS.length);
    }, 800);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(212,175,55,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.1)_1px,transparent_1px)] bg-[size:40px_40px] animate-pulse"></div>

      {/* Bounding Box */}
      <div
        className="absolute border-2 border-arch-gold/70 shadow-[0_0_15px_rgba(212,175,55,0.6)] transition-all duration-500 ease-out"
        style={{
          left: `${boxPosition.x}%`,
          top: `${boxPosition.y}%`,
          width: `${boxPosition.w}%`,
          height: `${boxPosition.h}%`,
        }}
      >
        <div className="absolute -top-7 left-0 bg-arch-gold text-arch-dark text-xs font-bold px-2 py-1 rounded-sm shadow-sm">
          AI: {SCAN_LABELS[labelIndex]}
        </div>
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-4 border-l-4 border-arch-gold -translate-x-0.5 -translate-y-0.5"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-4 border-r-4 border-arch-gold translate-x-0.5 -translate-y-0.5"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-4 border-l-4 border-arch-gold -translate-x-0.5 translate-y-0.5"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-4 border-r-4 border-arch-gold translate-x-0.5 translate-y-0.5"></div>
      </div>

      {/* Laser Scan Line */}
      <div className="absolute top-0 left-0 w-full h-full animate-scan-line z-20">
        <div className="h-1 w-full bg-arch-gold shadow-[0_0_20px_#d4af37,0_0_10px_#fff]"></div>
        <div className="h-32 w-full bg-gradient-to-b from-arch-gold/20 to-transparent"></div>
      </div>

      {/* Center Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white/20 rounded-full flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-laser shadow-[0_0_8px_red]"></div>
        <div className="absolute w-full h-full border-t border-b border-transparent border-l border-r border-white/10 rounded-full animate-spin"></div>
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/60"></div>
    </div>
  );
};