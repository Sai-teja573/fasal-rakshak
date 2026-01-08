/**
 * Page Transition Component
 * Provides iOS/Android-like smooth transitions between screens
 * Includes swipe-back gesture support for PWA navigation
 */

import { AnimatePresence, motion, PanInfo, useAnimation } from 'framer-motion';
import React, { useCallback, useRef, useState } from 'react';

interface PageTransitionProps {
    children: React.ReactNode;
    viewKey: string;
    direction?: 'forward' | 'back';
    onSwipeBack?: () => void;
    enableSwipeBack?: boolean;
}

// iOS-like spring configuration
const springConfig = {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 0.8,
};

// Slide variants for page transitions
const slideVariants = {
    enter: (direction: 'forward' | 'back') => ({
        x: direction === 'forward' ? '100%' : '-30%',
        opacity: direction === 'forward' ? 1 : 0.5,
        scale: direction === 'forward' ? 1 : 0.95,
    }),
    center: {
        x: 0,
        opacity: 1,
        scale: 1,
    },
    exit: (direction: 'forward' | 'back') => ({
        x: direction === 'forward' ? '-30%' : '100%',
        opacity: direction === 'forward' ? 0.5 : 1,
        scale: direction === 'forward' ? 0.95 : 1,
    }),
};

// Fade variants for simple transitions
const fadeVariants = {
    enter: {
        opacity: 0,
        scale: 0.98,
    },
    center: {
        opacity: 1,
        scale: 1,
    },
    exit: {
        opacity: 0,
        scale: 0.98,
    },
};

export const PageTransition: React.FC<PageTransitionProps> = ({
    children,
    viewKey,
    direction = 'forward',
    onSwipeBack,
    enableSwipeBack = true,
}) => {
    const controls = useAnimation();
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle drag gesture for swipe-back
    const handleDragEnd = useCallback(
        (_: any, info: PanInfo) => {
            setIsDragging(false);
            
            // If swiped more than 100px or with enough velocity, trigger back
            if (info.offset.x > 100 || info.velocity.x > 500) {
                controls.start({ x: '100%', opacity: 0.5 }).then(() => {
                    onSwipeBack?.();
                });
            } else {
                // Snap back
                controls.start({ x: 0, opacity: 1 });
            }
        },
        [controls, onSwipeBack]
    );

    const handleDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    // Detect iOS for enhanced glass effects
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    return (
        <AnimatePresence mode="wait" custom={direction}>
            <motion.div
                key={viewKey}
                ref={containerRef}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate={controls}
                exit="exit"
                transition={springConfig}
                drag={enableSwipeBack && onSwipeBack ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0, right: 0.5 }}
                dragDirectionLock
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                className={`
                    absolute inset-0 overflow-hidden
                    ${isIOS ? 'ios-glass-container' : ''}
                    ${isDragging ? 'cursor-grabbing' : ''}
                `}
                style={{
                    touchAction: enableSwipeBack ? 'pan-y' : 'auto',
                }}
            >
                {/* Shadow overlay during drag */}
                {isDragging && (
                    <motion.div
                        className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/10 to-transparent pointer-events-none z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    />
                )}
                {children}
            </motion.div>
        </AnimatePresence>
    );
};

/**
 * Simple fade transition for modals and overlays
 */
