
import React from 'react';

interface LoadingScreenProps {
  text?: string;
  className?: string;
  overlay?: boolean; // If true, absolute positioning within a container. If false, fixed full screen.
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  text = "Cultivating Data...", 
  className = "",
  overlay = false
}) => {
  return (
    <div 
      className={`
        ${overlay ? 'absolute bg-white/50 dark:bg-slate-900/50' : 'fixed bg-white/80 dark:bg-slate-900/90'} inset-0 z-50 flex flex-col items-center justify-center 
        backdrop-blur-sm transition-all duration-300
        ${className}
      `}
    >
      <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
        {/* Outer Rotating Ring (Sun rays / Cycle) */}
        <div className="absolute inset-0 border-4 border-green-200 dark:border-green-900 rounded-full opacity-50"></div>
        <div className="absolute inset-0 border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        
        {/* Inner Pulsing Glow */}
        <div className="absolute inset-4 bg-green-100 dark:bg-green-900/40 rounded-full animate-pulse"></div>

        {/* Crop Icon (Growing) */}
        <div className="relative z-10 text-green-600 dark:text-green-400 animate-[bounce_2s_infinite]">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22v-8" />
                <path d="M12 14c0-2.5-2-4-2-4s-2.5 2-2.5 4a2.5 2.5 0 0 0 5 0Z" />
                <path d="M12 14c0-2.5 2-4 2-4s2.5 2 2.5 4a2.5 2.5 0 0 1 5 0Z" />
                <path d="M12 22h-4" />
                <path d="M12 22h4" />
                <path d="M7 22H2" className="opacity-0"/> 
            </svg>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight animate-pulse">{text}</h3>
      
      <div className="mt-3 flex gap-2">
        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2.5 h-2.5 bg-green-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2.5 h-2.5 bg-green-700 rounded-full animate-bounce"></span>
      </div>
      
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">Please wait while we check the fields...</p>
    </div>
  );
};
