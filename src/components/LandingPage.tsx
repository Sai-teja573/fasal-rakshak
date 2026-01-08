import React, { useRef, useState, useEffect, useCallback } from 'react';
import { User, Plan, AppView } from '../types';
import { motion, useScroll, useTransform, useInView, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import { fetchPlans } from '../services/cmsService';
import { initiatePayment } from '../services/paymentService';
import { PaymentModal } from './PaymentModal';
import { AppSimulator } from './AppSimulator';

// --- ICONS ---
const Icons = {
  Leaf: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.5 2 9 0 5.5-4.5 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  Scan: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>,
  Zap: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>,
  Shield: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  ChevronDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Star: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Globe: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Wifi: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  Truck: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  Users: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  PlayCircle: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>,
  ArrowRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Calendar: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  BarChart: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  WifiOff: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
};

// --- ANIMATED COUNTER COMPONENT ---
const AnimatedCounter = ({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
};

// --- FLOATING PARTICLES BACKGROUND ---
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-green-500/20 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            y: [null, Math.random() * -500 - 100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
};

// --- MAGNETIC BUTTON ---
const MagneticButton = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.1);
    y.set((e.clientY - centerY) * 0.1);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x, y }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={className}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
};

// --- GLOWING CARD ---
const GlowingCard = ({ children, className, glowColor = 'green' }: { children: React.ReactNode; className?: string; glowColor?: string }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative group ${className}`}
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor === 'green' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.15)'}, transparent 40%)`,
        }}
      />
      {children}
    </motion.div>
  );
};

// --- FEATURE CARD COMPONENT ---
const FeatureCard = ({ title, desc, icon, index, gradient }: { title: string, desc: string, icon: React.ReactNode, index: number, gradient?: string }) => {
  return (
    <GlowingCard className="h-full">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-50px" }}
        className="h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 hover:border-green-500/30 transition-all duration-500 backdrop-blur-sm relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className={`w-14 h-14 rounded-2xl ${gradient || 'bg-gradient-to-br from-green-500/20 to-emerald-600/20'} flex items-center justify-center text-green-400 mb-6 group-hover:scale-110 transition-transform duration-500 border border-green-500/20`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-green-400 transition-colors duration-300">{title}</h3>
        <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors duration-300">{desc}</p>
        <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-400 w-0 group-hover:w-full transition-all duration-700 ease-out" />
      </motion.div>
    </GlowingCard>
  );
};

// --- TESTIMONIAL CARD ---
const TestimonialCard = ({ name, role, quote, avatar, delay }: { name: string; role: string; quote: string; avatar: string; delay: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.06] to-transparent border border-white/10 hover:border-green-500/30 transition-all duration-300"
    >
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="text-yellow-400"><Icons.Star /></span>
        ))}
      </div>
      <p className="text-slate-300 mb-6 leading-relaxed italic">"{quote}"</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
          {avatar}
        </div>
        <div>
          <p className="font-semibold text-white">{name}</p>
          <p className="text-sm text-slate-500">{role}</p>
        </div>
      </div>
    </motion.div>
  );
};

