export interface Vitals {
  restingHeartRate: number;
  hrv: number; // milliseconds
  sleepDuration: number; // hours
  respiratoryRate: number; // breaths/min
  spo2: number; // percentage
  activityCalories: number; // kcal
  currentHeartRate?: number; // live pulse representation
}

export interface EnvironmentData {
  weatherCondition: string;
  temperature: number; // celsius
  uvIndex: number;
  aqi: number; // Air Quality Index
  pm25: number; // µg/m³
  ozone: number; // µg/m³
  no2: number; // Nitrogen Dioxide µg/m³
  birchPollen: number; // grains/m³
  grassPollen: number; // grains/m³
  luminousFlux: number; // lux (light exposure)
}

export interface JournalSentiment {
  cognitiveLoad: number; // 0-100
  anxietyLevel: number; // 0-100
  burnoutRisk: number; // 0-100
  primaryEmotion: string;
  linguisticMarkers: string[];
  briefSummary: string;
}

export interface CoachingResponse {
  anomalyDetected: boolean;
  detectedDeviations: string[];
  predictiveInsight: string;
  customizedAdvice: string[];
  coachNudgeText: string;
  physicalThreatSystems: string[];
}

export interface RebalancePlan {
  recoveryTitle: string;
  morningProtocol: string;
  afternoonProtocol: string;
  eveningProtocol: string;
  biofeedbackReasoning: string;
}

export interface PresetScenario {
  name: string;
  description: string;
  vitals: Vitals;
  environment: EnvironmentData;
  journalText: string;
}
