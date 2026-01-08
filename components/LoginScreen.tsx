import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { loginUser, loginWithGoogle, registerUser, resetPassword, validatePassword } from '../services/authService';
import { getCMSContent } from '../services/cmsService';
import { User } from '../types';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  onCancel: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot_password';
type UserRole = 'farmer' | 'driver' | 'agent';

// ============================================
// ANIMATED BACKGROUND COMPONENT
// ============================================
const AnimatedBackground = () => (
  <div className="absolute inset-0 overflow-hidden">
    {/* Gradient Orbs */}
    <motion.div
      className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-green-400/30 to-emerald-600/20 rounded-full blur-3xl"
      animate={{
        scale: [1, 1.2, 1],
        x: [0, 50, 0],
        y: [0, 30, 0],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-br from-emerald-400/20 to-teal-600/30 rounded-full blur-3xl"
      animate={{
        scale: [1.2, 1, 1.2],
        x: [0, -50, 0],
        y: [0, -30, 0],
      }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-green-500/10 to-transparent rounded-full blur-3xl"
      animate={{
        scale: [1, 1.3, 1],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    />
    
    {/* Floating Elements */}
    {[...Array(12)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute"
        style={{
          left: `${10 + (i * 8) % 80}%`,
          top: `${5 + (i * 13) % 90}%`,
        }}
        animate={{
          y: [0, -20, 0],
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 3 + i * 0.5,
          repeat: Infinity,
          delay: i * 0.3,
          ease: "easeInOut"
        }}
      >
        <div className={`w-2 h-2 rounded-full ${i % 3 === 0 ? 'bg-green-400/40' : i % 3 === 1 ? 'bg-emerald-400/30' : 'bg-teal-400/20'}`} />
      </motion.div>
    ))}
  </div>
);

// ============================================
// ICONS
// ============================================
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.44 0 .87-.03 1.28-.08"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
);

// ============================================
// ANIMATED INPUT COMPONENT
// ============================================
interface AnimatedInputProps {
  icon: React.ReactNode;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  error?: boolean;
  delay?: number;
}

const AnimatedInput: React.FC<AnimatedInputProps> = ({
  icon, name, type, placeholder, value, onChange, required,
  showPasswordToggle, showPassword, onTogglePassword, error, delay = 0
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
    >
      <motion.div 
        className={`relative group rounded-2xl transition-all duration-300 ${
          isFocused 
            ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' 
            : error 
            ? 'ring-2 ring-red-400' 
            : ''
        }`}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className={`absolute top-1/2 left-4 -translate-y-1/2 transition-colors duration-300 ${
          isFocused ? 'text-green-500' : 'text-slate-400'
        }`}>
          {icon}
        </div>
        <input 
          name={name}
          type={showPasswordToggle ? (showPassword ? 'text' : 'password') : type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 font-medium outline-none transition-all duration-300 focus:bg-white dark:focus:bg-slate-800"
        />
        {showPasswordToggle && (
          <button 
            type="button"
            onClick={onTogglePassword}
            className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
        {value && !showPasswordToggle && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1/2 right-4 -translate-y-1/2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white"
          >
            <CheckIcon />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ============================================
// ROLE CARD COMPONENT
// ============================================
interface RoleCardProps {
  role: UserRole;
  icon: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  color: string;
  delay: number;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, icon, label, selected, onClick, color, delay }) => (
  <motion.button
    type="button"
    onClick={onClick}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    whileHover={{ scale: 1.05, y: -5 }}
    whileTap={{ scale: 0.95 }}
    className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
      selected 
        ? `${color} border-current shadow-lg` 
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
    }`}
  >
    <motion.div 
      className="text-3xl mb-2"
      animate={selected ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
      transition={{ duration: 0.5 }}
    >
      {icon}
    </motion.div>
    <div className={`text-sm font-bold ${selected ? 'text-current' : 'text-slate-600 dark:text-slate-400'}`}>
      {label}
    </div>
    {selected && (
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg text-white"
      >
        <CheckIcon />
      </motion.div>
    )}
  </motion.button>
);

// ============================================
// MAIN LOGIN SCREEN COMPONENT
// ============================================
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onCancel }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const content = getCMSContent();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
    if (e.target.name === 'password' && authMode === 'signup') {
      const check = validatePassword(e.target.value);
      setValidationError(check.valid ? null : check.message || null);
    } else {
      setValidationError(null);
    }
  };

  const handleGoogleLogin = async () => {
    localStorage.setItem('fasal_selected_role', selectedRole);
    try {
      await loginWithGoogle();
    } catch (e: any) {
      setError("Google Sign-In failed. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    localStorage.setItem('fasal_selected_role', selectedRole);

    try {
      if (authMode === 'signin') {
        const user = await loginUser(formData.email, formData.password);
        if (user.status === 'Pending') {
          setError("Account pending approval. Please contact admin.");
          setLoading(false);
          return;
        }
        onLogin(user);
      } else if (authMode === 'signup') {
        if (!formData.name) throw new Error("Name is required");
        const check = validatePassword(formData.password);
        if (!check.valid) throw new Error(check.message);
        
        const user = await registerUser(formData.name, formData.email, formData.password, formData.phone, selectedRole as any);
        if (user.status === 'Pending') {
          setError("Registration successful! Your agent account is pending approval.");
          setAuthMode('signin');
          setLoading(false);
          return;
        }
        onLogin(user);
      } else if (authMode === 'forgot_password') {
        await resetPassword(formData.email);
        setResetSent(true);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (msg.includes("already registered") || msg.includes("User already exists") || err.code === "user_already_exists") {
        setError("Account already exists. Please Sign In instead.");
      } else if (msg.includes("Invalid login credentials")) {
        setError("Invalid email or password.");
      } else {
        setError(msg || "Authentication failed. Check connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setError(null);
    setValidationError(null);
    setResetSent(false);
  };

  const logoUrl = content.logos?.main || "https://cdn-icons-png.flaticon.com/512/10609/10609658.png";

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col items-center justify-start py-8 px-4 relative overflow-visible">
      
      <AnimatedBackground />
      
      {/* Main Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md z-10"
      >
        {/* Glass Card */}
        <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-green-900/10 dark:shadow-black/30 border border-white/50 dark:border-slate-800/50 overflow-hidden">
          
          {/* Top Gradient Bar */}
          <div className="h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />
          
          <div className="p-8 md:p-10">
            
            {/* Logo & Header */}
            <motion.div 
              className="text-center mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div 
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl shadow-lg shadow-green-500/30 mb-4"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <img src={logoUrl} className="w-10 h-10 object-contain filter brightness-0 invert" alt="Logo" />
              </motion.div>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={authMode}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                    {authMode === 'signin' ? 'Welcome Back!' : authMode === 'signup' ? 'Create Account' : 'Reset Password'}
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {authMode === 'signin' 
                      ? 'Sign in to access your farming dashboard' 
                      : authMode === 'signup' 
                      ? 'Join thousands of smart farmers today' 
                      : "We'll send you a reset link"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <AnimatePresence mode="wait">
              {/* Reset Password Success */}
              {authMode === 'forgot_password' && resetSent ? (
                <motion.div 
                  key="reset-success"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-center py-8"
                >
                  <motion.div 
                    className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  >
                    <span className="text-4xl">✉️</span>
                  </motion.div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Check Your Email</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">
                    We sent a reset link to <strong className="text-slate-700 dark:text-slate-300">{formData.email}</strong>
                  </p>
                  <button 
                    onClick={() => switchMode('signin')}
                    className="text-green-600 dark:text-green-400 font-bold hover:underline"
                  >
                    Back to Sign In
                  </button>
                </motion.div>
              ) : (
                <motion.form 
                  key={authMode}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  onSubmit={handleSubmit} 
                  className="space-y-5"
                >
                  {/* Role Selector */}
                  {authMode !== 'forgot_password' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        I am a
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <RoleCard
                          role="farmer"
                          icon="🌾"
                          label="Farmer"
                          selected={selectedRole === 'farmer'}
                          onClick={() => setSelectedRole('farmer')}
                          color="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-500"
                          delay={0.25}
                        />
                        <RoleCard
                          role="driver"
                          icon="🚛"
                          label="Transporter"
                          selected={selectedRole === 'driver'}
                          onClick={() => setSelectedRole('driver')}
                          color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-500"
                          delay={0.3}
                        />
                        <RoleCard
                          role="agent"
                          icon="🏢"
                          label="Agent"
                          selected={selectedRole === 'agent'}
                          onClick={() => setSelectedRole('agent')}
                          color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-500"
                          delay={0.35}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Name Field (Signup only) */}
                  {authMode === 'signup' && (
                    <AnimatedInput
                      icon={<UserIcon />}
                      name="name"
                      type="text"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      delay={0.4}
                    />
                  )}

                  {/* Email Field */}
                  <AnimatedInput
                    icon={<MailIcon />}
                    name="email"
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    delay={authMode === 'signup' ? 0.45 : 0.4}
                  />

                  {/* Phone Field (Signup only) */}
                  {authMode === 'signup' && (
                    <AnimatedInput
                      icon={<PhoneIcon />}
                      name="phone"
                      type="tel"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      delay={0.5}
                    />
                  )}

                  {/* Password Field */}
                  {authMode !== 'forgot_password' && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Password
                        </label>
                        {authMode === 'signin' && (
                          <motion.button
                            type="button"
                            onClick={() => switchMode('forgot_password')}
                            className="text-xs font-bold text-green-600 dark:text-green-400 hover:underline"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Forgot Password?
                          </motion.button>
                        )}
                      </div>
                      <AnimatedInput
                        icon={<LockIcon />}
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        showPasswordToggle
                        showPassword={showPassword}
                        onTogglePassword={() => setShowPassword(!showPassword)}
                        error={!!validationError}
                        delay={authMode === 'signup' ? 0.55 : 0.45}
                      />
                      {validationError && (
                        <motion.p 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 mt-2 font-medium"
                        >
                          {validationError}
                        </motion.p>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
                      >
                        <span className="text-red-500">⚠️</span>
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    {loading ? (
                      <motion.div 
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <>
                        <span>
                          {authMode === 'signin' 
                            ? 'Sign In' 
                            : authMode === 'signup' 
                            ? `Create ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account` 
                            : 'Send Reset Link'}
                        </span>
                        <motion.span
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          →
                        </motion.span>
                      </>
                    )}
                  </motion.button>

                  {/* Divider & Google Login */}
                  {authMode !== 'forgot_password' && (
                    <>
                      <motion.div 
                        className="relative my-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.65 }}
                      >
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="px-4 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-400 font-medium uppercase tracking-wider">
                            Or continue with
                          </span>
                        </div>
                      </motion.div>

                      <motion.button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl font-semibold text-slate-700 dark:text-white flex items-center justify-center gap-3 transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                      >
                        <GoogleIcon />
                        <span>Google</span>
                      </motion.button>
                    </>
                  )}

                  {/* Switch Auth Mode */}
                  <motion.div 
                    className="text-center pt-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.75 }}
                  >
                    {authMode === 'forgot_password' ? (
                      <button 
                        type="button"
                        onClick={() => switchMode('signin')}
                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium flex items-center gap-1 mx-auto"
                      >
                        <ArrowLeftIcon />
                        Back to Sign In
                      </button>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {authMode === 'signin' ? "Don't have an account?" : "Already have an account?"}
                        <button 
                          type="button"
                          onClick={() => switchMode(authMode === 'signin' ? 'signup' : 'signin')}
                          className="ml-2 text-green-600 dark:text-green-400 font-bold hover:underline"
                        >
                          {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
                        </button>
                      </p>
                    )}
                  </motion.div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Back to Home */}
        <motion.button 
          onClick={onCancel}
          className="mt-6 mx-auto flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 font-medium transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          whileHover={{ x: -5 }}
        >
          <ArrowLeftIcon />
          Back to Home
        </motion.button>
      </motion.div>
    </div>
  );
};
