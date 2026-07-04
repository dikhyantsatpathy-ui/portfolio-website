import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

export const DraggableWindow = ({ title, children, onClose }: any) => {
  return (
    <motion.div
      drag
      dragMomentum={false}
      className="absolute top-1/4 left-1/4 w-[90vw] sm:w-[600px] h-[60vh] sm:h-[500px] bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/20 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[100] flex flex-col"
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      <div className="h-10 bg-white/5 border-b border-white/10 flex items-center px-4 justify-between cursor-grab active:cursor-grabbing">
        <span className="text-xs font-mono text-gray-300">{title}</span>
        <div className="flex gap-2">
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors" />
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-400 transition-colors" />
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors flex items-center justify-center group">
            <span className="text-[8px] text-black opacity-0 group-hover:opacity-100 font-bold">x</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pointer-events-auto p-0 relative">
        {children}
      </div>
    </motion.div>
  );
};
