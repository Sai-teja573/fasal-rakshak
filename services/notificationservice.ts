
import { getSupabase } from './supabaseClient';

// Types
export interface AppNotification {
    id: string;
    type: 'message' | 'alert' | 'system' | 'disease' | 'weather' | 'market' | 'call';
    title: string;
    body: string;
    icon?: string;
    image?: string;
    data?: any;
    timestamp: number;
    read: boolean;
    actionUrl?: string;
    // Call-specific fields
    callType?: 'audio' | 'video';
    callerId?: string;
    callerName?: string;
    callerAvatar?: string;
    onAccept?: () => void;
    onDecline?: () => void;
}

// In-App Notification Store (for banner display)
let notificationListeners: ((notification: AppNotification) => void)[] = [];
let notifications: AppNotification[] = [];

// Subscribe to in-app notifications
export const subscribeToNotifications = (callback: (notification: AppNotification) => void) => {
    notificationListeners.push(callback);
    return () => {
        notificationListeners = notificationListeners.filter(cb => cb !== callback);
    };
};

// Get all notifications
export const getNotifications = (): AppNotification[] => notifications;

// Mark notification as read
export const markAsRead = (id: string) => {
    notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
};

// Clear all notifications
export const clearAllNotifications = () => {
    notifications = [];
};

// Show in-app notification banner
export const showInAppNotification = (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const fullNotification: AppNotification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false
    };
    
    notifications.unshift(fullNotification);
    
    // Keep only last 50 notifications
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }
    
    // Notify all listeners (for banner display)
    notificationListeners.forEach(cb => cb(fullNotification));
    
    return fullNotification;
};

// --- PUSH NOTIFICATION SETUP ---

// Check if push notifications are supported
export const isPushSupported = (): boolean => {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

// Get current permission status
export const getPermissionStatus = (): NotificationPermission | 'unsupported' => {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
};

// Request notification permission
export const requestPermission = async (): Promise<boolean> => {
    if (!isPushSupported()) {
        console.log('[Notifications] Push not supported');
        return false;
    }
    
    try {
        const permission = await Notification.requestPermission();
        console.log('[Notifications] Permission:', permission);
        return permission === 'granted';
    } catch (e) {
        console.error('[Notifications] Permission request failed:', e);
        return false;
    }
};

// Subscribe to push notifications
export const subscribeToPush = async (userId: string): Promise<boolean> => {
    if (!isPushSupported()) return false;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        
        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Create new subscription
            // Note: In production, use your own VAPID keys
            const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
            
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });
        }
        
        // Save subscription to database
        const supabase = getSupabase();
        if (supabase && subscription) {
            await supabase.from('push_subscriptions').upsert({
                user_id: userId,
                endpoint: subscription.endpoint,
                keys: JSON.stringify(subscription.toJSON()),
                created_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            
            console.log('[Notifications] Push subscription saved');
        }
        
        return true;
    } catch (e) {
        console.error('[Notifications] Push subscription failed:', e);
        return false;
    }
};

// Unsubscribe from push notifications
export const unsubscribeFromPush = async (userId: string): Promise<boolean> => {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            await subscription.unsubscribe();
            
            const supabase = getSupabase();
            if (supabase) {
                await supabase.from('push_subscriptions').delete().eq('user_id', userId);
            }
        }
        
        return true;
    } catch (e) {
        console.error('[Notifications] Unsubscribe failed:', e);
        return false;
    }
};

// Show native notification (when app is in foreground)
export const showNativeNotification = async (title: string, options?: NotificationOptions & { actions?: any[] }): Promise<boolean> => {
    if (!isPushSupported() || Notification.permission !== 'granted') {
        return false;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options
        });
        return true;
    } catch (e) {
        console.error('[Notifications] Show notification failed:', e);
        return false;
    }
};

// Send notification for new chat message
export const notifyNewMessage = async (
    senderName: string, 
    message: string, 
    roomId: string,
    senderAvatar?: string
) => {
    // Show in-app banner
    showInAppNotification({
        type: 'message',
        title: senderName,
        body: message.length > 50 ? message.substring(0, 50) + '...' : message,
        icon: senderAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
        data: { roomId },
        actionUrl: `/chat/${roomId}`
    });
    
    // Show native notification if app is not focused
    if (document.visibilityState === 'hidden') {
        await showNativeNotification(senderName, {
            body: message,
            icon: senderAvatar,
            tag: `chat-${roomId}`, // Prevents duplicate notifications
            data: { roomId, type: 'message' }
        });
    }
};

