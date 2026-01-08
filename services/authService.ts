
import { User } from '../types';
import { getSupabase, checkSupabaseConnection } from './supabaseClient';
import { sendEmail } from './mailService';

// Generate a random 6 digit alphanumeric ID like FR-8293X2
const generateFarmerId = (prefix = 'FR') => {
    return prefix + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
};

// Helper to format phone numbers (Enforce +91)
const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '').trim();
    if (!cleaned) return '';
    // If it starts with +, return as is (assuming valid)
    if (cleaned.startsWith('+')) return cleaned;
    // If it is a 10 digit number, add +91
    if (cleaned.length === 10) return `+91${cleaned}`;
    // Fallback
    return cleaned;
};

// --- PRIVACY / WEB3 BACKGROUND UTILS ---
const generateHiddenIdentity = async () => {
    try {
        const keyPair = await window.crypto.subtle.generateKey(
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign", "verify"]
        );
        
        const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
        
        const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
        const privateKey = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));
        
        return {
            did: `did:fasal:${publicKey.slice(0, 20)}...`, 
            publicKey,
            privateKey
        };
    } catch (e) {
        return {
            did: `did:fasal:${Math.random().toString(36).substring(2)}`,
            publicKey: 'simulated_pub_key',
            privateKey: 'simulated_priv_key'
        };
    }
};

// Helper to map Supabase auth/profile to App User
const mapSupabaseUserToAppUser = (authUser: any, profile: any): User => {
    const meta = authUser.user_metadata || {};
    let loc: any = undefined;
    
    if (profile?.location) {
         loc = profile.location; 
    } else if (meta.location) {
        loc = meta.location;
    }
    
    if (loc && (profile?.district || meta.district)) {
        loc = { ...loc, district: profile?.district || meta.district };
    }

    const resolvedRole = profile?.role || meta?.role || 'farmer';

    return {
        id: authUser.id,
        farmer_id: profile?.farmer_id || meta.farmer_id || 'GUEST',
        name: profile?.full_name || meta.full_name || meta.name || 'Farmer',
        email: authUser.email || '',
        // FIX: Map database column 'phone_number' to App 'phone' property
        phone: profile?.phone_number || profile?.phone || meta.phone || '',
        avatar: profile?.avatar_url || meta.avatar_url || meta.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.email}`,
        role: resolvedRole, 
        status: profile?.status || 'Active',
        assigned_mandi: profile?.assigned_mandi, 
        driver_details: profile?.driver_details, 
        agent_accuracy_score: profile?.agent_accuracy_score,
        preferred_languages: (profile?.preferred_languages && profile.preferred_languages.length > 0) 
            ? profile.preferred_languages 
            : (meta.preferred_languages || ['en']),
        crops_grown: (profile?.crops_grown && profile.crops_grown.length > 0) 
            ? profile.crops_grown 
            : (meta.crops_grown || []),
        land_size: profile?.land_size,
        water_source: profile?.water_source,
        weather_mode: profile?.weather_mode || 'online',
        iot_config: profile?.iot_config,
        crop_portfolio: profile?.crop_portfolio,
        location: loc,
        usage: profile?.usage || meta.usage || { scans_this_month: 0, last_reset_date: Date.now() },
        plan_id: profile?.plan_id || meta.plan_id
    };
}

// --- CORE USER FETCHING ---
export const getAllUsers = async (): Promise<User[]> => {
    const supabase = getSupabase();
    if (!supabase || !(await checkSupabaseConnection())) return [];

    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error || !data) return [];

        return data.map(u => ({
            id: u.id,
            farmer_id: u.farmer_id || 'UNK',
            name: u.full_name,
            email: u.email,
            role: u.role,
            status: u.status,
            avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`,
            usage: u.usage || { scans_this_month: 0, last_reset_date: Date.now() },
            preferred_languages: u.preferred_languages || ['en'],
            crops_grown: u.crops_grown || [],
            land_size: u.land_size,
            water_source: u.water_source,
            plan_id: u.plan_id,
            location: u.location,
            weather_mode: u.weather_mode || 'online',
            iot_config: u.iot_config,
            assigned_mandi: u.assigned_mandi,
            driver_details: u.driver_details
        }));
    } catch (e) { return []; }
};

