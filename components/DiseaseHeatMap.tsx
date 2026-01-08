
import React, { useEffect, useRef } from 'react';
import { DiseaseCluster } from '../services/alertService';

interface DiseaseHeatMapProps {
    clusters: DiseaseCluster[];
    className?: string;
}

export const DiseaseHeatMap: React.FC<DiseaseHeatMapProps> = ({ clusters, className = "" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 10;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw Radar Rings (10km, 30km, 50km)
        const rings = [10, 30, 50]; // km
        const scale = maxRadius / 50; // pixels per km

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)'; // Green-ish
        ctx.lineWidth = 1;

        rings.forEach(km => {
            const r = km * scale;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
            ctx.font = '10px monospace';
            ctx.fillText(`${km}km`, centerX + 2, centerY - r + 10);
        });

        // Draw Crosshairs
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - maxRadius);
        ctx.lineTo(centerX, centerY + maxRadius);
        ctx.moveTo(centerX - maxRadius, centerY);
        ctx.lineTo(centerX + maxRadius, centerY);
        ctx.stroke();

        // Draw User (Center)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#10b981'; // Emerald 500
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#10b981';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Plot Clusters
        clusters.forEach(cluster => {
            cluster.points.forEach((point, i) => {
                // Determine angle based on index to scatter them realistically around the circle
                // In a real map we'd calculate bearing from Lat/Lon. 
                // Here we simulate bearing based on hash of coords to keep it consistent but scattered.
                const angle = (point.lat + point.lon) * 1000 % (2 * Math.PI);
                const distancePx = Math.min(point.distance, 50) * scale;

                const x = centerX + distancePx * Math.cos(angle);
                const y = centerY + distancePx * Math.sin(angle);

                // Draw Heat Point
                ctx.beginPath();
                const pointRadius = cluster.riskLevel === 'High' ? 6 : 4;
                ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
                
                // Color based on risk
                if (cluster.riskLevel === 'High') {
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; // Red
                    ctx.shadowColor = 'rgba(239, 68, 68, 1)';
                    ctx.shadowBlur = 15;
                } else if (cluster.riskLevel === 'Moderate') {
                    ctx.fillStyle = 'rgba(245, 158, 11, 0.8)'; // Orange
                    ctx.shadowColor = 'rgba(245, 158, 11, 1)';
                    ctx.shadowBlur = 10;
                } else {
                    ctx.fillStyle = 'rgba(250, 204, 21, 0.6)'; // Yellow
                    ctx.shadowBlur = 0;
                }
                
                ctx.fill();
                ctx.shadowBlur = 0; // Reset
            });
        });

        // Scan Line Animation (Simulated via CSS usually, but simple draw here)
        // Static for now, CSS handles rotation of container if needed.

    }, [clusters]);

    return (
        <div className={`relative flex flex-col items-center ${className}`}>
            <div className="relative w-full aspect-square max-w-[300px] bg-slate-900 rounded-full border-4 border-slate-800 shadow-2xl overflow-hidden group">
                {/* Scan Line */}
                <div className="absolute inset-0 w-full h-full rounded-full border-b border-green-500/30 bg-gradient-to-b from-transparent via-transparent to-green-500/10 animate-[spin_4s_linear_infinite] origin-center z-10 pointer-events-none"></div>
                
                <canvas 
                    ref={canvasRef} 
                    width={300} 
                    height={300} 
                    className="w-full h-full relative z-0"
                />
            </div>
            
            {/* Legend */}
            <div className="flex gap-4 mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_red]"></span> High Risk</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Moderate</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> You</div>
            </div>
        </div>
    );
};
