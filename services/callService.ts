/**
 * WebRTC Call Service v2
 * Handles audio and video calls using WebRTC with Supabase Realtime for signaling
 * WhatsApp-like calling experience with proper ringing and cross-device support
 */

import { showInAppNotification } from './notificationService';
import { permissionService } from './permissionService';
import { getSupabase } from './supabaseClient';

export interface CallState {
    isInCall: boolean;
    isIncoming: boolean;
    isOutgoing: boolean;
    isConnected: boolean;
    isRinging: boolean;
    callType: 'audio' | 'video';
    callerId: string;
    callerName: string;
    callerAvatar: string;
    receiverId: string;
    receiverName: string;
    receiverAvatar: string;
    roomId: string;
    startTime?: Date;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isSpeakerOn: boolean;
    callStatus: 'idle' | 'requesting' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'busy' | 'no-answer' | 'error';
}

export interface CallSignal {
    type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accepted' | 'call-rejected' | 'call-ended' | 'call-busy' | 'call-ringing';
    payload: any;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    receiverId: string;
    callType: 'audio' | 'video';
    roomId: string;
    timestamp: number;
}

export const initialCallState: CallState = {
    isInCall: false,
    isIncoming: false,
    isOutgoing: false,
    isConnected: false,
    isRinging: false,
    callType: 'audio',
    callerId: '',
    callerName: '',
    callerAvatar: '',
    receiverId: '',
    receiverName: '',
    receiverAvatar: '',
    roomId: '',
    isMuted: false,
    isVideoEnabled: false,
    isSpeakerOn: false,
    callStatus: 'idle',
};

// ICE servers for STUN/TURN
// TURN servers are essential for NAT traversal when direct connection fails
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // OpenRelay free TURN servers (for development/testing)
        // In production, use your own TURN server or a paid service like Twilio/Xirsys
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        // Metered.ca free TURN (limited)
        {
            urls: 'turn:a.relay.metered.ca:80',
            username: 'e8dd65b92af6d02b70ca5ae8',
            credential: 'uWdTfzpQkP9KzSKl',
        },
        {
            urls: 'turn:a.relay.metered.ca:443',
            username: 'e8dd65b92af6d02b70ca5ae8',
            credential: 'uWdTfzpQkP9KzSKl',
        },
        {
            urls: 'turn:a.relay.metered.ca:443?transport=tcp',
            username: 'e8dd65b92af6d02b70ca5ae8',
            credential: 'uWdTfzpQkP9KzSKl',
        },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all', // Try all candidates (host, srflx, relay)
};

// Ringtone frequencies
const RINGTONE_FREQUENCIES = [440, 480]; // Standard phone ring
const RINGBACK_FREQUENCIES = [440, 480]; // What caller hears

class CallService {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private signalChannel: any = null;
    private currentUserId: string = '';
    private currentUserName: string = '';
    private currentUserAvatar: string = '';
    private onCallStateChange: ((state: CallState) => void) | null = null;
    private onRemoteStream: ((stream: MediaStream) => void) | null = null;
    private onLocalStream: ((stream: MediaStream) => void) | null = null;
    private callTimeout: NodeJS.Timeout | null = null;
    private currentRoomId: string = '';
    private currentCallState: CallState = { ...initialCallState };
    private audioContext: AudioContext | null = null;
    private ringtoneOscillators: OscillatorNode[] = [];
    private ringtoneGain: GainNode | null = null;
    private ringtoneInterval: NodeJS.Timeout | null = null;
    private incomingCallNotification: Notification | null = null;
    private pendingIceCandidates: RTCIceCandidateInit[] = [];

    /**
     * Initialize the call service with user info and callbacks
     */
    init(
        userId: string,
        userName: string,
        userAvatar: string,
        onCallStateChange: (state: CallState) => void,
        onLocalStream: (stream: MediaStream) => void,
        onRemoteStream: (stream: MediaStream) => void
    ) {
        this.currentUserId = userId;
        this.currentUserName = userName;
        this.currentUserAvatar = userAvatar;
        this.onCallStateChange = onCallStateChange;
        this.onLocalStream = onLocalStream;
        this.onRemoteStream = onRemoteStream;

        // Subscribe to incoming call signals
        this.subscribeToSignals();
        
        console.log('📞 Call service initialized for user:', userId);
    }

