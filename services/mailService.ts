
import { Plan } from '../types';
import { getSupabase } from './supabaseClient';

export type EmailType = 'welcome' | 'password_reset' | 'plan_upgrade';

export interface EmailPayload {
    to: string;
    name: string;
    actionUrl?: string;
    actionLabel?: string;
    plan?: Plan;
    invoiceId?: string;
}

// Configuration for email delivery (API keys stored securely in backend)
const EMAIL_CONFIG = {
    maxRetries: 3,
    retryDelayMs: 1000,
    edgeFunctionName: 'send-email',
    timeout: 10000
};

// --- HTML STYLES (Professional & Responsive) ---
const CSS = `
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .header { background-color: #16a34a; padding: 30px 20px; text-align: center; }
    .logo { font-size: 24px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: -0.5px; display: inline-block; }
    .content { padding: 40px 40px; color: #334155; line-height: 1.6; font-size: 16px; }
    .h1 { color: #0f172a; margin-top: 0; font-size: 24px; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.025em; }
    .text { margin-bottom: 24px; color: #475569; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; transition: background-color 0.2s; }
    .btn:hover { background-color: #15803d; }
    .card { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #cbd5e1; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 700; text-align: right; }
    .footer { background-color: #f1f5f9; padding: 24px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
    .footer a { color: #64748b; text-decoration: none; margin: 0 8px; }
    .highlight { color: #16a34a; font-weight: 700; }
`;

