/**
 * Permission Service
 * Handles checking and requesting all app permissions
 * Note: Camera and Microphone require HTTPS (secure context)
 */

export interface PermissionStatus {
    camera: PermissionState | 'unsupported';
    microphone: PermissionState | 'unsupported';
    notifications: NotificationPermission | 'unsupported';
    location: PermissionState | 'unsupported';
    storage: boolean;
    isSecureContext: boolean;
}

export type PermissionType = 'camera' | 'microphone' | 'notifications' | 'location' | 'storage';

class PermissionService {
    private permissionStatus: PermissionStatus = {
        camera: 'prompt',
        microphone: 'prompt',
        notifications: 'default',
        location: 'prompt',
        storage: true,
        isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    };

    /**
     * Check if running in secure context (HTTPS or localhost)
     */
    isSecure(): boolean {
        return typeof window !== 'undefined' && window.isSecureContext;
    }

    /**
     * Check all permissions status
     */
    async checkAllPermissions(): Promise<PermissionStatus> {
        const [camera, microphone, location] = await Promise.all([
            this.checkCameraPermission(),
            this.checkMicrophonePermission(),
            this.checkLocationPermission(),
        ]);

        this.permissionStatus = {
            camera,
            microphone,
            notifications: this.checkNotificationPermission(),
            location,
            storage: this.checkStoragePermission(),
            isSecureContext: this.isSecure(),
        };

        return this.permissionStatus;
    }

