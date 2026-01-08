
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- ICONS ---
const Icons = {
  Leaf: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.5 2 9 0 5.5-4.5 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  Home: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Scan: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
  Hub: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>,
  Profile: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Sun: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  Play: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Pause: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
};

// --- MOCK DATA ---
const MOCK_DATA = {
  weather: { temp: 32, humidity: 65, soil: "Wet (High)", rain: "No Rain", location: "Nagpur, MH" },
  alerts: [{ id: 1, type: "Pest", title: "Stem Borer", dist: "2km", severity: "high" }],
  market: [
    { crop: "Wheat", price: "₹2,100", trend: "up" },
    { crop: "Rice", price: "₹1,950", trend: "down" },
    { crop: "Cotton", price: "₹6,200", trend: "up" },
    { crop: "Soybean", price: "₹4,800", trend: "stable" },
    { crop: "Tomato", price: "₹1,200", trend: "up" }
  ],
  diagnosis: {
    name: "Late Blight",
    crop: "Tomato",
    severity: "High (4/5)",
    confidence: "98%",
    health: 45,
    summary: "Severe fungal infection detected. Immediate chemical intervention recommended to save crop.",
    chemical: { name: "Mancozeb 75 WP", dosage: "2g / Liter", cost: "₹350/acre", method: "Foliar Spray" },
    organic: { name: "Copper Fungicide", dosage: "3g / Liter", cost: "₹420/acre", method: "Root Drench" }
  },
  user: {
      name: "Ramesh Kumar",
      plan: "Pro Plan",
      crops: ["Rice", "Wheat", "Tomato"]
  }
};

type ViewState = 'dashboard' | 'diagnose' | 'market' | 'profile' | 'results' | 'analyzing';

export interface MiniAppProps {
  mode: 'mobile' | 'desktop';
  isAutoPlay: boolean;
  onUserInteract: () => void;
  onPhaseChange?: (phase: 0 | 1 | 2) => void;
}

