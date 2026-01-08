import React, { useEffect, useState } from 'react';
import { permissionService, PermissionStatus, PermissionType } from '../services/permissionService';

interface PermissionRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
    requestedPermissions?: PermissionType[];
    context?: 'pwa-install' | 'audio-call' | 'video-call' | 'general';
}

const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({
    isOpen,
    onClose,
    onComplete,
    requestedPermissions = ['microphone', 'camera', 'notifications', 'location'] as PermissionType[],
    context = 'general'
}) => {
    const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [requesting, setRequesting] = useState(false);
    const [completed, setCompleted] = useState<PermissionType[]>([]);

    // Ensure we have typed permissions array
    const typedPermissions = requestedPermissions as PermissionType[];

    useEffect(() => {
        if (isOpen) {
            checkPermissions();
            setCurrentStep(0);
            setCompleted([]);
        }
    }, [isOpen]);

    const checkPermissions = async () => {
        const status = await permissionService.checkAllPermissions();
        setPermissions(status);
    };

    const handleRequestPermission = async (type: PermissionType) => {
        setRequesting(true);
        try {
            await permissionService.requestPermission(type);
            await checkPermissions();
            setCompleted(prev => [...prev, type]);
            
            // Move to next step
            const nextIndex = typedPermissions.indexOf(type) + 1;
            if (nextIndex < typedPermissions.length) {
                setCurrentStep(nextIndex);
            } else {
                // All done
                onComplete?.();
            }
        } catch (error) {
            console.error('Permission request error:', error);
        } finally {
            setRequesting(false);
        }
    };

    const handleSkip = () => {
        const type = typedPermissions[currentStep];
        setCompleted(prev => [...prev, type]);
        
        if (currentStep < typedPermissions.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete?.();
        }
    };

    const handleRequestAll = async () => {
        setRequesting(true);
        try {
            for (const type of typedPermissions) {
                await permissionService.requestPermission(type);
            }
            await checkPermissions();
            onComplete?.();
        } catch (error) {
            console.error('Permission request error:', error);
        } finally {
            setRequesting(false);
        }
    };

    const getContextInfo = () => {
        switch (context) {
            case 'pwa-install':
                return {
                    title: 'Welcome to KrishiMitra! 🌾',
                    subtitle: 'To get the best experience, please enable these permissions:',
                    icon: '📱'
                };
            case 'audio-call':
                return {
                    title: 'Allow Microphone Access',
                    subtitle: 'To make voice calls, we need access to your microphone',
                    icon: '🎤'
                };
            case 'video-call':
                return {
                    title: 'Allow Camera & Microphone',
                    subtitle: 'To make video calls, we need access to your camera and microphone',
                    icon: '📹'
                };
            default:
                return {
                    title: 'Enable Permissions',
                    subtitle: 'Allow permissions for the best app experience',
                    icon: '⚙️'
                };
        }
    };

    const getPermissionInfo = (type: PermissionType) => {
        switch (type) {
            case 'microphone':
                return {
                    name: 'Microphone',
                    description: 'For voice messages and audio calls',
                    icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    ),
                    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
                };
            case 'camera':
                return {
                    name: 'Camera',
                    description: 'For video calls and crop diagnosis',
                    icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    ),
                    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30'
                };
            case 'notifications':
                return {
                    name: 'Notifications',
                    description: 'For incoming calls and messages',
                    icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    ),
                    color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30'
                };
            case 'location':
                return {
                    name: 'Location',
                    description: 'For weather and local market prices',
                    icon: (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    ),
                    color: 'text-green-600 bg-green-100 dark:bg-green-900/30'
                };
            default:
                return {
                    name: type,
                    description: '',
                    icon: null,
                    color: 'text-slate-600 bg-slate-100'
                };
        }
    };

    const getPermissionStatus = (type: PermissionType): 'prompt' | 'granted' | 'denied' | 'unsupported' => {
        if (!permissions) return 'prompt';
        return permissions[type] || 'prompt';
    };

    if (!isOpen) return null;

    const contextInfo = getContextInfo();
    const currentPermission = typedPermissions[currentStep];
    const permissionInfo = getPermissionInfo(currentPermission);
    const status = getPermissionStatus(currentPermission);

    // PWA Install Mode - Show all permissions at once
    if (context === 'pwa-install') {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 text-center">
                        <div className="text-6xl mb-3">{contextInfo.icon}</div>
                        <h2 className="text-xl font-bold text-white mb-1">{contextInfo.title}</h2>
                        <p className="text-green-100 text-sm">{contextInfo.subtitle}</p>
                    </div>

                    {/* Permissions List */}
                    <div className="p-4 space-y-3">
                        {typedPermissions.map((type) => {
                            const info = getPermissionInfo(type);
                            const permStatus = getPermissionStatus(type);
                            const isGranted = permStatus === 'granted';
                            const isDenied = permStatus === 'denied';

                            return (
                                <div 
                                    key={type}
                                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                        isGranted 
                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                                            : isDenied
                                                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                                : 'bg-slate-50 dark:bg-slate-700/50 border border-transparent'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg ${info.color}`}>
                                        {info.icon}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">{info.name}</p>
                                        <p className="text-[10px] text-slate-500">{info.description}</p>
                                    </div>
                                    {isGranted ? (
                                        <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            Allowed
                                        </span>
                                    ) : isDenied ? (
                                        <span className="text-red-600 text-xs font-bold">Blocked</span>
                                    ) : (
                                        <span className="text-slate-400 text-xs">Required</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                        <button
                            onClick={handleRequestAll}
                            disabled={requesting}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {requesting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                    Enabling...
                                </>
                            ) : (
                                'Enable All Permissions'
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            disabled={requesting}
                            className="w-full py-2 text-slate-500 font-semibold text-sm hover:text-slate-700 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                        >
                            Skip for Now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Step-by-step mode for calls
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Progress */}
                <div className="flex gap-1 p-3">
                    {typedPermissions.map((_, idx) => (
                        <div 
                            key={idx}
                            className={`h-1 flex-1 rounded-full transition-all ${
                                idx < currentStep 
                                    ? 'bg-green-500' 
                                    : idx === currentStep 
                                        ? 'bg-blue-500' 
                                        : 'bg-slate-200 dark:bg-slate-600'
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    <div className={`inline-flex p-4 rounded-2xl mb-4 ${permissionInfo.color}`}>
                        {permissionInfo.icon}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        {status === 'granted' ? `${permissionInfo.name} Enabled ✓` : `Allow ${permissionInfo.name}`}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {status === 'granted' 
                            ? 'Permission already granted!' 
                            : status === 'denied'
                                ? 'Permission was blocked. Please enable in your browser settings.'
                                : permissionInfo.description
                        }
                    </p>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                    {status === 'granted' ? (
                        <button
                            onClick={handleSkip}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors"
                        >
                            Continue
                        </button>
                    ) : status === 'denied' ? (
                        <>
                            <button
                                onClick={handleSkip}
                                className="w-full py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-xl transition-colors"
                            >
                                Continue Anyway
                            </button>
                            <p className="text-xs text-center text-slate-400">
                                Some features may not work without this permission
                            </p>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => handleRequestPermission(currentPermission)}
                                disabled={requesting}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {requesting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                        </svg>
                                        Requesting...
                                    </>
                                ) : (
                                    `Allow ${permissionInfo.name}`
                                )}
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={requesting}
                                className="w-full py-2 text-slate-500 font-semibold text-sm hover:text-slate-700 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                            >
                                Skip
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PermissionRequestModal;