const getBaseLayout = (title: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <div class="logo">🌱 Fasal Rakshak</div>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                <p><strong>Fasal Rakshak AI</strong> • Your Digital Agronomist</p>
                <p>Sent via Resend Secure Mail</p>
                <p style="margin-top: 16px;">
                    <a href="#">Privacy Policy</a> • <a href="#">Support</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
`;

// --- EMAIL TEMPLATES ---

// 1. Welcome Email (Unified for Google & Email Signups)
const getWelcomeTemplate = (name: string, actionUrl: string, actionLabel: string) => {
    const body = `
        <h1 class="h1">Namaste, ${name}! 🙏</h1>
        <p class="text">Welcome to the <span class="highlight">Fasal Rakshak</span> family. You have joined India's smartest community of farmers leveraging Artificial Intelligence for better harvests.</p>
        
        <div class="card">
            <h3 style="margin-top: 0; font-size: 16px; color: #0f172a; margin-bottom: 12px;">🚀 Your AI Toolkit is Ready:</h3>
            <ul style="padding-left: 20px; margin-bottom: 0; color: #475569;">
                <li style="margin-bottom: 8px;"><strong>Crop Doctor:</strong> Instant disease diagnosis with 1 photo.</li>
                <li style="margin-bottom: 8px;"><strong>Mandi Rates:</strong> Live prices from markets near you.</li>
                <li><strong>Weather Alerts:</strong> Precise forecasts for your specific farm.</li>
            </ul>
        </div>

        <p class="text">We are excited to help you grow more and spend less.</p>

        <div class="btn-container">
            <a href="${actionUrl}" class="btn">${actionLabel}</a>
        </div>
    `;
    return getBaseLayout("Welcome to Fasal Rakshak", body);
};

// 2. Plan Upgrade / Payment Receipt
const getPlanUpgradeTemplate = (name: string, plan: Plan, invoiceId: string) => {
    const body = `
        <h1 class="h1">Payment Successful ✅</h1>
        <p class="text">Dear ${name},</p>
        <p class="text">Thank you for upgrading to the <span class="highlight">${plan.name}</span>. Your subscription is now active, and all premium features have been unlocked.</p>
        
        <div class="card" style="border-left: 4px solid #16a34a;">
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #0f172a;">Transaction Receipt</h3>
            
            <div class="info-row">
                <span class="info-label">Plan</span>
                <span class="info-value">${plan.name}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Amount Paid</span>
                <span class="info-value">₹${plan.price}.00</span>
            </div>
            <div class="info-row">
                <span class="info-label">Invoice ID</span>
                <span class="info-value">${invoiceId}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Date</span>
                <span class="info-value">${new Date().toLocaleDateString()}</span>
            </div>
        </div>

        <p class="text">You can now access unlimited scans, expert chat, and historical market trends.</p>

        <div class="btn-container">
            <a href="https://fasalrakshak.fun/dashboard" class="btn">Go to Dashboard</a>
        </div>
    `;
    return getBaseLayout("Payment Receipt", body);
};

// 3. Password Reset
const getPasswordResetTemplate = (name: string, link: string) => {
    const body = `
        <h1 class="h1">Reset Password Request</h1>
        <p class="text">Hello ${name},</p>
        <p class="text">We received a request to reset the password for your Fasal Rakshak account. Click the button below to set a new password.</p>
        
        <div class="btn-container">
            <a href="${link}" class="btn">Reset Password</a>
        </div>

        <p class="text" style="font-size: 14px; color: #ef4444;">⚠️ If you did not request this change, please ignore this email. Your account remains secure.</p>
    `;
    return getBaseLayout("Reset Password", body);
};

// --- SENDING LOGIC ---

const generateEmailContent = (type: EmailType, payload: EmailPayload): { subject: string; html: string } => {
    let html = "";
    let subject = "";

    switch (type) {
        case 'welcome':
            subject = "Welcome to Fasal Rakshak! 🌱";
            const actionUrl = payload.actionUrl || "https://fasalrakshak.fun/dashboard";
            const actionLabel = payload.actionLabel || "Get Started";
            html = getWelcomeTemplate(payload.name, actionUrl, actionLabel);
            break;
            
        case 'plan_upgrade':
            subject = `Receipt: ${payload.plan?.name} Upgrade`;
            html = getPlanUpgradeTemplate(payload.name, payload.plan!, payload.invoiceId || 'INV-000');
            break;
            
        case 'password_reset':
            subject = "Reset your Fasal Rakshak Password";
            html = getPasswordResetTemplate(payload.name, payload.actionUrl || "#");
            break;
    }

    return { subject, html };
};

const sendViaEdgeFunction = async (
    to: string,
    subject: string,
    html: string,
    retryCount = 0
): Promise<boolean> => {
    try {
        const supabase = getSupabase();
        if (!supabase) {
            throw new Error('Supabase client not available');
        }

        // Call Supabase Edge Function with timeout
        const response = await supabase.functions.invoke(EMAIL_CONFIG.edgeFunctionName, {
            body: { to, subject, html },
            headers: { 'Content-Type': 'application/json' }
        }) as any;

        if (response.error) {
            throw new Error(response.error.message || 'Unknown error from Edge Function');
        }

        console.log(`✅ [MailService] Email sent successfully to ${to}`);
        return true;

    } catch (error: any) {
        console.warn(`[MailService] Attempt ${retryCount + 1} failed:`, error.message);

        // Retry with exponential backoff
        if (retryCount < EMAIL_CONFIG.maxRetries) {
            const delay = EMAIL_CONFIG.retryDelayMs * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendViaEdgeFunction(to, subject, html, retryCount + 1);
        }

        return false;
    }
};

export const sendEmail = async (type: EmailType, payload: EmailPayload): Promise<boolean> => {
    try {
        // Validate email
        if (!payload.to || !payload.to.includes('@')) {
            console.error('[MailService] Invalid email address:', payload.to);
            return false;
        }

        // Generate content
        const { subject, html } = generateEmailContent(type, payload);

        // Send via Supabase Edge Function with retry
        const success = await sendViaEdgeFunction(payload.to, subject, html);
        
        if (!success) {
            console.error('[MailService] Failed to send email after all retries');
            // In production, log to failed_emails table for manual processing
        }

        return success;

    } catch (error: any) {
        console.error('[MailService] Unexpected error:', error);
        return false;
    }
};
