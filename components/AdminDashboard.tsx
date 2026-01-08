
import React, { useState, useEffect, useRef } from 'react';
import { User, DiagnosisResponse, Plan, ApiLog, AppConfig, CropImageDef, CMSContent, CustomCropLink } from '../types';
import Chart from 'chart.js/auto';
import { fetchPlans, getAnalytics, getApiLogs, fetchCrops, getAppConfig, fetchAppConfig, saveAppConfig, fetchCMSContent } from '../services/cmsService';
import { getAllDiagnoses } from '../services/agroService';
import { getAllUsers } from '../services/authService';
import { fetchSecrets, saveSecrets, getAllSecrets, ApiKeys } from '../services/secretManager';
import { getQueue, syncOfflineQueue } from '../services/offlineQueueService';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, Switch } from './ui/Shadcn';
import { ThemeToggle } from './ThemeToggle';

interface AdminDashboardProps {
    user: User | null;
    onLogout?: () => void;
}

type Tab = 'overview' | 'users' | 'diagnoses' | 'plans' | 'crops' | 'links' | 'cms' | 'logs' | 'api-keys' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // Data Stores
    const [dbUsers, setDbUsers] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [cropsList, setCropsList] = useState<CropImageDef[]>([]);
    const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
    const [allDiagnoses, setAllDiagnoses] = useState<any[]>([]); 
    const [analytics, setAnalytics] = useState<any>({ views: {}, apiCalls: 0 });
    const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
    const [cmsContent, setCmsContent] = useState<CMSContent | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);
    const [offlineQueueCount, setOfflineQueueCount] = useState(0);
    
    const overviewChartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            // Parallel fetch
            const [usersData, diagData, logData] = await Promise.all([
                getAllUsers(),
                getAllDiagnoses(),
                getApiLogs()
            ]);
            
            setDbUsers(usersData);
            setAllDiagnoses(diagData);
            setApiLogs(logData);

            // Fetch configs
            await Promise.all([
                fetchPlans().then(setPlans),
                fetchCrops().then(setCropsList),
                Promise.resolve(getAnalytics()).then(setAnalytics),
                fetchAppConfig().then(setAppConfig),
                fetchCMSContent().then(setCmsContent),
                fetchSecrets().then(() => setApiKeys(getAllSecrets()))
            ]);
            
            setOfflineQueueCount(getQueue().length);
        } catch(e: any) { 
            console.error("Failed to load admin data", e); 
            setErrorMsg(e.message || "Failed to fetch data. Check database permissions.");
        } 
        finally { setLoading(false); }
    };

    const handleSaveApiKeys = async () => {
        if(!apiKeys || !confirm("Updating API keys?")) return;
        setLoading(true);
        await saveSecrets(apiKeys);
        setLoading(false);
        alert("Keys Updated");
    };

    const handleForceMockToggle = async (val: boolean) => {
        if (!appConfig) return;
        const newConfig = { ...appConfig, apiControl: { ...appConfig.apiControl, forceMockMode: val } };
        setAppConfig(newConfig);
        await saveAppConfig(newConfig);
        alert(`Mock Mode is now ${val ? 'ON' : 'OFF'}. All users will see simulated data.`);
    };

    const handleTriggerSync = async () => {
        setLoading(true);
        await syncOfflineQueue();
        setOfflineQueueCount(getQueue().length);
        setLoading(false);
        alert("Sync attempt finished.");
    };

    // Chart Effect
    useEffect(() => {
        if (activeTab === 'overview' && overviewChartRef.current) {
            const ctx = overviewChartRef.current.getContext('2d');
            if (ctx) {
                if (chartInstance.current) chartInstance.current.destroy();
                const isDark = document.documentElement.classList.contains('dark');
                const textColor = isDark ? '#e2e8f0' : '#1e293b';
                chartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Total Users', 'Diagnoses', 'API Calls', 'Offline Queue'],
                        datasets: [{
                            label: 'System Metrics',
                            data: [dbUsers.length, allDiagnoses.length, analytics.apiCalls, offlineQueueCount],
                            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1']
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } }
                });
            }
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [activeTab, analytics, dbUsers.length, allDiagnoses.length, offlineQueueCount]);

    const SidebarItem = ({ id, label, icon }: { id: Tab, label: string, icon: string }) => (
        <button onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === id ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <span className="text-xl">{icon}</span><span>{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans overflow-hidden">
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2"><div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center font-bold text-white">F</div><h1 className="text-xl font-bold">Admin Console</h1></div>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500">✕</button>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-160px)] custom-scrollbar">
                    <SidebarItem id="overview" label="Control Room" icon="🎛️" />
                    <SidebarItem id="api-keys" label="API Keys" icon="🔑" />
                    <SidebarItem id="settings" label="Mock & Config" icon="⚙️" />
                    <SidebarItem id="logs" label="AI Health Monitor" icon="❤️" />
                    <div className="my-2 border-t border-slate-200 dark:border-slate-700"></div>
                    <SidebarItem id="diagnoses" label="Diagnoses" icon="🩺" />
                    <SidebarItem id="users" label="Users" icon="👥" />
                    <SidebarItem id="crops" label="Crops DB" icon="🌱" />
                    <SidebarItem id="links" label="Market Links" icon="🔗" />
                    <SidebarItem id="plans" label="Plans" icon="💳" />
                </nav>
                <div className="absolute bottom-0 w-full p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
                    <ThemeToggle />
                    <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-bold">Log Out</button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-h-0 relative">
                <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:hidden">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-2xl">☰</button>
                    <span className="font-bold">Fasal Admin</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex justify-between items-center">
                                <h2 className="text-3xl font-bold">Control Room</h2>
                                <div className="flex gap-2">
                                    <Button onClick={handleTriggerSync} variant="outline" className="border-blue-200 text-blue-600">Sync Queue ({offlineQueueCount})</Button>
                                    <Button onClick={refreshData} variant="outline">Refresh</Button>
                                </div>
                            </div>
                            
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                                    <strong>Error:</strong> {errorMsg}
                                </div>
                            )}
                            
                            {/* Key Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200"><CardContent className="p-6"><p className="text-xs font-bold uppercase text-blue-600">Total Farmers</p><p className="text-3xl font-black text-blue-800 dark:text-blue-300">{dbUsers.length}</p></CardContent></Card>
                                <Card className="bg-green-50 dark:bg-green-900/20 border-green-200"><CardContent className="p-6"><p className="text-xs font-bold uppercase text-green-600">Total Scans</p><p className="text-3xl font-black text-green-800 dark:text-green-300">{allDiagnoses.length}</p></CardContent></Card>
                                <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200"><CardContent className="p-6"><p className="text-xs font-bold uppercase text-orange-600">AI Calls</p><p className="text-3xl font-black text-orange-800 dark:text-orange-300">{analytics.apiCalls}</p></CardContent></Card>
                                <Card className={`border ${appConfig?.apiControl?.forceMockMode ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}><CardContent className="p-6"><p className="text-xs font-bold uppercase text-slate-500">System Mode</p><p className={`text-2xl font-black ${appConfig?.apiControl?.forceMockMode ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>{appConfig?.apiControl?.forceMockMode ? 'MOCK (DEMO)' : 'LIVE'}</p></CardContent></Card>
                            </div>

                            <Card className="p-6"><h3 className="text-lg font-bold mb-4">System Metrics</h3><div className="h-80 w-full"><canvas ref={overviewChartRef}></canvas></div></Card>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6 animate-fadeIn">
                            <h2 className="text-3xl font-bold">Registered Users ({dbUsers.length})</h2>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase">
                                        <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">ID</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {dbUsers.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-4 font-bold">{u.name}</td>
                                                <td className="p-4">{u.email}</td>
                                                <td className="p-4 uppercase text-xs font-bold text-slate-500">{u.role}</td>
                                                <td className="p-4 font-mono text-xs">{u.farmer_id}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'diagnoses' && (
                        <div className="space-y-6 animate-fadeIn">
                            <h2 className="text-3xl font-bold">Recent Diagnoses ({allDiagnoses.length})</h2>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase">
                                        <tr><th className="p-4">Crop</th><th className="p-4">Issue</th><th className="p-4">Farmer</th><th className="p-4">Date</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {allDiagnoses.map((d, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-4 font-bold">{d.crop_identified}</td>
                                                <td className="p-4">{d.disease_name_en}</td>
                                                <td className="p-4">{d.user_name}</td>
                                                <td className="p-4 text-xs text-slate-500">{new Date(d.timestamp).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && appConfig && (
                        <div className="space-y-6 animate-fadeIn max-w-4xl">
                            <h2 className="text-3xl font-bold">System Configuration</h2>
                            <Card className="border-red-200 dark:border-red-900 shadow-sm">
                                <CardHeader className="bg-red-50 dark:bg-red-900/20 rounded-t-xl"><CardTitle className="text-red-700 dark:text-red-300">🚨 Emergency Controls</CardTitle></CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div><h4 className="font-bold text-lg">Force Mock Mode</h4><p className="text-sm text-slate-500">Enable this during demos or if APIs are down. It bypasses all AI calls and returns high-quality fake data.</p></div>
                                        <Switch checked={appConfig.apiControl?.forceMockMode || false} onCheckedChange={handleForceMockToggle} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex justify-between items-center"><h2 className="text-3xl font-bold">AI Health Monitor</h2><Button onClick={refreshData} variant="outline">Refresh Logs</Button></div>
                            <div className="bg-black text-green-400 font-mono text-xs p-4 rounded-xl h-[500px] overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner">
                                {apiLogs.length === 0 ? <p className="opacity-50">No logs recorded.</p> : apiLogs.map((log, i) => (
                                    <div key={i} className="mb-2 border-b border-green-900/30 pb-1">
                                        <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span> 
                                        <span className={`font-bold ml-2 ${log.status === 'error' ? 'text-red-500' : 'text-blue-400'}`}>{log.service.toUpperCase()}</span>
                                        <span className="ml-2 text-white">{log.requestSnippet || 'Request'}</span>
                                        <span className="float-right opacity-70">{log.latencyMs}ms</span>
                                        {log.errorMessage && <div className="text-red-400 ml-8">Error: {log.errorMessage}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'api-keys' && apiKeys && (
                        <div className="space-y-6 animate-fadeIn max-w-4xl">
                            <div className="flex justify-between items-center"><h2 className="text-3xl font-bold">API Keys</h2><Button onClick={handleSaveApiKeys} disabled={loading}>{loading ? 'Saving...' : 'Save Keys'}</Button></div>
                            <Card className="p-6 space-y-4">
                                <div><label className="text-xs font-bold uppercase">Gemini Primary Key</label><Input type="password" value={apiKeys.gemini_key} onChange={e => setApiKeys({...apiKeys, gemini_key: e.target.value})} className="font-mono mt-1" /></div>
                                <div><label className="text-xs font-bold uppercase">OpenRouter Key (Fallback)</label><Input type="password" value={apiKeys.openrouter_key} onChange={e => setApiKeys({...apiKeys, openrouter_key: e.target.value})} className="font-mono mt-1" /></div>
                                <div><label className="text-xs font-bold uppercase">Weather API Key</label><Input type="password" value={apiKeys.weather_key} onChange={e => setApiKeys({...apiKeys, weather_key: e.target.value})} className="font-mono mt-1" /></div>
                            </Card>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};
