# 💻 README 02: Full Technical Architecture

## Overall System Architecture
Fasal Rakshak is built as a **Progressive Web App (PWA)** using an **Offline-First** architecture. It connects a React frontend with a Supabase backend and multiple Google Gemini AI models.

### Folder Structure
*   `components/`: UI screens and logic (Dashboard, Diagnosis, Market, etc.).
*   `services/`: Core logic layer.
    *   `gemini/`: AI pipelines, prompts, and audio processing.
    *   `agro/`: Business logic for market, community, and planning.
    *   `supabaseClient.ts`: Database connection and sync.
*   `hooks/`: Reusable React logic (e.g., `useMinimumLoading`).
*   `types.ts`: Global TypeScript interfaces.

## Technology Stack
### Frontend
*   **React 18 + TypeScript:** UI Logic.
*   **Framer Motion:** High-performance animations (60fps).
*   **Tailwind CSS:** Responsive styling.
*   **Chart.js:** Data visualization for market trends and soil health.
*   **WebRTC:** P2P Voice and Video calling via `callService.ts`.
*   **MQTT (via HiveMQ):** WebSocket connection for ESP32 IoT sensors.

### Backend (Supabase)
*   **Auth:** Phone, Email, and Google OAuth.
*   **Postgres + PostGIS:** Relational data + Geospatial queries (radius-based disease alerts).
*   **Storage:** S3-compatible buckets for diagnosis images and avatars.
*   **Edge Functions:** Server-side logic for secure email sending (via Resend).
*   **Realtime:** Signaling for P2P calls and instant chat.

## Data Flow & Sync
1.  **Online Mode:** Direct API calls to Gemini and Supabase.
2.  **Offline Mode:** 
    *   Uses **TFLite** for on-device image inference.
    *   **IndexedDB (via translationCache):** Stores translated UI and guides.
    *   **Sync Queue:** Actions (saving scans, posts) are queued in `localStorage` and synced automatically when the `window` "online" event triggers.

## Environment Variables & Secrets
The app uses a `secretManager.ts` to manage:
*   `gemini_key`: Primary AI engine.
*   `weather_key`: Weatherbit API.
*   `google_translate_key`: Multi-language support.
*   `google_maps_key`: Location and Mandi discovery.
*   `supabase_url` & `supabase_key`: Backend connectivity.

## Deployment Flow
*   **Local:** Vite/ESM module dev server.
*   **Production:** Static hosting (Vercel/Netlify) + Supabase Cloud.
*   **Service Worker:** `sw.js` handles caching of assets and API responses for offline reliability.