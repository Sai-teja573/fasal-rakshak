
import React, { useState, useEffect } from 'react';
import { User, MandiDetails } from '../types';
import { calculateFairPrice, findNearbyDrivers, getVehicleForWeight } from '../services/transportService';
import { getMandisByLocation } from '../services/agro/market'; 
import { Button, Input, Card } from './ui/Shadcn';
import { LoadingScreen } from './ui/LoadingScreen';
import { AnimatePresence, motion } from 'framer-motion';

interface TransportRequestScreenProps {
    user: User;
    onBack: () => void;
    onNavigateToChat: (targetUser: User, message: string) => void;
}

export const TransportRequestScreen: React.FC<TransportRequestScreenProps> = ({ user, onBack, onNavigateToChat }) => {
    // Steps: 1 = Details, 2 = Select Driver
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [nearbyMandis, setNearbyMandis] = useState<MandiDetails[]>([]);
    
    // Step 1: Form Data
    const [crop, setCrop] = useState(user.crops_grown?.[0] || 'Wheat');
    const [weight, setWeight] = useState('');
    const [pickup, setPickup] = useState(user.location?.district ? `${user.location.district}, ${user.location.state}` : '');
    const [drop, setDrop] = useState('');
    const [mapFocus, setMapFocus] = useState(user.location?.district || "India");

    // Step 2: Driver Selection Data
    const [vehicleNeeded, setVehicleNeeded] = useState('');
    const [drivers, setDrivers] = useState<User[]>([]);
    const [estimation, setEstimation] = useState<{min: number, max: number, reason: string} | null>(null);

    // Initial Load - Get Nearby Mandis for suggestions
    useEffect(() => {
        const loadMandis = async () => {
            if (user.location) {
                const results = await getMandisByLocation(user.location.lat, user.location.lon);
                setNearbyMandis(results);
            }
        };
        loadMandis();
    }, [user.location]);

    const handleNextStep = async () => {
        if (!weight || !drop || !pickup) return alert("Please fill all details.");
        
        setLoading(true);
        try {
            // 1. Determine Vehicle Type based on Weight
            const weightQtl = parseFloat(weight);
            const neededType = getVehicleForWeight(weightQtl);
            setVehicleNeeded(neededType);

            // 2. Fetch Drivers
            // In a real app, pass location radius
            const allDrivers = await findNearbyDrivers(0,0);
            
            // Filter by Vehicle Type
            const eligibleDrivers = allDrivers.filter(d => 
                d.driver_details?.vehicleType === neededType || 
                (neededType === 'Lorry' && d.driver_details?.vehicleType === 'Tractor') // Fallback logic
            );
            
            // 3. Calculate Estimate (Mock distance for now)
            const dist = Math.floor(Math.random() * 40) + 10;
            const est = calculateFairPrice(dist, weightQtl, neededType);
            
            setDrivers(eligibleDrivers);
            setEstimation(est);
            setStep(2);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleNegotiate = (driver: User) => {
        if (!estimation) return;
        
        // Construct the initial offer message
        const offerPrice = Math.round((estimation.min + estimation.max) / 2);
        const msg = `Namaste ${driver.name}, I have a transport request:\n\n🌾 Crop: ${crop} (${weight} Qtl)\n📍 Pickup: ${pickup}\n📍 Drop: ${drop}\n\nMy offer is ₹${offerPrice}. Are you available?`;
        
        // Handoff to Chat Screen
        onNavigateToChat(driver, msg);
    };

    const getVehicleImage = (type: string) => {
        switch(type) {
            case 'Tractor': return 'https://images.unsplash.com/photo-1595245862086-f6d22513f57b?q=80&w=400&auto=format&fit=crop';
            case 'Mini Truck': return 'https://images.unsplash.com/photo-1605218427306-635427162983?q=80&w=400&auto=format&fit=crop';
            case 'Lorry': return 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=400&auto=format&fit=crop';
            case 'Pickup': return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=400&auto=format&fit=crop';
            default: return 'https://images.unsplash.com/photo-1605218427306-635427162983?q=80&w=400&auto=format&fit=crop';
        }
    };

    if (loading) return <LoadingScreen text="Locating drivers..." overlay />;

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden">
            
            {/* Header */}
            <div className="bg-white dark:bg-[#1f2c34] p-4 shadow-sm z-20 flex items-center gap-4 shrink-0">
                <button onClick={step === 1 ? onBack : () => setStep(1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-200">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">{step === 1 ? 'Book Transport' : 'Select Driver'}</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Step {step} of 2</p>
                </div>
            </div>

            {/* Scrollable Content with Extra Bottom Padding */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pb-32">
                
                {/* STEP 1: DETAILS INPUT */}
                {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto space-y-6">
                        
                        {/* Crop & Weight Card */}
                        <Card className="p-5 border-none shadow-sm bg-white dark:bg-[#1f2c34]">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-600">agriculture</span> Shipment Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Crop</label>
                                    <select 
                                        value={crop} 
                                        onChange={e => setCrop(e.target.value)} 
                                        className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-3 py-3 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                                    >
                                        {(user.crops_grown || ['Wheat', 'Rice', 'Cotton']).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Weight (Quintals)</label>
                                    <Input 
                                        type="number" 
                                        value={weight} 
                                        onChange={e => setWeight(e.target.value)} 
                                        placeholder="e.g. 50" 
                                        className="bg-slate-100 dark:bg-slate-900 border-none h-[46px]"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Location Card with Map */}
                        <Card className="p-0 border-none shadow-sm bg-white dark:bg-[#1f2c34] overflow-hidden">
                            <div className="p-5 pb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-600">location_on</span> Route
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Pickup Location</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-green-600">my_location</span>
                                            <Input 
                                                value={pickup} 
                                                onChange={e => setPickup(e.target.value)} 
                                                placeholder="Farm Address" 
                                                className="pl-10 bg-slate-100 dark:bg-slate-900 border-none h-[46px]"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Drop Location</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-red-500">pin_drop</span>
                                            <Input 
                                                value={drop} 
                                                onChange={e => setDrop(e.target.value)} 
                                                placeholder="Search Mandi..." 
                                                className="pl-10 bg-slate-100 dark:bg-slate-900 border-none h-[46px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Map & Suggestions */}
                            <div className="relative w-full h-48 bg-slate-100 mt-2">
                                <iframe 
                                    width="100%" 
                                    height="100%" 
                                    style={{ border: 0, opacity: 0.8 }} 
                                    loading="lazy" 
                                    allowFullScreen 
                                    src={`https://www.google.com/maps?q=${encodeURIComponent(mapFocus)}+mandi&output=embed`}
                                ></iframe>
                                
                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                        {nearbyMandis.map((m, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => { setDrop(m.name); setMapFocus(m.name); }}
                                                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3 py-2 rounded-lg shadow-md text-xs font-bold whitespace-nowrap flex items-center gap-1 hover:bg-green-50 transition-colors"
                                            >
                                                <span className="text-red-500">📍</span> {m.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Button onClick={handleNextStep} className="w-full h-14 bg-[#00a884] hover:bg-[#008f6f] text-white text-lg font-bold rounded-xl shadow-lg shadow-green-500/20">
                            Find Vehicles
                        </Button>

                    </motion.div>
                )}

                {/* STEP 2: DRIVER SELECTION */}
                {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto space-y-6">
                        
                        {/* Summary & Estimate */}
                        <div className="bg-[#dcfce7] dark:bg-[#005c4b]/30 border border-green-200 dark:border-[#005c4b] p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-green-800 dark:text-green-300 uppercase">Estimated Fair Price</p>
                                <p className="text-2xl font-black text-green-900 dark:text-white">₹{estimation?.min} - ₹{estimation?.max}</p>
                                <p className="text-xs text-green-700 dark:text-green-400 mt-1">{estimation?.reason}</p>
                            </div>
                            <div className="text-right">
                                <div className="bg-white dark:bg-[#1f2c34] px-3 py-1 rounded-lg shadow-sm mb-1 inline-block">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white">{vehicleNeeded}</span>
                                </div>
                                <p className="text-xs text-green-700 dark:text-green-400">Required for {weight} Qtl</p>
                            </div>
                        </div>

                        <h3 className="font-bold text-slate-700 dark:text-slate-300 px-1">Available Drivers ({drivers.length})</h3>

                        {drivers.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <p>No drivers found for {vehicleNeeded} nearby.</p>
                                <button onClick={() => setStep(1)} className="text-green-600 font-bold mt-2">Modify Search</button>
                            </div>
                        ) : (
                            <div className="grid gap-6">
                                {drivers.map(driver => (
                                    <div key={driver.id} className="bg-white dark:bg-[#1f2c34] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4 group">
                                        
                                        {/* Header */}
                                        <div className="flex gap-4">
                                            <div className="relative">
                                                <img src={driver.avatar} className="w-16 h-16 rounded-full bg-slate-200 object-cover border-2 border-white dark:border-slate-700 shadow-sm" />
                                                {driver.driver_details?.isVerified && (
                                                    <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white dark:border-[#1f2c34]" title="Verified">
                                                        <span className="material-symbols-outlined text-[14px]">verified</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{driver.name}</h4>
                                                    <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-bold text-xs">
                                                        <span className="material-symbols-outlined text-[14px] fill-1">star</span> {driver.driver_details?.rating}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{driver.driver_details?.totalTrips} Successful Trips</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{driver.driver_details?.vehicleNumber}</p>
                                            </div>
                                        </div>

                                        {/* Vehicle Preview */}
                                        <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900">
                                            <img src={getVehicleImage(driver.driver_details?.vehicleType || '')} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
                                            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                                                {driver.driver_details?.vehicleType} • {driver.driver_details?.loadCapacity} Qtl Cap
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <button 
                                            onClick={() => handleNegotiate(driver)}
                                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            <span className="material-symbols-outlined text-lg">chat</span> Make Offer
                                        </button>
                                        
                                        <div className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-4">
                                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online</span>
                                            <span>•</span>
                                            <span>Typically replies in 5m</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

            </div>
        </div>
    );
};
