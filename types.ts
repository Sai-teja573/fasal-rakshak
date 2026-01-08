

export enum AppView {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  ONBOARDING = 'ONBOARDING',
  DIAGNOSIS = 'DIAGNOSIS',
  CROP_PLANNER = 'CROP_PLANNER',
  MARKET_INTELLIGENCE = 'MARKET_INTELLIGENCE', 
  RESULTS = 'RESULTS',
  SOIL_RESULTS = 'SOIL_RESULTS',
  HISTORY = 'HISTORY',
  MARKET = 'MARKET',
  PROFILE = 'PROFILE',
  ADMIN = 'ADMIN',
  CHAT = 'CHAT',
  AGENT_DASHBOARD = 'AGENT_DASHBOARD',
  DRIVER_AUTH = 'DRIVER_AUTH', // Deprecated but kept for type safety in old refs
  DRIVER_DASHBOARD = 'DRIVER_DASHBOARD', 
  TRANSPORT_REQUEST = 'TRANSPORT_REQUEST' 
}

export type Language = 'en' | 'hi' | 'or' | 'te' | 'bn' | 'mr' | 'ta' | 'gu' | 'kn' | 'ml' | 'pa';

// --- NEW INTERFACE FOR CHAT DEEP LINKING ---
export interface ChatInitialContext {
    targetUser?: User;
    message?: string;
    openAiChat?: boolean;
}

export interface MandiDetails {
  name: string;
  address: string;
  place_id?: string;
  location?: { lat: number, lon: number };
}

export interface DriverDetails {
  vehicleType: 'Tractor' | 'Mini Truck' | 'Lorry' | 'Pickup';
  vehicleNumber: string;
  licenseNumber: string;
  loadCapacity: number; // in Quintals
  isVerified: boolean;
  rating: number;
  totalTrips: number;
  aadhaarNumber?: string;
  panNumber?: string;
  // New Fields for Dashboard & Payments
  bankDetails?: {
      accountNumber: string;
      ifsc: string;
      bankName?: string;
  };
  earnings?: {
      total: number;
      thisMonth: number;
      lastMonth: number;
      pendingPayout: number;
  };
}

export interface User {
  id: string;
  farmer_id: string; 
  name: string;
  email: string;
  phone?: string;
  avatar: string;
  role: 'farmer' | 'admin' | 'agent' | 'driver'; 
  status?: 'Active' | 'Blocked' | 'Pending';
  assigned_mandi?: MandiDetails; 
  driver_details?: DriverDetails; 
  agent_accuracy_score?: number; 
  preferred_languages?: Language[];
  crops_grown?: string[];
  land_size?: number;
  water_source?: 'Rainfed' | 'Borewell' | 'Canal' | 'Drip' | 'Unknown';
  weather_mode?: 'online' | 'sensor';
  iot_config?: IotConfig;
  crop_portfolio?: CropPortfolioItem[];
  location?: {
    lat: number;
    lon: number;
    district?: string;
    state?: string;
  };
  usage: {
    scans_this_month: number;
    last_reset_date: number;
  };
  plan_id?: string;
}

export interface TransportJob {
  id: string;
  farmerId: string;
  farmerName: string;
  crop: string;
  weight: number; // Quintals
  pickupLocation: string;
  dropLocation: string;
  distanceKm: number;
  vehicleType: string;
  status: 'Open' | 'Accepted' | 'In-Transit' | 'Completed';
  offeredPrice: number;
  driverId?: string;
  createdAt: number;
  
  // Negotiation Logic
  negotiationStatus?: 'None' | 'Pending' | 'Accepted' | 'Rejected';
  counterPrice?: number;
  farmerPhone?: string; // For chat simulation
}

// --- CHAT INTERFACES ---

