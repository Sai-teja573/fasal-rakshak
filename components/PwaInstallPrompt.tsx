
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PwaInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already in standalone mode
        const isStandaloneQuery = window.matchMedia('(display-mode: standalone)');
        setIsStandalone(isStandaloneQuery.matches || (navigator as any).standalone);

        // Detect Platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(userAgent)) {
            setPlatform('ios');
            // Show prompt for iOS if not standalone (delay slightly for UX)
            if (!(navigator as any).standalone) {
                setTimeout(() => setShowPrompt(true), 2000);
            }
        } else if (/android/.test(userAgent)) {
            setPlatform('android');
        }

        // Listen for install event (Android/Desktop)
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!isStandaloneQuery.matches) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setShowPrompt(false);
            }
        }
    };

    if (isStandalone || !showPrompt) return null;

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="fixed bottom-0 left-0 right-0 z-[100] p-4 flex justify-center items-end pointer-events-none"
                >
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md pointer-events-auto relative overflow-hidden">
                        
                        {/* Close Button */}
                        <button 
                            onClick={() => setShowPrompt(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            ✕
                        </button>

                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                                🌱
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Install Fasal Rakshak</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Install our App for a better experience, offline access, and full screen view.
                                </p>
                            </div>
                        </div>

                        {/* IOS TUTORIAL */}
                        {platform === 'ios' && (
                            <div className="mt-6 space-y-4">
                                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-xs">1</span>
                                    <span>Tap the <span className="font-bold"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mb-1 mx-1 text-blue-500"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg> Share</span> button below</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-xs">2</span>
                                    <span>Select <span className="font-bold">Add to Home Screen</span></span>
                                </div>
                                
                                {/* Animated Finger for iOS */}
                                <motion.div 
                                    className="absolute bottom-[-10px] left-1/2 text-4xl pointer-events-none"
                                    animate={{ y: [0, 20, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    👇
                                </motion.div>
                            </div>
                        )}

                        {/* ANDROID / DESKTOP ACTION */}
                        {platform !== 'ios' && (
                            <div className="mt-6">
                                <button 
                                    onClick={handleInstallClick}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                    Install App
                                </button>
                                {!deferredPrompt && platform === 'android' && (
                                    <p className="text-xs text-center text-slate-400 mt-2">
                                        Or tap <span className="font-bold">⋮</span> (Menu) then <span className="font-bold">Install App</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
