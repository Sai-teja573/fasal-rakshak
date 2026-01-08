import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { getUserDiagnoses } from './services/agroService';
import { getSessionUser, logout } from './services/authService';
import {
    AppNotification,
    isPushSupported,
    requestNotificationPermission,
    startMessageListener,
    stopMessageListener,
    subscribeToPush
} from './services/notificationService';
import { AppView, ChatInitialContext, DiagnosisResponse, Language, SoilAnalysisResponse, User } from './types';

// Lazy load heavy components for faster initial load
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));

// Screens & Components
import { AdminDashboard } from './components/AdminDashboard';
import { AgroHubScreen } from './components/AgroHubScreen';
import { ChatScreen } from './components/ChatScreen';
import { CropPlannerScreen } from './components/CropPlannerScreen';
import { DiagnosisScreen } from './components/DiagnosisScreen';
import { DriverAuth } from './components/DriverAuth';
import { DriverDashboard } from './components/DriverDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HistoryScreen } from './components/HistoryScreen';
import { LoginScreen } from './components/LoginScreen';
import { MarketIntelligenceScreen } from './components/MarketIntelligenceScreen';
import { Navigation } from './components/Navigation';
import { OnboardingWizard } from './components/OnboardingWizard';
import PermissionRequestModal from './components/PermissionRequestModal';
import { ProfileScreen } from './components/ProfileScreen';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { ResultsScreen } from './components/ResultsScreen';
import { SoilResultsScreen } from './components/SoilResultsScreen';
import { TransportRequestScreen } from './components/TransportRequestScreen';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { NotificationBanner } from './components/ui/NotificationBanner';
import { NotificationPermissionPrompt } from './components/ui/NotificationPermissionPrompt';
import { GlassContainer, injectGlassStyles } from './components/ui/PageTransition';

// Smooth crossfade page transitions - no gaps
const pageVariants = {
    initial: {
        opacity: 0,
    },
    animate: {
        opacity: 1,
    },
    exit: {
        opacity: 0,
    },
};

// Quick, smooth tween transition
const pageTransition = {
    type: 'tween',
    duration: 0.2,
    ease: 'easeInOut',
};

// Reset idle timer function
const IDLE_TIMEOUT = 1000 * 60 * 30; // 30 mins
let idleTimer: any;

// View hierarchy for determining navigation direction
const VIEW_ORDER: AppView[] = [
    AppView.LANDING,
    AppView.LOGIN,
    AppView.ONBOARDING,
    AppView.MARKET,
    AppView.DIAGNOSIS,
    AppView.RESULTS,
    AppView.SOIL_RESULTS,
    AppView.HISTORY,
    AppView.PROFILE,
    AppView.CHAT,
    AppView.CROP_PLANNER,
    AppView.MARKET_INTELLIGENCE,
    AppView.TRANSPORT_REQUEST,
];

// Check if device is iOS for glass effects
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Check if running as installed PWA
const isPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
};

// Determine initial view - skip landing in PWA mode
const getInitialView = (): AppView => {
  if (isPWA()) {
    // In PWA mode, go directly to login or app
    return AppView.LOGIN;
  }
  return AppView.LANDING;
};

