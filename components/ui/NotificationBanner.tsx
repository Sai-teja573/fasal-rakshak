import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useState } from 'react';
import {
    AppNotification,
    clearAllNotifications,
    getNotifications,
    markAsRead,
    subscribeToNotifications
} from '../../services/notificationService';

// Icon Components
const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const MessageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
    </svg>
);

const AlertIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
);

const BellIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
    </svg>
);

const CloudIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
        <path d="M16 14v6"></path>
        <path d="M8 14v6"></path>
        <path d="M12 16v6"></path>
    </svg>
);

const TrendingIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
        <polyline points="16 7 22 7 22 13"></polyline>
    </svg>
);

const PhoneIcon = ({ className = "" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
);

const VideoIcon = ({ className = "" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/>
        <rect x="2" y="6" width="14" height="12" rx="2"/>
    </svg>
);

interface NotificationBannerProps {
    onNotificationClick?: (notification: AppNotification) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ onNotificationClick }) => {
    const [currentNotification, setCurrentNotification] = useState<AppNotification | null>(null);
    const [queue, setQueue] = useState<AppNotification[]>([]);
    
    // Process notification queue
    useEffect(() => {
        if (!currentNotification && queue.length > 0) {
            const next = queue[0];
            setCurrentNotification(next);
            setQueue(prev => prev.slice(1));
        }
    }, [currentNotification, queue]);
    
    // Auto-dismiss after 4 seconds
    useEffect(() => {
        if (currentNotification) {
            const timer = setTimeout(() => {
                setCurrentNotification(null);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [currentNotification]);
    
    // Subscribe to new notifications
    useEffect(() => {
        const unsubscribe = subscribeToNotifications((notification) => {
            setQueue(prev => [...prev, notification]);
        });
        return unsubscribe;
    }, []);
    
    const handleDismiss = useCallback(() => {
        if (currentNotification) {
            markAsRead(currentNotification.id);
            setCurrentNotification(null);
        }
    }, [currentNotification]);
    
    const handleClick = useCallback(() => {
        if (currentNotification) {
            markAsRead(currentNotification.id);
            onNotificationClick?.(currentNotification);
            setCurrentNotification(null);
        }
    }, [currentNotification, onNotificationClick]);
    
    const getIcon = (type: AppNotification['type'], callType?: 'audio' | 'video') => {
        switch (type) {
            case 'message':
                return <MessageIcon />;
            case 'disease':
            case 'alert':
                return <AlertIcon />;
            case 'weather':
                return <CloudIcon />;
            case 'market':
                return <TrendingIcon />;
            case 'call':
                return callType === 'video' ? <VideoIcon className="text-green-400" /> : <PhoneIcon className="text-green-400" />;
            default:
                return <BellIcon />;
        }
    };
    
    const getBgColor = (type: AppNotification['type']) => {
        switch (type) {
            case 'message':
                return 'from-blue-900/90 to-blue-800/90 border-blue-500/30';
            case 'disease':
            case 'alert':
                return 'from-red-900/90 to-red-800/90 border-red-500/30';
            case 'weather':
                return 'from-cyan-900/90 to-cyan-800/90 border-cyan-500/30';
            case 'market':
                return 'from-green-900/90 to-green-800/90 border-green-500/30';
            case 'call':
                return 'from-emerald-900/90 to-green-800/90 border-green-400/40';
            default:
                return 'from-gray-900/90 to-gray-800/90 border-gray-500/30';
        }
    };
    
    // Handle accept call
    const handleAcceptCall = useCallback(() => {
        if (currentNotification?.onAccept) {
            currentNotification.onAccept();
        }
        markAsRead(currentNotification?.id || '');
        setCurrentNotification(null);
    }, [currentNotification]);
    
    // Handle decline call
    const handleDeclineCall = useCallback(() => {
        if (currentNotification?.onDecline) {
            currentNotification.onDecline();
        }
        markAsRead(currentNotification?.id || '');
        setCurrentNotification(null);
    }, [currentNotification]);
    
    // Check if this is a call notification
    const isCallNotification = currentNotification?.type === 'call';
    
    return (
        <AnimatePresence>
            {currentNotification && (
                <motion.div
                    initial={{ opacity: 0, y: -100, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -100, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="fixed top-4 left-4 right-4 z-[9999] max-w-md mx-auto"
                >
                    {isCallNotification ? (
                        // Special Call Banner UI
                        <div 
                            className="bg-gradient-to-r from-green-900/95 to-emerald-800/95 backdrop-blur-xl rounded-2xl border border-green-400/30 shadow-2xl overflow-hidden"
                        >
                            {/* Animated pulse border effect */}
                            <div className="absolute inset-0 rounded-2xl border-2 border-green-400/50 animate-pulse pointer-events-none" />
                            
                            <div className="p-4">
                                <div className="flex items-center gap-4">
                                    {/* Caller Avatar with ring animation */}
                                    <div className="relative flex-shrink-0">
                                        <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
                                        {currentNotification.callerAvatar ? (
                                            <img 
                                                src={currentNotification.callerAvatar} 
                                                alt="" 
                                                className="relative w-14 h-14 rounded-full object-cover border-2 border-green-400"
                                            />
                                        ) : (
                                            <div className="relative w-14 h-14 rounded-full bg-white/20 flex items-center justify-center border-2 border-green-400">
                                                {currentNotification.callType === 'video' ? (
                                                    <VideoIcon className="text-white w-6 h-6" />
                                                ) : (
                                                    <PhoneIcon className="text-white w-6 h-6" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Call Info */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-white font-bold text-base truncate">
                                            {currentNotification.callerName || currentNotification.title}
                                        </h4>
                                        <p className="text-green-200 text-sm flex items-center gap-1.5 mt-0.5">
                                            {currentNotification.callType === 'video' ? (
                                                <>
                                                    <VideoIcon className="w-4 h-4" />
                                                    <span>Incoming video call...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <PhoneIcon className="w-4 h-4" />
                                                    <span>Incoming voice call...</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Accept/Decline Buttons */}
                                <div className="flex items-center gap-3 mt-4">
                                    <button
                                        onClick={handleDeclineCall}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-500/80 hover:bg-red-500 rounded-xl transition-all text-white font-semibold active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-[135deg]">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                        </svg>
                                        Decline
                                    </button>
                                    <button
                                        onClick={handleAcceptCall}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 hover:bg-green-400 rounded-xl transition-all text-white font-semibold active:scale-95 shadow-lg shadow-green-500/30"
                                    >
                                        {currentNotification.callType === 'video' ? (
                                            <VideoIcon className="w-5 h-5" />
                                        ) : (
                                            <PhoneIcon className="w-5 h-5" />
                                        )}
                                        Accept
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Regular Notification Banner
                        <div 
                            className={`
                                bg-gradient-to-r ${getBgColor(currentNotification.type)}
                                backdrop-blur-xl rounded-2xl border shadow-2xl
                                overflow-hidden cursor-pointer
                            `}
                            onClick={handleClick}
                        >
                            {/* Progress bar */}
                            <motion.div 
                                initial={{ width: '100%' }}
                                animate={{ width: '0%' }}
                                transition={{ duration: 4, ease: 'linear' }}
                                className="h-1 bg-white/30"
                            />
                            
                            <div className="p-4 flex items-start gap-3">
                                {/* Icon or Avatar */}
                                <div className="flex-shrink-0">
                                    {currentNotification.icon && currentNotification.icon.length > 2 ? (
                                        <img 
                                            src={currentNotification.icon} 
                                            alt="" 
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                            {currentNotification.icon || getIcon(currentNotification.type, currentNotification.callType)}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-semibold text-sm truncate">
                                        {currentNotification.title}
                                    </h4>
                                    <p className="text-white/70 text-xs line-clamp-2 mt-0.5">
                                        {currentNotification.body}
                                    </p>
                                    <span className="text-white/40 text-[10px] mt-1 block">
                                        Tap to open • Just now
                                    </span>
                                </div>
                                
                                {/* Dismiss button */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDismiss();
                                    }}
                                    className="flex-shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <XIcon />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationBanner;