import React, { useState, useEffect, useRef } from 'react';
import { User, Language, MarketItem } from '../types';
import { getRealMarketPrices } from '../services/agroService';
import { t } from '../services/translationService';
import { translateMarketData } from '../services/dashboardTranslationService';
import { LoadingScreen } from './ui/LoadingScreen';
import Chart from 'chart.js/auto';
import { Skeleton } from './ui/Skeleton';
import { useMinimumLoading } from '../hooks/useMinimumLoading';

interface MarketIntelligenceScreenProps {
    user: User | null;
    lang: Language;
}

type TimeRange = '1D' | '1W' | '1M' | '1Y' | '3Y';

export const MarketIntelligenceScreen: React.FC<MarketIntelligenceScreenProps> = ({ user, lang }) => {
    const [loading, setLoading] = useState(true);
    const showSkeleton = useMinimumLoading(loading, 1500);
    const [myCropsPrices, setMyCropsPrices] = useState<MarketItem[]>([]);
    const [displayPrices, setDisplayPrices] = useState<MarketItem[]>([]); // Translated prices
    
    // Mandi Comparison State
    const [nearbyMandis, setNearbyMandis] = useState<MarketItem[]>([]);
    const [visibleMandisCount, setVisibleMandisCount] = useState(5);
    const [mandiViewMode, setMandiViewMode] = useState<'table' | 'map'>('table');
    const [mapFocus, setMapFocus] = useState<string>(''); // To focus specific mandi on map
    
    const [selectedCrop, setSelectedCrop] = useState<string>('');
    const [locationName, setLocationName] = useState("Local Mandi");
    const [userCoords, setUserCoords] = useState<{lat: number, lon: number} | null>(null);
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    // Graph State
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');
    const [graphData, setGraphData] = useState<{labels: string[], prices: number[]}>({ labels: [], prices: [] });

    // Estimator State
    const [moisture, setMoisture] = useState(12);
    const [grainSize, setGrainSize] = useState(7);
    const [foreignMatter, setForeignMatter] = useState(2);
    const [estimatedRange, setEstimatedRange] = useState({ min: 2150, max: 2220 });
    const [isCalculating, setIsCalculating] = useState(false);

    // --- HELPER: Generate Mock Historical Data ---
    const generateHistoricalData = (basePrice: number, range: TimeRange) => {
        const labels: string[] = [];
        const prices: number[] = [];
        const now = new Date();
        let points = 0;
        let intervalDays = 0;
        let volatility = 0;

        switch (range) {
            case '1D': points = 12; intervalDays = 0; volatility = 0.01; break; // Hourlyish
            case '1W': points = 7; intervalDays = 1; volatility = 0.03; break;
            case '1M': points = 30; intervalDays = 1; volatility = 0.05; break;
            case '1Y': points = 12; intervalDays = 30; volatility = 0.15; break;
            case '3Y': points = 36; intervalDays = 30; volatility = 0.25; break;
        }

        for (let i = points - 1; i >= 0; i--) {
            const date = new Date(now);
            if (range === '1D') {
                date.setHours(date.getHours() - (i * 2)); // Every 2 hours
                labels.push(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            } else {
                date.setDate(date.getDate() - (i * intervalDays));
                if (range === '1Y' || range === '3Y') {
                    labels.push(date.toLocaleDateString([], { month: 'short', year: '2-digit' }));
                } else {
                    labels.push(date.toLocaleDateString([], { day: 'numeric', month: 'short' }));
                }
            }

            // Simulate price movement
            const seasonality = (range === '1Y' || range === '3Y') ? Math.sin(i / 2) * (basePrice * 0.1) : 0;
            const noise = (Math.random() - 0.5) * (basePrice * volatility);
            const p = Math.max(0, basePrice + seasonality + noise);
            prices.push(Math.round(p));
        }
        return { labels, prices };
    };

    // --- INITIAL DATA LOAD ---
    useEffect(() => {
        const loadIntelligence = async () => {
            setLoading(true);
            try {
                // Determine user crops
                const crops = user?.crops_grown?.length ? user.crops_grown : ["Rice", "Wheat", "Tomato"];
                
                // If selectedCrop is empty, set default
                if (!selectedCrop) setSelectedCrop(crops[0]);

                let locName = "India";
                let district = "Nagpur";
                let state = "Maharashtra";

                if (user?.location?.district) {
                    district = user.location.district;
                    state = user.location.state || "India";
                    locName = `${district}, ${state}`;
                    setUserCoords({ lat: user.location.lat, lon: user.location.lon });
                } else if ('geolocation' in navigator) {
                     navigator.geolocation.getCurrentPosition((pos) => {
                         setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                     });
                }
                
                setLocationName(locName);

                // Fetch Prices - This now guarantees returning all profile crops
                const prices = await getRealMarketPrices(district, state, crops);
                
                // Enhance data
                const enhancedPrices: MarketItem[] = prices.map((p, index) => {
                    const basePrice = parseFloat(p.price.replace(/[^\d.]/g, '')) || 2200;
                    const trend: 'up' | 'down' | 'stable' = Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'stable' : 'down';
                    const changeVal = Math.floor(basePrice * (Math.random() * 0.05));
                    
                    return {
                        ...p,
                        min_price: `₹${(basePrice * 0.9).toFixed(0)}`,
                        max_price: `₹${(basePrice * 1.1).toFixed(0)}`,
                        modal_price: `₹${basePrice}`,
                        confidence: 'High',
                        advice: trend === 'up' ? 'Sell Now' : 'Hold',
                        advice_reason: trend === 'up' ? "Prices are at a monthly high and demand in local market is surging." : "Prices falling due to excess supply, better to sell now.",
                        trend,
                        change: `${trend === 'up' ? '+' : '-'}₹${changeVal} (${((changeVal/basePrice)*100).toFixed(1)}%)`,
                        distance: p.distance || `${5 + (index * 12)}km`
                    };
                });

                setMyCropsPrices(enhancedPrices);
                setDisplayPrices(enhancedPrices);

            } catch (e) {
                console.error("Market Intel Error", e);
            } finally {
                setLoading(false);
            }
        };
        loadIntelligence();
    }, [user, user?.crops_grown]); // Watch user crops change

    // --- TRANSLATION EFFECT ---
    useEffect(() => {
        if (myCropsPrices.length === 0) return;
        
        if (lang === 'en') {
            setDisplayPrices(myCropsPrices);
        } else {
            // Translate the data
            translateMarketData(myCropsPrices, lang).then(translated => {
                setDisplayPrices(translated);
            });
        }
    }, [lang, myCropsPrices]);

    // --- REGENERATING DATA WHEN CROP CHANGES ---
    useEffect(() => {
        if (!selectedCrop || displayPrices.length === 0) return;

        // 1. Get the current active crop details (from display prices for consistent text)
        const activeItem = displayPrices.find(c => c.crop === selectedCrop) || displayPrices[0];
        // Use raw price from myCropsPrices to ensure numeric parsing works even if display is translated (though price usually isn't)
        const rawItem = myCropsPrices.find(c => c.crop === selectedCrop) || myCropsPrices[0];
        
        const basePrice = parseFloat(rawItem.price.replace(/[^\d.]/g, '')) || 2000;
        
        // 2. Generate Historical Graph Data for selected crop
        const { labels, prices } = generateHistoricalData(basePrice, timeRange);
        setGraphData({ labels, prices });

        // 3. Generate Distinct Mandi Comparison Data for selected crop
        const district = locationName.split(',')[0] || "Local";
        
        const mandisList: MarketItem[] = [
            { 
                ...activeItem, 
                mandi: `${district} APMC (Main)`, 
                price: `₹${basePrice}`, 
                distance: '2km', 
                change: activeItem.change,
                trend: activeItem.trend 
            },
            { 
                ...activeItem, 
                mandi: `Kisan Mandi`, 
                price: `₹${Math.round(basePrice * 1.015)}`, 
                distance: '12km', 
                change: `+₹${Math.round(basePrice * 0.015)}`,
                trend: 'up' 
            },
            { 
                ...activeItem, 
                mandi: `Regional Hub`, 
                price: `₹${Math.round(basePrice * 0.98)}`, 
                distance: '25km', 
                change: `-₹${Math.round(basePrice * 0.02)}`,
                trend: 'down' 
            },
            { 
                ...activeItem, 
                mandi: `Export Zone`, 
                price: `₹${Math.round(basePrice * 1.05)}`, 
                distance: '45km', 
                change: `+₹${Math.round(basePrice * 0.05)}`,
                trend: 'up' 
            },
            { 
                ...activeItem, 
                mandi: `State Market`, 
                price: `₹${Math.round(basePrice * 0.95)}`, 
                distance: '80km', 
                change: `-₹${Math.round(basePrice * 0.05)}`,
                trend: 'down' 
            }
        ];
        
        setNearbyMandis(mandisList);

    }, [selectedCrop, timeRange, displayPrices, locationName]);

    // --- CHART RENDERING ---
    useEffect(() => {
        if (chartRef.current && graphData.prices.length > 0 && !showSkeleton) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                if (chartInstance.current) {
                    chartInstance.current.destroy();
                }

                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(22, 163, 74, 0.2)'); // Green 600 with opacity
                gradient.addColorStop(1, 'rgba(22, 163, 74, 0)');

                chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: graphData.labels,
                        datasets: [{
                            label: t('mkt_head_rate', lang),
                            data: graphData.prices,
                            borderColor: '#16a34a', // Green 600
                            backgroundColor: gradient,
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true,
                            pointRadius: timeRange === '1Y' || timeRange === '3Y' ? 2 : 3,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.9)', // Slate 900
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                padding: 10,
                                cornerRadius: 8,
                                displayColors: false,
                                callbacks: {
                                    label: (context) => `₹${context.parsed.y} ${t('mkt_quintal', lang)}`
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                grid: {
                                    color: 'rgba(148, 163, 184, 0.1)', // Slate 400
                                },
                                ticks: {
                                    callback: (val) => '₹' + val,
                                    font: { size: 10 }
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 } }
                            }
                        }
                    }
                });
            }
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [graphData, lang, showSkeleton]);

    // Update Estimator logic
    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            const base = 2100;
            const moisturePenalty = Math.max(0, (moisture - 12) * 20);
            const grainBonus = (grainSize - 5) * 30;
            const foreignPenalty = foreignMatter * 25;
            
            const estimated = base - moisturePenalty + grainBonus - foreignPenalty;
            setEstimatedRange({ min: Math.floor(estimated * 0.98), max: Math.ceil(estimated * 1.02) });
            setIsCalculating(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [moisture, grainSize, foreignMatter]);

    const handleLoadMoreMandis = () => {
        setVisibleMandisCount(prev => Math.min(prev + 5, nearbyMandis.length));
    };

    const handleContactMandi = (mandiName: string) => {
        const text = `Hello, I want to inquire about ${selectedCrop} prices at ${mandiName}.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleLocateMandi = (mandiName: string) => {
        const query = encodeURIComponent(mandiName);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
    };

    const activeItem = displayPrices.find(c => c.crop === selectedCrop) || displayPrices[0];

    // Helper to translate advice enum
    const getAdviceText = (advice: string | undefined) => {
        if (!advice) return "";
        if (advice === 'Sell Now') return t('mkt_advice_sell_now', lang);
        if (advice === 'Hold') return t('mkt_advice_hold', lang);
        return t('mkt_advice_wait', lang);
    };

    // Filter to ensure UNIQUE CROPS in the top summary card list
    const uniqueDisplayPrices = React.useMemo(() => {
        const seen = new Set();
        return displayPrices.filter(item => {
            const k = item.crop;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [displayPrices]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar font-display text-slate-900 dark:text-white pb-32 transition-colors duration-200">
            
            {/* Header - Cleaned */}
            <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-md p-6 sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 transition-all duration-300">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em] text-slate-900 dark:text-white">{t('mkt_intro_title', lang)}</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg font-normal">{t('mkt_intro_desc', lang)}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-4 md:p-10 flex flex-col gap-8">
                
                {/* HERO: Price History & Trends (Stock Style) */}
                {showSkeleton ? (
                    <Skeleton className="h-[400px] w-full rounded-[2rem]" />
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700 animate-fadeIn">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mkt_price_history', lang)}</h2>
                                    {/* Crop Selector Inside the Card */}
                                    <div className="relative">
                                        <select 
                                            className="appearance-none bg-slate-100 dark:bg-slate-700 border-none rounded-lg pl-3 pr-8 py-1 text-sm font-bold text-slate-800 dark:text-white cursor-pointer focus:ring-2 focus:ring-green-500"
                                            value={selectedCrop}
                                            onChange={(e) => setSelectedCrop(e.target.value)}
                                        >
                                            {uniqueDisplayPrices.map(c => <option key={c.crop} value={c.crop}>{c.crop}</option>)}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
                                    </div>
                                </div>
                                
                                {/* Big Price Display */}
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-black text-slate-900 dark:text-white">{activeItem?.modal_price}</span>
                                    <span className={`text-lg font-bold ${activeItem?.trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                                        {activeItem?.change}
                                    </span>
                                    <span className="text-sm text-slate-400 uppercase font-bold tracking-wide">{t('mkt_quintal', lang)}</span>
                                </div>
                            </div>

                            {/* Time Range Selector */}
                            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
                                {(['1D', '1W', '1M', '1Y', '3Y'] as TimeRange[]).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setTimeRange(r)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                            timeRange === r 
                                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chart Canvas */}
                        <div className="h-72 w-full">
                            <canvas ref={chartRef}></canvas>
                        </div>
                    </div>
                )}

                {/* Live Mandi Prices Widget (Secondary) */}
                <section>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('mkt_live_prices', lang)}</h2>
                        <div className="flex gap-2 text-sm text-slate-500 dark:text-slate-400 items-center bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                            <span>⏱️</span> {t('mkt_updated_ago', lang)}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {showSkeleton ? (
                            [1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)
                        ) : (
                            uniqueDisplayPrices.slice(0, 4).map((item, idx) => (
                                <div key={idx} className={`flex flex-col gap-2 rounded-xl p-6 border shadow-sm hover:shadow-md transition-all cursor-pointer animate-fadeIn ${item.crop === selectedCrop ? 'bg-green-50 dark:bg-green-900/10 border-green-500 dark:border-green-700 ring-1 ring-green-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`} onClick={() => setSelectedCrop(item.crop)}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex flex-col">
                                            <p className="text-slate-900 dark:text-slate-200 text-base font-bold">{item.crop}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate w-full">{item.mandi || 'Local Mandi'}</p>
                                        </div>
                                        <span className={`rounded-full p-1 text-sm shrink-0 ${item.trend === 'up' ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' : item.trend === 'down' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {item.trend === 'up' ? '↗' : '↘'}
                                        </span>
                                    </div>
                                    <p className="text-slate-900 dark:text-white text-3xl font-bold leading-tight">{item.modal_price}<span className="text-base font-normal text-slate-500 dark:text-slate-400">{t('mkt_quintal', lang).replace('/ ', '/')}</span></p>
                                    <p className={`${item.trend === 'up' ? 'text-green-600' : 'text-red-600'} text-sm font-bold flex items-center gap-1`}>
                                        {item.change}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        
                        {/* Mandi Price Comparison */}
                        {showSkeleton ? <Skeleton className="h-[400px] w-full rounded-xl" /> : (
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[400px] flex flex-col animate-fadeIn">
                                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('mkt_comparison', lang)}</h3>
                                        <p className="text-xs text-slate-500">{t('mkt_comp_desc', lang)} <strong>{selectedCrop}</strong></p>
                                    </div>
                                    <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                                        <button 
                                            onClick={() => setMandiViewMode('table')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mandiViewMode === 'table' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                        >
                                            {t('mkt_table', lang)}
                                        </button>
                                        <button 
                                            onClick={() => setMandiViewMode('map')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mandiViewMode === 'map' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                        >
                                            {t('mkt_map', lang)}
                                        </button>
                                    </div>
                                </div>
                                
                                {mandiViewMode === 'table' ? (
                                    <>
                                        <div className="overflow-x-auto flex-1">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 uppercase">
                                                        <th className="p-4 font-bold">{t('mkt_head_name', lang)}</th>
                                                        <th className="p-4 font-bold">{t('mkt_head_rate', lang)}</th>
                                                        <th className="p-4 font-bold">{t('mkt_head_dist', lang)}</th>
                                                        <th className="p-4 font-bold">{t('mkt_head_change', lang)}</th>
                                                        <th className="p-4 font-bold text-right">{t('mkt_head_actions', lang)}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-slate-900 dark:text-white text-sm divide-y divide-slate-200 dark:divide-slate-700">
                                                    {nearbyMandis.slice(0, visibleMandisCount).map((m, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-4">
                                                                <div className="font-bold">{m.mandi}</div>
                                                                <div className="text-xs text-slate-500">{m.crop}</div>
                                                            </td>
                                                            <td className="p-4 font-bold text-base">{m.price}</td>
                                                            <td className="p-4 text-slate-500">{m.distance}</td>
                                                            <td className={`p-4 font-bold ${m.change?.includes('+') ? 'text-green-600' : m.change?.includes('-') ? 'text-red-600' : 'text-slate-400'}`}>{m.change}</td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex gap-2 justify-end">
                                                                    <button 
                                                                        onClick={() => handleContactMandi(m.mandi || 'Trader')}
                                                                        className="p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 transition-colors"
                                                                        title={t('mkt_contact_trader', lang)}
                                                                    >
                                                                        📞
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleLocateMandi(m.mandi || 'Market')}
                                                                        className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
                                                                        title={t('mkt_get_directions', lang)}
                                                                    >
                                                                        📍
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {visibleMandisCount < nearbyMandis.length && (
                                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                                                <button onClick={handleLoadMoreMandis} className="text-green-600 font-bold text-sm hover:underline flex items-center gap-1">
                                                    {t('mkt_view_more', lang)} <span>↓</span>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex-1 w-full h-[400px] bg-slate-100 dark:bg-slate-900 relative">
                                        <iframe 
                                            width="100%" 
                                            height="100%" 
                                            style={{ border: 0 }} 
                                            loading="lazy" 
                                            allowFullScreen 
                                            src={`https://www.google.com/maps?q=${mapFocus ? mapFocus : `${selectedCrop}+mandi`}+near+${userCoords ? `${userCoords.lat},${userCoords.lon}` : locationName}&output=embed`}
                                        ></iframe>
                                        
                                        {/* Map Overlay Quick Select */}
                                        <div className="absolute top-4 left-4 right-4 flex gap-2 overflow-x-auto no-scrollbar">
                                            {nearbyMandis.slice(0, 5).map((m, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={() => setMapFocus(m.mandi || "")}
                                                    className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold whitespace-nowrap border border-slate-200 dark:border-slate-700 hover:bg-green-50 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    📍 {m.mandi}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quality-Based Price Estimator */}
                        {showSkeleton ? <Skeleton className="h-64 w-full rounded-xl" /> : (
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 animate-fadeIn">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                                    <span>⚖️</span> {t('mkt_quality_est', lang)}
                                </h3>
                                <div className="flex flex-col md:flex-row gap-8">
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl h-48 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative overflow-hidden group">
                                            <div className="flex flex-col items-center z-10">
                                                <span className="text-4xl mb-2">📸</span>
                                                <p className="text-sm font-bold text-slate-500">{t('mkt_upload_photo', lang)}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-center text-slate-400">{t('mkt_ai_analyze', lang)}</p>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-5 justify-center">
                                        
                                        {/* Sliders */}
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    <span>{t('mkt_moisture', lang)}</span>
                                                    <span className={`${moisture > 14 ? 'text-red-500' : 'text-green-600'}`}>{moisture}%</span>
                                                </div>
                                                <input className="w-full accent-green-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" max="20" min="0" type="range" value={moisture} onChange={e => setMoisture(parseInt(e.target.value))}/>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    <span>{t('mkt_grain_size', lang)}</span>
                                                    <span className="text-green-600">{grainSize > 7 ? 'Bold' : grainSize > 4 ? 'Medium' : 'Small'}</span>
                                                </div>
                                                <input className="w-full accent-green-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" max="10" min="0" type="range" value={grainSize} onChange={e => setGrainSize(parseInt(e.target.value))}/>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    <span>{t('mkt_foreign_matter', lang)}</span>
                                                    <span className={`${foreignMatter > 2 ? 'text-red-500' : 'text-green-600'}`}>{foreignMatter}%</span>
                                                </div>
                                                <input className="w-full accent-green-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" max="10" min="0" type="range" value={foreignMatter} onChange={e => setForeignMatter(parseInt(e.target.value))}/>
                                            </div>
                                        </div>

                                        <div className={`mt-2 p-4 rounded-lg border transition-all duration-300 ${isCalculating ? 'bg-slate-100 border-slate-200 opacity-70' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'}`}>
                                            <p className="text-sm font-bold text-green-700 dark:text-green-400 mb-1">{t('mkt_est_price', lang)}</p>
                                            <p className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                {isCalculating ? (
                                                    <span className="text-lg text-slate-500 animate-pulse">{t('mkt_calc', lang)}</span>
                                                ) : (
                                                    <>₹{estimatedRange.min} - ₹{estimatedRange.max} <span className="text-sm font-normal text-slate-500">{t('mkt_quintal', lang)}</span></>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Right Column */}
                    <div className="flex flex-col gap-8">
                        
                        {/* AI Selling Advisor */}
                        {showSkeleton ? <Skeleton className="h-48 w-full rounded-xl" /> : (
                            activeItem && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden animate-fadeIn">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">🧠</div>
                                    <div className="relative z-10">
                                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                                            <span className="text-green-500">🤖</span> {t('mkt_ai_advisor', lang)}
                                        </h3>
                                        <div className={`bg-[#e7fcf0] dark:bg-[#0f291a] p-4 rounded-xl mb-4 border ${activeItem.advice === 'Sell Now' ? 'border-green-200 dark:border-green-800' : 'border-yellow-200 dark:border-yellow-800'}`}>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`size-3 rounded-full ${activeItem.advice === 'Sell Now' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
                                                <span className={`text-lg font-bold ${activeItem.advice === 'Sell Now' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                                    {getAdviceText(activeItem.advice)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-800 dark:text-slate-300 font-medium">{activeItem.advice_reason}</p>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <div>
                                                <p className="text-xs font-bold text-slate-500 uppercase">{t('mkt_est_profit', lang)}</p>
                                                <p className="text-lg font-black text-green-600">+12%</p>
                                            </div>
                                            <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-4 py-2 rounded-lg">{t('mkt_view_report', lang)}</button>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        {/* Negotiation Tips */}
                        {showSkeleton ? <Skeleton className="h-40 w-full rounded-xl" /> : (
                            <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800 shadow-sm p-6 animate-fadeIn">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-800 dark:text-orange-300">
                                    <span>💡</span> {t('mkt_neg_tips', lang)}
                                </h3>
                                <ul className="flex flex-col gap-3">
                                    <li className="flex gap-3 items-start">
                                        <span className="text-orange-600 dark:text-orange-400 text-lg mt-0.5">✓</span>
                                        <p className="text-sm text-orange-900 dark:text-orange-100"><span className="font-bold">{t('mkt_tip_quality', lang)}:</span> {t('mkt_tip_quality_desc', lang)} ({moisture}%).</p>
                                    </li>
                                    <li className="flex gap-3 items-start">
                                        <span className="text-orange-600 dark:text-orange-400 text-lg mt-0.5">✓</span>
                                        <p className="text-sm text-orange-900 dark:text-orange-100"><span className="font-bold">{t('mkt_tip_lev', lang)}:</span> "{t('mkt_tip_lev_desc', lang)}"</p>
                                    </li>
                                </ul>
                            </div>
                        )}

                        {/* Quick Invoice */}
                        {showSkeleton ? <Skeleton className="h-64 w-full rounded-xl" /> : (
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 animate-fadeIn">
                                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">{t('mkt_invoice', lang)}</h3>
                                <form className="flex flex-col gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t('mkt_buyer', lang)}</label>
                                        <input className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-900 dark:text-white" placeholder="Enter name" type="text"/>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t('mkt_qty', lang)}</label>
                                            <input className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-900 dark:text-white" placeholder="0" type="number"/>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t('mkt_rate_q', lang)}</label>
                                            <input className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-900 dark:text-white" placeholder="₹" type="number"/>
                                        </div>
                                    </div>
                                    <button className="mt-2 w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors" type="button">
                                        <span>📄</span> {t('mkt_gen_invoice', lang)}
                                    </button>
                                </form>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};