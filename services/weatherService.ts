
import { WeatherContext, WeatherDay } from "../types";
import { trackApiLog } from "./cmsService";
import { getSecret } from "./secretManager";
import { fetchQuery } from "./queryClient";

const getWeatherBitKey = () => getSecret('weather_key');

// Helper for dates
const formatDate = (date: Date) => date.toISOString().split('T')[0];
const getDayName = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short' });

export const getLocalWeather = async (lat: number, lon: number): Promise<WeatherContext> => {
    // Cache Key based on rounded Lat/Lon (10km grid ~ 0.1 deg) to share cache between nearby users
    const gridKey = `wx:${lat.toFixed(1)},${lon.toFixed(1)}`;
    const startTime = Date.now();

    // STRICT CACHE POLICY: 30 Minutes to match the UI refresh rate
    return fetchQuery(gridKey, async () => {
        try {
            if (!navigator.onLine) throw new Error("Offline");

            const apiKey = getWeatherBitKey();
            if (!apiKey) throw new Error("Weather API Key missing");

            // 1. Fetch Current
            const currentRes = await fetch(`https://api.weatherbit.io/v2.0/current?lat=${lat}&lon=${lon}&key=${apiKey}`);
            const currentJson = await currentRes.json();
            
            // Check for API errors (e.g., invalid key)
            if (currentJson.error) throw new Error(currentJson.error);
            if (!currentJson.data || currentJson.data.length === 0) throw new Error("No weather data returned");

            const curr = currentJson.data[0];

            // 2. Fetch Forecast (Lite)
            const forecastRes = await fetch(`https://api.weatherbit.io/v2.0/forecast/daily?lat=${lat}&lon=${lon}&days=3&key=${apiKey}`);
            const forecastJson = await forecastRes.json();
            
            // 4. Determine Logic
            let soilMoistureDisplay = "Moderate";
            if (curr.precip > 5 || curr.rh > 85) soilMoistureDisplay = "High (Wet)";
            else if (curr.rh < 40 && curr.temp > 30) soilMoistureDisplay = "Low (Dry)";

            let lastRainDisplay = "No rain (6 days)";
            if (curr.precip > 0.5) lastRainDisplay = "Today";

            let condition = "Clear";
            if (curr.precip > 0) condition = "Rain";
            else if (curr.clouds > 50) condition = "Cloudy";
            else if (curr.temp > 35) condition = "Hot";

            // 5. Simulate History (Since History API is paid, we generate plausible past data based on current)
            // This is for UI demonstration of the "Swipe Left" feature
            const history: WeatherDay[] = [];
            for (let i = 1; i <= 6; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                // Random variance based on current temp
                const variance = (Math.random() * 4) - 2; 
                history.push({
                    date: getDayName(d),
                    temp: Math.round(curr.temp + variance),
                    condition: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'Rain' : 'Cloudy') : 'Clear'
                });
            }

            // 5. Format AI String
            const aiPromptString = `
[DATA INJECTION START]
Current Weather: Temp: [${curr.temp}°C], RH: [${curr.rh}%], Precip: [${curr.precip || 0}mm]
Condition: [${condition}]
Soil Conditions: Moisture: [${soilMoistureDisplay}]
[DATA INJECTION END]
`;

            trackApiLog({
                service: 'Weatherbit',
                status: 'success',
                latencyMs: Date.now() - startTime,
                requestSnippet: `Lat: ${lat}, Lon: ${lon}`
            });

            return {
                ai_string: aiPromptString,
                display: {
                    location: `${curr.city_name}, ${curr.state_code}`,
                    temp: curr.temp,
                    rh: curr.rh,
                    condition: condition,
                    wind_spd: curr.wind_spd,
                    pressure: curr.pres,
                    soil_moisture: soilMoistureDisplay,
                    last_rain: lastRainDisplay,
                    is_raining_now: (curr.precip || 0) > 0,
                    history: history
                },
                isOffline: false
            };

        } catch (error: any) {
            console.warn("Weather fetch failed (using mock):", error.message);
            
            // Generate High Quality Mock Data for Demo/Fallback
            const mockHistory: WeatherDay[] = [];
            const today = new Date();
            for (let i = 1; i <= 6; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                mockHistory.push({
                    date: getDayName(d),
                    temp: 28 + Math.floor(Math.random() * 5),
                    condition: i % 3 === 0 ? 'Cloudy' : 'Clear'
                });
            }

            return {
                ai_string: "Weather data unavailable. Assume standard conditions: 28°C, Clear.",
                display: {
                    location: "Demo Region",
                    temp: 28,
                    rh: 60,
                    condition: "Clear",
                    wind_spd: 5,
                    pressure: 1013,
                    soil_moisture: "Moderate",
                    last_rain: "3 days ago",
                    is_raining_now: false,
                    history: mockHistory
                },
                isOffline: true
            };
        }
    }, { ttl: 1000 * 60 * 30, persist: true }); // Cache for 30 Minutes
};
