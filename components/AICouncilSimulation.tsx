
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// --- ENHANCED AGENT DEFINITIONS ---
const AGENTS = [
  {
    id: 'vision',
    name: 'Botany AI',
    role: 'Visual Analysis',
    specialty: 'Deep Learning Vision',
    confidence: 98.5,
    color: 'text-purple-400',
    bgGradient: 'from-purple-500 to-violet-600',
    borderColor: 'border-purple-500',
    glowColor: 'shadow-purple-500/30',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
    ),
    avatar: '🔬',
    logs: [
      "Initializing GEMINI_VISION_PRO_3.0...",
      "Extracting visual features: [LEAF_TEXTURE, NECROSIS, DISCOLORATION]",
      "Pattern matching against 50,000+ disease signatures...",
      "Confidence: 98.5% - Early Blight detected"
    ],
    code: `const features = await vision.extract(imageBuffer);
const pattern = classifyPatterns(features, 'fungal');
const matches = await vectorDB.search(pattern, { limit: 10 });
return { 
  diagnosis: 'Early Blight',
  confidence: 0.985,
  stage: 'Early' 
};`
  },
  {
    id: 'sensor',
    name: 'IoT Core',
    role: 'Environment Data',
    specialty: 'Real-time Sensors',
    confidence: 94.2,
    color: 'text-blue-400',
    bgGradient: 'from-blue-500 to-cyan-600',
    borderColor: 'border-blue-500',
    glowColor: 'shadow-blue-500/30',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="4"/></svg>
    ),
    avatar: '📡',
    logs: [
      "Connecting to IoT mesh network...",
      "Reading sensors: SOIL_MOISTURE=42%, TEMP=31°C, RH=78%",
      "Cross-referencing disease spread conditions...",
      "Environmental factors CONFIRM fungal growth risk"
    ],
    code: `const sensorData = await mqtt.subscribe('farm/sensors/#');
const conditions = analyzeMicroclimate(sensorData);

if (conditions.humidity > 75 && conditions.temp > 25) {
  return { 
    riskLevel: 'HIGH',
    factors: ['humidity', 'temperature'],
    recommendation: 'Increase ventilation'
  };
}`
  },
  {
    id: 'farmer',
    name: 'Ram Kaka',
    role: 'Local Expert',
    specialty: '40 Years Experience',
    confidence: 92.0,
    color: 'text-orange-400',
    bgGradient: 'from-orange-500 to-amber-600',
    borderColor: 'border-orange-500',
    glowColor: 'shadow-orange-500/30',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
    ),
    avatar: '👳',
    logs: [
      "Querying indigenous knowledge base...",
      "Checking historical outbreak data for Rabi season...",
      "Validating treatment availability at local mandi...",
      "Neem-based treatment is LOCALLY AVAILABLE"
    ],
    code: `const localWisdom = await knowledgeBase.query({
  season: 'Rabi',
  crop: diagnosis.crop,
  region: user.district
});

const treatments = localWisdom.treatments.filter(
  t => t.availableLocally && t.costEffective
);

return { approved: true, treatments };`
  },
  {
    id: 'analyst',
    name: 'Priya',
    role: 'Cost Analysis',
    specialty: 'Financial Modeling',
    confidence: 96.8,
    color: 'text-green-400',
    bgGradient: 'from-green-500 to-emerald-600',
    borderColor: 'border-green-500',
    glowColor: 'shadow-green-500/30',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    ),
    avatar: '👩‍💼',
    logs: [
      "Fetching current market prices for treatments...",
      "Calculating yield loss vs treatment cost...",
      "Optimizing for best ROI scenario...",
      "Recommendation: ₹450 treatment saves ₹12,000 crop value"
    ],
    code: `const marketPrices = await mandi.getPrices('Mancozeb');
const yieldLoss = calculateLoss(diagnosis, stage);
const treatmentCost = calculateDosage(landSize, treatment);

const roi = (expectedYield * marketPrice) - treatmentCost;
const savings = yieldLoss - treatmentCost;

return { 
  recommendation: 'Spray immediately',
  cost: treatmentCost,
  expectedSavings: savings 
};`
  },
  {
    id: 'system',
    name: 'Fasal AI',
    role: 'Consensus Engine',
    specialty: 'Multi-Agent Orchestration',
    confidence: 97.5,
    color: 'text-slate-200',
    bgGradient: 'from-slate-600 to-slate-700',
    borderColor: 'border-slate-500',
    glowColor: 'shadow-slate-500/30',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22l-.75-12.07A4.001 4.001 0 0 1 12 2z"/><path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93"/></svg>
    ),
    avatar: '🤖',
    logs: [
      "Aggregating agent votes: [CONFIRM, CONFIRM, CAUTION, CONFIRM]",
      "Applying weighted consensus algorithm...",
      "Final confidence score: 97.5%",
      "Generating personalized action plan..."
    ],
    code: `const votes = await Promise.all(
  agents.map(a => a.vote(diagnosis))
);

const consensus = weightedAverage(votes, agentWeights);
const actionPlan = generatePlan(consensus, userContext);

emit('DIAGNOSIS_COMPLETE', {
  diagnosis: consensus.result,
  confidence: consensus.score,
  actions: actionPlan
});`
  }
];

