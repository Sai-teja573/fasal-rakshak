
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneFrame, MiniAppContent } from './AppSimulator';

export const MobilePipeline = () => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "1. Capture",
      desc: "Farmer takes a photo of the affected crop using the app.",
      icon: "📸",
    },
    {
      title: "2. Analyze",
      desc: "Gemini AI + Sensors analyze symptoms and weather context.",
      icon: "🧠",
    },
    {
      title: "3. Resolve",
      desc: "Instant diagnosis, treatment plan, and medicine links.",
      icon: "💊",
    }
  ];

  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">How It Works</h2>
            <p className="text-slate-400">From field to pharmacy in 3 simple steps.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-12 lg:gap-24">
            
            {/* App Simulator Container */}
            <div className="relative w-[320px] h-[650px] perspective-1000">
                {/* Floating Icons Orbiting */}
                <motion.div 
                    className="absolute top-10 -right-12 w-16 h-16 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-3xl shadow-xl z-30"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                    {steps[step].icon}
                </motion.div>
                
                <PhoneFrame>
                    <MiniAppContent 
                        mode="mobile" 
                        isAutoPlay={true} 
                        onUserInteract={() => {}} 
                        onPhaseChange={(phase) => setStep(phase)}
                    />
                </PhoneFrame>

                {/* Shadow */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-40 h-4 bg-black/50 blur-xl rounded-full"></div>
            </div>

            {/* Steps Text */}
            <div className="flex flex-col gap-8 max-w-md">
                {steps.map((s, i) => (
                    <div 
                        key={i} 
                        className={`p-6 rounded-2xl border transition-all duration-500 ${step === i ? 'bg-slate-900 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.1)] scale-105' : 'bg-transparent border-slate-800 opacity-50'}`}
                    >
                        <h3 className={`text-xl font-bold mb-2 flex items-center gap-3 ${step === i ? 'text-green-400' : 'text-white'}`}>
                            <span className="text-2xl">{s.icon}</span> {s.title}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                    </div>
                ))}
            </div>

        </div>
      </div>
    </section>
  );
};