export interface ChatRoom {
  id: string;
  is_group: boolean;
  name?: string; // For groups
  group_avatar?: string;
  created_at: number;
  updated_at: number;
  participants: string[]; // User IDs
  last_message?: string;
  last_message_type?: 'text' | 'image' | 'video' | 'audio' | 'report' | 'document' | 'location' | 'system';
  last_message_time?: number;
  last_message_sender_id?: string;
  unread_count?: number;
  is_muted?: boolean;
  is_pinned?: boolean;
  description?: string; // Group description or User bio
  /* Added missing usage property to satisfy UI requirements in search results and list items */
  other_user?: { // For 1:1 display convenience
      name: string;
      avatar: string;
      id: string;
      farmer_id: string;
      phone?: string;
      about?: string;
      email?: string;
      role?: string;
      location?: {
          district?: string;
          state?: string;
      };
      crops_grown?: string[];
      usage?: {
          scans_this_month: number;
          last_reset_date: number;
      };
  };
  member_count?: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string; // Text content or Caption
  type: 'text' | 'image' | 'video' | 'audio' | 'report' | 'document' | 'location' | 'system';
  media_url?: string;
  media_duration?: number; // For audio/video in seconds
  report_data?: { // For sharing a crop report
      title: string;
      severity: string;
      diagnosisId: string;
      imageUrl?: string;
  };
  created_at: number;
  read_by: string[];
  status: 'sent' | 'delivered' | 'read';
  reply_to?: {
      id: string;
      sender_name: string;
      content: string;
      type: string;
  };
}

export interface CallSignal {
  type: 'offer' | 'answer' | 'candidate' | 'end';
  sdp?: any;
  candidate?: any;
  roomId: string;
  senderId: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  limits: {
    max_scans: number;
    allow_weather: boolean;
    allow_expert_chat: boolean;
    allow_market_history: boolean;
    priority_support: boolean;
  };
  recommended: boolean;
  max_diagnoses?: number; // Added for compatibility with legacy components
}

export interface WeatherDay {
  date: string;
  temp: number;
  condition: string;
}

export interface WeatherContext {
  ai_string: string;
  display: {
    location: string;
    temp: number;
    rh: number;
    condition: string;
    wind_spd: number;
    pressure: number;
    soil_moisture: string;
    last_rain: string;
    is_raining_now: boolean;
    history: WeatherDay[];
  };
  isOffline: boolean;
}

export interface MediaPart {
  mimeType: string;
  data: string;
}

export interface DiagnosticQuestion {
  id: string;
  question: string;
  context?: string;
  options?: string[];
}

export interface DebateLog {
  round: number;
  agent: string;
  role: string;
  text: string;
  timestamp: number;
}

export interface VideoRecommendation {
  title: string;
  url: string;
  thumbnail: string;
}

export interface StoreLocation {
  name: string;
  address: string;
  rating: string;
  uri: string;
  type?: 'Govt' | 'Online' | 'Local';
  verified?: boolean;
}

export interface SpraySchedule {
  diagnosisId: string;
  medicine: string;
  dueDate: number;
  completed: boolean;
  crop: string;
}

export interface DiagnosisResponse {
  diagnosis_id: string;
  scanId: string;
  timestamp: number;
  isOffline?: boolean;
  
  crop_identified: string;
  plantType?: string;
  plantTypeScientific?: string;
  condition?: string;

  disease_name_en: string;
  diagnosis?: string;
  diagnosisScientific?: string;
  disease_name_local: string;
  severity: string;
  confidence: number;
  health_score: number;

  description: string;
  causeAnalysis?: string;
  visualSymptoms?: string[];
  affectedAreas?: string[];

  treatment_advisory: {
    summary: string;
    chemical_option: {
      product_name: string;
      dosage: string;
      application: string;
      detailed_instructions: string;
      activeIngredient?: string;
      frequency?: string;
    };
    organic_option: {
      product_name: string;
      dosage: string;
      application: string;
      detailed_instructions: string;
      materials?: string[];
    };
    cultural_practices?: string;
  };

  dosage_guide?: {
    instruction: string;
    frequency: string;
    waterRequirement: string;
  };
  
  cost_analysis?: {
    totalCostRange: string;
    costPerAcre: string;
    medicineQuantity: string;
    labourEstimate: string;
    costBreakdown: string[];
  };

  isValidFollowUp?: boolean;
  parentId?: string;
  daysSinceLastScan?: number;
  comparisonAnalysis?: {
    progressStatus: string;
    improvementPercentage: number;
    symptomsResolved: string[];
    symptomsRemaining: string[];
    newSymptoms?: string[];
    visualChanges?: string[];
    previousCondition?: string;
    currentCondition?: string;
  };
  treatmentAnalysis?: {
    treatmentName: string;
    effectivenessReason: string;
    methodUsed?: string;
    effectiveness?: string;
    userComplianceNotes?: string;
  };
  prognosis?: any;
  farmerGuidance?: any;
  followUpRecommendations?: any;

  reason?: string;
  detectedPlantType?: string;
  expectedPlantType?: string;
  message?: string;
  guidance?: string;

  local_language_output: string;
  translations?: Record<string, DiagnosisResponse>;