    /**
     * Subscribe to Supabase Realtime for call signaling
     */
    private subscribeToSignals() {
        const supabase = getSupabase();
        if (this.signalChannel) {
            supabase.removeChannel(this.signalChannel);
        }

        this.signalChannel = supabase.channel(`calls:${this.currentUserId}`)
            .on('broadcast', { event: 'signal' }, ({ payload }: { payload: CallSignal }) => {
                this.handleSignal(payload);
            })
            .subscribe((status: string) => {
                console.log('📞 Call signal channel status:', status);
            });
    }

    /**
     * Handle incoming signals
     */
    private async handleSignal(signal: CallSignal) {
        console.log('📞 Received signal:', signal.type, 'from:', signal.senderName);

        switch (signal.type) {
            case 'call-request':
                await this.handleIncomingCall(signal);
                break;

            case 'call-ringing':
                // Other party's phone is ringing
                this.updateCallState({
                    callStatus: 'ringing',
                    isRinging: true,
                });
                break;

            case 'call-accepted':
                // Other party accepted, start WebRTC connection
                this.clearCallTimeout();
                this.stopRingtone();
                this.updateCallState({
                    callStatus: 'connecting',
                    isRinging: false,
                });
                await this.createOffer(signal.senderId);
                break;

            case 'call-rejected':
                this.clearCallTimeout();
                this.stopRingtone();
                this.updateCallState({
                    isInCall: false,
                    isOutgoing: false,
                    isIncoming: false,
                    callStatus: 'rejected',
                });
                setTimeout(() => this.resetCallState(), 3000);
                break;

            case 'call-busy':
                this.clearCallTimeout();
                this.stopRingtone();
                this.updateCallState({
                    callStatus: 'busy',
                });
                setTimeout(() => this.resetCallState(), 3000);
                break;

            case 'call-ended':
                this.endCall(false);
                break;

            case 'offer':
                await this.handleOffer(signal.payload, signal.senderId);
                break;

            case 'answer':
                await this.handleAnswer(signal.payload);
                break;

            case 'ice-candidate':
                await this.handleIceCandidate(signal.payload);
                break;
        }
    }

    /**
     * Handle incoming call
     */
    private async handleIncomingCall(signal: CallSignal) {
        // Check if already in a call
        if (this.currentCallState.isInCall) {
            await this.sendSignal(signal.senderId, {
                type: 'call-busy',
                payload: null,
                senderId: this.currentUserId,
                senderName: this.currentUserName,
                senderAvatar: this.currentUserAvatar,
                receiverId: signal.senderId,
                callType: signal.callType,
                roomId: signal.roomId,
                timestamp: Date.now(),
            });
            return;
        }

        this.currentRoomId = signal.roomId;
        
        // Update state to show incoming call
        this.updateCallState({
            isInCall: true,
            isIncoming: true,
            isOutgoing: false,
            isRinging: true,
            callType: signal.callType,
            callerId: signal.senderId,
            callerName: signal.senderName,
            callerAvatar: signal.senderAvatar,
            roomId: signal.roomId,
            callStatus: 'ringing',
        });
        
        // Play ringtone
        this.playRingtone();
        
        // Show notification
        this.showIncomingCallNotification(signal);
        
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }

        // Send ringing signal back to caller
        await this.sendSignal(signal.senderId, {
            type: 'call-ringing',
            payload: null,
            senderId: this.currentUserId,
            senderName: this.currentUserName,
            senderAvatar: this.currentUserAvatar,
            receiverId: signal.senderId,
            callType: signal.callType,
            roomId: signal.roomId,
            timestamp: Date.now(),
        });
        
