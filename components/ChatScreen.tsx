
import { AnimatePresence, motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMinimumLoading } from '../hooks/useMinimumLoading';
import callService, { CallState, initialCallState } from '../services/callService';
import { blockUser, createChatRoom, createGroupChat, getGroupMembers, getMessages, getMyChats, markChatAsRead, searchFarmers, sendMessage } from '../services/chatService';
import { streamGeminiResponse } from '../services/geminiService';
import { permissionService } from '../services/permissionService';
import { getSupabase } from '../services/supabaseClient';
import { ChatInitialContext, ChatMessage, ChatRoom, User } from '../types';
import PermissionRequestModal from './PermissionRequestModal';
import { Skeleton } from './ui/Skeleton';

// --- IMAGE/VIDEO COMPRESSION UTILITY ---
const compressImage = async (file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        img.onload = () => {
            let { width, height } = img;
            
            // Calculate new dimensions maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    console.log(`[Compress] Original: ${(file.size / 1024).toFixed(1)}KB → Compressed: ${(compressedFile.size / 1024).toFixed(1)}KB`);
                    resolve(compressedFile);
                } else {
                    resolve(file);
                }
            }, 'image/jpeg', quality);
        };
        
        img.onerror = () => resolve(file);
        img.src = URL.createObjectURL(file);
    });
};

const compressVideo = async (file: File, targetSizeMB = 10): Promise<File> => {
    // For now, just return the file - true video compression requires WebCodecs API
    // or server-side processing. We'll add size warning for large videos.
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > targetSizeMB) {
        console.warn(`[Video] Large file: ${sizeMB.toFixed(1)}MB. Consider using a smaller video.`);
    }
    return file;
};

// AI Assistant User for AI Chat
const AI_ASSISTANT: User = {
    id: 'ai-krishi-bot',
    name: 'Krishi AI Assistant',
    farmer_id: 'AI-001',
    email: 'ai@fasalrakshak.com',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=krishi-ai&backgroundColor=059669',
    role: 'agent',
    usage: { scans_this_month: 0, last_reset_date: Date.now() }
};

interface ChatScreenProps {
    user: User;
    onBack: () => void;
    initialContext?: ChatInitialContext | null;
}

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
const formatDate = (ts: number) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// --- ICONS (Premium Design) ---
const Icons = {
    Back: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
    Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
    More: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
    Phone: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    Video: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>,
    Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
    Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
    Clip: () => <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    Camera: () => <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
    DoubleTick: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>,
    SingleTick: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    Mute: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>,
    EndCall: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C2.81 8.47 7.2 6.5 12 6.5c4.8 0 9.19 1.97 11.71 5.17.39.39.39 1.03 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>,
    Play: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
    Pause: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
    Image: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
    Emoji: () => <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
    Pin: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>,
    Online: () => <span className="w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></span>,
    Archive: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>,
    Unread: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>,
    Block: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
    Media: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
    Delete: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
    Report: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
};

// Swipeable Chat List Item with Archive/Pin/Unread actions
interface SwipeableChatItemProps {
    chat: ChatRoom;
    index: number;
    onClick: () => void;
    user: User;
    onArchive: (id: string) => void;
    onPin: (id: string) => void;
    onUnread: (id: string) => void;
    onMute: (id: string) => void;
}