// --- MINI APP COMPONENT ---
export const MiniAppContent: React.FC<MiniAppProps> = ({ mode, isAutoPlay, onUserInteract, onPhaseChange }) => {
  const [activeTab, setActiveTab] = useState<ViewState>('dashboard');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [councilStep, setCouncilStep] = useState(0); // 0-5 for council animation
  const [resultTab, setResultTab] = useState<'chem' | 'org'>('chem');
  
  // Virtual Cursor State
  const [cursor, setCursor] = useState({ x: '50%', y: '50%', active: false, click: false });

  // --- AUTO PILOT SEQUENCE ---
  useEffect(() => {
      let timeouts: ReturnType<typeof setTimeout>[] = [];
      
      if (isAutoPlay) {
          // Reset State
          setActiveTab('dashboard');
          setUploadProgress(0);
          setCouncilStep(0);
          setResultTab('chem');
          if (onPhaseChange) onPhaseChange(0); // Start at Capture Phase

          const isMobile = mode === 'mobile';

          const move = (x: string, y: string, ms: number) => timeouts.push(setTimeout(() => setCursor({ x, y, active: true, click: false }), ms));
          const click = (ms: number) => timeouts.push(setTimeout(() => setCursor(prev => ({ ...prev, click: true })), ms));
          const action = (fn: () => void, ms: number) => timeouts.push(setTimeout(() => { setCursor(prev => ({ ...prev, click: false })); fn(); }, ms));

          // 1. Dashboard -> Click Diagnose
          // Mobile: Bottom Center. Desktop: Top Center-Right Link
          move(isMobile ? '50%' : '55%', isMobile ? '90%' : '5%', 1000); 
          click(2000);
          action(() => {
              setActiveTab('diagnose');
              if (onPhaseChange) onPhaseChange(0); // Still Capture Phase (Pre-scan)
          }, 2200);

          // 2. Diagnose -> Take Photo (Center Bottom Button)
          move('50%', '85%', 3000); 
          click(4000);
          action(() => {
              handleUploadSequence();
              // handleUploadSequence triggers Phase 1 and then Phase 2 internally
          }, 4200);

          // 3. Analysis happens automatically... wait for Results (approx +5s)
          
          // 4. Results -> View Tabs (Organic)
          move('75%', '50%', 10000); 
          click(11000);
          action(() => setResultTab('org'), 11200);

          // 5. Results -> Go to Market
          // Mobile: Bottom Left-Center. Desktop: Top Left-Center
          move(isMobile ? '30%' : '45%', isMobile ? '90%' : '5%', 13000); 
          click(14000);
          action(() => setActiveTab('market'), 14200);

          // 6. Market -> Go to Profile
          // Mobile: Bottom Right. Desktop: Top Right Avatar
          move(isMobile ? '90%' : '95%', isMobile ? '90%' : '5%', 16000); 
          click(17000);
          action(() => setActiveTab('profile'), 17200);

          // 7. Profile -> Back to Home
          // Mobile: Bottom Left. Desktop: Top Left Link
          move(isMobile ? '10%' : '35%', isMobile ? '90%' : '5%', 19000); 
          click(20000);
          action(() => {
              setActiveTab('dashboard');
              if (onPhaseChange) onPhaseChange(0); // Reset to Capture Phase
          }, 20200);
          
          // Hide cursor at end
          timeouts.push(setTimeout(() => setCursor(p => ({...p, active: false})), 22000));
      }

      return () => timeouts.forEach(clearTimeout);
  }, [isAutoPlay, mode]);

  const handleInteraction = (fn: () => void) => {
      onUserInteract();
      fn();
  };

  const handleUploadSequence = () => {
      setActiveTab('analyzing');
      setUploadProgress(0);
      setCouncilStep(0);
      if (onPhaseChange) onPhaseChange(1); // Phase 1: Analyze

      // Upload Simulation
      let p = 0;
      const upInterval = setInterval(() => {
          p += 5;
          setUploadProgress(p);
          if (p >= 100) {
              clearInterval(upInterval);
              // Council Simulation
              let step = 0;
              const councilInterval = setInterval(() => {
                  step++;
                  setCouncilStep(step);
                  if (step >= 5) {
                      clearInterval(councilInterval);
                      setTimeout(() => {
                          setActiveTab('results');
                          if (onPhaseChange) onPhaseChange(2); // Phase 2: Resolve
                      }, 500);
                  }
              }, 600);
          }
      }, 50);
  };

  // --- RENDERERS ---

  const renderDashboard = () => (
      <div className={`space-y-4 p-4 ${mode === 'mobile' ? 'pb-20' : 'pb-4'} overflow-y-auto h-full custom-scrollbar bg-slate-50`}>
          <div className="flex justify-between items-center">
              <div>
                  <h2 className="text-xl font-black text-slate-900">AgroHub</h2>
                  <p className="text-xs text-slate-500">Welcome, {MOCK_DATA.user.name}</p>
              </div>
              {mode === 'mobile' && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${MOCK_DATA.user.name}`} />
                  </div>
              )}
          </div>

          {/* Weather Widget */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
              <div className="absolute right-[-10px] top-[-10px] opacity-20 scale-150"><Icons.Sun /></div>
              <div className="flex justify-between items-start relative z-10">
                  <div>
                      <div className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full inline-block mb-2">📍 {MOCK_DATA.weather.location}</div>
                      <h2 className="text-3xl font-black">{MOCK_DATA.weather.temp}°C</h2>
                  </div>
                  <div className="text-right space-y-1">
                      <div className="bg-black/20 px-2 py-1 rounded text-[10px]">💧 {MOCK_DATA.weather.humidity}%</div>
                      <div className="bg-black/20 px-2 py-1 rounded text-[10px]">🌱 {MOCK_DATA.weather.soil}</div>
                  </div>
              </div>
          </div>

          {/* Alert */}
          {MOCK_DATA.alerts.map(a => (
              <div key={a.id} className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-xl shadow-sm flex gap-3 items-center">
                  <div className="bg-red-100 p-2 rounded-full text-red-600 text-xs">⚠️</div>
                  <div>
                      <h4 className="font-bold text-red-800 text-xs uppercase">{a.title} Alert</h4>
                      <p className="text-[10px] text-red-600">Detected {a.dist} away.</p>
                  </div>
              </div>
          ))}

          {/* Recent Scans */}
          <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Recent Scans</h3>
              <div className="space-y-2">
                  {[1,2].map(i => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex gap-3 items-center">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-lg">🌾</div>
                          <div className="flex-1">
                              <h4 className="font-bold text-xs text-slate-800">Wheat Rust</h4>
                              <p className="text-[10px] text-slate-500">2 days ago</p>
                          </div>
                          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">Healed</span>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  const renderDiagnose = () => (
      <div className="h-full bg-slate-900 relative flex flex-col">
          <div className="flex-1 relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1595973715873-107779d721bf?q=80&w=400&auto=format&fit=crop" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-xl relative">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                      <motion.div 
                          className="w-full h-0.5 bg-green-400 shadow-[0_0_10px_#4ade80]" 
                          animate={{ top: ['0%', '100%', '0%'] }} 
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }} 
                          style={{ position: 'absolute' }} 
                      />
                  </div>
              </div>
              <div className="absolute top-4 left-0 right-0 text-center">
                  <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md">Point at crop disease</span>
              </div>
          </div>
          <div className="h-24 bg-black flex items-center justify-center gap-8 pb-4 shrink-0">
              <button className="text-white opacity-50 text-xs flex flex-col items-center gap-1"><span className="p-2 bg-white/10 rounded-full">🖼️</span>Gallery</button>
              <button 
                  onClick={() => handleInteraction(handleUploadSequence)} 
                  className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform"
              >
                  <div className="w-14 h-14 bg-white rounded-full"></div>
              </button>
              <button className="text-white opacity-50 text-xs flex flex-col items-center gap-1"><span className="p-2 bg-white/10 rounded-full">⚡</span>Flash</button>
          </div>
      </div>
  );

  const renderAnalyzing = () => (
      <div className="h-full bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
          {uploadProgress < 100 ? (
              <div className="w-full max-w-[200px]">
                  <div className="mb-4 text-green-400 font-bold animate-pulse text-sm">Uploading Image...</div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-green-500" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} />
                  </div>
              </div>
          ) : (
              <div className="w-full space-y-6">
                  <h3 className="text-white font-bold text-lg mb-4">AI Council In Session</h3>
                  <div className="flex justify-center gap-2">
                      {['👁️', '🌡️', '🤖', '💰', '⚖️'].map((emoji, i) => (
                          <motion.div 
                              key={i} 
                              initial={{ scale: 0.8, opacity: 0.3 }}
                              animate={{ 
                                  scale: councilStep === i + 1 ? 1.2 : 1, 
                                  opacity: councilStep === i + 1 ? 1 : 0.5,
                                  color: councilStep === i + 1 ? '#4ade80' : '#ffffff'
                              }}
                              className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl border border-slate-700"
                          >
                              {emoji}
                          </motion.div>
                      ))}
                  </div>
                  <div className="h-10">
                      <AnimatePresence mode="wait">
                          <motion.p 
                              key={councilStep}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="text-slate-400 text-xs font-mono"
                          >
                              {councilStep === 1 && "Vision: Analyzing leaf patterns..."}
                              {councilStep === 2 && "Sensors: Checking soil moisture..."}
                              {councilStep === 3 && "Botany: Matching pathogen DB..."}
                              {councilStep === 4 && "Analyst: Calculating costs..."}
                              {councilStep === 5 && "Consensus: Generating Report..."}
                          </motion.p>
                      </AnimatePresence>
                  </div>
              </div>
          )}
      </div>
  );

  const renderResults = () => (
      <div className={`h-full bg-slate-50 overflow-y-auto custom-scrollbar ${mode === 'mobile' ? 'pb-20' : 'pb-4'}`}>
          <div className="h-48 relative">
              <img src="https://images.unsplash.com/photo-1595973715873-107779d721bf?q=80&w=400" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                  <h2 className="text-xl font-black text-white">{MOCK_DATA.diagnosis.name}</h2>
                  <p className="text-xs text-slate-300">{MOCK_DATA.diagnosis.crop} • {new Date().toLocaleDateString()}</p>
              </div>
              <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  {MOCK_DATA.diagnosis.severity}
              </div>
          </div>

          <div className="p-4 space-y-4">
              {/* Health Score */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                          <path className="text-orange-500" strokeDasharray={`${MOCK_DATA.diagnosis.health}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      <span className="absolute text-sm font-bold text-slate-800">{MOCK_DATA.diagnosis.health}</span>
                  </div>
                  <div>
                      <h4 className="text-sm font-bold text-slate-900">Health Score</h4>
                      <p className="text-xs text-slate-500">Crop is in critical condition.</p>
                  </div>
              </div>

              {/* Treatment */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                      <button onClick={() => handleInteraction(() => setResultTab('chem'))} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${resultTab === 'chem' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Chemical</button>
                      <button onClick={() => handleInteraction(() => setResultTab('org'))} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${resultTab === 'org' ? 'bg-white shadow text-green-600' : 'text-slate-500'}`}>Organic</button>
                  </div>
                  
                  <div className="space-y-3">
                      <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Product</p>
                          <p className="font-bold text-slate-800 text-sm">{resultTab === 'chem' ? MOCK_DATA.diagnosis.chemical.name : MOCK_DATA.diagnosis.organic.name}</p>
                      </div>
                      <div className="flex justify-between">
                          <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Dosage</p>
                              <p className="text-sm font-bold text-slate-700">{resultTab === 'chem' ? MOCK_DATA.diagnosis.chemical.dosage : MOCK_DATA.diagnosis.organic.dosage}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Est. Cost</p>
                              <p className="text-sm font-black text-slate-800">{resultTab === 'chem' ? MOCK_DATA.diagnosis.chemical.cost : MOCK_DATA.diagnosis.organic.cost}</p>
                          </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Application</p>
                          <p className="text-xs text-slate-600">{resultTab === 'chem' ? MOCK_DATA.diagnosis.chemical.method : MOCK_DATA.diagnosis.organic.method}</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderMarket = () => (
      <div className="h-full bg-slate-50 flex flex-col">
          <div className="p-4 bg-white border-b border-slate-200">
              <h2 className="font-black text-xl text-slate-900">Market Prices</h2>
              <p className="text-xs text-slate-500">Nagpur Mandi • Today</p>
          </div>
          <div className={`flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar ${mode === 'mobile' ? 'pb-20' : 'pb-4'}`}>
              {MOCK_DATA.market.map((m, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                      <div>
                          <h4 className="font-bold text-slate-800 text-sm">{m.crop}</h4>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.trend === 'up' ? 'bg-green-100 text-green-700' : m.trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                              {m.trend === 'up' ? '▲ Up' : m.trend === 'down' ? '▼ Down' : '• Stable'}
                          </span>
                      </div>
                      <div className="text-right">
                          <div className="font-bold text-slate-900 text-lg">{m.price}</div>
                          <p className="text-[10px] text-slate-400">/Quintal</p>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderProfile = () => (
      <div className={`h-full bg-slate-50 p-4 overflow-y-auto custom-scrollbar ${mode === 'mobile' ? 'pb-20' : 'pb-4'}`}>
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-slate-200 mb-4">
              <div className="w-20 h-20 rounded-full bg-slate-100 mx-auto mb-3 overflow-hidden border-4 border-white shadow-sm">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${MOCK_DATA.user.name}`} />
              </div>
              <h2 className="font-bold text-slate-900 text-lg">{MOCK_DATA.user.name}</h2>
              <p className="text-xs text-green-600 font-bold bg-green-50 inline-block px-2 py-1 rounded-full mt-1">{MOCK_DATA.user.plan}</p>
          </div>

          <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase ml-1">My Crops</h3>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap gap-2">
                  {MOCK_DATA.user.crops.map(c => (
                      <span key={c} className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full">{c}</span>
                  ))}
              </div>
          </div>

          <div className="space-y-2 mt-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase ml-1">Settings</h3>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
                  <div className="p-3 border-b border-slate-100 text-sm flex justify-between"><span>Language</span> <span className="text-slate-400">English</span></div>
                  <div className="p-3 border-b border-slate-100 text-sm flex justify-between"><span>Notifications</span> <span className="text-green-500">On</span></div>
                  <div className="p-3 text-sm flex justify-between"><span>Dark Mode</span> <span className="text-slate-400">Off</span></div>
              </div>
          </div>
      </div>
  );

  const DesktopNav = () => (
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white">🌱</div>
              <span className="font-bold text-lg text-slate-900">Fasal Rakshak</span>
          </div>
          <div className="flex gap-6">
              <button onClick={() => handleInteraction(() => setActiveTab('dashboard'))} className={`text-sm font-bold transition-colors ${activeTab === 'dashboard' ? 'text-green-600' : 'text-slate-500 hover:text-slate-900'}`}>Dashboard</button>
              <button onClick={() => handleInteraction(() => setActiveTab('market'))} className={`text-sm font-bold transition-colors ${activeTab === 'market' ? 'text-green-600' : 'text-slate-500 hover:text-slate-900'}`}>Market</button>
              <button onClick={() => handleInteraction(() => setActiveTab('diagnose'))} className={`text-sm font-bold transition-colors ${activeTab === 'diagnose' ? 'text-green-600' : 'text-slate-500 hover:text-slate-900'}`}>Diagnose</button>
              <button onClick={() => handleInteraction(() => setActiveTab('results'))} className={`text-sm font-bold transition-colors ${activeTab === 'results' ? 'text-green-600' : 'text-slate-500 hover:text-slate-900'}`}>Reports</button>
          </div>
          <div className="flex items-center gap-3">
               <button onClick={() => handleInteraction(() => setActiveTab('profile'))} className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${MOCK_DATA.user.name}`} />
               </button>
          </div>
      </div>
  );

  // --- MAIN LAYOUT ---
  return (
    <div className="h-full flex flex-col font-sans bg-slate-50 relative overflow-hidden">
        
        {/* DESKTOP NAV */}
        {mode === 'desktop' && <DesktopNav />}

        {/* VIEW CONTENT */}
        <div className="flex-1 relative overflow-hidden">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'diagnose' && renderDiagnose()}
            {activeTab === 'analyzing' && renderAnalyzing()}
            {activeTab === 'results' && renderResults()}
            {activeTab === 'market' && renderMarket()}
            {activeTab === 'profile' && renderProfile()}
        </div>

        {/* BOTTOM NAV (Mobile Only) */}
        {mode === 'mobile' && (
            <div className="h-16 bg-white border-t border-slate-200 flex justify-around items-center px-2 shrink-0 z-10 absolute bottom-0 w-full">
                <button onClick={() => handleInteraction(() => setActiveTab('dashboard'))} className={`p-2 flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-green-600' : 'text-slate-400'}`}>
                    <Icons.Home />
                    <span className="text-[9px] font-bold">Home</span>
                </button>
                <button onClick={() => handleInteraction(() => setActiveTab('market'))} className={`p-2 flex flex-col items-center gap-1 ${activeTab === 'market' ? 'text-green-600' : 'text-slate-400'}`}>
                    <Icons.Hub />
                    <span className="text-[9px] font-bold">Market</span>
                </button>
                <button onClick={() => handleInteraction(() => setActiveTab('diagnose'))} className="mb-8 p-3 bg-slate-900 text-white rounded-full shadow-lg border-4 border-slate-50 active:scale-95 transition-transform hover:scale-105">
                    <Icons.Scan />
                </button>
                <button onClick={() => handleInteraction(() => setActiveTab('results'))} className={`p-2 flex flex-col items-center gap-1 ${activeTab === 'results' ? 'text-green-600' : 'text-slate-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="text-[9px] font-bold">Report</span>
                </button>
                <button onClick={() => handleInteraction(() => setActiveTab('profile'))} className={`p-2 flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-green-600' : 'text-slate-400'}`}>
                    <Icons.Profile />
                    <span className="text-[9px] font-bold">Profile</span>
                </button>
            </div>
        )}

        {/* VIRTUAL CURSOR OVERLAY */}
        <AnimatePresence>
            {isAutoPlay && cursor.active && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ 
                        opacity: 1, 
                        left: cursor.x, 
                        top: cursor.y,
                        scale: cursor.click ? 0.8 : 1
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute w-8 h-8 z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                >
                    <div className={`w-full h-full rounded-full border-2 border-white/80 bg-green-500/50 shadow-[0_0_20px_#4ade80] flex items-center justify-center ${cursor.click ? 'ring-4 ring-green-400/50' : ''}`}>
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

// --- FRAMES ---

export const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative w-[320px] h-[650px] bg-slate-900 rounded-[2.5rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden ring-1 ring-white/10 mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-xl z-50 flex items-center justify-center"><div className="w-16 h-3 bg-slate-800/50 rounded-full"></div></div>
        <div className="h-8 w-full flex justify-between items-center px-6 pt-2 text-[10px] font-bold z-40 relative text-slate-900 bg-white/0"><span>9:41</span><div className="flex gap-1"><div className="w-4 h-2 bg-slate-900 rounded-sm"></div></div></div>
        <div className="w-full h-full pt-0 pb-0 bg-white overflow-hidden flex flex-col">{children}</div>
    </div>
);

const BrowserFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-full h-[650px] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-4">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div><div className="w-3 h-3 rounded-full bg-yellow-400"></div><div className="w-3 h-3 rounded-full bg-green-400"></div></div>
            <div className="flex-1 bg-white h-7 rounded-md border border-slate-200 flex items-center px-3 text-xs text-slate-400 font-mono shadow-sm">https://app.fasalrakshak.com/dashboard</div>
        </div>
        <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
                {children}
            </div>
        </div>
    </div>
);

// --- EXPORT ---
export const AppSimulator: React.FC = () => {
  const [autoPlay, setAutoPlay] = useState(false);
  const handleUserInteract = () => { if (autoPlay) setAutoPlay(false); };

  return (
    <div className="w-full flex flex-col items-center justify-center py-8 gap-6">
        <button onClick={() => setAutoPlay(!autoPlay)} className={`px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${autoPlay ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-900 hover:scale-105'}`}>
            {autoPlay ? <><Icons.Pause /> Stop Auto-Pilot</> : <><Icons.Play /> Start Auto-Demo</>}
        </button>

        {/* Mobile View (Small Screens) */}
        <div className="md:hidden">
            <PhoneFrame><MiniAppContent mode="mobile" isAutoPlay={autoPlay} onUserInteract={handleUserInteract} /></PhoneFrame>
        </div>

        {/* Desktop View (Large Screens) */}
        <div className="hidden md:block w-full max-w-5xl px-4">
            <BrowserFrame><MiniAppContent mode="desktop" isAutoPlay={autoPlay} onUserInteract={handleUserInteract} /></BrowserFrame>
        </div>
    </div>
  );
};