// Send notification for disease alert
export const notifyDiseaseAlert = async (disease: string, crop: string, distance: number) => {
    showInAppNotification({
        type: 'disease',
        title: '🚨 Disease Alert Nearby!',
        body: `${disease} detected in ${crop} crops ${distance}km away. Take preventive action!`,
        icon: '🦠'
    });
    
    await showNativeNotification('🚨 Disease Alert Nearby!', {
        body: `${disease} detected in ${crop} crops ${distance}km away`,
        tag: 'disease-alert',
        requireInteraction: true
    });
};

// Send notification for weather alert
export const notifyWeatherAlert = async (title: string, message: string) => {
    showInAppNotification({
        type: 'weather',
        title: `🌦️ ${title}`,
        body: message,
        icon: '⛈️'
    });
    
    await showNativeNotification(`🌦️ ${title}`, {
        body: message,
        tag: 'weather-alert'
    });
};

// Send notification for market price change
export const notifyMarketUpdate = async (crop: string, price: number, change: number) => {
    const isUp = change > 0;
    showInAppNotification({
        type: 'market',
        title: `${isUp ? '📈' : '📉'} ${crop} Price ${isUp ? 'Up' : 'Down'}`,
        body: `₹${price}/quintal (${isUp ? '+' : ''}${change.toFixed(1)}%)`,
        icon: isUp ? '📈' : '📉'
    });
};

// Helper: Convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
}

// --- REALTIME MESSAGE LISTENER ---

let messageSubscription: any = null;

export const startMessageListener = (userId: string, onMessage: (msg: any) => void) => {
    const supabase = getSupabase();
    if (!supabase) {
        console.error('[Notifications] No supabase client available');
        return;
    }
    
    // Stop any existing subscription first
    if (messageSubscription) {
        console.log('[Notifications] Cleaning up existing subscription');
        supabase.removeChannel(messageSubscription);
        messageSubscription = null;
    }
    
    console.log('[Notifications] Starting message listener for user:', userId);
    
    // Create a unique channel name to avoid conflicts
    const channelName = `global-messages-${userId}-${Date.now()}`;
    
    // Subscribe to new messages in rooms where user is a participant
    messageSubscription = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages'
            },
            async (payload) => {
                console.log('[Notifications] New message received via realtime:', payload.new);
                const newMsg = payload.new as any;
                
                // Don't notify for own messages
                if (newMsg.sender_id === userId) {
                    console.log('[Notifications] Skipping own message');
                    return;
                }
                
                // Check if user is participant in this room
                const { data: participant, error: partError } = await supabase
                    .from('chat_participants')
                    .select('user_id')
                    .eq('room_id', newMsg.room_id)
                    .eq('user_id', userId)
                    .single();
                
                if (partError || !participant) {
                    console.log('[Notifications] User not in this room, skipping notification');
                    return;
                }
                
                // Get sender info
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', newMsg.sender_id)
                    .single();
                
                console.log('[Notifications] Showing notification from:', sender?.full_name);
                
                // Trigger notification
                await notifyNewMessage(
                    sender?.full_name || 'New Message',
                    newMsg.content || 'Sent an attachment',
                    newMsg.room_id,
                    sender?.avatar_url
                );
                
                onMessage(newMsg);
            }
        )
        .subscribe((status) => {
            console.log('[Notifications] Subscription status:', status);
        });
    
    console.log('[Notifications] Message listener started');
};

export const stopMessageListener = () => {
    if (messageSubscription) {
        const supabase = getSupabase();
        if (supabase) {
            supabase.removeChannel(messageSubscription);
        }
        messageSubscription = null;
        console.log('[Notifications] Message listener stopped');
    }
};

// Request notification permission with user prompt
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!isPushSupported()) {
        console.log('[Notifications] Push not supported in this browser');
        return false;
    }
    
    // Check current permission
    if (Notification.permission === 'granted') {
        console.log('[Notifications] Permission already granted');
        return true;
    }
    
    if (Notification.permission === 'denied') {
        console.log('[Notifications] Permission was denied');
        return false;
    }
    
    // Request permission
    try {
        const permission = await Notification.requestPermission();
        console.log('[Notifications] Permission response:', permission);
        return permission === 'granted';
    } catch (e) {
        console.error('[Notifications] Permission request error:', e);
        return false;
    }
};
