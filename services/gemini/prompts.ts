
export const RAG_CONTEXT = `
    [SYSTEM: Fasal Rakshak Agriculture Context]
    You are a specialized agronomy model for Indian crops.
    Use visual patterns + weather + land size.
    Known patterns include Rice Blast, Wheat Rust, Early Blight, Bacterial Wilt, Stem Borer, etc.
    Focus on precise, practical advice for small and medium farmers.
`;

export const BASE_INSTRUCTION = `
    ${RAG_CONTEXT}
    You are an expert agricultural AI assistant helping farmers monitor crop health.
    RESPONSE FORMAT: JSON ONLY. No Markdown, no explanations.
`;

export const getFirstTimeTemplate = (targetLanguage: string, landSizeStr: string) => `
    For FIRST-TIME DIAGNOSIS, output JSON:
    {
      "scanId": "unique id",
      "plantType": "crop name",
      "plantTypeScientific": "scientific name",
      "condition": "healthy/diseased",
      "diagnosis": "disease/pest name or 'healthy'",
      "diagnosisScientific": "scientific name (if any)",
      "severity": "none/low/medium/high/critical",
      "confidence": 85,
      "healthScore": 65,
      "affectedAreas": ["leaves", "stem"],
      "visualSymptoms": ["symptom1", "symptom2"],
      "description": "short farmer-friendly description in ${targetLanguage}",
      "causeAnalysis": "short explanation of cause in ${targetLanguage}",
      "organicSolutions": [{
        "name": "",
        "description": "",
        "frequency": "",
        "materials": []
      }],
      "chemicalSolutions": [{
        "name": "",
        "activeIngredient": "",
        "dosage": "e.g. 2ml/L",
        "applicationMethod": "",
        "frequency": "",
        "safetyPrecautions": []
      }],
      "dosageGuide": {
        "instruction": "Specific mixing instruction for ${landSizeStr}",
        "frequency": "How often to spray",
        "waterRequirement": "Total water needed for ${landSizeStr}"
      },
      "costAnalysis": {
        "totalCostRange": "₹200–₹300",
        "costPerAcre": "₹200",
        "medicineQuantity": "Amount needed for ${landSizeStr}",
        "labourEstimate": "e.g. 1 person for 2 hours",
        "costBreakdown": ["Medicine: ₹150", "Labor: ₹100"]
      },
      "preventiveMeasures": [],
      "environmentalFactors": [],
      "expectedRecoveryTime": "",
      "monitoringSchedule": "",
      "criticalActions": [],
      "costEstimate": "",
      "nextCheckupDate": "e.g. 3 days"
    }
`;

export const getFollowUpTemplate = () => `
    For FOLLOW-UP DIAGNOSIS, output JSON:
    {
      "scanId": "unique id",
      "isValidFollowUp": true/false,
      "plantMatchConfidence": 95,
      "daysSinceLastScan": 7,
      "healthScore": 78,
      "comparisonAnalysis": {
        "previousCondition": "",
        "currentCondition": "",
        "progressStatus": "improved/stable/worsened",
        "improvementPercentage": 65,
        "visualChanges": [],
        "symptomsResolved": [],
        "symptomsRemaining": [],
        "newSymptoms": []
      },
      "treatmentAnalysis": {
        "methodUsed": "organic/chemical/mixed/none",
        "treatmentName": "",
        "effectiveness": "effective/ineffective/partial",
        "effectivenessReason": "",
        "userComplianceNotes": ""
      },
      "recommendations": {
        "continueCurrentTreatment": true/false,
        "adjustments": [],
        "nextSteps": [{ "action": "", "timing": "", "priority": "" }],
        "additionalTreatments": [],
        "whatToWatch": []
      },
      "prognosis": {
        "currentSeverity": "low/medium/high/critical",
        "estimatedRecoveryTime": "e.g. 5-7 days",
        "expectedOutcome": "full recovery/partial recovery/risk of loss",
        "confidenceLevel": 90
      },
      "farmerGuidance": {
        "positivePoints": [],
        "concerns": [],
        "encouragement: "",
        "nextScanRecommended": ""
      },
      "nextCheckupDate": "e.g. 5 days"
    }
`;

export const getCropRecommenderTemplate = (lang: string) => `
    [SYSTEM: Expert Crop Planning Officer]
    Analyze the provided soil, weather, location, and market data.
    Recommend crops suitable for this specific farmer.
    
    CRITICAL: Use simple, encouraging language in ${lang}. Avoid technical jargon.
    
    Output JSON:
    [
        {
            "id": "c1",
            "cropName": "Crop Name",
            "category": "Best" | "Possible" | "Avoid",
            "suitabilityScore": 90,
            "reasoning": "Reason in ${lang} (e.g. Good for your soil, price is high)",
            "estimatedYield": "e.g. 20-25 Quintals/Acre",
            "estimatedIncome": "e.g. ₹40,000 - ₹50,000",
            "riskFactors": ["Risk 1 in ${lang}", "Risk 2 in ${lang}"],
            "costLevel": "Low" | "Medium" | "High",
            "durationMonths": 4
        }
    ]
`;

export const getDetailedPlanTemplate = (lang: string) => `
    [SYSTEM: Senior Agronomist]
    Create a complete crop calendar for the selected crop.
    Break it down into agronomic stages from Sowing to Harvest.
    
    Language: ${lang}.
    
    Output JSON:
    {
        "cropName": "Crop Name",
        "generatedAt": ${Date.now()},
        "totalDuration": "e.g. 120 Days",
        "sowingSeason": "e.g. Kharif (June-July)",
        "overallBudget": "e.g. ₹15,000 per acre",
        "expectedHarvest": "e.g. October End",
        "stages": [
            {
                "stageName": "Stage Name (e.g. Seedling/Transplanting)",
                "approxDays": "Day 0-10",
                "description": "Step-by-step instructions in simple ${lang}",
                "waterNeeds": "e.g. Keep 2cm standing water",
                "fertilizer": "e.g. Basal dose of NPK",
                "risks": ["Risk 1"],
                "videoKeyword": "Exact search query for this stage in ${lang} (e.g. 'Rice transplanting technique hindi')",
                "tasks": [
                    { "task": "Actionable task 1", "isDone": false }
                ]
            }
        ]
    }
`;
