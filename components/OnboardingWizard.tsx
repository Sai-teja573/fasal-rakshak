
import React, { useState, useEffect } from 'react';
import { User, Language, DriverDetails } from '../types';
import { UI_LANGUAGES, t } from '../services/translationService';
import { updateUserProfile } from '../services/authService';
import { verifyIdentityWithSurePass } from '../services/transportService';
import { reverseGeocode } from '../services/agroService';
import { Button, Input, cn } from './ui/Shadcn';
import { DEFAULT_CROP_IMAGES } from '../services/cmsService'; // Use database crop images

interface OnboardingWizardProps {
    user: User;
    onComplete: (updatedUser: User) => void;
}

// Mock Data for Dropdowns (Fallback if GPS fails)
const STATES = ["Maharashtra", "Odisha", "Punjab", "Madhya Pradesh", "Karnataka", "Tamil Nadu", "Gujarat", "Uttar Pradesh", "Bihar", "Haryana", "Telangana", "Andhra Pradesh", "West Bengal", "Rajasthan"];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ user, onComplete }) => {
    const role = user.role || 'farmer';
    
    // --- FARMER FLOW STATE ---
    const [step, setStep] = useState(1);
    
    // Step 1: Identity
    const [selectedLang, setSelectedLang] = useState<Language>(user.preferred_languages?.[0] || 'en');
    const [fullName, setFullName] = useState(user.name || "");
    const [phone, setPhone] = useState(user.phone || "");

    // Step 2: Location
    const [locationState, setLocationState] = useState("");
    const [district, setDistrict] = useState("");
    const [gpsLocation, setGpsLocation] = useState<{lat: number, lon: number} | null>(null);
    const [locLoading, setLocLoading] = useState(false);
    const [locationConfirmed, setLocationConfirmed] = useState(false);

    // Step 3: Farming
    const [landSize, setLandSize] = useState("");
    const [landUnit, setLandUnit] = useState("Acres");
    const [landType, setLandType] = useState<'Irrigated' | 'Rainfed' | 'Mixed'>("Irrigated");
    const [selectedCrops, setSelectedCrops] = useState<string[]>(user.crops_grown || []);
    const [farmingMethod, setFarmingMethod] = useState("Conventional (Chemical) Farming");

    // Step 4: Consent
    const [permissions, setPermissions] = useState({
        ai: true,
        location: true,
        voice: true,
        camera: true
    });
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // --- DRIVER FLOW STATE ---
    const [driverStep, setDriverStep] = useState(0); 
    const [aadhaar, setAadhaar] = useState("");
    const [dlNumber, setDlNumber] = useState("");
    const [vehicleData, setVehicleData] = useState({ type: 'Mini Truck', plate: '', capacity: '' });
    const [bankData, setBankData] = useState({ account: '', ifsc: '' });

    const [loading, setLoading] = useState(false);

    // --- HANDLERS ---

    const handleNext = () => {
        setStep(s => Math.min(4, s + 1));
        window.scrollTo(0, 0);
    };

    const handleBack = () => {
        setStep(s => Math.max(1, s - 1));
        window.scrollTo(0, 0);
    };

    const handleGpsDetect = () => {
        setLocLoading(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                setGpsLocation({ lat: latitude, lon: longitude });
                
                try {
                    // Robust Reverse Geocoding
                    const data = await reverseGeocode(latitude, longitude);
                    if (data) {
                        // Auto-fill form
                        setLocationState(data.state || "");
                        setDistrict(data.district || "");
                        setLocationConfirmed(true);
                    }
                } catch (e) {
                    console.error("Geocoding error", e);
                } finally {
                    setLocLoading(false);
                }
            }, (err) => {
                console.error("GPS Error", err);
                alert("Could not detect location. Please check your GPS settings or enter manually.");
                setLocLoading(false);
            }, { enableHighAccuracy: true, timeout: 10000 });
        } else {
            alert("Geolocation is not supported by your browser.");
            setLocLoading(false);
        }
    };

    const toggleCrop = (crop: string) => {
        if (selectedCrops.includes(crop)) {
            setSelectedCrops(selectedCrops.filter(c => c !== crop));
        } else {
            if (selectedCrops.length >= 5) {
                alert("You can select up to 5 main crops.");
                return;
            }
            setSelectedCrops([...selectedCrops, crop]);
        }
    };

    const handleFinish = async () => {
        setLoading(true);
        
        let updates: Partial<User> = {};

        if (role === 'farmer') {
            updates = {
                name: fullName,
                preferred_languages: [selectedLang],
                // Ensure location is valid, fallback to India center if GPS failed
                location: gpsLocation ? { 
                    ...gpsLocation, 
                    state: locationState || "India", 
                    district: district || "Unknown" 
                } : { lat: 20.59, lon: 78.96, state: locationState || "India", district: district || "Unknown" },
                land_size: parseFloat(landSize) || 1,
                water_source: landType === 'Irrigated' ? 'Borewell' : landType === 'Rainfed' ? 'Rainfed' : 'Canal',
                crops_grown: selectedCrops.length > 0 ? selectedCrops : ['Rice'], // Default if empty
            };
        } else {
             const driverDetails: DriverDetails = {
                vehicleType: vehicleData.type as any,
                vehicleNumber: vehicleData.plate,
                licenseNumber: dlNumber,
                loadCapacity: parseFloat(vehicleData.capacity) || 10,
                isVerified: true,
                rating: 5.0,
                totalTrips: 0,
                aadhaarNumber: aadhaar,
                bankDetails: { accountNumber: bankData.account, ifsc: bankData.ifsc },
                earnings: { total: 0, thisMonth: 0, lastMonth: 0, pendingPayout: 0 }
            };
            updates = { driver_details: driverDetails, status: 'Active' };
        }

        try {
            const updatedUser = await updateUserProfile(user.id, updates);
            onComplete(updatedUser);
        } catch (e) {
            console.error("Update failed", e);
            // Even if DB fails (e.g. offline), proceed to app with local state
            const fallbackUser = { ...user, ...updates } as User;
            onComplete(fallbackUser);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERERS ---

    const renderStepper = () => (
        <div className="w-full py-6 mb-4">
            <div className="relative flex items-center justify-between w-full px-4 sm:px-12 max-w-4xl mx-auto">
                {/* Background Line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-700 -z-10 rounded-full"></div>
                {/* Active Line */}
                <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 -z-10 transition-all duration-700 ease-out rounded-full" 
                    style={{ width: `${((step - 1) / 3) * 100}%` }}
                ></div>
                
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex flex-col items-center gap-2 group cursor-default">
                        <div className={`
                            size-8 sm:size-10 rounded-full flex items-center justify-center font-bold shadow-sm transition-all duration-300 border-2
                            ${step > s 
                                ? 'bg-green-500 text-white border-green-500' 
                                : step === s 
                                    ? 'bg-green-500 text-white border-green-500 scale-110 shadow-lg shadow-green-500/20' 
                                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'}
                        `}>
                            {step > s ? <span className="material-symbols-outlined text-lg font-bold">check</span> : s}
                        </div>
                        <span className={`text-[10px] sm:text-xs font-bold hidden sm:block transition-colors duration-300 ${step >= s ? 'text-green-700 dark:text-green-400' : 'text-slate-400'}`}>
                            {['Identity', 'Location', 'Farming', 'Consent'][s-1]}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );

    // If Driver, render simple flow
    if (role === 'driver') {
         return (
            <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-y-auto">
                 <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-50">
                    <h2 className="text-xl font-bold text-slate-900">Driver KYC</h2>
                    <div className="text-sm text-slate-500">Step {driverStep + 1}/3</div>
                 </div>
                 <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
                     <div className="text-center py-10">
                         <h3 className="text-xl font-bold mb-4 text-slate-900">Driver Registration</h3>
                         <p className="mb-6 text-slate-600">Please complete your profile in the dashboard.</p>
                         <Button onClick={() => onComplete(user)} className="bg-green-600 text-white">Go to Dashboard</Button>
                     </div>
                 </div>
            </div>
         );
    }

    // --- FARMER FLOW ---
    return (
        <div className="fixed inset-0 z-[100] bg-[#f8fafc] dark:bg-[#020617] flex flex-col overflow-hidden font-sans text-slate-900 dark:text-white">
            
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="size-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600">
                        <span className="material-symbols-outlined">eco</span>
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">Fasal Rakshak</h1>
                </div>
                <div className="flex items-center gap-2">
                     <div className="size-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                         <img src={user.avatar} className="w-full h-full object-cover" />
                     </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto px-4 py-6 pb-32">
                    
                    {renderStepper()}

                    {/* STEP 1: IDENTITY */}
                    {step === 1 && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="text-center space-y-2 mb-8">
                                <h2 className="text-3xl font-black tracking-tight">Language & Identity</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">Choose your preferred language and confirm your details.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
                                <div className="p-6 sm:p-10 space-y-8">
                                    
                                    {/* Language Grid */}
                                    <div className="space-y-4">
                                        <label className="block text-sm font-bold uppercase tracking-wide opacity-80">Select Language / भाषा चुनें</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            {UI_LANGUAGES.map(lang => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => setSelectedLang(lang.code)}
                                                    className={`
                                                        relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all h-28 group
                                                        ${selectedLang === lang.code 
                                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-md' 
                                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-green-300 dark:hover:border-green-700'}
                                                    `}
                                                >
                                                    <span className={`text-xl font-bold mb-1 ${selectedLang === lang.code ? 'text-green-700 dark:text-green-400' : ''}`}>{lang.native}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{lang.name}</span>
                                                    {selectedLang === lang.code && (
                                                        <div className="absolute top-2 right-2 text-green-600 dark:text-green-400"><span className="material-symbols-outlined text-xl">check_circle</span></div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <hr className="border-slate-100 dark:border-slate-700" />

                                    {/* Inputs */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold">Full Name</label>
                                            <div className="relative group">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-600 transition-colors">person</span>
                                                <input 
                                                    value={fullName} 
                                                    onChange={e => setFullName(e.target.value)} 
                                                    className="block w-full pl-10 pr-4 py-3.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 sm:text-sm font-medium transition-all" 
                                                    placeholder="Enter full name"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold">Phone Number <span className="text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full ml-2">Verified</span></label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">call</span>
                                                <input 
                                                    value={phone} 
                                                    readOnly 
                                                    className="block w-full pl-10 pr-10 py-3.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 cursor-not-allowed focus:outline-none sm:text-sm font-medium" 
                                                />
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400 text-lg">check_circle</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: LOCATION */}
                    {step === 2 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center space-y-2 mb-6">
                                <h2 className="text-3xl font-black tracking-tight">Location Details</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">Where is your farm located? Accurate location helps us provide better weather alerts.</p>
                            </div>
                            
                            {/* Summary Card */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-full text-green-700 dark:text-green-400">
                                        <span className="material-symbols-outlined">person</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm uppercase tracking-wide">Identity</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{fullName} • {phone}</p>
                                    </div>
                                </div>
                                <button onClick={() => setStep(1)} className="text-sm font-bold text-green-600 hover:text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors">Edit</button>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
                                <div className="p-6 sm:p-10 space-y-8">
                                    
                                    {/* GPS Button */}
                                    <div className="flex flex-col gap-4">
                                        <button 
                                            onClick={handleGpsDetect}
                                            className="group relative w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-green-500/30 rounded-xl bg-green-50 dark:bg-green-900/10 text-slate-800 dark:text-white font-bold hover:bg-green-100 dark:hover:bg-green-900/20 hover:border-green-500 transition-all duration-200"
                                        >
                                            <div className="p-2 bg-white dark:bg-slate-900 rounded-full shadow-sm text-green-600 group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined">{locLoading ? 'hourglass_top' : 'my_location'}</span>
                                            </div>
                                            <span>{locLoading ? "Detecting Satellite Signal..." : "Use GPS to Auto-Detect"}</span>
                                            <span className="absolute right-4 hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-300 uppercase tracking-wide">Recommended</span>
                                        </button>
                                        <div className="relative">
                                            <div aria-hidden="true" className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                                            </div>
                                            <div className="relative flex justify-center">
                                                <span className="bg-white dark:bg-slate-800 px-3 text-sm text-slate-400 font-medium">or select manually</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-5">
                                            <div className="space-y-1">
                                                <label className="block text-sm font-bold">State</label>
                                                <div className="relative">
                                                    <select 
                                                        value={locationState} 
                                                        onChange={(e) => setLocationState(e.target.value)}
                                                        className="block w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/10 sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-3 px-4 font-medium appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                                    >
                                                        <option value="">Select State</option>
                                                        {STATES.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-sm font-bold">District</label>
                                                <Input 
                                                    value={district} 
                                                    onChange={e => setDistrict(e.target.value)} 
                                                    placeholder="Enter District Name"
                                                    className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 h-12"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            <label className="block text-sm font-bold">Live Map</label>
                                            <div className="relative w-full aspect-square sm:aspect-video lg:aspect-auto lg:h-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-inner group">
                                                <iframe 
                                                    width="100%" 
                                                    height="100%" 
                                                    style={{ border: 0 }} 
                                                    loading="lazy" 
                                                    allowFullScreen 
                                                    src={`https://www.google.com/maps?q=${gpsLocation ? `${gpsLocation.lat},${gpsLocation.lon}` : (district ? district : "India")}&output=embed`}
                                                    className="opacity-80 group-hover:opacity-100 transition-opacity"
                                                ></iframe>
                                                
                                                {!gpsLocation && !district && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-sm pointer-events-none">
                                                        <p className="text-xs font-bold text-slate-500">Map will update with location</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center mt-1 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="flex h-5 items-center">
                                                    <input 
                                                        id="location-confirm" 
                                                        type="checkbox" 
                                                        checked={locationConfirmed} 
                                                        onChange={e => setLocationConfirmed(e.target.checked)} 
                                                        className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer" 
                                                    />
                                                </div>
                                                <div className="ml-3 text-sm">
                                                    <label htmlFor="location-confirm" className="font-bold cursor-pointer">Confirm Location</label>
                                                    <p className="text-slate-500 text-xs">I verify this is my farm's exact location.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: FARMING */}
                    {step === 3 && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="text-center space-y-2 mb-8">
                                <h2 className="text-3xl font-black tracking-tight">Farming Details</h2>
                                <p className="text-slate-500 text-lg">Select what you grow. This customizes your entire dashboard.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
                                <div className="p-6 sm:p-10 space-y-8">
                                    
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold">Total Land Size</label>
                                        <div className="flex rounded-xl shadow-sm">
                                            <input 
                                                type="number" 
                                                value={landSize} 
                                                onChange={e => setLandSize(e.target.value)} 
                                                className="block w-full min-w-0 flex-1 rounded-none rounded-l-xl border-2 border-slate-200 dark:border-slate-700 border-r-0 py-3 px-4 placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 sm:text-sm bg-white dark:bg-slate-900 font-medium outline-none transition-all z-10" 
                                                placeholder="e.g. 5.5" 
                                            />
                                            <div className="relative">
                                                <select 
                                                    value={landUnit}
                                                    onChange={e => setLandUnit(e.target.value)}
                                                    className="h-full rounded-r-xl border-2 border-l-0 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 pr-8 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:border-green-500 focus:outline-none appearance-none cursor-pointer"
                                                >
                                                    <option>Acres</option><option>Hectares</option><option>Bigha</option><option>Guntha</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold">Crops Cultivated</label>
                                        
                                        {/* Visual Crop Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-80 overflow-y-auto custom-scrollbar p-1">
                                            {DEFAULT_CROP_IMAGES.map((crop) => {
                                                const isSelected = selectedCrops.includes(crop.name_en);
                                                return (
                                                    <button
                                                        key={crop.id}
                                                        onClick={() => toggleCrop(crop.name_en)}
                                                        className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 group text-left flex flex-col ${
                                                            isSelected 
                                                            ? 'border-green-500 ring-2 ring-green-500/30' 
                                                            : 'border-slate-200 dark:border-slate-700 hover:border-green-400'
                                                        }`}
                                                    >
                                                        <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-700 relative w-full overflow-hidden">
                                                            <img 
                                                                src={crop.image} 
                                                                alt={crop.name_en} 
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                                            />
                                                            {/* Overlay for selection */}
                                                            <div className={`absolute inset-0 bg-black/40 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}></div>
                                                            {isSelected && (
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce-in">
                                                                        <span className="material-symbols-outlined text-sm font-bold">check</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className={`p-2 flex-1 flex flex-col justify-center ${isSelected ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-slate-800'}`}>
                                                            <h4 className={`font-bold text-xs text-center ${isSelected ? 'text-green-800 dark:text-green-300' : 'text-slate-800 dark:text-white'}`}>
                                                                {crop.name_en}
                                                            </h4>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <p className="text-xs text-slate-400 mt-2 font-medium">Don't see your crop? <button className="text-green-600 hover:underline">Search List</button></p>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: CONSENT */}
                    {step === 4 && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="text-center space-y-2 mb-8">
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Consent & Permissions</h2>
                                <p className="text-slate-500 text-lg">Final step! Review permissions to activate your AI assistant.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
                                <div className="p-6 sm:p-10 space-y-8">
                                    
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-sm">
                                        <span className="material-symbols-outlined shrink-0 mt-0.5 text-blue-600 dark:text-blue-400">info</span>
                                        <p className="font-medium">We respect your data privacy. Your farming data is only used to provide you with personalized crop advisories and weather alerts.</p>
                                    </div>

                                    <div className="space-y-4">
                                        {[
                                            { id: 'ai', icon: 'psychology', color: 'bg-purple-50 text-purple-600', title: 'Enable AI Crop Analysis', desc: 'Allows our AI to analyze your crop images for disease detection and growth monitoring.', req: true },
                                            { id: 'location', icon: 'location_on', color: 'bg-amber-50 text-amber-600', title: 'Location Services', desc: 'Needed for hyper-local weather forecasts and soil-specific recommendations.', req: true },
                                            { id: 'voice', icon: 'mic', color: 'bg-red-50 text-red-600', title: 'Voice Interaction', desc: 'Enable microphone access to talk to the AI assistant in your local language.', req: false },
                                            { id: 'camera', icon: 'photo_camera', color: 'bg-indigo-50 text-indigo-600', title: 'Camera Access', desc: 'Allow camera access to take photos of affected crops for instant diagnosis.', req: false },
                                        ].map((p) => (
                                            <label key={p.id} className="block cursor-pointer group">
                                                <input 
                                                    type="checkbox" 
                                                    className="custom-checkbox peer sr-only"
                                                    checked={permissions[p.id as keyof typeof permissions]} 
                                                    onChange={e => setPermissions({...permissions, [p.id]: e.target.checked})}
                                                    disabled={p.req}
                                                />
                                                <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-400 transition-all bg-white dark:bg-slate-800/50 peer-checked:border-green-500 peer-checked:bg-green-50/10 peer-checked:ring-1 peer-checked:ring-green-500">
                                                    <div className={`p-2.5 rounded-lg shrink-0 ${p.color}`}>
                                                        <span className="material-symbols-outlined">{p.icon}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                            {p.title}
                                                            {p.req && <span className="bg-slate-100 dark:bg-slate-700 text-xs px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-600">Required</span>}
                                                        </h4>
                                                        <p className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">{p.desc}</p>
                                                    </div>
                                                    <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${permissions[p.id as keyof typeof permissions] ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {permissions[p.id as keyof typeof permissions] && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <input type="checkbox" className="peer sr-only" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} />
                                            <div className={`mt-0.5 size-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${agreedToTerms ? 'bg-green-600 border-green-600' : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400'}`}>
                                                <span className={`material-symbols-outlined text-white text-sm font-bold ${agreedToTerms ? 'opacity-100' : 'opacity-0'}`}>check</span>
                                            </div>
                                            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium select-none">
                                                I agree to the <a href="#" className="text-green-600 font-bold hover:underline">Terms of Service</a> and <a href="#" className="text-green-600 font-bold hover:underline">Privacy Policy</a> of Fasal Rakshak.
                                            </span>
                                        </label>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* Footer Buttons */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 fixed bottom-0 w-full flex justify-between items-center gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={handleBack}
                    disabled={step === 1}
                    className={`inline-flex items-center px-6 py-3 border border-slate-300 dark:border-slate-600 shadow-sm text-base font-bold rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-opacity ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                >
                    <span className="material-symbols-outlined mr-2 text-lg">arrow_back</span>
                    Back
                </button>
                
                <button 
                    onClick={step === 4 ? handleFinish : handleNext}
                    disabled={(step === 4 && !agreedToTerms) || loading}
                    className="inline-flex items-center px-8 py-3 border border-transparent text-base font-bold rounded-xl shadow-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 min-w-[160px] justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Processing...</span>
                        </div>
                    ) : (
                        <>
                            {step === 4 ? 'Complete & Start' : 'Next Step'} 
                            <span className="material-symbols-outlined ml-2 text-lg font-bold">{step === 4 ? 'check_circle' : 'arrow_forward'}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Voice Fab */}
            <div className="fixed bottom-28 right-6 z-40">
                <button className="flex items-center justify-center size-14 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl hover:bg-slate-800 dark:hover:bg-slate-100 hover:scale-110 transition-all focus:outline-none focus:ring-4 focus:ring-slate-300 active:scale-95">
                    <span className="material-symbols-outlined text-2xl">mic</span>
                </button>
                <div className="absolute -top-12 right-0 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-md opacity-0 hover:opacity-100 transition-opacity pointer-events-none arrow-bottom">
                    Speak to fill details
                </div>
            </div>

        </div>
    );
};
