# 🧠 README 03: AI Features and Workflow

## AI Models & Purpose
Fasal Rakshak leverages the **Google Gemini** ecosystem for different specialized tasks:
*   **Gemini 3 Flash (Primary):** Used for rapid crop disease diagnosis, text analysis, and market advice.
*   **Gemini 3 Pro:** Used for complex reasoning and long-term crop planning.
*   **Gemini 2.5 Flash Native Audio:** Powers the "Live Assistant" for real-time voice conversations.
*   **Gemini 2.5 Flash (TTS):** Converts diagnosis reports into spoken regional languages.
*   **Veo 3.1:** Generates custom 720p cinematic farming guides for specific crop stages.
*   **TFLite (On-Device):** Provides a fallback "Lite" diagnosis model when the user is 100% offline.

## The "AI Council" Workflow
The core innovation is the **Multi-Agent Council** debate logic found in `analyzeCropMedia`. Instead of a single prompt, the system simulates a debate:
1.  **Visual Agent:** Analyzes image patterns (spots, colors, textures).
2.  **IoT Agent:** Injects sensor data (humidity/temp) to validate if conditions match the disease.
3.  **Local Expert Agent:** Checks if the suggested cure is practical/available in rural India.
4.  **Cost Analyst Agent:** Calculates the ROI (cost of medicine vs. value of saved crop).
5.  **Consensus Agent:** Synthesizes all views into a single, confident JSON response.

## Image & Video Processing
*   **Image:** Base64 encoded `inlineData` is sent to Gemini Vision.
*   **Video:** The app uses `generateVideos` (Veo) to create visual instructions for the farmer.
*   **Bounding Boxes:** The AI returns coordinates `[ymin, xmin, ymax, xmax]` which the frontend draws on a `<canvas>` to highlight exactly where the disease is on the leaf.

## Language Translation Pipeline
1.  **Detection:** Detects the farmer's input language.
2.  **Batch Translation:** Uses Google Cloud Translation to translate large blocks of data (News/Schemes).
3.  **Persistent Cache:** Translated strings are stored in **IndexedDB** to minimize API costs and enable offline reading.

## Confidence & Fallback Logic
*   The AI returns a `confidence` score (0-100).
*   If confidence is < 70%, the app triggers "Clarifying Questions" (`DiagnosticQuestion`) to ask the farmer about soil moisture or crop age before finalizing the report.
*   **Mock Mode:** A system-wide toggle in the Admin Dashboard allows forcing high-quality mock data for demos if API quotas are reached.