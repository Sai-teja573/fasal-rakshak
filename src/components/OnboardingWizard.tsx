import React, { useState, useEffect } from 'react';

// Types
interface User {
    id: string;
    name?: string;
    phone?: string;
    avatar?: string;
    role?: 'farmer' | 'driver';
    preferred_languages?: string[];
    location?: any;
    land_size?: number;
    water_source?: string;
    crops_grown?: string[];
    driver_details?: any;
    status?: string;
}

interface OnboardingWizardProps {
    user: User;
    onComplete: (updatedUser: User) => void;
}

// Comprehensive Data for Dropdowns
const STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const DISTRICTS_BY_STATE: Record<string, string[]> = {
    "Maharashtra": ["Pune", "Mumbai", "Nagpur", "Nashik", "Aurangabad", "Solapur", "Ahmednagar", "Kolhapur", "Satara", "Sangli"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur", "Moga", "Pathankot", "Fazilka"],
    "Haryana": ["Faridabad", "Gurugram", "Hisar", "Rohtak", "Panipat", "Karnal", "Sonipat", "Ambala", "Yamunanagar", "Kurukshetra"],
    "Karnataka": ["Bengaluru", "Mysuru", "Hubli-Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Ballari", "Tumakuru", "Shivamogga", "Davanagere"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Dindigul"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Prayagraj", "Bareilly", "Aligarh", "Moradabad"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Sikar"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Mehsana"],
    "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Malda", "Bardhaman", "Murshidabad", "Birbhum", "Nadia"]
};

const BLOCKS = ["Haveli", "Mulshi", "Baramati", "Shirur", "Maval", "Bhor", "Junnar", "Ambegaon", "Khed", "Daund"];
const VILLAGES = ["Donje", "Khadakwasla", "Kirkatwadi", "Nanded", "Shivane", "Bavdhan", "Warje", "Kondhwa", "Hadapsar", "Wagholi"];

