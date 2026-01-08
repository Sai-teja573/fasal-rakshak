
import React, { useState, useEffect } from 'react';
import { DiagnosisResponse, Language, SoilAnalysisResponse } from '../types';
import { t } from '../services/translationService';
import { SoilResultsScreen } from './SoilResultsScreen'; // Import detail view
import { Skeleton } from './ui/Skeleton';
import { useMinimumLoading } from '../hooks/useMinimumLoading';

// Union type for the list
type HistoryItem = DiagnosisResponse | SoilAnalysisResponse;

interface HistoryScreenProps {
  history: HistoryItem[];
  onSelect: (item: DiagnosisResponse) => void;
  lang: Language;
  onFollowUp: (item: DiagnosisResponse) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ history, onSelect, lang, onFollowUp }) => {
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<HistoryItem | null>(null);
  
  // Skeleton State
  const [loading, setLoading] = useState(true);
  const showSkeleton = useMinimumLoading(loading, 1500);

  useEffect(() => {
      // Simulate checking if history is loaded (in real app, this prop comes from async source)
      if (history !== undefined) {
          setLoading(false);
      }
  }, [history]);

  // Render detail view for Soil Report directly here to reuse logic or just modal it
  // Since onSelect expects DiagnosisResponse, we handle Soil selection internally
  const handleItemClick = (item: HistoryItem) => {
      if ('soilType' in item) {
          // It's a Soil Report
          setSelectedTimelineItem(item);
      } else {
          // It's a Crop Diagnosis
          onSelect(item);
      }
  };

  if (selectedTimelineItem && 'soilType' in selectedTimelineItem) {
      return <SoilResultsScreen data={selectedTimelineItem} onBack={() => setSelectedTimelineItem(null)} />;
  }

  // Helper to distinguish types
  const isSoil = (item: HistoryItem): item is SoilAnalysisResponse => 'soilType' in item;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <header className="px-6 py-4 bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 md:hidden transition-colors">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('hist_title', lang)}</h2>
      </header>
      
      <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
            {/* History List */}
            <div className="w-full">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">{t('hist_recent', lang)}</h3>
                
                {showSkeleton ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="flex gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <Skeleton className="w-24 h-24 rounded-lg shrink-0" />
                                <div className="flex-1 space-y-3 py-1">
                                    <Skeleton className="h-5 w-3/4 rounded" />
                                    <Skeleton className="h-4 w-1/2 rounded" />
                                    <Skeleton className="h-4 w-1/3 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    history.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 border-dashed animate-fadeIn">
                        <p className="text-slate-600 dark:text-slate-300 font-bold text-lg">{t('hist_empty', lang)}</p>
                    </div>
                    ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fadeIn">
                        {history.map((item) => (
                        <div 
                            key={isSoil(item) ? item.id : item.diagnosis_id}
                            className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex gap-4 hover:shadow-md transition-shadow group relative cursor-pointer ${isSoil(item) ? 'border-l-4 border-l-amber-500' : ''}`}
                            onClick={() => handleItemClick(item)}
                        >
                            {/* Image / Icon */}
                            <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden shrink-0 relative">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt="scan" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">{isSoil(item) ? '🪨' : '🌿'}</div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 py-1">
                                {isSoil(item) ? (
                                    <>
                                        <h4 className="font-bold text-slate-800 dark:text-white truncate text-lg">{item.soilType}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">Soil Health: {item.healthScore}%</p>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-block px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase rounded-md">
                                                SOIL LAB
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</p>
                                    </>
                                ) : (
                                    <>
                                        <h4 className="font-bold text-slate-800 dark:text-white truncate text-lg">{item.disease_name_local}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">{item.disease_name_en}</p>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-block px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold uppercase rounded-md">
                                                {item.crop_identified}
                                            </span>
                                        </div>
                                        {(item.follow_ups?.length || 0) > 0 && (
                                            <p className="text-xs text-blue-600 font-bold">
                                                {item.follow_ups!.length} Follow-ups
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Action Icon */}
                            <div className="flex items-start">
                                 <span className="text-slate-300 group-hover:text-green-500 transition-colors">➔</span>
                            </div>
                        </div>
                        ))}
                    </div>
                    )
                )}
            </div>
        </div>
        <div className="h-24 md:h-0"></div>
      </main>
    </div>
  );
};