  organicSolutions?: any[];
  chemicalSolutions?: any[];
  preventiveMeasures?: string[];
  environmentalFactors?: string[];
  environmental_analysis?: string;
  criticalActions?: any[];
  monitoringSchedule?: string;
  costEstimate?: string;
  expectedRecoveryTime?: string;
  
  friendly_summary?: {
      en: string;
      local?: string;
  };
  user_answers?: Record<string, string>;
  preliminary_questions?: DiagnosticQuestion[];
  imageUrl?: string;
  market_trend_graph?: { date: string, price: number }[];
  buy_links?: { title: string, uri: string, source: string }[];
  
  debate_transcript?: string;
  debate_rounds?: DebateLog[];
  youtube_videos?: VideoRecommendation[];
  spray_schedule?: SpraySchedule;
  next_checkup_date?: string;
  disease_bounding_box?: { ymin: number, xmin: number, ymax: number, xmax: number };
  
  feedback_rating?: number;
  feedback_notes?: string;
  follow_ups?: string[];
}

export interface SoilAnalysisResponse {
  id: string;
  timestamp: number;
  scanId: string;
  
  soilType: string;
  soilColor?: string;
  textureDescription?: string;
  phLevel: string;
  organicMatter?: string;
  salinityRisk?: string;
  moistureRetention?: string;
  
  nutrients: {
    nitrogen: string;
    phosphorus: string;
    potassium: string;
    micronutrients?: string;
  };
  
  healthScore: number;
  confidence: number;
  
  recommendations: {
    fertilizers: string[];
    crops: string[];
    amendments: string[];
    practices?: string[];
  };
  
  visualObservations: string[];
  reportSummary: string;
  
  // Metadata
  location?: string;
  govt_data_reference?: string; 
  imageUrl?: string;
  
  // Translation
  local_language_output: string;
  translations?: Record<string, SoilAnalysisResponse>;
  
  // NEW: Media
  youtube_videos?: VideoRecommendation[];
}

export interface MarketItem {
  crop: string;
  price: string; // e.g. "₹2000/q"
  trend: 'up' | 'down' | 'stable';
  last_updated: string;
  mandi?: string;
  history?: { date: string, price: number }[];
  // Intelligence Fields
  confidence?: 'High' | 'Medium' | 'Low';
  min_price?: string;
  max_price?: string;
  modal_price?: string;
  advice?: 'Sell Now' | 'Hold' | 'Wait';
  advice_reason?: string;
  change?: string; // e.g. "₹50 (2.4%)"
  distance?: string; // e.g. "12km"
}

export interface NearbyAlert {
  id: string;
  crop: string;
  disease: string;
  distanceKm: number;
  timestamp: number;
  location: string;
}

export interface ApiLog {
  id: string;
  timestamp: number;
  service: string;
  status: 'success' | 'error';
  latencyMs: number;
  errorMessage?: string;
  requestSnippet?: string;
  responseSnippet?: string;
  model?: string;
}

export type TranslationProvider = 'Gemini' | 'OpenRouter';

export interface CustomLink {
    title: string;
    uri: string;
    source: 'Amazon' | 'Flipkart' | 'Other';
}

export interface CustomCropLink {
    id: string;
    crop: string;
    links: CustomLink[];
}

export interface ApiControlSettings {
    forceCacheMode: boolean;
    dashboardProvider: 'OpenRouter' | 'Gemini';
    forceMockMode?: boolean;
}

export interface CropImageDef {
    id: string;
    name_en: string;
    category: 'Cereal' | 'Vegetable' | 'Fruit' | 'Pulse' | 'Cash Crop' | 'Spice';
    image: string;
}

export interface AppConfig {
    showCouncilLog: boolean;
    customLinks: CustomCropLink[];
    cropImages: CropImageDef[];
    translationProvider: TranslationProvider;
    apiControl?: ApiControlSettings;
}

export interface CMSContent {
    hero: {
        title_line1: string;
        title_line2: string;
        subtitle: string;
        cta_primary: string;
        cta_secondary: string;
    };
    vision: {
        title: string;
        description: string;
    };
    features: {
        step1_title: string;
        step1_desc: string;
        step2_title: string;
        step2_desc: string;
        step3_title: string;
        step3_desc: string;
    };
    contact: {
        email: string;
        phone: string;
        address: string;
    };
    images: {
        login_bg: string;
        hero_bg_pattern: string;
        simulator_screen: string;
        landing_bg: string;
    };
    logos: {
        main: string;
        navbar: string;
        favicon: string;
        pwa: string;
    };
    links: {
        twitter: string;
        linkedin: string;
        instagram: string;
    };
}

