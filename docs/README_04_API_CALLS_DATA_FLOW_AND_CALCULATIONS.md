# 📊 README 04: API Calls, Data Flow, and Calculations

## External API Integrations
| API | Service | Purpose |
| :--- | :--- | :--- |
| **Gemini AI** | Google | Vision, Logic, TTS, Video Generation, Voice Chat. |
| **Weatherbit** | Weatherbit.io | Hyper-local 3-day forecasts and current conditions. |
| **Places API** | Google Maps | Finding nearby Mandis and authorized pesticide shops. |
| **Agmarknet/eNAM** | Gov of India | Scraped/Fetched live market prices (via Supabase proxy). |
| **YouTube Data** | Google | Fetching related tutorial videos for specific diseases. |
| **BigDataCloud** | Geocoding | Converting GPS coords to District/State names. |

## Request -> Processing Flow
1.  **Capture:** Farmer captures media via `LiveScanner` component.
2.  **Enrichment:** Frontend attaches `WeatherContext` and `UserFarmProfile`.
3.  **Inference:** `analyzeCropMedia` sends data to Gemini.
4.  **Post-Processing:** 
    *   JSON is extracted and mapped to `DiagnosisResponse`.
    *   Geospatial cluster check: PostGIS checks if similar scans exist within 30km.
5.  **Storage:** Images are uploaded to Supabase Storage; metadata is saved to Postgres.

## Key Calculations & Logic
### 1. Fair Price Estimation (Transport)
Located in `transportService.ts`, the algorithm calculates transport costs:
`Price = (KM * Base_Rate) + (Weight_Qtl * Loading_Factor) + Vehicle_Fee`
*   Base rates vary by vehicle (Tractor: ₹35/km, Lorry: ₹60/km).

### 2. Disease Clustering (Epidemiology)
Located in `alertService.ts`, it uses the Haversine formula to find clusters:
*   If `Count >= 5` within `10km` radius in `48 hours` -> **High Risk Outbreak Alert**.

### 3. Market Prediction Logic
Simulated AI logic in `MarketIntelligenceScreen.tsx` uses seasonal multipliers:
*   `Rice: 1.08x`, `Tomato: 0.92x` (supply surge), `Onion: 1.15x`.
*   Calculates a "Confidence Score" based on data age and source reliability (e.g., Verified Agent vs. Gov Data).

## Error & Quota Handling
*   **Exponential Backoff:** `retryOperation` utility handles 429 (Rate Limit) errors by retrying 3 times with increasing delays.
*   **Low Bandwidth Mode:** If 2G is detected, the app disables high-res image uploads and video features to ensure the core diagnosis still works.
*   **API Logs:** Every call is tracked in the `api_logs` table for admin monitoring of latency and success rates.