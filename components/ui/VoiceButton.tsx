import React, { useEffect, useRef } from 'react';

export type VoiceButtonState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

interface VoiceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state: VoiceButtonState;
  onPress: () => void;
  label?: React.ReactNode;
  trailing?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  feedbackDuration?: number;
  stream?: MediaStream | null;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  state,
  onPress,
  label,
  trailing,
  icon,
  variant = 'outline',
  size = 'default',
  className = '',
  feedbackDuration = 1500,
  stream,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (state === 'recording' && stream && canvasRef.current) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({});
      }
      const ctx = audioContextRef.current;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; 
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const draw = () => {
        if (!analyserRef.current || !canvasCtx) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const width = canvas.width;
        const height = canvas.height;
        canvasCtx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          canvasCtx.fillStyle = `rgb(22, 163, 74)`; 
          const y = (height - barHeight) / 2;
          if (barHeight > 0) {
              canvasCtx.beginPath();
              // Simulating roundRect for broader compatibility
              if (canvasCtx.roundRect) {
                  canvasCtx.roundRect(x, y, barWidth - 1, barHeight, 2);
              } else {
                  canvasCtx.rect(x, y, barWidth - 1, barHeight);
              }
              canvasCtx.fill();
          }
          x += barWidth + 1;
        }
        animationRef.current = requestAnimationFrame(draw);
      };
      draw();

      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (analyserRef.current) analyserRef.current.disconnect();
      };
    } else {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  }, [state, stream]);

  const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all focus-visible:outline-none disabled:opacity-50";
  const variantStyles = {
    default: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900",
    destructive: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-100",
    secondary: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
    ghost: "hover:bg-slate-100 dark:hover:bg-slate-800",
    link: "underline-offset-4 hover:underline"
  };
  const sizeStyles = {
    default: "h-12 py-3 px-6 text-sm",
    sm: "h-9 px-3 rounded-lg text-xs",
    lg: "h-14 px-8 rounded-2xl text-base",
    icon: "h-12 w-12"
  };

  let stateStyles = "";
  if (state === 'recording') stateStyles = "bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400";
  if (state === 'success') stateStyles = "bg-green-50 border-green-200 text-green-600 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400";
  if (state === 'error') stateStyles = "bg-red-50 border-red-200 text-red-600";

  return (
    <button onClick={onPress} className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${stateStyles} ${className} relative overflow-hidden`} {...props}>
      {state === 'recording' && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" width={100} height={40} />}
      <div className="relative z-10 flex items-center gap-2">
        {state === 'idle' && <>{icon && <span className="text-lg">{icon}</span>}{label && <span>{label}</span>}</>}
        {state === 'recording' && <div className="flex items-center gap-2 animate-pulse"><div className="w-3 h-3 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div><span className="font-bold">Recording...</span></div>}
        {state === 'processing' && <div className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Processing</span></div>}
        {state === 'success' && <div className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Done</span></div>}
        {state === 'error' && <div className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>Error</span></div>}
        {trailing && state === 'idle' && <span className="ml-2 text-xs opacity-50 border border-current px-1.5 py-0.5 rounded">{trailing}</span>}
      </div>
    </button>
  );
};