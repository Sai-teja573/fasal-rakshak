
import React, { useState, useEffect, useRef } from 'react';
import { User, TransportJob, DriverDetails } from '../types';
import { getAvailableJobs, acceptJob, updateJobStatus, getMyDriverTrips, getDriverStats, negotiateJob } from '../services/transportService';
import { Button, Input, Card, CardContent } from './ui/Shadcn';
import { LoadingScreen } from './ui/LoadingScreen';
import { OnboardingWizard } from './OnboardingWizard';
import Chart from 'chart.js/auto';
import { AnimatePresence, motion } from 'framer-motion';

interface DriverDashboardProps {
    user: User;
    onLogout: () => void;
}

type DriverView = 'dashboard' | 'trips' | 'my_trips' | 'earnings' | 'profile' | 'settings' | 'negotiation';

interface ChatMessage {
    id: number;
    sender: 'me' | 'farmer' | 'system';
    type: 'text' | 'offer' | 'accept' | 'reject';
    text?: string;
    price?: number;
    timestamp: number;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ user, onLogout }) => {
    const [view, setView] = useState<DriverView>('dashboard');
    const [jobs, setJobs] = useState<TransportJob[]>([]);
    const [myTrips, setMyTrips] = useState<TransportJob[]>([]);
    const [activeTrip, setActiveTrip] = useState<TransportJob | null>(null);
    const [negotiatingJob, setNegotiatingJob] = useState<TransportJob | null>(null);
    const [stats, setStats] = useState({ totalEarnings: 0, completedTrips: 0, activeTrips: 0 });
    const [loading, setLoading] = useState(false);
    const [showKycModal, setShowKycModal] = useState(false);
    
    // Negotiation Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [currentOffer, setCurrentOffer] = useState(0);
    const [showPriceInput, setShowPriceInput] = useState(false);
    const [newPrice, setNewPrice] = useState("");
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Profile Edit State
    const [editProfile, setEditProfile] = useState(false);
    
    // Sidebar/Mobile state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Scroll to bottom of chat
    useEffect(() => {
        if (view === 'negotiation' && chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, view]);

    // Load Charts for Earnings
    useEffect(() => {
        if (view === 'earnings' && chartRef.current) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                if (chartInstance.current) chartInstance.current.destroy();
                chartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                            label: 'Daily Earnings (₹)',
                            data: [1200, 2500, 800, 3200, 1500, 4000, 2200],
                            backgroundColor: '#7ae830',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [view]);

    const loadData = async () => {
        setLoading(true);
        try {
            const available = await getAvailableJobs();
            setJobs(available);
            
            const trips = await getMyDriverTrips(user.id);
            setMyTrips(trips);
            
            const ongoing = trips.find(t => t.status === 'Accepted' || t.status === 'In-Transit');
            setActiveTrip(ongoing || null);

            const drvStats = await getDriverStats(user.id);
            setStats(drvStats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptJob = async (job: TransportJob, finalPrice?: number) => {
        setLoading(true);
        // If negotiating, update the price
        if (finalPrice && job.id === negotiatingJob?.id) {
            // Update local job state (in real app, API call)
            job.offeredPrice = finalPrice;
        }
        
        await acceptJob(job.id, user.id);
        setActiveTrip({ ...job, status: 'Accepted' });
        setView('dashboard');
        loadData(); 
    };

    const handleUpdateStatus = async (status: TransportJob['status']) => {
        if (!activeTrip) return;
        await updateJobStatus(activeTrip.id, status);
        if (status === 'Completed') {
            setActiveTrip(null);
            loadData();
            alert("Trip Completed! Payment marked as received.");
        } else {
            setActiveTrip({ ...activeTrip, status });
        }
    };

    // --- NEGOTIATION LOGIC ---

    const openNegotiation = (job: TransportJob) => {
        setNegotiatingJob(job);
        setCurrentOffer(job.offeredPrice);
        setChatMessages([
            { id: 1, sender: 'system', type: 'text', text: `Negotiation started for ${job.crop} transport from ${job.pickupLocation}.`, timestamp: Date.now() },
            { id: 2, sender: 'farmer', type: 'text', text: "Namaste! I need this transported urgently.", timestamp: Date.now() + 100 },
            { id: 3, sender: 'farmer', type: 'offer', price: job.offeredPrice, timestamp: Date.now() + 200 }
        ]);
        setView('negotiation');
    };

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        const newMsg: ChatMessage = { id: Date.now(), sender: 'me', type: 'text', text: chatInput, timestamp: Date.now() };
        setChatMessages(prev => [...prev, newMsg]);
        setChatInput("");

        // Simulate Farmer Response
        setTimeout(() => {
            const reply: ChatMessage = { 
                id: Date.now(), 
                sender: 'farmer', 
                type: 'text', 
                text: "Can you give me a better rate?", 
                timestamp: Date.now() 
            };
            setChatMessages(prev => [...prev, reply]);
        }, 1500);
    };

    const handleProposePrice = () => {
        if (!newPrice || isNaN(Number(newPrice)) || !negotiatingJob) return;
        const price = parseFloat(newPrice);
        const newMsg: ChatMessage = { id: Date.now(), sender: 'me', type: 'offer', price, timestamp: Date.now() };
        setChatMessages(prev => [...prev, newMsg]);
        setShowPriceInput(false);
        setNewPrice("");

        // Simulate Negotiation Logic
        setTimeout(() => {
            const originalPrice = negotiatingJob.offeredPrice;
            const maxAcceptable = originalPrice * 1.15; // Farmer accepts up to 15% more
            
            if (price <= maxAcceptable) {
                // Accept
                const acceptMsg: ChatMessage = { id: Date.now(), sender: 'farmer', type: 'accept', price, timestamp: Date.now() };
                setChatMessages(prev => [...prev, acceptMsg]);
                setCurrentOffer(price);
            } else {
                // Counter
                const counter = Math.floor(price * 0.9);
                const rejectMsg: ChatMessage = { id: Date.now(), sender: 'farmer', type: 'text', text: "That is too high for me. I can do this much:", timestamp: Date.now() };
                const offerMsg: ChatMessage = { id: Date.now() + 1, sender: 'farmer', type: 'offer', price: counter, timestamp: Date.now() };
                setChatMessages(prev => [...prev, rejectMsg, offerMsg]);
                setCurrentOffer(counter);
            }
        }, 2000);
    };

    // --- NAVIGATION HELPERS ---

    const NavButton = ({ id, icon, label }: { id: DriverView, icon: string, label: string }) => (
        <button 
            onClick={() => setView(id)} 
            className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 ${view === id ? 'text-[#7ae830] scale-110' : 'text-slate-400 hover:text-slate-600'}`}
        >
            <span className="material-symbols-outlined text-2xl">{icon}</span>
            <span className="text-[10px] font-bold">{label}</span>
        </button>
    );

    const SidebarButton = ({ id, icon, label }: { id: DriverView, icon: string, label: string }) => (
        <button 
            onClick={() => setView(id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all hover:scale-[1.02] ${view === id ? 'bg-[#7ae830] text-black font-bold shadow-md shadow-green-200' : 'text-slate-600 hover:bg-slate-50'}`}
        >
            <span className="material-symbols-outlined">{icon}</span>
            {label}
        </button>
    );

    return (
        <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
            
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-72 flex-col bg-white border-r border-slate-200 p-6 shadow-xl z-20">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="w-10 h-10 bg-[#7ae830] rounded-xl flex items-center justify-center text-black shadow-lg shadow-green-500/20">
                        <span className="material-symbols-outlined">local_shipping</span>
                    </div>
                    <div>
                        <h1 className="font-black text-xl text-slate-800">AgriLogistics</h1>
                        <p className="text-xs text-slate-500 font-medium">Partner Portal</p>
                    </div>
                </div>
                
                <nav className="space-y-2 flex-1">
                    <SidebarButton id="dashboard" icon="dashboard" label="Dashboard" />
                    <SidebarButton id="trips" icon="list_alt" label="Trip Requests" />
                    <SidebarButton id="my_trips" icon="route" label="My Trips" />
                    <SidebarButton id="earnings" icon="account_balance_wallet" label="Earnings" />
                    <SidebarButton id="profile" icon="person" label="Profile" />
                    <SidebarButton id="settings" icon="settings" label="Settings" />
                </nav>

                <div className="pt-6 border-t border-slate-100">
                    <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-500 hover:bg-red-50 transition-all font-bold">
                        <span className="material-symbols-outlined">logout</span> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative h-full overflow-hidden bg-[#f8fafc]">
                
                {/* --- HEADER (Hidden in Chat View) --- */}
                {view !== 'negotiation' && (
                    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#7ae830] text-3xl">local_shipping</span>
                            <span className="font-bold text-lg text-slate-900">AgriLogistics</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold text-green-700">Online</span>
                            </div>
                            <img src={user.avatar} className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 object-cover" />
                        </div>
                    </header>
                )}

                {/* --- CONTENT CONTAINER --- */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    
                    {/* DASHBOARD VIEW */}
                    {view === 'dashboard' && (
                        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto animate-fadeIn pb-24">
                            {!user.driver_details?.isVerified && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h3 className="font-bold text-yellow-800">KYC Verification Pending</h3>
                                        <p className="text-sm text-yellow-700">Complete verification to accept rides.</p>
                                    </div>
                                    <Button onClick={() => setShowKycModal(true)} className="bg-yellow-500 text-white hover:bg-yellow-600 shadow-md w-full sm:w-auto">Verify Now</Button>
                                </div>
                            )}

                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-default bg-white">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><span className="material-symbols-outlined">payments</span></div>
                                            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">+12%</span>
                                        </div>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Earnings</p>
                                        <h3 className="text-2xl font-black text-slate-800">₹{stats.totalEarnings.toLocaleString()}</h3>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-default bg-white">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><span className="material-symbols-outlined">check_circle</span></div>
                                        </div>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Completed</p>
                                        <h3 className="text-2xl font-black text-slate-800">{stats.completedTrips}</h3>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-default bg-white">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><span className="material-symbols-outlined">local_shipping</span></div>
                                            {activeTrip && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
                                        </div>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Active Trip</p>
                                        <h3 className="text-2xl font-black text-slate-800">{activeTrip ? "Yes" : "No"}</h3>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-sm hover:shadow-md transition-all cursor-default bg-white">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><span className="material-symbols-outlined">star</span></div>
                                        </div>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Rating</p>
                                        <h3 className="text-2xl font-black text-slate-800">{user.driver_details?.rating}</h3>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Active Trip Widget */}
                            {activeTrip && (
                                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-[#7ae830] text-black text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">ONGOING</span>
                                                <span className="text-slate-300 text-sm font-medium">Trip #{activeTrip.id.slice(-4)}</span>
                                            </div>
                                            <h2 className="text-2xl font-bold mb-1">{activeTrip.dropLocation}</h2>
                                            <p className="text-slate-400 text-sm">Pickup: {activeTrip.pickupLocation}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-slate-400">Est. Earning</p>
                                            <p className="text-3xl font-black text-[#7ae830]">₹{activeTrip.offeredPrice}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="relative z-10 mt-6 flex gap-3">
                                        <button className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-colors flex justify-center items-center gap-2 shadow-lg active:scale-95" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.dropLocation}`, '_blank')}>
                                            <span className="material-symbols-outlined">navigation</span> Navigate
                                        </button>
                                        <button className="flex-1 py-3 bg-[#7ae830] text-black font-bold rounded-xl hover:bg-[#6bd62a] transition-colors flex justify-center items-center gap-2 shadow-lg active:scale-95" onClick={() => handleUpdateStatus('Completed')}>
                                            <span className="material-symbols-outlined">check_circle</span> Complete
                                        </button>
                                    </div>
                                    
                                    <div className="absolute right-[-20px] bottom-[-20px] opacity-10 rotate-12 pointer-events-none">
                                        <span className="material-symbols-outlined text-[150px]">map</span>
                                    </div>
                                </div>
                            )}

                            {/* Map Placeholder */}
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-800">Live Demand Heatmap</h3>
                                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">High Demand: Sector 4</span>
                                </div>
                                <div className="w-full h-64 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200">
                                    <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/Map_of_Nagpur.png')] bg-cover bg-center opacity-60 grayscale"></div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#7ae830] rounded-full border-4 border-white shadow-lg animate-pulse"></div>
                                    <div className="absolute top-1/3 left-1/3 w-20 h-20 bg-green-500/20 rounded-full blur-xl animate-pulse"></div>
                                    <div className="absolute bottom-1/3 right-1/3 w-16 h-16 bg-orange-500/20 rounded-full blur-xl animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TRIP REQUESTS VIEW */}
                    {view === 'trips' && (
                        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-4 animate-fadeIn pb-24">
                            <h2 className="text-2xl font-black text-slate-900 mb-6">New Requests ({jobs.length})</h2>
                            
                            {jobs.map(job => (
                                <div key={job.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg transition-all group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-4 items-center">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shadow-inner">🌾</div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-lg">{job.crop} ({job.weight} Qtl)</h3>
                                                <p className="text-xs text-slate-500 font-medium">{job.farmerName} • {job.distanceKm} km</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-slate-900">₹{job.offeredPrice}</p>
                                            <p className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full inline-block">Fair Price</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-4 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div className="flex-1 text-center border-r border-slate-200">
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pickup</p>
                                            <p className="font-bold truncate">{job.pickupLocation}</p>
                                        </div>
                                        <div className="flex-1 text-center">
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Drop</p>
                                            <p className="font-bold truncate">{job.dropLocation}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => openNegotiation(job)} 
                                            className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">chat</span> Negotiate
                                        </button>
                                        <button 
                                            onClick={() => { if (!user.driver_details?.isVerified) setShowKycModal(true); else handleAcceptJob(job); }} 
                                            className="flex-[2] py-3 bg-[#7ae830] hover:bg-[#6bd62a] text-black rounded-xl font-bold shadow-md shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">check</span> Accept Offer
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {jobs.length === 0 && <div className="text-center py-20 text-slate-400">No requests available nearby.</div>}
                        </div>
                    )}

                    {/* NEGOTIATION CHAT VIEW */}
                    {view === 'negotiation' && negotiatingJob && (
                        <div className="flex flex-col h-full bg-[#e5ddd5] absolute inset-0 z-50">
                            
                            {/* Chat Header */}
                            <div className="bg-white p-3 shadow-sm flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setView('trips')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                        <span className="material-symbols-outlined text-slate-600">arrow_back</span>
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-100">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${negotiatingJob.farmerName}`} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 leading-none">{negotiatingJob.farmerName}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{negotiatingJob.crop} • {negotiatingJob.weight} Qtl</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right pr-2">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Current Offer</p>
                                    <p className="text-xl font-black text-slate-900">₹{currentOffer}</p>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={chatScrollRef} style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundRepeat: 'repeat' }}>
                                {chatMessages.map((msg) => (
                                    <div key={msg.id} className={`flex w-full ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                        
                                        {/* OFFER CARD */}
                                        {msg.type === 'offer' ? (
                                            <div className="bg-white p-1 rounded-xl shadow-md max-w-[80%] overflow-hidden">
                                                <div className={`p-4 rounded-lg flex flex-col items-center gap-1 ${msg.sender === 'me' ? 'bg-green-50' : 'bg-slate-50'}`}>
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{msg.sender === 'me' ? 'You Offered' : 'New Offer'}</span>
                                                    <span className="text-3xl font-black text-slate-900">₹{msg.price}</span>
                                                </div>
                                                <div className="px-3 py-2 text-[10px] text-slate-400 text-right flex justify-between items-center">
                                                    <span className="font-bold text-slate-300">OFFER</span>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                        ) : msg.type === 'accept' ? (
                                             <div className="w-full flex justify-center my-2">
                                                <div className="bg-[#dcfce7] text-green-800 px-4 py-2 rounded-full text-xs font-bold shadow-sm border border-green-200 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                    Offer Accepted: ₹{msg.price}
                                                </div>
                                             </div>
                                        ) : (
                                            // STANDARD TEXT
                                            <div className={`max-w-[75%] px-4 py-2 rounded-xl shadow-sm text-sm leading-relaxed ${msg.sender === 'me' ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                                                {msg.text}
                                                <div className={`text-[9px] text-right mt-1 ${msg.sender === 'me' ? 'text-green-800/60' : 'text-slate-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Actions Footer */}
                            <div className="bg-[#f0f2f5] p-3 flex flex-col gap-3 shrink-0 border-t border-slate-200">
                                
                                {/* Quick Actions */}
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setShowPriceInput(!showPriceInput)}
                                        className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <span className="material-symbols-outlined text-lg">edit_note</span> Propose Price
                                    </button>
                                    <button 
                                        onClick={() => handleAcceptJob(negotiatingJob, currentOffer)} 
                                        className="flex-1 bg-[#7ae830] text-black font-bold py-3 rounded-xl shadow-md hover:bg-[#6bd62a] transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">done_all</span> Accept ₹{currentOffer}
                                    </button>
                                </div>

                                {/* Price Input Popup */}
                                <AnimatePresence>
                                    {showPriceInput && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="bg-white p-4 rounded-xl shadow-lg border border-slate-200 absolute bottom-24 left-4 right-4 z-10"
                                        >
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Enter Counter Offer</p>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                                                    <input 
                                                        type="number" 
                                                        value={newPrice} 
                                                        onChange={e => setNewPrice(e.target.value)} 
                                                        className="w-full bg-slate-100 rounded-lg pl-8 pr-4 py-3 font-bold outline-none focus:ring-2 focus:ring-[#7ae830]" 
                                                        placeholder="0"
                                                        autoFocus
                                                    />
                                                </div>
                                                <button onClick={handleProposePrice} className="bg-black text-white px-6 rounded-lg font-bold hover:bg-slate-800 transition-colors">Send</button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Text Input */}
                                <div className="flex gap-2 items-center bg-white rounded-full px-2 py-1 shadow-sm border border-slate-200">
                                    <input 
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        placeholder="Type a message..." 
                                        className="flex-1 bg-transparent px-4 py-3 outline-none text-slate-800 placeholder:text-slate-400 text-sm"
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button onClick={handleSendMessage} className="p-2.5 bg-[#7ae830] text-black rounded-full hover:bg-[#6bd62a] transition-colors shadow-sm">
                                        <span className="material-symbols-outlined text-lg">send</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EARNINGS VIEW */}
                    {view === 'earnings' && (
                        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn p-4 md:p-8 pb-24">
                            <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">₹</div>
                                <div className="relative z-10">
                                    <p className="text-sm text-slate-400 font-bold uppercase mb-1">Total Balance</p>
                                    <h1 className="text-5xl font-black mb-6">₹{stats.totalEarnings.toLocaleString()}.00</h1>
                                    <div className="flex gap-4">
                                        <div className="bg-white/10 px-4 py-2 rounded-lg">
                                            <p className="text-xs text-slate-400">This Month</p>
                                            <p className="font-bold">₹{user.driver_details?.earnings?.thisMonth.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 px-4 py-2 rounded-lg">
                                            <p className="text-xs text-slate-400">Pending Payout</p>
                                            <p className="font-bold">₹{user.driver_details?.earnings?.pendingPayout.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <button className="mt-6 w-full bg-[#7ae830] hover:bg-[#6bd62a] text-black font-bold py-3 rounded-xl transition-colors shadow-lg">Withdraw Funds</button>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-lg mb-4 text-slate-900">Weekly Overview</h3>
                                <div className="h-64"><canvas ref={chartRef}></canvas></div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-lg mb-4 text-slate-900">Recent Transactions</h3>
                                <div className="space-y-4">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-100 last:border-0">
                                            <div className="flex gap-3 items-center">
                                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">↓</div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900">Trip Payment</p>
                                                    <p className="text-xs text-slate-500">2 days ago</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-green-600">+₹1,200</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROFILE VIEW */}
                    {view === 'profile' && (
                        <div className="max-w-2xl mx-auto animate-fadeIn pb-24 p-4 md:p-8">
                            <div className="text-center mb-8">
                                <div className="relative inline-block">
                                    <img src={user.avatar} className="w-28 h-28 rounded-full border-4 border-white shadow-lg mx-auto bg-slate-200 object-cover" />
                                    <button className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full hover:scale-110 transition-transform"><span className="material-symbols-outlined text-sm">edit</span></button>
                                </div>
                                <h2 className="text-2xl font-bold mt-4 text-slate-900">{user.name}</h2>
                                <p className="text-slate-500">{user.email}</p>
                                <div className="flex justify-center gap-2 mt-3">
                                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Verified Driver</span>
                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{user.driver_details?.rating} ★</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-900">Personal Information</h3>
                                        <button onClick={() => setEditProfile(!editProfile)} className="text-blue-600 text-sm font-bold">{editProfile ? 'Save' : 'Edit'}</button>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                                            <Input disabled={!editProfile} value={user.name} className="mt-1 bg-slate-50 border-slate-200" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Phone Number</label>
                                            <Input disabled={!editProfile} value={user.phone} className="mt-1 bg-slate-50 border-slate-200" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <h3 className="font-bold text-slate-900 mb-4">Vehicle Details</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Vehicle Type</label>
                                            <Input disabled={!editProfile} value={user.driver_details?.vehicleType} className="mt-1 bg-slate-50 border-slate-200" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Plate Number</label>
                                            <Input disabled={!editProfile} value={user.driver_details?.vehicleNumber} className="mt-1 uppercase bg-slate-50 border-slate-200" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Capacity</label>
                                            <Input disabled={!editProfile} value={`${user.driver_details?.loadCapacity} Tons`} className="mt-1 bg-slate-50 border-slate-200" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Mobile Bottom Navigation */}
                {view !== 'negotiation' && (
                    <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-2 z-40 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                        <NavButton id="dashboard" icon="home" label="Home" />
                        <NavButton id="trips" icon="local_shipping" label="Requests" />
                        <NavButton id="my_trips" icon="route" label="My Trips" />
                        <NavButton id="earnings" icon="account_balance_wallet" label="Wallet" />
                        <NavButton id="profile" icon="person" label="Profile" />
                    </div>
                )}

                {/* KYC Modal */}
                {showKycModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowKycModal(false)}></div>
                        <div className="relative w-full max-w-2xl bg-transparent pointer-events-auto">
                            <OnboardingWizard user={user} onComplete={() => setShowKycModal(false)} />
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};
