
import { Plan, User } from '../types';
import { getSupabase } from './supabaseClient';
import { sendEmail } from './mailService';

// Simulate a payment delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface TransactionResult {
    success: boolean;
    updatedUser?: User;
    invoiceId?: string;
    transactionDate?: string;
    error?: string;
}

export const initiatePayment = async (user: User, plan: Plan): Promise<TransactionResult> => {
    try {
        console.log(`Starting payment for plan: ${plan.name} (${plan.price})`);
        
        // 1. Simulate Payment Gateway (Razorpay/Stripe) Interaction
        await delay(2500); 
        
        // 5% chance of random failure for realism
        if (Math.random() > 0.98) {
            throw new Error("Payment declined by bank.");
        }

        // 2. Success - Update User Plan
        const updatedUser: User = {
            ...user,
            plan_id: plan.id,
        };

        const invoiceId = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`;
        const transactionDate = new Date().toLocaleString();

        // 3. Persist to DB / Supabase
        const supabase = getSupabase();
        if (supabase) {
             await supabase.from('profiles').update({ plan_id: plan.id }).eq('id', user.id);
        }

        // 4. Send Confirmation Email (Uses updated template)
        await sendEmail('plan_upgrade', {
            to: user.email,
            name: user.name,
            plan: plan,
            invoiceId: invoiceId
        });

        return { success: true, updatedUser, invoiceId, transactionDate };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
