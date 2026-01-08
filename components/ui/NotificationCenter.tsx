
import { AnimatePresence, motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import React, { useState } from 'react';
import { NotificationItem } from '../../types';

interface NotificationCenterProps {
    open: boolean;
    onClose: () => void;
    notifications: NotificationItem[];
    onMarkRead: (id: string) => void;
    onClearAll: () => void;
}

// Get icon and colors based on notification type
const getNotificationStyle = (type: string, severity?: string) => {
    if (severity === 'critical') {
        return { icon: '🚨', bg: 'from-red-500 to-red-600', iconBg: 'bg-gradient-to-br from-red-500 to-red-600', color: 'text-red-400' };
    }
    switch (type) {
        case 'alert':
            return { icon: '⚠️', bg: 'from-orange-500 to-amber-600', iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600', color: 'text-orange-400' };
        case 'recommendation':
            return { icon: '💡', bg: 'from-green-500 to-emerald-600', iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600', color: 'text-green-400' };
        case 'reminder':
            return { icon: '⏰', bg: 'from-blue-500 to-indigo-600', iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600', color: 'text-blue-400' };
        case 'weather':
            return { icon: '🌤️', bg: 'from-cyan-500 to-blue-600', iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-600', color: 'text-cyan-400' };
        case 'market':
            return { icon: '📈', bg: 'from-purple-500 to-violet-600', iconBg: 'bg-gradient-to-br from-purple-500 to-violet-600', color: 'text-purple-400' };
        case 'crop':
            return { icon: '🌾', bg: 'from-emerald-500 to-green-600', iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600', color: 'text-emerald-400' };
        default:
            return { icon: '🔔', bg: 'from-slate-500 to-slate-600', iconBg: 'bg-gradient-to-br from-slate-500 to-slate-600', color: 'text-slate-400' };
    }
};

// Format time like iOS (e.g., "1m ago", "3:09 AM")
const formatTime = (timestamp: Date | string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return time.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Swipeable Notification Card Component
const SwipeableNotificationCard: React.FC<{
    item: NotificationItem;
    index: number;
    onDismiss: (id: string) => void;
    onMarkRead: (id: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}> = ({ item, index, onDismiss, onMarkRead, isExpanded, onToggleExpand }) => {
    const style = getNotificationStyle(item.type, item.severity);
    const x = useMotionValue(0);
    const opacity = useTransform(x, [-150, 0, 150], [0, 1, 0]);
    const scale = useTransform(x, [-150, 0, 150], [0.8, 1, 0.8]);
    const deleteOpacity = useTransform(x, [-150, -50, 0], [1, 0.5, 0]);
    const readOpacity = useTransform(x, [0, 50, 150], [0, 0.5, 1]);

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 100;
        if (Math.abs(info.offset.x) > threshold) {
            onDismiss(item.id);
        }
    };

    return (
        <div className="relative overflow-hidden">
            {/* Background Actions */}
            <motion.div 
                className="absolute inset-0 flex items-center justify-between px-6 rounded-2xl"
                style={{ opacity: deleteOpacity }}
            >
                <div className="flex items-center gap-2 text-red-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="font-semibold text-sm">Delete</span>
                </div>
            </motion.div>
            <motion.div 
                className="absolute inset-0 flex items-center justify-end px-6 rounded-2xl"
                style={{ opacity: readOpacity }}
            >
                <div className="flex items-center gap-2 text-blue-500">
                    <span className="font-semibold text-sm">Mark Read</span>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            </motion.div>

            {/* Swipeable Card */}
            <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -300, scale: 0.8 }}
                transition={{ delay: index * 0.04, type: 'spring', damping: 20 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={handleDragEnd}
                style={{ x, opacity, scale }}
                onClick={() => {
                    onMarkRead(item.id);
                    onToggleExpand();
                }}
                className={`relative overflow-hidden rounded-2xl cursor-pointer touch-pan-y ${
                    !item.read ? 'shadow-lg' : 'shadow-md'
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
            >
                <div
                    style={{
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)',
                        border: !item.read ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div className="p-3.5 flex items-start gap-3">
                        {/* App Icon - Rounded Square Like iOS */}
                        <div className={`w-11 h-11 rounded-[12px] ${style.iconBg} flex items-center justify-center text-lg shadow-lg shrink-0`}>
                            {style.icon}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-white text-[14px] leading-tight">
                                    {item.title}
                                </h4>
                                <span className="text-[11px] text-white/40 whitespace-nowrap shrink-0 font-medium">
                                    {formatTime(item.timestamp)}
                                </span>
                            </div>
                            
                            <p className={`text-[13px] text-white/70 leading-snug mt-0.5 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                {item.message}
                            </p>
                            
                            {/* Expanded Actions */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3 pt-3 border-t border-white/10 flex gap-2"
                                    >
                                        {item.actionLabel && (
                                            <motion.button
                                                whileTap={{ scale: 0.95 }}
                                                className={`px-4 py-2 rounded-full bg-gradient-to-r ${style.bg} text-white text-xs font-bold shadow-lg`}
                                            >
                                                {item.actionLabel}
                                            </motion.button>
                                        )}
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={(e) => { e.stopPropagation(); onDismiss(item.id); }}
                                            className="px-4 py-2 rounded-full bg-white/10 text-white/80 text-xs font-semibold"
                                        >
                                            Dismiss
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        
                        {/* Unread Dot */}
                        {!item.read && (
                            <div className="absolute top-3.5 right-3 w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                        )}
                    </div>
                </div>

                {/* Swipe Hint Indicator */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/20 rounded-full" />
            </motion.div>
        </div>
    );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ open, onClose, notifications, onMarkRead, onClearAll }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);
    
    if (!open) return null;

    const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));
    const unreadCount = visibleNotifications.filter(n => !n.read).length;
    
    const groupedNotifications: Record<string, NotificationItem[]> = visibleNotifications.reduce((acc, notif) => {
        const today = new Date();
        const notifDate = new Date(notif.timestamp);
        const isToday = notifDate.toDateString() === today.toDateString();
        const key = isToday ? 'Today' : 'Earlier';
        if (!acc[key]) acc[key] = [];
        acc[key].push(notif);
        return acc;
    }, {} as Record<string, NotificationItem[]>);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => [...prev, id]);
        onMarkRead(id);
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Full Screen Clickable Backdrop - Click anywhere to close */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/30 cursor-pointer"
                        style={{ touchAction: 'none' }}
                    />
                    
                    {/* Notification Center Content - Floating Cards */}
                    <motion.div 
                        initial={{ opacity: 0, y: -30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -30, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-0 top-0 z-[61] max-h-[100vh] overflow-hidden flex flex-col pointer-events-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header - Floating Style */}
                        <div className="px-4 pt-14 pb-3 flex justify-between items-center pointer-events-auto">
                            <div className="flex items-center gap-3">
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
                                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-2xl flex items-center justify-center text-white shadow-xl border border-white/10"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </motion.button>
                                <div>
                                    <h1 className="text-xl font-bold text-white drop-shadow-lg">Notifications</h1>
                                    {unreadCount > 0 && (
                                        <p className="text-xs text-white/70 font-medium">{unreadCount} unread • Swipe to dismiss</p>
                                    )}
                                </div>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => { onClearAll(); setDismissedIds([]); }}
                                className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-2xl text-white text-sm font-semibold shadow-xl border border-white/10"
                            >
                                Clear All
                            </motion.button>
                        </div>

                        {/* Swipe Hint */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="px-4 pb-2 pointer-events-auto"
                        >
                            <div className="flex items-center justify-center gap-2 text-white/40 text-[11px]">
                                <span>←</span>
                                <span>Swipe left or right to dismiss</span>
                                <span>→</span>
                            </div>
                        </motion.div>

                        {/* Scrollable Notifications - Floating Cards */}
                        <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-2 pointer-events-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                            {visibleNotifications.length === 0 ? (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center py-16"
                                >
                                    <div className="w-20 h-20 rounded-[22px] bg-black/30 backdrop-blur-2xl flex items-center justify-center mb-4 text-4xl shadow-2xl border border-white/10">
                                        🔔
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1 drop-shadow-lg">All Caught Up!</h3>
                                    <p className="text-white/60 text-center text-sm">No new notifications</p>
                                </motion.div>
                            ) : (
                                Object.entries(groupedNotifications).map(([group, items]) => (
                                    <div key={group} className="space-y-2">
                                        {/* Group Header - Subtle */}
                                        <div className="flex items-center gap-2 px-2 py-1">
                                            <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">{group}</span>
                                            <span className="flex-1 h-px bg-white/10"></span>
                                        </div>
                                        
                                        {/* Notification Cards - Swipeable */}
                                        <AnimatePresence>
                                            {(items as NotificationItem[]).map((item, index) => (
                                                <SwipeableNotificationCard
                                                    key={item.id}
                                                    item={item}
                                                    index={index}
                                                    onDismiss={handleDismiss}
                                                    onMarkRead={onMarkRead}
                                                    isExpanded={expandedId === item.id}
                                                    onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                ))
                            )}
                            
                            {/* More Notifications Indicator */}
                            {visibleNotifications.length > 5 && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex justify-center py-3"
                                >
                                    <span className="text-[11px] text-white/30 font-medium bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-xl">
                                        {visibleNotifications.length} notifications
                                    </span>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
