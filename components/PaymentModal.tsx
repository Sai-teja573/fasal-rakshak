
import React, { useState, useEffect } from 'react';
import { Plan, User } from '../types';
import { initiatePayment, TransactionResult } from '../services/paymentService';

interface PaymentModalProps {
    plan: Plan;
    user: User;
    onClose: () => void;
    onSuccess: (updatedUser: User) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ plan, user, onClose, onSuccess }) => {
    const [step, setStep] = useState<'method' | 'processing' | 'success'>('method');
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking'>('card');
    const [error, setError] = useState<string | null>(null);
    const [transactionData, setTransactionData] = useState<TransactionResult | null>(null);

    const handlePay = async () => {
        setStep('processing');
        setError(null);

        // Call the service which simulates network delay and updates DB
        const result = await initiatePayment(user, plan);
        setTransactionData(result);

        if (result.success && result.updatedUser) {
            setStep('success');
            // Do not auto-close immediately, let them read the invoice
        } else {
            setStep('method');
            setError(result.error || "Payment failed");
        }
    };

    const handleFinish = () => {
        if (transactionData?.updatedUser) {
            onSuccess(transactionData.updatedUser);
        } else {
            onClose();
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
                
                {/* Header (Razorpay Style) */}
                <div className="bg-[#2b83ea] p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2b83ea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-7l-2-2.52a4 4 0 0 1 7.29-4.74L21 16v6h-5v-5l-2.7-2.7-1.3 2.7v5h-5z"/><path d="M10 2h4"/></svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Fasal Rakshak</h3>
                            <p className="text-xs opacity-80">Trusted Business</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs opacity-80">Order #FR-{Math.floor(Math.random()*10000)}</p>
                        <p className="font-bold text-xl">₹{plan.price}.00</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {step === 'method' && (
                        <>
                            <div className="mb-6">
                                <p className="text-sm text-slate-500 mb-2">Select Payment Method</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {['card', 'upi', 'netbanking'].map((m) => (
                                        <button 
                                            key={m}
                                            onClick={() => setPaymentMethod(m as any)}
                                            className={`p-3 rounded-lg border text-sm font-bold capitalize transition-colors ${paymentMethod === m ? 'border-[#2b83ea] bg-blue-50 text-[#2b83ea]' : 'border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dummy Card Form */}
                            {paymentMethod === 'card' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="p-4 bg-gradient-to-r from-slate-700 to-slate-900 rounded-xl text-white shadow-lg mb-4">
                                        <div className="flex justify-between mb-6">
                                            <div className="w-10 h-6 bg-yellow-400 rounded-md opacity-80"></div>
                                            <span className="font-mono">VISA</span>
                                        </div>
                                        <p className="font-mono text-lg tracking-widest mb-2">4242 4242 4242 4242</p>
                                        <div className="flex justify-between text-xs opacity-80">
                                            <span>{user.name.toUpperCase()}</span>
                                            <span>12/28</span>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">CVV</label>
                                            <input type="password" placeholder="123" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#2b83ea]" maxLength={3} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Expiry</label>
                                            <input type="text" placeholder="MM/YY" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#2b83ea]" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {paymentMethod === 'upi' && (
                                <div className="animate-fadeIn py-4">
                                    <label className="text-xs font-bold text-slate-500 uppercase">UPI ID</label>
                                    <input type="text" placeholder="mobile@upi" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-[#2b83ea]" defaultValue={user.email?.split ? user.email.split('@')[0] + '@okhdfcbank' : ''} />
                                    <p className="text-xs text-green-600 mt-2">✓ Verified Name: {user.name}</p>
                                </div>
                            )}

                             {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                        </>
                    )}

                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-fadeIn">
                            <div className="w-16 h-16 border-4 border-[#2b83ea] border-t-transparent rounded-full animate-spin mb-4"></div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Processing Secure Payment...</h3>
                            <p className="text-slate-500 text-sm">Contacting your bank. Please do not close this window.</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center animate-fadeIn">
                             <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                             </div>
                             <h3 className="font-black text-2xl text-slate-800 dark:text-white mb-1">Congratulations!</h3>
                             <p className="text-slate-500 mb-6 text-center text-sm">Your <strong>{plan.name}</strong> subscription is now active.</p>

                             {/* Receipt Card */}
                             <div className="w-full bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 mb-6 relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-2 opacity-10">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                 </div>
                                 <div className="flex justify-between text-xs mb-2">
                                     <span className="text-slate-500">Invoice ID</span>
                                     <span className="font-mono font-bold dark:text-white">{transactionData?.invoiceId || "INV-GEN"}</span>
                                 </div>
                                 <div className="flex justify-between text-xs mb-2">
                                     <span className="text-slate-500">Date</span>
                                     <span className="font-medium dark:text-white">{transactionData?.transactionDate}</span>
                                 </div>
                                 <div className="flex justify-between text-xs mb-4">
                                     <span className="text-slate-500">Amount Paid</span>
                                     <span className="font-bold text-green-600">₹{plan.price}.00</span>
                                 </div>
                                 <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-600 text-xs text-blue-600">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                     <span className="font-medium">Receipt & License key sent to {user.email}</span>
                                 </div>
                             </div>

                             <button 
                                onClick={handleFinish} 
                                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all"
                             >
                                 Continue to Dashboard
                             </button>
                        </div>
                    )}
                </div>

                {/* Footer Actions (Only for method step) */}
                {step === 'method' && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={handlePay} className="flex-[2] py-3 bg-[#2b83ea] text-white font-bold rounded-lg hover:bg-[#1a73e8] shadow-lg shadow-blue-500/30">
                            Pay ₹{plan.price}
                        </button>
                    </div>
                )}
                
                {/* Razorpay Branding Footer */}
                {step !== 'success' && (
                    <div className="bg-slate-100 py-2 text-center border-t border-slate-200">
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Secured by Razorpay</p>
                    </div>
                )}
            </div>
        </div>
    );
};
