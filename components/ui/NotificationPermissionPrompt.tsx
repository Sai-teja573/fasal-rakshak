import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getPermissionStatus, isPushSupported, requestNotificationPermission } from '../../services/notificationService';

// Inline SVG Icons
const BellIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18"/>
        <path d="m6 6 12 12"/>
    </svg>
);

interface Props {
    userId: string;
    onPermissionGranted?: () => void;
}

export const NotificationPermissionPrompt = ({ userId, onPermissionGranted }: Props) => {
    const [show, setShow] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if we should show the prompt
        const checkPermission = () => {
            if (!isPushSupported()) {
                console.log('[NotificationPrompt] Push not supported');
                return;
            }

            const permission = getPermissionStatus();
            console.log('[NotificationPrompt] Current permission:', permission);

            // Only show if permission is 'default' (not asked yet) and not dismissed
            if (permission === 'default' && !dismissed) {
                // Show after a short delay so user settles in
                setTimeout(() => setShow(true), 2000);
            }
        };

        checkPermission();
    }, [dismissed]);

    const handleAllow = async () => {
        console.log('[NotificationPrompt] User clicked Allow');
        const granted = await requestNotificationPermission();
        console.log('[NotificationPrompt] Permission result:', granted);
        
        if (granted) {
            onPermissionGranted?.();
        }
        
        setShow(false);
        setDismissed(true);
        
        // Store in localStorage so we don't ask again
        localStorage.setItem('notification_prompt_shown', 'true');
    };

    const handleDismiss = () => {
        console.log('[NotificationPrompt] User dismissed prompt');
        setShow(false);
        setDismissed(true);
        localStorage.setItem('notification_prompt_shown', 'true');
    };

    // Don't show if already asked before
    useEffect(() => {
        const alreadyShown = localStorage.getItem('notification_prompt_shown');
        if (alreadyShown === 'true') {
            setDismissed(true);
        }
    }, []);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm"
                >
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-2xl p-4 border border-purple-400/30">
                        {/* Close button */}
                        <button 
                            onClick={handleDismiss}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <CloseIcon />
                        </button>
                        
                        <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                <BellIcon />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold text-base">
                                    Enable Notifications
                                </h3>
                                <p className="text-white/80 text-sm mt-1">
                                    Get instant alerts for new messages, weather updates, and crop prices.
                                </p>
                                
                                {/* Buttons */}
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={handleAllow}
                                        className="flex-1 bg-white text-purple-700 font-semibold py-2 px-4 rounded-lg text-sm hover:bg-purple-50 transition-colors"
                                    >
                                        Allow
                                    </button>
                                    <button
                                        onClick={handleDismiss}
                                        className="px-4 py-2 text-white/80 text-sm hover:text-white transition-colors"
                                    >
                                        Not now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};