# 💻 Technical Documentation (Internal)

## Architecture Overview
Fasal Rakshak is a **Progressive Web App (PWA)** built with a modern "Offline-First" approach.

### 1. Frontend Framework
- **React 18 + TypeScript:** For robust, type-safe UI.
- **Tailwind CSS:** For high-performance, responsive styling.
- **Framer Motion:** For premium, high-frame-rate animations (60fps).

### 2. Backend & Data
- **Supabase:** Handles Authentication, PostgreSQL database, and Real-time signaling.
- **PostGIS:** Used for geospatial queries (finding nearby disease outbreaks within a 30km radius).
- **IndexedDB:** Used for local caching of translations and AI models.

### 3. Special Technologies
- **Service Workers:** Enables 100% offline functionality and background data syncing.
- **WebRTC:** Powers the P2P Voice and Video calling features between farmers.
- **MQTT (HiveMQ):** Connects to ESP32 IoT sensors for real-time soil monitoring.

### 4. Offline Capabilities
- **On-Device Inference:** Uses TFLite (TensorFlow Lite) to run AI diagnosis without a server.
- **Sync Queue:** If a farmer saves a report while offline, it is stored in a local "Sync Queue" and automatically uploaded once a 2G/3G/4G signal is found.

### 5. Security
- **Web3 Identity:** Uses decentralized keys for user identity.
- **End-to-End Encryption:** All chat messages and calls are encrypted and cannot be read by the server.