    /**
     * Check camera permission
     */
    async checkCameraPermission(): Promise<PermissionState | 'unsupported'> {
        try {
            // First check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                // Check if we're in a secure context
                if (typeof window !== 'undefined' && !window.isSecureContext) {
                    console.warn('Camera requires HTTPS. Current context is not secure.');
                }
                return 'unsupported';
            }
            
            if (!navigator.permissions) {
                // Permissions API not available, but mediaDevices is - return 'prompt'
                return 'prompt';
            }
            const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
            return result.state;
        } catch {
            // Some browsers don't support querying camera permission, return prompt
            return 'prompt';
        }
    }

    /**
     * Check microphone permission
     */
    async checkMicrophonePermission(): Promise<PermissionState | 'unsupported'> {
        try {
            // First check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                // Check if we're in a secure context
                if (typeof window !== 'undefined' && !window.isSecureContext) {
                    console.warn('Microphone requires HTTPS. Current context is not secure.');
                }
                return 'unsupported';
            }
            
            if (!navigator.permissions) {
                // Permissions API not available, but mediaDevices is - return 'prompt'
                return 'prompt';
            }
            const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            return result.state;
        } catch {
            // Some browsers don't support querying microphone permission, return prompt
            return 'prompt';
        }
    }

    /**
     * Check notification permission
     */
    checkNotificationPermission(): NotificationPermission | 'unsupported' {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    /**
     * Check location permission
     */
    async checkLocationPermission(): Promise<PermissionState | 'unsupported'> {
        try {
            if (!navigator.permissions) return 'unsupported';
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state;
        } catch {
            return 'unsupported';
        }
    }

    /**
     * Check storage permission (localStorage availability)
     */
    checkStoragePermission(): boolean {
        try {
            localStorage.setItem('__test__', 'test');
            localStorage.removeItem('__test__');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Request camera permission
     */
    async requestCameraPermission(): Promise<boolean> {
        try {
            // Check if mediaDevices is available (requires HTTPS or localhost)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Camera API not available. Make sure you are using HTTPS.');
                // Try legacy API as fallback
                const legacyGetUserMedia = (navigator as any).getUserMedia || 
                                          (navigator as any).webkitGetUserMedia || 
                                          (navigator as any).mozGetUserMedia ||
                                          (navigator as any).msGetUserMedia;
                
                if (legacyGetUserMedia) {
                    return new Promise((resolve) => {
                        legacyGetUserMedia.call(navigator, 
                            { video: true },
                            (stream: MediaStream) => {
                                stream.getTracks().forEach(track => track.stop());
                                resolve(true);
                            },
                            () => resolve(false)
                        );
                    });
                }
                return false;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Camera permission denied:', error);
            return false;
        }
    }

    /**
     * Request microphone permission
     */
    async requestMicrophonePermission(): Promise<boolean> {
        try {
            // Check if mediaDevices is available (requires HTTPS or localhost)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Microphone API not available. Make sure you are using HTTPS.');
                // Try legacy API as fallback
                const legacyGetUserMedia = (navigator as any).getUserMedia || 
                                          (navigator as any).webkitGetUserMedia || 
                                          (navigator as any).mozGetUserMedia ||
                                          (navigator as any).msGetUserMedia;
                
                if (legacyGetUserMedia) {
                    return new Promise((resolve) => {
                        legacyGetUserMedia.call(navigator, 
                            { audio: true },
                            (stream: MediaStream) => {
                                stream.getTracks().forEach(track => track.stop());
                                resolve(true);
                            },
                            () => resolve(false)
                        );
                    });
                }
                return false;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            return false;
        }
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission(): Promise<boolean> {
        try {
            if (!('Notification' in window)) return false;
            const result = await Notification.requestPermission();
            return result === 'granted';
        } catch (error) {
            console.error('Notification permission denied:', error);
            return false;
        }
    }

    /**
     * Request location permission
     */
    async requestLocationPermission(): Promise<boolean> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(false);
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                () => resolve(true),
                () => resolve(false),
                { timeout: 10000 }
            );
        });
    }

    /**
     * Request specific permission
     */
    async requestPermission(type: PermissionType): Promise<boolean> {
        switch (type) {
            case 'camera':
                return this.requestCameraPermission();
            case 'microphone':
                return this.requestMicrophonePermission();
            case 'notifications':
                return this.requestNotificationPermission();
            case 'location':
                return this.requestLocationPermission();
            case 'storage':
                return this.checkStoragePermission();
            default:
                return false;
        }
    }

    /**
     * Request permissions needed for audio call
     */
    async requestAudioCallPermissions(): Promise<{ granted: boolean; missing: PermissionType[] }> {
        const missing: PermissionType[] = [];
        
        const micGranted = await this.requestMicrophonePermission();
        if (!micGranted) missing.push('microphone');
        
        // Also request notifications for incoming calls
        const notifGranted = await this.requestNotificationPermission();
        if (!notifGranted) missing.push('notifications');
        
        return { granted: missing.length === 0, missing };
    }

    /**
     * Request permissions needed for video call
     */
    async requestVideoCallPermissions(): Promise<{ granted: boolean; missing: PermissionType[] }> {
        const missing: PermissionType[] = [];
        
        const [micGranted, camGranted] = await Promise.all([
            this.requestMicrophonePermission(),
            this.requestCameraPermission(),
        ]);
        
        if (!micGranted) missing.push('microphone');
        if (!camGranted) missing.push('camera');
        
        // Also request notifications for incoming calls
        const notifGranted = await this.requestNotificationPermission();
        if (!notifGranted) missing.push('notifications');
        
        return { granted: missing.length === 0, missing };
    }

    /**
     * Request all permissions
     */
    async requestAllPermissions(): Promise<PermissionStatus> {
        await Promise.all([
            this.requestCameraPermission(),
            this.requestMicrophonePermission(),
            this.requestNotificationPermission(),
            this.requestLocationPermission(),
        ]);
        
        return this.checkAllPermissions();
    }

    /**
     * Show native notification
     */
    async showNotification(title: string, options?: NotificationOptions): Promise<Notification | null> {
        if (Notification.permission !== 'granted') {
            const granted = await this.requestNotificationPermission();
            if (!granted) return null;
        }
        
        try {
            const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                ...options,
            };
            // Add vibrate pattern (not in all TypeScript definitions but supported in browsers)
            (notificationOptions as any).vibrate = [200, 100, 200];
            
            return new Notification(title, notificationOptions);
        } catch (error) {
            console.error('Failed to show notification:', error);
            return null;
        }
    }

    /**
     * Subscribe to Web Push notifications for background notifications
     * This allows receiving notifications even when the app is closed
     */
    async subscribeToPushNotifications(): Promise<PushSubscription | null> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                console.log('Already subscribed to push notifications');
                return subscription;
            }

            // Generate VAPID keys - In production, use your own keys
            // You can generate them using: npx web-push generate-vapid-keys
            const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY'; // Replace with actual key
            
            if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY') {
                console.warn('Push notifications require VAPID keys. Using local notifications only.');
                return null;
            }

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            console.log('Push subscription created:', subscription);
            
            // TODO: Send subscription to your server to store and use for sending notifications
            // await this.saveSubscriptionToServer(subscription);
            
            return subscription;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            return null;
        }
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Get permission display name
     */
    getPermissionDisplayName(type: PermissionType): string {
        const names: Record<PermissionType, string> = {
            camera: 'Camera',
            microphone: 'Microphone',
            notifications: 'Notifications',
            location: 'Location',
            storage: 'Storage',
        };
        return names[type] || type;
    }

    /**
     * Get permission description
     */
    getPermissionDescription(type: PermissionType): string {
        const descriptions: Record<PermissionType, string> = {
            camera: 'Required for video calls and taking photos',
            microphone: 'Required for voice messages and calls',
            notifications: 'Required for incoming call alerts and messages',
            location: 'Required for weather and market information',
            storage: 'Required for saving your preferences',
        };
        return descriptions[type] || '';
    }
}

export const permissionService = new PermissionService();
export default permissionService;
