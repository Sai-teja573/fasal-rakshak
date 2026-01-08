import React, { useEffect, useState, useRef } from 'react';
import { getRealMarketPrices } from '../services/agroService';
import { MarketItem, Language } from '../types';
import Chart from 'chart.js/auto';
import { t } from '../services/translationService';
import { LoadingScreen } from './ui/LoadingScreen';

interface MarketScreenProps {
    lang: Language;
}

export const MarketScreen: React.FC<MarketScreenProps> = ({ lang }) => {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<string>("India");
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let locName = "India";
      let displayLoc = "India";
      let district = "Nagpur";
      let state = "Maharashtra";

      if ('geolocation' in navigator) {
         try {
             const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                 navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
             });
             
             const { latitude, longitude } = position.coords;
             
             // Reverse Geocode to get District/State for better AI Context
             try {
                 const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                 if (response.ok) {
                     const data = await response.json();
                     district = data.locality || data.city || "";
                     state = data.principalSubdivision || "";
                     
                     if (district && state) {
                         locName = `${district}, ${state}, India`;
                         displayLoc = `${district}, ${state}`;
                     } else if (state) {
                         locName = `${state}, India`;
                         displayLoc = state;
                     } else {
                         locName = `${latitude}, ${longitude}`; // Fallback to coords
                         displayLoc = "Current Location";
                     }
                 }
             } catch (geoErr) {
                 console.warn("Reverse geocoding failed", geoErr);
                 locName = `${latitude}, ${longitude}`;
                 displayLoc = "Your Area";
             }

         } catch(e) { 
             console.log("Geolocation permission denied or failed"); 
         }
      }
      
      setLocation(displayLoc);

      // Fetch market data using agroService
      const data = await getRealMarketPrices(district, state);
      setItems(data);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Effect to draw summary chart
  useEffect(() => {
      if (!loading && items.length > 0 && chartRef.current) {
          const ctx = chartRef.current.getContext('2d');
          if (ctx) {
             const chartStatus = Chart.getChart(chartRef.current);
             if (chartStatus) chartStatus.destroy();
             
             const labels = items.map(i => i.crop);
             const parsePrice = (priceStr: string) => {
                 let cleaned = priceStr.replace(/[^\d.\-]/g, '');
                 if (cleaned.includes('-')) {
                     const parts = cleaned.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
                     if (parts.length > 0) return parts.reduce((a, b) => a + b, 0) / parts.length;
                 }
                 return parseFloat(cleaned) || 0;
             };

             const prices = items.map(i => parsePrice(i.price));

             new Chart(ctx, {
                 type: 'bar',
                 data: {
                     labels: labels,
                     datasets: [{
                         label: 'Avg Price (₹/Q)',
                         data: prices,
                         backgroundColor: '#22c55e',
                         borderRadius: 4
                     }]
                 },
                 options: {
                     responsive: true,
                     plugins: { legend: { display: false } },
                     scales: {
                         y: {
                             beginAtZero: true,
                             title: {
                                 display: true,
                                 text: 'Price (₹/Quintal)'
                             }
                         }
                     }
                 }
             });
          }
      }
  }, [loading, items]);

  if (loading) {
      return (
          <div className="h-full relative">
              <LoadingScreen text="Fetching Latest Market Prices..." className="absolute" overlay />
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <header className="px-6 py-4 bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 md:hidden transition-colors">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('mkt_title', lang)}</h2>
      </header>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white hidden md:block">{t('mkt_title', lang)}</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    {t('mkt_subtitle', lang)} <span className="font-bold text-green-600 dark:text-green-400">{location}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">Showing crops cultivated in your area + common staples.</p>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="Refresh Prices"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            </button>
        </div>

        {/* Overview Chart */}
        {!loading && items.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-8">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">{t('mkt_price_overview', lang)}</h3>
                <div className="h-64 w-full">
                    <canvas ref={chartRef}></canvas>
                </div>
            </div>
        )}

        {items.length === 0 ? (
            <div className="text-center py-20">
                <p className="text-slate-500 dark:text-slate-400">Could not fetch market data right now. Please try again later.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{item.crop}</h3>
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                item.trend === 'up' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
                                item.trend === 'down' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                                {item.trend === 'up' ? t('mkt_trend_up', lang) : item.trend === 'down' ? t('mkt_trend_down', lang) : t('mkt_trend_stable', lang)}
                            </span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{item.price}</div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{t('mkt_updated', lang)}: {item.last_updated}</p>
                        {item.history && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between text-xs text-slate-500">
                                <span>{t('mkt_prev', lang)}: ₹{item.history[0]?.price}</span>
                                <span className={item.trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                                    {item.trend === 'up' ? '+' : ''}
                                    { (parseFloat(item.price.replace(/[^\d.]/g, '')) - item.history[0]?.price).toFixed(0) }
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
        <div className="h-24 md:h-0"></div>
      </main>
    </div>
  );
};