
import React, { useEffect, useRef, useState } from 'react';
import { useMinimumLoading } from '../hooks/useMinimumLoading';
import { downloadKnowledgePack } from '../services/agroService';
import { updateUserProfile } from '../services/authService';
import { fetchPlans } from '../services/cmsService';
import { prefetchLanguageData } from '../services/dashboardTranslationService';
import { generateEsp32Code, generateIotConfig, getLatestSensorData, simulateIncomingSensorData } from '../services/iotService';
import { permissionService, PermissionStatus, PermissionType } from '../services/permissionService';
import { uploadImage } from '../services/storageService';
import { AVAILABLE_MODELS, deleteModel, downloadModel, getActiveModelId, isModelDownloaded } from '../services/tfliteService';
import { clearCache, getCacheSize } from '../services/translationCache';
import { t, UI_LANGUAGES } from '../services/translationService';
import { Language, Plan, SensorData, User } from '../types';
import { CropSelector } from './CropSelector';
import { PaymentModal } from './PaymentModal';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from './ui/Shadcn';
import { Skeleton } from './ui/Skeleton';

// Theme Mode Types
type ThemeMode = 'light' | 'dark' | 'system';

interface ProfileScreenProps {
  user: User | null;
  onLogout: () => void;
  lang: Language;
  onUserUpdate?: (user: User) => void;
  onNavigateToAgroHub?: () => void;
  onLanguageChange?: (lang: Language) => void;
  onViewHistory?: () => void;
}

// Icons
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);

const WifiIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/><line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/></svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);

const MonitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

const HelpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

const MapPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onLogout, lang, onUserUpdate, onNavigateToAgroHub, onLanguageChange, onViewHistory }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'settings' | 'devices'>('general');
  const [activeModal, setActiveModal] = useState<'none' | 'email' | 'crops' | 'languages' | 'farm' | 'notifications' | 'security' | 'help'>('none');
  
  // Local state for modals
  const [selectedLangs, setSelectedLangs] = useState<Language[]>([]);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [contactInfo, setContactInfo] = useState("");
  
  // Farm Details State
  const [farmLandSize, setFarmLandSize] = useState<number>(0);
  const [farmWaterSource, setFarmWaterSource] = useState<'Rainfed' | 'Borewell' | 'Canal' | 'Drip' | 'Unknown'>('Unknown');
  const [farmLocation, setFarmLocation] = useState({ district: '', state: '' });
  
  // Theme Mode State
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  
  // Permissions State
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [requestingPermission, setRequestingPermission] = useState<PermissionType | null>(null);

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    marketAlerts: true,
    weatherAlerts: true,
    diseaseAlerts: true,
    schemeUpdates: true,
    emailNotifications: false
  });
  
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<Plan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);

  // Avatar Upload State
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // TFLite State
  const [modelReady, setModelReady] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string>('lite');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [targetDownloadModel, setTargetDownloadModel] = useState<string | null>(null);
  
  // Knowledge Pack State
  const [packDownloadStatus, setPackDownloadStatus] = useState("");
  const [contentCacheSize, setContentCacheSize] = useState(0);

  // IoT State
  const [showEspSetupModal, setShowEspSetupModal] = useState(false);
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [espStep, setEspStep] = useState<1 | 2>(1); // 1: Input, 2: Code

  const [showDataModal, setShowDataModal] = useState(false);
  const [liveSensorData, setLiveSensorData] = useState<SensorData | null>(null);
  const [isSensorOnline, setIsSensorOnline] = useState(false);

  // Skeleton Logic
  const [loading, setLoading] = useState(true);
  const showSkeleton = useMinimumLoading(loading, 1000);

  // Initialize theme mode from localStorage
  useEffect(() => {
      const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
          setThemeMode(savedTheme);
      } else {
          setThemeMode('system');
      }
  }, []);

  useEffect(() => {
      fetchPlans().then(setAvailablePlans);
      setModelReady(isModelDownloaded());
      setActiveModelId(getActiveModelId());
      getCacheSize().then(setContentCacheSize);
      // Check permissions status
      permissionService.checkAllPermissions().then(setPermissions);
      if (user) {
          setLoading(false);
          // Initialize farm details
          setFarmLandSize(user.land_size || 0);
          setFarmWaterSource(user.water_source || 'Unknown');
          setFarmLocation({
              district: user.location?.district || '',
              state: user.location?.state || ''
          });
      }
  }, [user]);

  useEffect(() => {
      // Periodic check for sensor status if mode is sensor
      if (user?.weather_mode === 'sensor' && user.iot_config) {
          const checkStatus = () => {
              // Simulate incoming data for demo purposes so user sees green light
              simulateIncomingSensorData(user.iot_config!.api_key);
              const data = getLatestSensorData(user.iot_config!.api_key);
              setLiveSensorData(data);
              setIsSensorOnline(!!data);
          };
          
          checkStatus(); // Check immediately
          const interval = setInterval(checkStatus, 3000);
          return () => clearInterval(interval);
      }
  }, [user, user?.weather_mode]);

  const handleDownloadModel = async (modelId: string) => {
      setTargetDownloadModel(modelId);
      setIsDownloading(true);
      await downloadModel(modelId, (progress) => {
          setDownloadProgress(progress);
      });
      setModelReady(true);
      setActiveModelId(modelId);
      setIsDownloading(false);
      setTargetDownloadModel(null);
      setDownloadProgress(0);
  };

  const handleDeleteModel = async () => {
      if(confirm("Delete offline model? You will need internet for AI diagnosis.")) {
          await deleteModel();
          setModelReady(false);
      }
  };

  // Permission Request Handlers
  const handleRequestPermission = async (type: PermissionType) => {
      setRequestingPermission(type);
      try {
          await permissionService.requestPermission(type);
          // Refresh permissions status
          const updated = await permissionService.checkAllPermissions();
          setPermissions(updated);
      } catch (error) {
          console.error(`Failed to request ${type} permission:`, error);
      }
      setRequestingPermission(null);
  };

  const handleRequestAllPermissions = async () => {
      setRequestingPermission('microphone'); // Show loading
      try {
          const updated = await permissionService.requestAllPermissions();
          setPermissions(updated);
      } catch (error) {
          console.error('Failed to request permissions:', error);
      }
      setRequestingPermission(null);
  };

  const getPermissionStatusColor = (status: string | boolean) => {
      if (status === 'granted' || status === true) return 'text-green-600';
      if (status === 'denied' || status === false) return 'text-red-500';
      if (status === 'prompt' || status === 'default') return 'text-amber-500';
      return 'text-slate-400';
  };

  const getPermissionStatusText = (status: string | boolean) => {
      if (status === 'granted' || status === true) return 'Granted';
      if (status === 'denied' || status === false) return 'Denied';
      if (status === 'prompt' || status === 'default') return 'Not Asked';
      if (status === 'unsupported') return 'Not Supported';
      return 'Unknown';
  };

  const getPermissionIcon = (type: PermissionType) => {
      switch (type) {
          case 'camera': return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
          case 'microphone': return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
          case 'notifications': return <BellIcon />;
          case 'location': return <MapPinIcon />;
          case 'storage': return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>;
          default: return <ShieldIcon />;
      }
  };

  const handleDownloadKnowledgePack = async () => {
      if (!user) return;
      
      // 1. Download Static Guides
      setPackDownloadStatus("Downloading Guides...");
      await downloadKnowledgePack(user.crops_grown || [], lang, (msg) => setPackDownloadStatus(msg));
      
      // 2. Download Dynamic Translations
      setPackDownloadStatus("Fetching Latest News & Schemes...");
      await prefetchLanguageData(
          user.crops_grown || [], 
          user.location?.state || 'India', 
          lang, 
          (pct, msg) => {
              setPackDownloadStatus(`${msg} (${pct}%)`);
          }
      );

      getCacheSize().then(setContentCacheSize);
      
      setTimeout(() => setPackDownloadStatus("Download Complete"), 1000);
      setTimeout(() => setPackDownloadStatus(""), 3000);
  };

  // IoT Handlers
  const handleToggleWeatherMode = async (mode: 'online' | 'sensor') => {
      if (!user) return;
      let updates: Partial<User> = { weather_mode: mode };
      
      // Generate IoT Config if missing and switching to sensor
      if (mode === 'sensor' && !user.iot_config) {
          updates.iot_config = generateIotConfig(user.id);
      }
      
      const updatedUser = await updateUserProfile(user.id, updates);
      if (onUserUpdate) onUserUpdate(updatedUser);
  };

  const handleRegenerateKey = async () => {
      if (!user || !confirm("This will disconnect your current ESP32. Continue?")) return;
      const newConfig = generateIotConfig(user.id);
      const updatedUser = await updateUserProfile(user.id, { iot_config: newConfig });
      if (onUserUpdate) onUserUpdate(updatedUser);
  };

  const handleGenerateCode = () => {
      if (!user?.iot_config) return;
      if (!wifiSsid) { alert("Please enter WiFi Name"); return; }
      
      const code = generateEsp32Code(user.iot_config, wifiSsid, wifiPass);
      setGeneratedCode(code);
      setEspStep(2);
  };

  const copyEspCode = () => {
      navigator.clipboard.writeText(generatedCode);
      alert("ESP32 Code Copied to Clipboard!");
  };

  const copyToClipboard = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      alert(`${label} Copied!`);
  };

  // Theme Mode Handler
  const handleThemeModeChange = (mode: ThemeMode) => {
      setThemeMode(mode);
      
      if (mode === 'system') {
          localStorage.removeItem('theme');
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
              document.documentElement.classList.add('dark');
          } else {
              document.documentElement.classList.remove('dark');
          }
      } else if (mode === 'dark') {
          localStorage.setItem('theme', 'dark');
          document.documentElement.classList.add('dark');
      } else {
          localStorage.setItem('theme', 'light');
          document.documentElement.classList.remove('dark');
      }
  };

  // Export User Data Handler
  const handleExportData = async () => {
      if (!user) return;
      
      const exportData = {
          profile: {
              name: user.name,
              email: user.email,
              phone: user.phone,
              farmer_id: user.farmer_id,
              role: user.role
          },
          farm: {
              crops_grown: user.crops_grown,
              land_size: user.land_size,
              water_source: user.water_source,
              location: user.location
          },
          preferences: {
              preferred_languages: user.preferred_languages,
              weather_mode: user.weather_mode
          },
          exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `farmwise-profile-${user.farmer_id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Profile data exported successfully!');
  };

  // Clear Cache Handler
  const handleClearCache = async () => {
      if (!confirm('This will clear all cached content. You will need to redownload offline packs. Continue?')) return;
      
      await clearCache();
      setContentCacheSize(0);
      alert('Cache cleared successfully!');
  };

  // Reset local state when modal opens
  const openModal = (type: 'email' | 'crops' | 'languages' | 'farm' | 'notifications' | 'security' | 'help') => {
      if (!user) return;
      if (type === 'email') setContactInfo(user.email || "");
      if (type === 'crops') setSelectedCrops(user.crops_grown || []);
      if (type === 'languages') setSelectedLangs(user.preferred_languages || ['en']);
      if (type === 'farm') {
          setFarmLandSize(user.land_size || 0);
          setFarmWaterSource(user.water_source || 'Unknown');
          setFarmLocation({
              district: user.location?.district || '',
              state: user.location?.state || ''
          });
      }
      setActiveModal(type);
  };

  if (!user && !loading) return null;

  const handleLangToggle = (code: Language) => {
    if (selectedLangs.includes(code)) {
        if (selectedLangs.length > 1) setSelectedLangs(selectedLangs.filter(l => l !== code));
    } else {
        if (selectedLangs.length < 3) setSelectedLangs([...selectedLangs, code]);
        else alert("Max 3 languages.");
    }
  };

  // Immediate Language Switch Handler
  const handleAppLanguageSwitch = async (code: Language) => {
      if (onLanguageChange) onLanguageChange(code);
      
      // Persist as primary language
      if (user) {
          const newPrefs = [code, ...(user.preferred_languages?.filter(l => l !== code) || [])];
          // Limit to 3 if needed, but primary is key
          await updateUserProfile(user.id, { preferred_languages: newPrefs.slice(0, 3) });
      }
  };

  const handleSave = async () => {
      if (!user) return;
      setSaving(true);
      const safetyTimer = setTimeout(() => {
          setSaving(false);
          setActiveModal('none');
      }, 5000);

      try {
          let updates: Partial<User> = {};
          let shouldClearMarketCache = false;

          if (activeModal === 'email') updates = { email: contactInfo };
          else if (activeModal === 'crops') {
              updates = { crops_grown: selectedCrops };
              shouldClearMarketCache = true;
          }
          else if (activeModal === 'languages') updates = { preferred_languages: selectedLangs };
          else if (activeModal === 'farm') {
              updates = {
                  land_size: farmLandSize,
                  water_source: farmWaterSource,
                  location: {
                      ...user.location,
                      lat: user.location?.lat || 0,
                      lon: user.location?.lon || 0,
                      district: farmLocation.district,
                      state: farmLocation.state
                  }
              };
          }

          // Optimistic update
          const updatedUser = { ...user, ...updates };
          if (onUserUpdate) onUserUpdate(updatedUser);

          // Force clear market cache to trigger re-fetch with new crops
          if (shouldClearMarketCache) {
              // Construct cache keys we know about to invalidate them
              // Note: Ideally we'd use a regex invalidator, but simple is ok here
              // The main one is localized live market data
              // We rely on 'forceRefresh' in getRealMarketPrices to handle most of this logic 
              // but explicit state update in parent (App.tsx) triggers the effect.
          }

          await updateUserProfile(user.id, updates);
          
      } catch (e) {
          console.error("Failed to save profile", e);
          alert("Failed to save changes to server. Please try again.");
      } finally {
          clearTimeout(safetyTimer);
          setSaving(false);
          setActiveModal('none');
      }
  };
  
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!user) return;
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingAvatar(true);
      try {
          const publicUrl = await uploadImage(file, `avatars/${user.id}`);
          if (publicUrl) {
              const updated = await updateUserProfile(user.id, { avatar: publicUrl });
              if (onUserUpdate) onUserUpdate(updated);
          } else {
              alert("Failed to upload avatar. Please try again.");
          }
      } catch (e) {
          console.error("Avatar upload error", e);
          alert("Error uploading avatar.");
      } finally {
          setUploadingAvatar(false);
          if (avatarInputRef.current) avatarInputRef.current.value = '';
      }
  };

  const handlePlanSelect = (plan: Plan) => { 
      if (!user) return;
      if (plan.id === user.plan_id) return; 
      setShowPlansModal(false); 
      setSelectedPlanForPayment(plan); 
  };
  
  const handlePaymentSuccess = (updatedUser: User) => { if (onUserUpdate) onUserUpdate(updatedUser); setSelectedPlanForPayment(null); };
  
  const currentLangName = UI_LANGUAGES.find(l => l.code === lang)?.name || "English";

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      
      {/* Hidden File Input for Avatar */}
      <input 
          type="file" 
          ref={avatarInputRef} 
          className="hidden" 
          accept="image/png, image/jpeg, image/webp" 
          onChange={handleAvatarUpload} 
      />

      {/* EDIT MODALS */}
      <Dialog open={activeModal !== 'none'}>
          <DialogContent className="max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
              <DialogHeader>
                  <DialogTitle>
                      {activeModal === 'email' && t('lbl_contact_info', lang)}
                      {activeModal === 'crops' && t('lbl_manage_crops', lang)}
                      {activeModal === 'languages' && t('lbl_select_lang', lang)}
                      {activeModal === 'farm' && t('prof_farm', lang)}
                      {activeModal === 'notifications' && t('prof_notifications', lang)}
                      {activeModal === 'security' && t('prof_security', lang)}
                      {activeModal === 'help' && t('prof_help', lang)}
                  </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                  {activeModal === 'email' && (
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">{t('lbl_email', lang)}</label>
                          <Input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} className="bg-slate-50 dark:bg-slate-800" />
                      </div>
                  )}
                  {activeModal === 'crops' && user && (
                      <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                          <CropSelector selectedCrops={selectedCrops} onChange={setSelectedCrops} lang={lang} userLocation={user.location} />
                      </div>
                  )}
                  {activeModal === 'languages' && (
                      <div className="grid grid-cols-2 gap-3">
                          {UI_LANGUAGES.map(l => (
                              <button key={l.code} onClick={() => handleLangToggle(l.code)} className={`p-3 rounded-lg border text-sm font-medium transition-all ${selectedLangs.includes(l.code) ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}>
                                  {l.native} <span className="text-xs opacity-70">({l.name})</span>
                              </button>
                          ))}
                      </div>
                  )}
                  {activeModal === 'farm' && (
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Land Size (Acres)</label>
                              <Input 
                                  type="number" 
                                  value={farmLandSize} 
                                  onChange={(e) => setFarmLandSize(parseFloat(e.target.value) || 0)} 
                                  className="bg-slate-50 dark:bg-slate-800" 
                                  placeholder="e.g. 5"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Water Source</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {(['Rainfed', 'Borewell', 'Canal', 'Drip', 'Unknown'] as const).map(source => (
                                      <button
                                          key={source}
                                          onClick={() => setFarmWaterSource(source)}
                                          className={`p-2 rounded-lg border text-sm font-medium transition-all ${farmWaterSource === source ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
                                      >
                                          {source}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">District</label>
                                  <Input 
                                      value={farmLocation.district} 
                                      onChange={(e) => setFarmLocation({...farmLocation, district: e.target.value})} 
                                      className="bg-slate-50 dark:bg-slate-800" 
                                      placeholder="e.g. Khordha"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">State</label>
                                  <Input 
                                      value={farmLocation.state} 
                                      onChange={(e) => setFarmLocation({...farmLocation, state: e.target.value})} 
                                      className="bg-slate-50 dark:bg-slate-800" 
                                      placeholder="e.g. Odisha"
                                  />
                              </div>
                          </div>
                      </div>
                  )}
                  {activeModal === 'notifications' && (
                      <div className="space-y-3">
                          {[
                              { key: 'marketAlerts', label: 'Market Price Alerts', desc: 'Get notified when crop prices change' },
                              { key: 'weatherAlerts', label: 'Weather Warnings', desc: 'Severe weather and rain alerts' },
                              { key: 'diseaseAlerts', label: 'Disease Outbreak Alerts', desc: 'Nearby crop disease warnings' },
                              { key: 'schemeUpdates', label: 'Government Schemes', desc: 'New schemes and subsidies' },
                              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' }
                          ].map(item => (
                              <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                  <div>
                                      <p className="font-medium text-sm text-slate-900 dark:text-white">{item.label}</p>
                                      <p className="text-xs text-slate-500">{item.desc}</p>
                                  </div>
                                  <button
                                      onClick={() => setNotificationSettings({...notificationSettings, [item.key]: !notificationSettings[item.key as keyof typeof notificationSettings]})}
                                      className={`w-10 h-5 rounded-full p-1 transition-colors ${notificationSettings[item.key as keyof typeof notificationSettings] ? 'bg-green-600' : 'bg-slate-300'}`}
                                  >
                                      <div className={`w-3 h-3 bg-white rounded-full transition-transform ${notificationSettings[item.key as keyof typeof notificationSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
                  {activeModal === 'security' && (
                      <div className="space-y-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                              <p className="font-medium text-sm text-slate-900 dark:text-white mb-1">Farmer ID</p>
                              <p className="font-mono text-xs text-slate-600 dark:text-slate-400">{user?.farmer_id}</p>
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                              <p className="font-medium text-sm text-slate-900 dark:text-white mb-1">Account Status</p>
                              <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs font-bold">{user?.status || 'Active'}</span>
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                              <p className="font-medium text-sm text-slate-900 dark:text-white mb-1">Scans This Month</p>
                              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{user?.usage?.scans_this_month || 0}</p>
                          </div>
                          <button className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors">
                              Request Account Deletion
                          </button>
                      </div>
                  )}
                  {activeModal === 'help' && (
                      <div className="space-y-4">
                          <a href="mailto:support@farmwise.app" className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <span className="text-2xl">📧</span>
                              <div>
                                  <p className="font-medium text-sm text-slate-900 dark:text-white">Email Support</p>
                                  <p className="text-xs text-slate-500">support@farmwise.app</p>
                              </div>
                          </a>
                          <a href="tel:+911234567890" className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <span className="text-2xl">📞</span>
                              <div>
                                  <p className="font-medium text-sm text-slate-900 dark:text-white">Helpline</p>
                                  <p className="text-xs text-slate-500">+91 12345 67890</p>
                              </div>
                          </a>
                          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                              <span className="text-2xl">📖</span>
                              <div>
                                  <p className="font-medium text-sm text-slate-900 dark:text-white">User Guide</p>
                                  <p className="text-xs text-slate-500">Learn how to use the app</p>
                              </div>
                          </div>
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                              <p className="text-xs text-slate-600 dark:text-slate-400">App Version: 2.1.0</p>
                          </div>
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setActiveModal('none')} disabled={saving}>{t('lbl_cancel', lang)}</Button>
                  {(activeModal === 'email' || activeModal === 'crops' || activeModal === 'languages' || activeModal === 'farm') && (
                      <Button onClick={handleSave} disabled={saving} className="bg-green-600 text-white hover:bg-green-700">{saving ? t('lbl_saving', lang) : t('lbl_save', lang)}</Button>
                  )}
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* PLANS MODAL */}
          {showPlansModal && user && (
              <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                  <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative">
                      <button onClick={() => setShowPlansModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200">✕</button>
                      <h2 className="text-2xl font-black text-center mb-2 text-slate-900 dark:text-white">{t('plans_choose_upgrade', lang)}</h2>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                          {availablePlans.filter(p => p.price > 0).map(plan => (
                              <div key={plan.id} className={`p-6 rounded-2xl border flex flex-col relative ${plan.recommended ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10 shadow-lg scale-105 z-10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                               <h3 className="text-lg font-bold text-slate-800 dark:text-white">{plan.name}</h3>
                               <div className="flex items-baseline gap-1 my-2"><span className="text-3xl font-black">₹{plan.price}</span><span className="text-xs text-slate-500">/{plan.interval}</span></div>
                               <button onClick={() => handlePlanSelect(plan)} disabled={user.plan_id === plan.id} className={`w-full py-3 rounded-xl font-bold mt-auto ${user.plan_id === plan.id ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>{user.plan_id === plan.id ? t('plans_current', lang) : t('plans_select', lang)}</button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}

      {/* ESP SETUP WIZARD (NEW) */}
      <Dialog open={showEspSetupModal}>
          <DialogContent className="max-w-2xl bg-slate-900 text-white border-slate-800">
              <DialogHeader><DialogTitle className="text-white text-xl flex items-center gap-2"><WifiIcon /> Connect Sensor (ESP32)</DialogTitle></DialogHeader>
              
              {espStep === 1 && (
                  <div className="py-6 space-y-6">
                      <p className="text-slate-300 text-sm">Enter your farm's WiFi credentials. We will generate a C++ Sketch pre-configured with your API Key and HiveMQ broker settings.</p>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                          <div>
                              <label className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 block">WiFi SSID (Network Name)</label>
                              <Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="e.g. JioFiber-Farm" className="bg-slate-900 border-slate-700 text-white" />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 block">WiFi Password</label>
                              <Input type="password" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="e.g. secret1234" className="bg-slate-900 border-slate-700 text-white" />
                          </div>
                      </div>
                  </div>
              )}

              {espStep === 2 && (
                  <div className="py-4">
                      <div className="flex justify-between items-center mb-2">
                          <p className="text-green-400 text-xs font-bold">✓ Sketch Generated</p>
                          <span className="text-[10px] text-slate-500 uppercase">Updates every 15s</span>
                      </div>
                      <div className="bg-black p-4 rounded-xl font-mono text-xs overflow-auto h-80 border border-slate-800 text-green-300 shadow-inner custom-scrollbar relative">
                          <button onClick={copyEspCode} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 p-2 rounded text-white"><CopyIcon /></button>
                          <pre>{generatedCode}</pre>
                      </div>
                      <p className="text-slate-400 text-xs mt-3">Instructions: Copy this code, paste it into Arduino IDE, and flash it to your ESP32 board. Ensure 'PubSubClient' and 'ArduinoJson' libraries are installed.</p>
                  </div>
              )}

              <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowEspSetupModal(false); setEspStep(1); }} className="border-slate-700 text-white hover:bg-slate-800">Close</Button>
                  {espStep === 1 ? (
                      <Button onClick={handleGenerateCode} className="bg-blue-600 text-white hover:bg-blue-500 font-bold px-6">Generate Code</Button>
                  ) : (
                      <Button onClick={copyEspCode} className="bg-green-600 text-white hover:bg-green-500 font-bold px-6">Copy Code</Button>
                  )}
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* LIVE DATA POPUP */}
      <Dialog open={showDataModal}>
          <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              <DialogHeader><DialogTitle className="dark:text-white flex items-center gap-2">
                  Live Field Data
                  {isSensorOnline ? <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></span> : <span className="w-3 h-3 rounded-full bg-red-500"></span>}
              </DialogTitle></DialogHeader>
              <div className="py-4 space-y-4">
                  {liveSensorData ? (
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl text-center border border-blue-100 dark:border-blue-800">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Soil Moisture</div>
                              <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{liveSensorData.soil_moisture.toFixed(1)}%</div>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl text-center border border-orange-100 dark:border-orange-800">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Temperature</div>
                              <div className="text-3xl font-black text-orange-600 dark:text-orange-400">{liveSensorData.temperature.toFixed(1)}°C</div>
                          </div>
                          <div className="bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-xl text-center border border-cyan-100 dark:border-cyan-800">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Humidity</div>
                              <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400">{liveSensorData.humidity.toFixed(1)}%</div>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl text-center border border-green-100 dark:border-green-800">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Leaf Wetness</div>
                              <div className="text-3xl font-black text-green-600 dark:text-green-400">{liveSensorData.leaf_wetness.toFixed(0)}</div>
                          </div>
                      </div>
                  ) : (
                      <div className="text-center py-10 flex flex-col items-center">
                          <div className="w-12 h-12 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mb-4"></div>
                          <p className="text-red-500 text-sm font-bold">No Signal</p>
                          <p className="text-slate-400 text-xs mt-1">Waiting for ESP32 packet...</p>
                      </div>
                  )}
              </div>
              <DialogFooter><Button onClick={() => setShowDataModal(false)} variant="outline">Close Monitor</Button></DialogFooter>
          </DialogContent>
      </Dialog>

      {selectedPlanForPayment && user && <PaymentModal plan={selectedPlanForPayment} user={user} onClose={() => setSelectedPlanForPayment(null)} onSuccess={handlePaymentSuccess} />}

      <header className="px-6 py-4 bg-white dark:bg-slate-800 shadow-sm md:hidden sticky top-0 z-10 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('prof_title', lang)}</h2>
        <button onClick={onLogout} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1 rounded-lg">Logout</button>
      </header>
      
      <main className="flex-1 overflow-y-auto w-full max-w-lg mx-auto custom-scrollbar">
         <div className="w-full bg-white dark:bg-slate-800 shadow-lg border-x border-b border-slate-100 dark:border-slate-700 min-h-full flex flex-col animate-fadeIn">
            
            {/* Header Profile Section */}
            <div className="relative p-8 text-center bg-slate-50 dark:bg-slate-800/50">
                
                {/* Desktop Logout - Absolute Position */}
                <div className="hidden md:block absolute top-4 right-4">
                    <button onClick={onLogout} className="text-xs font-bold text-red-500 hover:text-red-700 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl shadow-sm transition-all hover:bg-red-50">
                        {t('prof_logout', lang)}
                    </button>
                </div>

                <div className="relative z-10 mb-4 inline-block group">
                    <div className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-md bg-white overflow-hidden relative">
                        {showSkeleton ? <Skeleton className="w-full h-full" /> : (
                            <>
                                <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
                                {uploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {!showSkeleton && (
                        <button 
                            onClick={() => avatarInputRef.current?.click()} 
                            disabled={uploadingAvatar}
                            className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full hover:scale-110 transition-transform shadow-lg z-20"
                            title="Change Avatar"
                        >
                            <EditIcon />
                        </button>
                    )}
                </div>
                {showSkeleton ? (
                    <div className="flex flex-col items-center gap-2">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{user?.name}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{user?.email}</p>
                        <p className="text-xs text-blue-500 font-medium mt-1 uppercase tracking-wide">{user?.role}</p>
                    </>
                )}
                
                {/* TABS */}
                <div className="flex bg-slate-200 dark:bg-slate-700/50 p-1 rounded-xl mt-6 max-w-md mx-auto">
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Profile
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Settings
                    </button>
                    <button 
                        onClick={() => setActiveTab('devices')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'devices' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Devices
                    </button>
                </div>
            </div>

            <div className="p-6 flex-1">
                
                {/* TAB 1: GENERAL */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-fadeIn">
                        {onNavigateToAgroHub && (
                            <button onClick={onNavigateToAgroHub} className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3">
                                <span>Go to Dashboard</span> <span className="text-xl">→</span>
                            </button>
                        )}

                        <div className="space-y-4">
                            {/* NEW: View History Button */}
                            <button 
                                onClick={onViewHistory}
                                className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-slate-200 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">📜</span>
                                    <span className="font-bold text-slate-900 dark:text-white">Scan History</span>
                                </div>
                                <span className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">→</span>
                            </button>

                            {/* Farm Details Card */}
                            {showSkeleton ? <Skeleton className="h-24 w-full rounded-2xl" /> : (
                                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <MapPinIcon /> Farm Details
                                        </label>
                                        <button onClick={() => openModal('farm')} className="text-blue-600 text-xs font-bold hover:underline">Edit</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-[10px] text-slate-500 uppercase">Land Size</p>
                                            <p className="font-bold text-slate-900 dark:text-white">{user?.land_size || 0} Acres</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-[10px] text-slate-500 uppercase">Water Source</p>
                                            <p className="font-bold text-slate-900 dark:text-white">{user?.water_source || 'Unknown'}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl col-span-2">
                                            <p className="text-[10px] text-slate-500 uppercase">Location</p>
                                            <p className="font-bold text-slate-900 dark:text-white">
                                                {user?.location?.district && user?.location?.state 
                                                    ? `${user.location.district}, ${user.location.state}`
                                                    : 'Not set'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showSkeleton ? <Skeleton className="h-24 w-full rounded-2xl" /> : (
                                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('lbl_my_crops', lang)}</label>
                                        <button onClick={() => openModal('crops')} className="text-blue-600 text-xs font-bold hover:underline">Edit</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {user?.crops_grown && user.crops_grown.length > 0 ? user.crops_grown.map(c => <span key={c} className="px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-bold">{c}</span>) : <span className="text-xs text-slate-400 italic">No crops selected</span>}
                                    </div>
                                </div>
                            )}

                            {/* Contact Info Card */}
                            {showSkeleton ? <Skeleton className="h-20 w-full rounded-2xl" /> : (
                                <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Info</label>
                                        <button onClick={() => openModal('email')} className="text-blue-600 text-xs font-bold hover:underline">Edit</button>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">📧</span>
                                            <span className="text-sm text-slate-700 dark:text-slate-300">{user?.email || 'Not set'}</span>
                                        </div>
                                        {user?.phone && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">📱</span>
                                                <span className="text-sm text-slate-700 dark:text-slate-300">{user.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => openModal('notifications')}
                                    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600">
                                        <BellIcon />
                                    </div>
                                    <span className="font-medium text-sm text-slate-900 dark:text-white">Alerts</span>
                                </button>
                                <button 
                                    onClick={() => openModal('security')}
                                    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600">
                                        <ShieldIcon />
                                    </div>
                                    <span className="font-medium text-sm text-slate-900 dark:text-white">Security</span>
                                </button>
                                <button 
                                    onClick={handleExportData}
                                    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600">
                                        <DownloadIcon />
                                    </div>
                                    <span className="font-medium text-sm text-slate-900 dark:text-white">Export</span>
                                </button>
                                <button 
                                    onClick={() => openModal('help')}
                                    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-600">
                                        <HelpIcon />
                                    </div>
                                    <span className="font-medium text-sm text-slate-900 dark:text-white">Help</span>
                                </button>
                            </div>
                        </div>

                        {/* Redundant bottom logout for easy mobile access */}
                        <button type="button" onClick={(e) => { e.preventDefault(); onLogout(); }} className="w-full py-3 text-red-500 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors md:hidden">
                            {t('prof_logout', lang)}
                        </button>
                    </div>
                )}

                {/* TAB 2: SETTINGS */}
                {activeTab === 'settings' && (
                    <div className="space-y-6 animate-fadeIn">
                        
                        {/* Theme Mode Selector */}
                        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">Appearance</label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => handleThemeModeChange('light')}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                        themeMode === 'light' 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <div className={`p-3 rounded-full ${themeMode === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                        <SunIcon />
                                    </div>
                                    <span className={`text-sm font-bold ${themeMode === 'light' ? 'text-blue-600' : 'text-slate-600 dark:text-slate-400'}`}>Light</span>
                                </button>
                                <button
                                    onClick={() => handleThemeModeChange('dark')}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                        themeMode === 'dark' 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <div className={`p-3 rounded-full ${themeMode === 'dark' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                        <MoonIcon />
                                    </div>
                                    <span className={`text-sm font-bold ${themeMode === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>Dark</span>
                                </button>
                                <button
                                    onClick={() => handleThemeModeChange('system')}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                        themeMode === 'system' 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <div className={`p-3 rounded-full ${themeMode === 'system' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                        <MonitorIcon />
                                    </div>
                                    <span className={`text-sm font-bold ${themeMode === 'system' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>System</span>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 text-center mt-3">
                                {themeMode === 'system' ? 'Follows your device settings' : `${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} mode enabled`}
                            </p>
                        </div>

                        {/* App Interface Language Switcher */}
                        {showSkeleton ? <Skeleton className="h-32 w-full rounded-2xl" /> : (
                            <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">App Interface Language</label>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {UI_LANGUAGES.map(l => (
                                        <button 
                                            key={l.code}
                                            onClick={() => handleAppLanguageSwitch(l.code)}
                                            className={`
                                                flex flex-col items-start p-2 rounded-lg border transition-all
                                                ${lang === l.code 
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:bg-slate-100'
                                                }
                                            `}
                                        >
                                            <span className={`text-sm font-bold ${lang === l.code ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{l.native}</span>
                                            <span className="text-[10px] text-slate-400">{l.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* OFFLINE CONTENT MANAGER */}
                        <div className="p-4 rounded-2xl border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Offline Access</label>
                                <span className="text-xs text-slate-400">{contentCacheSize} cached items</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                                Download latest News, Schemes, and Guides in <strong>{currentLangName}</strong> for use without internet.
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleDownloadKnowledgePack}
                                    disabled={!!packDownloadStatus || lang === 'en'}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    {packDownloadStatus ? packDownloadStatus : `Download ${currentLangName} Pack`}
                                </button>
                                <button 
                                    onClick={handleClearCache}
                                    disabled={contentCacheSize === 0}
                                    className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                                    title="Clear Cache"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                            {lang === 'en' && <p className="text-[10px] text-center text-slate-400 mt-2">Switch language to download translations.</p>}
                        </div>

                        {/* APP PERMISSIONS */}
                        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">App Permissions</label>
                                <button
                                    onClick={handleRequestAllPermissions}
                                    disabled={requestingPermission !== null}
                                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                                >
                                    {requestingPermission ? 'Requesting...' : 'Grant All'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                Manage permissions for calling, notifications, and location features.
                            </p>
                            
                            <div className="space-y-2">
                                {permissions && (
                                    <>
                                        {/* Microphone */}
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${permissions.microphone === 'granted' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-slate-100 dark:bg-slate-600 text-slate-500'}`}>
                                                    {getPermissionIcon('microphone')}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Microphone</p>
                                                    <p className="text-[10px] text-slate-500">Voice messages & calls</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${getPermissionStatusColor(permissions.microphone)}`}>
                                                    {getPermissionStatusText(permissions.microphone)}
                                                </span>
                                                {permissions.microphone !== 'granted' && permissions.microphone !== 'unsupported' && (
                                                    <button
                                                        onClick={() => handleRequestPermission('microphone')}
                                                        disabled={requestingPermission === 'microphone'}
                                                        className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50"
                                                    >
                                                        Allow
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Camera */}
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${permissions.camera === 'granted' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-slate-100 dark:bg-slate-600 text-slate-500'}`}>
                                                    {getPermissionIcon('camera')}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Camera</p>
                                                    <p className="text-[10px] text-slate-500">Video calls & photos</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${getPermissionStatusColor(permissions.camera)}`}>
                                                    {getPermissionStatusText(permissions.camera)}
                                                </span>
                                                {permissions.camera !== 'granted' && permissions.camera !== 'unsupported' && (
                                                    <button
                                                        onClick={() => handleRequestPermission('camera')}
                                                        disabled={requestingPermission === 'camera'}
                                                        className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50"
                                                    >
                                                        Allow
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Notifications */}
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${permissions.notifications === 'granted' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-slate-100 dark:bg-slate-600 text-slate-500'}`}>
                                                    {getPermissionIcon('notifications')}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Notifications</p>
                                                    <p className="text-[10px] text-slate-500">Incoming call alerts</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${getPermissionStatusColor(permissions.notifications)}`}>
                                                    {getPermissionStatusText(permissions.notifications)}
                                                </span>
                                                {permissions.notifications !== 'granted' && permissions.notifications !== 'unsupported' && (
                                                    <button
                                                        onClick={() => handleRequestPermission('notifications')}
                                                        disabled={requestingPermission === 'notifications'}
                                                        className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50"
                                                    >
                                                        Allow
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Location */}
                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${permissions.location === 'granted' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-slate-100 dark:bg-slate-600 text-slate-500'}`}>
                                                    {getPermissionIcon('location')}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Location</p>
                                                    <p className="text-[10px] text-slate-500">Weather & market info</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${getPermissionStatusColor(permissions.location)}`}>
                                                    {getPermissionStatusText(permissions.location)}
                                                </span>
                                                {permissions.location !== 'granted' && permissions.location !== 'unsupported' && (
                                                    <button
                                                        onClick={() => handleRequestPermission('location')}
                                                        disabled={requestingPermission === 'location'}
                                                        className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-500 disabled:opacity-50"
                                                    >
                                                        Allow
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {!permissions && (
                                    <div className="text-center py-4 text-slate-400 text-sm">
                                        Loading permissions...
                                    </div>
                                )}
                            </div>

                            {/* Info about denied permissions */}
                            {permissions && (permissions.microphone === 'denied' || permissions.camera === 'denied' || permissions.notifications === 'denied' || permissions.location === 'denied') && (
                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        <strong>Some permissions are blocked.</strong> To enable them, you may need to go to your browser/device settings and allow access for this app.
                                    </p>
                                </div>
                            )}

                            {/* HTTPS Warning */}
                            {permissions && !permissions.isSecureContext && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                    <p className="text-xs text-red-700 dark:text-red-400">
                                        <strong>⚠️ HTTPS Required:</strong> Camera and Microphone permissions require a secure connection (HTTPS). You're currently on an insecure connection. Please use HTTPS to enable all features.
                                    </p>
                                </div>
                            )}

                            {/* Unsupported browser warning */}
                            {permissions && (permissions.camera === 'unsupported' || permissions.microphone === 'unsupported') && permissions.isSecureContext && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                                    <p className="text-xs text-blue-700 dark:text-blue-400">
                                        <strong>ℹ️ Browser Support:</strong> Some permissions may not be supported in your browser. Try using the latest version of Chrome, Firefox, Safari, or Edge.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Subscription Plan */}
                        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subscription</label>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{availablePlans.find(p => p.id === user?.plan_id)?.name || 'Free Plan'}</p>
                                    <p className="text-xs text-slate-500">Manage your subscription</p>
                                </div>
                                <button 
                                    onClick={() => setShowPlansModal(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity"
                                >
                                    Upgrade
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: DEVICES & AI */}
                {activeTab === 'devices' && user && (
                    <div className="space-y-6 animate-fadeIn">
                        
                        {/* WEATHER INTELLIGENCE CARD */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Weather Intelligence Mode</h4>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Data Source</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold ${user.weather_mode !== 'sensor' ? 'text-blue-600' : 'text-slate-400'}`}>Online</span>
                                    <button 
                                        onClick={() => handleToggleWeatherMode(user.weather_mode === 'sensor' ? 'online' : 'sensor')}
                                        className={`w-10 h-5 rounded-full p-1 transition-colors ${user.weather_mode === 'sensor' ? 'bg-green-600' : 'bg-slate-300'}`}
                                    >
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${user.weather_mode === 'sensor' ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                    <span className={`text-[10px] font-bold ${user.weather_mode === 'sensor' ? 'text-green-600' : 'text-slate-400'}`}>Sensor</span>
                                </div>
                            </div>
                            
                            {user.weather_mode === 'sensor' && (
                                <div className="p-5 space-y-5 bg-slate-900 text-white">
                                    {/* Status Header */}
                                    <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] ${isSensorOnline ? 'bg-green-500 shadow-green-500' : 'bg-red-500 shadow-red-500'}`}></div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                                                <p className={`text-sm font-bold ${isSensorOnline ? 'text-green-400' : 'text-red-400'}`}>{isSensorOnline ? 'Online' : 'Offline'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-400 uppercase">Last Signal</p>
                                            <p className="text-sm font-mono text-slate-300">
                                                {liveSensorData ? new Date(liveSensorData.timestamp).toLocaleTimeString() : '--:--'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setShowDataModal(true)} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all">
                                            Monitor Live
                                        </button>
                                        <button onClick={() => setShowEspSetupModal(true)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm border border-slate-600 transition-all">
                                            Setup Guide
                                        </button>
                                    </div>

                                    {/* Config Info */}
                                    <div className="bg-black/40 p-4 rounded-xl font-mono text-[10px] text-slate-400 border border-slate-800">
                                        <div className="flex justify-between mb-1"><span>API Key:</span> <span className="text-slate-200">{user.iot_config?.api_key || '...'}</span></div>
                                        <div className="flex justify-between"><span>Topic:</span> <span className="text-slate-200 text-right truncate ml-2">{user.iot_config?.topic || '...'}</span></div>
                                        <div className="mt-2 pt-2 border-t border-slate-800 text-center">
                                            <button onClick={handleRegenerateKey} className="text-red-400 hover:text-red-300 font-bold">Regenerate Keys</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* TFLite Model Manager */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Offline AI Models</h4>
                                    <p className="text-[10px] text-slate-500">Download models for use without internet</p>
                                </div>
                                <div className="p-4 space-y-4">
                                    {AVAILABLE_MODELS.map(model => (
                                        <div key={model.id} className={`p-4 rounded-xl border transition-all ${activeModelId === model.id ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">{model.name}</h5>
                                                    <p className="text-xs text-slate-500">{model.size} • {model.accuracy} Accuracy</p>
                                                </div>
                                                {activeModelId === model.id && modelReady ? (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Active</span>
                                                ) : targetDownloadModel === model.id ? (
                                                    <span className="text-[10px] font-bold text-blue-600">{downloadProgress}%</span>
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{model.description}</p>
                                            
                                            {activeModelId === model.id && modelReady ? (
                                                <button onClick={handleDeleteModel} className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50">Delete Model</button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleDownloadModel(model.id)} 
                                                    disabled={isDownloading}
                                                    className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg disabled:opacity-50"
                                                >
                                                    {isDownloading && targetDownloadModel === model.id ? 'Downloading...' : 'Download'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
         </div>
      </main>
    </div>
  );
};