export interface OfflineModel {
    id: string;
    name: string;
    size: string;
    description: string;
    accuracy: string;
    speed: string;
}

export interface SensorData {
    soil_moisture: number;
    temperature: number;
    humidity: number;
    ph: number;
    leaf_wetness: number;
    timestamp: number;
}

export interface IotConfig {
    api_key: string;
    topic: string;
    broker_url: string;
    last_connected?: number;
}

export interface CropPortfolioItem {
    crop: string;
    sowingDate?: string;
    area?: number;
    variety?: string;
}

export interface NewsItem {
    id: string;
    title: string;
    summary: string;
    full_content?: string;
    source: string;
    timestamp: string;
    impact: 'positive' | 'negative' | 'neutral';
    tags: string[];
    url?: string;
    image_url?: string;
}

export interface Scheme {
    id: string;
    name: string;
    provider: string; // Central or State
    benefit: string;
    status: 'active' | 'closed';
    link?: string;
    full_details?: string;
    youtube_videos?: VideoRecommendation[];
}

export interface Comment {
    id: string;
    author: string;
    author_avatar?: string;
    text: string;
    timestamp: string;
    replies: Comment[];
}

export interface CommunityPost {
    id: string;
    author: string;
    author_id?: string;
    author_avatar?: string;
    author_loc?: string;
    content: string;
    image_url?: string;
    likes: number;
    isLiked?: boolean;
    replies: number;
    commentsList?: Comment[];
    timestamp: string;
    tags: string[];
    comments_count?: number;
    likes_count?: number;
}

export interface FarmingGuide {
    id: string;
    title: string;
    crop: string;
    category: string;
    content: string;
    read_time: string;
    isOfflineReady: boolean;
    video_links?: { title: string, url: string }[];
    audio_summary?: string;
}

export interface DailyFarmerReport {
    date: string;
    summary: string;
    tasks: string[];
    market_alert?: string;
}

export interface DisasterAlert {
    id: string;
    type: 'Weather' | 'Pest' | 'Disease';
    title: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
    timestamp: number;
    source: string;
}

export interface Recommendation {
    id: string;
    title: string;
    description: string;
    type: 'Action' | 'Product' | 'Tip';
    crop?: string;
}

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: 'alert' | 'recommendation' | 'reminder' | 'system';
    severity?: 'critical' | 'warning' | 'info';
    timestamp: number;
    read: boolean;
    actionLabel?: string;
    actionLink?: string;
}

export interface KVKAdvisory {
    id: string;
    district: string;
    content: string;
    date: string;
    source: string;
}

// --- CROP PLANNER INTERFACES ---

export interface CropRecommendation {
    id: string;
    cropName: string;
    category: 'Best' | 'Possible' | 'Avoid';
    suitabilityScore: number; // 0-100
    reasoning: string; // Why this categorization? (e.g. "Excellent soil match, high market price")
    estimatedYield: string;
    estimatedIncome: string;
    riskFactors: string[];
    costLevel: 'Low' | 'Medium' | 'High';
    durationMonths: number;
}

export interface CropStageTask {
    task: string;
    isDone: boolean;
}

export interface CropStage {
    stageName: string; // e.g. Sowing, Vegetative
    approxDays: string; // e.g. "Day 0-15"
    description: string; 
    waterNeeds: string;
    fertilizer: string;
    risks: string[]; 
    tasks: CropStageTask[];
    videoKeyword?: string; 
    videos?: VideoRecommendation[]; // Updated to allow multiple videos
    aiVideoUrl?: string; 
    
    // NEW FIELDS
    status: 'pending' | 'active' | 'completed';
    startDate?: string; // ISO String calculated from plan start date
    endDate?: string;
}

export interface DetailedCropPlan {
    id: string; // Unique ID for saving
    user_id?: string;
    cropName: string;
    variety?: string; // Added for UI display
    status: 'Active' | 'Completed' | 'Draft';
    startDate: number; // User Selected Start Date
    generatedAt: number;
    totalDuration: string;
    sowingSeason: string;
    stages: CropStage[];
    overallBudget: string;
    expectedHarvest: string;
    savedDealers?: StoreLocation[]; // Persisted dealers list for this plan
    language?: string; // Language code the plan was generated in
}
