
import { DiagnosisResponse, SoilAnalysisResponse, DetailedCropPlan } from "../../types";

// --- MOCK DATA FACTORY ---
// Returns high-quality, realistic data when APIs fail or Demo Mode is ON.

export const MOCK_DIAGNOSIS_RESULT: DiagnosisResponse = {
    diagnosis_id: "mock-diag-001",
    scanId: "MOCK_SCAN_AUTO",
    timestamp: Date.now(),
    isOffline: true,
    crop_identified: "Tomato",
    disease_name_en: "Early Blight",
    disease_name_local: "Early Blight (अगेती झुलसा)",
    severity: "High",
    confidence: 98,
    health_score: 45,
    description: "Detected concentric rings on lower leaves, typical of Alternaria solani. High humidity in your area (85%) is accelerating spread.",
    visualSymptoms: ["Bullseye patterns", "Yellow halos", "Leaf curling"],
    affectedAreas: ["Lower Leaves", "Stem"],
    treatment_advisory: {
        summary: "Immediate fungicide application required. Isolate infected plants.",
        chemical_option: {
            product_name: "Mancozeb 75 WP",
            dosage: "2.5g / Liter",
            application: "Foliar Spray",
            detailed_instructions: "Spray during early morning. Ensure underside of leaves are covered.",
            frequency: "Every 7 days"
        },
        organic_option: {
            product_name: "Copper Fungicide",
            dosage: "3g / Liter",
            application: "Spray",
            detailed_instructions: "Use commercial copper oxychloride or homemade Bordeaux mixture."
        },
        cultural_practices: "Improve air circulation. Avoid overhead irrigation."
    },
    dosage_guide: {
        instruction: "Mix 500g in 200L water for 1 Acre.",
        frequency: "Repeat in 10 days",
        waterRequirement: "200 Liters"
    },
    cost_analysis: {
        totalCostRange: "₹350 - ₹500",
        costPerAcre: "₹400",
        medicineQuantity: "500g",
        labourEstimate: "1 Person / 4 Hours",
        costBreakdown: ["Medicine: ₹300", "Labor: ₹100"]
    },
    local_language_output: "English",
    debate_transcript: "Council: Vision AI detected lesions. Weather API confirms high humidity. Diagnosed Early Blight.",
    youtube_videos: [
        { title: "Early Blight Treatment Guide", url: "https://www.youtube.com/watch?v=mock1", thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }
    ]
};

export const MOCK_SOIL_REPORT: SoilAnalysisResponse = {
    id: "mock-soil-001",
    timestamp: Date.now(),
    scanId: "SOIL_MOCK",
    soilType: "Black Cotton Soil",
    soilColor: "Dark Grey/Black",
    textureDescription: "High clay content, prone to cracking when dry.",
    phLevel: "7.5 (Slightly Alkaline)",
    organicMatter: "Medium",
    salinityRisk: "Low",
    moistureRetention: "High",
    nutrients: {
        nitrogen: "Low",
        phosphorus: "Medium",
        potassium: "High",
        micronutrients: "Zinc deficiency likely"
    },
    healthScore: 72,
    confidence: 90,
    recommendations: {
        fertilizers: ["Urea (Split dosage)", "Single Super Phosphate"],
        crops: ["Cotton", "Soybean", "Wheat"],
        amendments: ["Apply Gypsum if drainage is poor", "Green Manure"],
        practices: ["Deep summer ploughing"]
    },
    visualObservations: ["Deep cracks visible", "Dark color indicates good organic carbon"],
    reportSummary: "Soil is healthy but requires Nitrogen top-dressing. Good for cash crops.",
    local_language_output: "English",
    govt_data_reference: "Matched with NBSS&LUP Data for Deccan Plateau"
};

export const MOCK_CROP_PLAN: DetailedCropPlan = {
    id: "mock-plan-001",
    cropName: "Wheat (Lok-1 Variety)",
    status: "Active",
    startDate: Date.now(),
    generatedAt: Date.now(),
    totalDuration: "120 Days",
    sowingSeason: "Rabi (Nov)",
    overallBudget: "₹12,000 / Acre",
    expectedHarvest: "March End",
    stages: [
        {
            stageName: "Sowing & Germination",
            approxDays: "Day 0-21",
            description: "Prepare seed bed. Treat seeds with Trichoderma. Irrigate immediately after sowing.",
            waterNeeds: "Critical (CRI Stage)",
            fertilizer: "DAP 50kg/acre",
            risks: ["Termites", "Poor Germination"],
            tasks: [
                { task: "Plough field twice", isDone: true },
                { task: "Seed Treatment", isDone: false },
                { task: "First Irrigation (CRI)", isDone: false }
            ],
            status: "active",
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000 * 21).toISOString()
        },
        {
            stageName: "Vegetative Growth",
            approxDays: "Day 22-60",
            description: "Apply first dose of Urea. Monitor for weed growth.",
            waterNeeds: "Moderate",
            fertilizer: "Urea 40kg/acre",
            risks: ["Weeds", "Yellow Rust"],
            tasks: [
                { task: "Weeding", isDone: false },
                { task: "Top Dressing (Urea)", isDone: false }
            ],
            status: "pending",
            startDate: new Date(Date.now() + 86400000 * 22).toISOString()
        }
    ],
    language: "en"
};