export const checkLoginRateLimit = (): { allowed: boolean; waitTime?: number } => {
    const now = Date.now();
    const attempts = JSON.parse(localStorage.getItem('fasal_login_attempts') || '[]');
    const recentAttempts = attempts.filter((t: number) => now - t < 15 * 60 * 1000);
    if (recentAttempts.length >= 5) {
        return { allowed: false, waitTime: 15 };
    }
    recentAttempts.push(now);
    localStorage.setItem('fasal_login_attempts', JSON.stringify(recentAttempts));
    return { allowed: true };
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
    const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!regex.test(password)) {
        return { valid: false, message: "Password must be at least 8 characters, with 1 uppercase letter and 1 number." };
    }
    return { valid: true };
};

// Unified Login Function
export const loginUser = async (email: string, pass: string): Promise<User> => {
    const limit = checkLoginRateLimit();
    if (!limit.allowed) {
        throw new Error(`Too many login attempts. Please wait ${limit.waitTime} minutes.`);
    }

    const supabase = getSupabase();
    if (!supabase) throw new Error("Database service unavailable.");
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    
    if (error) throw error;
    if (!data.user) throw new Error("Login failed");

    let profile = null;
    try {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        profile = profileData;
    } catch (e) {
        console.warn("Profile fetch failed, using auth metadata", e);
    }
    
    const appUser = mapSupabaseUserToAppUser(data.user, profile);
    
    // Explicitly check for Pending status
    if (appUser.status === 'Blocked' || appUser.status === 'Pending') {
        await supabase.auth.signOut();
        throw new Error(appUser.status === 'Pending' ? "Account pending approval. Please contact support." : "Account is blocked. Please contact support.");
    }

    return appUser;
};

export const registerUser = async (
    name: string, 
    email: string, 
    pass: string,
    phone: string,
    role: 'farmer' | 'agent' | 'driver' = 'farmer'
): Promise<User> => {
    const check = validatePassword(pass);
    if (!check.valid) throw new Error(check.message || "Weak password");

    const supabase = getSupabase();
    if (!supabase) throw new Error("Database service unavailable.");
    
    const usage = { scans_this_month: 0, last_reset_date: Date.now() };
    
    let farmerId = 'FR-UNKNOWN';
    if (role === 'agent') farmerId = generateFarmerId('AGT');
    else if (role === 'driver') farmerId = generateFarmerId('DRV');
    else farmerId = generateFarmerId('FR');

    const status = role === 'agent' ? 'Pending' : 'Active';

    // 1. Generate Hidden Identity
    const identity = await generateHiddenIdentity();
    const formattedPhone = formatPhoneNumber(phone);

    // 2. Register in Auth
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: {
                full_name: name,
                role: role, 
                farmer_id: farmerId,
                phone: formattedPhone,
                usage,
                status: status,
                did: identity.did 
            }
        }
    });

    if (error) throw error;
    if (!data.user) throw new Error("Registration failed");

    // 3. Save Keys Locally 
    localStorage.setItem(`fasal_priv_key_${data.user.id}`, identity.privateKey);

    // FIX: Use 'phone_number' column matching schema
    const profileData = { 
        id: data.user.id, 
        farmer_id: farmerId,
        full_name: name, 
        email: email,
        phone_number: formattedPhone, // Correct column mapping
        role: role, 
        status: status,
        crops_grown: [], 
        preferred_languages: ['en'],
        usage: usage,
        agent_accuracy_score: role === 'agent' ? 100 : undefined 
    };

    // Retry Logic for Profile Insert (handles race conditions with triggers)
    let retryCount = 0;
    let profileSuccess = false;
    
    while (retryCount < 3 && !profileSuccess) {
        const { error: profileError } = await supabase.from('profiles').insert([profileData]);
        
        if (!profileError) {
            profileSuccess = true;
        } else if (profileError.code === '23505') {
            // Unique violation (likely ID) -> means profile exists, proceed
            profileSuccess = true;
        } else if (profileError.code === '23514') {
            // Check Constraint Violation (Role check failed)
            // This is critical. It means the DB has strict role checks not allowing 'agent'/'driver'.
            console.error("DB Constraint Error: Role not allowed in schema.", profileError);
            throw new Error(`Database Error: The role '${role}' is not permitted by the database schema. Please contact admin to update constraints.`);
        } else {
            console.warn(`Profile creation retry ${retryCount + 1}`, profileError);
            await new Promise(r => setTimeout(r, 1000));
            retryCount++;
        }
    }

    sendEmail('welcome', {
        to: email,
        name: name,
        actionUrl: 'https://fasalrakshak.fun/verify-email', 
        actionLabel: 'Verify Your Email'
    });

    const immediateUser = mapSupabaseUserToAppUser(data.user, profileData);
    immediateUser.role = role;
    return immediateUser;
};