// --- FAQ ACCORDION ---
const FAQItem = ({ question, answer, isOpen, onClick }: { question: string; answer: string; isOpen: boolean; onClick: () => void }) => {
  return (
    <motion.div 
      className="border-b border-white/10"
      initial={false}
    >
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-medium text-white group-hover:text-green-400 transition-colors">{question}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-green-500"
        >
          <Icons.ChevronDown />
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-slate-400 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- PRICING CARD ---
const PricingCard = ({ plan, isPopular, onSelect, currentPlanId }: { plan: Plan; isPopular?: boolean; onSelect: (plan: Plan) => void; currentPlanId?: string }) => {
  const isCurrentPlan = currentPlanId === plan.id;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      whileHover={{ y: -8, scale: 1.02 }}
      className={`relative p-8 rounded-3xl ${isPopular ? 'bg-gradient-to-br from-green-500/20 to-emerald-600/10 border-green-500/50' : 'bg-white/[0.04] border-white/10'} border transition-all duration-300`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-sm font-bold text-white shadow-lg shadow-green-500/30">
          Most Popular
        </div>
      )}
      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl font-black text-white">₹{plan.price}</span>
        <span className="text-slate-500">/month</span>
      </div>
      <ul className="space-y-4 mb-8">
        {plan.features?.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-slate-300">
            <span className="text-green-500"><Icons.Check /></span>
            {feature}
          </li>
        )) || (
          <>
            <li className="flex items-center gap-3 text-slate-300"><span className="text-green-500"><Icons.Check /></span>{plan.max_diagnoses} diagnoses/month</li>
            <li className="flex items-center gap-3 text-slate-300"><span className="text-green-500"><Icons.Check /></span>Market price alerts</li>
            <li className="flex items-center gap-3 text-slate-300"><span className="text-green-500"><Icons.Check /></span>Weather forecasts</li>
          </>
        )}
      </ul>
      <MagneticButton
        onClick={() => onSelect(plan)}
        className={`w-full py-4 rounded-xl font-bold transition-all ${
          isCurrentPlan 
            ? 'bg-slate-700 text-slate-400 cursor-default'
            : isPopular 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50' 
              : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {isCurrentPlan ? 'Current Plan' : plan.price === 0 ? 'Get Started Free' : 'Upgrade Now'}
      </MagneticButton>
    </motion.div>
  );
};

// --- HERO SECTION ---
const ParallaxHero = ({ onStart, containerRef }: { onStart: () => void, containerRef: React.RefObject<HTMLDivElement> }) => {
  const { scrollY } = useScroll({ container: containerRef });
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);
  const scale = useTransform(scrollY, [0, 400], [1, 1.1]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <FloatingParticles />
      
      {/* Background Image with Parallax */}
      <motion.div style={{ y: y1, scale, opacity }} className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1625246333195-09d9b430db80?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#050a08]/70 to-[#050a08]" />
      </motion.div>

      {/* Animated Grid Overlay */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="container mx-auto px-6 relative z-10 pt-20">
        <motion.div style={{ y: y2 }} className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 text-green-400 font-medium text-sm mb-8 backdrop-blur-sm"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            Powered by Google Gemini AI
            <span className="px-2 py-0.5 bg-green-500/20 rounded-full text-xs">v2.0</span>
          </motion.div>
          
          {/* Main Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white mb-8 leading-[1.1] tracking-tight"
          >
            The Future of{' '}
            <span className="relative inline-block">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500">
                Smart Farming
              </span>
              <motion.span 
                className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 1 }}
              />
            </span>
          </motion.h1>
          
          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-lg sm:text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            AI-powered crop diagnosis, real-time market intelligence, and expert guidance—
            <span className="text-green-400 font-medium"> all in your language</span>, even offline.
          </motion.p>
          
          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <MagneticButton 
              onClick={onStart}
              className="group px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold rounded-full transition-all shadow-[0_0_50px_-12px_rgba(34,197,94,0.8)] hover:shadow-[0_0_60px_-8px_rgba(34,197,94,0.9)] flex items-center gap-2"
            >
              Start Free Diagnosis
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Icons.ArrowRight />
              </motion.span>
            </MagneticButton>
            <button 
              onClick={() => scrollToSection('demo')}
              className="group px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full backdrop-blur-md transition-all border border-white/10 hover:border-white/20 flex items-center gap-2"
            >
              <Icons.PlayCircle />
              Watch Demo
            </button>
          </motion.div>

          {/* Trust Badges */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="flex flex-wrap items-center justify-center gap-8 text-slate-500 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span> 50,000+ Farmers
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span> 500+ Diseases Detected
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span> 11 Languages
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Works Offline
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
        >
          <motion.div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
};

// --- STATS SECTION ---
const StatsSection = () => {
  const stats = [
    { value: 50000, suffix: '+', label: 'Farmers Empowered', icon: '👨‍🌾' },
    { value: 200000, suffix: '+', label: 'Diagnoses Completed', icon: '🔬' },
    { value: 150, suffix: ' Cr', prefix: '₹', label: 'Crops Saved', icon: '🌾' },
    { value: 98, suffix: '%', label: 'Accuracy Rate', icon: '🎯' },
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5" />
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <span className="text-4xl mb-4 block">{stat.icon}</span>
              <div className="text-3xl md:text-4xl font-black text-white mb-2">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
              </div>
              <p className="text-slate-400 text-sm">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- PROBLEMS SECTION ---
const ProblemsSection = () => {
  const problems = [
    { icon: '🦠', title: 'Late Disease Detection', desc: 'Farmers often notice diseases only when 20-30% of the crop is already affected, leading to massive losses.', stat: '30%', statLabel: 'Crop Loss' },
    { icon: '💰', title: 'Market Uncertainty', desc: 'No real-time access to Mandi prices leads to selling at unfair rates or missing peak opportunities.', stat: '₹1.5L Cr', statLabel: 'Annual Losses' },
    { icon: '👨‍⚕️', title: 'Expert Shortage', desc: 'With 1 agricultural officer per 20,000+ farmers, expert guidance is nearly inaccessible.', stat: '1:20K', statLabel: 'Expert Ratio' },
  ];

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">The Problem</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Why Farmers Need <span className="text-green-500">Fasal Rakshak</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Indian agriculture faces critical challenges that cost farmers billions every year.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              viewport={{ once: true }}
              className="p-8 rounded-3xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 hover:border-red-500/40 transition-all group"
            >
              <span className="text-5xl mb-6 block group-hover:scale-110 transition-transform">{problem.icon}</span>
              <h3 className="text-xl font-bold text-white mb-3">{problem.title}</h3>
              <p className="text-slate-400 mb-6 leading-relaxed">{problem.desc}</p>
              <div className="pt-4 border-t border-white/10">
                <span className="text-3xl font-black text-red-400">{problem.stat}</span>
                <span className="text-slate-500 text-sm ml-2">{problem.statLabel}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- IMPACT / APP DEMO SECTION ---
const ImpactSection = ({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) => {
  const features = [
    { icon: '🦠', title: 'Early Disease Detection', desc: 'Identify diseases before they spread. Our AI analyzes leaf patterns to detect issues days before they become visible to the naked eye.' },
    { icon: '📈', title: 'Market Price Insights', desc: 'Know when to sell. Get real-time price alerts from 5+ nearby Mandis and predict future trends using historical data.' },
    { icon: '🧪', title: 'Soil Health Analysis', desc: 'Understand your soil. Get NPK values, pH levels, and personalized fertilizer recommendations from a simple photo.' },
    { icon: '📅', title: 'AI Crop Planner', desc: 'Day-by-day farming calendar from sowing to harvest. Dynamic task checklists personalized for your farm.' },
  ];

  return (
    <section id="demo" className="py-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[150px]" />
      
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* App Simulator */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-[100px] rounded-full" />
            <AppSimulator />
          </motion.div>
          
          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
          >
            <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">How It Works</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
              Real-time Intelligence <br />
              for <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">Every Acre</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              We combine satellite imagery, IoT sensor data, and advanced computer vision to give farmers a complete picture of their crop health.
            </p>
            
            <div className="space-y-6">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="flex gap-5 p-5 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 group-hover:bg-green-500/20 transition-all duration-300">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-green-400 transition-colors">{feature.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- ECOSYSTEM PORTALS ---
const EcosystemSection = ({ setView }: { setView: (view: AppView) => void }) => {
  const portals = [
    { icon: '👨‍🌾', title: 'Farmer Portal', desc: 'AgroHub dashboard, disease diagnosis, crop planning, market intelligence, and community feed.', color: 'green', action: null },
    { icon: '🚚', title: 'Driver Portal', desc: 'Trip radar, earnings wallet, negotiation chat, and route maps for logistics partners.', color: 'orange', action: () => setView(AppView.DRIVER_AUTH) },
    { icon: '🕵️', title: 'Agent Portal', desc: 'Ground truth price verification, reputation scoring, and gamified data collection.', color: 'blue', action: null },
    { icon: '🔐', title: 'Admin Dashboard', desc: 'System health monitoring, user management, emergency controls, and analytics.', color: 'purple', action: null },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    green: { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/30 hover:border-green-500/60', text: 'text-green-400', glow: 'group-hover:shadow-green-500/20' },
    orange: { bg: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/30 hover:border-orange-500/60', text: 'text-orange-400', glow: 'group-hover:shadow-orange-500/20' },
    blue: { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30 hover:border-blue-500/60', text: 'text-blue-400', glow: 'group-hover:shadow-blue-500/20' },
    purple: { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30 hover:border-purple-500/60', text: 'text-purple-400', glow: 'group-hover:shadow-purple-500/20' },
  };

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">The Ecosystem</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Built for the <span className="text-green-500">Entire</span> Agri-Chain
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            A unified platform serving farmers, transporters, market agents, and administrators.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {portals.map((portal, i) => {
            const colors = colorClasses[portal.color];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                onClick={portal.action || undefined}
                className={`group p-8 rounded-3xl bg-gradient-to-br ${colors.bg} border ${colors.border} transition-all duration-300 ${colors.glow} group-hover:shadow-xl ${portal.action ? 'cursor-pointer' : ''}`}
              >
                <span className="text-5xl mb-6 block group-hover:scale-110 transition-transform duration-300">{portal.icon}</span>
                <h3 className={`text-xl font-bold ${colors.text} mb-3`}>{portal.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">{portal.desc}</p>
                {portal.action && (
                  <div className={`mt-4 flex items-center gap-2 ${colors.text} text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Join Now <Icons.ArrowRight />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// --- TECH HIGHLIGHTS ---
const TechSection = () => {
  const techs = [
    { icon: <Icons.Brain />, title: 'AI Council Architecture', desc: 'Multi-agent consensus using 5 AI personas (Botanist, Farmer, Analyst, Critic, System) for accurate diagnosis.' },
    { icon: <Icons.Wifi />, title: 'IoT Integration', desc: 'Real-time soil moisture, temperature, and NPK monitoring with ESP32 firmware generation.' },
    { icon: <Icons.WifiOff />, title: 'Offline-First Design', desc: 'Downloaded TFLite models, knowledge packs, and sync queue for areas with poor connectivity.' },
    { icon: <Icons.Globe />, title: '11 Regional Languages', desc: 'Full voice and text support in Hindi, Odia, Telugu, Tamil, Kannada, Malayalam, and more.' },
    { icon: <Icons.Mic />, title: 'Voice-Native Interface', desc: 'Speech-to-text for form filling and text-to-speech for reading diagnoses in native language.' },
    { icon: <Icons.BarChart />, title: 'Geospatial Intelligence', desc: 'Disease heatmaps with 10km cluster alerts and reverse geocoding for local schemes.' },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent" />
      
      <div className="container mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">Technology</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Cutting-Edge <span className="text-green-500">Innovation</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Built with the latest in AI, IoT, and cloud technology to deliver unmatched performance.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {techs.map((tech, i) => (
            <FeatureCard
              key={i}
              index={i}
              title={tech.title}
              desc={tech.desc}
              icon={tech.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

// --- TESTIMONIALS SECTION ---
const TestimonialsSection = () => {
  const testimonials = [
    { name: 'Ramesh Kumar', role: 'Wheat Farmer, Punjab', quote: 'Fasal Rakshak saved my entire wheat crop from blight. The AI detected it 5 days before I could see it myself!', avatar: 'RK' },
    { name: 'Priya Devi', role: 'Cotton Farmer, Gujarat', quote: 'The market price alerts helped me sell at the best time. I earned ₹15,000 more than last year.', avatar: 'PD' },
    { name: 'Suresh Reddy', role: 'Rice Farmer, Telangana', quote: 'I can use it in Telugu and even without internet. Perfect for my farm in the village.', avatar: 'SR' },
    { name: 'Balwinder Singh', role: 'Driver Partner, Haryana', quote: 'As a truck driver, I get regular trips from farmers. The app makes negotiation easy and fair.', avatar: 'BS' },
  ];

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">Testimonials</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Trusted by <span className="text-green-500">50,000+</span> Farmers
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Real stories from real farmers across India.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, i) => (
            <TestimonialCard key={i} {...testimonial} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface LandingPageProps {
  onStart: () => void;
  onLogin: () => void;
  user?: User | null;
  onUserUpdate?: (user: User) => void;
  onAgroHubClick?: () => void;
  onScan?: () => void;
  setView: (view: AppView) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, onLogin, user, onUserUpdate, onAgroHubClick, onScan, setView }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentPlan, setPaymentPlan] = useState<Plan | null>(null);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null); 

  useEffect(() => { fetchPlans().then(setPlans); }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setIsScrolled(containerRef.current.scrollTop > 50);
      }
    };
    const container = containerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePlanSelect = async (plan: Plan) => {
    if (!user) { onLogin(); return; }
    if (user.plan_id === plan.id) return;
    if (plan.price === 0) {
       const res = await initiatePayment(user, plan);
       if (res.success && res.updatedUser && onUserUpdate) {
           onUserUpdate(res.updatedUser);
           alert("Plan updated to Free.");
       }
       return;
    }
    setPaymentPlan(plan);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const faqs = [
    { question: 'Does Fasal Rakshak work offline?', answer: 'Yes! You can download AI models and knowledge packs for offline use. Your actions are queued and automatically synced when you reconnect to the internet.' },
    { question: 'What languages are supported?', answer: 'We support 11 regional languages including Hindi, Odia, Telugu, Tamil, Kannada, Malayalam, Gujarati, Marathi, Punjabi, and Bengali. Both voice input and text output work in your native language.' },
    { question: 'How accurate is the AI diagnosis?', answer: 'Our multi-agent AI council achieves 98% accuracy by combining visual analysis with weather data, soil conditions, and location context to eliminate false positives.' },
    { question: 'What if I have poor internet connectivity?', answer: 'The app automatically detects slow connections and switches to lightweight mode. Heavy features like video are disabled, and you can use downloaded models for basic diagnosis.' },
    { question: 'Can I talk to real experts?', answer: 'Yes! Pro plan subscribers get access to priority expert chat where you can consult with agricultural specialists directly within the app.' },
    { question: 'How do I connect IoT sensors?', answer: 'Fasal Rakshak generates custom ESP32 firmware code based on your WiFi credentials. Simply upload it to your sensor, and data flows directly to your dashboard.' },
  ];

  return (
    <div 
      ref={containerRef} 
      className="bg-[#050a08] h-full overflow-y-auto overflow-x-hidden text-slate-200 font-sans selection:bg-emerald-500/30 scroll-smooth"
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* Payment Modal */}
      {paymentPlan && user && (
        <PaymentModal 
          plan={paymentPlan} 
          user={user} 
          onClose={() => setPaymentPlan(null)} 
          onSuccess={(updatedUser) => {
            if (onUserUpdate) onUserUpdate(updatedUser);
            setPaymentPlan(null);
          }} 
        />
      )}

      {/* NAVBAR */}
      <motion.nav 
        className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-500 ${
          isScrolled 
            ? 'bg-[#050a08]/95 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={scrollToTop}
          >
            <span className="text-3xl group-hover:scale-110 transition-transform">🌱</span>
            <span className="font-black text-xl text-white tracking-tight">Fasal Rakshak</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:flex items-center gap-8"
          >
            <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-slate-300 hover:text-green-400 transition-colors relative group">
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
            </button>
            <button onClick={() => scrollToSection('demo')} className="text-sm font-medium text-slate-300 hover:text-green-400 transition-colors relative group">
              Demo
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-sm font-medium text-slate-300 hover:text-green-400 transition-colors relative group">
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-sm font-medium text-slate-300 hover:text-green-400 transition-colors relative group">
              FAQ
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
            </button>
            <button 
              onClick={() => setView(AppView.DRIVER_AUTH)} 
              className="text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20"
            >
              🚚 Partner with Us
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            {user ? (
              <MagneticButton 
                onClick={onAgroHubClick} 
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all"
              >
                Dashboard
              </MagneticButton>
            ) : (
              <MagneticButton 
                onClick={onLogin} 
                className="px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white hover:text-black transition-all backdrop-blur-md"
              >
                Login
              </MagneticButton>
            )}
          </motion.div>
        </div>
      </motion.nav>

      {/* HERO SECTION */}
      <ParallaxHero onStart={onStart} containerRef={containerRef} />

      {/* STATS SECTION */}
      <StatsSection />

      {/* PROBLEMS SECTION */}
      <ProblemsSection />

      {/* DEMO / IMPACT SECTION */}
      <ImpactSection containerRef={containerRef} />

      {/* FEATURES SECTION */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">Features</span>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
              Intelligence for <span className="text-green-500">Every Acre</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Comprehensive tools designed specifically for the modern Indian farmer.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              index={0}
              title="Dr. AI Diagnosis" 
              desc="Identify 500+ plant diseases instantly with a single photo. Get chemical & organic treatment plans with exact dosage."
              icon={<Icons.Scan />}
            />
            
            <GlowingCard glowColor="orange" className="h-full">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="group relative h-full p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-500/5 border border-orange-500/20 hover:border-orange-500/50 transition-all duration-500 backdrop-blur-sm overflow-hidden cursor-pointer"
                onClick={() => setView(AppView.DRIVER_AUTH)}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-orange-400 mb-6 group-hover:scale-110 transition-transform duration-300 border border-orange-500/20">
                  <Icons.Truck />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-orange-400 transition-colors">Logistics Network</h3>
                <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">Connect with verified drivers to transport harvest to Mandis at fair prices with real-time tracking.</p>
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-orange-500 to-red-500 w-0 group-hover:w-full transition-all duration-700" />
                <div className="mt-4 flex items-center gap-2 text-orange-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Register Vehicle <Icons.ArrowRight />
                </div>
              </motion.div>
            </GlowingCard>

            <FeatureCard 
              index={2}
              title="IoT Sentinel" 
              desc="Real-time monitoring of soil moisture, temperature, and NPK levels with auto-generated ESP32 firmware."
              icon={<Icons.Zap />}
            />
            <FeatureCard 
              index={3}
              title="Market Prediction" 
              desc="Know when to sell. Our algorithms analyze Mandi prices across 5+ nearby markets with AI recommendations."
              icon={<Icons.BarChart />}
            />
            <FeatureCard 
              index={4}
              title="Crop Calendar" 
              desc="Day-by-day farming schedule from sowing to harvest. Dynamic task checklists personalized for your farm."
              icon={<Icons.Calendar />}
            />
            <FeatureCard 
              index={5}
              title="Voice Native" 
              desc="Speak in your language. Full voice support in 11+ regional languages for hands-free operation."
              icon={<Icons.Mic />}
            />
          </div>
        </div>
      </section>

      {/* ECOSYSTEM SECTION */}
      <EcosystemSection setView={setView} />

      {/* TECH SECTION */}
      <TechSection />

      {/* TESTIMONIALS */}
      <TestimonialsSection />

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent" />
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              Simple, <span className="text-green-500">Transparent</span> Pricing
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Start free. Upgrade when you need more power.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.length > 0 ? (
              plans.map((plan, i) => (
                <PricingCard 
                  key={plan.id} 
                  plan={plan} 
                  isPopular={i === 1}
                  onSelect={handlePlanSelect}
                  currentPlanId={user?.plan_id}
                />
              ))
            ) : (
              <>
                <PricingCard 
                  plan={{ id: '1', name: 'Free', price: 0, max_diagnoses: 3, features: ['3 scans/day', 'Basic market data', 'Weather alerts', 'Community access'] } as Plan}
                  onSelect={handlePlanSelect}
                  currentPlanId={user?.plan_id}
                />
                <PricingCard 
                  plan={{ id: '2', name: 'Kisan Plus', price: 199, max_diagnoses: 15, features: ['15 scans/day', 'IoT integration', 'Full market intel', 'Crop calendar', 'Priority support'] } as Plan}
                  isPopular
                  onSelect={handlePlanSelect}
                  currentPlanId={user?.plan_id}
                />
                <PricingCard 
                  plan={{ id: '3', name: 'Kisan Pro', price: 499, max_diagnoses: 40, features: ['40 scans/day', 'Historical data', 'Expert chat access', 'Custom reports', 'API access'] } as Plan}
                  onSelect={handlePlanSelect}
                  currentPlanId={user?.plan_id}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-emerald-600/20 to-green-600/20" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvZz48L3N2Zz4=')] opacity-30" />
        
        <div className="container mx-auto px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              Ready to Protect Your Harvest?
            </h2>
            <p className="text-xl text-slate-300 mb-10">
              Join 50,000+ farmers who are already growing smarter with Fasal Rakshak.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <MagneticButton 
                onClick={onStart}
                className="group px-10 py-5 bg-white text-black font-bold rounded-full transition-all shadow-2xl hover:shadow-white/20 flex items-center gap-3 text-lg"
              >
                Get Started Free
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Icons.ArrowRight />
                </motion.span>
              </MagneticButton>
              <button 
                onClick={() => setView(AppView.DRIVER_AUTH)}
                className="px-8 py-4 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold rounded-full transition-all border border-orange-500/30 flex items-center gap-2"
              >
                🚚 Become a Partner
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 mt-10 text-slate-400 text-sm">
              <span className="flex items-center gap-2"><Icons.Check /> No credit card required</span>
              <span className="flex items-center gap-2"><Icons.Check /> Free forever plan</span>
              <span className="flex items-center gap-2"><Icons.Check /> Cancel anytime</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">FAQ</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              Common <span className="text-green-500">Questions</span>
            </h2>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 border-t border-white/10 bg-black/50 relative">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🌱</span>
                <span className="font-black text-2xl text-white">Fasal Rakshak</span>
              </div>
              <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                AI-powered farming platform empowering Indian farmers with instant disease diagnosis, market intelligence, and expert guidance in 11 languages.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-green-500 transition-colors">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-green-500 transition-colors">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-green-500 transition-colors">
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-slate-400">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-green-400 transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-green-400 transition-colors">Pricing</button></li>
                <li><button onClick={() => scrollToSection('demo')} className="hover:text-green-400 transition-colors">Demo</button></li>
                <li><button onClick={() => scrollToSection('faq')} className="hover:text-green-400 transition-colors">FAQ</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-slate-400">
                <li><a href="#" className="hover:text-green-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-green-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-green-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-green-400 transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">
              © 2025 CropSafe AI Systems. Built for the Future of Farming.
            </p>
            <div className="flex gap-6 text-slate-500 text-sm">
              <a href="#" className="hover:text-green-400 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-green-400 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-green-400 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* SCROLL TO TOP BUTTON */}
      <AnimatePresence>
        {isScrolled && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 w-12 h-12 bg-green-500 hover:bg-green-400 text-white rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6"/>
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};