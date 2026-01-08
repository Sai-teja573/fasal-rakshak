
import React, { createContext, useContext, useRef, useState } from 'react';

interface ScrubBarContextType {
  duration: number;
  value: number;
  isDragging: boolean;
  onScrubStart: () => void;
  onScrub: (time: number) => void;
  onScrubEnd: () => void;
}

const ScrubBarContext = createContext<ScrubBarContextType | undefined>(undefined);

interface ScrubBarContainerProps {
  duration: number;
  value: number;
  onScrub: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const ScrubBarContainer: React.FC<ScrubBarContainerProps> = ({
  duration,
  value,
  onScrub,
  onScrubStart,
  onScrubEnd,
  children,
  className = ""
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleScrubStart = () => { setIsDragging(true); onScrubStart?.(); };
  const handleScrubEnd = () => { setIsDragging(false); onScrubEnd?.(); };

  return (
    <ScrubBarContext.Provider value={{ duration, value, isDragging, onScrub, onScrubStart: handleScrubStart, onScrubEnd: handleScrubEnd }}>
      <div className={`flex items-center gap-3 select-none w-full ${className}`}>{children}</div>
    </ScrubBarContext.Provider>
  );
};

export const ScrubBarTrack: React.FC<{ className?: string, children: React.ReactNode }> = ({ className = "", children }) => {
  const context = useContext(ScrubBarContext);
  if (!context) throw new Error("ScrubBarTrack must be used within ScrubBarContainer");
  const trackRef = useRef<HTMLDivElement>(null);

  const calculateTime = (clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * context.duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    context.onScrubStart();
    context.onScrub(calculateTime(e.clientX));
    const handlePointerMove = (e: PointerEvent) => context.onScrub(calculateTime(e.clientX));
    const handlePointerUp = () => {
        context.onScrubEnd();
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div ref={trackRef} className={`relative h-8 flex items-center flex-1 cursor-pointer group ${className}`} onPointerDown={handlePointerDown}>
        <div className="absolute left-0 right-0 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"></div>
        {children}
    </div>
  );
};

export const ScrubBarProgress: React.FC<{ className?: string }> = ({ className = "" }) => {
  const context = useContext(ScrubBarContext);
  if (!context) throw new Error("ScrubBarProgress must be used within ScrubBarContainer");
  const percent = context.duration > 0 ? (context.value / context.duration) * 100 : 0;
  return <div className={`absolute left-0 h-1.5 bg-green-500 rounded-full pointer-events-none transition-all duration-75 ${className}`} style={{ width: `${percent}%` }} />;
};

export const ScrubBarThumb: React.FC<{ className?: string }> = ({ className = "" }) => {
  const context = useContext(ScrubBarContext);
  if (!context) throw new Error("ScrubBarThumb must be used within ScrubBarContainer");
  const percent = context.duration > 0 ? (context.value / context.duration) * 100 : 0;
  return <div className={`absolute h-4 w-4 bg-white border-2 border-green-500 rounded-full shadow-md transform -translate-x-1/2 transition-transform duration-75 pointer-events-none group-hover:scale-125 ${context.isDragging ? 'scale-125' : ''} ${className}`} style={{ left: `${percent}%` }} />;
};

export const ScrubBarTimeLabel: React.FC<{ time: number, format?: (t: number) => string, className?: string }> = ({ time, format, className = "" }) => {
  const defaultFormat = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  return <span className={`text-xs font-mono font-medium text-slate-500 dark:text-slate-400 w-10 text-center ${className}`}>{format ? format(time) : defaultFormat(time)}</span>;
};