// Comprehensive Crop Data with Images
const CROPS_DATA = [
    { name: "Rice / Paddy", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop" },
    { name: "Wheat", image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&h=300&fit=crop" },
    { name: "Cotton", image: "https://images.unsplash.com/photo-1615485736876-f492c3de3860?w=400&h=300&fit=crop" },
    { name: "Maize", image: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&h=300&fit=crop" },
    { name: "Sugarcane", image: "https://images.unsplash.com/photo-1583508915901-b5700d8a7c0b?w=400&h=300&fit=crop" },
    { name: "Soybean", image: "https://images.unsplash.com/photo-1596040033229-a0b34af1b93f?w=400&h=300&fit=crop" },
    { name: "Pulses", image: "https://images.unsplash.com/photo-1599946347371-68eb71b16afc?w=400&h=300&fit=crop" },
    { name: "Groundnut", image: "https://images.unsplash.com/photo-1589879558765-815b7b0add88?w=400&h=300&fit=crop" },
    { name: "Sunflower", image: "https://images.unsplash.com/photo-1597848212624-e4e9a27a15da?w=400&h=300&fit=crop" },
    { name: "Mustard", image: "https://images.unsplash.com/photo-1599599811297-04c869ab3e2f?w=400&h=300&fit=crop" },
    { name: "Bajra", image: "https://images.unsplash.com/photo-1625881433990-07313fd24c99?w=400&h=300&fit=crop" },
    { name: "Jowar", image: "https://images.unsplash.com/photo-1625082794508-02eba7a6bde0?w=400&h=300&fit=crop" },
    { name: "Potato", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop" },
    { name: "Onion", image: "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=400&h=300&fit=crop" },
    { name: "Tomato", image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&h=300&fit=crop" },
    { name: "Chilli", image: "https://images.unsplash.com/photo-1583454155184-870a1f63f2fd?w=400&h=300&fit=crop" },
    { name: "Turmeric", image: "https://images.unsplash.com/photo-1615485500834-bc10199bc727?w=400&h=300&fit=crop" },
    { name: "Ginger", image: "https://images.unsplash.com/photo-1577234286642-fc512a5f8f11?w=400&h=300&fit=crop" },
    { name: "Garlic", image: "https://images.unsplash.com/photo-1619436370124-5e8674a9e0c5?w=400&h=300&fit=crop" },
    { name: "Tea", image: "https://images.unsplash.com/photo-1597318238992-6a1bd8b59837?w=400&h=300&fit=crop" },
    { name: "Coffee", image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=300&fit=crop" },
    { name: "Rubber", image: "https://images.unsplash.com/photo-1580121441575-41bcb5c6b47c?w=400&h=300&fit=crop" },
    { name: "Coconut", image: "https://images.unsplash.com/photo-1598616235536-e4d8f2c8e5f5?w=400&h=300&fit=crop" },
    { name: "Banana", image: "https://images.unsplash.com/photo-1603052875906-0fdcde00e3c0?w=400&h=300&fit=crop" },
    { name: "Mango", image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=300&fit=crop" },
    { name: "Papaya", image: "https://images.unsplash.com/photo-1617112848923-cc2234396a8d?w=400&h=300&fit=crop" },
    { name: "Grapes", image: "https://images.unsplash.com/photo-1599819177272-b4c8a2a79d0e?w=400&h=300&fit=crop" },
    { name: "Pomegranate", image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&h=300&fit=crop" }
];

const UI_LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिंदी' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ user, onComplete }) => {
    const role = user.role || 'farmer';
    
    // --- FARMER FLOW STATE ---
    const [step, setStep] = useState(1);
    
    // Step 1: Identity
    const [selectedLang, setSelectedLang] = useState(user.preferred_languages?.[0] || 'en');
    const [fullName, setFullName] = useState(user.name || "");
    const [phone, setPhone] = useState(user.phone || "+91 98765 43210");

    // Step 2: Location
    const [locationState, setLocationState] = useState("");
    const [district, setDistrict] = useState("");
    const [block, setBlock] = useState("");
    const [village, setVillage] = useState("");
    const [gpsLocation, setGpsLocation] = useState<{lat: number, lon: number} | null>(null);
    const [locLoading, setLocLoading] = useState(false);
    const [locationConfirmed, setLocationConfirmed] = useState(false);
    
    // Computed districts based on selected state
    const availableDistricts = locationState ? (DISTRICTS_BY_STATE[locationState] || DISTRICTS_BY_STATE["Maharashtra"]) : [];

    // Step 3: Farming
    const [landSize, setLandSize] = useState("");
    const [landUnit, setLandUnit] = useState("Acres");
    const [landType, setLandType] = useState<'Irrigated' | 'Rainfed' | 'Mixed'>("Irrigated");
    const [cropInput, setCropInput] = useState("");
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
                setLocationState("Maharashtra");
                setDistrict("Pune");
                setLocLoading(false);
                setLocationConfirmed(true);
            }, (err) => {
                alert("Location access denied or failed.");
                setLocLoading(false);
            });
        }
    };

    const addCrop = (crop: string) => {
        if (!selectedCrops.includes(crop)) setSelectedCrops([...selectedCrops, crop]);
        setCropInput("");
    };

    const removeCrop = (crop: string) => {
        setSelectedCrops(selectedCrops.filter(c => c !== crop));
    };

    const handleFinish = async () => {
        setLoading(true);
        
        const updates: Partial<User> = {
            name: fullName,
            preferred_languages: [selectedLang],
            location: gpsLocation ? { ...gpsLocation, state: locationState, district: district } : { lat: 20.59, lon: 78.96, state: locationState, district },
            land_size: parseFloat(landSize) || 1,
            water_source: landType === 'Irrigated' ? 'Borewell' : landType === 'Rainfed' ? 'Rainfed' : 'Canal',
            crops_grown: selectedCrops,
        };

        setTimeout(() => {
            onComplete({ ...user, ...updates } as User);
            setLoading(false);
        }, 1500);
    };

    // --- RENDERERS ---
    const renderStepper = () => (
        <div className="w-full py-4 sm:py-6 mb-2">
            <div className="relative flex items-center justify-between w-full px-2 sm:px-8 max-w-4xl mx-auto">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 sm:h-1 bg-slate-200 dark:bg-slate-700 -z-10 rounded-full"></div>
                <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 sm:h-1 bg-green-500 -z-10 transition-all duration-700 ease-out rounded-full" 
                    style={{ width: `${((step - 1) / 3) * 100}%` }}
                ></div>
                
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex flex-col items-center gap-1 sm:gap-2 group cursor-default">
                        <div className={`
                            size-7 sm:size-10 rounded-full flex items-center justify-center text-xs sm:text-base font-bold shadow-sm transition-all duration-300
                            ${step > s 
                                ? 'bg-green-500 text-white ring-2 sm:ring-4 ring-white dark:ring-slate-900' 
                                : step === s 
                                    ? 'bg-green-500 text-white ring-2 sm:ring-4 ring-white dark:ring-slate-900 scale-110 shadow-lg shadow-green-500/30' 
                                    : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-400'}
                        `}>
                            {step > s ? '✓' : s}
                        </div>
                        <span className={`text-[9px] sm:text-xs font-bold transition-colors duration-300 ${step >= s ? 'text-green-700 dark:text-green-400' : 'text-slate-400'}`}>
                            {['Identity', 'Location', 'Farming', 'Consent'][s-1]}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );

    if (role === 'driver') {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-y-auto">
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center sticky top-0 z-50">
                    <h2 className="text-xl font-bold">Driver KYC</h2>
                </div>
                <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
                    <div className="text-center py-10">
                        <h3 className="text-xl font-bold mb-4">Driver Registration</h3>
                        <p className="mb-6">Please complete your profile in the dashboard.</p>
                        <button onClick={() => onComplete(user)} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">Go to Dashboard</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- FARMER FLOW ---
    return (
        <div className="fixed inset-0 z-[100] bg-[#f5f8f6] dark:bg-[#102216] flex flex-col overflow-hidden">
            
            {/* Header - Mobile Optimized */}
            <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#1c2e22]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="size-7 sm:size-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 text-sm sm:text-base">
                        🌱
                    </div>
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">Fasal Rakshak</h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="size-7 sm:size-8 rounded-full bg-slate-200 overflow-hidden border border-white shadow-sm">
                        <img src={user.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=farmer"} className="w-full h-full object-cover" alt="User" />
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-24 sm:pb-32">
                    
                    {renderStepper()}

                    {/* STEP 1: IDENTITY */}
                    {step === 1 && (
                        <div className="space-y-4 sm:space-y-8 animate-fadeIn">
                            <div className="text-center space-y-1 sm:space-y-2 mb-4 sm:mb-8">
                                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">Language & Identity</h2>
                                <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400">Choose your preferred language and confirm your details.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
                                <div className="p-4 sm:p-8 space-y-5 sm:space-y-8">
                                    
                                    {/* Language Grid - Mobile Optimized */}
                                    <div className="space-y-3 sm:space-y-4">
                                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Select Language / भाषा चुनें</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                                            {UI_LANGUAGES.map(lang => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => setSelectedLang(lang.code)}
                                                    className={`
                                                        relative flex flex-col items-center justify-center p-2.5 sm:p-4 rounded-lg border-2 transition-all h-16 sm:h-24
                                                        ${selectedLang === lang.code 
                                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                                            : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700'}
                                                    `}
                                                >
                                                    <span className={`text-sm sm:text-lg font-bold ${selectedLang === lang.code ? 'text-green-800 dark:text-green-300' : 'text-slate-900 dark:text-white'}`}>{lang.native}</span>
                                                    <span className="text-[9px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">{lang.name}</span>
                                                    {selectedLang === lang.code && (
                                                        <div className="absolute top-1 right-1 sm:top-2 sm:right-2 text-green-600 text-xs sm:text-base">✓</div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <hr className="border-slate-200 dark:border-slate-700" />

                                    {/* Inputs - Mobile Optimized */}
                                    <div className="grid grid-cols-1 gap-4 sm:gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Full Name</label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm sm:text-base">👤</span>
                                                <input 
                                                    value={fullName} 
                                                    onChange={e => setFullName(e.target.value)} 
                                                    className="block w-full pl-8 sm:pl-10 pr-3 py-2.5 sm:py-3 border border-slate-300 rounded-md text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                                                    placeholder="Enter full name"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Phone Number <span className="text-[10px] sm:text-xs font-normal text-slate-400 ml-1">(Verified)</span></label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm sm:text-base">📞</span>
                                                <input 
                                                    value={phone} 
                                                    readOnly 
                                                    className="block w-full pl-8 sm:pl-10 pr-3 py-2.5 sm:py-3 border border-slate-300 rounded-md text-sm sm:text-base text-slate-500 bg-slate-100 cursor-not-allowed focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400" 
                                                />
                                                <span className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-green-500 text-base sm:text-lg">✓</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: LOCATION */}
                    {step === 2 && (
                        <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                            <div className="text-center space-y-1 sm:space-y-2 mb-4 sm:mb-6">
                                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">Location Details</h2>
                                <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400">Where is your farm located?</p>
                            </div>
                            
                            {/* Summary Card - Mobile Optimized */}
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-100 dark:border-slate-700 shadow-sm opacity-80 flex items-center justify-between">
                                <div className="flex items-center gap-2 sm:gap-4">
                                    <div className="bg-green-100 dark:bg-green-900/30 p-1.5 sm:p-2 rounded-full text-green-700 dark:text-green-400 text-sm sm:text-base">
                                        🌐
                                    </div>
                                    <div>
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Language & Identity</h3>
                                        <p className="text-[10px] sm:text-sm text-slate-500">{fullName}</p>
                                    </div>
                                </div>
                                <button onClick={() => setStep(1)} className="text-xs sm:text-sm font-medium text-green-600 hover:underline">Edit</button>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
                                <div className="p-4 sm:p-8 space-y-5 sm:space-y-8">
                                    
                                    {/* GPS Button - Mobile Optimized */}
                                    <div className="flex flex-col gap-3 sm:gap-4">
                                        <button 
                                            onClick={handleGpsDetect}
                                            className="group relative w-full flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 border-2 border-dashed border-green-500/40 rounded-lg sm:rounded-xl bg-green-50/50 dark:bg-green-900/10 text-slate-800 dark:text-white text-sm sm:text-base font-semibold hover:bg-green-50/80 hover:border-green-500 transition-all duration-200"
                                        >
                                            <div className="p-1.5 sm:p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm text-green-600 group-hover:scale-110 transition-transform text-sm sm:text-base">
                                                {locLoading ? '⏳' : '📍'}
                                            </div>
                                            <span className="text-xs sm:text-base">{locLoading ? "Detecting..." : "Use GPS Location"}</span>
                                        </button>
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                                            </div>
                                            <div className="relative flex justify-center">
                                                <span className="bg-white dark:bg-slate-800 px-2 sm:px-3 text-xs sm:text-sm text-slate-400">or enter manually</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 sm:gap-8">
                                        <div className="space-y-3 sm:space-y-5">
                                            {[
                                                { label: "State", val: locationState, set: (v: string) => { setLocationState(v); setDistrict(""); }, opts: STATES },
                                                { label: "District", val: district, set: setDistrict, opts: availableDistricts },
                                                { label: "Block / Taluka", val: block, set: setBlock, opts: BLOCKS },
                                                { label: "Village", val: village, set: setVillage, opts: VILLAGES },
                                            ].map((f, i) => (
                                                <div key={i} className="space-y-1">
                                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">{f.label}</label>
                                                    <select 
                                                        value={f.val} 
                                                        onChange={(e) => f.set(e.target.value)}
                                                        className="block w-full rounded-md border-slate-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm sm:text-base bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white py-2 sm:py-2.5 px-3"
                                                    >
                                                        <option value="">Select {f.label}</option>
                                                        {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-col gap-3 sm:gap-4">
                                            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Map Preview</label>
                                            <div className="relative w-full h-40 sm:h-48 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 shadow-inner">
                                                <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-green-200 to-green-400"></div>
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
                                                    <div className="bg-red-500 text-white rounded-full p-1.5 sm:p-2 shadow-lg animate-bounce text-sm sm:text-base">
                                                        📍
                                                    </div>
                                                    <div className="w-3 sm:w-4 h-1 bg-black/30 rounded-full blur-sm"></div>
                                                </div>
                                            </div>
                                            <div className="flex items-start mt-2">
                                                <div className="flex h-5 items-center">
                                                    <input 
                                                        id="location-confirm" 
                                                        type="checkbox" 
                                                        checked={locationConfirmed} 
                                                        onChange={e => setLocationConfirmed(e.target.checked)} 
                                                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 dark:bg-slate-900 dark:border-slate-600" 
                                                    />
                                                </div>
                                                <div className="ml-2 sm:ml-3 text-xs sm:text-sm">
                                                    <label htmlFor="location-confirm" className="font-medium text-slate-700 dark:text-slate-200">Is this correct?</label>
                                                    <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs">Confirm this is your farm's location.</p>
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
                        <div className="space-y-4 sm:space-y-8 animate-fadeIn">
                            <div className="text-center space-y-1 sm:space-y-2 mb-4 sm:mb-8">
                                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">Farming Details</h2>
                                <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400">Tell us about your land and crops.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
                                <div className="p-4 sm:p-8 space-y-5 sm:space-y-8">
                                    
                                    <div className="space-y-2 sm:space-y-3">
                                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Total Land Size</label>
                                        <div className="flex rounded-md shadow-sm">
                                            <input 
                                                type="number" 
                                                value={landSize} 
                                                onChange={e => setLandSize(e.target.value)} 
                                                className="block w-full min-w-0 flex-1 rounded-none rounded-l-md border-slate-300 py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:ring-green-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                                                placeholder="e.g. 5.5" 
                                            />
                                            <select 
                                                value={landUnit}
                                                onChange={e => setLandUnit(e.target.value)}
                                                className="relative inline-flex items-center rounded-r-md border border-l-0 border-slate-300 bg-slate-100 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-200 focus:z-10 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                            >
                                                <option>Acres</option><option>Hectares</option><option>Bigha</option><option>Guntha</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2 sm:space-y-3">
                                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Land Type</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                                            {[
                                                { id: 'Irrigated', icon: '💧', color: 'bg-blue-100 text-blue-600', desc: 'Water source available.' },
                                                { id: 'Rainfed', icon: '☁️', color: 'bg-amber-100 text-amber-600', desc: 'Dependent on rainfall.' },
                                                { id: 'Mixed', icon: '🌊', color: 'bg-purple-100 text-purple-600', desc: 'Both types used.' }
                                            ].map((type) => (
                                                <label key={type.id} className="cursor-pointer group relative">
                                                    <input 
                                                        type="radio" 
                                                        name="land-type" 
                                                        className="peer sr-only"
                                                        checked={landType === type.id}
                                                        onChange={() => setLandType(type.id as any)}
                                                    />
                                                    <div className="rounded-lg border-2 border-slate-200 dark:border-slate-600 p-3 sm:p-4 hover:border-green-500 peer-checked:border-green-500 peer-checked:bg-green-50/10 transition-all h-full">
                                                        <div className="flex items-center justify-between mb-1 sm:mb-2">
                                                            <div className={`p-1.5 sm:p-2 rounded-lg text-sm sm:text-base ${type.color}`}>{type.icon}</div>
                                                            <span className="text-green-500 opacity-0 peer-checked:opacity-100 transition-opacity text-sm sm:text-base">✓</span>
                                                        </div>
                                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{type.id}</h3>
                                                        <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{type.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2 sm:space-y-3">
                                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Crops Cultivated</label>
                                        <div className="relative mb-2 sm:mb-3">
                                            <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
                                                <span className="text-slate-400 text-sm sm:text-base">🔍</span>
                                            </div>
                                            <input 
                                                type="text" 
                                                value={cropInput}
                                                onChange={e => setCropInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && cropInput && addCrop(cropInput)}
                                                className="block w-full pl-8 sm:pl-10 rounded-md border-slate-300 py-2 sm:py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:ring-green-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                                                placeholder="Search crops..." 
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                            {selectedCrops.map(crop => (
                                                <button key={crop} type="button" onClick={() => removeCrop(crop)} className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-green-900 dark:text-green-300 hover:bg-green-200 border border-green-500 transition-colors">
                                                    <span>{crop}</span>
                                                    <span className="text-xs sm:text-sm">✕</span>
                                                </button>
                                            ))}
                                            {/* Crop Suggestions with Images - Mobile Optimized */}
                                            {CROPS_DATA.filter(c => !selectedCrops.includes(c.name)).slice(0, 6).map(c => (
                                                <button 
                                                    key={c.name} 
                                                    type="button" 
                                                    onClick={() => addCrop(c.name)} 
                                                    className="group inline-flex items-center gap-1 sm:gap-2 rounded-full bg-slate-100 dark:bg-slate-700 pl-0.5 sm:pl-1 pr-2 sm:pr-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                                >
                                                    <img src={c.image} alt={c.name} className="size-5 sm:size-6 rounded-full object-cover" />
                                                    <span className="hidden xs:inline">{c.name}</span>
                                                    <span className="inline xs:hidden">{c.name.split(' ')[0]}</span>
                                                    <span className="text-xs sm:text-sm group-hover:scale-110 transition-transform">+</span>
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-slate-400 mt-2">Can't find your crop? <a href="#" className="text-green-600 hover:underline">Add manually</a></p>
                                    </div>

                                    <div className="space-y-2 sm:space-y-3">
                                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">Farming Method</label>
                                        <div className="space-y-2">
                                            {['Organic Farming', 'Conventional (Chemical) Farming', 'Transitioning'].map((m) => (
                                                <div key={m} className="flex items-center">
                                                    <input 
                                                        id={m}
                                                        type="radio" 
                                                        name="farmingMethod" 
                                                        checked={farmingMethod === m} 
                                                        onChange={() => setFarmingMethod(m)} 
                                                        className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-slate-300 text-green-600 focus:ring-green-500 dark:bg-slate-700 dark:border-slate-600" 
                                                    />
                                                    <label htmlFor={m} className="ml-2 sm:ml-3 block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">{m}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: CONSENT */}
                    {step === 4 && (
                        <div className="space-y-4 sm:space-y-8 animate-fadeIn">
                            <div className="text-center space-y-1 sm:space-y-2 mb-4 sm:mb-8">
                                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">Consent & Permissions</h2>
                                <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400">Final step! Review permissions.</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                                <div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
                                <div className="p-4 sm:p-8 space-y-5 sm:space-y-8">
                                    
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg flex items-start gap-2 sm:gap-3 border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs sm:text-sm">
                                        <span className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400 text-sm sm:text-base">ℹ️</span>
                                        <p>We respect your data privacy. Your farming data is only used to provide personalized advisories.</p>
                                    </div>

                                    <div className="space-y-3 sm:space-y-4">
                                        {[
                                            { id: 'ai', icon: '🧠', color: 'bg-purple-100 text-purple-600', title: 'AI Crop Analysis', desc: 'Analyze crop images for disease detection.', req: true },
                                            { id: 'location', icon: '📍', color: 'bg-amber-100 text-amber-600', title: 'Location Services', desc: 'For local weather forecasts.', req: true },
                                            { id: 'voice', icon: '🎤', color: 'bg-red-100 text-red-600', title: 'Voice Interaction', desc: 'Talk to AI in your language.', req: false },
                                            { id: 'camera', icon: '📷', color: 'bg-indigo-100 text-indigo-600', title: 'Camera Access', desc: 'Take photos of crops.', req: false },
                                        ].map((p) => (
                                            <label key={p.id} className="block cursor-pointer group">
                                                <input 
                                                    type="checkbox" 
                                                    className="peer sr-only"
                                                    checked={permissions[p.id as keyof typeof permissions]} 
                                                    onChange={e => setPermissions({...permissions, [p.id]: e.target.checked})}
                                                    disabled={p.req}
                                                />
                                                <div className="flex items-start gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-green-500/50 transition-all bg-white dark:bg-slate-800/50 peer-checked:border-green-500 peer-checked:bg-green-50/5">
                                                    <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 text-sm sm:text-base ${p.color}`}>
                                                        {p.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1 sm:gap-2 flex-wrap">
                                                            <span>{p.title}</span>
                                                            {p.req && <span className="bg-slate-100 dark:bg-slate-700 text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded text-slate-500 font-medium uppercase">Required</span>}
                                                        </h4>
                                                        <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">{p.desc}</p>
                                                    </div>
                                                    <div className={`size-5 sm:size-6 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${permissions[p.id as keyof typeof permissions] ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {permissions[p.id as keyof typeof permissions] && <span className="text-white text-xs sm:text-sm">✓</span>}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                        <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group">
                                            <input type="checkbox" className="peer sr-only" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} />
                                            <div className={`mt-0.5 size-4 sm:size-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${agreedToTerms ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                <span className={`text-white text-[10px] sm:text-xs ${agreedToTerms ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                                            </div>
                                            <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 select-none">
                                                I agree to the <a href="#" className="text-green-600 font-medium hover:underline">Terms</a> and <a href="#" className="text-green-600 font-medium hover:underline">Privacy Policy</a> of Fasal Rakshak.
                                            </span>
                                        </label>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* Footer Buttons - Mobile Optimized */}
            <div className="p-3 sm:p-4 bg-white dark:bg-[#1c2e22] border-t border-slate-200 dark:border-slate-800 z-50 fixed bottom-0 w-full flex justify-between items-center gap-2 sm:gap-4">
                <button 
                    onClick={handleBack}
                    disabled={step === 1}
                    className={`inline-flex items-center px-3 sm:px-4 py-2 border border-slate-300 dark:border-slate-600 shadow-sm text-sm sm:text-base font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-opacity ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                >
                    ← <span className="hidden xs:inline ml-1">Back</span>
                </button>
                
                <button 
                    onClick={step === 4 ? handleFinish : handleNext}
                    disabled={(step === 4 && !agreedToTerms) || loading}
                    className="inline-flex items-center px-4 sm:px-6 py-2 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-black bg-green-500 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex-1 sm:flex-initial sm:w-40 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span>Processing...</span>
                    ) : (
                        <>
                            {step === 4 ? 'Complete & Start' : 'Next'} {step === 4 ? '✓' : '→'}
                        </>
                    )}
                </button>
            </div>

            {/* Voice Fab - Mobile Optimized */}
            <div className="fixed bottom-16 sm:bottom-24 right-3 sm:right-6 z-40">
                <button className="flex items-center justify-center size-12 sm:size-14 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-slate-300 dark:bg-white dark:text-slate-900 text-xl sm:text-2xl">
                    🎤
                </button>
            </div>

        </div>
    );
};

// Demo Component
export default function App() {
    const [user, setUser] = useState<User>({
        id: '1',
        name: 'Rajesh Kumar',
        phone: '+91 98765 43210',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=farmer',
        role: 'farmer',
        preferred_languages: ['en'],
        crops_grown: []
    });

    const handleComplete = (updatedUser: User) => {
        setUser(updatedUser);
        alert('Onboarding Complete! Welcome to Fasal Rakshak 🌾');
    };

    return <OnboardingWizard user={user} onComplete={handleComplete} />;
}