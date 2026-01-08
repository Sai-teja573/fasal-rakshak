
import React, { useState } from 'react';
import { User } from '../types';
import { registerDriver } from '../services/transportService';
import { Button, Input } from './ui/Shadcn';
import { LoadingScreen } from './ui/LoadingScreen';

interface DriverAuthProps {
    onLogin: (user: User) => void;
    onBack: () => void;
}

export const DriverAuth: React.FC<DriverAuthProps> = ({ onLogin, onBack }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });

    const handleRegister = async () => {
        setLoading(true);
        try {
            // Simplified registration first, KYC later in dashboard
            const user = await registerDriver({ ...formData, vehicleType: 'Mini Truck' });
            onLogin(user); 
        } catch (e) {
            alert("Signup failed");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <LoadingScreen text="Creating Account..." />;

    return (
        <div className="min-h-screen bg-[#f7f8f6] dark:bg-[#172111] flex flex-col relative overflow-hidden transition-colors">
            
            {/* Header */}
            <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#2a3325]/90 backdrop-blur-md border-b border-[#f2f4f0] dark:border-white/10 px-4 sm:px-10 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 transition-colors">
                        <span className="material-symbols-outlined dark:text-white">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 text-[#141811] dark:text-white">
                        <div className="size-8 text-[#7ae830] flex items-center justify-center bg-[#172111]/5 rounded-lg">
                            <span className="material-symbols-outlined text-[28px]">local_shipping</span>
                        </div>
                        <h2 className="text-xl font-bold leading-tight tracking-tight">AgriLogistics</h2>
                    </div>
                </div>
                <button className="hidden sm:flex items-center justify-center gap-2 h-10 px-4 bg-[#f7f8f6] dark:bg-white/5 rounded-xl text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors dark:text-white">
                    <span className="material-symbols-outlined text-lg">translate</span>
                    <span>English</span>
                </button>
            </header>

            <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-12 relative z-10">
                {/* Abstract Background */}
                <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
                    <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#7ae830]/10 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl"></div>
                </div>

                <div className="w-full max-w-[520px] relative z-10 flex flex-col gap-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl sm:text-4xl font-black text-[#141811] dark:text-white tracking-tight">Transporter Registration</h1>
                        <p className="text-[#728863] dark:text-gray-400 text-lg">Join the network to transport goods efficiently.</p>
                    </div>

                    <div className="bg-white dark:bg-[#2a3325] rounded-2xl shadow-xl border border-black/5 dark:border-white/10 p-6 sm:p-8">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#141811] dark:text-gray-200">Full Name</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#728863]">person</span>
                                    <Input 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        className="h-14 pl-12 bg-[#f7f8f6] dark:bg-black/20 border-[#dfe5dc] dark:border-white/10 rounded-xl"
                                        placeholder="e.g. Ramesh Kumar"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#141811] dark:text-gray-200">Mobile Number</label>
                                <div className="flex gap-3">
                                    <div className="flex items-center justify-center w-20 h-14 rounded-xl bg-[#f7f8f6] dark:bg-black/20 border border-[#dfe5dc] dark:border-white/10 text-base font-medium text-[#728863] dark:text-gray-300">
                                        +91
                                    </div>
                                    <div className="relative flex-1">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#728863]">call</span>
                                        <Input 
                                            value={formData.phone}
                                            onChange={e => setFormData({...formData, phone: e.target.value})}
                                            className="h-14 pl-12 bg-[#f7f8f6] dark:bg-black/20 border-[#dfe5dc] dark:border-white/10 rounded-xl"
                                            placeholder="98765 43210"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[#141811] dark:text-gray-200">Password</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#728863]">lock</span>
                                        <Input 
                                            type="password"
                                            value={formData.password}
                                            onChange={e => setFormData({...formData, password: e.target.value})}
                                            className="h-14 pl-12 bg-[#f7f8f6] dark:bg-black/20 border-[#dfe5dc] dark:border-white/10 rounded-xl"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[#141811] dark:text-gray-200">Confirm</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#728863]">lock_reset</span>
                                        <Input 
                                            type="password"
                                            value={formData.confirmPassword}
                                            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                            className="h-14 pl-12 bg-[#f7f8f6] dark:bg-black/20 border-[#dfe5dc] dark:border-white/10 rounded-xl"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 py-1">
                                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-[#7ae830] focus:ring-green-500 mt-0.5" id="terms" />
                                <label htmlFor="terms" className="text-sm text-[#728863] leading-normal">
                                    I agree to the <a href="#" className="text-blue-600 font-medium hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 font-medium hover:underline">Privacy Policy</a>.
                                </label>
                            </div>

                            <Button 
                                onClick={handleRegister} 
                                className="w-full h-14 rounded-xl bg-[#7ae830] hover:bg-[#65c226] text-[#141811] font-bold text-lg shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                            >
                                <span>Create Account</span>
                                <span className="material-symbols-outlined font-bold">arrow_forward</span>
                            </Button>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-[#728863]">
                                Already have an account? 
                                <button onClick={onBack} className="text-blue-600 font-bold hover:underline ml-1">Log In</button>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[#728863]/60 text-sm">
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                        <span>Secure Government Compliant Platform</span>
                    </div>
                </div>
            </main>
        </div>
    );
};