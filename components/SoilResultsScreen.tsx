
import React, { useRef, useState } from 'react';
import { SoilAnalysisResponse } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from './ui/Shadcn';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LoadingScreen } from './ui/LoadingScreen';

interface SoilResultsProps {
    data: SoilAnalysisResponse;
    onBack: () => void;
}

const NutrientBar = ({ label, value }: { label: string, value: string }) => {
    const getLevel = (v: string) => {
        const lower = v.toLowerCase();
        if (lower.includes('high')) return { width: '90%', color: 'bg-green-500' };
        if (lower.includes('medium') || lower.includes('moderate')) return { width: '60%', color: 'bg-yellow-500' };
        return { width: '30%', color: 'bg-red-500' };
    };
    
    const { width, color } = getLevel(value);

    return (
        <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">{label}</span>
                <span className="text-slate-500">{value}</span>
            </div>
            <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width }}></div>
            </div>
        </div>
    );
};

export const SoilResultsScreen: React.FC<SoilResultsProps> = ({ data, onBack }) => {
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const pdfPrintRef = useRef<HTMLDivElement>(null);

    const getPhColor = (phStr: string) => {
        const ph = parseFloat(phStr) || 7;
        if (ph < 5.5 || ph > 8.5) return 'text-red-500';
        if (ph < 6.5 || ph > 7.5) return 'text-yellow-500';
        return 'text-green-500';
    };

    const handleDownloadPdf = async () => {
        if (!pdfPrintRef.current) return;
        setGeneratingPdf(true);
        try {
            const canvas = await html2canvas(pdfPrintRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Soil_Report_${data.soilType.replace(/\s/g, '_')}.pdf`);
        } catch (e) {
            console.error("PDF Error", e);
            alert("Failed to generate PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Soil Health Report',
                    text: `My farm soil is ${data.soilType} with a Health Score of ${data.healthScore}/100. Recommendations included.`,
                    url: window.location.href
                });
            } catch (e) { console.log('Share canceled'); }
        } else {
            alert("Sharing not supported on this device.");
        }
    };

    if (generatingPdf) {
        return <LoadingScreen text="Generating Soil Report PDF..." />;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar relative">
            
            {/* Hidden Print View */}
            <div ref={pdfPrintRef} style={{ position: 'fixed', top: -9999, left: -9999, width: '800px', background: 'white', padding: '40px', color: 'black', fontFamily: 'sans-serif', zIndex: -1 }}>
                <div style={{borderBottom: '2px solid #d97706', paddingBottom: '20px', marginBottom: '20px'}}>
                    <h1 style={{fontSize: '28px', fontWeight: 'bold', color: '#b45309'}}>Soil Health Report</h1>
                    <p>{data.soilType} • {new Date(data.timestamp).toLocaleDateString()}</p>
                </div>
                <div style={{display: 'flex', gap: '30px', marginBottom: '30px'}}>
                    <div style={{flex: 1}}>
                        <div style={{fontSize: '48px', fontWeight: 'bold', color: '#d97706'}}>{data.healthScore}</div>
                        <div style={{textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold', color: '#78350f'}}>Health Score</div>
                    </div>
                    <div style={{flex: 3}}>
                        <p style={{fontSize: '16px', lineHeight: '1.5'}}>{data.reportSummary}</p>
                    </div>
                </div>
                <div style={{marginBottom: '20px', padding: '15px', background: '#fffbeb', border: '1px solid #fcd34d'}}>
                    <h3 style={{fontWeight: 'bold', marginBottom: '10px'}}>Recommendations</h3>
                    <ul style={{paddingLeft: '20px'}}>
                        {data.recommendations.fertilizers.map(f => <li key={f}>{f}</li>)}
                        {data.recommendations.amendments.map(a => <li key={a}>{a}</li>)}
                    </ul>
                </div>
            </div>

            <div className="p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6 pb-24">
                
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <span className="text-xl">←</span> <span className="font-bold">Back to Lab</span>
                    </button>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleShare}>Share Report</Button>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleDownloadPdf}>Download PDF</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Top Card: Score & Basic Info */}
                    <div className="md:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 rounded-3xl p-6 shadow-sm border border-amber-100 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                            <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/></svg>
                        </div>
                        
                        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <path className="text-amber-200 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                <path className="text-amber-600 drop-shadow-md transition-all duration-1000 ease-out" strokeDasharray={`${data.healthScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-3xl font-black text-slate-800 dark:text-white">{data.healthScore}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500">Score</span>
                            </div>
                        </div>
                        <div className="flex-1 text-center md:text-left z-10">
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{data.soilType}</h1>
                            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4 font-medium">"{data.reportSummary}"</p>
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                <Badge className="bg-white text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 shadow-sm">Confidence: {data.confidence}%</Badge>
                                {data.govt_data_reference && <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">Govt Data Ref</Badge>}
                            </div>
                        </div>
                    </div>

                    {/* Chemical Properties (pH & Nutrients) */}
                    <Card className="border-l-4 border-l-green-500 h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">🧪 Chemical Analysis</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-600 dark:text-slate-400">pH Level</span>
                                <div className="text-right">
                                    <span className={`text-3xl font-black ${getPhColor(data.phLevel)}`}>{data.phLevel.split(' ')[0]}</span>
                                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{data.phLevel.split(' ').slice(1).join(' ').replace(/[()]/g, '')}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <NutrientBar label="Nitrogen (N)" value={data.nutrients.nitrogen} />
                                <NutrientBar label="Phosphorus (P)" value={data.nutrients.phosphorus} />
                                <NutrientBar label="Potassium (K)" value={data.nutrients.potassium} />
                                <NutrientBar label="Organic Matter" value={data.organicMatter} />
                            </div>
                            
                            {data.nutrients.micronutrients && (
                                <div className="text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 flex gap-2 items-start">
                                    <span>⚠️</span> <span><strong>Micronutrients:</strong> {data.nutrients.micronutrients}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Improvement Plan (Actionable) */}
                    <Card className="h-full border-l-4 border-l-amber-500">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">🚜 How to Improve</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            
                            {/* Best Crops */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Suitable Crops</h4>
                                <div className="flex flex-wrap gap-2">
                                    {data.recommendations.crops.map(c => (
                                        <span key={c} className="px-3 py-1 bg-green-100 text-green-800 border border-green-200 rounded-full text-xs font-bold shadow-sm">{c}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><span>🧴</span> Fertilizer Plan</h4>
                                    <ul className="text-sm font-medium space-y-1 text-slate-700 dark:text-slate-300">
                                        {data.recommendations.fertilizers.map(f => <li key={f} className="flex gap-2"><span>•</span> {f}</li>)}
                                    </ul>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><span>🔧</span> Amendments</h4>
                                    <ul className="text-sm font-medium space-y-1 text-slate-700 dark:text-slate-300">
                                        {data.recommendations.amendments.map(a => <li key={a} className="flex gap-2"><span>•</span> {a}</li>)}
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Visual Observations</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-900 p-2 rounded">
                                    "{data.visualObservations.join('. ')}. 
                                    Texture is {data.textureDescription}."
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* YouTube Videos */}
                    {data.youtube_videos && data.youtube_videos.length > 0 && (
                        <div className="md:col-span-2">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span>📺</span> Related Video Guides
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                {data.youtube_videos.map((vid, idx) => (
                                    <a key={idx} href={vid.url} target="_blank" rel="noopener noreferrer" className="min-w-[240px] group cursor-pointer block">
                                        <div className="relative aspect-video rounded-xl overflow-hidden mb-2 bg-black shadow-md border border-slate-200 dark:border-slate-700">
                                            <img src={vid.thumbnail} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"/>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">▶</div>
                                            </div>
                                        </div>
                                        <p className="text-sm font-bold line-clamp-2 text-slate-800 dark:text-white group-hover:text-blue-600">{vid.title}</p>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
