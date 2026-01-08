import {
  AnimatePresence,
  motion,
  PanInfo,
  useDragControls,
  useInView,
  useMotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { AppView, Plan, User } from "../types";
// @ts-ignore
import { fetchPlans } from "../services/cmsService";
import { initiatePayment } from "../services/paymentService";
import { AppSimulator } from "./AppSimulator";
import { PaymentModal } from "./PaymentModal";

// --- THEME CONTEXT ---
type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: "dark",
  toggleTheme: () => {},
});

const useTheme = () => useContext(ThemeContext);

// --- THEME PROVIDER WRAPPER ---
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("fasal-theme") as Theme;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("fasal-theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme === "light" ? "light-mode" : ""}>{children}</div>
    </ThemeContext.Provider>
  );
};

// --- PERFORMANCE: DETECT LOW-POWER/SLOW DEVICES ---
const useReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [isLowPower, setIsLowPower] = useState(false);

  useEffect(() => {
    // Check for prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);
    
    // Check for low-power indicators
    const connection = (navigator as any).connection;
    const isSlowConnection = connection && (
      connection.saveData || 
      connection.effectiveType === 'slow-2g' || 
      connection.effectiveType === '2g' ||
      connection.effectiveType === '3g'
    );
    
    // Check device memory (if available)
    const deviceMemory = (navigator as any).deviceMemory;
    const isLowMemory = deviceMemory && deviceMemory < 4;
    
    // Check hardware concurrency
    const cores = navigator.hardwareConcurrency || 4;
    const isLowCPU = cores < 4;
    
    setIsLowPower(isSlowConnection || isLowMemory || isLowCPU);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced || isLowPower;
};

// Create a context for reduced motion
const ReducedMotionContext = React.createContext(false);
const useIsReducedMotion = () => React.useContext(ReducedMotionContext);

// --- PERFORMANCE: ASSET CACHE MANAGER ---
const CACHE_KEY = 'fasal-landing-cache';
const CACHE_VERSION = 'v1';

const AssetCache = {
  set: (key: string, data: any) => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[key] = { data, timestamp: Date.now(), version: CACHE_VERSION };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // Storage full or unavailable
    }
  },
  get: (key: string, maxAge = 3600000) => { // 1 hour default
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const item = cache[key];
      if (item && item.version === CACHE_VERSION && Date.now() - item.timestamp < maxAge) {
        return item.data;
      }
    } catch (e) {}
    return null;
  },
  preloadImage: (src: string) => {
    const img = new Image();
    img.src = src;
  }
};