export const AICouncilSimulation = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typedCode, setTypedCode] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const codeScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Agent Cycle
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % AGENTS.length);
      setCurrentLogIndex(0);
      setTypedCode('');
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Log Generation with typing effect
    const agent = AGENTS[activeStep];
    
    if (currentLogIndex < agent.logs.length) {
      const timeout = setTimeout(() => {
        setTerminalLogs(prev => [
          ...prev.slice(-20), 
          `[${agent.name}] ${agent.logs[currentLogIndex]}`
        ]);
        setCurrentLogIndex(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [activeStep, currentLogIndex]);

  useEffect(() => {
    // Code typing effect
    const agent = AGENTS[activeStep];
    const code = agent.code;
    let charIndex = 0;
    
    setTypedCode('');
    const interval = setInterval(() => {
      if (charIndex < code.length) {
        setTypedCode(code.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(interval);
      }
    }, 20);
    
    return () => clearInterval(interval);
  }, [activeStep]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const activeAgent = AGENTS[activeStep];

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm font-medium mb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Live AI Council Session
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Multi-Agent Diagnosis System</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Watch our AI experts collaborate in real-time to analyze crop health and provide actionable recommendations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT: AGENT VISUALIZER */}
        <div className="relative h-[500px] w-full flex flex-col items-center justify-center bg-slate-950/80 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-sm">
          
          {/* Holographic Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1),transparent_70%)]"></div>

          {/* Central Core */}
          <div className="relative z-10 w-40 h-40 flex items-center justify-center">
             <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse transition-colors duration-500`} style={{ background: `linear-gradient(135deg, ${activeAgent.id === 'vision' ? '#8b5cf6' : activeAgent.id === 'sensor' ? '#3b82f6' : activeAgent.id === 'farmer' ? '#f97316' : activeAgent.id === 'analyst' ? '#22c55e' : '#64748b'}40, transparent)` }}></div>
             
             <div className={`relative w-28 h-28 bg-gradient-to-br ${activeAgent.bgGradient} rounded-full flex items-center justify-center z-20 shadow-2xl ${activeAgent.glowColor}`}>
                 <span className="text-5xl">{activeAgent.avatar}</span>
             </div>
             
             {/* Rotating Rings */}
             <div className="absolute inset-[-20px] border-2 border-green-500/30 rounded-full animate-[spin_8s_linear_infinite]" style={{ borderTopColor: 'transparent', borderLeftColor: 'transparent' }}></div>
             <div className="absolute inset-[-35px] border border-dashed border-green-500/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
             <div className="absolute inset-[-50px] border border-dotted border-green-500/5 rounded-full animate-[spin_20s_linear_infinite]"></div>
          </div>

          {/* Active Agent Info */}
          <motion.div 
            key={activeStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center z-20"
          >
            <h3 className={`text-xl font-bold ${activeAgent.color}`}>{activeAgent.name}</h3>
            <p className="text-slate-400 text-sm">{activeAgent.role} • {activeAgent.specialty}</p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${activeAgent.confidence}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full bg-gradient-to-r ${activeAgent.bgGradient}`}
                />
              </div>
              <span className="text-xs text-slate-400">{activeAgent.confidence}%</span>
            </div>
          </motion.div>

          {/* Agents Orbiting */}
          <div className="absolute inset-0">
             {AGENTS.map((agent, i) => {
                 const isActive = i === activeStep;
                 const angle = (i * (360 / AGENTS.length) - 90) * (Math.PI / 180);
                 const radius = 160;
                 
                 return (
                     <motion.div
                        key={agent.id}
                        className={`absolute top-1/2 left-1/2 w-16 h-16 -ml-8 -mt-8 flex flex-col items-center justify-center transition-all duration-500 ${isActive ? 'scale-125 z-30' : 'scale-75 opacity-40 z-10'}`}
                        animate={{
                            x: Math.cos(angle) * radius,
                            y: Math.sin(angle) * radius
                        }}
                     >
                         <div className={`w-14 h-14 rounded-2xl bg-slate-900/90 border-2 ${isActive ? agent.borderColor : 'border-slate-700'} flex items-center justify-center shadow-lg transition-all duration-300 ${isActive ? agent.glowColor + ' shadow-lg' : ''}`}>
                             <div className={`${isActive ? agent.color : 'text-slate-500'} transition-colors`}>{agent.icon}</div>
                         </div>
                         {isActive && (
                           <motion.div 
                             initial={{ opacity: 0, scale: 0.8 }}
                             animate={{ opacity: 1, scale: 1 }}
                             className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-green-500"
                           />
                         )}
                     </motion.div>
                 );
             })}
          </div>

          {/* Data Streams */}
          {AGENTS.map((agent, i) => {
            const isActive = i === activeStep;
            if (!isActive) return null;
            
            const angle = (i * (360 / AGENTS.length) - 90) * (Math.PI / 180);
            const startX = Math.cos(angle) * 160;
            const startY = Math.sin(angle) * 160;
            
            return (
              <motion.div
                key={`stream-${agent.id}`}
                className="absolute top-1/2 left-1/2 pointer-events-none z-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <svg width="400" height="400" className="-ml-[200px] -mt-[200px]">
                  <motion.line
                    x1={200 + startX}
                    y1={200 + startY}
                    x2={200}
                    y2={200}
                    stroke={agent.color.replace('text-', '#').replace('-400', '')}
                    strokeWidth="2"
                    strokeDasharray="8,4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.5 }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                  />
                </svg>
              </motion.div>
            );
          })}

          {/* Connection Status */}
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs text-slate-400 font-medium">LIVE</span>
          </div>
        </div>

        {/* RIGHT: TERMINAL & CODE */}
        <div className="w-full h-[500px] bg-[#0c0c0c] rounded-3xl border border-slate-800 flex flex-col relative overflow-hidden shadow-2xl font-mono text-xs">
          {/* Header */}
          <div className="h-10 bg-[#1a1a1a] border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
              <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer"></div>
              </div>
              <div className="text-slate-500 font-bold tracking-widest text-[10px]">FASAL_KERNEL_V3.0</div>
              <div className="text-slate-600 text-[10px]">node v20.10</div>
          </div>
          
          <div className="flex flex-1 min-h-0">
              {/* Logs Panel */}
              <div className="w-1/2 border-r border-slate-800 flex flex-col">
                  <div className="p-2 bg-[#111] text-slate-400 border-b border-slate-800 uppercase text-[10px] font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    System Logs
                  </div>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                      {terminalLogs.map((log, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-green-500/90 break-words leading-relaxed text-[11px]"
                          >
                              <span className="text-slate-600 mr-2">{'>'}</span>
                              <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span> {log}
                          </motion.div>
                      ))}
                      <div className="text-green-500 animate-pulse">█</div>
                  </div>
              </div>

              {/* Code Panel */}
              <div className="w-1/2 flex flex-col bg-[#0c0c0c]">
                  <div className="p-2 bg-[#111] text-slate-400 border-b border-slate-800 uppercase text-[10px] font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${activeAgent.bgGradient.includes('purple') ? 'bg-purple-500' : activeAgent.bgGradient.includes('blue') ? 'bg-blue-500' : activeAgent.bgGradient.includes('orange') ? 'bg-orange-500' : activeAgent.bgGradient.includes('green') ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                      {activeAgent.role}
                    </span>
                    <span className="text-slate-600">.ts</span>
                  </div>
                  <div ref={codeScrollRef} className="flex-1 p-4 overflow-auto custom-scrollbar">
                      <AnimatePresence mode="wait">
                          <motion.div 
                            key={activeStep}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                              <div className={`text-xs mb-3 ${activeAgent.color}`}>
                                // Agent: {activeAgent.name} - {activeAgent.specialty}
                              </div>
                              <pre className="text-slate-300 whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                                  {typedCode}
                                  <span className="text-green-500 animate-pulse">|</span>
                              </pre>
                          </motion.div>
                      </AnimatePresence>
                  </div>
              </div>
          </div>
          
          {/* Status Footer */}
          <div className="h-8 bg-gradient-to-r from-green-600 to-emerald-600 text-white flex items-center px-4 justify-between text-[10px] font-bold tracking-wider shrink-0">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  ONLINE
                </span>
                <span>|</span>
                <span>5 AGENTS ACTIVE</span>
              </div>
              <div className="flex items-center gap-4">
                <span>CPU: 24%</span>
                <span>MEM: 402MB</span>
                <span>GPU: ACTIVE</span>
              </div>
          </div>
        </div>

      </div>

      {/* Agent Cards */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
        {AGENTS.map((agent, i) => (
          <motion.div
            key={agent.id}
            className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${i === activeStep ? `bg-gradient-to-br ${agent.bgGradient} border-transparent shadow-xl ${agent.glowColor}` : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
            whileHover={{ scale: 1.02 }}
            onClick={() => setActiveStep(i)}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{agent.avatar}</span>
              <div>
                <p className={`font-bold text-sm ${i === activeStep ? 'text-white' : agent.color}`}>{agent.name}</p>
                <p className={`text-[10px] ${i === activeStep ? 'text-white/70' : 'text-slate-500'}`}>{agent.role}</p>
              </div>
            </div>
            <div className={`text-[10px] ${i === activeStep ? 'text-white/80' : 'text-slate-400'}`}>
              {agent.specialty}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
