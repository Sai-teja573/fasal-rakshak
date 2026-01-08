
import React, { useState, useEffect } from 'react';
import { User, AppView, Language, DiagnosisResponse, SoilAnalysisResponse, ChatInitialContext } from './types';
import { checkLoginRateLimit, getSessionUser, logout } from './services/authService';
import { getPlanDetails, incrementUserUsage } from './services/cmsService';
import { getUserDiagnoses } from './services/agroService';
import { fetchSecrets } from './services/secretManager';
import { syncDownData } from './services/offlineQueueService';

// Screens & Components
import { Navigation } from './components/Navigation';
import { LandingPage } from './components/LandingPage';
import { AgroHubScreen } from './components/AgroHubScreen';
import { LoginScreen } from './components/LoginScreen';
import { DiagnosisScreen } from './components/DiagnosisScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { ChatScreen } from './components/ChatScreen';
import { CropPlannerScreen } from './components/CropPlannerScreen';
import { MarketIntelligenceScreen } from './components/MarketIntelligenceScreen';
import { SoilResultsScreen } from './components/SoilResultsScreen';
import { OnboardingWizard } from './components/OnboardingWizard';
import { DriverAuth } from './components/DriverAuth';
import { DriverDashboard } from './components/DriverDashboard';
import { TransportRequestScreen } from './components/TransportRequestScreen';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/ui/LoadingScreen';

// Reset idle timer function
const IDLE_TIMEOUT = 1000 * 60 * 30; // 30 mins
let idleTimer: any;

export const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setView] = useState<AppView>(AppView.LANDING);
  const [appLanguage, setAppLanguage] = useState<Language>('en');
  const [history, setHistory] = useState<(DiagnosisResponse | SoilAnalysisResponse)[]>([]);
  const [currentResult, setCurrentResult] = useState<DiagnosisResponse | null>(null);
  const [currentSoilResult, setCurrentSoilResult] = useState<SoilAnalysisResponse | null>(null);
  const [triggerCamera, setTriggerCamera] = useState(0);
  const [targetPlanId, setTargetPlanId] = useState<string | null>(null);
  const [diagnosisMode, setDiagnosisMode] = useState<'crop' | 'soil'>('crop');
  const [chatInitialContext, setChatInitialContext] = useState<ChatInitialContext | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);

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
    
    // Initial Load Sequence
    const init = async () => {
        // 1. Fetch Keys
        await fetchSecrets();
        
        // 2. Check Session
        const u = await getSessionUser();
        if (u) {
            handleUserAuth(u);
            // 3. Sync Data if logged in (Low bandwidth safe)
            syncDownData();
        }
        setIsAppLoading(false);
    };
    init();

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
      await logout();
      setUser(null);
      setView(AppView.LANDING);
  };

  const renderView = () => {
    switch (currentView) {
        case AppView.LANDING: 
            return <LandingPage onStart={() => setView(user ? AppView.MARKET : AppView.LOGIN)} onLogin={() => setView(AppView.LOGIN)} user={user} onUserUpdate={setUser} onAgroHubClick={() => setView(user ? AppView.MARKET : AppView.LOGIN)} onScan={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }} setView={setView} />;
        
        case AppView.LOGIN: 
            return <LoginScreen onLogin={handleUserAuth} onCancel={() => setView(AppView.LANDING)} />;
            
        case AppView.ONBOARDING:
            return user ? <OnboardingWizard user={user} onComplete={(u) => { setUser(u); setView(AppView.MARKET); }} /> : <LandingPage onStart={() => {}} onLogin={() => {}} setView={setView} />;

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
                onNavigateToChat={() => setView(AppView.CHAT)}
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
            ) : <LoginScreen onLogin={handleUserAuth} onCancel={() => setView(AppView.LANDING)} />;

        default: 
            return <LandingPage onStart={() => setView(AppView.MARKET)} onLogin={() => setView(AppView.LOGIN)} setView={setView} />;
    }
  };

  if (isAppLoading) return <LoadingScreen text="Initializing Fasal Rakshak..." />;

  return (
    <ErrorBoundary>
        <div className="h-full w-full flex flex-col font-sans text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950">
            {currentView !== AppView.LANDING && currentView !== AppView.LOGIN && currentView !== AppView.ADMIN && currentView !== AppView.DRIVER_AUTH && currentView !== AppView.DRIVER_DASHBOARD && (
                <div className="hidden md:block sticky top-0 z-50">
                    <Navigation 
                        currentView={currentView} 
                        setView={setView} 
                        user={user} 
                        onLogout={handleLogout} 
                        onScanClick={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }}
                        lang={appLanguage}
                        onLanguageChange={setAppLanguage}
                    />
                </div>
            )}
            
            <div className="flex-1 overflow-hidden relative">
                {renderView()}
            </div>

            {/* Mobile Bottom Nav */}
            {currentView !== AppView.LANDING && currentView !== AppView.LOGIN && currentView !== AppView.ADMIN && currentView !== AppView.DRIVER_AUTH && currentView !== AppView.DRIVER_DASHBOARD && (
                <div className="md:hidden sticky bottom-0 z-50">
                    <Navigation 
                        currentView={currentView} 
                        setView={setView} 
                        user={user} 
                        onLogout={handleLogout}
                        onScanClick={() => { setView(AppView.DIAGNOSIS); setTriggerCamera(Date.now()); }}
                        lang={appLanguage}
                        onLanguageChange={setAppLanguage}
                    />
                </div>
            )}
            
            <PwaInstallPrompt />
        </div>
    </ErrorBoundary>
  );
};
