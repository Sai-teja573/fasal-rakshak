
import React, { useState, useMemo, useEffect } from 'react';
import { Language, CropImageDef } from '../types';
import { t, CROP_TRANSLATIONS } from '../services/translationService';
import { fetchCrops } from '../services/cmsService';

interface CropSelectorProps {
    selectedCrops: string[];
    onChange: (crops: string[]) => void;
    lang: Language;
    userLocation?: { lat: number, lon: number };
}

export const CropSelector: React.FC<CropSelectorProps> = ({ selectedCrops, onChange, lang, userLocation }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [cropDb, setCropDb] = useState<CropImageDef[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCrops = async () => {
            setLoading(true);
            try {
                const crops = await fetchCrops();
                setCropDb(crops);
            } catch (e) {
                console.error("Failed to load crops", e);
            } finally {
                setLoading(false);
            }
        };
        loadCrops();
    }, []);

    // Sort crops based on user location (Heuristic: North vs South India)
    const sortedCrops = useMemo(() => {
        let sorted = [...cropDb];
        if (userLocation) {
            // Approx lat for dividing North/South India
            const isNorth = userLocation.lat > 22; 
            const isSouth = userLocation.lat <= 22;

            const northStaples = ['wheat', 'mustard', 'potato', 'sugarcane'];
            const southStaples = ['rice', 'coconut', 'banana', 'turmeric', 'chilli'];

            sorted.sort((a, b) => {
                const aScore = (isNorth && northStaples.includes(a.id)) ? 2 : (isSouth && southStaples.includes(a.id)) ? 2 : 0;
                const bScore = (isNorth && northStaples.includes(b.id)) ? 2 : (isSouth && southStaples.includes(b.id)) ? 2 : 0;
                return bScore - aScore;
            });
        }
        return sorted;
    }, [userLocation, cropDb]);

    const filteredCrops = sortedCrops.filter(c => {
        const matchesSearch = c.name_en.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ['All', 'Cereal', 'Vegetable', 'Cash Crop', 'Pulse', 'Spice', 'Fruit'];

    const getLocalName = (nameEn: string) => {
        if (lang === 'en') return nameEn;
        return CROP_TRANSLATIONS[lang]?.[nameEn] || nameEn;
    };

    const toggleCrop = (cropName: string) => {
        if (selectedCrops.includes(cropName)) {
            onChange(selectedCrops.filter(c => c !== cropName));
        } else {
            onChange([...selectedCrops, cropName]);
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Search and Filter */}
            <div className="flex flex-col gap-3 shrink-0">
                <input
                    type="text"
                    placeholder={`Search crops... (${getLocalName('Search')})`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
                
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                                activeCategory === cat 
                                ? 'bg-green-600 text-white shadow-md' 
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Chips */}
            {selectedCrops.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-fadeIn shrink-0 max-h-20 overflow-y-auto">
                    {selectedCrops.map(crop => (
                        <div key={crop} className="flex items-center gap-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200 dark:border-green-700">
                            <span>{getLocalName(crop)}</span>
                            <button type="button" onClick={() => toggleCrop(crop)} className="w-4 h-4 rounded-full bg-white/50 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs ml-1 transition-colors">×</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Rich Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto custom-scrollbar p-1 flex-1 min-h-0">
                {loading ? (
                    <div className="col-span-full flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredCrops.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-slate-400 text-sm">No crops found matching "{searchTerm}"</div>
                ) : (
                    filteredCrops.map((crop) => {
                        const isSelected = selectedCrops.includes(crop.name_en);
                        const localName = getLocalName(crop.name_en);
                        return (
                            <button
                                key={crop.id}
                                type="button"
                                onClick={() => toggleCrop(crop.name_en)}
                                className={`relative rounded-xl overflow-hidden border transition-all duration-200 group text-left flex flex-col ${
                                    isSelected 
                                    ? 'border-green-500 ring-2 ring-green-500 ring-offset-2 dark:ring-offset-slate-900 scale-[0.98]' 
                                    : 'border-slate-200 dark:border-slate-700 hover:border-green-400'
                                }`}
                            >
                                <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-700 relative w-full overflow-hidden">
                                    <img 
                                        src={crop.image} 
                                        alt={crop.name_en} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            // Fallback text will show if image hidden
                                            const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                            if (fallback) fallback.classList.remove('hidden');
                                        }}
                                    />
                                    {/* Fallback Icon */}
                                    <div className="fallback-icon absolute inset-0 flex items-center justify-center bg-green-50 dark:bg-green-900/20 hidden">
                                        <span className="text-2xl">🌱</span>
                                    </div>

                                    <div className={`absolute inset-0 bg-black/40 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-20'}`}></div>
                                    {isSelected && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce-in border-2 border-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className={`p-2 flex-1 flex flex-col justify-center ${isSelected ? 'bg-green-50 dark:bg-green-900/40' : 'bg-white dark:bg-slate-800'}`}>
                                    <h4 className={`font-bold text-sm leading-tight text-center ${isSelected ? 'text-green-800 dark:text-green-300' : 'text-slate-800 dark:text-white'}`}>
                                        {localName}
                                    </h4>
                                    {lang !== 'en' && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 text-center">{crop.name_en}</p>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};
