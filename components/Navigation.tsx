
import React, { useState, useRef, useEffect } from 'react';
import { AppView, User, Language } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { t, UI_LANGUAGES } from '../services/translationService';
import { Button, Badge } from './ui/Shadcn';
import { getCMSContent } from '../services/cmsService';

interface NavigationProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  user: User | null;
  className?: string;
  onLogout: () => void;
  onScanClick?: () => void;
  lang: Language;
  onLanguageChange?: (lang: Language) => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
}

// Icons
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
);

const SproutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.2.4-4.8-.4-1.2-.6-2.1-1.9-2-3.3a2.94 2.94 0 0 1 .8-2c1.3-1.2 3.2-1.2 4.7 0"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z"/></svg>
);

const MarketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);

const HubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
);

const ProfileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
);

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView, user, className, onLogout, onScanClick, lang, onLanguageChange, notificationCount = 0, onNotificationClick }) => {
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const content = getCMSContent();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
            setShowLangMenu(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getButtonClass = (view: AppView) => {
    const isActive = currentView === view || (view === AppView.DIAGNOSIS && currentView === AppView.RESULTS);
    return `flex flex-col md:flex-row items-center justify-center md:gap-2 px-2 md:px-4 py-2 rounded-lg transition-all duration-200 group ${
      isActive
        ? 'text-green-600 dark:text-green-400 md:text-slate-900 md:dark:text-white md:bg-slate-100 md:dark:bg-slate-800' 
        : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 md:hover:bg-slate-50 md:dark:hover:bg-slate-800/50'
    }`;
  };

  const handleScanPress = () => {
      if (onScanClick) onScanClick();
      else setView(AppView.DIAGNOSIS);
  };

  const navLogo = content.logos?.navbar || content.logos?.main;

  // Agent check
  const isAgent = user?.role === 'agent';

  return (
    <nav className={`
      fixed bottom-0 left-0 right-0 z-50 w-full 
      md:relative md:top-0 md:bottom-auto
      bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl 
      border-t border-slate-200 dark:border-slate-800 md:border-t-0 md:border-b
      shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-sm
      transition-all duration-300 pb-safe
      ${className}
    `}>
      <div className="h-16 md:h-full max-w-7xl mx-auto flex items-center justify-between px-2 md:px-6 relative">
        
        {/* Desktop Logo */}
        <div className="hidden md:flex items-center gap-2 cursor-pointer mr-8" onClick={() => setView(user ? (isAgent ? AppView.AGENT_DASHBOARD : AppView.MARKET) : AppView.LANDING)}>
           {navLogo ? (
               <img src={navLogo} alt="Logo" className="h-8 w-auto object-contain" />
           ) : (
               <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-slate-900">
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-7l-2-2.52a4 4 0 0 1 7.29-4.74L21 16v6h-5v-5l-2.7-2.7-1.3 2.7v5h-5z"/><path d="M10 2h4"/></svg>
               </div>
           )}
           <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Fasal Rakshak</h1>
        </div>

        {/* Navigation Items (Regular User) */}
        {!isAgent && (
            <div className="flex flex-1 md:flex-none justify-around md:justify-center md:gap-2 w-full md:w-auto items-end md:items-center">
                
                {/* Primary Dashboard Link - Home */}
                {user ? (
                    // LOGGED IN: AgroHub is Home
                    <button 
                        onClick={() => setView(AppView.MARKET)} 
                        className={getButtonClass(AppView.MARKET)}
                    >
                    <HomeIcon />
                    <div className="flex flex-col items-center md:flex-row md:gap-1 mt-1 md:mt-0">
                        <span className="text-[10px] md:text-sm font-medium">{t('nav_home', lang)}</span>
                    </div>
                    </button>
                ) : (
                    // GUEST: Landing Page is Home
                    <button 
                        onClick={() => setView(AppView.LANDING)} 
                        className={getButtonClass(AppView.LANDING)}
                    >
                    <HomeIcon />
                    <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0">{t('nav_home', lang)}</span>
                    </button>
                )}

                {/* Diagnose - The Scanner */}
                <button onClick={handleScanPress} className={getButtonClass(AppView.DIAGNOSIS)}>
                <div className="md:hidden p-3.5 bg-slate-900 dark:bg-white rounded-full -mt-10 border-[6px] border-[#f8fafc] dark:border-[#020617] shadow-xl text-white dark:text-slate-900 transform active:scale-95 transition-transform">
                    <CameraIcon />
                </div>
                <div className="hidden md:block">
                    <CameraIcon />
                </div>
                <span className="text-[10px] md:text-sm font-medium md:block hidden">{t('nav_diagnose', lang)}</span>
                <span className="text-[10px] md:text-sm font-medium md:hidden mt-1 opacity-80">{t('nav_scan', lang)}</span>
                </button>
                
                {/* Crop Planner - NEW FEATURE */}
                {user && (
                    <button onClick={() => setView(AppView.CROP_PLANNER)} className={getButtonClass(AppView.CROP_PLANNER)}>
                        <SproutIcon />
                        <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0">{t('nav_plan', lang)}</span>
                    </button>
                )}
                
                {/* AI Market - Replaces History in Nav */}
                {user && (
                    <button onClick={() => setView(AppView.MARKET_INTELLIGENCE)} className={getButtonClass(AppView.MARKET_INTELLIGENCE)}>
                        <MarketIcon />
                        <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0">{t('nav_ai_market', lang)}</span>
                    </button>
                )}
                
                {/* Profile - User Only (Mobile) */}
                {user && (
                    <button onClick={() => setView(AppView.PROFILE)} className={`${getButtonClass(AppView.PROFILE)} md:hidden`}>
                        <ProfileIcon />
                        <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0">{t('nav_profile', lang)}</span>
                    </button>
                )}
            </div>
        )}

        {/* Agent Navigation (Simplified) */}
        {isAgent && (
            <div className="flex flex-1 justify-center gap-8">
                <button onClick={() => setView(AppView.AGENT_DASHBOARD)} className={getButtonClass(AppView.AGENT_DASHBOARD)}>
                    <HomeIcon />
                    <span className="text-[10px] md:text-sm font-medium">{t('hub_dashboard', lang)}</span>
                </button>
                <button onClick={() => setView(AppView.PROFILE)} className={getButtonClass(AppView.PROFILE)}>
                    <ProfileIcon />
                    <span className="text-[10px] md:text-sm font-medium">{t('lbl_settings', lang)}</span>
                </button>
            </div>
        )}

        {/* Desktop Right Side Actions */}
        <div className="hidden md:flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative" ref={langMenuRef}>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowLangMenu(!showLangMenu)} 
                    className="text-slate-500 dark:text-slate-400"
                    title="Change Language"
                >
                    <GlobeIcon />
                </Button>
                {showLangMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                        {UI_LANGUAGES.map((l) => (
                            <button
                                key={l.code}
                                onClick={() => {
                                    if (onLanguageChange) onLanguageChange(l.code);
                                    setShowLangMenu(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between items-center ${lang === l.code ? 'bg-slate-50 dark:bg-slate-800 font-bold text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}
                            >
                                <span>{l.native}</span>
                                {lang === l.code && <span>✓</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ThemeToggle />
            
            {user && !isAgent && (
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={onNotificationClick}
                  className="relative"
                  title="Notifications"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                    {notificationCount > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                </Button>
            )}

            {user ? (
                <div className="flex items-center gap-3 pl-2">
                    <Button 
                        variant="ghost"
                        className="flex items-center gap-2 pl-1 pr-3 rounded-full h-auto py-1 hover:bg-slate-100 dark:hover:bg-slate-800" 
                        onClick={() => setView(AppView.PROFILE)}
                    >
                        <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[100px] truncate">{user.name}</span>
                    </Button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <Button onClick={() => setView(AppView.LOGIN)} variant="default" size="sm">
                       {t('auth_signin', lang)}
                    </Button>
                </div>
            )}
        </div>

      </div>
    </nav>
  );
};