        // Auto-reject after 60 seconds
        this.callTimeout = setTimeout(() => {
            console.log('📞 Incoming call timeout');
            this.rejectCall();
        }, 60000);
    }

    /**
     * Show incoming call notification (works even when app is closed via Service Worker)
     */
    private async showIncomingCallNotification(signal: CallSignal) {
        // Show in-app notification banner with accept/decline buttons
        showInAppNotification({
            type: 'call',
            title: `Incoming ${signal.callType} call`,
            body: `${signal.senderName} is calling you`,
            callType: signal.callType,
            callerId: signal.senderId,
            callerName: signal.senderName,
            callerAvatar: signal.senderAvatar,
            icon: signal.senderAvatar,
            onAccept: () => {
                this.acceptCall();
            },
            onDecline: () => {
                this.rejectCall();
            }
        });
        
        // Try to use Service Worker for persistent notification (works when app is closed)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                // Send to service worker to show notification
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: `${signal.callType === 'video' ? '📹' : '📞'} Incoming ${signal.callType} call`,
                    options: {
                        body: `${signal.senderName} is calling you`,
                        tag: 'incoming-call',
                        requireInteraction: true,
                        silent: false,
                        icon: signal.senderAvatar || '/favicon.ico',
                        badge: '/favicon.ico',
                        vibrate: [500, 200, 500, 200, 500, 200, 500],
                        renotify: true,
                        data: {
                            type: 'incoming-call',
                            callType: signal.callType,
                            callerId: signal.senderId,
                            callerName: signal.senderName,
                            callerAvatar: signal.senderAvatar,
                            roomId: signal.roomId,
                        },
                        actions: [
                            { action: 'accept', title: '📞 Accept' },
                            { action: 'reject', title: '❌ Decline' }
                        ]
                    }
                });
                console.log('📞 Sent incoming call notification to Service Worker');
            } catch (err) {
                console.error('Failed to send notification to SW:', err);
            }
        }

        // Also show via Notification API for immediate display
        this.incomingCallNotification = await permissionService.showNotification(
            `${signal.callType === 'video' ? '📹' : '📞'} Incoming ${signal.callType} call`,
            {
                body: `${signal.senderName} is calling you`,
                tag: 'incoming-call',
                requireInteraction: true,
                silent: false,
                icon: signal.senderAvatar,
            }
        );

        if (this.incomingCallNotification) {
            this.incomingCallNotification.onclick = () => {
                window.focus();
                this.incomingCallNotification?.close();
            };
        }
    }

    /**
     * Start an outgoing call
     */
    async startCall(
        receiverId: string,
        receiverName: string,
        receiverAvatar: string,
        callType: 'audio' | 'video'
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`📞 Starting ${callType} call to ${receiverName}`);

            // Check and request permissions
            const permResult = callType === 'video' 
                ? await permissionService.requestVideoCallPermissions()
                : await permissionService.requestAudioCallPermissions();

            if (!permResult.granted) {
                const missingPerms = permResult.missing.map(p => 
                    permissionService.getPermissionDisplayName(p)
                ).join(', ');
                return { 
                    success: false, 
                    error: `Please grant ${missingPerms} permission to make calls` 
                };
            }

            // Get local media stream
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: callType === 'video'
            });

            this.onLocalStream?.(this.localStream);

            // Generate room ID
            this.currentRoomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Update call state
            this.updateCallState({
                isInCall: true,
                isOutgoing: true,
                isIncoming: false,
                isConnected: false,
                isRinging: false,
                callType,
                callerId: this.currentUserId,
                callerName: this.currentUserName,
                callerAvatar: this.currentUserAvatar,
                receiverId,
                receiverName,
                receiverAvatar,
                roomId: this.currentRoomId,
                isMuted: false,
                isVideoEnabled: callType === 'video',
                isSpeakerOn: callType === 'video',
                callStatus: 'requesting',
            });

            // Play ringback tone (what caller hears)
            this.playRingbackTone();

            // Send call request
            await this.sendSignal(receiverId, {
                type: 'call-request',
                payload: null,
                senderId: this.currentUserId,
                senderName: this.currentUserName,
                senderAvatar: this.currentUserAvatar,
                receiverId,
                callType,
                roomId: this.currentRoomId,
                timestamp: Date.now(),
            });

            // Set timeout for unanswered call
            this.callTimeout = setTimeout(() => {
                console.log('📞 Call timeout - no answer');
                this.updateCallState({ callStatus: 'no-answer' });
                this.stopRingtone();
                setTimeout(() => this.endCall(true), 2000);
            }, 60000);

            return { success: true };
        } catch (error: any) {
            console.error('Failed to start call:', error);
            this.resetCallState();
            return { 
                success: false, 
                error: error.message || 'Failed to start call' 
            };
        }
    }

    /**
     * Accept an incoming call
     */
    async acceptCall(): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📞 Accepting call');
            
            this.clearCallTimeout();
            this.stopRingtone();
            this.closeIncomingCallNotification();

            const callType = this.currentCallState.callType;

            // Check and request permissions
            const permResult = callType === 'video' 
                ? await permissionService.requestVideoCallPermissions()
                : await permissionService.requestAudioCallPermissions();

            if (!permResult.granted) {
                const missingPerms = permResult.missing.map(p => 
                    permissionService.getPermissionDisplayName(p)
                ).join(', ');
                this.rejectCall();
                return { 
                    success: false, 
                    error: `Please grant ${missingPerms} permission to accept calls` 
                };
            }

            // Get local media stream
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: callType === 'video'
            });

            this.onLocalStream?.(this.localStream);

            // Update call state
            this.updateCallState({
                isIncoming: false,
                isRinging: false,
                callStatus: 'connecting',
                isMuted: false,
                isVideoEnabled: callType === 'video',
                isSpeakerOn: callType === 'video',
            });

            // Send acceptance signal
            await this.sendSignal(this.currentCallState.callerId, {
                type: 'call-accepted',
                payload: null,
                senderId: this.currentUserId,
                senderName: this.currentUserName,
                senderAvatar: this.currentUserAvatar,
                receiverId: this.currentCallState.callerId,
                callType: this.currentCallState.callType,
                roomId: this.currentRoomId,
                timestamp: Date.now(),
            });

            return { success: true };
        } catch (error: any) {
            console.error('Failed to accept call:', error);
            this.rejectCall();
            return { 
                success: false, 
                error: error.message || 'Failed to accept call' 
            };
        }
    }

    /**
     * Reject an incoming call
     */
    async rejectCall() {
        console.log('📞 Rejecting call');
        
        this.clearCallTimeout();
        this.stopRingtone();
        this.closeIncomingCallNotification();

        if (this.currentCallState.callerId) {
            await this.sendSignal(this.currentCallState.callerId, {
                type: 'call-rejected',
                payload: null,
                senderId: this.currentUserId,
                senderName: this.currentUserName,
                senderAvatar: this.currentUserAvatar,
                receiverId: this.currentCallState.callerId,
                callType: this.currentCallState.callType,
                roomId: this.currentRoomId,
                timestamp: Date.now(),
            });
        }

        this.resetCallState();
    }

    /**
     * End the current call
     */
    async endCall(sendSignal: boolean = true) {
        console.log('📞 Ending call');
        
        this.clearCallTimeout();
        this.stopRingtone();
        this.closeIncomingCallNotification();

        // Determine who to notify
        const otherPartyId = this.currentCallState.isOutgoing 
            ? this.currentCallState.receiverId 
            : this.currentCallState.callerId;

        // Notify other party
        if (sendSignal && otherPartyId) {
            await this.sendSignal(otherPartyId, {
                type: 'call-ended',
                payload: null,
                senderId: this.currentUserId,
                senderName: this.currentUserName,
                senderAvatar: this.currentUserAvatar,
                receiverId: otherPartyId,
                callType: this.currentCallState.callType,
                roomId: this.currentRoomId,
                timestamp: Date.now(),
            });
        }

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Stop remote stream
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.pendingIceCandidates = [];
        
        this.updateCallState({ callStatus: 'ended' });
        setTimeout(() => this.resetCallState(), 1500);
    }

    /**
     * Toggle mute
     */
    toggleMute(): boolean {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const isMuted = !audioTrack.enabled;
                this.updateCallState({ isMuted });
                return isMuted;
            }
        }
        return this.currentCallState.isMuted;
    }

    /**
     * Toggle video
     */
    toggleVideo(): boolean {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const isVideoEnabled = videoTrack.enabled;
                this.updateCallState({ isVideoEnabled });
                return isVideoEnabled;
            }
        }
        return this.currentCallState.isVideoEnabled;
    }

    /**
     * Toggle speaker
     */
    toggleSpeaker(): boolean {
        const isSpeakerOn = !this.currentCallState.isSpeakerOn;
        this.updateCallState({ isSpeakerOn });
        return isSpeakerOn;
    }

    /**
     * Switch camera (front/back)
     */
    async switchCamera(): Promise<boolean> {
        if (!this.localStream) return false;

        try {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (!videoTrack) return false;

            // Get current facing mode
            const settings = videoTrack.getSettings();
            const currentFacingMode = settings.facingMode || 'user';
            const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: false
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            
            // Replace track in peer connection
            if (this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }

            // Replace track in local stream
            this.localStream.removeTrack(videoTrack);
            videoTrack.stop();
            this.localStream.addTrack(newVideoTrack);

            this.onLocalStream?.(this.localStream);
            return true;
        } catch (error) {
            console.error('Failed to switch camera:', error);
            return false;
        }
    }

    /**
     * Create RTCPeerConnection
     */
    private createPeerConnection(otherPartyId: string) {
        this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });
        }

        // Handle incoming stream
        this.peerConnection.ontrack = (event) => {
            console.log('📞 Received remote track:', event.track.kind);
            this.remoteStream = event.streams[0];
            this.onRemoteStream?.(this.remoteStream);
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.log('📞 Sending ICE candidate:', event.candidate.type, event.candidate.protocol);
                await this.sendSignal(otherPartyId, {
                    type: 'ice-candidate',
                    payload: event.candidate.toJSON(),
                    senderId: this.currentUserId,
                    senderName: this.currentUserName,
                    senderAvatar: this.currentUserAvatar,
                    receiverId: otherPartyId,
                    callType: this.currentCallState.callType,
                    roomId: this.currentRoomId,
                    timestamp: Date.now(),
                });
            } else {
                console.log('📞 ICE gathering complete');
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('📞 Connection state:', this.peerConnection?.connectionState);
            
            if (this.peerConnection?.connectionState === 'connected') {
                this.stopRingtone();
                this.updateCallState({
                    isConnected: true,
                    callStatus: 'connected',
                    startTime: new Date(),
                });
            } else if (this.peerConnection?.connectionState === 'failed') {
                console.log('📞 Connection failed, attempting ICE restart...');
                this.attemptIceRestart(otherPartyId);
            } else if (this.peerConnection?.connectionState === 'disconnected') {
                // Wait a bit before giving up - connection might recover
                console.log('📞 Connection disconnected, waiting for recovery...');
                setTimeout(() => {
                    if (this.peerConnection?.connectionState === 'disconnected') {
                        console.log('📞 Connection still disconnected, attempting ICE restart...');
                        this.attemptIceRestart(otherPartyId);
                    }
                }, 3000);
            }
        };

        // Handle ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('📞 ICE state:', this.peerConnection?.iceConnectionState);
            
            if (this.peerConnection?.iceConnectionState === 'failed') {
                console.log('📞 ICE connection failed');
                // ICE restart will be triggered by connection state handler
            }
        };

        // Handle ICE gathering state
        this.peerConnection.onicegatheringstatechange = () => {
            console.log('📞 ICE gathering state:', this.peerConnection?.iceGatheringState);
        };

        return this.peerConnection;
    }

    /**
     * Attempt ICE restart when connection fails
     */
    private iceRestartAttempts = 0;
    private maxIceRestartAttempts = 3;

    private async attemptIceRestart(otherPartyId: string) {
        if (this.iceRestartAttempts >= this.maxIceRestartAttempts) {
            console.log('📞 Max ICE restart attempts reached, ending call');
            this.updateCallState({ callStatus: 'error' });
            this.endCall(true);
            return;
        }

        this.iceRestartAttempts++;
        console.log(`📞 ICE restart attempt ${this.iceRestartAttempts}/${this.maxIceRestartAttempts}`);

        try {
            if (this.peerConnection && this.currentCallState.isOutgoing) {
                const offer = await this.peerConnection.createOffer({ iceRestart: true });
                await this.peerConnection.setLocalDescription(offer);
                
                await this.sendSignal(otherPartyId, {
                    type: 'offer',
                    payload: offer,
                    senderId: this.currentUserId,
                    senderName: this.currentUserName,
                    senderAvatar: this.currentUserAvatar,
                    receiverId: otherPartyId,
                    callType: this.currentCallState.callType,
                    roomId: this.currentRoomId,
                    timestamp: Date.now(),
                });
            }
        } catch (error) {
            console.error('📞 ICE restart failed:', error);
            this.updateCallState({ callStatus: 'error' });
            this.endCall(true);
        }
    }

    /**
     * Create and send offer
     */
    private async createOffer(receiverId: string) {
        try {
            this.iceRestartAttempts = 0; // Reset restart attempts for new call
            this.createPeerConnection(receiverId);
            
            const offer = await this.peerConnection!.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: this.currentCallState.callType === 'video',
            });
            await this.peerConnection!.setLocalDescription(offer);

            await this.sendSignal(receiverId, {
                type: 'offer',
                payload: offer,
                senderId: this.currentUserId,
                senderName: this.currentUserName,
                senderAvatar: this.currentUserAvatar,
                receiverId,
                callType: this.currentCallState.callType,
                roomId: this.currentRoomId,
                timestamp: Date.now(),
            });
        } catch (error) {
            console.error('Failed to create offer:', error);
            this.updateCallState({ callStatus: 'error' });
        }
    }

    /**
     * Handle incoming offer
     */
    private async handleOffer(offer: RTCSessionDescriptionInit, callerId: string) {
        try {
            this.iceRestartAttempts = 0; // Reset restart attempts
            
            // Check if this is an ICE restart (we already have a peer connection)
            if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
                console.log('📞 Received ICE restart offer');
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                await this.sendSignal(callerId, {
                    type: 'answer',
                    payload: answer,
                    senderId: this.currentUserId,
                    senderName: this.currentUserName,
                    senderAvatar: this.currentUserAvatar,
                    receiverId: callerId,
                    callType: this.currentCallState.callType,
                    roomId: this.currentRoomId,
                    timestamp: Date.now(),
                });
                return;
            }
            
            this.createPeerConnection(callerId);
            
            await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Add any pending ICE candidates
            for (const candidate of this.pendingIceCandidates) {
                try {
                    await this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.warn('📞 Failed to add pending ICE candidate:', e);
                }
            }
            this.pendingIceCandidates = [];
            
            const answer = await this.peerConnection!.createAnswer();
            await this.peerConnection!.setLocalDescription(answer);

            await this.sendSignal(callerId, {
                type: 'answer',
                payload: answer,
                senderId: this.currentUserId,
                senderName: this.currentUserName,
                senderAvatar: this.currentUserAvatar,
                receiverId: callerId,
                callType: this.currentCallState.callType,
                roomId: this.currentRoomId,
                timestamp: Date.now(),
            });
        } catch (error) {
            console.error('Failed to handle offer:', error);
            this.updateCallState({ callStatus: 'error' });
        }
    }

    /**
     * Handle incoming answer
     */
    private async handleAnswer(answer: RTCSessionDescriptionInit) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                
                // Add any pending ICE candidates
                for (const candidate of this.pendingIceCandidates) {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
                this.pendingIceCandidates = [];
            }
        } catch (error) {
            console.error('Failed to handle answer:', error);
        }
    }

    /**
     * Handle incoming ICE candidate
     */
    private async handleIceCandidate(candidate: RTCIceCandidateInit) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                // Queue the candidate if remote description not set yet
                this.pendingIceCandidates.push(candidate);
            }
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }

    /**
     * Send signal to a user
     */
    private async sendSignal(receiverId: string, signal: CallSignal) {
        const supabase = getSupabase();
        const channel = supabase.channel(`calls:${receiverId}`);
        
        await new Promise<void>((resolve) => {
            channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    resolve();
                }
            });
        });
        
        await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: signal,
        });
        
        supabase.removeChannel(channel);
    }

    /**
     * Update call state
     */
    private updateCallState(updates: Partial<CallState>) {
        this.currentCallState = { ...this.currentCallState, ...updates };
        this.onCallStateChange?.(this.currentCallState);
    }

    /**
     * Reset call state
     */
    private resetCallState() {
        this.currentCallState = { ...initialCallState };
        this.onCallStateChange?.(this.currentCallState);
    }

    /**
     * Clear call timeout
     */
    private clearCallTimeout() {
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
    }

    /**
     * Close incoming call notification
     */
    private closeIncomingCallNotification() {
        if (this.incomingCallNotification) {
            this.incomingCallNotification.close();
            this.incomingCallNotification = null;
        }
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
    }

    /**
     * Play ringtone (for incoming calls)
     */
    private playRingtone() {
        this.stopRingtone();
        
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.ringtoneGain = this.audioContext.createGain();
            this.ringtoneGain.connect(this.audioContext.destination);
            this.ringtoneGain.gain.value = 0.2;

            const playTone = () => {
                if (!this.audioContext || !this.ringtoneGain) return;
                
                this.ringtoneOscillators = RINGTONE_FREQUENCIES.map(freq => {
                    const osc = this.audioContext!.createOscillator();
                    osc.frequency.value = freq;
                    osc.type = 'sine';
                    osc.connect(this.ringtoneGain!);
                    osc.start();
                    return osc;
                });

                setTimeout(() => {
                    this.ringtoneOscillators.forEach(osc => {
                        try { osc.stop(); } catch {}
                    });
                    this.ringtoneOscillators = [];
                }, 1000);
            };

            playTone();
            this.ringtoneInterval = setInterval(playTone, 2000);
        } catch (error) {
            console.error('Failed to play ringtone:', error);
        }
    }

    /**
     * Play ringback tone (what caller hears)
     */
    private playRingbackTone() {
        this.stopRingtone();
        
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.ringtoneGain = this.audioContext.createGain();
            this.ringtoneGain.connect(this.audioContext.destination);
            this.ringtoneGain.gain.value = 0.1;

            const playTone = () => {
                if (!this.audioContext || !this.ringtoneGain) return;
                
                this.ringtoneOscillators = RINGBACK_FREQUENCIES.map(freq => {
                    const osc = this.audioContext!.createOscillator();
                    osc.frequency.value = freq;
                    osc.type = 'sine';
                    osc.connect(this.ringtoneGain!);
                    osc.start();
                    return osc;
                });

                setTimeout(() => {
                    this.ringtoneOscillators.forEach(osc => {
                        try { osc.stop(); } catch {}
                    });
                    this.ringtoneOscillators = [];
                }, 500);
            };

            playTone();
            this.ringtoneInterval = setInterval(playTone, 4000);
        } catch (error) {
            console.error('Failed to play ringback:', error);
        }
    }

    /**
     * Stop ringtone
     */
    private stopRingtone() {
        if (this.ringtoneInterval) {
            clearInterval(this.ringtoneInterval);
            this.ringtoneInterval = null;
        }
        
        this.ringtoneOscillators.forEach(osc => {
            try { osc.stop(); } catch {}
        });
        this.ringtoneOscillators = [];
        
        if (this.audioContext) {
            try { this.audioContext.close(); } catch {}
            this.audioContext = null;
        }
        
        this.ringtoneGain = null;
    }

    /**
     * Get call duration string
     */
    static formatDuration(startTime: Date | undefined): string {
        if (!startTime) return '00:00';
        
        const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get current call state
     */
    getCallState(): CallState {
        return this.currentCallState;
    }

    /**
     * Cleanup
     */
    destroy() {
        this.endCall(false);
        const supabase = getSupabase();
        if (this.signalChannel) {
            supabase.removeChannel(this.signalChannel);
        }
    }
}

export const callService = new CallService();
export default callService;
