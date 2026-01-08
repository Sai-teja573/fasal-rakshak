
import { DiagnosisResponse, Language } from "../../types";

export const mapResponseToAppStructure = (data: any, lang: string): DiagnosisResponse => {
  if (!data) return {} as DiagnosisResponse;

  return {
    diagnosis_id: crypto.randomUUID(),
    scanId: data.scanId || `SCAN_${Date.now()}`,
    timestamp: Date.now(),

    next_checkup_date: data.nextCheckupDate || "3 days",

    crop_identified: data.plantType || data.detectedPlantType || "Unknown Crop",
    plantType: data.plantType,
    plantTypeScientific: data.plantTypeScientific,
    condition: data.condition,

    disease_name_en: data.diagnosis || "Unknown Issue",
    diagnosis: data.diagnosis,
    diagnosisScientific: data.diagnosisScientific,
    disease_name_local: data.diagnosis || "Issue Detected",
    severity: data.severity || "Low",
    confidence: data.confidence,

    health_score: data.healthScore || 0,

    description: data.description || data.message,
    causeAnalysis: data.causeAnalysis,
    visualSymptoms: data.visualSymptoms,
    affectedAreas: data.affectedAreas,

    treatment_advisory: {
      summary:
        data.description ||
        data.farmerGuidance?.encouragement ||
        "Review recommendations below.",
      chemical_option: data.chemicalSolutions?.[0]
        ? {
            product_name: data.chemicalSolutions[0].name,
            dosage: data.chemicalSolutions[0].dosage,
            application: data.chemicalSolutions[0].applicationMethod,
            detailed_instructions:
              data.chemicalSolutions[0].safetyPrecautions?.join(". "),
            activeIngredient: data.chemicalSolutions[0].activeIngredient,
            frequency: data.chemicalSolutions[0].frequency
          }
        : { product_name: "Consult Expert", dosage: "--", application: "N/A", detailed_instructions: "Consult an agricultural expert for specific advice." },
      organic_option: data.organicSolutions?.[0]
        ? {
            product_name: data.organicSolutions[0].name,
            dosage: data.organicSolutions[0].frequency,
            application: data.organicSolutions[0].description,
            detailed_instructions:
              data.organicSolutions[0].materials?.join(", "),
            materials: data.organicSolutions[0].materials
          }
        : {
            product_name: "Neem Oil / Homemade",
            dosage: "--",
            application: "Spray",
            detailed_instructions: "Apply neem oil solution as a general preventive measure."
          },
      cultural_practices: data.preventiveMeasures?.join(". ") || ""
    },

    dosage_guide: data.dosageGuide,
    cost_analysis: data.costAnalysis,

    isValidFollowUp: data.isValidFollowUp,
    daysSinceLastScan: data.daysSinceLastScan,
    comparisonAnalysis: data.comparisonAnalysis,
    treatmentAnalysis: data.treatmentAnalysis,
    prognosis: data.prognosis,
    farmerGuidance: data.farmerGuidance,
    followUpRecommendations: data.recommendations,

    reason: data.reason,
    detectedPlantType: data.detectedPlantType,
    expectedPlantType: data.expectedPlantType,
    message: data.message,
    guidance: data.guidance,

    local_language_output: lang,

    organicSolutions: data.organicSolutions,
    chemicalSolutions: data.chemicalSolutions,
    preventiveMeasures: data.preventiveMeasures,
    environmentalFactors: data.environmentalFactors,
    environmental_analysis: data.environmentalFactors?.join(", "),
    criticalActions: data.criticalActions,
    monitoringSchedule: data.monitoringSchedule,
    costEstimate: data.costEstimate,
    expectedRecoveryTime: data.expectedRecoveryTime
  };
};

export const getLanguageName = (lang: Language): string => {
  const map: Record<Language, string> = {
    en: "English",
    hi: "Hindi",
    or: "Odia",
    te: "Telugu",
    bn: "Bengali",
    mr: "Marathi",
    ta: "Tamil",
    gu: "Gujarati",
    kn: "Kannada",
    ml: "Malayalam",
    pa: "Punjabi"
  };
  return map[lang] || "English";
};
