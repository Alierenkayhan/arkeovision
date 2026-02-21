import React from 'react';

interface VRViewerProps {
  imageSrc: string;
  era: string;
  onExit: () => void;
}

export const VRViewer: React.FC<VRViewerProps> = ({ imageSrc, era, onExit }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Controls Overlay */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
        <div className="bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md border border-white/20 pointer-events-auto flex items-center gap-4">
          <span className="font-serif text-arch-gold">{era} Dönemi</span>
          <button 
            onClick={onExit}
            className="hover:text-red-400 font-bold border-l border-white/20 pl-4"
          >
            ÇIKIŞ
          </button>
        </div>
      </div>

      {/* Stereoscopic View */}
      <div className="flex-1 flex w-full h-full relative">
        {/* Left Eye */}
        <div className="w-1/2 h-full border-r-2 border-black relative overflow-hidden group">
          <img 
            src={imageSrc} 
            alt="VR Left" 
            className="absolute h-full w-auto max-w-none object-cover left-1/2 -translate-x-1/2 animate-pulse-slow" 
            style={{ minWidth: '120%' }}
          />
          <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] pointer-events-none"></div>
          <div className="absolute bottom-10 left-10 w-4 h-4 rounded-full bg-white/50 backdrop-blur-sm"></div>
        </div>

        {/* Right Eye */}
        <div className="w-1/2 h-full border-l-2 border-black relative overflow-hidden">
          <img 
            src={imageSrc} 
            alt="VR Right" 
            className="absolute h-full w-auto max-w-none object-cover left-1/2 -translate-x-1/2 animate-pulse-slow" 
            style={{ minWidth: '120%' }}
          />
          <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] pointer-events-none"></div>
          <div className="absolute bottom-10 left-10 w-4 h-4 rounded-full bg-white/50 backdrop-blur-sm"></div>
        </div>

        {/* VR Divider Line Helper */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-1/2 pointer-events-none"></div>
      </div>

      <div className="absolute bottom-4 w-full text-center text-white/50 text-xs pointer-events-none">
        Telefonunuzu VR gözlüğüne yerleştirin
      </div>
    </div>
  );
};
