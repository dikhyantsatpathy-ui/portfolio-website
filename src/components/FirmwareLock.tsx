import React, { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

interface FirmwareLockProps {
  onClose: () => void;
}

export const FirmwareLock = ({ onClose }: FirmwareLockProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[99999] bg-red-900/90 backdrop-blur-sm flex flex-col items-center justify-center font-mono">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="animate-pulse flex flex-col items-center text-center max-w-lg p-8 bg-black/80 border-2 border-red-500 rounded-lg shadow-[0_0_100px_rgba(239,68,68,0.5)]">
        <ShieldAlert className="w-24 h-24 text-red-500 mb-6" />
        <h1 className="text-4xl font-bold text-red-500 mb-4 tracking-tighter">FIRMWARE LOCK ENGAGED</h1>
        <p className="text-red-400 text-lg uppercase tracking-widest">
          Unauthorized debugging prevented.
        </p>
        <p className="text-red-500/50 text-sm mt-8">System resetting in 3 seconds...</p>
      </div>
      {/* Glitch overlays */}
      <div className="absolute inset-0 pointer-events-none bg-red-500/10 mix-blend-screen animate-[ping_0.2s_ease-in-out_infinite]" />
    </div>
  );
};
