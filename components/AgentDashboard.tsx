
import React, { useState, useEffect, useRef } from 'react';
import { User, MandiDetails } from '../types';
import { updateUserProfile } from '../services/authService';
import { submitMandiPrice, getAgentHistory, getMasterMandiList } from '../services/agroService';
import { findMandis } from '../services/geminiService';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge } from './ui/Shadcn';
import { LoadingScreen } from './ui/LoadingScreen';
import Chart from 'chart.js/auto';

interface AgentDashboardProps {
    user: User;
    onLogout: () => void;
    onUserUpdate: (user: User) => void;
}

type AgentView = 'overview' | 'entries' | 'new-entry' | 'settings' | 'onboarding';

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ user, onLogout, onUserUpdate }) => {
    // --- STATE ---
    const [view, setView] = useState<AgentView>('overview');
    const [loading, setLoading] = useState(false);
    
    // Onboarding
    const [locPermission, setLocPermission] = useState(false);
    const [nearbyMandis, setNearbyMandis] = useState<MandiDetails[]>([]);
    const [manualMandiName, setManualMandiName] = useState("");
    const [masterMandiList, setMasterMandiList] = useState<string[]>([]);
    
    // Data
    const [history, setHistory] = useState<any[]>([]);
    const [todayCount, setTodayCount] = useState(0);
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    // New Entry Form State
    const [selectedCrop, setSelectedCrop] = useState("Rice"); // Default Odisha Crop
    const [selectedGrade, setSelectedGrade] = useState("A");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [modalPrice, setModalPrice] = useState("");
    const [quantity, setQuantity] = useState("");
    const [qtyUnit, setQtyUnit] = useState("Quintal");
    
    // AI Alert State
    const [showAiAlert, setShowAiAlert] = useState(false);
    const [priceDeviation, setPriceDeviation] = useState(0);
    const [confirmOverride, setConfirmOverride] = useState(false);

    // Initial Load
    useEffect(() => {
        if (!user.assigned_mandi) {
            // Load Master List for Autocomplete to prevent fragmentation
            getMasterMandiList().then(setMasterMandiList);
            
            // Default nearby mandis for Odisha context if location fails
            setNearbyMandis([
                { name: "Unit-1 Market, Bhubaneswar", address: "Bapuji Nagar, Bhubaneswar", location: { lat: 20.27, lon: 85.83 } },
                { name: "Cuttack Malgodown", address: "Malgodown, Cuttack", location: { lat: 20.46, lon: 85.89 } }
            ]);
            setView('onboarding');
        } else {
            loadHistory();
        }
    }, [user]);

    // Chart Effect for Overview
    useEffect(() => {
        if (view === 'overview' && chartRef.current) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                // Create Gradient
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(13, 242, 89, 0.2)');
                gradient.addColorStop(1, 'rgba(13, 242, 89, 0)');

                chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [
                            {
                                label: 'Rice',
                                data: [2100, 2120, 2080, 2150, 2200, 2180, 2210],
                                borderColor: '#0df259',
                                backgroundColor: gradient,
                                fill: true,
                                tension: 0.4,
                                borderWidth: 3,
                                pointRadius: 0,
                                pointHoverRadius: 6
                            },
                            {
                                label: 'Brinjal',
                                data: [1500, 1550, 1400, 1450, 1600, 1580, 1620],
                                borderColor: '#9ca3af',
                                borderDash: [5, 5],
                                borderWidth: 2,
                                tension: 0.4,
                                pointRadius: 0,
                                fill: false
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { family: 'Space Grotesk' } } },
                            y: { display: false }
                        },
                        interaction: { mode: 'index', intersect: false }
                    }
                });
            }
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [view]);

    // Price Check Logic
    useEffect(() => {
        if (modalPrice) {
            const price = parseFloat(modalPrice);
            const avg = 2200; // Mock district average
            if (price > avg * 1.15) {
                setPriceDeviation(Math.round(((price - avg) / avg) * 100));
                setShowAiAlert(true);
            } else {
                setShowAiAlert(false);
                setConfirmOverride(false);
            }
        }
    }, [modalPrice]);

    const loadHistory = async () => {
        const data = await getAgentHistory(user.id);
        setHistory(data);
        const today = new Date().toDateString();
        setTodayCount(data.filter((d: any) => new Date(d.timestamp).toDateString() === today).length);
    };

    const handleGetLocation = () => {
        setLoading(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                setLocPermission(true);
                const results = await findMandis(latitude, longitude);
                // Merge with Bhubaneswar defaults if results are scant (common in dev/testing)
                const odishaDefaults = [
                    { name: "Unit-1 Market, Bhubaneswar", address: "Bapuji Nagar, Bhubaneswar", location: { lat: 20.27, lon: 85.83 } },
                    { name: "Cuttack Malgodown", address: "Malgodown, Cuttack", location: { lat: 20.46, lon: 85.89 } }
                ];
                setNearbyMandis([...results, ...odishaDefaults]);
                setLoading(false);
            }, () => {
                alert("Location access needed. Showing default Odisha markets.");
                setLoading(false);
            });
        }
    };

    const handleSelectMandi = async (mandi: MandiDetails) => {
        setLoading(true);
        const updated = await updateUserProfile(user.id, { 
            assigned_mandi: mandi,
            location: mandi.location ? { lat: mandi.location.lat, lon: mandi.location.lon, district: "Bhubaneswar", state: "Odisha" } : undefined
        });
        onUserUpdate(updated);
        setView('overview');
        setLoading(false);
    };

    const handleSubmitPrice = async () => {
        if (!modalPrice) return alert("Enter price");
        
        // Critical: Prevent submission if deviation is high and not overridden
        if (showAiAlert && !confirmOverride) {
            alert("Price deviation is too high. Please check 'Override AI Alert' to proceed with submission.");
            return;
        }

        setLoading(true);
        
        // This function persists to Supabase (and local storage fallback)
        await submitMandiPrice(user.id, user.assigned_mandi?.name || "Bhubaneswar APMC", {
            crop: selectedCrop,
            variety: selectedGrade,
            minPrice, maxPrice, modalPrice, quantity
        });
        
        // Reset
        setModalPrice(""); setMinPrice(""); setMaxPrice(""); setQuantity("");
        setConfirmOverride(false);
        await loadHistory();
        setView('entries');
        setLoading(false);
    };

    // --- SUB-COMPONENTS ---

    const Sidebar = () => (
        <aside className="hidden lg:flex w-72 flex-col bg-white dark:bg-[#1c2e22] border-r border-gray-200 dark:border-gray-800 p-6 h-full justify-between">
            <div>
                <div className="flex gap-3 items-center px-2 mb-8">
                    <div className="size-10 bg-agent-green rounded-full flex items-center justify-center text-agent-dark font-bold text-xl">FR</div>
                    <div>
                        <h1 className="text-lg font-bold font-display text-gray-900 dark:text-white leading-tight">Fasal Rakshak</h1>
                        <p className="text-xs text-gray-500 font-medium">Agent Portal</p>
                    </div>
                </div>
                <nav className="flex flex-col gap-2">
                    {[
                        { id: 'overview', icon: 'dashboard', label: 'Dashboard' },
                        { id: 'entries', icon: 'history', label: 'Transaction History' },
                        { id: 'new-entry', icon: 'add_circle', label: 'New Price Entry' },
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setView(item.id as AgentView)}
                            className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all text-left group ${view === item.id ? 'bg-agent-green text-black shadow-lg shadow-green-500/20' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
                        >
                            <span className={`material-symbols-outlined ${view === item.id ? 'fill-1' : ''}`}>{item.icon}</span>
                            <span className="text-sm font-bold">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="bg-gray-50 dark:bg-[#102216] p-4 rounded-xl flex items-center gap-3 border border-gray-200 dark:border-gray-700">
                <div className="size-10 rounded-full bg-gray-300 overflow-hidden">
                    <img src={user.avatar} className="w-full h-full object-cover" />
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-agent-green truncate">Verified Agent</p>
                </div>
            </div>
        </aside>
    );

    const TopBar = ({ title }: { title: string }) => (
        <header className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-[#1c2e22]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
            <div className="lg:hidden flex items-center gap-3">
                <button className="material-symbols-outlined text-gray-600 dark:text-gray-300">menu</button>
                <span className="font-bold text-lg dark:text-white">Fasal Rakshak</span>
            </div>
            <div className="hidden lg:block">
                <h2 className="text-xl font-bold font-display text-gray-900 dark:text-white">{title}</h2>
            </div>
            <div className="flex items-center gap-3">
                <button className="h-10 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-bold flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-white">
                    <span className="material-symbols-outlined text-lg">language</span>
                    <span className="hidden sm:inline">Hindi / Odia / English</span>
                </button>
                <button onClick={onLogout} className="size-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                    <span className="material-symbols-outlined text-lg">logout</span>
                </button>
            </div>
        </header>
    );

    // --- SCREENS ---

    if (view === 'onboarding') {
        return (
            <div className="fixed inset-0 bg-[#f5f8f6] dark:bg-[#102216] flex items-center justify-center p-4 font-display">
                <div className="max-w-md w-full bg-white dark:bg-[#1c2e22] rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="bg-agent-green p-8 text-center">
                        <div className="size-16 bg-black/10 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📍</div>
                        <h2 className="text-2xl font-bold text-black">Select Your Mandi</h2>
                        <p className="text-black/70 text-sm mt-2">Assign yourself to a market to start.</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {nearbyMandis.length > 0 ? nearbyMandis.map((m, i) => (
                                <button key={i} onClick={() => handleSelectMandi(m)} className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-agent-green hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
                                    <div className="font-bold text-gray-900 dark:text-white">{m.name}</div>
                                    <div className="text-xs text-gray-500">{m.address}</div>
                                </button>
                            )) : (
                                <div className="text-center py-4 text-gray-500">Loading nearby mandis...</div>
                            )}
                        </div>
                        <div className="relative">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Or Find Existing Mandi</label>
                            <Input 
                                list="mandi-suggestions" 
                                placeholder="Search Mandi Name..." 
                                value={manualMandiName} 
                                onChange={e => setManualMandiName(e.target.value)} 
                                className="bg-gray-50 dark:bg-gray-800 border-none h-12" 
                            />
                            <datalist id="mandi-suggestions">
                                {masterMandiList.map((m, i) => <option key={i} value={m} />)}
                            </datalist>
                        </div>
                        
                        {manualMandiName && <Button onClick={() => handleSelectMandi({ name: manualMandiName, address: 'Manual Entry' })} className="w-full bg-black text-white">Save Manual</Button>}
                        <Button onClick={handleGetLocation} variant="outline" className="w-full">Detect Location</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#f5f8f6] dark:bg-[#102216] font-body text-gray-900 dark:text-white transition-colors">
            <Sidebar />
            
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                
                {/* --- DASHBOARD VIEW --- */}
                {view === 'overview' && (
                    <>
                    <TopBar title="Overview" />
                    <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                            <div>
                                <h1 className="text-4xl font-bold font-display tracking-tight">Namaste, {user.name.split(' ')[0]}.</h1>
                                <p className="text-gray-500 dark:text-gray-400 text-lg mt-1">Here is your mandi update for <span className="text-agent-green font-bold">Today</span>.</p>
                            </div>
                            <Button onClick={() => setView('new-entry')} className="bg-agent-green text-black hover:bg-green-400 font-bold px-6 h-12 rounded-xl shadow-lg shadow-green-500/20 flex items-center gap-2">
                                <span className="material-symbols-outlined">add</span> New Entry
                            </Button>
                        </div>

                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-[#1c2e22] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500"><span className="material-symbols-outlined">inventory_2</span></div>
                                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">+12%</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Total Entries Today</p>
                                    <p className="text-4xl font-bold font-display mt-1">{todayCount}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#1c2e22] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between h-40">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500"><span className="material-symbols-outlined">verified_user</span></div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Verified Entries</p>
                                    <div className="flex items-end gap-3 mt-1">
                                        <p className="text-4xl font-bold font-display">{Math.round(todayCount * 0.8)}</p>
                                        <div className="w-24 h-1.5 bg-gray-200 rounded-full mb-2 overflow-hidden"><div className="h-full bg-agent-green w-[80%]"></div></div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#1c2e22] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between h-40 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-1 bg-orange-100 rounded-bl-xl"><span className="material-symbols-outlined text-orange-500 text-sm">priority_high</span></div>
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 w-fit"><span className="material-symbols-outlined">pending_actions</span></div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Pending Reviews</p>
                                    <p className="text-4xl font-bold font-display mt-1">5</p>
                                    <p className="text-xs text-orange-500 font-bold mt-1">Requires action</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#1c2e22] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between h-40">
                                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 w-fit"><span className="material-symbols-outlined">stars</span></div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Reputation Score</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <p className="text-4xl font-bold font-display">4.8</p>
                                        <div className="flex text-yellow-400 text-sm"><span className="material-symbols-outlined fill-1 text-sm">star</span><span className="material-symbols-outlined fill-1 text-sm">star</span><span className="material-symbols-outlined fill-1 text-sm">star</span><span className="material-symbols-outlined fill-1 text-sm">star</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-2 bg-white dark:bg-[#1c2e22] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold">Local Mandi Price Trends</h3>
                                        <p className="text-sm text-gray-500">Rice vs Brinjal (Last 7 Days)</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold font-display">₹2,200<span className="text-sm text-gray-400 font-normal">/Qtl</span></p>
                                    </div>
                                </div>
                                <div className="h-64 w-full">
                                    <canvas ref={chartRef}></canvas>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-[#1c2e22] p-6 rounded-3xl border border-gray-200 dark:border-gray-800">
                                    <h3 className="font-bold mb-4">Quick Actions</h3>
                                    <div className="space-y-2">
                                        <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <div className="size-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><span className="material-symbols-outlined text-sm">person_add</span></div>
                                            <span className="text-sm font-bold">Register New Farmer</span>
                                        </button>
                                        <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <div className="size-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><span className="material-symbols-outlined text-sm">price_change</span></div>
                                            <span className="text-sm font-bold">Update Daily Rates</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </>
                )}

                {/* --- TRANSACTION HISTORY VIEW --- */}
                {view === 'entries' && (
                    <>
                    <TopBar title="Transaction History" />
                    <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-7xl mx-auto w-full">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h1 className="text-3xl font-bold font-display">Transaction History</h1>
                                <p className="text-gray-500 mt-1">View and manage past mandi transactions.</p>
                            </div>
                            <Button className="bg-agent-green text-black hover:bg-green-400 font-bold gap-2">
                                <span className="material-symbols-outlined">download</span> Export Report
                            </Button>
                        </div>

                        {/* Filter Bar */}
                        <div className="bg-white dark:bg-[#1c2e22] p-4 rounded-xl border border-gray-200 dark:border-gray-800 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2 relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                                <input placeholder="Search by crop, ID..." className="w-full h-11 pl-10 pr-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:border-agent-green" />
                            </div>
                            <select className="h-11 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none">
                                <option>All Status</option>
                                <option>Approved</option>
                                <option>Pending</option>
                            </select>
                            <input type="date" className="h-11 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none text-gray-500" />
                        </div>

                        {/* Table */}
                        <div className="bg-white dark:bg-[#1c2e22] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase text-gray-500 border-b border-gray-200 dark:border-gray-800">
                                        <tr>
                                            <th className="p-4 w-32">Date</th>
                                            <th className="p-4">Crop Name</th>
                                            <th className="p-4 text-right">Quantity</th>
                                            <th className="p-4 text-right">Price (₹)</th>
                                            <th className="p-4 text-center">Status</th>
                                            <th className="p-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                                        {history.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-gray-500">No transactions found.</td></tr>
                                        ) : history.map((item, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                                <td className="p-4 font-medium text-gray-900 dark:text-white">{new Date(item.timestamp).toLocaleDateString()}</td>
                                                <td className="p-4 font-bold">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center text-yellow-700 dark:text-yellow-400 text-xs font-bold border border-yellow-200 dark:border-yellow-800">{item.crop[0]}</div>
                                                        {item.crop} <span className="font-normal text-gray-400 text-xs">({item.variety || 'Std'})</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">{item.quantity} Qtl</td>
                                                <td className="p-4 text-right font-bold text-gray-900 dark:text-white">₹{item.modalPrice}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${item.status === 'Verified' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                        <span className={`size-1.5 rounded-full ${item.status === 'Verified' ? 'bg-green-600' : 'bg-orange-500 animate-pulse'}`}></span>
                                                        {item.status === 'Verified' ? 'Approved' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button className="text-gray-400 hover:text-black dark:hover:text-white"><span className="material-symbols-outlined text-lg">more_vert</span></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-sm text-gray-500">
                                <p>Showing 1-10 of {history.length} results</p>
                                <div className="flex gap-2">
                                    <button className="size-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                                    <button className="size-8 flex items-center justify-center rounded-lg bg-agent-green text-black font-bold">1</button>
                                    <button className="size-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                                </div>
                            </div>
                        </div>
                    </div>
                    </>
                )}

                {/* --- NEW ENTRY VIEW --- */}
                {view === 'new-entry' && (
                    <>
                    <TopBar title="Daily Price Entry" />
                    <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* Left: Form */}
                        <div className="lg:col-span-8 flex flex-col gap-6">
                            <div className="bg-white dark:bg-[#1c2e22] p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold font-display">Daily Price Entry</h2>
                                    <p className="text-gray-500">Submit market rates for verification.</p>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs text-gray-500">Date</p>
                                    <p className="font-bold">{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#1c2e22] p-8 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-8">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-500 uppercase">Select Mandi</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">storefront</span>
                                            <input disabled value={user.assigned_mandi?.name} className="w-full h-12 pl-11 pr-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg font-bold" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-500 uppercase">Select Crop</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">grass</span>
                                            <select 
                                                value={selectedCrop}
                                                onChange={e => setSelectedCrop(e.target.value)}
                                                className="w-full h-12 pl-11 pr-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-agent-green appearance-none cursor-pointer"
                                            >
                                                {["Rice", "Brinjal", "Tomato", "Pointed Gourd", "Wheat", "Mustard", "Green Chilli"].map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-500 uppercase">Quality Grade</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {['A', 'B', 'C'].map(g => (
                                            <div 
                                                key={g} 
                                                onClick={() => setSelectedGrade(g)}
                                                className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${selectedGrade === g ? 'border-agent-green bg-green-50 dark:bg-green-900/20 ring-1 ring-agent-green' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                            >
                                                <span className="font-bold text-lg">Grade {g}</span>
                                                <span className="text-xs text-gray-500">{g === 'A' ? 'Premium' : g === 'B' ? 'Standard' : 'Fair'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-500 uppercase">Market Prices (₹/Quintal)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="relative">
                                            <p className="text-xs text-gray-400 mb-1">Minimum</p>
                                            <span className="absolute left-3 top-8 text-gray-400">₹</span>
                                            <input type="number" placeholder="0000" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-full h-12 pl-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-agent-green font-mono font-bold" />
                                        </div>
                                        <div className="relative">
                                            <p className="text-xs text-gray-400 mb-1">Maximum</p>
                                            <span className="absolute left-3 top-8 text-gray-400">₹</span>
                                            <input type="number" placeholder="0000" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-full h-12 pl-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-agent-green font-mono font-bold" />
                                        </div>
                                        <div className="relative">
                                            <p className="text-xs text-gray-400 mb-1">Modal (Avg)</p>
                                            <span className="absolute left-3 top-8 text-gray-400">₹</span>
                                            <input type="number" placeholder="0000" value={modalPrice} onChange={e => setModalPrice(e.target.value)} className={`w-full h-12 pl-8 rounded-lg outline-none font-mono font-bold border ${showAiAlert ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-400 focus:border-yellow-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-agent-green'}`} />
                                            {showAiAlert && <span className="material-symbols-outlined absolute right-3 top-8 text-yellow-500 animate-pulse" title="AI Verification Alert">warning</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-500 uppercase">Arrival Qty</label>
                                        <div className="flex">
                                            <input type="number" placeholder="e.g. 50" value={quantity} onChange={e => setQuantity(e.target.value)} className="flex-1 h-12 pl-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-l-lg outline-none focus:border-agent-green" />
                                            <select className="h-12 bg-gray-50 dark:bg-gray-800 border-y border-r border-gray-200 dark:border-gray-700 rounded-r-lg px-3 text-sm font-bold outline-none">
                                                <option>Quintal</option>
                                                <option>Kg</option>
                                                <option>Ton</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-500 uppercase">Proof</label>
                                        <div className="h-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <span className="material-symbols-outlined text-gray-400">cloud_upload</span>
                                            <span className="text-sm text-gray-500">Upload Bill</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                                    <Button onClick={handleSubmitPrice} disabled={loading} className="px-8 h-12 bg-agent-green text-black hover:bg-green-400 font-bold rounded-lg shadow-lg shadow-green-500/20 flex items-center gap-2">
                                        {loading ? 'Submitting...' : <><span className="material-symbols-outlined">send</span> Submit Entry</>}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Right: AI Context */}
                        <div className="lg:col-span-4 flex flex-col gap-6">
                            {showAiAlert && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-400 rounded-xl p-5 shadow-sm animate-bounce-in">
                                    <div className="flex gap-3 items-start">
                                        <div className="bg-yellow-100 p-2 rounded-full text-yellow-700 shrink-0"><span className="material-symbols-outlined">smart_toy</span></div>
                                        <div>
                                            <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-500">AI Verification Alert</h3>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">Entered price <span className="font-mono font-bold">₹{modalPrice}</span> is <span className="font-bold text-red-500">{priceDeviation}% higher</span> than district average.</p>
                                            <div className="mt-4 bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm">
                                                <div className="flex justify-between mb-1"><span>District Avg:</span> <span className="font-mono font-bold">₹2,200</span></div>
                                                <div className="flex justify-between"><span>Your Last:</span> <span className="font-mono font-bold">₹2,100</span></div>
                                            </div>
                                            <div className="flex gap-2 mt-4 items-center">
                                                <input 
                                                    type="checkbox" 
                                                    id="overrideCheck" 
                                                    className="w-5 h-5 accent-yellow-600 rounded"
                                                    checked={confirmOverride}
                                                    onChange={e => setConfirmOverride(e.target.checked)}
                                                />
                                                <label htmlFor="overrideCheck" className="text-xs font-bold text-yellow-800 dark:text-yellow-500 cursor-pointer">Override AI Alert & Submit</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white dark:bg-[#1c2e22] p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-gray-400">history</span> Recent Entries</h3>
                                <div className="space-y-4">
                                    {history.slice(0, 3).map((h, i) => (
                                        <div key={i} className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-bold">{h.crop}</p>
                                                <p className="text-xs text-gray-500">Grade {h.variety || 'A'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold">₹{h.modalPrice}</p>
                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase">Verified</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setView('entries')} className="w-full mt-4 text-agent-green font-bold text-sm hover:underline">View All History</button>
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-xl border border-green-200 dark:border-green-900">
                                <div className="flex gap-3">
                                    <span className="material-symbols-outlined text-green-600">support_agent</span>
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">Need help?</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Use voice commands like:<br/><span className="italic font-medium">"Enter Rice Grade A price 2400"</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </>
                )}

            </div>
        </div>
    );
};