export const updateUserProfile = async (userId: string, updates: Partial<User>): Promise<User> => {
    const supabase = getSupabase();
    
    if (!supabase) throw new Error("Connection failed. Changes not saved.");
    
    const dbUpdates: any = {};
    const metaUpdates: any = {};

    if (updates.crops_grown) { dbUpdates.crops_grown = updates.crops_grown; metaUpdates.crops_grown = updates.crops_grown; }
    if (updates.preferred_languages) { dbUpdates.preferred_languages = updates.preferred_languages; metaUpdates.preferred_languages = updates.preferred_languages; }
    if (updates.email) { metaUpdates.email = updates.email; }
    // FIX: Map phone update to 'phone_number' column
    if (updates.phone) { 
        const fmt = formatPhoneNumber(updates.phone);
        dbUpdates.phone_number = fmt; 
        metaUpdates.phone = fmt; 
    }
    if (updates.land_size !== undefined) dbUpdates.land_size = updates.land_size;
    if (updates.water_source !== undefined) dbUpdates.water_source = updates.water_source;
    if (updates.weather_mode !== undefined) dbUpdates.weather_mode = updates.weather_mode;
    if (updates.iot_config !== undefined) dbUpdates.iot_config = updates.iot_config;
    if (updates.location) { dbUpdates.location = updates.location; metaUpdates.location = updates.location; }
    
    if (updates.assigned_mandi) dbUpdates.assigned_mandi = updates.assigned_mandi;
    if (updates.driver_details) dbUpdates.driver_details = updates.driver_details;

    const authUpdatePromise = Object.keys(metaUpdates).length > 0
        ? supabase.auth.updateUser({ data: metaUpdates })
        : Promise.resolve(null);

    let updatedProfile = null;

    if (Object.keys(dbUpdates).length > 0) {
        const { data, error } = await supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', userId)
            .select()
            .single();
            
        if (error) {
            // Handle missing profile case
            if (error.code === 'PGRST116') {
               const { data: { user: currentUser } } = await supabase.auth.getUser();
               const newProfilePayload = {
                   id: userId,
                   email: currentUser?.email || "",
                   full_name: currentUser?.user_metadata?.full_name || "Farmer",
                   farmer_id: currentUser?.user_metadata?.farmer_id || generateFarmerId(),
                   role: currentUser?.user_metadata?.role || 'farmer',
                   status: 'Active',
                   usage: { scans_this_month: 0, last_reset_date: Date.now() },
                   ...dbUpdates
               };
               const { data: upsertData } = await supabase.from('profiles').upsert(newProfilePayload).select().single();
               updatedProfile = upsertData;
            } 
        } else {
            updatedProfile = data;
        }
    } else {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        updatedProfile = data;
    }

    await authUpdatePromise;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("No active session");

    if (!updatedProfile) {
        return { ...mapSupabaseUserToAppUser(session.user, {}), ...updates } as User;
    }

    return mapSupabaseUserToAppUser(session.user, updatedProfile);
};

export const resetPassword = async (email: string): Promise<boolean> => {
    const supabase = getSupabase();
    if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;

        sendEmail('password_reset', {
            to: email,
            name: 'Farmer', 
            actionUrl: 'https://fasalrakshak.fun/reset-password?token=example-token'
        });

        return true;
    }
    return false;
};

export const loginWithGoogle = async (): Promise<void> => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { 
            redirectTo: window.location.origin,
            queryParams: { access_type: 'offline', prompt: 'consent' }
        }
    });
};

export const logout = async (): Promise<void> => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
};

export const getSessionUser = async (): Promise<User | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;

        const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        let profile = data;

        if ((error && error.code === 'PGRST116') || !data) {
            const meta = session.user.user_metadata;
            const role = meta?.role || 'farmer'; 
            
            const newProfile = {
                id: session.user.id,
                email: session.user.email,
                full_name: meta?.full_name || meta?.name || 'User',
                farmer_id: meta?.farmer_id || generateFarmerId(),
                avatar_url: meta?.avatar_url || meta?.picture,
                role: role,
                status: 'Active',
                usage: { scans_this_month: 0, last_reset_date: Date.now() },
                preferred_languages: ['en'],
                crops_grown: [],
                agent_accuracy_score: role === 'agent' ? 100 : undefined
            };
            const { data: createdProfile } = await supabase.from('profiles').insert(newProfile).select().single();
            profile = createdProfile || newProfile; 
        }

        return mapSupabaseUserToAppUser(session.user, profile);
    } catch (e) {
        return null;
    }
};