const SwipeableChatListItem: React.FC<SwipeableChatItemProps> = ({ 
    chat, index, onClick, user, onArchive, onPin, onUnread, onMute 
}) => {
    const x = useMotionValue(0);
    const [swiping, setSwiping] = useState(false);
    const [showActions, setShowActions] = useState(false);
    
    const isOnline = Math.random() > 0.5;
    
    const handleDragEnd = (_: any, info: PanInfo) => {
        setSwiping(false);
        if (info.offset.x > 100) {
            // Swipe right - Archive
            onArchive(chat.id);
            x.set(0);
        } else if (info.offset.x < -100) {
            // Swipe left - Show actions
            setShowActions(true);
        } else {
            x.set(0);
        }
    };

    // Close actions when clicking elsewhere
    useEffect(() => {
        if (showActions) {
            const handleClick = () => setShowActions(false);
            const timer = setTimeout(() => {
                document.addEventListener('click', handleClick, { once: true });
            }, 100);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('click', handleClick);
            };
        }
    }, [showActions]);
    
    return (
        <div className="relative overflow-hidden mb-0.5">
            {/* Action buttons - Only visible when showActions is true */}
            <AnimatePresence>
                {showActions && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-y-0 right-0 flex items-stretch z-0"
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUnread(chat.id); setShowActions(false); }}
                            className="w-16 flex flex-col items-center justify-center text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                        >
                            <Icons.Unread />
                            <span className="text-[10px] mt-0.5 font-medium">Unread</span>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onPin(chat.id); setShowActions(false); }}
                            className="w-16 flex flex-col items-center justify-center text-white bg-amber-500 hover:bg-amber-600 transition-colors"
                        >
                            <Icons.Pin />
                            <span className="text-[10px] mt-0.5 font-medium">{chat.is_pinned ? 'Unpin' : 'Pin'}</span>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onMute(chat.id); setShowActions(false); }}
                            className="w-16 flex flex-col items-center justify-center text-white bg-slate-500 hover:bg-slate-600 transition-colors"
                        >
                            <Icons.Mute />
                            <span className="text-[10px] mt-0.5 font-medium">{chat.is_muted ? 'Unmute' : 'Mute'}</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Archive indicator on left swipe */}
            <motion.div 
                className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none"
                style={{ 
                    opacity: useTransform(x, [0, 60, 100], [0, 0.5, 1]),
                    backgroundColor: '#10b981'
                }}
            >
                <div className="text-white flex flex-col items-center">
                    <Icons.Archive />
                    <span className="text-[10px] mt-0.5 font-medium">Archive</span>
                </div>
            </motion.div>
            
            {/* Main Content - Draggable */}
            <motion.div
                drag="x"
                dragConstraints={{ left: showActions ? -192 : -100, right: 100 }}
                dragElastic={0.1}
                onDragStart={() => setSwiping(true)}
                onDragEnd={handleDragEnd}
                style={{ x }}
                animate={{ x: showActions ? -192 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                onClick={(e) => { 
                    if (!swiping && !showActions) {
                        onClick();
                    } else if (showActions) {
                        e.stopPropagation();
                        setShowActions(false);
                    }
                }}
                className="relative flex items-center gap-3 p-3 px-4 bg-white dark:bg-slate-800/90 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 z-10"
            >
                {/* Avatar with Online/Unread Indicator */}
                <div className="relative flex-shrink-0">
                    <img 
                        src={chat.is_group ? chat.group_avatar : chat.other_user?.avatar} 
                        className="w-14 h-14 rounded-full object-cover bg-gradient-to-br from-blue-400 to-purple-500 shadow-sm" 
                    />
                    {chat.unread_count ? (
                        <span className="absolute -top-0.5 -left-0.5 min-w-[20px] h-5 px-1 bg-blue-500 rounded-full flex items-center justify-center text-[11px] text-white font-bold shadow-sm">
                            {chat.unread_count > 99 ? '99+' : chat.unread_count}
                        </span>
                    ) : isOnline && !chat.is_group ? (
                        <span className="absolute bottom-0 left-0 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                    ) : null}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <div className="flex items-center gap-2">
                            <h4 className={`font-semibold text-[16px] truncate ${chat.unread_count ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                                {chat.is_group ? chat.name : chat.other_user?.name}
                            </h4>
                            {chat.is_pinned && (
                                <span className="text-amber-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                                </span>
                            )}
                        </div>
                        <span className={`text-[12px] flex-shrink-0 ml-2 ${chat.unread_count ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                            {chat.last_message_time ? formatDate(chat.last_message_time) === 'Today' ? formatTime(chat.last_message_time) : formatDate(chat.last_message_time) : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* "You:" prefix for sent messages */}
                        {chat.last_message && chat.last_message_sender_id === user?.id && (
                            <span className="text-slate-400 dark:text-slate-500 text-sm">You:</span>
                        )}
                        <p className={`text-[14px] truncate flex-1 ${chat.unread_count ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                            {chat.last_message_type === 'audio' && <span className="text-blue-500">Audio</span>}
                            {chat.last_message_type === 'image' && <span className="text-blue-500">Photo</span>}
                            {chat.last_message_type === 'video' && <span className="text-blue-500">Video</span>}
                            {chat.last_message_type === 'document' && <span className="text-blue-500">Document</span>}
                            {chat.last_message_type === 'location' && <span className="text-blue-500">Location</span>}
                            {chat.last_message_type === 'report' && <span className="text-blue-500">Report</span>}
                            {(chat.last_message_type === 'text' || !chat.last_message_type) && (chat.last_message || 'Start a conversation')}
                        </p>
                        {/* Status indicators */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {chat.is_muted && (
                                <span className="text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5.2 5.2 13.6 13.6"/><path d="M12 2a3 3 0 0 0-3 3v4"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                                </span>
                            )}
                            {/* Read/Delivered status dot */}
                            {chat.last_message_sender_id === user?.id && (
                                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// Swipeable Message for Reply - WhatsApp Style
interface SwipeableMessageProps {
    children: React.ReactNode;
    isMe: boolean;
    onSwipeToReply: () => void;
    disabled?: boolean;
}

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ children, isMe, onSwipeToReply, disabled }) => {
    const x = useMotionValue(0);
    const replyIconOpacity = useTransform(x, isMe ? [-60, -30] : [30, 60], [1, 0]);
    const replyIconScale = useTransform(x, isMe ? [-60, -20, 0] : [0, 20, 60], [1, 0.5, 0.5]);
    const [hasTriggered, setHasTriggered] = useState(false);

    const handleDragEnd = (_: any, info: PanInfo) => {
        const threshold = 60;
        if (isMe && info.offset.x < -threshold && !hasTriggered) {
            setHasTriggered(true);
            onSwipeToReply();
            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(20);
        } else if (!isMe && info.offset.x > threshold && !hasTriggered) {
            setHasTriggered(true);
            onSwipeToReply();
            if (navigator.vibrate) navigator.vibrate(20);
        }
        setHasTriggered(false);
    };

    if (disabled) return <>{children}</>;

    return (
        <div className="relative overflow-visible">
            {/* Reply Arrow Indicator */}
            <motion.div 
                className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'left-0 -translate-x-full -ml-3' : 'right-0 translate-x-full mr-3'} z-10`}
                style={{ opacity: replyIconOpacity, scale: replyIconScale }}
            >
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className={isMe ? '' : 'rotate-180'}
                    >
                        <polyline points="9 17 4 12 9 7"/>
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                </div>
            </motion.div>
            
            <motion.div
                drag="x"
                dragConstraints={{ left: isMe ? -80 : 0, right: isMe ? 0 : 80 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className="cursor-grab active:cursor-grabbing"
            >
                {children}
            </motion.div>
        </div>
    );
};

// Keep simple ChatListItem for compatibility
const ChatListItem: React.FC<{ chat: ChatRoom; index: number; onClick: () => void; user: User }> = ({ chat, index, onClick, user }) => {
    const isOnline = Math.random() > 0.5;
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={onClick} 
            className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-slate-800/50 rounded-2xl cursor-pointer transition-all group active:scale-[0.98]"
        >
            {/* Avatar with Online Indicator */}
            <div className="relative flex-shrink-0">
                <img 
                    src={chat.is_group ? chat.group_avatar : chat.other_user?.avatar} 
                    className="w-14 h-14 rounded-full object-cover bg-gradient-to-br from-green-400 to-emerald-500 ring-2 ring-white dark:ring-slate-800 shadow-md" 
                />
                {chat.unread_count ? (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
                        {chat.unread_count > 9 ? '9+' : chat.unread_count}
                    </span>
                ) : isOnline && !chat.is_group ? (
                    <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                ) : null}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 py-0.5">
                <div className="flex justify-between items-center mb-1">
                    <h4 className={`font-semibold text-[15px] truncate ${chat.unread_count ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                        {chat.is_group ? chat.name : chat.other_user?.name}
                    </h4>
                    <span className={`text-[11px] flex-shrink-0 ml-2 ${chat.unread_count ? 'text-green-600 font-semibold' : 'text-slate-400'}`}>
                        {chat.last_message_time ? formatDate(chat.last_message_time) === 'Today' ? formatTime(chat.last_message_time) : formatDate(chat.last_message_time) : ''}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Message Preview */}
                    <p className={`text-sm truncate flex-1 ${chat.unread_count ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                        {chat.last_message_type === 'audio' && <span className="inline-flex items-center gap-1">🎤 Voice message</span>}
                        {chat.last_message_type === 'image' && <span className="inline-flex items-center gap-1">📷 Photo</span>}
                        {chat.last_message_type === 'video' && <span className="inline-flex items-center gap-1">🎥 Video</span>}
                        {chat.last_message_type === 'document' && <span className="inline-flex items-center gap-1">📄 Document</span>}
                        {chat.last_message_type === 'location' && <span className="inline-flex items-center gap-1">📍 Location</span>}
                        {chat.last_message_type === 'report' && <span className="inline-flex items-center gap-1">📋 Report</span>}
                        {chat.last_message_type === 'text' && (chat.last_message || 'Start a conversation')}
                        {!chat.last_message_type && 'Start a conversation'}
                    </p>
                    
                    {/* Status Indicators */}
                    {chat.is_muted && (
                        <span className="text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5.2 5.2 13.6 13.6"/><path d="M11.9 11.9a3 3 0 0 0 4.2 4.2"/><path d="M12 2a3 3 0 0 0-3 3v4"/><path d="M19 10v2a7 7 0 0 1-.72 3.13"/><path d="M5 10v2a7 7 0 0 0 7 7"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export const ChatScreen: React.FC<ChatScreenProps> = ({ user, onBack, initialContext }) => {
    // UI State
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [searchMode, setSearchMode] = useState(false);
    const [showAttach, setShowAttach] = useState(false);
    const [showProfileInfo, setShowProfileInfo] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
    const [showMessageActions, setShowMessageActions] = useState(false);
    
    // Data State
    const [chats, setChatsRaw] = useState<ChatRoom[]>([]);
    // Helper to deduplicate chats by ID to prevent React key warnings
    const setChats = (chatsOrUpdater: ChatRoom[] | ((prev: ChatRoom[]) => ChatRoom[])) => {
        setChatsRaw(prev => {
            const newChats = typeof chatsOrUpdater === 'function' ? chatsOrUpdater(prev) : chatsOrUpdater;
            // Deduplicate by id
            const seen = new Set<string>();
            return newChats.filter(chat => {
                if (seen.has(chat.id)) return false;
                seen.add(chat.id);
                return true;
            });
        });
    };
    const [loadingChats, setLoadingChats] = useState(true);
    const [isStartingChat, setIsStartingChat] = useState(false);
    const showChatListSkeleton = useMinimumLoading(loadingChats, 1000);

    const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState("");
    
    // Calling State - WebRTC
    const [callState, setCallState] = useState<CallState>(initialCallState);
    const [callDuration, setCallDuration] = useState(0);
    const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    
    // Permission Modal State
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [pendingCallType, setPendingCallType] = useState<'audio' | 'video' | null>(null);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Search
    const [searchQuery, setSearchQuery] = useState("");
    const [foundUsers, setFoundUsers] = useState<User[]>([]);
    const [showAddContact, setShowAddContact] = useState(false);
    const [contactInput, setContactInput] = useState("");
    const [contactInputType, setContactInputType] = useState<'phone' | 'email'>('phone');
    const [addingContact, setAddingContact] = useState(false);
    const [contactError, setContactError] = useState("");
    
    // Group Chat State
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [memberSearchResults, setMemberSearchResults] = useState<User[]>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [groupMembers, setGroupMembers] = useState<User[]>([]);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    
    // AI Chat State
    const [isAiChat, setIsAiChat] = useState(false);
    const [aiTyping, setAiTyping] = useState(false);
    const [aiChatHistory, setAiChatHistory] = useState<{role: 'user' | 'model', text: string}[]>([]);
    
    // Image Preview State (WhatsApp-like multi-image selection)
    const [previewFiles, setPreviewFiles] = useState<{file: File, preview: string, caption: string}[]>([]);
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
    
    // Message Actions State (WhatsApp-like long press actions)
    const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({});
    const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
    
    // Quick reaction emojis
    const quickReactions = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
    
    // Chat Actions State (Archive, Pin, Unread)
    const [archivedChats, setArchivedChats] = useState<string[]>([]);
    const [showArchivedChats, setShowArchivedChats] = useState(false);
    const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
    
    // Profile View State
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [profileMediaTab, setProfileMediaTab] = useState<'media' | 'docs' | 'links'>('media');
    const [userMedia, setUserMedia] = useState<ChatMessage[]>([]);
    const [isBlocked, setIsBlocked] = useState(false);
    
    // Swipe to Reply State
    const [swipeReplyMsg, setSwipeReplyMsg] = useState<ChatMessage | null>(null);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Close emoji picker when clicking outside
    useEffect(() => {
        if (!showEmojiPickerFor) return;
        const handleClick = () => setShowEmojiPickerFor(null);
        const timer = setTimeout(() => {
            document.addEventListener('click', handleClick);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClick);
        };
    }, [showEmojiPickerFor]);

    // Initialize Call Service
    useEffect(() => {
        callService.init(
            user.id,
            user.name,
            user.avatar,
            (state) => setCallState(prev => ({ ...prev, ...state })),
            (stream) => setLocalStream(stream),
            (stream) => setRemoteStream(stream)
        );

        return () => {
            callService.destroy();
        };
    }, [user.id, user.name, user.avatar]);

    // Listen for Service Worker messages (for call actions from notifications)
    useEffect(() => {
        const handleSWMessage = (event: MessageEvent) => {
            console.log('📞 SW Message received:', event.data);
            
            if (event.data?.type === 'CALL_ACTION') {
                const { action, data } = event.data;
                if (action === 'accept') {
                    acceptCall();
                } else if (action === 'reject') {
                    rejectCall();
                }
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleSWMessage);
        }

        // Check URL params for call actions (when app opens from notification)
        const urlParams = new URLSearchParams(window.location.search);
        const callAction = urlParams.get('callAction');
        if (callAction === 'accept') {
            // Small delay to ensure call state is ready
            setTimeout(() => acceptCall(), 500);
        } else if (callAction === 'reject') {
            setTimeout(() => rejectCall(), 500);
        }
        // Clean URL params
        if (callAction) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleSWMessage);
            }
        };
    }, []);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Attach remote stream to video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
        // Also attach to audio element for audio calls
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(err => {
                console.log('Audio autoplay failed, user interaction needed:', err);
            });
        }
    }, [remoteStream]);

    // Call duration timer
    useEffect(() => {
        if (callState.isConnected && callState.startTime) {
            callTimerRef.current = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - callState.startTime!.getTime()) / 1000));
            }, 1000);
        } else {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
                callTimerRef.current = null;
            }
            setCallDuration(0);
        }

        return () => {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
            }
        };
    }, [callState.isConnected, callState.startTime]);

    // Call functions
    const checkCallPermissions = async (callType: 'audio' | 'video'): Promise<boolean> => {
        const permissions = await permissionService.checkAllPermissions();
        
        if (callType === 'video') {
            // Video call needs camera and microphone
            if (permissions.camera !== 'granted' || permissions.microphone !== 'granted') {
                setPendingCallType('video');
                setShowPermissionModal(true);
                return false;
            }
        } else {
            // Audio call needs microphone
            if (permissions.microphone !== 'granted') {
                setPendingCallType('audio');
                setShowPermissionModal(true);
                return false;
            }
        }
        
        // Also request notification permission for incoming calls
        if (permissions.notifications !== 'granted') {
            await permissionService.requestNotificationPermission();
        }
        
        return true;
    };

    const handlePermissionComplete = () => {
        setShowPermissionModal(false);
        if (pendingCallType) {
            // Try to start the call after permissions are granted
            startCallDirect(pendingCallType);
        }
        setPendingCallType(null);
    };

    const startCall = async (callType: 'audio' | 'video') => {
        if (!activeRoom || activeRoom.is_group) return;
        
        const otherUser = activeRoom.other_user;
        if (!otherUser) return;

        // Check permissions first
        const hasPermissions = await checkCallPermissions(callType);
        if (!hasPermissions) return;

        await startCallDirect(callType);
    };

    const startCallDirect = async (callType: 'audio' | 'video') => {
        if (!activeRoom || activeRoom.is_group) return;
        
        const otherUser = activeRoom.other_user;
        if (!otherUser) return;

        const result = await callService.startCall(
            otherUser.id,
            otherUser.name,
            otherUser.avatar,
            callType
        );

        if (!result.success && result.error) {
            alert(result.error);
        }
    };

    const acceptCall = async () => {
        const result = await callService.acceptCall();
        if (!result.success && result.error) {
            alert(result.error);
        }
    };

    const rejectCall = async () => {
        await callService.rejectCall();
    };

    const endCall = async () => {
        await callService.endCall(true);
    };

    const toggleMute = () => {
        callService.toggleMute();
    };

    const toggleVideo = () => {
        callService.toggleVideo();
    };

    const switchCamera = async () => {
        await callService.switchCamera();
    };

    const formatCallDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 1. Initial Load & Deep Link Handling
    useEffect(() => {
        const load = async () => {
            setLoadingChats(true);
            const data = await getMyChats(user.id);
            setChats(data);
            setLoadingChats(false);

            // Handle Initial Context
            if (initialContext) {
                // If openAiChat flag is set, open Krishi AI Assistant directly
                if (initialContext.openAiChat) {
                    handleStartNewChat(AI_ASSISTANT);
                    return;
                }
                
                // Handle Deep Link from Transport (with targetUser)
                if (initialContext.targetUser) {
                    // Find existing chat or create new
                    let targetRoom = data.find(c => !c.is_group && c.participants.includes(initialContext.targetUser!.id));
                    if (!targetRoom) {
                        targetRoom = await createChatRoom(user, initialContext.targetUser);
                    }
                    
                    if (targetRoom) {
                        setActiveRoom(targetRoom);
                        setMessages(await getMessages(targetRoom.id, user.id));
                        if (initialContext.message) {
                            setInputText(initialContext.message);
                        }
                        setView('chat');
                    }
                }
            }
        };
        load();
    }, [user.id, initialContext]);

    // 2. Realtime Subscription for Chat List updates (new messages across all rooms)
    useEffect(() => {
        const supabase = getSupabase();
        if (!supabase) return;

        // Subscribe to chat_rooms updates (for last_message changes)
        const roomsChannel = supabase.channel('chat-list-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_rooms'
                },
                async () => {
                    // Refresh chat list when any room is updated
                    console.log('[ChatScreen] Room updated, refreshing chat list...');
                    const updatedChats = await getMyChats(user.id);
                    setChats(updatedChats);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(roomsChannel);
        };
    }, [user.id]);

    // 3. Realtime Subscription for Active Chat Messages
    useEffect(() => {
        if (!activeRoom) return;

        const supabase = getSupabase();
        if (!supabase) return;

        // Subscribe to new messages in the active room
        const channel = supabase.channel(`room:${activeRoom.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `room_id=eq.${activeRoom.id}`
                },
                (payload) => {
                    const newMsg = payload.new as any;
                    // Format payload to app type
                    const formattedMsg: ChatMessage = {
                        id: newMsg.id,
                        room_id: newMsg.room_id,
                        sender_id: newMsg.sender_id,
                        content: newMsg.content,
                        type: newMsg.type,
                        media_url: newMsg.media_url,
                        media_duration: newMsg.media_duration,
                        report_data: newMsg.report_data,
                        created_at: new Date(newMsg.created_at).getTime(),
                        read_by: newMsg.read_by || [],
                        status: 'read'
                    };
                    setMessages(prev => {
                        // Dedup check 1: Same ID
                        if (prev.find(m => m.id === formattedMsg.id)) return prev;
                        
                        // Dedup check 2: Same sender + same content + within 5 seconds (optimistic update)
                        const isDuplicate = prev.some(m => 
                            m.sender_id === formattedMsg.sender_id && 
                            m.content === formattedMsg.content &&
                            Math.abs(m.created_at - formattedMsg.created_at) < 5000
                        );
                        
                        if (isDuplicate) {
                            // Replace the optimistic message with the real one (to get correct ID)
                            return prev.map(m => 
                                m.sender_id === formattedMsg.sender_id && 
                                m.content === formattedMsg.content &&
                                Math.abs(m.created_at - formattedMsg.created_at) < 5000
                                    ? formattedMsg 
                                    : m
                            );
                        }
                        
                        return [...prev, formattedMsg];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeRoom]);

    // 4. Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, view]);

    // 4. User Search Logic
    useEffect(() => {
        if (searchQuery.length > 2) {
            searchFarmers(searchQuery).then(res => setFoundUsers(res.filter(u => u.id !== user.id)));
        } else {
            setFoundUsers([]);
        }
    }, [searchQuery]);

    // 5. Member Search for Group Creation
    useEffect(() => {
        if (memberSearchQuery.length > 2) {
            searchFarmers(memberSearchQuery).then(res => {
                // Filter out current user and already selected members
                const filtered = res.filter(u => 
                    u.id !== user.id && 
                    !selectedMembers.find(m => m.id === u.id)
                );
                setMemberSearchResults(filtered);
            });
        } else {
            setMemberSearchResults([]);
        }
    }, [memberSearchQuery, selectedMembers]);

    // 6. Load group members when viewing group info
    useEffect(() => {
        if (activeRoom?.is_group && showGroupInfo) {
            getGroupMembers(activeRoom.id).then(setGroupMembers);
        }
    }, [activeRoom, showGroupInfo]);

    // --- ACTIONS ---
    
    // Go back to chat list and refresh
    const handleBackToList = async () => {
        setView('list');
        setIsAiChat(false);
        setActiveRoom(null);
        // Refresh chat list to get latest messages
        const updatedChats = await getMyChats(user.id);
        setChats(updatedChats);
    };

    // Create Group Chat Handler
    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;
        
        setCreatingGroup(true);
        try {
            const room = await createGroupChat(user, selectedMembers, groupName.trim());
            if (room) {
                setShowCreateGroup(false);
                setGroupName("");
                setSelectedMembers([]);
                setMemberSearchQuery("");
                
                // Refresh chats and open the new group
                const updatedChats = await getMyChats(user.id);
                setChats(updatedChats);
                
                setActiveRoom(room);
                setMessages([]);
                setView('chat');
            }
        } catch (e) {
            console.error("Failed to create group:", e);
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleOpenChat = async (room: ChatRoom) => {
        setActiveRoom(room);
        setMessages(await getMessages(room.id, user.id));
        
        // Mark chat as read when opened
        if (room.unread_count && room.unread_count > 0) {
            await markChatAsRead(room.id, user.id);
            // Update local state to reflect read status
            setChats(prev => prev.map(c => c.id === room.id ? { ...c, unread_count: 0 } : c));
        }
        
        // Load group members for group chats
        if (room.is_group) {
            getGroupMembers(room.id).then(setGroupMembers);
        }
        
        setView('chat');
    };

    const handleStartNewChat = async (targetUser: User) => {
        // Prevent double-clicks
        if (isStartingChat) return;
        setIsStartingChat(true);
        
        // Check if it's AI Assistant
        if (targetUser.id === 'ai-krishi-bot') {
            const aiRoom: ChatRoom = {
                id: 'ai-chat-room',
                is_group: false,
                created_at: Date.now(),
                updated_at: Date.now(),
                participants: [user.id, 'ai-krishi-bot'],
                other_user: {
                    id: 'ai-krishi-bot',
                    name: 'Krishi AI Assistant',
                    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=krishi-ai&backgroundColor=059669',
                    farmer_id: 'AI-001',
                    phone: 'AI Powered',
                    about: '🤖 I am your AI farming assistant. Ask me anything about crops, diseases, weather, market prices!'
                },
                last_message: 'Ask me anything about farming!',
                last_message_type: 'text',
                last_message_time: Date.now()
            };
            setActiveRoom(aiRoom);
            setIsAiChat(true);
            setMessages([]);
            setAiChatHistory([]);
            setSearchMode(false);
            setSearchQuery("");
            setView('chat');
            setIsStartingChat(false);
            return;
        }
        
        const room = await createChatRoom(user, targetUser);
        if (room) {
            setSearchMode(false);
            setSearchQuery("");
            setIsAiChat(false);
            
            // Refresh chat list to include the new room
            const updatedChats = await getMyChats(user.id);
            setChats(updatedChats);
            
            handleOpenChat(room);
        }
        setIsStartingChat(false);
    };

    // State to prevent double sends
    const [isSending, setIsSending] = useState(false);

    const handleSendMessage = async (type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'report' = 'text', content?: string, file?: File) => {
        if (!activeRoom) return;
        if (isSending) return; // Prevent double sends
        
        const msgContent = content || inputText;
        if (!msgContent && !file) return;

        setIsSending(true);
        
        // Optimistic UI Update
        const tempId = Date.now().toString();
        const optimisticMsg: ChatMessage = {
            id: tempId,
            room_id: activeRoom.id,
            sender_id: user.id,
            content: msgContent,
            type: type,
            media_url: file ? URL.createObjectURL(file) : undefined,
            created_at: Date.now(),
            read_by: [user.id],
            status: 'sent',
            reply_to: replyingTo ? {
                id: replyingTo.id,
                sender_name: replyingTo.sender_id === user.id ? 'You' : (activeRoom.other_user?.name || 'User'),
                content: replyingTo.content,
                type: replyingTo.type
            } : undefined
        };
        
        setMessages(prev => [...prev, optimisticMsg]);
        setInputText("");
        setShowAttach(false);
        setReplyingTo(null);

        // Handle AI Chat Response
        if (isAiChat && type === 'text') {
            setAiTyping(true);
            const newHistory = [...aiChatHistory, { role: 'user' as const, text: msgContent }];
            setAiChatHistory(newHistory);
            
            try {
                let aiResponse = '';
                const aiMsgId = (Date.now() + 1).toString();
                
                // Add placeholder AI message
                const aiPlaceholder: ChatMessage = {
                    id: aiMsgId,
                    room_id: activeRoom.id,
                    sender_id: 'ai-krishi-bot',
                    content: '...',
                    type: 'text',
                    created_at: Date.now() + 1,
                    read_by: ['ai-krishi-bot'],
                    status: 'read'
                };
                setMessages(prev => [...prev, aiPlaceholder]);
                
                // Stream AI response
                await streamGeminiResponse(
                    `You are Krishi AI, a helpful agricultural assistant for Indian farmers. 
                    Answer in the same language the user asks (Hindi, English, or regional).
                    Be concise, friendly, and practical. Use emojis appropriately.
                    
                    User question: ${msgContent}`,
                    newHistory,
                    (chunk) => {
                        aiResponse += chunk;
                        setMessages(prev => prev.map(m => 
                            m.id === aiMsgId ? { ...m, content: aiResponse } : m
                        ));
                    }
                );
                
                setAiChatHistory([...newHistory, { role: 'model', text: aiResponse }]);
            } catch (e) {
                console.error('AI response error:', e);
                const errorMsg: ChatMessage = {
                    id: (Date.now() + 2).toString(),
                    room_id: activeRoom.id,
                    sender_id: 'ai-krishi-bot',
                    content: 'Sorry, I encountered an error. Please try again! 🙏',
                    type: 'text',
                    created_at: Date.now() + 2,
                    read_by: ['ai-krishi-bot'],
                    status: 'read'
                };
                setMessages(prev => [...prev.filter(m => m.content !== '...'), errorMsg]);
            } finally {
                setAiTyping(false);
                setIsSending(false); // Reset sending state for AI chats
            }
            return;
        }

        try {
            await sendMessage(activeRoom.id, user.id, msgContent, type, file);
            // Real message will come via subscription and should technically replace this
            // But due to simple dedup logic in subscription, it might just append or be skipped
            // For a robust app, we'd replace the tempId with real ID.
        } catch (e) {
            console.error("Message send failed", e);
            // Optionally set status to 'error' on the message
        } finally {
            setIsSending(false);
        }
    };

    // Multiple file input refs for different file types
    const documentInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const newPreviews: {file: File, preview: string, caption: string}[] = [];
        
        for (const file of Array.from(files) as File[]) {
            if (file.type.startsWith('image/')) {
                // Compress image before preview
                const compressedFile = await compressImage(file);
                const preview = URL.createObjectURL(compressedFile);
                newPreviews.push({ file: compressedFile, preview, caption: '' });
            } else if (file.type.startsWith('video/')) {
                // Compress video (or warn about size)
                const processedFile = await compressVideo(file);
                const preview = URL.createObjectURL(processedFile);
                newPreviews.push({ file: processedFile, preview, caption: '' });
            } else {
                // For documents, send directly
                const type = file.type.startsWith('audio/') ? 'audio' as const : 'document' as const;
                handleSendMessage(type, file.name, file);
            }
        }
        
        if (newPreviews.length > 0) {
            setPreviewFiles(prev => [...prev, ...newPreviews]);
            setCurrentPreviewIndex(0);
            setShowImagePreview(true);
            setShowAttach(false);
        }
        
        // Reset input so same file can be selected again
        if (e.target) e.target.value = '';
    };
    
    // Handle camera capture - open camera input
    const handleCameraCapture = () => {
        cameraInputRef.current?.click();
        setShowAttach(false);
    };
    
    // Handle sending previewed files
    const handleSendPreviewFiles = async () => {
        for (const item of previewFiles) {
            const type = item.file.type.startsWith('video/') ? 'video' : 'image';
            await handleSendMessage(type, item.caption || '', item.file);
        }
        // Clear previews
        previewFiles.forEach(p => URL.revokeObjectURL(p.preview));
        setPreviewFiles([]);
        setShowImagePreview(false);
    };
    
    // Add more files to preview
    const handleAddMoreFiles = () => {
        fileInputRef.current?.click();
    };
    
    // Remove file from preview
    const handleRemovePreview = (index: number) => {
        URL.revokeObjectURL(previewFiles[index].preview);
        setPreviewFiles(prev => prev.filter((_, i) => i !== index));
        if (previewFiles.length <= 1) {
            setShowImagePreview(false);
        } else if (currentPreviewIndex >= previewFiles.length - 1) {
            setCurrentPreviewIndex(Math.max(0, previewFiles.length - 2));
        }
    };
    
    // Update caption for current preview
    const handleUpdateCaption = (caption: string) => {
        setPreviewFiles(prev => prev.map((p, i) => 
            i === currentPreviewIndex ? { ...p, caption } : p
        ));
    };
    
    // Message Actions
    const handleLongPress = (msgId: string) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedMessages([msgId]);
        }
    };
    
    const handleToggleSelect = (msgId: string) => {
        if (isSelectionMode) {
            setSelectedMessages(prev => 
                prev.includes(msgId) 
                    ? prev.filter(id => id !== msgId)
                    : [...prev, msgId]
            );
        }
    };
    
    const handleCancelSelection = () => {
        setIsSelectionMode(false);
        setSelectedMessages([]);
    };
    
    const handleDeleteSelected = async () => {
        // For demo, just remove from local state
        setMessages(prev => prev.filter(m => !selectedMessages.includes(m.id)));
        setIsSelectionMode(false);
        setSelectedMessages([]);
        setShowDeleteConfirm(false);
    };
    
    const handleReactToMessage = (msgId: string, emoji: string) => {
        setMessageReactions(prev => ({
            ...prev,
            [msgId]: [...(prev[msgId] || []), emoji]
        }));
    };

    // --- CHAT ACTIONS (Archive, Pin, Unread) ---
    const handleArchiveChat = (chatId: string) => {
        setArchivedChats(prev => 
            prev.includes(chatId) 
                ? prev.filter(id => id !== chatId) 
                : [...prev, chatId]
        );
        setSwipedChatId(null);
    };
    
    const handlePinChat = (chatId: string) => {
        setChats(prev => prev.map(chat => 
            chat.id === chatId ? { ...chat, is_pinned: !chat.is_pinned } : chat
        ));
        setSwipedChatId(null);
    };
    
    const handleMarkUnread = (chatId: string) => {
        setChats(prev => prev.map(chat => 
            chat.id === chatId ? { ...chat, unread_count: chat.unread_count ? 0 : 1 } : chat
        ));
        setSwipedChatId(null);
    };
    
    const handleMuteChat = (chatId: string) => {
        setChats(prev => prev.map(chat => 
            chat.id === chatId ? { ...chat, is_muted: !chat.is_muted } : chat
        ));
        setSwipedChatId(null);
    };
    
    // Load user media for profile view
    const loadUserMedia = useCallback(async () => {
        if (!activeRoom) return;
        const allMessages = messages.filter(m => 
            m.type === 'image' || m.type === 'video' || m.type === 'document'
        );
        setUserMedia(allMessages);
    }, [activeRoom, messages]);
    
    useEffect(() => {
        if (showUserProfile) {
            loadUserMedia();
        }
    }, [showUserProfile, loadUserMedia]);
    
    // Handle block user
    const handleBlockUser = async () => {
        if (!activeRoom?.other_user?.id) return;
        try {
            await blockUser(user.id, activeRoom.other_user.id, !isBlocked);
            setIsBlocked(!isBlocked);
        } catch (e) {
            console.error('Failed to block user:', e);
        }
    };

    // --- LOCATION SHARING ---
    const handleShareLocation = async () => {
        if (!activeRoom) return;
        setShowAttach(false);
        
        if (!navigator.geolocation) {
            alert('Location is not supported by your browser');
            return;
        }
        
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            const { latitude, longitude } = position.coords;
            const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
            const content = `📍 My Location\nLat: ${latitude.toFixed(6)}\nLng: ${longitude.toFixed(6)}\n${locationUrl}`;
            
            // Create location message
            const tempId = Date.now().toString();
            const locationMsg: ChatMessage = {
                id: tempId,
                room_id: activeRoom.id,
                sender_id: user.id,
                content: content,
                type: 'location',
                created_at: Date.now(),
                read_by: [user.id],
                status: 'sent'
            };
            
            setMessages(prev => [...prev, locationMsg]);
            
            // Send to database
            await sendMessage(activeRoom.id, user.id, content, 'location');
        } catch (error: any) {
            console.error('Location error:', error);
            alert(error.message || 'Failed to get location. Please enable location permissions.');
        }
    };

    // --- AUDIO RECORDING ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            recorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });
                handleSendMessage('audio', '', audioFile);
            };

            recorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error("Mic error", e);
            alert("Microphone access denied");
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    // --- RENDERERS ---

    if (view === 'list') {
        return (
            <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                {/* Premium Header with Blur */}
                <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors">
                                <Icons.Back />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Messages</h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{chats.length} conversations</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => setSearchMode(!searchMode)} 
                                className={`p-2.5 rounded-full transition-all ${searchMode ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                            >
                                <Icons.Search />
                            </button>
                            <button className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors">
                                <Icons.More />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar - Animated */}
                    <AnimatePresence>
                        {searchMode && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-4 pb-3">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Icons.Search />
                                        </span>
                                        <input 
                                            autoFocus
                                            placeholder="Search farmers, groups, messages..." 
                                            className="w-full bg-slate-100 dark:bg-slate-800/60 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-green-500/30 transition-all"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                    {searchMode && searchQuery ? (
                        <div className="p-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase px-2 mb-3 flex items-center gap-2">
                                <Icons.Search /> Search Results
                            </p>
                            
                            {/* AI Chat Option - Always show first */}
                            {searchQuery.toLowerCase().includes('ai') || searchQuery.toLowerCase().includes('bot') || searchQuery.toLowerCase().includes('krishi') ? (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => handleStartNewChat(AI_ASSISTANT)} 
                                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl cursor-pointer transition-all group mb-3"
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 ring-2 ring-white dark:ring-slate-800 shadow-md flex items-center justify-center text-xl">
                                            🤖
                                        </div>
                                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                                            <span className="text-[8px] text-white">✓</span>
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                            Krishi AI Assistant
                                            <span className="bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">AI</span>
                                        </h4>
                                        <p className="text-xs text-purple-600 dark:text-purple-400">Ask anything about farming, diseases, prices!</p>
                                    </div>
                                    <div className="text-purple-500 text-sm font-medium">Chat →</div>
                                </motion.div>
                            ) : null}
                            
                            {foundUsers.map((u, i) => (
                                <motion.div 
                                    key={u.id} 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => handleStartNewChat(u)} 
                                    className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-slate-800/50 rounded-2xl cursor-pointer transition-all group"
                                >
                                    <div className="relative">
                                        <img src={u.avatar} className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 ring-2 ring-white dark:ring-slate-800 shadow-md" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-green-600 transition-colors">{u.name}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            {u.phone && <><span>📞</span> {u.phone} <span className="mx-1">•</span></>}
                                            <span>📍</span> {u.location?.district || 'India'} 
                                            {u.crops_grown?.[0] && <><span className="mx-1">•</span> <span>🌾 {u.crops_grown[0]}</span></>}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-green-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Chat →</span>
                                        {u.phone && (
                                            <a href={`tel:${u.phone}`} onClick={(e) => e.stopPropagation()} className="text-blue-500 text-xs flex items-center gap-1 hover:underline">
                                                <Icons.Phone /> Call
                                            </a>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            {foundUsers.length === 0 && !searchQuery.toLowerCase().includes('ai') && (
                                <div className="text-center py-8">
                                    <span className="text-4xl mb-3 block">🔍</span>
                                    <p className="text-slate-500 dark:text-slate-400 mb-4">No farmers found for "{searchQuery}"</p>
                                    
                                    {/* Add Contact by Phone/Email */}
                                    <button 
                                        onClick={() => { setShowAddContact(true); setContactInput(searchQuery); }}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-green-500/30 hover:scale-105 transition-transform"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                                        Add by Phone/Email
                                    </button>
                                </div>
                            )}
                            
                            {foundUsers.length === 0 && (
                                <div className="text-center py-12">
                                    <span className="text-4xl mb-3 block">🔍</span>
                                    <p className="text-slate-400">No farmers found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                                </div>
                            )}
                        </div>
                    ) : showChatListSkeleton ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex gap-3 p-3 bg-white dark:bg-slate-800/30 rounded-2xl">
                                    <Skeleton className="w-14 h-14 rounded-full" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <Skeleton className="h-4 w-3/4 rounded-lg" />
                                        <Skeleton className="h-3 w-1/2 rounded-lg" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-3 space-y-1">
                            {/* AI Assistant - Always at Top */}
                            <div className="mb-4">
                                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase px-3 mb-2 flex items-center gap-1">
                                    🤖 AI Assistant
                                </p>
                                <motion.div 
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => handleStartNewChat(AI_ASSISTANT)}
                                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/50 dark:border-purple-800/50 rounded-2xl cursor-pointer transition-all group"
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 ring-2 ring-white dark:ring-slate-800 shadow-md flex items-center justify-center text-2xl">
                                            🤖
                                        </div>
                                        <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                                    </div>
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-semibold text-[15px] text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                                Krishi AI Assistant
                                                <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">AI</span>
                                            </h4>
                                            <span className="text-[11px] text-green-600 font-semibold">Online</span>
                                        </div>
                                        <p className="text-sm text-purple-600/70 dark:text-purple-400/70 truncate">
                                            Ask me anything about farming! 🌾
                                        </p>
                                    </div>
                                </motion.div>
                            </div>
                            
                            {/* Archived Chats Toggle */}
                            {archivedChats.length > 0 && (
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => setShowArchivedChats(!showArchivedChats)}
                                    className="w-full flex items-center gap-3 p-3 mb-2 bg-slate-100 dark:bg-slate-800 rounded-2xl"
                                >
                                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <Icons.Archive />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="font-semibold text-slate-700 dark:text-slate-200">Archived</h4>
                                        <p className="text-sm text-slate-500">{archivedChats.length} chat{archivedChats.length > 1 ? 's' : ''}</p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${showArchivedChats ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                                </motion.button>
                            )}
                            
                            {/* Archived Chats List */}
                            <AnimatePresence>
                                {showArchivedChats && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden mb-3"
                                    >
                                        {chats.filter(c => archivedChats.includes(c.id)).map((chat, i) => (
                                            <SwipeableChatListItem 
                                                key={chat.id} 
                                                chat={chat} 
                                                index={i} 
                                                onClick={() => { setIsAiChat(false); handleOpenChat(chat); }} 
                                                user={user}
                                                onArchive={handleArchiveChat}
                                                onPin={handlePinChat}
                                                onUnread={handleMarkUnread}
                                                onMute={handleMuteChat}
                                            />
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            
                            {/* Pinned Section */}
                            {chats.filter(c => c.is_pinned && !archivedChats.includes(c.id)).length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-semibold text-slate-500 uppercase px-3 mb-2 flex items-center gap-1">
                                        <Icons.Pin /> Pinned
                                    </p>
                                    {chats.filter(c => c.is_pinned && !archivedChats.includes(c.id)).map((chat, i) => (
                                        <SwipeableChatListItem 
                                            key={chat.id} 
                                            chat={chat} 
                                            index={i} 
                                            onClick={() => { setIsAiChat(false); handleOpenChat(chat); }} 
                                            user={user}
                                            onArchive={handleArchiveChat}
                                            onPin={handlePinChat}
                                            onUnread={handleMarkUnread}
                                            onMute={handleMuteChat}
                                        />
                                    ))}
                                </div>
                            )}
                            
                            {/* All Chats */}
                            <p className="text-xs font-semibold text-slate-500 uppercase px-3 mb-2">All Messages</p>
                            {chats.filter(c => !c.is_pinned && !archivedChats.includes(c.id)).map((chat, i) => (
                                <SwipeableChatListItem 
                                    key={chat.id} 
                                    chat={chat} 
                                    index={i} 
                                    onClick={() => { setIsAiChat(false); handleOpenChat(chat); }} 
                                    user={user}
                                    onArchive={handleArchiveChat}
                                    onPin={handlePinChat}
                                    onUnread={handleMarkUnread}
                                    onMute={handleMuteChat}
                                />
                            ))}
                            
                            {chats.length === 0 && (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full flex items-center justify-center">
                                        <span className="text-4xl">💬</span>
                                    </div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">No messages yet</h3>
                                    <p className="text-sm text-slate-500">Start a conversation with fellow farmers</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Add Contact Modal */}
                <AnimatePresence>
                    {showAddContact && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setShowAddContact(false)}
                        >
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl"
                            >
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full flex items-center justify-center">
                                        <span className="text-3xl">👤</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add New Contact</h3>
                                    <p className="text-sm text-slate-500">Enter phone number or email to find farmer</p>
                                </div>
                                
                                {/* Toggle Phone/Email */}
                                <div className="flex gap-2 mb-4 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                                    <button 
                                        onClick={() => setContactInputType('phone')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${contactInputType === 'phone' ? 'bg-white dark:bg-slate-600 text-green-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        📞 Phone
                                    </button>
                                    <button 
                                        onClick={() => setContactInputType('email')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${contactInputType === 'email' ? 'bg-white dark:bg-slate-600 text-green-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        ✉️ Email
                                    </button>
                                </div>
                                
                                {/* Input */}
                                <div className="relative mb-4">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        {contactInputType === 'phone' ? '📞' : '✉️'}
                                    </span>
                                    <input 
                                        type={contactInputType === 'phone' ? 'tel' : 'email'}
                                        placeholder={contactInputType === 'phone' ? 'Enter phone number (+91...)' : 'Enter email address'}
                                        value={contactInput}
                                        onChange={(e) => { setContactInput(e.target.value); setContactError(''); }}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 pl-12 pr-4 py-3 rounded-xl text-sm outline-none dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-green-500/30 transition-all"
                                    />
                                </div>
                                
                                {contactError && (
                                    <p className="text-red-500 text-sm mb-4 text-center">{contactError}</p>
                                )}
                                
                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setShowAddContact(false)}
                                        className="flex-1 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!contactInput.trim()) {
                                                setContactError('Please enter a valid ' + contactInputType);
                                                return;
                                            }
                                            setAddingContact(true);
                                            try {
                                                const results = await searchFarmers(contactInput);
                                                if (results.length > 0) {
                                                    setShowAddContact(false);
                                                    handleStartNewChat(results[0]);
                                                } else {
                                                    setContactError(`No farmer found with this ${contactInputType}. They may not be on the app yet.`);
                                                }
                                            } catch (e) {
                                                setContactError('Failed to search. Please try again.');
                                            } finally {
                                                setAddingContact(false);
                                            }
                                        }}
                                        disabled={addingContact}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl transition-all disabled:opacity-50"
                                    >
                                        {addingContact ? 'Searching...' : 'Find & Chat'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Create Group Modal */}
                <AnimatePresence>
                    {showCreateGroup && (
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setShowCreateGroup(false)}
                        >
                            <motion.div 
                                initial={{ scale: 0.9, y: 20 }} 
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                onClick={e => e.stopPropagation()}
                                className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
                            >
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <span className="text-2xl">👥</span> Create Group Chat
                                </h3>
                                
                                {/* Group Name */}
                                <div className="relative mb-4">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">✏️</span>
                                    <input 
                                        type="text"
                                        placeholder="Group Name"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 pl-12 pr-4 py-3 rounded-xl text-sm outline-none dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-green-500/30 transition-all"
                                    />
                                </div>
                                
                                {/* Selected Members */}
                                {selectedMembers.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Selected Members ({selectedMembers.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedMembers.map(member => (
                                                <div key={member.id} className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full text-xs">
                                                    <img src={member.avatar} className="w-5 h-5 rounded-full" />
                                                    <span>{member.name.split(' ')[0]}</span>
                                                    <button 
                                                        onClick={() => setSelectedMembers(prev => prev.filter(m => m.id !== member.id))}
                                                        className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold hover:bg-red-500"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Search Members */}
                                <div className="relative mb-3">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <Icons.Search />
                                    </span>
                                    <input 
                                        type="text"
                                        placeholder="Search farmers to add..."
                                        value={memberSearchQuery}
                                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 pl-12 pr-4 py-3 rounded-xl text-sm outline-none dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-green-500/30 transition-all"
                                    />
                                </div>
                                
                                {/* Search Results */}
                                <div className="flex-1 overflow-y-auto max-h-40 mb-4">
                                    {memberSearchResults.map(farmer => (
                                        <div 
                                            key={farmer.id}
                                            onClick={() => {
                                                setSelectedMembers(prev => [...prev, farmer]);
                                                setMemberSearchQuery("");
                                            }}
                                            className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl cursor-pointer transition-colors"
                                        >
                                            <img src={farmer.avatar} className="w-10 h-10 rounded-full" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-slate-800 dark:text-white truncate">{farmer.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{farmer.email || farmer.phone || farmer.farmer_id}</p>
                                            </div>
                                            <span className="text-green-500 text-lg">+</span>
                                        </div>
                                    ))}
                                    {memberSearchQuery.length > 2 && memberSearchResults.length === 0 && (
                                        <p className="text-center text-slate-400 text-sm py-4">No farmers found</p>
                                    )}
                                </div>
                                
                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => {
                                            setShowCreateGroup(false);
                                            setGroupName("");
                                            setSelectedMembers([]);
                                            setMemberSearchQuery("");
                                        }}
                                        className="flex-1 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleCreateGroup}
                                        disabled={creatingGroup || !groupName.trim() || selectedMembers.length === 0}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl transition-all disabled:opacity-50"
                                    >
                                        {creatingGroup ? 'Creating...' : `Create Group (${selectedMembers.length})`}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* FAB Buttons */}
                <div className="fixed bottom-24 md:bottom-8 right-4 flex flex-col gap-3 z-30">
                    {/* Create Group FAB */}
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowCreateGroup(true)}
                        className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                    </motion.button>
                    
                    {/* New Chat FAB */}
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setSearchMode(true); setSearchQuery(""); }}
                        className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="10" y1="10" x2="14" y2="10"/>
                        </svg>
                    </motion.button>
                </div>
            </div>
        );
    }

    // --- CHAT WINDOW ---
    return (
        <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900 z-40">
            
            {/* Fixed Header - AI Chat or Regular */}
            <div className={`absolute top-0 left-0 right-0 z-30 backdrop-blur-xl border-b shadow-sm ${isAiChat ? 'bg-gradient-to-r from-purple-500/95 to-indigo-600/95 border-purple-400/50' : 'bg-white/95 dark:bg-slate-900/95 border-slate-200/50 dark:border-slate-700/50'}`}>
                <div className="px-2 py-2.5 flex items-center justify-between safe-area-top">
                    <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => !isAiChat && setShowProfileInfo(true)}>
                        <button onClick={(e) => { e.stopPropagation(); handleBackToList(); }} className={`p-1.5 rounded-full transition-colors ${isAiChat ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            <Icons.Back />
                        </button>
                        <div 
                            className="relative cursor-pointer"
                            onClick={() => {
                                if (!isAiChat && !activeRoom?.is_group) {
                                    loadUserMedia();
                                    setShowUserProfile(true);
                                }
                            }}
                        >
                            {isAiChat ? (
                                <div className="w-10 h-10 rounded-full bg-white/20 ring-2 ring-white/30 shadow-md flex items-center justify-center text-xl">
                                    🤖
                                </div>
                            ) : (
                                <img src={activeRoom?.is_group ? activeRoom.group_avatar : activeRoom?.other_user?.avatar} className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 ring-2 ring-white dark:ring-slate-700 shadow-md object-cover" />
                            )}
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${isAiChat ? 'bg-green-400 border-purple-500' : 'bg-green-500 border-white dark:border-slate-900'}`}></span>
                        </div>
                        <div className="ml-1 min-w-0">
                            <h3 className={`font-semibold text-sm leading-tight truncate flex items-center gap-2 ${isAiChat ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {activeRoom?.is_group ? activeRoom.name : activeRoom?.other_user?.name}
                                {isAiChat && <span className="bg-white/20 text-[8px] px-1.5 py-0.5 rounded-full font-bold">AI</span>}
                            </h3>
                            <p className={`text-[11px] font-medium ${isAiChat ? 'text-white/70' : 'text-green-600 dark:text-green-400'}`}>
                                {isAiChat ? (aiTyping ? 'Typing...' : 'Always here to help 🌾') : (activeRoom?.is_group ? `${activeRoom.participants?.length || 0} members • Tap for info` : 'Online')}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {!isAiChat && (
                            <>
                                {activeRoom?.is_group ? (
                                    // Group Actions
                                    <button 
                                        onClick={() => setShowGroupInfo(true)}
                                        className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                            <circle cx="9" cy="7" r="4"/>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                        </svg>
                                    </button>
                                ) : (
                                    // 1:1 Chat Actions - Audio & Video Call Buttons
                                    <>
                                        <button 
                                            onClick={() => startCall('video')}
                                            className="p-2.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                                            title="Video Call"
                                        >
                                            <Icons.Video />
                                        </button>
                                        <button 
                                            onClick={() => startCall('audio')}
                                            className="p-2.5 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                                            title="Voice Call"
                                        >
                                            <Icons.Phone />
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                        <button className={`p-2.5 rounded-full transition-colors ${isAiChat ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            <Icons.More />
                        </button>
                    </div>
                </div>
            </div>

            {/* Group Info Modal */}
            <AnimatePresence>
                {showGroupInfo && activeRoom?.is_group && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowGroupInfo(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} 
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-5 w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
                        >
                            {/* Group Header */}
                            <div className="text-center mb-4">
                                <img 
                                    src={activeRoom.group_avatar} 
                                    className="w-20 h-20 rounded-full mx-auto mb-3 ring-4 ring-green-100 dark:ring-green-900/30"
                                />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{activeRoom.name}</h3>
                                <p className="text-sm text-slate-500">Group • {groupMembers.length} participants</p>
                            </div>
                            
                            {/* Members List */}
                            <div className="flex-1 overflow-y-auto">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">{groupMembers.length} Members</p>
                                {groupMembers.map(member => (
                                    <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <img src={member.avatar} className="w-10 h-10 rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-slate-800 dark:text-white truncate">
                                                {member.name}
                                                {member.id === user.id && <span className="text-green-500 text-xs ml-1">(You)</span>}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">{member.email || member.phone || member.role}</p>
                                        </div>
                                        {(member as any).isAdmin && (
                                            <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full">Admin</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Close Button */}
                            <button 
                                onClick={() => setShowGroupInfo(false)}
                                className="mt-4 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages Area - Scrollable with padding for fixed header/footer */}
            <div 
                ref={scrollRef}
                className="absolute inset-0 overflow-y-auto px-3 pt-20 pb-40"
                style={{
                    backgroundImage: isAiChat 
                        ? 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)'
                        : 'radial-gradient(circle at 20% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)'
                }}
            >
                {/* Date Header */}
                <div className="flex justify-center mb-4">
                    <span className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-[11px] text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full shadow-sm font-medium">
                        {messages.length > 0 ? formatDate(messages[0].created_at) : 'Today'}
                    </span>
                </div>

                {/* AI Chat Welcome or Web3 Security Notice */}
                <div className="flex justify-center mb-4">
                    {isAiChat ? (
                        <div className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 text-[11px] text-purple-700 dark:text-purple-300 px-4 py-2 rounded-xl text-center shadow-sm max-w-[85%] flex items-center gap-2 border border-purple-200 dark:border-purple-800">
                            <span>🤖</span>
                            <span>AI-powered farming assistant • Ask anything!</span>
                            <span className="bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">BETA</span>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 text-[11px] text-purple-700 dark:text-purple-300 px-4 py-2 rounded-xl text-center shadow-sm max-w-[85%] flex items-center gap-2 border border-purple-200 dark:border-purple-800">
                            <span>🔐</span>
                            <span>Messages secured by Web3 Decentralized Network</span>
                            <span className="bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">SECURE</span>
                        </div>
                    )}
                </div>

                {/* AI Chat Welcome Messages */}
                {isAiChat && messages.length === 0 && (
                    <div className="space-y-3 mb-4">
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex justify-start group"
                        >
                            <div className="w-8 mr-2 flex-shrink-0">
                                <div className="w-8 h-8 rounded-full shadow-sm bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm">🤖</div>
                            </div>
                            <div className="relative max-w-[75%]">
                                <div className="relative px-3.5 py-2.5 rounded-2xl shadow-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md">
                                    <p className="text-[15px] leading-relaxed">Namaste! 🙏 I'm your Krishi AI Assistant.</p>
                                    <p className="text-[15px] leading-relaxed mt-2">I can help you with:</p>
                                    <div className="mt-2 space-y-1">
                                        <p className="text-sm flex items-center gap-2">🌾 <span>Crop disease identification</span></p>
                                        <p className="text-sm flex items-center gap-2">💰 <span>Market price information</span></p>
                                        <p className="text-sm flex items-center gap-2">🌤️ <span>Weather-based farming advice</span></p>
                                        <p className="text-sm flex items-center gap-2">🧪 <span>Fertilizer & pesticide guidance</span></p>
                                        <p className="text-sm flex items-center gap-2">📊 <span>Crop planning suggestions</span></p>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2 justify-start">
                                        <span className="text-[10px] text-slate-400">Just now</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex justify-center mt-4"
                        >
                            <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2">
                                <span>💬</span> Ask me anything in Hindi or English!
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Dummy Messages - Show when no real messages (non-AI) */}
                {!isAiChat && messages.length === 0 && (
                    <div className="space-y-3 mb-4">
                        {/* Message from Fellow Farmer */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex justify-start group"
                        >
                            <div className="w-8 mr-2 flex-shrink-0">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=farmer1" className="w-8 h-8 rounded-full shadow-sm bg-orange-100" />
                            </div>
                            <div className="relative max-w-[75%]">
                                <div className="relative px-3.5 py-2.5 rounded-2xl shadow-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md">
                                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">Ramesh Kumar 🧑‍🌾</p>
                                    <p className="text-[15px] leading-relaxed">Namaste! 🙏 I've been using this app for 3 months. Very helpful for crop disease detection. Ask me anything!</p>
                                    <div className="flex items-center gap-1 mt-1 justify-start">
                                        <span className="text-[10px] text-slate-400">9:30 am</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Another Farmer Message */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="flex justify-start group"
                        >
                            <div className="w-8 mr-2 flex-shrink-0">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=farmer2" className="w-8 h-8 rounded-full shadow-sm bg-blue-100" />
                            </div>
                            <div className="relative max-w-[75%]">
                                <div className="relative px-3.5 py-2.5 rounded-2xl shadow-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md">
                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1">Suresh Patil 👨‍🌾</p>
                                    <p className="text-[15px] leading-relaxed">Yesterday I got best prices for my tomatoes using the market feature! 📈 Highly recommend checking it daily.</p>
                                    <div className="flex items-center gap-1 mt-1 justify-start">
                                        <span className="text-[10px] text-slate-400">10:15 am</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Fasal Rakshak Team Message */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex justify-start group"
                        >
                            <div className="w-8 mr-2 flex-shrink-0">
                                <div className="w-8 h-8 rounded-full shadow-sm bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-sm">🌾</div>
                            </div>
                            <div className="relative max-w-[75%]">
                                <div className="relative px-3.5 py-2.5 rounded-2xl shadow-md bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 text-slate-900 dark:text-white rounded-bl-md border border-green-200 dark:border-green-800">
                                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1 flex items-center gap-1">
                                        Fasal Rakshak Team <span className="bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">✓ Verified</span>
                                    </p>
                                    <p className="text-[15px] leading-relaxed">Hello! 👋 Need help? Try these features:</p>
                                    <div className="mt-2 space-y-1">
                                        <p className="text-sm flex items-center gap-2">📸 <span className="text-slate-600 dark:text-slate-300">Scan crops for disease detection</span></p>
                                        <p className="text-sm flex items-center gap-2">📊 <span className="text-slate-600 dark:text-slate-300">Check live market prices</span></p>
                                        <p className="text-sm flex items-center gap-2">🌤️ <span className="text-slate-600 dark:text-slate-300">Get weather forecasts</span></p>
                                        <p className="text-sm flex items-center gap-2">💬 <span className="text-slate-600 dark:text-slate-300">Ask our AI for farming advice</span></p>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2 justify-start">
                                        <span className="text-[10px] text-slate-400">11:00 am</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Prompt to start chatting */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="flex justify-center mt-6"
                        >
                            <div className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2">
                                <span>💬</span> Type a message to start chatting
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Messages */}
                <div className="space-y-3">
                    {messages.map((msg, index) => {
                        const isMe = msg.sender_id === user.id;
                        const isAiMessage = msg.sender_id === 'ai-krishi-bot';
                        const isSystemMessage = msg.type === 'system';
                        const showAvatar = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);
                        const showSenderName = activeRoom?.is_group && !isMe && !isSystemMessage && showAvatar;
                        
                        // Get sender info for group chats
                        const senderInfo = groupMembers.find(m => m.id === msg.sender_id);
                        
                        // System message (group events)
                        if (isSystemMessage) {
                            return (
                                <div key={msg.id} className="flex justify-center">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full">
                                        {msg.content}
                                    </span>
                                </div>
                            );
                        }
                        
                        return (
                            <motion.div 
                                key={msg.id} 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group ${
                                    isSelectionMode && selectedMessages.includes(msg.id) ? 'bg-green-100/50 dark:bg-green-900/20' : ''
                                }`}
                                onClick={() => isSelectionMode && handleToggleSelect(msg.id)}
                                onContextMenu={(e) => { e.preventDefault(); handleLongPress(msg.id); }}
                            >
                                {/* Selection Checkbox */}
                                {isSelectionMode && (
                                    <div className="flex items-center mr-2">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                            selectedMessages.includes(msg.id) 
                                                ? 'bg-green-500 border-green-500' 
                                                : 'border-slate-300 dark:border-slate-600'
                                        }`}>
                                            {selectedMessages.includes(msg.id) && (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Avatar for other user / AI / Group member */}
                                {!isMe && !isSelectionMode && (
                                    <div className="w-8 mr-2 flex-shrink-0">
                                        {showAvatar && (
                                            isAiMessage ? (
                                                <div className="w-8 h-8 rounded-full shadow-sm bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm">🤖</div>
                                            ) : activeRoom?.is_group ? (
                                                <img src={senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender_id}`} className="w-8 h-8 rounded-full shadow-sm" />
                                            ) : (
                                                <img src={activeRoom?.other_user?.avatar} className="w-8 h-8 rounded-full shadow-sm" />
                                            )
                                        )}
                                    </div>
                                )}
                                
                                <SwipeableMessage
                                    isMe={isMe}
                                    onSwipeToReply={() => setReplyingTo(msg)}
                                    disabled={isSelectionMode}
                                >
                                <div className={`relative ${isMe ? 'order-1' : ''} group/msg`} style={{ maxWidth: 'min(75%, 320px)', minWidth: msg.type === 'text' ? 'auto' : '180px' }}>
                                    {/* Sender Name for Group Chats */}
                                    {showSenderName && (
                                        <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 mb-0.5 ml-1">
                                            {senderInfo?.name || 'Unknown'}
                                        </p>
                                    )}
                                    
                                    {/* Message Actions - Appear on hover/tap - positioned outside bubble */}
                                    {!isSelectionMode && (
                                        <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-all duration-200 flex items-center gap-1 z-20 pointer-events-none group-hover/msg:pointer-events-auto`}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }}
                                                className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg hover:bg-green-50 dark:hover:bg-slate-600 transition-all hover:scale-110 border border-slate-200 dark:border-slate-600"
                                                title="Reply"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-300"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                            </button>
                                            <div className="relative">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id); }}
                                                    className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg hover:bg-yellow-50 dark:hover:bg-slate-600 transition-all hover:scale-110 border border-slate-200 dark:border-slate-600"
                                                    title="React"
                                                >
                                                    <span className="text-sm">😊</span>
                                                </button>
                                                {/* Quick Reaction Picker */}
                                                <AnimatePresence>
                                                    {showEmojiPickerFor === msg.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                                            className={`absolute ${isMe ? 'right-0' : 'left-0'} bottom-full mb-2 flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-slate-800 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 z-50`}
                                                        >
                                                            {quickReactions.map((emoji) => (
                                                                <motion.button
                                                                    key={emoji}
                                                                    whileHover={{ scale: 1.3 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleReactToMessage(msg.id, emoji);
                                                                        setShowEmojiPickerFor(null);
                                                                    }}
                                                                    className="text-xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full p-1 transition-colors"
                                                                >
                                                                    {emoji}
                                                                </motion.button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); }}
                                                className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg hover:bg-blue-50 dark:hover:bg-slate-600 transition-all hover:scale-110 border border-slate-200 dark:border-slate-600"
                                                title="Copy"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-300"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                            </button>
                                        </div>
                                    )}

                                    {/* Reply Preview */}
                                    {msg.reply_to && (
                                        <div className={`mb-1 px-3 py-2 rounded-t-xl text-xs border-l-2 ${isMe ? 'bg-white/20 border-white/50' : 'bg-slate-100 dark:bg-slate-700 border-green-500'}`}>
                                            <p className={`font-semibold ${isMe ? 'text-white/90' : 'text-green-600 dark:text-green-400'}`}>{msg.reply_to.sender_name}</p>
                                            <p className={`truncate ${isMe ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {msg.reply_to.type === 'image' ? '📷 Photo' : msg.reply_to.type === 'audio' ? '🎤 Voice message' : msg.reply_to.content}
                                            </p>
                                        </div>
                                    )}

                                    {/* Message Bubble */}
                                    <div 
                                        className={`
                                            relative rounded-2xl shadow-sm cursor-pointer overflow-hidden
                                            ${isMe 
                                                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-br-sm' 
                                                : isAiMessage
                                                    ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 text-slate-900 dark:text-white rounded-bl-sm shadow-md border border-purple-200 dark:border-purple-800'
                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-sm'
                                            }
                                            ${msg.reply_to ? 'rounded-t-none' : ''}
                                        `}
                                        onDoubleClick={() => setReplyingTo(msg)}
                                    >
                                        {/* AI typing indicator */}
                                        {isAiMessage && msg.content === '...' && (
                                            <div className="flex items-center gap-1 py-1">
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                            </div>
                                        )}
                                        
                                        {/* Text Message */}
                                        {msg.type === 'text' && msg.content !== '...' && (
                                            <div className="px-3 pt-2 pb-1">
                                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                                    {msg.content}
                                                    {/* Invisible spacer for time */}
                                                    <span className="invisible text-[11px] ml-2">
                                                        {formatTime(msg.created_at)}
                                                        {isMe && '  ✓'}
                                                    </span>
                                                </p>
                                                {/* Actual time positioned at bottom-right */}
                                                <div className={`flex items-center gap-1 justify-end -mt-4 ${messageReactions[msg.id]?.length ? 'mb-2' : ''}`}>
                                                    <span className={`text-[11px] ${isMe ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {formatTime(msg.created_at)}
                                                    </span>
                                                    {isMe && (
                                                        <span className={msg.status === 'read' ? 'text-white' : 'text-white/60'}>
                                                            {msg.status === 'read' ? <Icons.DoubleTick /> : <Icons.SingleTick />}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Image Message */}
                                        {msg.type === 'image' && (
                                            <div className="-m-1">
                                                <img src={msg.media_url} className="rounded-xl w-full max-h-64 object-cover" />
                                                {msg.content && <p className="mt-2 text-sm mx-1">{msg.content}</p>}
                                            </div>
                                        )}

                                        {/* Audio Message */}
                                        {msg.type === 'audio' && (
                                            <div className="flex items-center gap-3 min-w-[180px] py-1">
                                                <button className={`w-9 h-9 rounded-full flex items-center justify-center ${isMe ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                                                    <Icons.Play />
                                                </button>
                                                <div className="flex-1">
                                                    <div className="flex gap-0.5 h-4 items-end">
                                                        {[...Array(20)].map((_, i) => (
                                                            <div 
                                                                key={i} 
                                                                className={`w-1 rounded-full ${isMe ? 'bg-white/40' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                                style={{ height: `${Math.random() * 100}%`, minHeight: '20%' }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className={`text-[11px] ${isMe ? 'text-white/70' : 'text-slate-500'}`}>{msg.media_duration || '0:12'}</span>
                                            </div>
                                        )}

                                        {/* Location Message */}
                                        {msg.type === 'location' && (
                                            <div className="-m-1">
                                                <div className="relative rounded-xl overflow-hidden">
                                                    {/* Map Preview */}
                                                    <div className="w-full h-32 bg-gradient-to-br from-green-200 to-emerald-300 dark:from-green-900 dark:to-emerald-800 flex items-center justify-center">
                                                        <div className="text-center">
                                                            <div className="text-4xl mb-1">📍</div>
                                                            <p className="text-xs text-green-700 dark:text-green-300 font-medium">Location Shared</p>
                                                        </div>
                                                    </div>
                                                    {/* Open in Maps Button */}
                                                    <a 
                                                        href={msg.content?.includes('https://') ? msg.content.match(/(https:\/\/[^\s]+)/)?.[1] : `https://www.google.com/maps?q=${msg.content}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`block w-full py-2 text-center text-sm font-medium ${isMe ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-green-600 dark:text-green-400'}`}
                                                    >
                                                        Open in Google Maps →
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {/* Document Message */}
                                        {msg.type === 'document' && (
                                            <div className="flex items-center gap-3 py-1">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMe ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isMe ? 'text-white' : 'text-blue-600'}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isMe ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                                                        {msg.content || 'Document'}
                                                    </p>
                                                    <p className={`text-xs ${isMe ? 'text-white/70' : 'text-slate-500'}`}>
                                                        {msg.media_url?.includes('.pdf') ? 'PDF Document' : 'Document'}
                                                    </p>
                                                </div>
                                                {msg.media_url && (
                                                    <a 
                                                        href={msg.media_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className={`p-2 rounded-lg ${isMe ? 'bg-white/20 hover:bg-white/30' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'} transition-colors`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {/* Video Message */}
                                        {msg.type === 'video' && (
                                            <div className="-m-1">
                                                <div className="relative rounded-xl overflow-hidden">
                                                    <video 
                                                        src={msg.media_url} 
                                                        className="w-full max-h-64 object-cover bg-black" 
                                                        controls
                                                        playsInline
                                                    />
                                                    {msg.content && <p className="mt-2 text-sm mx-1">{msg.content}</p>}
                                                </div>
                                            </div>
                                        )}

                                        {/* Message Reactions - WhatsApp Style */}
                                        {messageReactions[msg.id] && messageReactions[msg.id].length > 0 && (
                                            <motion.div 
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className={`absolute -bottom-3 ${isMe ? 'left-2' : 'right-2'} flex items-center gap-0.5 px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded-full shadow-md border border-slate-200 dark:border-slate-600`}
                                            >
                                                {/* Show unique emojis with count */}
                                                {Object.entries(
                                                    messageReactions[msg.id].reduce((acc: Record<string, number>, emoji) => {
                                                        acc[emoji] = (acc[emoji] || 0) + 1;
                                                        return acc;
                                                    }, {})
                                                ).slice(0, 3).map(([emoji, count]: [string, number]) => (
                                                    <span key={emoji} className="flex items-center text-sm">
                                                        {emoji}
                                                        {count > 1 && <span className="text-[10px] text-slate-500 ml-0.5">{count}</span>}
                                                    </span>
                                                ))}
                                            </motion.div>
                                        )}

                                        {/* Timestamp & Status - Only for non-text messages */}
                                        {msg.type !== 'text' && (
                                            <div className={`flex items-center gap-1 px-3 pb-1.5 pt-1 ${isMe ? 'justify-end' : 'justify-start'} ${messageReactions[msg.id]?.length ? 'mb-2' : ''}`}>
                                                <span className={`text-[11px] ${isMe ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {formatTime(msg.created_at)}
                                                </span>
                                                {isMe && (
                                                    <span className={msg.status === 'read' ? 'text-white' : 'text-white/60'}>
                                                        {msg.status === 'read' ? <Icons.DoubleTick /> : <Icons.SingleTick />}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </SwipeableMessage>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Fixed Bottom Section */}
            <div className="absolute bottom-0 left-0 right-0 z-30 safe-area-bottom">
                {/* Quick Action Buttons */}
                <div className="px-3 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setInputText('Can you share your latest crop diagnosis report? 📋')}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-xs font-semibold shadow-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        Send Report
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setInputText('Please show me all your crop reports 📊')}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-full text-xs font-semibold shadow-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                        View Reports
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setInputText('What are the current market prices for crops? 📈')}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-full text-xs font-semibold shadow-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Market Prices
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setInputText('Can you share weather update for your area? 🌤️')}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-full text-xs font-semibold shadow-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                        Weather
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setInputText('Need help with crop disease identification 🔬')}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-full text-xs font-semibold shadow-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        Diagnose
                    </motion.button>
                </div>
            </div>

            {/* Reply Preview Bar */}
            <AnimatePresence>
                {replyingTo && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-t border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-shrink-0 w-1 h-10 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                                    Replying to {replyingTo.sender_id === user.id ? 'yourself' : (activeRoom?.other_user?.name || 'User')}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                    {replyingTo.type === 'image' ? '📷 Photo' : replyingTo.type === 'audio' ? '🎤 Voice message' : replyingTo.content}
                                </p>
                            </div>
                            <button
                                onClick={() => setReplyingTo(null)}
                                className="flex-shrink-0 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Input Bar - Fixed */}
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-end gap-2">
                    {/* Attachment Button */}
                    <button 
                        onClick={() => setShowAttach(!showAttach)} 
                        className={`p-2.5 rounded-full transition-all ${showAttach ? 'bg-green-100 dark:bg-green-900/30 text-green-600 rotate-45' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <Icons.Clip />
                    </button>
                    
                    {/* Input Container */}
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl flex items-end px-3 py-1 min-h-[44px] transition-all focus-within:ring-2 focus-within:ring-green-500/30">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            <Icons.Emoji />
                        </button>
                        <textarea 
                            value={inputText}
                            onChange={(e) => {
                                setInputText(e.target.value);
                                // Auto-resize
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            placeholder="Type a message..."
                            rows={1}
                            className="flex-1 bg-transparent px-2 py-2 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 resize-none text-[15px] max-h-[120px]"
                            style={{ height: 'auto' }}
                        />
                        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            <Icons.Camera />
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleFileUpload} />
                    </div>
                    
                    {/* Send/Mic Button */}
                    {inputText.trim() ? (
                        <motion.button 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            onClick={() => handleSendMessage()} 
                            className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all"
                        >
                            <Icons.Send />
                        </motion.button>
                    ) : (
                        <button 
                            onMouseDown={startRecording} 
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            className={`p-3 rounded-full shadow-lg transition-all ${
                                isRecording 
                                    ? 'bg-red-500 scale-110 shadow-red-500/30 animate-pulse' 
                                    : 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40'
                            }`}
                        >
                            <span className="text-white"><Icons.Mic /></span>
                        </button>
                    )}
                </div>
            </div>
            </div>{/* End of Fixed Bottom Section */}

            {/* Hidden file inputs for different types */}
            <input type="file" ref={documentInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" onChange={handleFileUpload} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleFileUpload} />
            <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />

            {/* Attachment Menu - Floating */}
            <AnimatePresence>
                {showAttach && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="absolute bottom-32 left-4 right-4 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 z-40 border border-slate-200/50 dark:border-slate-700/50"
                    >
                        <div className="grid grid-cols-4 gap-4">
                            {/* Gallery - Images */}
                            <button className="flex flex-col items-center gap-2 group" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                    <Icons.Image />
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Gallery</span>
                            </button>
                            
                            {/* Camera - Take Photo */}
                            <button className="flex flex-col items-center gap-2 group" onClick={handleCameraCapture}>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
                                    <Icons.Camera />
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Camera</span>
                            </button>
                            
                            {/* Video */}
                            <button className="flex flex-col items-center gap-2 group" onClick={() => videoInputRef.current?.click()}>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 group-hover:scale-110 transition-transform">
                                    <Icons.Video />
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Video</span>
                            </button>
                            
                            {/* Document */}
                            <button className="flex flex-col items-center gap-2 group" onClick={() => documentInputRef.current?.click()}>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Document</span>
                            </button>
                        </div>
                        
                        {/* Second Row */}
                        <div className="grid grid-cols-4 gap-4 mt-4">
                            {/* Location */}
                            <button onClick={handleShareLocation} className="flex flex-col items-center gap-2 group">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Location</span>
                            </button>
                            
                            {/* Contact - Placeholder for future */}
                            <button className="flex flex-col items-center gap-2 group opacity-50" disabled>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Contact</span>
                            </button>
                            
                            {/* Audio File */}
                            <button className="flex flex-col items-center gap-2 group opacity-50" disabled>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Audio</span>
                            </button>
                            
                            {/* Poll - Placeholder for future */}
                            <button className="flex flex-col items-center gap-2 group opacity-50" disabled>
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Poll</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Profile Info Overlay - Premium */}
            <AnimatePresence>
                {showProfileInfo && (
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center gap-4">
                            <button onClick={() => setShowProfileInfo(false)} className="p-1">
                                <Icons.Back />
                            </button>
                            <h2 className="font-semibold text-lg">Contact Info</h2>
                        </div>
                        
                        {/* Profile Card */}
                        <div className="p-8 flex flex-col items-center bg-gradient-to-b from-green-50 to-white dark:from-slate-800 dark:to-slate-900">
                            <div className="relative">
                                <img src={activeRoom?.is_group ? activeRoom.group_avatar : activeRoom?.other_user?.avatar} className="w-28 h-28 rounded-full shadow-xl ring-4 ring-white dark:ring-slate-700" />
                                <span className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-white dark:border-slate-900"></span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">{activeRoom?.is_group ? activeRoom.name : activeRoom?.other_user?.name}</h2>
                            <p className="text-slate-500 dark:text-slate-400">{activeRoom?.other_user?.phone || '+91 XXXXX XXXXX'}</p>
                            <div className="flex gap-4 mt-4">
                                <button onClick={startCall} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600">
                                    <Icons.Phone />
                                    <span className="text-xs font-medium">Call</span>
                                </button>
                                <button className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                                    <Icons.Video />
                                    <span className="text-xs font-medium">Video</span>
                                </button>
                                <button className="flex flex-col items-center gap-1 p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600">
                                    <Icons.Search />
                                    <span className="text-xs font-medium">Search</span>
                                </button>
                            </div>
                        </div>
                        
                        {/* About Section */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-500 font-semibold uppercase mb-2">About</p>
                            <p className="text-slate-800 dark:text-white">{activeRoom?.description || activeRoom?.other_user?.about || "Hey there! I am using Fasal Rakshak. 🌾"}</p>
                        </div>

                        {/* Info Items */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-500 font-semibold uppercase mb-2">Details</p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">📍</span>
                                    <span className="text-slate-800 dark:text-white">{activeRoom?.other_user?.location?.district || 'Karnataka, India'}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🌾</span>
                                    <span className="text-slate-800 dark:text-white">{activeRoom?.other_user?.crops_grown?.join(', ') || 'Farming enthusiast'}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Block Button */}
                        <div className="p-4 mt-auto">
                            <button onClick={() => { 
                                if (user?.id && activeRoom?.other_user?.id) {
                                    blockUser(user.id, activeRoom.other_user.id, true); 
                                }
                                setShowProfileInfo(false); 
                                handleBackToList(); 
                            }} className="w-full py-3 text-red-500 font-semibold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-red-200 dark:border-red-900/30">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                Block {activeRoom?.is_group ? 'Group' : 'Contact'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image/Video Preview Modal - WhatsApp Style */}
            <AnimatePresence>
                {showImagePreview && previewFiles.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm safe-area-top">
                            <button 
                                onClick={() => {
                                    previewFiles.forEach(p => URL.revokeObjectURL(p.preview));
                                    setPreviewFiles([]);
                                    setShowImagePreview(false);
                                }}
                                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                            <div className="text-white text-center">
                                <p className="text-sm font-medium">{activeRoom?.is_group ? activeRoom.name : activeRoom?.other_user?.name}</p>
                                <p className="text-xs text-white/60">{previewFiles.length} item{previewFiles.length > 1 ? 's' : ''} selected</p>
                            </div>
                            <button 
                                onClick={() => handleRemovePreview(currentPreviewIndex)}
                                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>

                        {/* Preview Area - Properly constrained */}
                        <div className="flex-1 min-h-0 flex items-center justify-center p-4 relative overflow-hidden">
                            {previewFiles[currentPreviewIndex]?.file.type.startsWith('video/') ? (
                                <video 
                                    src={previewFiles[currentPreviewIndex]?.preview} 
                                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                                    style={{ maxHeight: 'calc(100vh - 280px)' }}
                                    controls
                                    autoPlay
                                    muted
                                />
                            ) : (
                                <img 
                                    src={previewFiles[currentPreviewIndex]?.preview} 
                                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
                                    style={{ maxHeight: 'calc(100vh - 280px)' }}
                                    alt="Preview"
                                />
                            )}
                            
                            {/* Navigation Arrows */}
                            {previewFiles.length > 1 && (
                                <>
                                    {currentPreviewIndex > 0 && (
                                        <button 
                                            onClick={() => setCurrentPreviewIndex(prev => prev - 1)}
                                            className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                        </button>
                                    )}
                                    {currentPreviewIndex < previewFiles.length - 1 && (
                                        <button 
                                            onClick={() => setCurrentPreviewIndex(prev => prev + 1)}
                                            className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Thumbnails */}
                        {previewFiles.length > 1 && (
                            <div className="flex-shrink-0 px-4 py-2 flex gap-2 justify-center overflow-x-auto">
                                {previewFiles.map((file, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentPreviewIndex(index)}
                                        className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                                            index === currentPreviewIndex ? 'border-green-500 scale-105' : 'border-transparent opacity-60'
                                        }`}
                                    >
                                        {file.file.type.startsWith('video/') ? (
                                            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                            </div>
                                        ) : (
                                            <img src={file.preview} className="w-full h-full object-cover" alt="" />
                                        )}
                                    </button>
                                ))}
                                {/* Add More Button */}
                                <button
                                    onClick={handleAddMoreFiles}
                                    className="w-14 h-14 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center flex-shrink-0 hover:border-white/50 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                </button>
                            </div>
                        )}

                        {/* Caption & Send */}
                        <div className="p-4 bg-black/50 backdrop-blur-sm safe-area-bottom">
                            {/* Web3 Encryption Badge */}
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    <span className="text-[10px] text-purple-300 font-medium">Web3 Encrypted • Decentralized Storage</span>
                                </div>
                            </div>
                            
                            <div className="flex items-end gap-3">
                                <div className="flex-1 bg-white/10 rounded-2xl px-4 py-3">
                                    <input
                                        type="text"
                                        value={previewFiles[currentPreviewIndex]?.caption || ''}
                                        onChange={(e) => handleUpdateCaption(e.target.value)}
                                        placeholder="Add a caption..."
                                        className="w-full bg-transparent text-white placeholder:text-white/50 outline-none text-sm"
                                    />
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleSendPreviewFiles}
                                    className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full shadow-lg shadow-green-500/30"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Selection Mode Action Bar */}
            <AnimatePresence>
                {isSelectionMode && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 safe-area-bottom"
                    >
                        <div className="flex items-center justify-between">
                            <button 
                                onClick={handleCancelSelection}
                                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {selectedMessages.length} selected
                            </span>
                            <div className="flex items-center gap-2">
                                {/* Reply */}
                                {selectedMessages.length === 1 && (
                                    <button 
                                        onClick={() => {
                                            const msg = messages.find(m => m.id === selectedMessages[0]);
                                            if (msg) setReplyingTo(msg);
                                            handleCancelSelection();
                                        }}
                                        className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                                    </button>
                                )}
                                {/* Forward */}
                                <button className="p-2.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                                </button>
                                {/* Delete */}
                                <button 
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
                        onClick={() => setShowDeleteConfirm(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl"
                        >
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete {selectedMessages.length} message{selectedMessages.length > 1 ? 's' : ''}?</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This action cannot be undone.</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDeleteSelected}
                                    className="flex-1 py-2.5 px-4 bg-red-500 text-white rounded-xl font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* User Profile Modal - Telegram Style */}
            <AnimatePresence>
                {showUserProfile && activeRoom && !activeRoom.is_group && (
                    <motion.div 
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-0 z-[80] bg-slate-100 dark:bg-slate-900 overflow-y-auto"
                    >
                        {/* Large Header Image */}
                        <div className="relative h-80">
                            <img 
                                src={activeRoom.other_user?.avatar} 
                                className="w-full h-full object-cover"
                            />
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                            
                            {/* Back Button */}
                            <button 
                                onClick={() => setShowUserProfile(false)}
                                className="absolute top-4 left-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors safe-area-top"
                            >
                                <Icons.Back />
                            </button>
                            
                            {/* More Options */}
                            <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors safe-area-top">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                            </button>
                            
                            {/* Name & Status on Image */}
                            <div className="absolute bottom-4 left-4 right-4">
                                <h2 className="text-2xl font-bold text-white mb-0.5">
                                    {activeRoom.other_user?.name}
                                </h2>
                                <p className="text-white/80 text-sm">online</p>
                            </div>
                            
                            {/* Floating Message Button */}
                            <button 
                                onClick={() => setShowUserProfile(false)}
                                className="absolute -bottom-7 right-4 w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </button>
                        </div>

                        {/* User Info Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-t-3xl -mt-6 relative pt-8 pb-4">
                            {/* Username */}
                            <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">{activeRoom.other_user?.farmer_id || 'farmer_user'}</p>
                                    <p className="text-sm text-slate-400">Username</p>
                                </div>
                            </div>
                            
                            {/* Phone */}
                            {activeRoom.other_user?.phone && (
                                <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                        <Icons.Phone />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">{activeRoom.other_user.phone}</p>
                                        <p className="text-sm text-slate-400">Phone</p>
                                    </div>
                                </div>
                            )}
                            
                            {/* Bio */}
                            <div className="flex items-center gap-4 px-4 py-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">{activeRoom.other_user?.about || 'Farming enthusiast 🌾'}</p>
                                    <p className="text-sm text-slate-400">Bio</p>
                                </div>
                            </div>
                        </div>

                        {/* Settings Section */}
                        <div className="bg-white dark:bg-slate-800 mt-2">
                            <button 
                                onClick={() => handleMuteChat(activeRoom.id)}
                                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-slate-900 dark:text-white">Notifications</p>
                                    <p className="text-sm text-slate-400">{activeRoom.is_muted ? 'Disabled' : 'Enabled'}</p>
                                </div>
                            </button>
                        </div>

                        {/* Media Tabs - Telegram Style */}
                        <div className="bg-white dark:bg-slate-800 mt-2">
                            <div className="flex overflow-x-auto no-scrollbar">
                                {(['media', 'docs', 'links', 'audio'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setProfileMediaTab(tab as any)}
                                        className={`flex-1 min-w-[80px] py-3 px-4 text-sm font-semibold uppercase tracking-wide transition-colors ${
                                            profileMediaTab === tab 
                                                ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-full mx-1' 
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Media Grid */}
                            <div className="p-2 min-h-[200px]">
                                {profileMediaTab === 'media' && (
                                    userMedia.filter(m => m.type === 'image' || m.type === 'video').length > 0 ? (
                                        <div className="grid grid-cols-3 gap-0.5">
                                            {userMedia.filter(m => m.type === 'image' || m.type === 'video').map((media) => (
                                                <div key={media.id} className="aspect-square relative overflow-hidden bg-slate-100 dark:bg-slate-700">
                                                    {media.type === 'image' ? (
                                                        <img src={media.media_url} className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                            <Icons.Play />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 text-slate-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                            <p className="text-sm">No media shared yet</p>
                                        </div>
                                    )
                                )}
                                
                                {profileMediaTab === 'docs' && (
                                    userMedia.filter(m => m.type === 'document').length > 0 ? (
                                        <div className="space-y-1 p-2">
                                            {userMedia.filter(m => m.type === 'document').map((doc) => (
                                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{doc.content || 'Document'}</p>
                                                        <p className="text-xs text-slate-400">{formatDate(doc.created_at)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 text-slate-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            <p className="text-sm">No documents shared yet</p>
                                        </div>
                                    )
                                )}
                                
                                {profileMediaTab === 'links' && (
                                    <div className="text-center py-16 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                        <p className="text-sm">No links shared yet</p>
                                    </div>
                                )}
                                
                                {profileMediaTab === 'audio' && (
                                    userMedia.filter(m => m.type === 'audio').length > 0 ? (
                                        <div className="space-y-1 p-2">
                                            {userMedia.filter(m => m.type === 'audio').map((audio) => (
                                                <div key={audio.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                                    <button className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                                        <Icons.Play />
                                                    </button>
                                                    <div className="flex-1">
                                                        <div className="h-1 bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{audio.media_duration || '0:00'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 text-slate-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                                            <p className="text-sm">No audio shared yet</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-2 bg-white dark:bg-slate-800 mb-8">
                            <button 
                                onClick={handleBlockUser}
                                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                                    <Icons.Block />
                                </div>
                                <p className="font-medium text-red-500">{isBlocked ? 'Unblock' : 'Block'} {activeRoom.other_user?.name}</p>
                            </button>
                        </div>
                        
                        <div className="h-8 safe-area-bottom"></div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden Audio Element for Audio Calls */}
            <audio 
                ref={remoteAudioRef} 
                autoPlay 
                playsInline 
                style={{ display: 'none' }}
            />

            {/* ========== CALL UI (Full Screen Overlay) ========== */}
            <AnimatePresence>
                {(callState.isInCall || callState.isIncoming) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
                    >
                        {/* Video Call - Connected - Full Screen Video */}
                        {callState.callType === 'video' && callState.isConnected && (
                            <>
                                {/* Remote Video - Full Screen */}
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                
                                {/* Local Video - Picture in Picture */}
                                <motion.div
                                    drag
                                    dragConstraints={{ left: 0, right: window.innerWidth - 120, top: 0, bottom: window.innerHeight - 180 }}
                                    className="absolute top-16 right-4 w-28 h-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20"
                                >
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                </motion.div>
                            </>
                        )}

                        {/* Video Call - Outgoing/Connecting - Show local video as background */}
                        {callState.callType === 'video' && callState.isOutgoing && !callState.isConnected && (
                            <>
                                {/* Local Video - Full Screen Background */}
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                                />
                                {/* Dark overlay */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
                            </>
                        )}

                        {/* Video Call - Incoming - Show gradient background */}
                        {callState.callType === 'video' && callState.isIncoming && !callState.isConnected && (
                            <div className="absolute inset-0 bg-gradient-to-b from-green-900/50 via-slate-900 to-slate-900" />
                        )}

                        {/* Audio Call / Calling / Incoming / Connecting UI - Show avatar and controls */}
                        {(callState.callType === 'audio' || !callState.isConnected) && (
                            <div className="flex flex-col items-center justify-center h-full text-white safe-area-top safe-area-bottom">
                                {/* Caller/Receiver Info */}
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center"
                                >
                                    {/* Avatar with pulse animation for ringing */}
                                    <div className="relative inline-block mb-6">
                                        {(callState.isOutgoing || callState.isIncoming) && !callState.isConnected && (
                                            <motion.div
                                                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="absolute inset-0 bg-green-500 rounded-full"
                                            />
                                        )}
                                        {/* Green border when connected */}
                                        {callState.isConnected && (
                                            <motion.div
                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="absolute -inset-1 border-4 border-green-500 rounded-full"
                                            />
                                        )}
                                        <img
                                            src={
                                                callState.isOutgoing 
                                                    ? callState.receiverAvatar 
                                                    : callState.callerAvatar
                                            }
                                            alt=""
                                            className="w-32 h-32 rounded-full object-cover border-4 border-white/30 relative z-10"
                                        />
                                    </div>
                                    
                                    <h2 className="text-2xl font-bold mb-2">
                                        {callState.isOutgoing 
                                            ? callState.receiverName 
                                            : callState.callerName}
                                    </h2>
                                    
                                    <p className="text-white/70 text-lg">
                                        {callState.isIncoming && !callState.isConnected && (
                                            <span className="flex items-center gap-2 justify-center">
                                                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                Incoming {callState.callType} call...
                                            </span>
                                        )}
                                        {callState.isOutgoing && !callState.isConnected && callState.isRinging && 'Ringing...'}
                                        {callState.isOutgoing && !callState.isConnected && !callState.isRinging && 'Calling...'}
                                        {callState.callStatus === 'connecting' && (
                                            <span className="flex items-center gap-2 justify-center">
                                                <motion.span 
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                                />
                                                Connecting...
                                            </span>
                                        )}
                                        {callState.isConnected && formatCallDuration(callDuration)}
                                    </p>
                                </motion.div>

                                {/* Call Status Animation - Outgoing */}
                                {!callState.isConnected && callState.isOutgoing && (
                                    <div className="mt-8 flex gap-2">
                                        {[0, 1, 2].map((i) => (
                                            <motion.div
                                                key={i}
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                                                className="w-3 h-3 bg-white rounded-full"
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Incoming Call - Ringing Animation */}
                                {!callState.isConnected && callState.isIncoming && (
                                    <div className="mt-8 flex flex-col items-center gap-4">
                                        <motion.div
                                            animate={{ 
                                                rotate: [0, -15, 15, -15, 15, 0],
                                                scale: [1, 1.1, 1]
                                            }}
                                            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                                            className="text-4xl"
                                        >
                                            📱
                                        </motion.div>
                                        <p className="text-white/60 text-sm">Swipe up to answer</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Call Controls */}
                        <div className="absolute bottom-0 left-0 right-0 pb-12 safe-area-bottom">
                            {/* Incoming Call - Accept/Reject with Animation */}
                            {callState.isIncoming && !callState.isConnected && (
                                <div className="flex flex-col items-center gap-6">
                                    <div className="flex items-center justify-center gap-16">
                                        {/* Reject with label */}
                                        <div className="flex flex-col items-center gap-2">
                                            <motion.button
                                                whileTap={{ scale: 0.95 }}
                                                onClick={rejectCall}
                                                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30"
                                            >
                                                <Icons.EndCall />
                                            </motion.button>
                                            <span className="text-white/80 text-sm">Decline</span>
                                        </div>
                                        
                                        {/* Accept with pulse animation and label */}
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="relative">
                                                <motion.div
                                                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                    className="absolute inset-0 bg-green-500 rounded-full"
                                                />
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={acceptCall}
                                                    className="relative w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/30 z-10"
                                                >
                                                    {callState.callType === 'video' ? <Icons.Video /> : <Icons.Phone />}
                                                </motion.button>
                                            </div>
                                            <span className="text-white/80 text-sm">Accept</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Outgoing Call / Connecting / Connected - Control Buttons */}
                            {(callState.isOutgoing || callState.isConnected || callState.callStatus === 'connecting') && (
                                <div className="flex items-center justify-center gap-6">
                                    {/* Mute */}
                                    <button
                                        onClick={toggleMute}
                                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                                            callState.isMuted 
                                                ? 'bg-white text-slate-900' 
                                                : 'bg-white/20 text-white'
                                        }`}
                                    >
                                        {callState.isMuted ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                                        ) : (
                                            <Icons.Mic />
                                        )}
                                    </button>

                                    {/* Video Toggle (only for video calls) */}
                                    {callState.callType === 'video' && (
                                        <button
                                            onClick={toggleVideo}
                                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                                                !callState.isVideoEnabled 
                                                    ? 'bg-white text-slate-900' 
                                                    : 'bg-white/20 text-white'
                                            }`}
                                        >
                                            {callState.isVideoEnabled ? (
                                                <Icons.Video />
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 6 4V4l-6 4"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/></svg>
                                            )}
                                        </button>
                                    )}

                                    {/* Flip Camera (only for video calls) */}
                                    {callState.callType === 'video' && callState.isConnected && (
                                        <button
                                            onClick={switchCamera}
                                            className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><circle cx="12" cy="12" r="3"/><path d="m18 22-3-3 3-3"/><path d="m6 2 3 3-3 3"/></svg>
                                        </button>
                                    )}

                                    {/* Speaker (only for audio calls) */}
                                    {callState.callType === 'audio' && (
                                        <button
                                            onClick={() => setCallState(prev => ({ ...prev, isSpeakerOn: !prev.isSpeakerOn }))}
                                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                                                callState.isSpeakerOn 
                                                    ? 'bg-white text-slate-900' 
                                                    : 'bg-white/20 text-white'
                                            }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                        </button>
                                    )}

                                    {/* End Call */}
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={endCall}
                                        className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30"
                                    >
                                        <Icons.EndCall />
                                    </motion.button>
                                </div>
                            )}
                        </div>

                        {/* Call Info Bar (for connected calls) */}
                        {callState.isConnected && (
                            <div className="absolute top-0 left-0 right-0 pt-4 safe-area-top">
                                <div className="flex items-center justify-between px-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-white/80 text-sm font-medium">
                                            {callState.callType === 'video' ? 'Video Call' : 'Voice Call'}
                                        </span>
                                    </div>
                                    <span className="text-white font-mono text-sm bg-white/10 px-3 py-1 rounded-full">
                                        {formatCallDuration(callDuration)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Permission Request Modal for Calls */}
            <PermissionRequestModal
                isOpen={showPermissionModal}
                onClose={() => {
                    setShowPermissionModal(false);
                    setPendingCallType(null);
                }}
                onComplete={handlePermissionComplete}
                context={pendingCallType === 'video' ? 'video-call' : 'audio-call'}
                requestedPermissions={pendingCallType === 'video' ? ['microphone', 'camera', 'notifications'] : ['microphone', 'notifications']}
            />
        </div>
    );
};
