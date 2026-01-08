
export const OFFLINE_KNOWLEDGE_BASE: Record<string, any> = {
  Rice: {
    disease: "Rice Blast",
    symptoms: ["Spindle-shaped lesions on leaves", "Grayish centers with brown margins"],
    chemical: { name: "Tricyclazole 75 WP", dosage: "0.6 g/L", method: "Spray" },
    organic: { name: "Pseudomonas fluorescens", dosage: "10 g/L", method: "Seed treatment/Spray" },
    advice: "Maintain water level. Avoid excess Nitrogen."
  },
  Wheat: {
    disease: "Yellow Rust",
    symptoms: ["Yellow powdery pustules on leaves", "Stripes of yellow spores"],
    chemical: { name: "Propiconazole 25 EC", dosage: "1 ml/L", method: "Spray" },
    organic: { name: "Neem Oil", dosage: "5 ml/L", method: "Spray" },
    advice: "Use resistant varieties. Monitor regularly."
  },
  Tomato: {
    disease: "Early Blight",
    symptoms: ["Concentric rings on leaves", "Yellowing of lower leaves"],
    chemical: { name: "Mancozeb 75 WP", dosage: "2.5 g/L", method: "Spray" },
    organic: { name: "Copper Oxychloride", dosage: "3 g/L", method: "Spray" },
    advice: "Remove infected leaves. Improve air circulation."
  },
  Potato: {
    disease: "Late Blight",
    symptoms: ["Water-soaked spots", "White fungal growth on undersides"],
    chemical: { name: "Metalaxyl + Mancozeb", dosage: "2.5 g/L", method: "Spray" },
    organic: { name: "Trichoderma viride", dosage: "Soil Application", method: "Mix with manure" },
    advice: "Earth up properly. Avoid overhead irrigation."
  },
  Cotton: {
    disease: "Leaf Curl Virus",
    symptoms: ["Curling of leaves", "Thickened veins"],
    chemical: { name: "Imidacloprid (for vector)", dosage: "0.5 ml/L", method: "Spray" },
    organic: { name: "Neem Oil", dosage: "5 ml/L", method: "Spray" },
    advice: "Control whitefly population. Use resistant seeds."
  },
  Maize: {
    disease: "Leaf Blight",
    symptoms: ["Boat shaped lesions", "Necrotic spots"],
    chemical: { name: "Zineb", dosage: "2.5 g/L", method: "Spray" },
    organic: { name: "Biocontrol agents", dosage: "Varies", method: "Spray" },
    advice: "Crop rotation. Clean cultivation."
  },
  Sugarcane: {
    disease: "Red Rot",
    symptoms: ["Reddening of internal tissue", "Alcoholic smell"],
    chemical: { name: "Carbendazim", dosage: "1 g/L", method: "Sett treatment" },
    organic: { name: "Trichoderma", dosage: "Soil Application", method: "Mix with manure" },
    advice: "Use healthy setts. Avoid water stagnation."
  },
  default: {
    disease: "General Fungal Infection",
    symptoms: ["Discoloration", "Spots", "Wilting"],
    chemical: { name: "Broad Spectrum Fungicide", dosage: "As per label", method: "Spray" },
    organic: { name: "Neem Oil", dosage: "5 ml/L", method: "Spray" },
    advice: "Ensure good drainage. Isolate infected plants."
  }
};