export const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(getInitialView());
  const [previousView, setPreviousView] = useState<AppView | null>(null);
  const [navigationDirection, setNavigationDirection] = useState<number>(1); // 1 = forward, -1 = back
  const [viewHistory, setViewHistory] = useState<AppView[]>([getInitialView()]);
  const [appLanguage, setAppLanguage] = useState<Language>('en');
  const [history, setHistory] = useState<(DiagnosisResponse | SoilAnalysisResponse)[]>([]);
  const [currentResult, setCurrentResult] = useState<DiagnosisResponse | null>(null);
  const [currentSoilResult, setCurrentSoilResult] = useState<SoilAnalysisResponse | null>(null);
  const [triggerCamera, setTriggerCamera] = useState(0);
  const [targetPlanId, setTargetPlanId] = useState<string | null>(null);
  const [diagnosisMode, setDiagnosisMode] = useState<'crop' | 'soil'>('crop');
  const [chatInitialContext, setChatInitialContext] = useState<ChatInitialContext | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [pendingChatRoom, setPendingChatRoom] = useState<string | null>(null);
  const [showPwaPermissionModal, setShowPwaPermissionModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);

  // Inject iOS glass styles on mount
  useEffect(() => {
    injectGlassStyles();
  }, []);

  // Custom setView with navigation history tracking
  const setView = useCallback((newView: AppView, isBackNavigation = false) => {
    setPreviousView(currentView);
    
    if (isBackNavigation) {
      setNavigationDirection(-1);
      setViewHistory(prev => prev.slice(0, -1));
    } else {
      // Determine direction based on view hierarchy
      const currentIndex = VIEW_ORDER.indexOf(currentView);
      const newIndex = VIEW_ORDER.indexOf(newView);
      setNavigationDirection(newIndex >= currentIndex ? 1 : -1);
      setViewHistory(prev => [...prev.slice(-19), newView]); // Keep last 20 views
    }
    
    setCurrentView(newView);
  }, [currentView]);

  // Navigate back using history
  const goBack = useCallback(() => {
    if (viewHistory.length > 1) {
      const prevView = viewHistory[viewHistory.length - 2];
      setView(prevView, true);
      return true;
    }
    return false;
  }, [viewHistory, setView]);

  // Handle browser/device back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      if (!goBack()) {
        // If can't go back in app, stay on current view
        window.history.pushState({ view: currentView }, '');
      }
    };

    // Push initial state
    window.history.pushState({ view: currentView }, '');
    window.addEventListener('popstate', handlePopState);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBack, currentView]);

  // Handle edge swipe for back gesture (iOS-like)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    // Only trigger if starting from left edge (within 20px)
    if (touch.clientX < 20) {
      dragStartX.current = touch.clientX;
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartX.current;
    
    // If swiped more than 100px from edge, prepare for back
    if (deltaX > 100) {
      // Visual feedback could be added here
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - dragStartX.current;
    
    setIsDragging(false);
    
    // If swiped more than 100px, trigger back navigation
    if (deltaX > 100 && viewHistory.length > 1) {
      goBack();
    }
  }, [isDragging, viewHistory, goBack]);

  // Add swipe gesture listeners
  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Check if this is a fresh PWA install
  useEffect(() => {
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true;
    const hasShownPermissions = localStorage.getItem('pwa_permissions_shown');
    
    if (isPwa && !hasShownPermissions && user) {
      // Show permission modal after a short delay
      const timer = setTimeout(() => {
        setShowPwaPermissionModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handlePwaPermissionComplete = () => {
    localStorage.setItem('pwa_permissions_shown', 'true');
    setShowPwaPermissionModal(false);
  };

  // Handle notification click - navigate to chat
  const handleNotificationClick = (notification: AppNotification) => {
    if (notification.type === 'message' && notification.data?.roomId) {
      setPendingChatRoom(notification.data.roomId);
      setView(AppView.CHAT);
    }
  };

  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (user) {
            handleLogout();
            alert("Session expired due to inactivity.");
        }
    }, IDLE_TIMEOUT);
  };

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    
    // Check session on load
    getSessionUser().then(u => {
        if (u) {
            handleUserAuth(u);
            // If user is logged in and in PWA mode, go directly to app
            if (isPWA()) {
              setCurrentView(AppView.MARKET);
            }
        }
        setIsAppLoading(false);
    });

    return () => {
        window.removeEventListener('mousemove', resetIdleTimer);
        window.removeEventListener('keypress', resetIdleTimer);
        window.removeEventListener('click', resetIdleTimer);
        window.removeEventListener('touchstart', resetIdleTimer);
    };
  }, []);

  const handleUserAuth = async (u: User) => {
      setUser(u);
      resetIdleTimer();
      if (u.preferred_languages?.length) setAppLanguage(u.preferred_languages[0]);
      
      // Request notification permission explicitly
      console.log('[App] Requesting notification permission...');
      const hasPermission = await requestNotificationPermission();
      console.log('[App] Notification permission:', hasPermission);
      
      // Setup push notifications if supported and permitted
      if (isPushSupported() && hasPermission) {
          await subscribeToPush(u.id);
      }
      
      // Start listening for new messages (always, regardless of push support)
      startMessageListener(u.id, (msg) => {
          console.log('[App] New message received:', msg);
      });
      
      if (u.role === 'admin') { 
          setView(AppView.ADMIN); 
          return; 
      }
      if (u.role === 'agent') {
          setView(AppView.AGENT_DASHBOARD);
          return;
      }
      if (u.role === 'driver') {
          setView(AppView.DRIVER_DASHBOARD);
          return;
      }

      getUserDiagnoses(u.id, 20).then(dbHistory => { if (dbHistory) setHistory(dbHistory); }).catch(() => {});
      
      const hasOnboarded = u.crops_grown && u.crops_grown.length > 0;
      if (!hasOnboarded) setView(AppView.ONBOARDING);
      else if (currentView === AppView.LANDING || currentView === AppView.LOGIN || currentView === AppView.DRIVER_AUTH) setView(AppView.MARKET);
  };

  const handleLogout = async () => {
      stopMessageListener();
      await logout();
      setUser(null);
      // In PWA mode, go to login instead of landing
      setView(isPWA() ? AppView.LOGIN : AppView.LANDING);
  };

  // Loading fallback for lazy components
  const LazyFallback = () => (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );

  const renderView = () => {
    switch (currentView) {
        case AppView.LANDING: 
            return (
              <Suspense fallback={<LazyFallback />}>
                <LandingPage onStart={() => setView(user ? AppView.MARKET : AppView.LOGIN)} onLogin={() => setView(AppView.LOGIN)} user={user} onUserUpdate={setUser} onAgroHubClick={() => setView(user ? AppView.MARKET : AppView.LOGIN)} onScan={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }} setView={setView} />
              </Suspense>
            );
        
        case AppView.LOGIN: 
            return <LoginScreen onLogin={handleUserAuth} onCancel={() => setView(isPWA() ? AppView.LOGIN : AppView.LANDING)} />;
            
        case AppView.ONBOARDING:
            return user ? <OnboardingWizard user={user} onComplete={(u) => { setUser(u); setView(AppView.MARKET); }} /> : (
              <Suspense fallback={<LazyFallback />}>
                <LandingPage onStart={() => {}} onLogin={() => {}} setView={setView} />
              </Suspense>
            );

        case AppView.MARKET: 
            return <AgroHubScreen 
                user={user} 
                lang={appLanguage} 
                onUserUpdate={setUser} 
                onLoginRequest={() => setView(AppView.LOGIN)} 
                onNavigateToDiagnosis={() => { setDiagnosisMode('crop'); setView(AppView.DIAGNOSIS); }} 
                onNavigateToHistory={() => setView(AppView.HISTORY)}
                onNavigateToCropPlanner={(planId) => { 
                    setTargetPlanId(planId || null); 
                    setView(AppView.CROP_PLANNER); 
                }}
                onNavigateToSoilLab={() => { setDiagnosisMode('soil'); setView(AppView.DIAGNOSIS); }}
                onNavigateToChat={(openAiChat?: boolean) => {
                    // Clear any previous context first, then set new one if needed
                    if (openAiChat) {
                        setChatInitialContext({ openAiChat: true });
                    } else {
                        setChatInitialContext(null); // Clear context to show all conversations
                    }
                    setView(AppView.CHAT);
                }}
                onNavigateToTransport={() => setView(AppView.TRANSPORT_REQUEST)}
                onOpenReport={(report) => {
                    if ('soilType' in report) {
                        setCurrentSoilResult(report as SoilAnalysisResponse);
                        setView(AppView.SOIL_RESULTS);
                    } else {
                        setCurrentResult(report as DiagnosisResponse);
                        setView(AppView.RESULTS);
                    }
                }}
            />;

        case AppView.MARKET_INTELLIGENCE:
            return <MarketIntelligenceScreen user={user} lang={appLanguage} />;

        case AppView.DIAGNOSIS: 
            return <DiagnosisScreen 
                onResult={(res) => { setCurrentResult(res); setView(AppView.RESULTS); }} 
                onSoilResult={(res) => { setCurrentSoilResult(res); setView(AppView.SOIL_RESULTS); }}
                autoTrigger={triggerCamera}
                lang={appLanguage}
                user={user}
                onUserUpdate={setUser}
                onNavigateToPricing={() => setView(AppView.PROFILE)} // Using Profile as placeholder for plans
                initialMode={diagnosisMode}
            />;

        case AppView.RESULTS: 
            return currentResult ? <ResultsScreen data={currentResult} onBack={() => setView(AppView.MARKET)} onUpdateData={setCurrentResult} user={user} lang={appLanguage} onFollowUp={() => { setDiagnosisMode('crop'); setView(AppView.DIAGNOSIS); }} /> : <AgroHubScreen user={user} lang={appLanguage} />;

        case AppView.SOIL_RESULTS:
            return currentSoilResult ? <SoilResultsScreen data={currentSoilResult} onBack={() => setView(AppView.MARKET)} /> : <AgroHubScreen user={user} lang={appLanguage} />;

        case AppView.HISTORY: 
            return <HistoryScreen history={history} onSelect={(item) => { setCurrentResult(item); setView(AppView.RESULTS); }} lang={appLanguage} onFollowUp={(item) => { setCurrentResult(item); setView(AppView.DIAGNOSIS); }} />;

        case AppView.PROFILE: 
            return <ProfileScreen user={user} onLogout={handleLogout} lang={appLanguage} onUserUpdate={setUser} onNavigateToAgroHub={() => setView(AppView.MARKET)} onLanguageChange={setAppLanguage} onViewHistory={() => setView(AppView.HISTORY)} />;

        case AppView.ADMIN: 
            return <AdminDashboard user={user} onLogout={handleLogout} />;

        case AppView.CHAT:
            return user ? (
                <ChatScreen 
                    user={user} 
                    onBack={() => { setChatInitialContext(null); setView(AppView.MARKET); }} 
                    initialContext={chatInitialContext}
                />
            ) : <LoginScreen onLogin={handleUserAuth} onCancel={() => setView(AppView.LANDING)} />;

        case AppView.CROP_PLANNER:
            return <CropPlannerScreen user={user} lang={appLanguage} onBack={() => setView(AppView.MARKET)} onScan={() => setView(AppView.DIAGNOSIS)} targetPlanId={targetPlanId} />;

        case AppView.DRIVER_AUTH: 
            return <DriverAuth onLogin={handleUserAuth} onBack={() => setView(AppView.LANDING)} />;
        
        case AppView.DRIVER_DASHBOARD: 
            return user ? <DriverDashboard user={user} onLogout={handleLogout} /> : <DriverAuth onLogin={handleUserAuth} onBack={() => setView(AppView.LANDING)} />;
        
        case AppView.TRANSPORT_REQUEST: 
            return user ? (
                <TransportRequestScreen 
                    user={user} 
                    onBack={() => setView(AppView.MARKET)}
                    onNavigateToChat={(targetUser, message) => {
                        setChatInitialContext({ targetUser, message });
                        setView(AppView.CHAT);
                    }}
                />
            ) : <LoginScreen onLogin={handleUserAuth} onCancel={() => setView(isPWA() ? AppView.LOGIN : AppView.LANDING)} />;

        default: 
            return (
              <Suspense fallback={<LazyFallback />}>
                <LandingPage onStart={() => setView(AppView.MARKET)} onLogin={() => setView(AppView.LOGIN)} setView={setView} />
              </Suspense>
            );
    }
  };

  if (isAppLoading) return <LoadingScreen text="Initializing Fasal Rakshak..." />;

  // Check for iOS glass effect support
  const useGlassEffect = isIOS() || isSafari();

  return (
    <ErrorBoundary>
        <div className={`h-full w-full flex flex-col font-sans text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 ${useGlassEffect ? 'ios-app' : ''}`}>
            {/* Notification Banner - Always visible */}
            <NotificationBanner onNotificationClick={handleNotificationClick} />
            
            {currentView !== AppView.LANDING && currentView !== AppView.LOGIN && currentView !== AppView.ADMIN && currentView !== AppView.DRIVER_AUTH && currentView !== AppView.DRIVER_DASHBOARD && (
                <div className="hidden md:block sticky top-0 z-50">
                    {useGlassEffect ? (
                        <GlassContainer intensity="medium" className="safe-area-top">
                            <Navigation 
                                currentView={currentView} 
                                setView={setView} 
                                user={user} 
                                onLogout={handleLogout} 
                                onScanClick={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }}
                                lang={appLanguage}
                                onLanguageChange={setAppLanguage}
                            />
                        </GlassContainer>
                    ) : (
                        <Navigation 
                            currentView={currentView} 
                            setView={setView} 
                            user={user} 
                            onLogout={handleLogout} 
                            onScanClick={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }}
                            lang={appLanguage}
                            onLanguageChange={setAppLanguage}
                        />
                    )}
                </div>
            )}
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                {/* Swipe back indicator */}
                {isDragging && viewHistory.length > 1 && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-50 w-8 h-24 flex items-center justify-center"
                    >
                        <div className="w-1 h-16 bg-gradient-to-b from-transparent via-green-500 to-transparent rounded-full" />
                    </motion.div>
                )}
                
                {/* Animated Page Transitions - Smooth Crossfade */}
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={currentView}
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                        className="absolute inset-0 overflow-y-auto overflow-x-hidden ios-scroll bg-inherit"
                        style={{ 
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
                        {renderView()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Mobile Bottom Nav - Hide when in chat */}
            {currentView !== AppView.LANDING && currentView !== AppView.LOGIN && currentView !== AppView.ADMIN && currentView !== AppView.DRIVER_AUTH && currentView !== AppView.DRIVER_DASHBOARD && currentView !== AppView.CHAT && (
                <div className="md:hidden sticky bottom-0 z-50">
                    {useGlassEffect ? (
                        <GlassContainer intensity="heavy" className="safe-area-bottom">
                            <Navigation 
                                currentView={currentView} 
                                setView={setView} 
                                user={user} 
                                onLogout={handleLogout} 
                                onScanClick={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }}
                                lang={appLanguage}
                                onLanguageChange={setAppLanguage}
                            />
                        </GlassContainer>
                    ) : (
                        <Navigation 
                            currentView={currentView} 
                            setView={setView} 
                            user={user} 
                            onLogout={handleLogout} 
                            onScanClick={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }}
                            lang={appLanguage}
                            onLanguageChange={setAppLanguage}
                        />
                    )}
                </div>
            )}
            
            <PwaInstallPrompt />
            
            {/* Notification Permission Prompt - only show for logged in users */}
            {user && (
                <NotificationPermissionPrompt 
                    userId={user.id} 
                    onPermissionGranted={() => {
                        console.log('[App] Notification permission granted!');
                        subscribeToPush(user.id);
                    }}
                />
            )}
            
            {/* PWA Permission Request Modal */}
            <PermissionRequestModal
                isOpen={showPwaPermissionModal}
                onClose={() => handlePwaPermissionComplete()}
                onComplete={handlePwaPermissionComplete}
                context="pwa-install"
                requestedPermissions={['microphone', 'camera', 'notifications', 'location']}
            />
        </div>
    </ErrorBoundary>
  );
};