// --- PERFORMANCE: LAZY SECTION COMPONENT ---
const LazySection = ({ 
  children, 
  fallback = null,
  rootMargin = '200px'
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
  rootMargin?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: rootMargin });
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isInView) {
      setShouldRender(true);
    }
  }, [isInView]);

  return (
    <div ref={ref}>
      {shouldRender ? children : fallback || (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

// --- PERFORMANCE: PRELOAD NEXT SECTIONS ---
const usePreloadSections = (currentSection: string) => {
  useEffect(() => {
    const sectionOrder = ['hero', 'stats', 'problems', 'impact', 'video', 'ai-council', 'features', 'partners', 'personas', 'ecosystem', 'tech', 'testimonials', 'pricing', 'cta', 'faq'];
    const currentIndex = sectionOrder.indexOf(currentSection);
    
    // Preload next 3 sections by triggering their IntersectionObserver
    if (currentIndex >= 0 && currentIndex < sectionOrder.length - 3) {
      // Small delay to not block main thread
      requestIdleCallback?.(() => {
        // This triggers lazy loading preparation
      }) || setTimeout(() => {}, 100);
    }
  }, [currentSection]);
};

// --- ICONS ---
const Icons = {
  Leaf: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.5 2 9 0 5.5-4.5 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  Scan: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Zap: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Brain: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  Shield: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  Check: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Star: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Globe: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Wifi: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  Smartphone: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  Truck: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 17h4V5H2v12h3" />
      <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
  Users: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  PlayCircle: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  ),
  ArrowRight: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Calendar: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  BarChart: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  Mic: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  WifiOff: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
};

// --- ANIMATED COUNTER COMPONENT ---
const AnimatedCounter = ({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) => {
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

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
};

// --- FLOATING PARTICLES BACKGROUND ---
const FloatingParticles = () => {
  const reducedMotion = useIsReducedMotion();
  
  // Show fewer particles on low-power devices
  const particleCount = reducedMotion ? 8 : 30;
  const shapeCount = reducedMotion ? 2 : 5;
  
  if (reducedMotion) {
    // Simple static gradient for reduced motion
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(particleCount)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 8 + 2,
            height: Math.random() * 8 + 2,
            background: `radial-gradient(circle, ${
              i % 3 === 0
                ? "rgba(34, 197, 94, 0.4)"
                : i % 3 === 1
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(52, 211, 153, 0.3)"
            }, transparent)`,
            boxShadow: i % 4 === 0 ? "0 0 15px rgba(34, 197, 94, 0.5)" : "none",
          }}
          initial={{
            x:
              Math.random() *
              (typeof window !== "undefined" ? window.innerWidth : 1000),
            y:
              Math.random() *
              (typeof window !== "undefined" ? window.innerHeight : 800),
            scale: 0,
          }}
          animate={{
            y: [null, Math.random() * -600 - 100],
            x: [null, (Math.random() - 0.5) * 200],
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1.2, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: Math.random() * 8 + 6,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeOut",
          }}
        />
      ))}
      {/* Floating 3D shapes */}
      {[...Array(shapeCount)].map((_, i) => (
        <motion.div
          key={`shape-${i}`}
          className="absolute"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 20}%`,
          }}
          animate={{
            rotateX: [0, 360],
            rotateY: [0, 360],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 10 + i * 2,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <div
            className="w-8 h-8 border border-green-500/20"
            style={{
              transform: "perspective(100px) rotateX(45deg) rotateY(45deg)",
              background:
                "linear-gradient(135deg, rgba(34, 197, 94, 0.1), transparent)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

// --- ANIMATED TEXT WITH HOVER EFFECT ---
const AnimatedText = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const reducedMotion = useIsReducedMotion();
  
  // In reduced motion mode, just render static text
  if (reducedMotion) {
    return <span className={className}>{text}</span>;
  }
  
  const letters = text.split("");

  return (
    <span className={`inline-flex ${className}`}>
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          className="inline-block cursor-default"
          whileHover={{
            scale: 1.4,
            color: "#22c55e",
            textShadow: "0 0 20px rgba(34, 197, 94, 0.8)",
            y: -5,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          {letter === " " ? "\u00A0" : letter}
        </motion.span>
      ))}
    </span>
  );
};

// --- WAVE TEXT ANIMATION ---
const WaveText = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const reducedMotion = useIsReducedMotion();
  
  // In reduced motion mode, just render static text
  if (reducedMotion) {
    return <span className={className}>{text}</span>;
  }
  
  const letters = text.split("");
  return (
    <span className={`inline-flex ${className}`}>
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          className="inline-block"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.05,
            ease: "easeInOut",
          }}
        >
          {letter === " " ? "\u00A0" : letter}
        </motion.span>
      ))}
    </span>
  );
};

// --- TYPEWRITER TEXT ANIMATION ---
const TypewriterText = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const [displayText, setDisplayText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, 80);
      return () => clearTimeout(timeout);
    }
  }, [index, text]);

  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-6 bg-green-500 ml-1"
      />
    </span>
  );
};

// --- GLITCH TEXT ANIMATION ---
const GlitchText = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  return (
    <motion.span
      className={`relative inline-block ${className}`}
      whileHover="hover"
    >
      <span className="relative z-10">{text}</span>
      <motion.span
        className="absolute top-0 left-0 text-red-500 opacity-0"
        variants={{
          hover: {
            opacity: 0.8,
            x: [-2, 2, -2],
            transition: { duration: 0.2, repeat: Infinity },
          },
        }}
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute top-0 left-0 text-cyan-500 opacity-0"
        variants={{
          hover: {
            opacity: 0.8,
            x: [2, -2, 2],
            transition: { duration: 0.2, repeat: Infinity },
          },
        }}
      >
        {text}
      </motion.span>
    </motion.span>
  );
};

// --- SMART FARMING TYPING EFFECT ---
const SmartFarmingTyping = () => {
  const reducedMotion = useIsReducedMotion();
  // Smart Farming in 11 Indian languages
  const languages = [
    "Smart Farming",        // English
    "स्मार्ट खेती",           // Hindi
    "స్మార్ట్ వ్యవసాయం",       // Telugu
    "ஸ்மார்ட் விவசாயம்",     // Tamil
    "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ",          // Kannada
    "സ്മാർട്ട് കൃഷി",        // Malayalam
    "স্মার্ট চাষ",           // Bengali
    "સ્માર્ટ ખેતી",          // Gujarati
    "ਸਮਾਰਟ ਖੇਤੀ",           // Punjabi
    "स्मार्ट शेती",          // Marathi
    "ସ୍ମାର୍ଟ ଚାଷ"            // Odia
  ];
  
  const [langIndex, setLangIndex] = useState(0);
  const [displayText, setDisplayText] = useState(reducedMotion ? languages[0] : "");
  const [isDeleting, setIsDeleting] = useState(false);
  const currentText = languages[langIndex];
  const isTyping = !isDeleting && displayText.length < currentText.length;

  useEffect(() => {
    if (reducedMotion) return;
    
    if (!isDeleting) {
      // Typing
      if (displayText.length < currentText.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, displayText.length + 1));
        }, 100);
        return () => clearTimeout(timeout);
      } else {
        // Finished typing, pause then start deleting
        const timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
        return () => clearTimeout(timeout);
      }
    } else {
      // Deleting
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        // Finished deleting, move to next language
        setIsDeleting(false);
        setLangIndex((prev) => (prev + 1) % languages.length);
      }
    }
  }, [displayText, isDeleting, langIndex, reducedMotion]);

  return (
    <motion.span className="relative inline-block min-w-[280px] sm:min-w-[350px]">
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500">
        {displayText}
        {isTyping && !reducedMotion && (
          <motion.span
            className="inline-block w-[3px] h-[0.9em] bg-green-400 ml-1 align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </span>
    </motion.span>
  );
};

// --- GRADIENT TEXT ANIMATION ---
const GradientText = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const reducedMotion = useIsReducedMotion();
  
  // In reduced motion mode, skip the background animation
  if (reducedMotion) {
    return (
      <span className={`inline-block bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400 ${className}`}>
        {text}
      </span>
    );
  }
  
  return (
    <motion.span
      className={`inline-block bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400 ${className}`}
      animate={{
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      }}
      style={{ backgroundSize: "200% 200%" }}
      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
    >
      {text}
    </motion.span>
  );
};

// --- SLIDE UP TEXT (for headings) ---
const SlideUpText = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const reducedMotion = useIsReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  // In reduced motion mode, skip animation
  if (reducedMotion) {
    return <span className={`inline-block ${className}`}>{children}</span>;
  }

  return (
    <motion.span
      ref={ref}
      className={`inline-block ${className}`}
      initial={{ y: 60, opacity: 0, rotateX: -15 }}
      animate={isInView ? { y: 0, opacity: 1, rotateX: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
};

// --- FADE IN WORDS (for sentences) ---
const FadeInWords = ({
  text,
  className = "",
  staggerDelay = 0.05,
}: {
  text: string;
  className?: string;
  staggerDelay?: number;
}) => {
  const reducedMotion = useIsReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });
  const words = text.split(" ");

  // In reduced motion mode, just render text
  if (reducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-1.5"
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
          transition={{ duration: 0.5, delay: i * staggerDelay }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

// --- SHIMMER TEXT (for card titles) ---
const ShimmerText = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const reducedMotion = useIsReducedMotion();
  
  // In reduced motion mode, just render text without shimmer
  if (reducedMotion) {
    return <span className={`inline-block ${className}`}>{children}</span>;
  }
  
  return (
    <motion.span
      className={`inline-block relative ${className}`}
      whileHover={{ scale: 1.02 }}
    >
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        animate={{ x: ["-200%", "200%"] }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 1,
        }}
      />
    </motion.span>
  );
};

// --- BOUNCE IN TEXT (for card content) ---
const BounceInText = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const reducedMotion = useIsReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  // In reduced motion mode, skip animation
  if (reducedMotion) {
    return <span className={`inline-block ${className}`}>{children}</span>;
  }

  return (
    <motion.span
      ref={ref}
      className={`inline-block ${className}`}
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{
        duration: 0.6,
        delay,
        type: "spring",
        stiffness: 200,
        damping: 15,
      }}
    >
      {children}
    </motion.span>
  );
};

// --- SPLIT REVEAL TEXT (for subheadings) ---
const SplitRevealText = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const reducedMotion = useIsReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });

  // In reduced motion mode, just render text
  if (reducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span ref={ref} className={`inline-block overflow-hidden ${className}`}>
      <motion.span
        className="inline-block"
        initial={{ y: "100%" }}
        animate={isInView ? { y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {text}
      </motion.span>
    </span>
  );
};

// --- ROTATING WORDS (for dynamic text) ---
const RotatingWords = ({
  words,
  className = "",
}: {
  words: string[];
  className?: string;
}) => {
  const reducedMotion = useIsReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return; // Don't run interval in reduced motion mode
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [words.length, reducedMotion]);

  // In reduced motion mode, just show first word
  if (reducedMotion) {
    return <span className={className}>{words[0]}</span>;
  }

  return (
    <span className={`inline-block relative ${className}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: 30, opacity: 0, rotateX: -90 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          exit={{ y: -30, opacity: 0, rotateX: 90 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-block"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

// --- GLOW PULSE TEXT ---
const GlowPulseText = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const reducedMotion = useIsReducedMotion();
  
  // In reduced motion mode, just render text without animation
  if (reducedMotion) {
    return <span className={className}>{children}</span>;
  }
  
  return (
    <motion.span
      className={`inline-block ${className}`}
      animate={{
        textShadow: [
          "0 0 10px rgba(34, 197, 94, 0.3)",
          "0 0 30px rgba(34, 197, 94, 0.6)",
          "0 0 10px rgba(34, 197, 94, 0.3)",
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.span>
  );
};

// --- THEME TOGGLE BUTTON (keeping for compatibility but not using) ---
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full bg-slate-700 dark:bg-slate-600 p-1 transition-colors"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className="w-5 h-5 rounded-full bg-white flex items-center justify-center"
        animate={{ x: theme === "light" ? 0 : 28 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <motion.span className="text-xs">
          {theme === "light" ? "☀️" : "🌙"}
        </motion.span>
      </motion.div>
    </motion.button>
  );
};

// --- 3D ROTATING CARD ---
const Rotating3DCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateYValue = ((e.clientX - centerX) / (rect.width / 2)) * 15;
    const rotateXValue = -((e.clientY - centerY) / (rect.height / 2)) * 15;
    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`${className}`}
      style={{
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
      animate={{
        rotateX,
        rotateY,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
};

// --- VIDEO EXPLAINER SECTION ---
const VideoExplainerSection = () => {
  const [isHovered, setIsHovered] = useState(false);

  // Load Wistia scripts
  useEffect(() => {
    // Add Wistia player script
    const playerScript = document.createElement("script");
    playerScript.src = "https://fast.wistia.com/player.js";
    playerScript.async = true;
    document.head.appendChild(playerScript);

    // Add Wistia embed script
    const embedScript = document.createElement("script");
    embedScript.src = "https://fast.wistia.com/embed/jsl50qglay.js";
    embedScript.async = true;
    embedScript.type = "module";
    document.head.appendChild(embedScript);

    return () => {
      // Cleanup scripts on unmount
      document.head.removeChild(playerScript);
      document.head.removeChild(embedScript);
    };
  }, []);

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Animated background blobs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[150px]"
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[150px]"
        animate={{
          scale: [1, 1.3, 1],
          x: [0, -50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 font-medium text-sm mb-6"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              🎬
            </motion.span>
            <TypewriterText text="See It In Action" />
          </motion.span>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
            <SlideUpText>
              <WaveText text="Watch How It Works" className="text-white" />
            </SlideUpText>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            <FadeInWords text="Experience the power of AI-driven farming in this quick walkthrough" />
          </p>
        </motion.div>

        <Rotating3DCard className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Glowing border effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 rounded-3xl opacity-30 blur-lg group-hover:opacity-60 transition-opacity duration-500" />

            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-white/10 overflow-hidden">
              {/* Wistia Video container with aspect ratio */}
              <div className="relative aspect-video">
                <style>
                  {`
                    wistia-player[media-id='jsl50qglay']:not(:defined) {
                      background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/jsl50qglay/swatch');
                      display: block;
                      filter: blur(5px);
                    }
                  `}
                </style>
                <div
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{
                    __html: `<wistia-player media-id="jsl50qglay" aspect="1.7777777777777777" style="width: 100%; height: 100%;"></wistia-player>`,
                  }}
                />
              </div>

              {/* Feature highlights below video */}
              <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
                {[
                  {
                    icon: "📱",
                    label: "Easy to Use",
                    desc: "Intuitive interface",
                  },
                  {
                    icon: "🎯",
                    label: "Accurate AI",
                    desc: "98% detection rate",
                  },
                  {
                    icon: "🌍",
                    label: "Works Offline",
                    desc: "No internet needed",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    className="p-6 text-center group/item cursor-pointer"
                    whileHover={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                  >
                    <motion.span
                      className="text-3xl block mb-2"
                      whileHover={{ scale: 1.3, rotate: 10 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      {item.icon}
                    </motion.span>
                    <h4 className="font-bold text-white group-hover/item:text-green-400 transition-colors">
                      {item.label}
                    </h4>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </Rotating3DCard>
      </div>
    </section>
  );
};

// --- MAGNETIC BUTTON ---
const MagneticButton = ({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) => {
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
const GlowingCard = ({
  children,
  className,
  glowColor = "green",
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) => {
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
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${
            mousePosition.y
          }px, ${
            glowColor === "green"
              ? "rgba(34, 197, 94, 0.15)"
              : "rgba(249, 115, 22, 0.15)"
          }, transparent 40%)`,
        }}
      />
      {children}
    </motion.div>
  );
};

// --- FEATURE CARD COMPONENT WITH 3D EFFECTS ---
const FeatureCard = ({
  title,
  desc,
  icon,
  index,
  gradient,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  index: number;
  gradient?: string;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <GlowingCard className="h-full">
      <motion.div
        initial={{ opacity: 0, y: 50, rotateX: -10 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{
          duration: 0.6,
          delay: index * 0.1,
          ease: [0.22, 1, 0.36, 1],
        }}
        viewport={{ once: true, margin: "-50px" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="h-full p-8 rounded-3xl border border-white/10 hover:border-green-500/30 transition-all duration-500 relative overflow-hidden group"
        style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
      >
        {/* Animated background pattern */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(34, 197, 94, 0.15) 0%, transparent 50%)",
          }}
        />

        {/* Floating particles on hover */}
        <AnimatePresence>
          {isHovered &&
            [...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-green-400 rounded-full"
                initial={{
                  opacity: 0,
                  x: Math.random() * 100,
                  y: 100,
                  scale: 0,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  y: -20,
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.1,
                  ease: "easeOut",
                }}
              />
            ))}
        </AnimatePresence>

        <motion.div
          className={`w-14 h-14 rounded-2xl ${
            gradient || "bg-gradient-to-br from-green-500/20 to-emerald-600/20"
          } flex items-center justify-center text-green-400 mb-6 border border-green-500/20 relative`}
          animate={{
            rotateY: isHovered ? 360 : 0,
            scale: isHovered ? 1.15 : 1,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {icon}
          {/* Icon glow effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-green-500/20 blur-xl"
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>

        <motion.h3
          className="text-xl font-bold text-white mb-3 group-hover:text-green-400 transition-colors duration-300"
          animate={{ x: isHovered ? 5 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {title}
        </motion.h3>
        <motion.p
          className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors duration-300"
          animate={{ x: isHovered ? 5 : 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          {desc}
        </motion.p>

        {/* Animated bottom bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: isHovered ? "100%" : 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Corner accent */}
        <motion.div
          className="absolute top-0 right-0 w-20 h-20"
          style={{
            background:
              "linear-gradient(135deg, transparent 50%, rgba(34, 197, 94, 0.1) 50%)",
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </GlowingCard>
  );
};

// --- HOVER SCALE TEXT ---
const HoverScaleText = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.span
      className={`inline-block cursor-default ${className}`}
      whileHover={{
        scale: 1.05,
        color: "#22c55e",
        textShadow: "0 0 20px rgba(34, 197, 94, 0.5)",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      {children}
    </motion.span>
  );
};

// --- AI COUNCIL FLIP CARD ---
const AICouncilCard = ({
  persona,
  index,
  isActive,
  onClick,
}: {
  persona: {
    name: string;
    role: string;
    icon: string;
    color: string;
    description: string;
    expertise: string[];
  };
  index: number;
  isActive: boolean;
  onClick: () => void;
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const colorClasses: Record<
    string,
    { bg: string; border: string; text: string; glow: string }
  > = {
    green: {
      bg: "from-green-500/20 to-emerald-600/10",
      border: "border-green-500/40",
      text: "text-green-400",
      glow: "shadow-green-500/30",
    },
    blue: {
      bg: "from-blue-500/20 to-cyan-600/10",
      border: "border-blue-500/40",
      text: "text-blue-400",
      glow: "shadow-blue-500/30",
    },
    purple: {
      bg: "from-purple-500/20 to-violet-600/10",
      border: "border-purple-500/40",
      text: "text-purple-400",
      glow: "shadow-purple-500/30",
    },
    orange: {
      bg: "from-orange-500/20 to-amber-600/10",
      border: "border-orange-500/40",
      text: "text-orange-400",
      glow: "shadow-orange-500/30",
    },
    cyan: {
      bg: "from-cyan-500/20 to-teal-600/10",
      border: "border-cyan-500/40",
      text: "text-cyan-400",
      glow: "shadow-cyan-500/30",
    },
  };

  const colors = colorClasses[persona.color] || colorClasses.green;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="relative w-72 h-96 cursor-pointer perspective-1000"
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={onClick}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Front of card */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${colors.bg} border ${colors.border} p-6 flex flex-col items-center justify-center backface-hidden`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <motion.div
            className="text-7xl mb-4"
            animate={{
              y: [0, -10, 0],
              rotate: isActive ? [0, 5, -5, 0] : 0,
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {persona.icon}
          </motion.div>
          <h3 className={`text-2xl font-bold ${colors.text} mb-2`}>
            {persona.name}
          </h3>
          <p className="text-slate-400 text-center text-sm">{persona.role}</p>

          {/* Glowing ring when active */}
          {isActive && (
            <motion.div
              className={`absolute inset-0 rounded-3xl border-2 ${colors.border} ${colors.glow}`}
              animate={{
                boxShadow: [
                  "0 0 20px rgba(34, 197, 94, 0.3)",
                  "0 0 40px rgba(34, 197, 94, 0.5)",
                  "0 0 20px rgba(34, 197, 94, 0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>

        {/* Back of card */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border ${colors.border} p-6 flex flex-col backface-hidden`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{persona.icon}</span>
            <h3 className={`text-xl font-bold ${colors.text}`}>
              {persona.name}
            </h3>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {persona.description}
          </p>
          <div className="mt-auto">
            <p className={`text-xs font-semibold ${colors.text} mb-2`}>
              EXPERTISE:
            </p>
            <div className="flex flex-wrap gap-2">
              {persona.expertise.map((skill, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-white/5 rounded-full text-xs text-slate-400"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- AI COUNCIL SECTION WITH AUTO-ROTATE CAROUSEL ---
const AICouncilSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const dragControls = useDragControls();
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const personas = [
    {
      name: "Dr. Botanist",
      role: "Plant Disease Expert",
      icon: "🧬",
      color: "green",
      description:
        "Specializes in plant pathology, identifying diseases from visual symptoms, and understanding disease progression patterns.",
      expertise: ["Pathology", "Symptoms", "Treatment"],
    },
    {
      name: "Kisan Expert",
      role: "Traditional Farming Wisdom",
      icon: "👨‍🌾",
      color: "orange",
      description:
        "Brings decades of traditional farming knowledge, understanding local conditions and practical remedies.",
      expertise: ["Local Knowledge", "Remedies", "Seasons"],
    },
    {
      name: "Data Analyst",
      role: "Pattern Recognition",
      icon: "📊",
      color: "blue",
      description:
        "Analyzes historical data, weather patterns, and market trends to provide data-driven insights.",
      expertise: ["Analytics", "Predictions", "Trends"],
    },
    {
      name: "The Critic",
      role: "Quality Assurance",
      icon: "🔍",
      color: "purple",
      description:
        "Challenges assumptions, identifies edge cases, and ensures diagnosis accuracy before final output.",
      expertise: ["Validation", "Edge Cases", "Accuracy"],
    },
    {
      name: "System AI",
      role: "Final Consensus Builder",
      icon: "🤖",
      color: "cyan",
      description:
        "Synthesizes all perspectives, weighs confidence levels, and delivers the final unanimous diagnosis.",
      expertise: ["Synthesis", "Consensus", "Output"],
    },
    {
      name: "Late Blight",
      role: "🦠 Example Disease Detection",
      icon: "🍅",
      color: "red",
      description:
        "Detected on Tomato: Dark brown spots with white fuzzy growth on leaf undersides. Caused by Phytophthora infestans. Treat with copper-based fungicide immediately.",
      expertise: ["Severity: High", "Spread: Fast", "Action: Urgent"],
    },
  ];

  const colorClasses: Record<
    string,
    { bg: string; border: string; text: string; glow: string; lightBg: string }
  > = {
    green: {
      bg: "from-green-500/20 to-emerald-600/10",
      lightBg: "from-green-100 to-emerald-50",
      border: "border-green-500/30",
      text: "text-green-400",
      glow: "shadow-green-500/30",
    },
    orange: {
      bg: "from-orange-500/20 to-amber-600/10",
      lightBg: "from-orange-100 to-amber-50",
      border: "border-orange-500/30",
      text: "text-orange-400",
      glow: "shadow-orange-500/30",
    },
    blue: {
      bg: "from-blue-500/20 to-indigo-600/10",
      lightBg: "from-blue-100 to-indigo-50",
      border: "border-blue-500/30",
      text: "text-blue-400",
      glow: "shadow-blue-500/30",
    },
    purple: {
      bg: "from-purple-500/20 to-violet-600/10",
      lightBg: "from-purple-100 to-violet-50",
      border: "border-purple-500/30",
      text: "text-purple-400",
      glow: "shadow-purple-500/30",
    },
    cyan: {
      bg: "from-cyan-500/20 to-teal-600/10",
      lightBg: "from-cyan-100 to-teal-50",
      border: "border-cyan-500/30",
      text: "text-cyan-400",
      glow: "shadow-cyan-500/30",
    },
    red: {
      bg: "from-red-500/20 to-rose-600/10",
      lightBg: "from-red-100 to-rose-50",
      border: "border-red-500/30",
      text: "text-red-400",
      glow: "shadow-red-500/30",
    },
  };

  // Auto-rotate every 3 seconds (15 seconds when hovered - 5x slower)
  useEffect(() => {
    const rotationSpeed = isHovered ? 15000 : 3000;
    const interval = setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % personas.length);
    }, rotationSpeed);
    return () => clearInterval(interval);
  }, [personas.length, isHovered]);

  // Handle swipe on mobile
  const handleDragEnd = (
    e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % personas.length);
    } else if (info.offset.x > threshold) {
      setDirection(-1);
      setActiveIndex((prev) => (prev - 1 + personas.length) % personas.length);
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
      rotateY: direction > 0 ? 45 : -45,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.8,
      rotateY: direction > 0 ? -45 : 45,
    }),
  };

  return (
    <section
      className={`py-24 relative overflow-hidden ${
        theme === "light" ? "bg-slate-50" : ""
      }`}
    >
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className={`absolute inset-0 ${
            theme === "light"
              ? "bg-gradient-to-br from-green-50 via-white to-emerald-50"
              : "bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5"
          }`}
          animate={{
            background:
              theme === "light"
                ? [
                    "linear-gradient(135deg, #f0fdf4, #ffffff, #ecfdf5)",
                    "linear-gradient(135deg, #ecfdf5, #f0fdf4, #ffffff)",
                    "linear-gradient(135deg, #f0fdf4, #ffffff, #ecfdf5)",
                  ]
                : [
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.05), transparent, rgba(16, 185, 129, 0.05))",
                    "linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(34, 197, 94, 0.05), transparent)",
                    "linear-gradient(135deg, rgba(34, 197, 94, 0.05), transparent, rgba(16, 185, 129, 0.05))",
                  ],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />

        {/* Floating orbs */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-32 h-32 rounded-full ${
              theme === "light" ? "bg-green-200/30" : "bg-green-500/10"
            }`}
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + (i % 3) * 30}%`,
              filter: "blur(40px)",
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, 20, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 5 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
            animate={{ letterSpacing: ["0.05em", "0.15em", "0.05em"] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            AI Council Architecture
          </motion.span>
          <h2
            className={`text-4xl md:text-6xl font-black mb-6 ${
              theme === "light" ? "text-slate-800" : "text-white"
            }`}
          >
            <GradientText text="5 AI Experts." />{" "}
            <motion.span
              className="text-green-500 inline-block"
              whileHover={{
                scale: 1.05,
                textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
              }}
            >
              <WaveText text="One Diagnosis." />
            </motion.span>
          </h2>
          <motion.p
            className={`max-w-3xl mx-auto text-lg ${
              theme === "light" ? "text-slate-600" : "text-slate-400"
            }`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Our unique multi-agent AI council debates each case like experts at
            a round table, ensuring{" "}
            <GlitchText
              text="98% accuracy"
              className="text-green-500 font-semibold"
            />{" "}
            through consensus-driven diagnosis.
          </motion.p>
        </motion.div>

        {/* Carousel container */}
        <div className="relative max-w-4xl mx-auto">
          {/* Navigation arrows - Desktop */}
          <button
            onClick={() => {
              setDirection(-1);
              setActiveIndex(
                (prev) => (prev - 1 + personas.length) % personas.length
              );
            }}
            className={`hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center ${
              theme === "light"
                ? "bg-white shadow-lg border border-slate-200"
                : "bg-slate-800/50 border border-slate-700"
            } z-20 hover:scale-110 transition-transform`}
          >
            <motion.span whileHover={{ x: -3 }} className="text-2xl">
              ←
            </motion.span>
          </button>
          <button
            onClick={() => {
              setDirection(1);
              setActiveIndex((prev) => (prev + 1) % personas.length);
            }}
            className={`hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center ${
              theme === "light"
                ? "bg-white shadow-lg border border-slate-200"
                : "bg-slate-800/50 border border-slate-700"
            } z-20 hover:scale-110 transition-transform`}
          >
            <motion.span whileHover={{ x: 3 }} className="text-2xl">
              →
            </motion.span>
          </button>

          {/* Main carousel */}
          <div
            ref={containerRef}
            className="relative h-[450px] perspective-1000"
            style={{ perspective: "1000px" }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={activeIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ transformStyle: "preserve-3d" }}
              >
                {(() => {
                  const persona = personas[activeIndex];
                  const colors = colorClasses[persona.color];
                  return (
                    <div
                      className={`h-full p-8 md:p-12 rounded-3xl bg-gradient-to-br ${
                        theme === "light" ? colors.lightBg : colors.bg
                      } border ${
                        colors.border
                      } relative overflow-hidden shadow-2xl`}
                    >
                      {/* Glowing background */}
                      <motion.div
                        className="absolute inset-0 opacity-30"
                        animate={{
                          background: [
                            `radial-gradient(circle at 20% 20%, ${
                              persona.color === "green"
                                ? "rgba(34, 197, 94, 0.3)"
                                : persona.color === "orange"
                                ? "rgba(249, 115, 22, 0.3)"
                                : persona.color === "blue"
                                ? "rgba(59, 130, 246, 0.3)"
                                : persona.color === "purple"
                                ? "rgba(168, 85, 247, 0.3)"
                                : "rgba(34, 211, 238, 0.3)"
                            }, transparent 50%)`,
                            `radial-gradient(circle at 80% 80%, ${
                              persona.color === "green"
                                ? "rgba(34, 197, 94, 0.3)"
                                : persona.color === "orange"
                                ? "rgba(249, 115, 22, 0.3)"
                                : persona.color === "blue"
                                ? "rgba(59, 130, 246, 0.3)"
                                : persona.color === "purple"
                                ? "rgba(168, 85, 247, 0.3)"
                                : "rgba(34, 211, 238, 0.3)"
                            }, transparent 50%)`,
                            `radial-gradient(circle at 20% 20%, ${
                              persona.color === "green"
                                ? "rgba(34, 197, 94, 0.3)"
                                : persona.color === "orange"
                                ? "rgba(249, 115, 22, 0.3)"
                                : persona.color === "blue"
                                ? "rgba(59, 130, 246, 0.3)"
                                : persona.color === "purple"
                                ? "rgba(168, 85, 247, 0.3)"
                                : "rgba(34, 211, 238, 0.3)"
                            }, transparent 50%)`,
                          ],
                        }}
                        transition={{ duration: 4, repeat: Infinity }}
                      />

                      <div className="relative z-10 h-full flex flex-col md:flex-row items-center gap-8">
                        {/* Icon */}
                        <motion.div
                          className="text-8xl md:text-9xl"
                          animate={{
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1],
                          }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          {persona.icon}
                        </motion.div>

                        {/* Content */}
                        <div className="flex-1 text-center md:text-left">
                          <motion.h3
                            className={`text-3xl md:text-4xl font-black mb-2 ${
                              theme === "light" ? "text-slate-800" : colors.text
                            }`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <AnimatedText text={persona.name} />
                          </motion.h3>
                          <motion.p
                            className={`text-lg mb-4 ${
                              theme === "light"
                                ? "text-slate-500"
                                : "text-slate-400"
                            }`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            <GlitchText text={persona.role} />
                          </motion.p>
                          <motion.p
                            className={`text-base leading-relaxed mb-6 ${
                              theme === "light"
                                ? "text-slate-600"
                                : "text-slate-300"
                            }`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                          >
                            {persona.description}
                          </motion.p>

                          {/* Expertise tags */}
                          <motion.div
                            className="flex flex-wrap gap-3 justify-center md:justify-start"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                          >
                            {persona.expertise.map((skill, j) => (
                              <motion.span
                                key={j}
                                className={`px-4 py-2 rounded-full text-sm font-medium ${
                                  theme === "light"
                                    ? "bg-white shadow-md"
                                    : `bg-gradient-to-r ${colors.bg}`
                                } ${colors.text} border ${colors.border}`}
                                whileHover={{ scale: 1.1, y: -3 }}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 + j * 0.1 }}
                              >
                                {skill}
                              </motion.span>
                            ))}
                          </motion.div>
                        </div>
                      </div>

                      {/* Swipe indicator on mobile */}
                      <motion.div
                        className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-500 text-sm"
                        animate={{ x: [0, 10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <span>← Swipe →</span>
                      </motion.div>
                    </div>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-3 mt-8">
            {personas.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => {
                  setDirection(i > activeIndex ? 1 : -1);
                  setActiveIndex(i);
                }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "bg-green-500 scale-125"
                    : theme === "light"
                    ? "bg-slate-300 hover:bg-slate-400"
                    : "bg-slate-600 hover:bg-slate-500"
                }`}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <motion.div
            className={`mt-4 h-1 ${
              theme === "light" ? "bg-slate-200" : "bg-slate-700"
            } rounded-full overflow-hidden max-w-xs mx-auto`}
          >
            <motion.div
              className="h-full bg-green-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 3, repeat: Infinity }}
              key={activeIndex}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- AI FEATURES DETAILED SECTION WITH SCROLL CONTENT CHANGE ---
// --- AI FEATURES SECTION - NORMAL SCROLL WITH ENHANCED ANIMATIONS ---
const AIFeaturesSection = () => {
  const { theme } = useTheme();

  const features = [
    {
      icon: "🦠",
      title: "Disease Diagnosis",
      subtitle: "500+ Diseases Detected",
      description:
        "Upload a single photo of your affected crop. Our AI analyzes leaf patterns, discoloration, spots, and texture to identify diseases with 98% accuracy.",
      stats: [
        { label: "Accuracy", value: "98%" },
        { label: "Diseases", value: "500+" },
        { label: "Response", value: "<3s" },
      ],
      gradient: "from-red-500/20 to-orange-500/10",
      lightGradient: "from-red-50 to-orange-50",
      color: "text-red-500",
      borderColor: "border-red-500/30",
    },
    {
      icon: "🧪",
      title: "Soil Analysis",
      subtitle: "Complete NPK Profile",
      description:
        "Get detailed soil health reports from a simple photo. Understand pH levels, nitrogen, phosphorus, potassium content, and receive personalized fertilizer recommendations.",
      stats: [
        { label: "Parameters", value: "12+" },
        { label: "Fertilizer Plans", value: "Custom" },
        { label: "Cost Saved", value: "₹2000/acre" },
      ],
      gradient: "from-amber-500/20 to-yellow-500/10",
      lightGradient: "from-amber-50 to-yellow-50",
      color: "text-amber-500",
      borderColor: "border-amber-500/30",
    },
    {
      icon: "📅",
      title: "Crop Planner",
      subtitle: "Sowing to Harvest Calendar",
      description:
        "AI-generated day-by-day farming calendar customized for your crop, region, and weather. Dynamic task checklists ensure you never miss critical farming activities.",
      stats: [
        { label: "Crops", value: "50+" },
        { label: "Tasks/Season", value: "100+" },
        { label: "Yield Increase", value: "25%" },
      ],
      gradient: "from-green-500/20 to-emerald-500/10",
      lightGradient: "from-green-50 to-emerald-50",
      color: "text-green-500",
      borderColor: "border-green-500/30",
    },
    {
      icon: "📈",
      title: "Market Intelligence",
      subtitle: "Real-time Mandi Prices",
      description:
        "Know when to sell with real-time prices from 5+ nearby Mandis. Our AI predicts price trends using historical data and helps you maximize profits.",
      stats: [
        { label: "Mandis", value: "500+" },
        { label: "Price Updates", value: "Hourly" },
        { label: "Extra Earning", value: "₹15K/season" },
      ],
      gradient: "from-blue-500/20 to-cyan-500/10",
      lightGradient: "from-blue-50 to-cyan-50",
      color: "text-blue-500",
      borderColor: "border-blue-500/30",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 60, rotateX: -15 },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section
      className={`py-24 relative overflow-hidden ${
        theme === "light" ? "bg-white" : ""
      }`}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0">
        {theme === "light" ? (
          <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.05)_1px,transparent_1px)] bg-[size:60px_60px]" />
        )}

        {/* Floating gradient orbs */}
        <motion.div
          className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full ${
            theme === "light" ? "bg-green-100/50" : "bg-green-500/10"
          }`}
          style={{ filter: "blur(80px)" }}
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity }}
        />
        <motion.div
          className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full ${
            theme === "light" ? "bg-blue-100/50" : "bg-blue-500/10"
          }`}
          style={{ filter: "blur(80px)" }}
          animate={{
            x: [0, -50, 0],
            y: [0, 30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 18, repeat: Infinity }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
            animate={{ letterSpacing: ["0.05em", "0.2em", "0.05em"] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <TypewriterText text="AI-Powered Features" />
          </motion.span>
          <h2
            className={`text-4xl md:text-6xl font-black mb-6 ${
              theme === "light" ? "text-slate-800" : "text-white"
            }`}
          >
            <WaveText text="Why Trust " />
            <GradientText text="Our AI?" />
          </h2>
          <motion.p
            className={`max-w-3xl mx-auto text-lg ${
              theme === "light" ? "text-slate-600" : "text-slate-400"
            }`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Every feature is backed by extensive research,{" "}
            <GlitchText text="government data" className="text-green-500" />,
            and validated by agricultural experts.
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 gap-8"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              whileHover={{ y: -10, scale: 1.02 }}
              className={`group p-8 rounded-3xl bg-gradient-to-br ${
                theme === "light" ? feature.lightGradient : feature.gradient
              } border ${
                feature.borderColor
              } relative overflow-hidden`}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Hover glow effect */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${
                    feature.color === "text-red-500"
                      ? "rgba(239, 68, 68, 0.15)"
                      : feature.color === "text-amber-500"
                      ? "rgba(245, 158, 11, 0.15)"
                      : feature.color === "text-green-500"
                      ? "rgba(34, 197, 94, 0.15)"
                      : "rgba(59, 130, 246, 0.15)"
                  }, transparent 70%)`,
                }}
              />

              <div className="relative z-10">
                <div className="flex items-start gap-6 mb-6">
                  <motion.span
                    className="text-6xl block"
                    animate={{
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.15, 1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      delay: i * 0.5,
                    }}
                  >
                    {feature.icon}
                  </motion.span>
                  <div>
                    <motion.h3
                      className={`text-2xl font-bold ${feature.color} mb-1`}
                      whileHover={{ x: 5 }}
                    >
                      <AnimatedText text={feature.title} />
                    </motion.h3>
                    <p
                      className={`${
                        theme === "light" ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      <GlitchText text={feature.subtitle} />
                    </p>
                  </div>
                </div>

                <p
                  className={`leading-relaxed mb-6 ${
                    theme === "light" ? "text-slate-600" : "text-slate-300"
                  }`}
                >
                  {feature.description}
                </p>

                {/* Stats - improved mobile layout */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {feature.stats.map((stat, j) => (
                    <motion.div
                      key={j}
                      className={`text-center p-2 sm:p-3 rounded-lg sm:rounded-xl ${
                        theme === "light" 
                          ? "bg-white shadow-md border-2" 
                          : "bg-white/10 backdrop-blur-sm border"
                      } ${
                        theme === "light"
                          ? "border-slate-200"
                          : "border-white/20"
                      }`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + j * 0.1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                    >
                      <motion.div
                        className={`text-lg sm:text-xl font-bold ${feature.color}`}
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: j * 0.3,
                        }}
                      >
                        {stat.value}
                      </motion.div>
                      <div
                        className={`text-[10px] sm:text-xs font-medium ${
                          theme === "light"
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        {stat.label}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Animated corner accent */}
              <motion.div
                className="absolute top-0 right-0 w-24 h-24"
                style={{
                  background: `linear-gradient(135deg, transparent 50%, ${
                    feature.color === "text-red-500"
                      ? "rgba(239, 68, 68, 0.2)"
                      : feature.color === "text-amber-500"
                      ? "rgba(245, 158, 11, 0.2)"
                      : feature.color === "text-green-500"
                      ? "rgba(34, 197, 94, 0.2)"
                      : "rgba(59, 130, 246, 0.2)"
                  } 50%)`,
                }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

// --- TRUSTED PARTNERS / BRANDS MARQUEE SECTION ---
const TrustedPartnersSection = () => {
  const { theme } = useTheme();

  const brands = [
    { name: "Google Gemini", logo: "🧠", color: "#4285F4", type: "AI" },
    { name: "Agmarknet", logo: "🏛️", color: "#0066CC", type: "Govt" },
    { name: "IMD Weather", logo: "🌤️", color: "#FF9800", type: "Govt" },
    { name: "Soil Health Card", logo: "📋", color: "#4CAF50", type: "Govt" },
    { name: "eNAM", logo: "🛒", color: "#9C27B0", type: "Govt" },
    { name: "ICAR", logo: "🌾", color: "#8BC34A", type: "Govt" },
    { name: "Supabase", logo: "⚡", color: "#3ECF8E", type: "Tech" },
    { name: "OpenRouter", logo: "🔗", color: "#6366F1", type: "Tech" },
    { name: "TensorFlow", logo: "🔮", color: "#FF6F00", type: "AI" },
    { name: "India Gov", logo: "🇮🇳", color: "#FF9933", type: "Govt" },
  ];

  // Double the array for seamless loop
  const doubledBrands = [...brands, ...brands];

  return (
    <section
      className={`py-24 relative overflow-hidden ${
        theme === "light" ? "bg-slate-50" : ""
      }`}
    >
      {/* Gradient overlays for fade effect */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r ${
          theme === "light" ? "from-slate-50" : "from-slate-900"
        } to-transparent pointer-events-none`}
      />
      <div
        className={`absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l ${
          theme === "light" ? "from-slate-50" : "from-slate-900"
        } to-transparent pointer-events-none`}
      />

      <div className="container mx-auto px-6 relative z-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.span
            className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
            animate={{ letterSpacing: ["0.05em", "0.15em", "0.05em"] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <TypewriterText text="Powered By The Best" />
          </motion.span>
          <h2
            className={`text-4xl md:text-6xl font-black mb-6 ${
              theme === "light" ? "text-slate-800" : "text-white"
            }`}
          >
            <WaveText text="Trusted " />
            <GradientText text="Brands & APIs" />
          </h2>
          <motion.p
            className={`max-w-2xl mx-auto text-lg ${
              theme === "light" ? "text-slate-600" : "text-slate-400"
            }`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            We integrate with{" "}
            <GlitchText
              text="official government APIs"
              className="text-green-500"
            />{" "}
            and world-class technology partners.
          </motion.p>
        </motion.div>
      </div>

      {/* Infinite Marquee - Row 1 (left to right) */}
      <div className="relative mb-8 overflow-hidden">
        <motion.div
          className="flex gap-8"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 30,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {doubledBrands.map((brand, i) => (
            <motion.div
              key={i}
              className={`flex-shrink-0 px-10 py-6 rounded-2xl ${
                theme === "light"
                  ? "bg-white shadow-lg border border-slate-100"
                  : "bg-slate-800/50 border border-slate-700/50"
              } flex items-center gap-4 min-w-[220px]`}
              whileHover={{ scale: 1.08, y: -5 }}
              style={{
                boxShadow:
                  theme === "light"
                    ? `0 4px 20px ${brand.color}15`
                    : `0 4px 30px ${brand.color}20`,
              }}
            >
              <motion.span
                className="text-5xl"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.2 }}
              >
                {brand.logo}
              </motion.span>
              <div>
                <span
                  className={`font-bold block ${
                    theme === "light" ? "text-slate-800" : "text-white"
                  }`}
                >
                  {brand.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                    brand.type === "Govt"
                      ? `${
                          theme === "light"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-blue-500/20 text-blue-400"
                        }`
                      : brand.type === "AI"
                      ? `${
                          theme === "light"
                            ? "bg-purple-100 text-purple-600"
                            : "bg-purple-500/20 text-purple-400"
                        }`
                      : `${
                          theme === "light"
                            ? "bg-green-100 text-green-600"
                            : "bg-green-500/20 text-green-400"
                        }`
                  }`}
                >
                  {brand.type}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Infinite Marquee - Row 2 (right to left) */}
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-8"
          animate={{ x: ["-50%", "0%"] }}
          transition={{
            duration: 25,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {[...doubledBrands].reverse().map((brand, i) => (
            <motion.div
              key={i}
              className={`flex-shrink-0 px-10 py-6 rounded-2xl ${
                theme === "light"
                  ? "bg-white shadow-lg border border-slate-100"
                  : "bg-slate-800/50 border border-slate-700/50"
              } flex items-center gap-4 min-w-[220px]`}
              whileHover={{ scale: 1.08, y: -5 }}
              style={{
                boxShadow:
                  theme === "light"
                    ? `0 4px 20px ${brand.color}15`
                    : `0 4px 30px ${brand.color}20`,
              }}
            >
              <motion.span
                className="text-5xl"
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.2 }}
              >
                {brand.logo}
              </motion.span>
              <div>
                <span
                  className={`font-bold block ${
                    theme === "light" ? "text-slate-800" : "text-white"
                  }`}
                >
                  {brand.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                    brand.type === "Govt"
                      ? `${
                          theme === "light"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-blue-500/20 text-blue-400"
                        }`
                      : brand.type === "AI"
                      ? `${
                          theme === "light"
                            ? "bg-purple-100 text-purple-600"
                            : "bg-purple-500/20 text-purple-400"
                        }`
                      : `${
                          theme === "light"
                            ? "bg-green-100 text-green-600"
                            : "bg-green-500/20 text-green-400"
                        }`
                  }`}
                >
                  {brand.type}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Trust badges */}
      <div className="container mx-auto px-6 mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`flex flex-wrap justify-center items-center gap-8 p-8 rounded-3xl ${
            theme === "light"
              ? "bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 border border-green-200"
              : "bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-green-500/10 border border-green-500/20"
          }`}
        >
          {[
            { icon: "🔒", label: "Bank-Grade Security" },
            { icon: "📜", label: "Data Privacy Compliant" },
            { icon: "✅", label: "Govt. Verified Data" },
            { icon: "🏆", label: "Award Winning AI" },
          ].map((badge, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-3"
              whileHover={{ scale: 1.1, y: -3 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
              >
                {badge.icon}
              </motion.span>
              <span
                className={`font-semibold ${
                  theme === "light" ? "text-slate-700" : "text-white"
                }`}
              >
                <AnimatedText text={badge.label} />
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

// --- PHASE 1: PRIVACY & ENCRYPTION COMPARISON SECTION ---
// --- Letter-by-letter encryption animation component (cycles: normal → encrypt → normal) ---
const EncryptingText = ({ 
  originalText, 
  encryptedChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  isEncrypting = true,
  speed = 50,
  color = "green",
  pauseDuration = 1500
}: { 
  originalText: string; 
  encryptedChars?: string;
  isEncrypting?: boolean;
  speed?: number;
  color?: "green" | "amber" | "red";
  pauseDuration?: number;
}) => {
  const [displayText, setDisplayText] = useState(originalText);
  const [encryptedIndex, setEncryptedIndex] = useState(0);
  const [phase, setPhase] = useState<'normal' | 'encrypting' | 'encrypted' | 'decrypting'>('normal');
  const [encryptedCache, setEncryptedCache] = useState<string[]>([]);
  
  const colorClasses = {
    green: "text-emerald-400",
    amber: "text-amber-400", 
    red: "text-red-400"
  };

  // Generate consistent encrypted characters for each position
  useEffect(() => {
    const cache = originalText.split('').map(char => {
      if (char === ' ') return ' ';
      return encryptedChars[Math.floor(Math.random() * encryptedChars.length)];
    });
    setEncryptedCache(cache);
  }, [originalText, encryptedChars]);

  useEffect(() => {
    if (!isEncrypting) {
      setDisplayText(originalText);
      setEncryptedIndex(0);
      setPhase('normal');
      return;
    }

    let currentIndex = 0;
    let isPaused = false;
    
    const runAnimation = () => {
      const interval = setInterval(() => {
        if (isPaused) return;

        if (phase === 'normal' || phase === 'encrypting') {
          // Encrypting: left to right
          if (currentIndex <= originalText.length) {
            setEncryptedIndex(currentIndex);
            setPhase('encrypting');
            
            const encrypted = originalText.split('').map((char, i) => {
              if (i < currentIndex) {
                if (char === ' ') return ' ';
                return encryptedCache[i] || encryptedChars[Math.floor(Math.random() * encryptedChars.length)];
              }
              return char;
            }).join('');
            
            setDisplayText(encrypted);
            currentIndex++;
          } else {
            // Fully encrypted - pause then start decrypting
            setPhase('encrypted');
            isPaused = true;
            setTimeout(() => {
              isPaused = false;
              setPhase('decrypting');
              currentIndex = originalText.length;
            }, pauseDuration);
          }
        } else if (phase === 'decrypting') {
          // Decrypting: left to right (revealing original)
          if (currentIndex >= 0) {
            setEncryptedIndex(currentIndex);
            
            const decrypted = originalText.split('').map((char, i) => {
              if (i >= originalText.length - (originalText.length - currentIndex)) {
                return char;
              }
              if (char === ' ') return ' ';
              return encryptedCache[i] || encryptedChars[Math.floor(Math.random() * encryptedChars.length)];
            }).join('');
            
            setDisplayText(decrypted);
            currentIndex--;
          } else {
            // Fully decrypted - pause then start encrypting again
            setPhase('normal');
            setDisplayText(originalText);
            isPaused = true;
            setTimeout(() => {
              isPaused = false;
              setPhase('encrypting');
              currentIndex = 0;
            }, pauseDuration);
          }
        }
      }, speed);

      return interval;
    };

    const interval = runAnimation();
    return () => clearInterval(interval);
  }, [originalText, isEncrypting, encryptedChars, speed, phase, encryptedCache, pauseDuration]);

  const isCharEncrypted = (index: number) => {
    if (phase === 'encrypting' || phase === 'encrypted') {
      return index < encryptedIndex;
    } else if (phase === 'decrypting') {
      return index < encryptedIndex;
    }
    return false;
  };

  return (
    <span className="font-mono relative">
      {displayText.split('').map((char, i) => (
        <motion.span
          key={i}
          className={isCharEncrypted(i) ? colorClasses[color] : ""}
          initial={{ opacity: 1 }}
          animate={{ 
            opacity: 1,
            scale: i === encryptedIndex - 1 && (phase === 'encrypting' || phase === 'decrypting') ? [1, 1.15, 1] : 1
          }}
          transition={{ duration: 0.2 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
};

const PrivacyEncryptionSection = () => {
  const { theme } = useTheme();
  const reducedMotion = useIsReducedMotion();
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Sample message for demo
  const sampleMessage = "My crop has pest attack. Please help me with treatment.";
  const hindiMessage = "मेरी फसल में कीट लगा है। कृपया इलाज बताएं।";

  // Intersection observer to trigger animation when in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      className={`py-24 relative overflow-hidden ${theme === "light" ? "bg-slate-50" : "bg-slate-900/50"}`}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* Floating lock icons */}
      {!reducedMotion && [...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl opacity-10"
          style={{ left: `${5 + i * 12}%`, top: `${15 + (i % 4) * 20}%` }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.5 }}
        >
          {['🔐', '🛡️', '🔒', '🔑', '⛓️', '🔏', '🔓', '🗝️'][i]}
        </motion.div>
      ))}

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 font-medium text-sm mb-6"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span>🔐</span>
            <TypewriterText text="Privacy First Architecture" />
          </motion.span>
          <h2 className={`text-4xl md:text-6xl font-black mb-6 ${theme === "light" ? "text-slate-800" : "text-white"}`}>
            <SlideUpText>
              <WaveText text="See The" className={theme === "light" ? "text-slate-800" : "text-white"} />
            </SlideUpText>{" "}
            <GradientText text="Privacy Difference" />
          </h2>
          <p className={`max-w-3xl mx-auto text-lg ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
            <FadeInWords text="Watch how your message gets encrypted - letter by letter, in real-time." />
          </p>
        </motion.div>

        {/* TOP MESSAGE BOX - Other Apps */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto mb-8"
        >
          <div className={`relative p-8 rounded-3xl border-2 ${theme === "light" ? "bg-white border-amber-300" : "bg-slate-800/80 border-amber-500/50"}`}>
            {/* Label */}
            <div className="absolute -top-4 left-6 px-4 py-1 bg-amber-500 rounded-full text-sm font-bold text-white flex items-center gap-2">
              <span>📱</span> Other Apps
              <motion.span
                className="ml-1"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                🔒
              </motion.span>
            </div>

            {/* Wave animation from left */}
            <motion.div 
              className="absolute left-0 top-0 bottom-0 w-2 overflow-hidden rounded-l-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-400"
                animate={{ y: ["-100%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>

            <div className="pl-6">
              {/* Single Message Box with Animation */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">💬</span>
                <span className={`font-medium text-sm ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                  Your Message (Encryption Preview)
                </span>
              </div>

              {/* Single Encryption Animation Box */}
              <div className={`p-6 rounded-2xl border-2 border-dashed ${theme === "light" ? "bg-amber-50 border-amber-300" : "bg-amber-900/20 border-amber-500/30"}`}>
                <div className="text-lg md:text-xl break-all">
                  {isInView && !reducedMotion ? (
                    <EncryptingText 
                      originalText={sampleMessage} 
                      isEncrypting={true}
                      speed={60}
                      color="amber"
                      pauseDuration={1200}
                    />
                  ) : (
                    <span className={theme === "light" ? "text-slate-800" : "text-white"}>
                      {sampleMessage}
                    </span>
                  )}
                </div>
              </div>

              {/* Warning badges */}
              <div className="flex flex-wrap gap-3 mt-6">
                {[
                  { icon: "⚠️", text: "Metadata collected", color: "amber" },
                  { icon: "⚠️", text: "Server can read", color: "amber" },
                  { icon: "⚠️", text: "Data sold to ads", color: "red" },
                ].map((badge, i) => (
                  <motion.span
                    key={i}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                      badge.color === "red" 
                        ? theme === "light" ? "bg-red-100 text-red-600" : "bg-red-900/30 text-red-400"
                        : theme === "light" ? "bg-amber-100 text-amber-600" : "bg-amber-900/30 text-amber-400"
                    }`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span>{badge.icon}</span>
                    {badge.text}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* VS Divider with animated waves */}
        <motion.div 
          className="flex items-center justify-center gap-4 my-8"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <motion.div 
            className="h-px flex-1 max-w-32 bg-gradient-to-r from-transparent via-amber-500 to-amber-500"
            animate={{ scaleX: [0, 1] }}
            transition={{ duration: 1 }}
          />
          <motion.div
            className={`px-6 py-3 rounded-full font-black text-xl ${theme === "light" ? "bg-white shadow-lg" : "bg-slate-800 border border-slate-700"}`}
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-amber-500">VS</span>
          </motion.div>
          <motion.div 
            className="h-px flex-1 max-w-32 bg-gradient-to-l from-transparent via-emerald-500 to-emerald-500"
            animate={{ scaleX: [0, 1] }}
            transition={{ duration: 1 }}
          />
        </motion.div>

        {/* BOTTOM MESSAGE BOX - Fasal Rakshak */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto mb-12"
        >
          <div className={`relative p-8 rounded-3xl border-2 ${theme === "light" ? "bg-white border-emerald-400" : "bg-slate-800/80 border-emerald-500/50"} overflow-hidden`}>
            {/* Glowing effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-emerald-500/10"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            {/* Label */}
            <motion.div 
              className="absolute -top-4 left-6 px-4 py-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full text-sm font-bold text-white flex items-center gap-2 shadow-lg shadow-emerald-500/30"
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span>🌱</span> Fasal Rakshak
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">Web3</span>
              <motion.span
                animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🔐
              </motion.span>
            </motion.div>

            {/* Wave animation from left - Smooth flowing */}
            <motion.div 
              className="absolute left-0 top-0 bottom-0 w-3 overflow-hidden rounded-l-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Multiple wave layers for smooth effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-400"
                animate={{ y: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-transparent"
                animate={{ y: ["-100%", "100%"] }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>

            <div className="pl-6 relative z-10">
              {/* Single Message Box with Animation */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">💬</span>
                <span className={`font-medium text-sm ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                  Your Message (Encryption Preview)
                </span>
              </div>

              {/* Single Encryption Animation Box */}
              <div className={`p-6 rounded-2xl border-2 ${theme === "light" ? "bg-emerald-50 border-emerald-300" : "bg-emerald-900/20 border-emerald-500/30"}`}>
                <div className="text-lg md:text-xl break-all">
                  {isInView && !reducedMotion ? (
                    <EncryptingText 
                      originalText={sampleMessage} 
                      isEncrypting={true}
                      speed={50}
                      color="green"
                      encryptedChars="0123456789abcdef"
                      pauseDuration={1200}
                    />
                  ) : (
                    <span className={theme === "light" ? "text-slate-800" : "text-white"}>
                      {sampleMessage}
                    </span>
                  )}
                </div>
                
                {/* Hash preview */}
                <motion.div 
                  className="mt-4 pt-4 border-t border-emerald-500/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <span className="text-xs text-emerald-400/70 font-mono">
                    SHA-256: 0x7f3a9c2e...IPFS+zkSNARK
                  </span>
                </motion.div>
              </div>

              {/* Success badges */}
              <div className="flex flex-wrap gap-3 mt-6">
                {[
                  { icon: "✅", text: "Zero metadata" },
                  { icon: "✅", text: "P2P encrypted" },
                  { icon: "✅", text: "You own your data" },
                  { icon: "✅", text: "Can't be sold" },
                ].map((badge, i) => (
                  <motion.span
                    key={i}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                      theme === "light" ? "bg-emerald-100 text-emerald-600" : "bg-emerald-900/30 text-emerald-400"
                    }`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    >
                      {badge.icon}
                    </motion.span>
                    {badge.text}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Privacy Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
        >
          {[
            { value: "0", label: "Data Sold", icon: "🚫" },
            { value: "100%", label: "Farmer Owned", icon: "👨‍🌾" },
            { value: "256-bit", label: "Encryption", icon: "🔐" },
            { value: "P2P", label: "Direct Connection", icon: "🔗" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className={`p-6 rounded-2xl text-center ${theme === "light" ? "bg-white shadow-lg" : "bg-slate-800/50 border border-slate-700"}`}
              whileHover={{ y: -5, scale: 1.02 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <motion.span 
                className="text-3xl block mb-2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              >
                {stat.icon}
              </motion.span>
              <div className="text-2xl font-black text-emerald-400 mb-1">{stat.value}</div>
              <div className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

// --- PHASE 2: CHAT & COMMUNICATION HUB SECTION ---
const ChatCommunicationSection = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'chat' | 'call' | 'ai'>('chat');
  const [isTyping, setIsTyping] = useState(false);
  const reducedMotion = useIsReducedMotion();

  // Simulate typing indicator
  useEffect(() => {
    if (activeTab === 'ai') {
      const interval = setInterval(() => {
        setIsTyping(prev => !prev);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const chatMessages = [
    { id: 1, sender: 'farmer', name: 'Ramesh', message: 'मेरी टमाटर की फसल में कीट लग गए हैं', time: '10:30 AM', avatar: '👨‍🌾' },
    { id: 2, sender: 'ai', name: 'Krishi AI', message: 'आपकी फोटो देखकर यह Aphid infestation लगता है। नीम तेल स्प्रे करें।', time: '10:31 AM', avatar: '🤖' },
    { id: 3, sender: 'farmer', name: 'Ramesh', message: 'धन्यवाद! कितना नीम तेल लगेगा?', time: '10:32 AM', avatar: '👨‍🌾' },
    { id: 4, sender: 'ai', name: 'Krishi AI', message: '5ml नीम तेल + 1L पानी। सुबह या शाम स्प्रे करें। 3 दिन में दोहराएं।', time: '10:32 AM', avatar: '🤖' },
  ];

  const features = {
    chat: [
      { icon: '💬', title: 'Real-time Messaging', desc: 'Instant P2P encrypted chat' },
      { icon: '👥', title: 'Group Chats', desc: 'Create farmer communities' },
      { icon: '📷', title: 'Media Sharing', desc: 'Share photos & videos' },
      { icon: '🔍', title: 'Search Farmers', desc: 'Find by phone/email' },
    ],
    call: [
      { icon: '📞', title: 'Voice Calls', desc: 'Crystal clear audio' },
      { icon: '📹', title: 'Video Calls', desc: 'Face-to-face support' },
      { icon: '🔇', title: 'Mute & Speaker', desc: 'Full call controls' },
      { icon: '🌐', title: 'WebRTC P2P', desc: 'No servers in between' },
    ],
    ai: [
      { icon: '🤖', title: 'Krishi AI Bot', desc: '24/7 farming assistant' },
      { icon: '🌍', title: '11 Languages', desc: 'Speak in your tongue' },
      { icon: '🎤', title: 'Voice Input', desc: 'Talk, don\'t type' },
      { icon: '🧠', title: 'Smart Diagnosis', desc: 'AI-powered answers' },
    ],
  };

  return (
    <section className={`py-24 relative overflow-hidden ${theme === "light" ? "bg-white" : ""}`}>
      {/* Background patterns */}
      <div className="absolute inset-0">
        <motion.div
          className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full ${theme === "light" ? "bg-blue-100/50" : "bg-blue-500/10"}`}
          style={{ filter: "blur(100px)" }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full ${theme === "light" ? "bg-purple-100/50" : "bg-purple-500/10"}`}
          style={{ filter: "blur(100px)" }}
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-400 font-medium text-sm mb-6"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span>💬</span>
            <TypewriterText text="Complete Communication Hub" />
          </motion.span>
          <h2 className={`text-4xl md:text-6xl font-black mb-6 ${theme === "light" ? "text-slate-800" : "text-white"}`}>
            <SlideUpText>
              <WaveText text="Chat. Call." className={theme === "light" ? "text-slate-800" : "text-white"} />
            </SlideUpText>{" "}
            <GradientText text="Get AI Help." />
          </h2>
          <p className={`max-w-3xl mx-auto text-lg ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
            <FadeInWords text="A full-featured messaging app with AI assistant, voice/video calling, and end-to-end encryption." />
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Phone Mockup with Chat */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Glowing background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl rounded-full" />
            
            {/* Phone frame */}
            <div className={`relative mx-auto w-[320px] h-[650px] rounded-[3rem] border-[8px] ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-900"} shadow-2xl overflow-hidden`}>
              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20" />
              
              {/* Chat header */}
              <div className={`p-4 pt-8 ${theme === "light" ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gradient-to-r from-green-600 to-emerald-700"}`}>
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {activeTab === 'ai' ? '🤖' : activeTab === 'call' ? '📞' : '👨‍🌾'}
                  </motion.div>
                  <div className="flex-1">
                    <h4 className="text-white font-bold">
                      {activeTab === 'ai' ? 'Krishi AI Assistant' : activeTab === 'call' ? 'Voice Call' : 'Farmer Community'}
                    </h4>
                    <p className="text-white/70 text-xs">
                      {activeTab === 'ai' ? 'Online • 24/7' : activeTab === 'call' ? 'Connecting...' : '5 members online'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <motion.button 
                      className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setActiveTab('call')}
                    >
                      📞
                    </motion.button>
                    <motion.button 
                      className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      📹
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Chat content or Call UI */}
              <div className={`h-[calc(100%-180px)] overflow-hidden ${theme === "light" ? "bg-slate-50" : "bg-slate-800/50"}`}>
                {activeTab === 'call' ? (
                  /* Call UI */
                  <div className="h-full flex flex-col items-center justify-center p-6">
                    <motion.div 
                      className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-4xl mb-4"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      👨‍🌾
                    </motion.div>
                    <h3 className={`text-xl font-bold mb-2 ${theme === "light" ? "text-slate-800" : "text-white"}`}>Ramesh Kumar</h3>
                    <motion.p 
                      className="text-green-400 text-sm mb-8"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      🔊 Calling...
                    </motion.p>
                    {/* Ripple effect */}
                    {!reducedMotion && [...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-32 h-32 rounded-full border-2 border-green-500/30"
                        animate={{ scale: [1, 2, 2], opacity: [0.5, 0, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                      />
                    ))}
                    {/* Call controls */}
                    <div className="flex gap-4 mt-auto">
                      <motion.button 
                        className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center"
                        whileHover={{ scale: 1.1 }}
                      >
                        🔇
                      </motion.button>
                      <motion.button 
                        className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
                        whileHover={{ scale: 1.1 }}
                        onClick={() => setActiveTab('chat')}
                      >
                        📵
                      </motion.button>
                      <motion.button 
                        className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center"
                        whileHover={{ scale: 1.1 }}
                      >
                        🔊
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  /* Chat messages */
                  <div className="p-4 space-y-4">
                    {chatMessages.map((msg, i) => (
                      <motion.div
                        key={msg.id}
                        className={`flex gap-2 ${msg.sender === 'farmer' ? 'justify-end' : 'justify-start'}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.3 }}
                      >
                        {msg.sender === 'ai' && (
                          <motion.div 
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 3, repeat: Infinity }}
                          >
                            {msg.avatar}
                          </motion.div>
                        )}
                        <div className={`max-w-[75%] p-3 rounded-2xl ${
                          msg.sender === 'farmer' 
                            ? 'bg-green-500 text-white rounded-br-sm' 
                            : theme === "light" 
                              ? 'bg-white shadow-sm rounded-bl-sm' 
                              : 'bg-slate-700 rounded-bl-sm'
                        }`}>
                          <p className={`text-sm ${msg.sender === 'ai' && theme === "light" ? 'text-slate-700' : ''}`}>{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender === 'farmer' ? 'text-white/70' : 'text-slate-400'}`}>
                            {msg.time} {msg.sender === 'farmer' && '✓✓'}
                          </p>
                        </div>
                        {msg.sender === 'farmer' && (
                          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm">
                            {msg.avatar}
                          </div>
                        )}
                      </motion.div>
                    ))}
                    
                    {/* Typing indicator */}
                    {isTyping && activeTab === 'ai' && (
                      <motion.div 
                        className="flex gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm">
                          🤖
                        </div>
                        <div className={`p-3 rounded-2xl rounded-bl-sm ${theme === "light" ? 'bg-white shadow-sm' : 'bg-slate-700'}`}>
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 bg-green-500 rounded-full"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className={`absolute bottom-0 left-0 right-0 p-3 ${theme === "light" ? "bg-white border-t border-slate-200" : "bg-slate-900 border-t border-slate-700"}`}>
                <div className="flex items-center gap-2">
                  <motion.button 
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === "light" ? "bg-slate-100" : "bg-slate-800"}`}
                    whileHover={{ scale: 1.1 }}
                  >
                    📎
                  </motion.button>
                  <div className={`flex-1 px-4 py-2 rounded-full text-sm ${theme === "light" ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-slate-400"}`}>
                    Type a message...
                  </div>
                  <motion.button 
                    className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    🎤
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Features */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            {/* Tab buttons */}
            <div className="flex gap-4 mb-8">
              {[
                { id: 'chat', label: 'Chat', icon: '💬' },
                { id: 'call', label: 'Calling', icon: '📞' },
                { id: 'ai', label: 'AI Bot', icon: '🤖' },
              ].map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'chat' | 'call' | 'ai')}
                  className={`px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                      : theme === "light" 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </motion.button>
              ))}
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {features[activeTab].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-5 rounded-2xl border ${theme === "light" ? "bg-white border-slate-200 shadow-sm" : "bg-slate-800/50 border-slate-700"}`}
                  whileHover={{ y: -5, scale: 1.02 }}
                >
                  <motion.span 
                    className="text-3xl block mb-3"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
                  >
                    {feature.icon}
                  </motion.span>
                  <h4 className={`font-bold mb-1 ${theme === "light" ? "text-slate-800" : "text-white"}`}>{feature.title}</h4>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>{feature.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Security badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`mt-8 p-4 rounded-2xl border-2 border-emerald-500/30 ${theme === "light" ? "bg-emerald-50" : "bg-emerald-900/20"}`}
            >
              <div className="flex items-center gap-4">
                <motion.div 
                  className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  🔐
                </motion.div>
                <div>
                  <h4 className="font-bold text-emerald-400">End-to-End Encrypted</h4>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
                    All messages & calls are encrypted. Only you and the recipient can read them.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* WebRTC badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`mt-4 p-4 rounded-2xl border ${theme === "light" ? "bg-slate-50 border-slate-200" : "bg-slate-800/50 border-slate-700"}`}
            >
              <div className="flex items-center gap-4">
                <motion.div 
                  className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🌐
                </motion.div>
                <div>
                  <h4 className={`font-bold ${theme === "light" ? "text-slate-800" : "text-white"}`}>WebRTC P2P Technology</h4>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
                    Direct peer-to-peer connection. No servers store your conversations.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- PHASE 3: N8N WHATSAPP AUTOMATION SECTION ---
const N8NAutomationSection = () => {
  const { theme } = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const reducedMotion = useIsReducedMotion();

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const workflowSteps = [
    {
      id: 0,
      icon: '📱',
      title: 'Farmer Sends Message',
      desc: 'WhatsApp message received',
      color: 'from-green-500 to-emerald-600',
      nodeType: 'WhatsApp Trigger',
    },
    {
      id: 1,
      icon: '⚡',
      title: 'N8N Processes',
      desc: 'Webhook receives data',
      color: 'from-orange-500 to-red-500',
      nodeType: 'Webhook Node',
    },
    {
      id: 2,
      icon: '🧠',
      title: 'AI Analyzes',
      desc: 'Gemini AI processes query',
      color: 'from-purple-500 to-pink-500',
      nodeType: 'AI Agent',
    },
    {
      id: 3,
      icon: '✅',
      title: 'Response Sent',
      desc: 'Auto-reply to farmer',
      color: 'from-blue-500 to-cyan-500',
      nodeType: 'WhatsApp Reply',
    },
  ];

  const automationFeatures = [
    { icon: '🤖', title: 'Auto-Diagnosis', desc: 'AI identifies crop diseases from photos' },
    { icon: '🌤️', title: 'Weather Alerts', desc: 'Automated weather notifications' },
    { icon: '💰', title: 'Price Updates', desc: 'Daily mandi price broadcasts' },
    { icon: '📅', title: 'Scheduled Reminders', desc: 'Farming task notifications' },
    { icon: '🌍', title: 'Multi-language', desc: 'Responds in 11 languages' },
    { icon: '📊', title: 'Analytics', desc: 'Track engagement & queries' },
  ];

  return (
    <section className={`py-24 relative overflow-hidden ${theme === "light" ? "bg-gradient-to-b from-white to-orange-50" : "bg-gradient-to-b from-slate-900 to-slate-800"}`}>
      {/* N8N-style grid background */}
      <div className="absolute inset-0 opacity-30">
        <div className={`absolute inset-0 ${theme === "light" ? "bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)]" : "bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]"} bg-[size:50px_50px]`} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-400 font-medium text-sm mb-6"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.span
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              ⚡
            </motion.span>
            <TypewriterText text="Powered by N8N Automation" />
          </motion.span>
          <h2 className={`text-4xl md:text-6xl font-black mb-6 ${theme === "light" ? "text-slate-800" : "text-white"}`}>
            <SlideUpText>
              <WaveText text="WhatsApp" className={theme === "light" ? "text-slate-800" : "text-white"} />
            </SlideUpText>{" "}
            <GradientText text="Automation" className="from-green-400 via-orange-500 to-red-500" />
          </h2>
          <p className={`max-w-3xl mx-auto text-lg ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
            <FadeInWords text="Zero human intervention. Farmers message on WhatsApp, AI responds instantly with personalized farming advice." />
          </p>
        </motion.div>

        {/* Workflow Visualization */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className={`relative max-w-5xl mx-auto p-8 rounded-3xl border-2 ${theme === "light" ? "bg-white/80 border-slate-200 shadow-xl" : "bg-slate-800/80 border-slate-700"} backdrop-blur-xl mb-16`}
        >
          {/* N8N Logo Badge */}
          <motion.div
            className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center gap-2 shadow-lg"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-white font-bold">n8n</span>
            <span className="text-white/80 text-sm">Workflow</span>
          </motion.div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mt-4">
            {workflowSteps.map((step, i) => (
              <React.Fragment key={step.id}>
                {/* Node */}
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                >
                  {/* Active glow */}
                  {activeStep === i && !reducedMotion && (
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-r ${step.color} blur-xl opacity-50 rounded-2xl`}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                  
                  <motion.div
                    className={`relative w-32 h-32 rounded-2xl border-2 flex flex-col items-center justify-center p-4 cursor-pointer transition-all ${
                      activeStep === i
                        ? `bg-gradient-to-br ${step.color} border-transparent shadow-lg`
                        : theme === "light"
                          ? "bg-white border-slate-200 hover:border-orange-300"
                          : "bg-slate-900 border-slate-600 hover:border-orange-500"
                    }`}
                    whileHover={{ scale: 1.05, y: -5 }}
                    onClick={() => setActiveStep(i)}
                  >
                    <motion.span 
                      className="text-3xl mb-2"
                      animate={activeStep === i ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      {step.icon}
                    </motion.span>
                    <span className={`text-xs font-bold text-center ${activeStep === i ? "text-white" : theme === "light" ? "text-slate-700" : "text-slate-300"}`}>
                      {step.nodeType}
                    </span>
                  </motion.div>
                  
                  {/* Step number badge */}
                  <motion.div
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      activeStep >= i 
                        ? "bg-green-500 text-white" 
                        : theme === "light" 
                          ? "bg-slate-200 text-slate-600" 
                          : "bg-slate-700 text-slate-400"
                    }`}
                    animate={activeStep === i ? { scale: [1, 1.2, 1] } : {}}
                  >
                    {i + 1}
                  </motion.div>
                </motion.div>

                {/* Connector line with flowing animation */}
                {i < workflowSteps.length - 1 && (
                  <motion.div 
                    className="hidden lg:block relative w-16 h-1"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 + 0.3 }}
                  >
                    <div className={`absolute inset-0 ${theme === "light" ? "bg-slate-200" : "bg-slate-600"} rounded-full`} />
                    {!reducedMotion && (
                      <motion.div
                        className={`absolute top-0 left-0 h-full bg-gradient-to-r ${workflowSteps[i + 1].color} rounded-full`}
                        initial={{ width: "0%" }}
                        animate={{ width: activeStep > i ? "100%" : "0%" }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                    {/* Flowing dot */}
                    {activeStep === i && !reducedMotion && (
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                        animate={{ x: [0, 64, 64] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Active step details */}
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-8 p-4 rounded-xl text-center ${theme === "light" ? "bg-slate-50" : "bg-slate-900/50"}`}
          >
            <h4 className={`text-xl font-bold mb-2 ${theme === "light" ? "text-slate-800" : "text-white"}`}>
              {workflowSteps[activeStep].title}
            </h4>
            <p className={theme === "light" ? "text-slate-600" : "text-slate-400"}>
              {workflowSteps[activeStep].desc}
            </p>
          </motion.div>
        </motion.div>

        {/* Phone Demo + Features */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: WhatsApp Phone Demo */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-3xl rounded-full" />
            
            <div className={`relative mx-auto w-[300px] h-[600px] rounded-[3rem] border-[8px] ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-700 bg-slate-900"} shadow-2xl overflow-hidden`}>
              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-20" />
              
              {/* WhatsApp header */}
              <div className="bg-[#075E54] p-4 pt-8">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    🌾
                  </motion.div>
                  <div>
                    <h4 className="text-white font-bold">Krishi Mitra</h4>
                    <p className="text-white/70 text-xs">+91 98765 43210</p>
                  </div>
                </div>
              </div>

              {/* WhatsApp chat */}
              <div className="h-[calc(100%-140px)] bg-[#ECE5DD] dark:bg-[#0B141A] p-4 space-y-3 overflow-hidden">
                {/* Incoming message */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  className="flex"
                >
                  <div className="bg-white dark:bg-[#1F2C33] p-3 rounded-lg rounded-tl-none max-w-[80%] shadow-sm">
                    <p className="text-sm text-slate-700 dark:text-white">मेरी टमाटर की पत्तियां पीली हो रही हैं 🍅</p>
                    <p className="text-[10px] text-slate-400 text-right mt-1">10:30 AM</p>
                  </div>
                </motion.div>

                {/* Image message */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex"
                >
                  <div className="bg-white dark:bg-[#1F2C33] p-2 rounded-lg rounded-tl-none max-w-[80%] shadow-sm">
                    <div className="w-40 h-28 bg-gradient-to-br from-green-300 to-yellow-200 rounded-lg flex items-center justify-center text-4xl">
                      🍃
                    </div>
                    <p className="text-[10px] text-slate-400 text-right mt-1">10:30 AM</p>
                  </div>
                </motion.div>

                {/* Typing indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  className="flex"
                >
                  <div className="bg-[#DCF8C6] dark:bg-[#005C4B] p-3 rounded-lg rounded-tr-none shadow-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-slate-400 rounded-full"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Bot response */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex justify-end"
                >
                  <div className="bg-[#DCF8C6] dark:bg-[#005C4B] p-3 rounded-lg rounded-tr-none max-w-[85%] shadow-sm">
                    <p className="text-sm text-slate-700 dark:text-white">
                      🤖 <strong>AI Analysis:</strong><br/>
                      यह Nitrogen deficiency है।<br/><br/>
                      ✅ <strong>Solution:</strong><br/>
                      • यूरिया 50g/पौधा डालें<br/>
                      • 7 दिन में repeat करें<br/>
                      • पानी कम न करें
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <p className="text-[10px] text-slate-400">10:31 AM</p>
                      <span className="text-blue-500 text-xs">✓✓</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Input bar */}
              <div className={`absolute bottom-0 left-0 right-0 p-2 ${theme === "light" ? "bg-[#F0F0F0]" : "bg-[#1F2C33]"}`}>
                <div className="flex items-center gap-2">
                  <div className={`flex-1 px-4 py-2 rounded-full text-sm ${theme === "light" ? "bg-white" : "bg-[#2A3942]"} text-slate-400`}>
                    Type a message
                  </div>
                  <motion.div 
                    className="w-10 h-10 rounded-full bg-[#00A884] flex items-center justify-center"
                    whileHover={{ scale: 1.1 }}
                  >
                    🎤
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Features */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className={`text-3xl font-black mb-6 ${theme === "light" ? "text-slate-800" : "text-white"}`}>
              Automated Features
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {automationFeatures.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-5 rounded-2xl border ${theme === "light" ? "bg-white border-slate-200 shadow-sm" : "bg-slate-800/50 border-slate-700"}`}
                  whileHover={{ y: -5, scale: 1.02 }}
                >
                  <motion.span 
                    className="text-3xl block mb-3"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
                  >
                    {feature.icon}
                  </motion.span>
                  <h4 className={`font-bold mb-1 ${theme === "light" ? "text-slate-800" : "text-white"}`}>{feature.title}</h4>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>{feature.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`mt-8 p-6 rounded-2xl border-2 border-green-500/30 ${theme === "light" ? "bg-green-50" : "bg-green-900/20"}`}
            >
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <motion.div 
                    className="text-3xl font-black text-green-400"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                  >
                    50K+
                  </motion.div>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>Messages/Day</p>
                </div>
                <div>
                  <motion.div 
                    className="text-3xl font-black text-green-400"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                  >
                    &lt;2s
                  </motion.div>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>Avg Response</p>
                </div>
                <div>
                  <motion.div 
                    className="text-3xl font-black text-green-400"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                  >
                    99.9%
                  </motion.div>
                  <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>Uptime</p>
                </div>
              </div>
            </motion.div>

            {/* N8N integration badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className={`mt-4 p-4 rounded-2xl flex items-center gap-4 ${theme === "light" ? "bg-orange-50 border border-orange-200" : "bg-orange-900/20 border border-orange-500/30"}`}
            >
              <motion.div 
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                n8n
              </motion.div>
              <div>
                <h4 className={`font-bold ${theme === "light" ? "text-slate-800" : "text-white"}`}>Powered by N8N</h4>
                <p className={`text-sm ${theme === "light" ? "text-slate-600" : "text-slate-400"}`}>
                  Open-source workflow automation for seamless integration
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- TESTIMONIAL CARD ---
const TestimonialCard = ({
  name,
  role,
  quote,
  avatar,
  delay,
}: {
  name: string;
  role: string;
  quote: string;
  avatar: string;
  delay: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      className="p-6 rounded-2xl border border-white/10 hover:border-green-500/30 transition-all duration-300"
    >
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="text-yellow-400">
            <Icons.Star />
          </span>
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
const FAQItem = ({
  question,
  answer,
  isOpen,
  onClick,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <motion.div className="border-b border-white/10" initial={false}>
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-medium text-white group-hover:text-green-400 transition-colors">
          {question}
        </span>
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
            animate={{ height: "auto", opacity: 1 }}
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
const PricingCard = ({
  plan,
  isPopular,
  onSelect,
  currentPlanId,
}: {
  plan: Plan;
  isPopular?: boolean;
  onSelect: (plan: Plan) => void;
  currentPlanId?: string;
}) => {
  const isCurrentPlan = currentPlanId === plan.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      whileHover={{ y: -8, scale: 1.02 }}
      className={`relative p-8 rounded-3xl ${
        isPopular
          ? "bg-gradient-to-br from-green-500/20 to-emerald-600/10 border-green-500/50"
          : "bg-white/[0.04] border-white/10"
      } border transition-all duration-300`}
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
            <span className="text-green-500">
              <Icons.Check />
            </span>
            {feature}
          </li>
        )) || (
          <>
            <li className="flex items-center gap-3 text-slate-300">
              <span className="text-green-500">
                <Icons.Check />
              </span>
              {plan.limits?.max_scans || 0} diagnoses/month
            </li>
            <li className="flex items-center gap-3 text-slate-300">
              <span className="text-green-500">
                <Icons.Check />
              </span>
              Market price alerts
            </li>
            <li className="flex items-center gap-3 text-slate-300">
              <span className="text-green-500">
                <Icons.Check />
              </span>
              Weather forecasts
            </li>
          </>
        )}
      </ul>
      <MagneticButton
        onClick={() => onSelect(plan)}
        className={`w-full py-4 rounded-xl font-bold transition-all ${
          isCurrentPlan
            ? "bg-slate-700 text-slate-400 cursor-default"
            : isPopular
            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {isCurrentPlan
          ? "Current Plan"
          : plan.price === 0
          ? "Get Started Free"
          : "Upgrade Now"}
      </MagneticButton>
    </motion.div>
  );
};

// --- HERO SECTION ---
const ParallaxHero = ({
  onStart,
  containerRef,
}: {
  onStart: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}) => {
  const { scrollY } = useScroll({ container: containerRef, layoutEffect: false });
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);
  const scale = useTransform(scrollY, [0, 400], [1, 1.1]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <FloatingParticles />

      {/* Animated Gradient Orbs Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Large moving gradient orbs */}
        <motion.div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, rgba(16, 185, 129, 0.1) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(34, 197, 94, 0.1) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
          animate={{
            x: [0, -80, -40, 0],
            y: [0, -60, -120, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Floating light beams */}
        <motion.div
          className="absolute top-0 left-1/4 w-1 h-[50vh] bg-gradient-to-b from-green-500/40 via-green-500/10 to-transparent"
          animate={{ x: [0, 200, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-0 right-1/3 w-1 h-[60vh] bg-gradient-to-b from-emerald-500/30 via-emerald-500/10 to-transparent"
          animate={{ x: [0, -150, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
        />
      </div>

      {/* Background Image with Parallax */}
      <motion.div
        style={{ y: y1, scale, opacity }}
        className="absolute inset-0 z-0"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1625246333195-09d9b430db80?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#050a08]/80 to-[#050a08]" />
      </motion.div>

      {/* Animated Grid Overlay */}
      <div className="absolute inset-0 z-0 opacity-20">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34, 197, 94, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.15) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
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
            Powered by FarmOS 3.1
            <span className="px-2 py-0.5 bg-green-500/20 rounded-full text-xs">
              AI
            </span>
          </motion.div>

          {/* Main Headline with 3D effect */}
          <motion.h1
            initial={{ opacity: 0, y: 30, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-[1.1] tracking-tight"
            style={{ perspective: "1000px" }}
          >
            <span className="block text-white">The Future of</span>
            <span className="relative inline-block mt-2">
              <SmartFarmingTyping />
              <motion.span
                className="absolute -bottom-2 left-0 right-0 h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 rounded-full"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 2 }}
              />
              {/* Glowing underline effect */}
              <motion.span
                className="absolute -bottom-2 left-0 right-0 h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 rounded-full blur-md"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 0.7 }}
                transition={{ duration: 0.8, delay: 2.1 }}
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-lg sm:text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            <span className="text-white font-semibold">Scan. Diagnose. Grow.</span>
            <br className="hidden sm:block" />
            <span className="text-slate-400">
              {" "}Your AI farming companion that speaks{" "}
            </span>
            <span className="text-green-400 font-medium">11 Indian languages</span>
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
              onClick={() => scrollToSection("demo")}
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
            className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-slate-400 text-sm"
          >
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05, color: "#fff" }}
            >
              <span className="text-green-500">✓</span> 500+ Farmers
            </motion.div>
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05, color: "#fff" }}
            >
              <span className="text-green-500">✓</span> 500+ Diseases Detected
            </motion.div>
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05, color: "#fff" }}
            >
              <span className="text-green-500">✓</span> 11 Languages
            </motion.div>
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05, color: "#fff" }}
            >
              <span className="text-green-500">✓</span> PWA App
            </motion.div>
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
    { value: 150, suffix: "+", label: "Farmers Empowered", icon: "👨‍🌾" },
    { value: 8933, suffix: "+", label: "Diagnoses Completed", icon: "🔬" },
    { value: 10000, suffix: "+", label: "Tests Done", icon: "🧪" },
    { value: 98, suffix: "%", label: "Accuracy Rate", icon: "🎯" },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, transparent 50%, rgba(16, 185, 129, 0.05) 100%)",
            "linear-gradient(225deg, rgba(16, 185, 129, 0.05) 0%, transparent 50%, rgba(34, 197, 94, 0.05) 100%)",
            "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, transparent 50%, rgba(16, 185, 129, 0.05) 100%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      {/* Floating orbs */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 100 + i * 30,
            height: 100 + i * 30,
            left: `${15 + i * 18}%`,
            top: `${30 + (i % 2) * 20}%`,
            background: `radial-gradient(circle, rgba(34, 197, 94, ${
              0.08 + i * 0.02
            }), transparent 70%)`,
            filter: "blur(30px)",
          }}
          animate={{
            y: [0, -20 - i * 5, 0],
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        />
      ))}

      {/* Morphing background shapes */}
      <motion.div
        className="absolute left-1/4 top-1/2 -translate-y-1/2 w-72 h-72 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(34, 197, 94, 0.2), transparent)",
          filter: "blur(80px)",
        }}
        animate={{
          scale: [1, 1.5, 1],
          borderRadius: ["50%", "30%", "50%"],
          rotate: [0, 180, 360],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-1/4 top-1/2 -translate-y-1/2 w-56 h-56 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(16, 185, 129, 0.2), transparent)",
          filter: "blur(60px)",
        }}
        animate={{
          scale: [1, 1.4, 1],
          x: [0, 40, 0],
          rotate: [0, -180, -360],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            <SlideUpText>
              <GradientText text="Our Impact in Numbers" />
            </SlideUpText>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            <FadeInWords text="Real results from real farmers across India." />
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: i * 0.15, type: "spring" }}
              viewport={{ once: true }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="text-center p-4 md:p-6 rounded-2xl border border-white/10 hover:border-green-500/30 transition-all group"
            >
              <motion.span
                className="text-3xl md:text-5xl mb-3 md:mb-4 block"
                animate={{
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.3 }}
              >
                {stat.icon}
              </motion.span>
              <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-2 md:mb-3 whitespace-nowrap">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <p className="text-slate-400 text-xs md:text-sm font-medium">
                <ShimmerText>{stat.label}</ShimmerText>
              </p>
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
    {
      icon: "🦠",
      title: "Late Disease Detection",
      desc: "Farmers often notice diseases only when 20-30% of the crop is already affected, leading to massive losses.",
      stat: "30%",
      statLabel: "Crop Loss",
    },
    {
      icon: "💰",
      title: "Market Uncertainty",
      desc: "No real-time access to Mandi prices leads to selling at unfair rates or missing peak opportunities.",
      stat: "₹1.5L Cr",
      statLabel: "Annual Losses",
    },
    {
      icon: "👨‍⚕️",
      title: "Expert Shortage",
      desc: "With 1 agricultural officer per 20,000+ farmers, expert guidance is nearly inaccessible.",
      stat: "1:20K",
      statLabel: "Expert Ratio",
    },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        {/* Floating warning particles */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-red-500/30 rounded-full"
            style={{ left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="text-red-500 font-medium text-sm uppercase tracking-wider mb-4 block"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ⚠️ The Problem
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            <SlideUpText>
              <GlitchText text="Why Farmers Need" className="text-white" />
            </SlideUpText>{" "}
            <motion.span
              className="text-green-500 inline-block"
              whileHover={{
                scale: 1.05,
                textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
              }}
            >
              <GlowPulseText>
                <AnimatedText text="Fasal Rakshak" />
              </GlowPulseText>
            </motion.span>
          </h2>
          <motion.p
            className="text-slate-400 max-w-2xl mx-auto text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <FadeInWords text="Indian agriculture faces critical challenges that cost farmers billions every year." />
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50, rotateX: -15 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              viewport={{ once: true }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="p-8 rounded-3xl bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/20 hover:border-red-500/40 transition-all group relative overflow-hidden"
            >
              {/* Animated glow on hover */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.15), transparent 70%)",
                }}
              />

              <motion.span
                className="text-5xl mb-6 block relative z-10"
                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
              >
                {problem.icon}
              </motion.span>
              <h3 className="text-xl font-bold text-white mb-3 relative z-10">
                <ShimmerText>{problem.title}</ShimmerText>
              </h3>
              <p className="text-slate-400 mb-6 leading-relaxed relative z-10">
                <BounceInText delay={0.2}>{problem.desc}</BounceInText>
              </p>
              <motion.div
                className="pt-4 border-t border-white/10 relative z-10"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <motion.span
                  className="text-3xl font-black text-red-400"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {problem.stat}
                </motion.span>
                <span className="text-slate-500 text-sm ml-2">
                  {problem.statLabel}
                </span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- IMPACT / APP DEMO SECTION ---
const ImpactSection = ({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
}) => {
  const features = [
    {
      icon: "🦠",
      title: "Early Disease Detection",
      desc: "Identify diseases before they spread. Our AI analyzes leaf patterns to detect issues days before they become visible to the naked eye.",
    },
    {
      icon: "📈",
      title: "Market Price Insights",
      desc: "Know when to sell. Get real-time price alerts from 5+ nearby Mandis and predict future trends using historical data.",
    },
    {
      icon: "🧪",
      title: "Soil Health Analysis",
      desc: "Understand your soil. Get NPK values, pH levels, and personalized fertilizer recommendations from a simple photo.",
    },
    {
      icon: "📅",
      title: "AI Crop Planner",
      desc: "Day-by-day farming calendar from sowing to harvest. Dynamic task checklists personalized for your farm.",
    },
  ];

  return (
    <section id="demo" className="py-32 relative overflow-hidden">
      {/* Animated background elements */}
      <motion.div
        className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/15 rounded-full blur-[150px]"
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-[150px]"
        animate={{
          scale: [1, 1.3, 1],
          y: [0, -30, 0],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 bg-green-500/40 rounded-full"
          style={{ left: `${20 + i * 12}%`, top: `${15 + (i % 3) * 30}%` }}
          animate={{
            y: [0, -40, 0],
            x: [0, i % 2 === 0 ? 20 : -20, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}

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
            <motion.span
              className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨ How It Works
            </motion.span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
              <SlideUpText>
                <WaveText
                  text="Real-time Intelligence"
                  className="text-white"
                />
              </SlideUpText>{" "}
              <br />
              <FadeInWords text="for " />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                <AnimatedText text="Every Acre" />
              </span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              <FadeInWords text="We combine satellite imagery, IoT sensor data, and advanced computer vision to give farmers a complete picture of their crop health." />
            </p>

            <div className="space-y-6">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  viewport={{ once: true }}
                  whileHover={{ x: 8, scale: 1.02 }}
                  className="flex gap-5 p-5 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer border border-transparent hover:border-green-500/20"
                >
                  <motion.div
                    className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 group-hover:bg-green-500/20 transition-all duration-300"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      delay: i * 0.3,
                    }}
                  >
                    {feature.icon}
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-green-400 transition-colors">
                      <ShimmerText>{feature.title}</ShimmerText>
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
                      <BounceInText delay={0.1}>{feature.desc}</BounceInText>
                    </p>
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
const EcosystemSection = ({
  setView,
}: {
  setView: (view: AppView) => void;
}) => {
  const portals = [
    {
      icon: "👨‍🌾",
      title: "Farmer Portal",
      desc: "AgroHub dashboard, disease diagnosis, crop planning, market intelligence, and community feed.",
      color: "green",
      action: null,
    },
    {
      icon: "🚚",
      title: "Driver Portal",
      desc: "Trip radar, earnings wallet, negotiation chat, and route maps for logistics partners.",
      color: "orange",
      action: () => setView(AppView.DRIVER_AUTH),
    },
    {
      icon: "🕵️",
      title: "Agent Portal",
      desc: "Ground truth price verification, reputation scoring, and gamified data collection.",
      color: "blue",
      action: null,
    },
    {
      icon: "🔐",
      title: "Admin Dashboard",
      desc: "System health monitoring, user management, emergency controls, and analytics.",
      color: "purple",
      action: null,
    },
  ];

  const colorClasses: Record<
    string,
    { bg: string; border: string; text: string; glow: string }
  > = {
    green: {
      bg: "from-green-500/20 to-green-600/10",
      border: "border-green-500/30 hover:border-green-500/60",
      text: "text-green-400",
      glow: "group-hover:shadow-green-500/20",
    },
    orange: {
      bg: "from-orange-500/20 to-orange-600/10",
      border: "border-orange-500/30 hover:border-orange-500/60",
      text: "text-orange-400",
      glow: "group-hover:shadow-orange-500/20",
    },
    blue: {
      bg: "from-blue-500/20 to-blue-600/10",
      border: "border-blue-500/30 hover:border-blue-500/60",
      text: "text-blue-400",
      glow: "group-hover:shadow-blue-500/20",
    },
    purple: {
      bg: "from-purple-500/20 to-purple-600/10",
      border: "border-purple-500/30 hover:border-purple-500/60",
      text: "text-purple-400",
      glow: "group-hover:shadow-purple-500/20",
    },
  };

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Animated connecting lines */}
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
        <motion.line
          x1="25%"
          y1="50%"
          x2="75%"
          y2="50%"
          stroke="url(#lineGradient)"
          strokeWidth="2"
          strokeDasharray="10 10"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 2 }}
        />
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🌐 The Ecosystem
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            <SlideUpText>
              <WaveText text="Built for the" className="text-white" />
            </SlideUpText>{" "}
            <motion.span
              className="text-green-500 inline-block"
              whileHover={{
                scale: 1.05,
                textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
              }}
            >
              <GlowPulseText>
                <AnimatedText text="Entire" />
              </GlowPulseText>
            </motion.span>{" "}
            <GradientText text="Agri-Chain" />
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            <FadeInWords text="A unified platform serving farmers, transporters, market agents, and administrators." />
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {portals.map((portal, i) => {
            const colors = colorClasses[portal.color];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30, rotateX: -10 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, scale: 1.03 }}
                onClick={portal.action || undefined}
                className={`group p-8 rounded-3xl bg-gradient-to-br ${
                  colors.bg
                } border ${colors.border} transition-all duration-300 ${
                  colors.glow
                } group-hover:shadow-xl ${
                  portal.action ? "cursor-pointer" : ""
                }`}
              >
                <motion.span
                  className="text-5xl mb-6 block group-hover:scale-110 transition-transform duration-300"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: i * 0.3 }}
                >
                  {portal.icon}
                </motion.span>
                <h3 className={`text-xl font-bold ${colors.text} mb-3`}>
                  <ShimmerText>{portal.title}</ShimmerText>
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
                  <BounceInText delay={0.1}>{portal.desc}</BounceInText>
                </p>
                {portal.action && (
                  <div
                    className={`mt-4 flex items-center gap-2 ${colors.text} text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity`}
                  >
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
    {
      icon: <Icons.Brain />,
      title: "AI Council Architecture",
      desc: "Multi-agent consensus using 5 AI personas (Botanist, Farmer, Analyst, Critic, System) for accurate diagnosis.",
    },
    {
      icon: <Icons.Wifi />,
      title: "IoT Integration",
      desc: "Real-time soil moisture, temperature, and NPK monitoring with ESP32 firmware generation.",
    },
    {
      icon: <Icons.Smartphone />,
      title: "PWA Technology",
      desc: "Install directly from browser. Fast loading, smooth animations, and native app-like experience.",
    },
    {
      icon: <Icons.Globe />,
      title: "11 Regional Languages",
      desc: "Full voice and text support in Hindi, Odia, Telugu, Tamil, Kannada, Malayalam, and more.",
    },
    {
      icon: <Icons.Mic />,
      title: "Voice-Native Interface",
      desc: "Speech-to-text for form filling and text-to-speech for reading diagnoses in native language.",
    },
    {
      icon: <Icons.BarChart />,
      title: "Geospatial Intelligence",
      desc: "Disease heatmaps with 10km cluster alerts and reverse geocoding for local schemes.",
    },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent" />

      {/* Floating tech icons */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-green-500/10 text-4xl"
          style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
          animate={{
            y: [0, -25, 0],
            rotate: [0, 360],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 8 + i, repeat: Infinity, delay: i * 0.5 }}
        >
          {["⚡", "🔬", "🛰️", "📡", "🧬", "💡"][i]}
        </motion.div>
      ))}

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ⚙️ Technology
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            <SlideUpText>
              <WaveText text="Cutting-Edge" className="text-white" />
            </SlideUpText>{" "}
            <motion.span
              className="text-green-500 inline-block"
              whileHover={{
                scale: 1.05,
                textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
              }}
            >
              <GlowPulseText>
                <AnimatedText text="Innovation" />
              </GlowPulseText>
            </motion.span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            <FadeInWords text="Built with the latest in AI, IoT, and cloud technology to deliver unmatched performance." />
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
    {
      name: "Ramesh Kumar",
      role: "Wheat Farmer, Punjab",
      quote:
        "Fasal Rakshak saved my entire wheat crop from blight. The AI detected it 5 days before I could see it myself!",
      avatar: "RK",
      rating: 5,
    },
    {
      name: "Priya Devi",
      role: "Cotton Farmer, Gujarat",
      quote:
        "The market price alerts helped me sell at the best time. I earned ₹15,000 more than last year.",
      avatar: "PD",
      rating: 5,
    },
    {
      name: "Suresh Reddy",
      role: "Rice Farmer, Telangana",
      quote:
        "I can use it in Telugu. Perfect for my farm in the village. The AI diagnosis is very accurate!",
      avatar: "SR",
      rating: 5,
    },
    {
      name: "Balwinder Singh",
      role: "Driver Partner, Haryana",
      quote:
        "As a truck driver, I get regular trips from farmers. The app makes negotiation easy and fair.",
      avatar: "BS",
      rating: 4,
    },
    {
      name: "Anjali Sharma",
      role: "Vegetable Farmer, UP",
      quote:
        "Soil analysis feature helped me understand exactly what nutrients my soil needed. Yield improved by 40%!",
      avatar: "AS",
      rating: 5,
    },
    {
      name: "Mohan Patel",
      role: "Sugarcane Farmer, Maharashtra",
      quote:
        "The crop planning calendar is a game changer. I know exactly when to plant and harvest now.",
      avatar: "MP",
      rating: 5,
    },
  ];

  // Double the testimonials for seamless infinite scroll
  const doubledTestimonials = [...testimonials, ...testimonials];

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "radial-gradient(ellipse at 20% 50%, rgba(34, 197, 94, 0.08) 0%, transparent 60%)",
            "radial-gradient(ellipse at 80% 50%, rgba(34, 197, 94, 0.08) 0%, transparent 60%)",
            "radial-gradient(ellipse at 20% 50%, rgba(34, 197, 94, 0.08) 0%, transparent 60%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-green-500 font-medium text-sm uppercase tracking-wider">
              ⭐ Google Play Reviews
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Icons.Star key={i} />
              ))}
            </span>
            <span className="text-slate-400 text-sm">4.8/5</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            <SlideUpText>
              <WaveText text="Loved by" className="text-white" />
            </SlideUpText>{" "}
            <motion.span
              className="text-green-500 inline-block"
              whileHover={{
                scale: 1.05,
                textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
              }}
            >
              <GlowPulseText>
                <AnimatedText text="500+" />
              </GlowPulseText>
            </motion.span>{" "}
            <GradientText text="Farmers" />
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            <FadeInWords text="Real reviews from real farmers on Google Play Store." />
          </p>
        </motion.div>

        {/* Scrolling testimonials - Google style */}
        <div className="relative">
          {/* Gradient masks for smooth edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#050a08] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#050a08] to-transparent z-10 pointer-events-none" />
          
          {/* First row - scrolling left */}
          <motion.div 
            className="flex gap-6 mb-6"
            animate={{ x: [0, -1800] }}
            transition={{ 
              x: { duration: 40, repeat: Infinity, ease: "linear" }
            }}
          >
            {doubledTestimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                className="flex-shrink-0 w-[350px] p-6 rounded-2xl border border-white/10 hover:border-green-500/30 transition-all duration-300 group"
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="flex gap-1 mb-3">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <span key={j} className="text-yellow-400">
                      <Icons.Star />
                    </span>
                  ))}
                </div>
                <p className="text-slate-300 mb-4 leading-relaxed text-sm">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{testimonial.name}</h4>
                    <p className="text-slate-500 text-xs">{testimonial.role}</p>
                  </div>
                  <div className="ml-auto">
                    <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Second row - scrolling right */}
          <motion.div 
            className="flex gap-6"
            animate={{ x: [-1800, 0] }}
            transition={{ 
              x: { duration: 45, repeat: Infinity, ease: "linear" }
            }}
          >
            {[...doubledTestimonials].reverse().map((testimonial, i) => (
              <motion.div
                key={i}
                className="flex-shrink-0 w-[350px] p-6 rounded-2xl border border-white/10 hover:border-green-500/30 transition-all duration-300 group"
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="flex gap-1 mb-3">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <span key={j} className="text-yellow-400">
                      <Icons.Star />
                    </span>
                  ))}
                </div>
                <p className="text-slate-300 mb-4 leading-relaxed text-sm">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{testimonial.name}</h4>
                    <p className="text-slate-500 text-xs">{testimonial.role}</p>
                  </div>
                  <div className="ml-auto">
                    <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
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

// Inner component that uses theme
const LandingPageContent: React.FC<LandingPageProps> = ({
  onStart,
  onLogin,
  user,
  onUserUpdate,
  onAgroHubClick,
  onScan,
  setView,
}) => {
  const { theme } = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentPlan, setPaymentPlan] = useState<Plan | null>(null);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPlans().then(setPlans);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setIsScrolled(containerRef.current.scrollTop > 50);
      }
    };
    const container = containerRef.current;
    container?.addEventListener("scroll", handleScroll);
    return () => container?.removeEventListener("scroll", handleScroll);
  }, []);

  // Normal scrolling - Lenis disabled for standard scroll behavior
  // The container uses native CSS scroll-behavior: smooth

  const handlePlanSelect = async (plan: Plan) => {
    if (!user) {
      onLogin();
      return;
    }
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
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const faqs = [
    {
      question: "What is Fasal Rakshak?",
      answer:
        "Fasal Rakshak is an AI-powered crop doctor app that helps farmers diagnose plant diseases, get market intelligence, plan crops, and connect with experts - all in their native language.",
    },
    {
      question: "What languages are supported?",
      answer:
        "We support 11 regional languages including Hindi, Odia, Telugu, Tamil, Kannada, Malayalam, Gujarati, Marathi, Punjabi, and Bengali. Both voice input and text output work in your native language.",
    },
    {
      question: "How accurate is the AI diagnosis?",
      answer:
        "Our multi-agent AI council achieves 98% accuracy by combining visual analysis with weather data, soil conditions, and location context to eliminate false positives.",
    },
    {
      question: "Is Fasal Rakshak a PWA?",
      answer:
        "Yes! Fasal Rakshak is a Progressive Web App (PWA) that you can install on your phone directly from the browser. It works like a native app with quick loading and smooth performance.",
    },
    {
      question: "Can I talk to real experts?",
      answer:
        "Yes! Pro plan subscribers get access to priority expert chat where you can consult with agricultural specialists directly within the app.",
    },
    {
      question: "How do I connect IoT sensors?",
      answer:
        "Fasal Rakshak generates custom ESP32 firmware code based on your WiFi credentials. Simply upload it to your sensor, and data flows directly to your dashboard.",
    },
  ];

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-y-auto overflow-x-hidden font-sans scroll-smooth transition-colors duration-300 ${
        theme === "light"
          ? "bg-white text-slate-800 selection:bg-emerald-500/30"
          : "bg-[#050a08] text-slate-200 selection:bg-emerald-500/30"
      }`}
      style={{ scrollBehavior: "smooth" }}
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
            ? theme === "light"
              ? "bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-lg shadow-black/5"
              : "bg-[#050a08]/95 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-pointer group"
            onClick={scrollToTop}
          >
            <span className="text-3xl group-hover:scale-110 transition-transform">
              🌱
            </span>
            <span
              className={`font-black text-xl tracking-tight ${
                theme === "light" ? "text-slate-800" : "text-white"
              }`}
            >
              Fasal Rakshak
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:flex items-center gap-8"
          >
            <button
              onClick={() => scrollToSection("features")}
              className={`text-sm font-medium ${
                theme === "light"
                  ? "text-slate-600 hover:text-green-600"
                  : "text-slate-300 hover:text-green-400"
              } transition-colors relative group`}
            >
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
            </button>
            <button
              onClick={() => scrollToSection("demo")}
              className={`text-sm font-medium ${
                theme === "light"
                  ? "text-slate-600 hover:text-green-600"
                  : "text-slate-300 hover:text-green-400"
              } transition-colors relative group`}
            >
              Demo
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className={`text-sm font-medium ${
                theme === "light"
                  ? "text-slate-600 hover:text-green-600"
                  : "text-slate-300 hover:text-green-400"
              } transition-colors relative group`}
            >
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className={`text-sm font-medium ${
                theme === "light"
                  ? "text-slate-600 hover:text-green-600"
                  : "text-slate-300 hover:text-green-400"
              } transition-colors relative group`}
            >
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
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-green-500/30 transition-all"
              >
                Get Started
              </MagneticButton>
            )}
          </motion.div>
        </div>
      </motion.nav>

      {/* HERO SECTION */}
      <ParallaxHero onStart={onStart} containerRef={containerRef} />

      {/* STATS SECTION - loads immediately after hero */}
      <LazySection rootMargin="400px">
        <StatsSection />
      </LazySection>

      {/* PROBLEMS SECTION */}
      <LazySection rootMargin="300px">
        <ProblemsSection />
      </LazySection>

      {/* DEMO / IMPACT SECTION */}
      <LazySection rootMargin="300px">
        <ImpactSection containerRef={containerRef} />
      </LazySection>

      {/* VIDEO EXPLAINER SECTION */}
      <LazySection rootMargin="200px">
        <VideoExplainerSection />
      </LazySection>

      {/* AI COUNCIL SECTION */}
      <LazySection rootMargin="200px">
        <AICouncilSection />
      </LazySection>

      {/* AI FEATURES DETAILED SECTION */}
      <LazySection rootMargin="200px">
        <AIFeaturesSection />
      </LazySection>

      {/* TRUSTED PARTNERS / GOVT APIs SECTION */}
      <LazySection rootMargin="200px">
        <TrustedPartnersSection />
      </LazySection>

      {/* PRIVACY & ENCRYPTION COMPARISON SECTION */}
      <LazySection rootMargin="200px">
        <PrivacyEncryptionSection />
      </LazySection>

      {/* CHAT & COMMUNICATION HUB SECTION */}
      <LazySection rootMargin="200px">
        <ChatCommunicationSection />
      </LazySection>

      {/* N8N WHATSAPP AUTOMATION SECTION */}
      <LazySection rootMargin="200px">
        <N8NAutomationSection />
      </LazySection>

      {/* FEATURES SECTION */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block">
              Features
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
              <AnimatedText text="Intelligence for" />{" "}
              <motion.span
                className="text-green-500 inline-block"
                whileHover={{
                  scale: 1.05,
                  textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
                }}
              >
                <AnimatedText text="Every Acre" />
              </motion.span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Comprehensive tools designed specifically for the modern Indian
              farmer.
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
                className="group relative h-full p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-500/5 border border-orange-500/20 hover:border-orange-500/50 transition-all duration-500 overflow-hidden cursor-pointer"
                onClick={() => setView(AppView.DRIVER_AUTH)}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-orange-400 mb-6 group-hover:scale-110 transition-transform duration-300 border border-orange-500/20">
                  <Icons.Truck />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-orange-400 transition-colors">
                  Logistics Network
                </h3>
                <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                  Connect with verified drivers to transport harvest to Mandis
                  at fair prices with real-time tracking.
                </p>
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
      <LazySection rootMargin="200px">
        <EcosystemSection setView={setView} />
      </LazySection>

      {/* TECH SECTION */}
      <LazySection rootMargin="200px">
        <TechSection />
      </LazySection>

      {/* TESTIMONIALS */}
      <LazySection rootMargin="200px">
        <TestimonialsSection />
      </LazySection>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent" />

        {/* Animated price tags floating */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-3xl opacity-20"
            style={{ left: `${10 + i * 20}%`, top: `${15 + (i % 3) * 25}%` }}
            animate={{
              y: [0, -30, 0],
              rotate: [0, 10, -10, 0],
              opacity: [0.1, 0.25, 0.1],
            }}
            transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.5 }}
          >
            💰
          </motion.div>
        ))}

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.span
              className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              💎 Pricing
            </motion.span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              <SlideUpText>
                <WaveText text="Simple," className="text-white" />
              </SlideUpText>{" "}
              <motion.span
                className="text-green-500 inline-block"
                whileHover={{
                  scale: 1.05,
                  textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
                }}
              >
                <GlowPulseText>
                  <AnimatedText text="Transparent" />
                </GlowPulseText>
              </motion.span>{" "}
              <GradientText text="Pricing" />
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              <FadeInWords text="Start free. Upgrade when you need more power." />
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
                  plan={
                    {
                      id: "1",
                      name: "Free",
                      price: 0,
                      interval: "month",
                      limits: {
                        max_scans: 3,
                        allow_weather: true,
                        allow_expert_chat: false,
                        allow_market_history: false,
                        priority_support: false,
                      },
                      recommended: false,
                      features: [
                        "3 scans/day",
                        "Basic market data",
                        "Weather alerts",
                        "Community access",
                      ],
                    } as Plan
                  }
                  onSelect={handlePlanSelect}
                  currentPlanId={user?.plan_id}
                />
                <PricingCard
                  plan={
                    {
                      id: "2",
                      name: "Kisan Plus",
                      price: 199,
                      interval: "month",
                      limits: {
                        max_scans: 15,
                        allow_weather: true,
                        allow_expert_chat: false,
                        allow_market_history: true,
                        priority_support: false,
                      },
                      recommended: true,
                      features: [
                        "15 scans/day",
                        "IoT integration",
                        "Full market intel",
                        "Crop calendar",
                        "Priority support",
                      ],
                    } as Plan
                  }
                  isPopular
                  onSelect={handlePlanSelect}
                  currentPlanId={user?.plan_id}
                />
                <PricingCard
                  plan={
                    {
                      id: "3",
                      name: "Kisan Pro",
                      price: 499,
                      interval: "month",
                      limits: {
                        max_scans: 40,
                        allow_weather: true,
                        allow_expert_chat: true,
                        allow_market_history: true,
                        priority_support: true,
                      },
                      recommended: false,
                      features: [
                        "40 scans/day",
                        "Historical data",
                        "Expert chat access",
                        "Custom reports",
                        "API access",
                      ],
                    } as Plan
                  }
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

        {/* 3D Floating elements */}
        <motion.div
          className="absolute top-10 left-10 w-32 h-32 border border-green-500/20 rounded-2xl"
          style={{ perspective: "500px" }}
          animate={{
            rotateX: [0, 20, 0],
            rotateY: [0, 20, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-10 right-10 w-24 h-24 border border-emerald-500/20 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/2 left-20 w-16 h-16 bg-gradient-to-br from-green-500/10 to-transparent rounded-lg"
          animate={{
            rotate: [45, 90, 45],
            y: [0, -30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="container mx-auto px-6 relative z-10">
          <Rotating3DCard className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center p-8 rounded-3xl border border-white/10"
            >
              <motion.h2
                className="text-4xl md:text-5xl font-black text-white mb-6"
                whileHover={{ scale: 1.02 }}
              >
                <SlideUpText>
                  <GradientText text="Ready to Protect Your Harvest?" />
                </SlideUpText>
              </motion.h2>
              <p className="text-xl text-slate-300 mb-10">
                <FadeInWords text="Join 500+ farmers who are already growing smarter with Fasal Rakshak." />
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
                <span className="flex items-center gap-2">
                  <Icons.Check /> No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <Icons.Check /> Free forever plan
                </span>
                <span className="flex items-center gap-2">
                  <Icons.Check /> Cancel anytime
                </span>
              </div>
            </motion.div>
          </Rotating3DCard>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-24 relative overflow-hidden">
        {/* Animated background */}
        <motion.div
          className="absolute inset-0 opacity-50"
          animate={{
            background: [
              "radial-gradient(circle at 30% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)",
              "radial-gradient(circle at 70% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)",
              "radial-gradient(circle at 30% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.span
              className="text-green-500 font-medium text-sm uppercase tracking-wider mb-4 block"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ❓ FAQ
            </motion.span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              <SlideUpText>
                <WaveText text="Common" className="text-white" />
              </SlideUpText>{" "}
              <motion.span
                className="text-green-500 inline-block"
                whileHover={{
                  scale: 1.05,
                  textShadow: "0 0 30px rgba(34, 197, 94, 0.8)",
                }}
              >
                <GlowPulseText>
                  <AnimatedText text="Questions" />
                </GlowPulseText>
              </motion.span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              <FadeInWords text="Everything you need to know about Fasal Rakshak." />
            </p>
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
      <footer className="py-16 border-t border-white/10 bg-black/50 relative overflow-hidden">
        {/* Animated footer background */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              "radial-gradient(ellipse at 20% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)",
              "radial-gradient(ellipse at 80% 20%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)",
              "radial-gradient(ellipse at 20% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <motion.div
              className="md:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <motion.div
                className="flex items-center gap-3 mb-4"
                whileHover={{ scale: 1.02 }}
              >
                <motion.span
                  className="text-3xl"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  🌱
                </motion.span>
                <span className="font-black text-2xl text-white">
                  <GradientText text="Fasal Rakshak" />
                </span>
              </motion.div>
              <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                <FadeInWords text="AI-powered farming platform empowering Indian farmers with instant disease diagnosis, market intelligence, and expert guidance in 11 languages." />
              </p>
              <div className="flex gap-4">
                <motion.a
                  href="#"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-green-500 transition-colors"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                  </svg>
                </motion.a>
                <motion.a
                  href="#"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-green-500 transition-colors"
                  whileHover={{ scale: 1.15, rotate: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </motion.a>
                <motion.a
                  href="#"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-green-500 transition-colors"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                  </svg>
                </motion.a>
              </div>
            </motion.div>

            {/* Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
            >
              <h4 className="font-bold text-white mb-4">
                <ShimmerText>Product</ShimmerText>
              </h4>
              <ul className="space-y-3 text-slate-400">
                {["Features", "Pricing", "Demo", "FAQ"].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <motion.button
                      onClick={() => scrollToSection(item.toLowerCase())}
                      className="hover:text-green-400 transition-colors"
                      whileHover={{ x: 5 }}
                    >
                      {item}
                    </motion.button>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h4 className="font-bold text-white mb-4">
                <ShimmerText>Company</ShimmerText>
              </h4>
              <ul className="space-y-3 text-slate-400">
                {["About Us", "Blog", "Careers", "Contact"].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <motion.a
                      href="#"
                      className="hover:text-green-400 transition-colors"
                      whileHover={{ x: 5 }}
                    >
                      {item}
                    </motion.a>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div
            className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            viewport={{ once: true }}
          >
            <p className="text-slate-500 text-sm">
              © 2025 CropSafe AI Systems.{" "}
              <span className="text-green-500/70">
                Built for the Future of Farming.
              </span>
            </p>
            <div className="flex gap-6 text-slate-500 text-sm">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(
                (item, i) => (
                  <motion.a
                    key={item}
                    href="#"
                    className="hover:text-green-400 transition-colors"
                    whileHover={{ y: -2 }}
                  >
                    {item}
                  </motion.a>
                )
              )}
            </div>
          </motion.div>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

// Main exported component wrapped with ThemeProvider and ReducedMotion detection
export const LandingPage: React.FC<LandingPageProps> = (props) => {
  const reducedMotion = useReducedMotion();
  
  return (
    <ThemeProvider>
      <ReducedMotionContext.Provider value={reducedMotion}>
        <LandingPageContent {...props} />
      </ReducedMotionContext.Provider>
    </ThemeProvider>
  );
};