export const FadeTransition: React.FC<{ children: React.ReactNode; show: boolean }> = ({
    children,
    show,
}) => {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    variants={fadeVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

/**
 * iOS Glass Effect Container
 * Provides frosted glass effect for Apple devices
 */
export const GlassContainer: React.FC<{
    children: React.ReactNode;
    className?: string;
    intensity?: 'light' | 'medium' | 'heavy';
}> = ({ children, className = '', intensity = 'medium' }) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    const blurValues = {
        light: 'backdrop-blur-sm',
        medium: 'backdrop-blur-md',
        heavy: 'backdrop-blur-xl',
    };

    const bgValues = {
        light: 'bg-white/60 dark:bg-slate-900/60',
        medium: 'bg-white/70 dark:bg-slate-900/70',
        heavy: 'bg-white/80 dark:bg-slate-900/80',
    };

    return (
        <div
            className={`
                ${blurValues[intensity]}
                ${bgValues[intensity]}
                ${isIOS || isSafari ? 'ios-glass' : ''}
                border border-white/20 dark:border-slate-700/30
                shadow-lg
                ${className}
            `}
            style={{
                // Enhanced glass effect for iOS/Safari
                ...(isIOS || isSafari ? {
                    WebkitBackdropFilter: intensity === 'heavy' ? 'saturate(180%) blur(20px)' : 
                                          intensity === 'medium' ? 'saturate(150%) blur(12px)' : 
                                          'saturate(120%) blur(8px)',
                } : {}),
            }}
        >
            {children}
        </div>
    );
};

/**
 * Navigation History Manager for PWA
 * Manages view history stack for back navigation
 */
export class NavigationHistory {
    private static instance: NavigationHistory;
    private history: string[] = [];
    private maxSize = 20;

    private constructor() {
        // Initialize with current view from URL if available
        const currentPath = window.location.pathname;
        if (currentPath && currentPath !== '/') {
            this.history.push(currentPath);
        }
    }

    static getInstance(): NavigationHistory {
        if (!NavigationHistory.instance) {
            NavigationHistory.instance = new NavigationHistory();
        }
        return NavigationHistory.instance;
    }

    push(view: string): void {
        // Don't push duplicate consecutive views
        if (this.history[this.history.length - 1] === view) return;
        
        this.history.push(view);
        
        // Limit history size
        if (this.history.length > this.maxSize) {
            this.history.shift();
        }
    }

    pop(): string | undefined {
        return this.history.pop();
    }

    peek(): string | undefined {
        return this.history[this.history.length - 1];
    }

    getPrevious(): string | undefined {
        return this.history[this.history.length - 2];
    }

    canGoBack(): boolean {
        return this.history.length > 1;
    }

    clear(): void {
        this.history = [];
    }

    getHistory(): string[] {
        return [...this.history];
    }
}

/**
 * Hook for managing navigation with history
 */
export const useNavigationHistory = () => {
    const nav = NavigationHistory.getInstance();
    
    const pushView = useCallback((view: string) => {
        nav.push(view);
    }, []);

    const goBack = useCallback((): string | undefined => {
        nav.pop(); // Remove current
        return nav.peek(); // Return previous
    }, []);

    const canGoBack = useCallback(() => nav.canGoBack(), []);

    return { pushView, goBack, canGoBack };
};

// CSS to be injected for iOS glass effects
export const injectGlassStyles = () => {
    if (typeof document === 'undefined') return;
    
    const styleId = 'ios-glass-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .ios-glass {
            -webkit-backdrop-filter: saturate(180%) blur(20px);
            backdrop-filter: saturate(180%) blur(20px);
        }
        
        .ios-glass-container {
            transform-style: preserve-3d;
            -webkit-transform-style: preserve-3d;
        }
        
        /* Safe area padding for iOS */
        @supports (padding: max(0px)) {
            .safe-area-top {
                padding-top: max(env(safe-area-inset-top), 0px);
            }
            .safe-area-bottom {
                padding-bottom: max(env(safe-area-inset-bottom), 0px);
            }
            .safe-area-left {
                padding-left: max(env(safe-area-inset-left), 0px);
            }
            .safe-area-right {
                padding-right: max(env(safe-area-inset-right), 0px);
            }
        }
        
        /* Smooth scrolling for iOS */
        .ios-scroll {
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
        }
        
        /* Haptic feedback simulation */
        @media (pointer: coarse) {
            .haptic-tap:active {
                transform: scale(0.97);
                transition: transform 0.1s ease;
            }
        }
    `;
    document.head.appendChild(style);
};
