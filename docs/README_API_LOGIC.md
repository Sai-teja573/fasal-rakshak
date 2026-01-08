# 📊 APIs, Calculations & Logic

The app relies on complex math and external data to provide "Intelligence."

### 1. External Data APIs
- **Google Gemini API:** Primary engine for vision, text-to-speech, and logic.
- **Weatherbit API:** Provides hyper-local weather (Temperature, Humidity, Rainfall).
- **eNAM / Agmarknet:** Scrapes official government data for Mandi prices across India.
- **SurePass:** Used for official Aadhaar/KYC verification of Transporters.

### 2. Fair Price Calculation (Logistics)
When a farmer books a truck, the app calculates a "Fair Price" using this logic:
`Price = (Distance * Fuel_Rate) + (Weight_Multiplier * Loading_Factor) + Vehicle_Base_Fee`
- This prevents transporters from overcharging farmers.
- The AI negotiates the middle ground if there is a dispute.

### 3. Disease Outbreak Logic (Clustering)
The app monitors every scan. If 5+ farmers within a 10km radius scan the same disease (e.g., Rice Blast) in 48 hours:
1. The system creates a **"Cluster."**
2. It sends an **Automatic Emergency Alert** to all other farmers in that 10km area.
3. It provides a "Preventive Spray" guide before their crops even get sick.

### 4. Language Translation Logic
The app uses a "Translation Layer" that caches data:
- **Step 1:** Fetch news in English.
- **Step 2:** AI translates it into the User's preferred language.
- **Step 3:** The result is saved in the phone's memory (**IndexedDB**) so the API isn't called again, saving speed and money.

### 5. Soil Nutrient Calculation
AI looks at the soil color and texture:
- **Dark/Black** = High Organic Carbon.
- **Red/Yellow** = Iron Oxides / Leached.
- **Cracks** = High Clay content (High water retention).
The app then maps these visual cues to a standard N-P-K recommendation table.