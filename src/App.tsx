import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Sparkles,
  Brain,
  Wind,
  Sun,
  Thermometer,
  Zap,
  TrendingUp,
  MapPin,
  CheckCircle,
  FileText,
  AlertTriangle,
  RefreshCw,
  Eye,
  Settings2,
  Heart,
  Droplet,
  Compass,
  Smile,
  Frown,
  Meh,
  Bell,
  BellOff,
  User
} from "lucide-react";
import { Vitals, EnvironmentData, JournalSentiment, CoachingResponse, RebalancePlan, PresetScenario } from "./types";
import { fetchLiveEnvironment } from "./utils/environmentalApi";
import { DigitalTwinVisualization } from "./components/DigitalTwinVisualization";
import { CaregiverDyadMonitor } from "./components/CaregiverDyadMonitor";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine
} from "recharts";

// Baseline Standard ranges
const CONST_BASELINES: Vitals = {
  restingHeartRate: 58,
  hrv: 62,
  sleepDuration: 7.8,
  respiratoryRate: 14,
  spo2: 98,
  activityCalories: 500,
};

// Preset Scenarios to enable deep exploration of the "Digital Twin" correlations
const PRESETS: PresetScenario[] = [
  {
    name: "Optimal Homeostasis (Balance)",
    description: "Your vitals are in the perfect zone. Perfect weather and clean outdoor indexes match high mental energy.",
    vitals: {
      restingHeartRate: 57,
      hrv: 65,
      sleepDuration: 8.0,
      respiratoryRate: 14,
      spo2: 99,
      activityCalories: 550,
    },
    environment: {
      weatherCondition: "Clear Sky",
      temperature: 20.5,
      uvIndex: 2.1,
      aqi: 22,
      pm25: 5.5,
      ozone: 28.0,
      no2: 8.0,
      birchPollen: 2,
      grassPollen: 1,
      luminousFlux: 35000,
    },
    journalText: "Woke up feeling light and refreshed after solid sleep. Ready to tackle isometrics and focus deeply on product engineering."
  },
  {
    name: "Wildfire & Allergic Air Load",
    description: "PM2.5 levels spike high from nearby wildfires. High grass pollen triggers respiratory load and lowers sleep recovery.",
    vitals: {
      restingHeartRate: 61,
      hrv: 51,
      sleepDuration: 6.8,
      respiratoryRate: 17, // elevation
      spo2: 96,
      activityCalories: 280,
    },
    environment: {
      weatherCondition: "Hazy & Hot",
      temperature: 28.2,
      uvIndex: 6.5,
      aqi: 142, // high
      pm25: 55.4, // warning
      ozone: 68.0,
      no2: 22.0,
      birchPollen: 15,
      grassPollen: 125, // allergy warning
      luminousFlux: 72000,
    },
    journalText: "My lungs feel slightly heavy today and my throat is dry. Woke up twice in the night coughing, keeping air filters on high."
  },
  {
    name: "Severe Strain & Overtrained Sleep Deficit",
    description: "Extremely low HRV & elevated resting HR from bad sleep and high workload stress. High burnout risk.",
    vitals: {
      restingHeartRate: 68, // high +10 compared to baseline
      hrv: 32, // severe HRV crash
      sleepDuration: 4.8, // sleep loss
      respiratoryRate: 15,
      spo2: 97,
      activityCalories: 720,
    },
    environment: {
      weatherCondition: "Overcast / Cold",
      temperature: 11.4,
      uvIndex: 0.8,
      aqi: 35,
      pm25: 8.0,
      ozone: 30.0,
      no2: 12.0,
      birchPollen: 1,
      grassPollen: 0,
      luminousFlux: 1200, // low light exposure
    },
    journalText: "Completely exhausted. Staying up late finishing code releases and waking up early to back-to-back client calls. Brain is absolute fog."
  }
];

export default function App() {
  // 1. Core States
  const [vitals, setVitals] = useState<Vitals>(CONST_BASELINES);
  const [environment, setEnvironment] = useState<EnvironmentData>({
    weatherCondition: "Partly Cloudy",
    temperature: 21.0,
    uvIndex: 3.2,
    aqi: 45,
    pm25: 12.0,
    ozone: 35.0,
    no2: 14.5,
    birchPollen: 5,
    grassPollen: 8,
    luminousFlux: 24000,
  });
  const [journalText, setJournalText] = useState<string>("My morning routine went well, but I've been feeling slightly fatigued in the late afternoon. Sleep was fairly good but had intense dreams.");
  const [journalSentiment, setJournalSentiment] = useState<JournalSentiment | null>(null);
  
  // Baselines (Fully adjustable)
  const [baselines, setBaselines] = useState<Vitals>(CONST_BASELINES);

  // Dynamic alert thresholds
  const [rebalanceThreshold, setRebalanceThreshold] = useState<number>(75);
  const [useAiThreshold, setUseAiThreshold] = useState<boolean>(true);
  const [hasAutoAlerted, setHasAutoAlerted] = useState<boolean>(false);
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [historyTab, setHistoryTab] = useState<"balance" | "nervous" | "environment">("balance");
  const [activePortalTab, setActivePortalTab] = useState<"twin" | "dyad">("dyad");

  // System Alerts & Browser Notifications Engine
  const [notificationsSupported, setNotificationsSupported] = useState<boolean>(false);
  const [notificationsPermission, setNotificationsPermission] = useState<string>("default");
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [wasBelowFloor, setWasBelowFloor] = useState<boolean>(false);
  const [inAppAlerts, setInAppAlerts] = useState<Array<{ id: string; title: string; text: string; score: number; floor: number }>>([]);

  // 2. AI Execution results
  const [coachingResult, setCoachingResult] = useState<CoachingResponse | null>(null);
  const [rebalancePlan, setRebalancePlan] = useState<RebalancePlan | null>(null);

  // 3. Technical & Telemetry state tracking
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(true);
  const [isLiveEnvLoaded, setIsLiveEnvLoaded] = useState<boolean>(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "coordinating" | "success" | "denied" | "error">("idle");
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Loader animations states
  const [loadingCoach, setLoadingCoach] = useState<boolean>(false);
  const [loadingSentiment, setLoadingSentiment] = useState<boolean>(false);
  const [loadingRebalance, setLoadingRebalance] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check backend server availability & gemini key at startup
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setGeminiConfigured(!!data.geminiConfigured);
      })
      .catch((err) => {
        console.warn("Backend not ready yet, using offline demo model states.", err);
        setGeminiConfigured(false);
      });
  }, []);

  // Check browser Notification support on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsSupported(true);
      setNotificationsPermission(Notification.permission);
      const isStoredEnabled = localStorage.getItem("balance_notifications") === "true";
      if (Notification.permission === "granted" && isStoredEnabled) {
        setNotificationsEnabled(true);
      } else {
        setNotificationsEnabled(isStoredEnabled);
      }
    } else {
      setNotificationsSupported(false);
      setNotificationsEnabled(localStorage.getItem("balance_notifications") === "true");
    }
  }, []);

  // Live HR pulsing simulator display
  const [livePulse, setLivePulse] = useState<number>(68);
  useEffect(() => {
    const rhr = vitals.restingHeartRate;
    const interval = setInterval(() => {
      // Simulate light fluctuations around current resting heart rate
      const deviation = Math.sin(Date.now() / 3000) * 3;
      setLivePulse(Math.round(rhr + deviation));
    }, 1500);
    return () => clearInterval(interval);
  }, [vitals.restingHeartRate]);

  // Load preset scenario
  const applyPreset = (preset: PresetScenario) => {
    setVitals(preset.vitals);
    setEnvironment(preset.environment);
    setJournalText(preset.journalText);
    setJournalSentiment(null);
    setCoachingResult(null);
    setRebalancePlan(null);
    setErrorMessage(null);
    setHasAutoAlerted(false);
  };

  // Algorithmically compute instantaneous "Autonomic Balance Score" out of 100
  const calculateBalanceScore = () => {
    let score = 100;

    // A. Resting HR deviation check (optimal is RHR <= baseline)
    const rhrDiff = vitals.restingHeartRate - baselines.restingHeartRate;
    const rhrPenalty = rhrDiff > 0 ? Math.round(rhrDiff * 2.2 * 10) / 10 : 0;
    score -= rhrPenalty;

    // B. HRV deviation check (lower HRV drops score immediately)
    const hrvDiff = baselines.hrv - vitals.hrv;
    const hrvPenalty = hrvDiff > 0 ? Math.round(((hrvDiff / baselines.hrv) * 35) * 10) / 10 : 0;
    score -= hrvPenalty;

    // C. Sleep deficit check (deficit from adjusted baseline duration)
    const sleepDeficit = baselines.sleepDuration - vitals.sleepDuration;
    const sleepPenalty = sleepDeficit > 0 ? Math.round(sleepDeficit * 7 * 10) / 10 : 0;
    score -= sleepPenalty;

    // D. Air Quality index load
    let aqiPenalty = 0;
    if (environment.aqi > 50) {
      aqiPenalty += (environment.aqi - 50) * 0.15;
    }
    if (environment.pm25 > 25) {
      aqiPenalty += (environment.pm25 - 25) * 0.3;
    }
    aqiPenalty = Math.round(aqiPenalty * 10) / 10;
    score -= aqiPenalty;

    // E. Allergy pollen load
    const totalAllergens = environment.birchPollen + environment.grassPollen;
    const pollenPenalty = totalAllergens > 40 ? Math.round((totalAllergens - 40) * 0.05 * 10) / 10 : 0;
    score -= pollenPenalty;

    // F. Weather & Ambient temperature shocks, extreme UV index physical workload
    let weatherPenalty = 0;
    if (environment.temperature > 28) {
      weatherPenalty += (environment.temperature - 28) * 0.5; // metabolic heat strain
    } else if (environment.temperature < 12) {
      weatherPenalty += (12 - environment.temperature) * 0.4; // thermoregulatory workload
    }
    if (environment.uvIndex > 6.0) {
      weatherPenalty += (environment.uvIndex - 6.0) * 0.8; // cellular protection load
    }
    weatherPenalty = Math.round(weatherPenalty * 10) / 10;
    score -= weatherPenalty;

    // G. Circadian luminous flux / solar light deficit
    // Inadequate bright morning/daylight representation (< 2,000 lux) induces minor autonomic degradation
    const circadianPenalty = environment.luminousFlux < 2000 ? 5 : (environment.luminousFlux < 5000 ? 2 : 0);
    score -= circadianPenalty;

    // H. Psychological stress sentiment burdens
    let sentimentPenalty = 0;
    if (journalSentiment) {
      if (journalSentiment.cognitiveLoad > 20) {
        sentimentPenalty += (journalSentiment.cognitiveLoad - 20) * 0.15;
      }
      if (journalSentiment.anxietyLevel > 15) {
        sentimentPenalty += (journalSentiment.anxietyLevel - 15) * 0.15;
      }
    }
    sentimentPenalty = Math.round(sentimentPenalty * 10) / 10;
    score -= sentimentPenalty;

    const finalScore = Math.max(10, Math.min(100, Math.round(score)));

    return {
      score: finalScore,
      rhrPenalty,
      hrvPenalty,
      sleepPenalty,
      aqiPenalty,
      pollenPenalty,
      weatherPenalty,
      circadianPenalty,
      sentimentPenalty,
      totalAllergens
    };
  };

  const scoreData = calculateBalanceScore();
  const balanceScore = scoreData.score;

  // AI-Determined vs User-defined alert threshold decision making
  const getActiveThreshold = () => {
    if (!useAiThreshold) {
      return rebalanceThreshold;
    }
    // AI automatic safety monitoring calibrates standard alert level based on immediate environmental + chronic baseline stress factors
    let alertLimit = 70;
    if (environment.aqi > 90 || environment.pm25 > 35) {
      alertLimit += 6; // heighten sensitivity under heavy particulate load
    }
    if (baselines.hrv > 50 && vitals.hrv < baselines.hrv - 15) {
      alertLimit += 5; // heighten sensitivity if HRV has dropped dramatically from normal baseline
    }
    if (vitals.sleepDuration < 5.5) {
      alertLimit += 4; // heighten sensitivity for high cognitive vulnerability sleep periods
    }
    return Math.min(85, alertLimit);
  };

  const activeThreshold = getActiveThreshold();

  // Dynamic status details for Autonomic score gauge
  const getBalanceStatusText = (sc: number) => {
    if (sc >= 85) return { label: "Optimal Homeostasis", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", barColor: "bg-emerald-400" };
    if (sc >= 65) return { label: "Compensatory Strain", color: "text-amber-400 border-amber-500/30 bg-amber-500/10", barColor: "bg-amber-400" };
    return { label: "Autonomic Instability", color: "text-rose-400 border-rose-500/30 bg-rose-500/10", barColor: "bg-rose-400" };
  };

  const balanceStatus = getBalanceStatusText(balanceScore);

  // Generate 30-day stable but reactive historical trend data for the Autonomic Balance Score
  const historicalData = useMemo(() => {
    const data = [];
    const baseDate = new Date(2026, 5, 14); // June 14, 2026
    
    // Seeded random number generator so history is stable across slider changes save for 'Today' (Day 30)
    const seedRandom = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
      };
    };

    const rand = seedRandom("homeostasis-twin-stabilizer-v1");

    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
      // Underlying physiological waves (simulating natural rest and stress periods)
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const wave = Math.sin((30 - i) / 2.5) * 6; // slow 15-day homeostatic cycle
      const noise = (rand() - 0.5) * 5;
      
      let dayScore = 0;
      let dayHrv = 0;
      let dayRhr = 0;
      let dayAqi = 0;
      let daySleep = 0;
      const dayThreshold = Math.round(activeThreshold + (isWeekend ? -2 : 1) + (rand() - 0.5) * 2);

      if (i === 0) {
        // Today reflects the active live states exactly
        dayScore = balanceScore;
        dayHrv = vitals.hrv;
        dayRhr = vitals.restingHeartRate;
        dayAqi = environment.aqi;
        daySleep = vitals.sleepDuration;
      } else {
        // Past history is reactive to today's state to prevent sudden visual disconnects, but shows historical dips
        const proximity = (30 - i) / 30; // 0 for far past, 1 for close past
        
        let baselineScore = 78 + wave + noise;
        
        // If modern state is severely crashed, project a gradual fatigue build-up in the preceding days
        if (balanceScore < 60) {
          baselineScore -= proximity * 15; // steep build-up
        } else if (balanceScore > 85) {
          baselineScore += proximity * 5;  // supercharged history
        }
        
        dayScore = Math.max(35, Math.min(100, Math.round(baselineScore)));
        
        // Correlate past vitals to make Hover states feel real & unified
        const scoreDeviation = dayScore - 75; // negative means stressed
        dayHrv = Math.max(20, Math.min(110, Math.round(baselines.hrv + scoreDeviation * 0.8 + (rand() - 0.5) * 4)));
        dayRhr = Math.max(42, Math.min(88, Math.round(baselines.restingHeartRate - scoreDeviation * 0.4 + (rand() - 0.5) * 3)));
        daySleep = Math.max(4.0, Math.min(10.0, Math.round((baselines.sleepDuration + scoreDeviation * 0.05 + (rand() - 0.5) * 0.8) * 10) / 10));
        dayAqi = Math.max(12, Math.min(150, Math.round(35 - scoreDeviation * 1.2 + (rand() - 0.5) * 12)));
      }

      data.push({
        date: dateStr,
        score: dayScore,
        hrv: dayHrv,
        rhr: dayRhr,
        aqi: dayAqi,
        sleep: daySleep,
        threshold: dayThreshold
      });
    }
    return data;
  }, [balanceScore, vitals, environment, baselines, activeThreshold]);

  // Grab user Geolocation & call our open-meteo proxy logic
  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      setErrorMessage("Geolocation is not supported by your browser frame.");
      return;
    }

    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setGeoCoords({ lat: latitude, lon: longitude });
        setGeoStatus("coordinating");
        
        try {
          const fetchedData = await fetchLiveEnvironment(latitude, longitude);
          setEnvironment(fetchedData);
          setIsLiveEnvLoaded(true);
          setGeoStatus("success");
        } catch (err) {
          console.error(err);
          setGeoStatus("error");
          setErrorMessage("Failed to acquire street-level environmental readings. Falling back to simulated controls.");
        }
      },
      (err) => {
        console.warn("Geolocation permission minimized:", err);
        setGeoStatus("denied");
      },
      { timeout: 10000 }
    );
  };

  // call /api/predictive/journal-sentiment
  const analyzeSentiment = async () => {
    if (!journalText.trim()) return;
    setLoadingSentiment(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/predictive/journal-sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalText }),
      });
      if (!res.ok) {
        throw new Error("Unable to parse linguistic markers. Check your Gemini API setup.");
      }
      const data = await res.json();
      setJournalSentiment(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze journal.");
      // Simulated response in case API key is unconfigured, ensuring robust offline play
      setJournalSentiment({
        cognitiveLoad: 45,
        anxietyLevel: 35,
        burnoutRisk: 30,
        primaryEmotion: "Tired / Ambitious",
        linguisticMarkers: ["High density of tasks", "Expression of late hours", "Cognitive load keywords"],
        briefSummary: "Slight autonomic fatigue indicators detected with mild circadian desynchronization."
      });
    } finally {
      setLoadingSentiment(false);
    }
  };

  // call /api/predictive/coach
  const fetchAiCoaching = async (currentScore?: number) => {
    setLoadingCoach(true);
    setErrorMessage(null);
    try {
      const scoreToUse = currentScore !== undefined ? currentScore : balanceScore;
      const res = await fetch("/api/predictive/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vitals,
          environment,
          journalSentiment,
          historyBaselines: baselines,
          balanceScore: scoreToUse,
          activeThreshold
        }),
      });
      if (!res.ok) {
        throw new Error("Coaching engine failed. Please try again or verify Server keys.");
      }
      const data = await res.json();
      setCoachingResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Coaching connection timed out.");
      // Satisfying full integration logic with graceful simulated feedback in fallback mode
      setCoachingResult({
        anomalyDetected: balanceScore < 75,
        detectedDeviations: balanceScore < 75 ? ["Resting Heart Rate elevation detected (+11%)", "Outdoor pm2.5 is loaded"] : ["Homeostasis maintains stable balance"],
        predictiveInsight: balanceScore < 75 
          ? "We spot a 14% autonomic balance dip today. High respiratory and sleep indices put you at higher risk for circadian crash or mid-day respiratory tightness in the next 14 hours."
          : "Your digital twin shows stable homeostasis. Autonomic system maintains robust adaptability. Continue current balanced physical load.",
        customizedAdvice: balanceScore < 75 
          ? [
              "Transition outdoor high-intensity actions to indoor low-impact breathing practices.",
              "Enable localized high-efficiency particulate air (HEPA) purification systems.",
              "Prioritize a strict 22:30 wind-down block to restore parasympathetic heart rate variability."
            ]
          : [
              "Maintain consistent daily cardio loads. Homeostatic adaptability is high.",
              "Take advantage of standard solar light parameters for biological rhythmic anchoring.",
              "Continue tracking journals around active recovery epochs."
            ],
        coachNudgeText: balanceScore < 75 
          ? `Hey! The local indoor-outdoor air index is slightly loaded, and your recovery sleep last night was sub-optimal. Based on your HRV drop to ${vitals.hrv}ms, your heart is working slightly harder today. I highly recommend shifting your outdoor track work to an indoor mobility flow to protect your cardiorespiratory zone.`
          : `High-fidelity metrics confirmed! Your biometric twin is operating fully in the homeostasis pocket today. Enjoy an energetic day, and maintain structured recovery patterns!`,
        physicalThreatSystems: balanceScore < 75 ? ["cardiovascular", "respiratory", "circadian"] : []
      });
    } finally {
      setLoadingCoach(false);
    }
  };

  // call /api/predictive/rebalance-plan
  const fetchRebalancePlan = async (currentScore?: number) => {
    setLoadingRebalance(true);
    setErrorMessage(null);
    try {
      const scoreToUse = currentScore !== undefined ? currentScore : balanceScore;
      const res = await fetch("/api/predictive/rebalance-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vitals,
          environment,
          journalSentiment,
          balanceScore: scoreToUse
        }),
      });
      if (!res.ok) {
        throw new Error("Unable to trigger neural rebalancing. Verify server connection.");
      }
      const data = await res.json();
      setRebalancePlan(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Plan recovery trigger offline.");
      const scoreToUse = currentScore !== undefined ? currentScore : balanceScore;
      setRebalancePlan({
        recoveryTitle: scoreToUse < activeThreshold ? "Parasympathetic Vagus Restorative Core" : "Homeostatic Stamina Amplification",
        morningProtocol: "Inject 15 minutes of dynamic diaphragmatic box breathing. Absorb bright light (min 10,000 lux) within 45 mins of waking to lock cortisol curves.",
        afternoonProtocol: "Skip cardiovascular sprints. Perform 20 mins of nasal-breathing zone 1 steady state. Keep environmental particulate burden below 12 µg/m³.",
        eveningProtocol: "Incorporate warm thermo-hydration therapy (magnesium beverage) paired with 5Hz binaural frequency stimulation to amplify neural delta sleep cycles.",
        biofeedbackReasoning: "Integrating high-efficiency breathing reduces carbon-dioxide loads, which instantly unburdens heart rate variability and stimulates the vagus pathway."
      });
    } finally {
      setLoadingRebalance(false);
    }
  };

  // 4. Proactive Threshold Watcher (Auto-Trigger on Breach)
  useEffect(() => {
    if (balanceScore < activeThreshold) {
      if (!hasAutoAlerted) {
        // Automatically compile recovery schedules and coach warning nudges immediately when threshold is breached
        fetchRebalancePlan(balanceScore);
        fetchAiCoaching(balanceScore);
        setHasAutoAlerted(true);
      }
    } else {
      setHasAutoAlerted(false);
    }
  }, [balanceScore, activeThreshold, hasAutoAlerted]);

  // Browser notifications toggle handler
  const toggleNotifications = async () => {
    if (!("Notification" in window)) {
      // If notifications are not supported conceptually by this legacy client browser
      const nextState = !notificationsEnabled;
      setNotificationsEnabled(nextState);
      localStorage.setItem("balance_notifications", String(nextState));
      return;
    }

    if (Notification.permission === "denied") {
      setErrorMessage("Notification permissions are blocked for this site. Please reset notification authorizations in your browser address bar.");
      return;
    }

    if (Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission();
        setNotificationsPermission(permission);
        if (permission === "granted") {
          setNotificationsEnabled(true);
          localStorage.setItem("balance_notifications", "true");
          try {
            new Notification("Floor Alerts Activated 🔔", {
              body: `Authorized. You will be alerted if your index dips below your ${activeThreshold}% safety floor.`,
              tag: "twin-notification-activated",
              silent: false
            });
          } catch (e) {
            console.warn("Could not dispatch confirmation notification:", e);
          }
        } else {
          setNotificationsEnabled(false);
          localStorage.setItem("balance_notifications", "false");
        }
      } catch (err) {
        // Handle iframe environment sandbox constraint rejecting the promise
        console.warn("Permission request failed, falling back to local simulation:", err);
        const nextState = !notificationsEnabled;
        setNotificationsEnabled(nextState);
        localStorage.setItem("balance_notifications", String(nextState));
        
        // Push a simulated welcome alert since we are in a sandbox
        const idStr = Date.now().toString();
        setInAppAlerts(prev => [
          {
            id: idStr,
            title: "🔔 Alerts Setup Status",
            text: "Sandbox frame limitation detected. Real-time browser push alerts may have browser security warnings. Enabling interactive fallback alerts instead!",
            score: balanceScore,
            floor: activeThreshold
          },
          ...prev
        ].slice(0, 3));
      }
    } else {
      // already granted, toggle state directly
      const nextState = !notificationsEnabled;
      setNotificationsEnabled(nextState);
      localStorage.setItem("balance_notifications", String(nextState));
      if (nextState) {
        try {
          new Notification("Homeostatic Watch Active", {
            body: `Threshold alerts are active starting now. Safety floor: ${activeThreshold}%.`,
            tag: "twin-notification-re-activated"
          });
        } catch (e) {
          console.warn("Web Notification display blocked in this sandbox frame:", e);
        }
      }
    }
  };

  // 5. System Warning Notifications Trigger (Transition-Authoritative)
  useEffect(() => {
    if (balanceScore < activeThreshold) {
      if (!wasBelowFloor && notificationsEnabled) {
        const title = `⚠️ System Alert: Homeostasis Floor Breached (${balanceScore}%)`;
        const body = `Autonomic score dipped below your setting (${activeThreshold}%). Respiratory rate, resting heart rate, or atmospheric burdens have heightened body stress.`;

        // Dispatch desktop notification
        if (notificationsSupported && Notification.permission === "granted") {
          try {
            new Notification(title, {
              body,
              icon: "/favicon.ico",
              tag: "balance-score-breached-alert",
              requireInteraction: true
            });
          } catch (e) {
            console.warn("Desktop notification skipped in iframe sandbox setup:", e);
          }
        }

        // Always display robust, beautiful in-app spring alert
        setInAppAlerts(prev => [
          {
            id: Date.now().toString(),
            title,
            text: `Vitals or environmental weights have exceeded active compensatory reserves. Your score of ${balanceScore}% is under the warning floor of ${activeThreshold}%. Diagnostic rebalancing recommendations loaded below.`,
            score: balanceScore,
            floor: activeThreshold
          },
          ...prev
        ].slice(0, 3));
      }
      setWasBelowFloor(true);
    } else {
      setWasBelowFloor(false);
    }
  }, [balanceScore, activeThreshold, notificationsEnabled, wasBelowFloor, notificationsSupported]);

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* 1. Header / Navigation bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 p-2.5 rounded-2xl shadow-lg shadow-teal-500/20">
              <Activity className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-bold uppercase tracking-wider text-white">HEALTH DIGITAL TWIN</h1>
                <span className="text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded px-1.5 py-0.5">V1.5 LIVE</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Predictive Al Autonomic Health Engine & Personal Baselines</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Server key state badge */}
            <div className={`flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-full border ${geminiConfigured ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Gemini Coach API: {geminiConfigured ? "CONNECTED" : "OFFLINE DEMO"}</span>
            </div>
            
            {/* Presets dropdown inline */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-xs font-mono font-medium">
              <Settings2 className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-slate-400 mr-1">Load State:</span>
              <select 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) applyPreset(PRESETS[val]);
                }} 
                defaultValue=""
                className="bg-transparent border-none text-white focus:outline-none pointer-events-auto cursor-pointer pr-4"
              >
                <option value="" disabled>Select Preset Scenario...</option>
                {PRESETS.map((p, idx) => (
                  <option key={idx} value={idx} className="bg-slate-950 text-slate-300">{p.name}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </header>

      {/* Main Grid View */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* API Warning banner */}
        {!geminiConfigured && (
          <div className="mb-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 mt-1 sm:mt-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Gemini Key Not Found in Environment Secret Storage</h4>
                <p className="text-xs text-slate-400">The server will run using expert-coded biofeedback diagnostic fallbacks. To connect real Gemini, add your <code className="font-mono text-amber-300">GEMINI_API_KEY</code> inside Settings & Secrets in real-time.</p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs text-rose-300 flex justify-between items-center">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="hover:text-white transition font-mono">Dismiss</button>
          </div>
        )}

        {/* Unified Portal Tab Controller */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-900 mb-8 max-w-lg mx-auto sm:mx-0">
          <button
            onClick={() => setActivePortalTab("twin")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 ${
              activePortalTab === "twin"
                ? "bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold shadow-lg shadow-teal-500/10"
                : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <Activity className="w-4 h-4" />
            Biometric Twin
          </button>
          <button
            onClick={() => setActivePortalTab("dyad")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 ${
              activePortalTab === "dyad"
                ? "bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold shadow-lg shadow-teal-500/10"
                : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <User className="w-4 h-4" />
            Caregiver-Mother Dyadic Hub
          </button>
        </div>

        {activePortalTab === "dyad" ? (
          <CaregiverDyadMonitor
            vitals={vitals}
            setVitals={setVitals}
            baselines={baselines}
            setBaselines={setBaselines}
            environment={environment}
            setEnvironment={setEnvironment}
            balanceScore={balanceScore}
            activeThreshold={activeThreshold}
            inAppAlerts={inAppAlerts}
            setInAppAlerts={setInAppAlerts}
          />
        ) : (
          <>
            {/* BENTO GRID SCHEMATIC */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* COLUMN 1 (4 cols): Digital Twin Visual Map + Environment Load */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Visual Human representation */}
            <div className="flex-1 min-h-[460px]">
              <DigitalTwinVisualization
                vitals={vitals}
                environment={environment}
                journalSentiment={journalSentiment}
                baselines={baselines}
                threatSystems={coachingResult?.physicalThreatSystems || []}
              />
            </div>

            {/* Weather / Light / Pollution environment card */}
            <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-display font-semibold text-white flex items-center gap-2">
                  <Wind className="w-4 h-4 text-teal-400" />
                  Sensory Environment Load
                </h3>
                
                <button
                  onClick={requestUserLocation}
                  disabled={geoStatus === "requesting" || geoStatus === "coordinating"}
                  className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 bg-teal-500/10 text-teal-400 hover:bg-teal-500 hover:text-slate-950 rounded-full transition disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {geoStatus === "idle" && "Pull Live Data"}
                  {geoStatus === "requesting" && "Checking GPS..."}
                  {geoStatus === "coordinating" && "Aggregating Open-Meteo..."}
                  {geoStatus === "success" && "Synced Live Location!"}
                  {geoStatus === "denied" && "GPS Blocked"}
                  {geoStatus === "error" && "API Retry"}
                </button>
              </div>

              {geoCoords && (
                <p className="text-[9px] font-mono text-slate-500 -mt-3 mb-3">
                  Geo coordinates mapped: Lat {geoCoords.lat.toFixed(4)}, Lon {geoCoords.lon.toFixed(4)}
                </p>
              )}

              {/* Grid indices */}
              <div className="grid grid-cols-2 gap-3 text-slate-300">
                
                <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Sun className="w-4 h-4 text-[#fbbf24]" />
                    <span className="text-[10px] text-slate-400 font-mono">UV Index</span>
                  </div>
                  <p className="text-lg font-mono font-bold leading-tight">{environment.uvIndex}</p>
                  <span className="text-[9px] text-slate-500 uppercase">{environment.uvIndex > 6 ? "High Protection Required" : "Standard Outdoor Level"}</span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    <span className="text-[10px] text-slate-400 font-mono">Local Temp</span>
                  </div>
                  <p className="text-lg font-mono font-bold leading-tight">{environment.temperature}°C</p>
                  <span className="text-[9px] text-slate-500 uppercase truncate block">{environment.weatherCondition}</span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] text-slate-400 font-mono">Outdoor AQI</span>
                  </div>
                  <p className={`text-lg font-mono font-bold leading-tight ${environment.aqi > 100 ? 'text-rose-400' : 'text-emerald-400'}`}>{environment.aqi}</p>
                  <span className="text-[9px] text-slate-500 uppercase">PM2.5: {environment.pm25} µg/m³</span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span className="text-[10px] text-slate-400 font-mono">Luminous Flux</span>
                  </div>
                  <p className="text-lg font-mono font-bold leading-tight">{environment.luminousFlux}</p>
                  <span className="text-[9px] text-slate-500 uppercase">Lux (Circadian Lock)</span>
                </div>

              </div>

              {/* Allergen details */}
              <div className="mt-3 pt-3 border-t border-slate-900/60">
                <span className="text-[10px] font-mono text-slate-500 block mb-1.5 uppercase">Allergen Particle Count (Street-Level)</span>
                <div className="flex gap-4 text-xs font-mono">
                  <span className="text-slate-400">Grass Pollen: <strong className={environment.grassPollen > 50 ? "text-amber-400" : "text-slate-100"}>{environment.grassPollen} gr/m³</strong></span>
                  <span className="text-slate-400">Birch Pollen: <strong className="text-slate-100">{environment.birchPollen} gr/m³</strong></span>
                </div>
              </div>

            </div>

          </div>

          {/* COLUMN 2 (4 cols): Simulated Wearable Vitals Matrix */}
          <div className="lg:col-span-4 bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col justify-between gap-6">
            
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-xs font-mono text-teal-400 tracking-wider">AGGREGATOR FEED</span>
                  <h3 className="text-md font-display font-semibold text-white">Wearable Telemetries</h3>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5 text-xs text-rose-500 font-mono">
                    <Heart className="w-3.5 h-3.5 animate-heartbeat text-rose-500" />
                    <span>Live Pulse: {livePulse} bpm</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Unified aggregates (Oura, Garmin)</span>
                </div>
              </div>

              {/* Real-time Dynamic Sliders to simulate biology reactiveness */}
              <div className="space-y-4">
                
                {/* 1. Resting Heart Rate */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Resting Heart Rate (RHR)</span>
                    <span className="text-white font-medium">{vitals.restingHeartRate} bpm <span className="text-slate-500 text-[9px]">(Normal: {baselines.restingHeartRate})</span></span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="90"
                    value={vitals.restingHeartRate}
                    onChange={(e) => setVitals({ ...vitals, restingHeartRate: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                    <span>Overtrained / Fever</span>
                    <span>Athletic Homeostasis</span>
                  </div>
                </div>

                {/* 2. HRV */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Heart Rate Variability (HRV)</span>
                    <span className="text-white font-medium">{vitals.hrv} ms <span className="text-slate-500 text-[9px]">(Normal: {baselines.hrv})</span></span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="110"
                    value={vitals.hrv}
                    onChange={(e) => setVitals({ ...vitals, hrv: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                    <span>Severe physical drain</span>
                    <span>High Recovery</span>
                  </div>
                </div>

                {/* 3. Sleep Duration */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Sleep Duration</span>
                    <span className="text-white font-medium">{vitals.sleepDuration} hrs <span className="text-slate-500 text-[9px]">(Normal: {baselines.sleepDuration})</span></span>
                  </div>
                  <input
                    type="range"
                    min="3.0"
                    max="10.0"
                    step="0.1"
                    value={vitals.sleepDuration}
                    onChange={(e) => setVitals({ ...vitals, sleepDuration: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                    <span>Cognitive Deprivation</span>
                    <span>Fully Recharged</span>
                  </div>
                </div>

                {/* 4. Respiratory Rate */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Respiratory Rate (breaths/min)</span>
                    <span className="text-white font-medium">{vitals.respiratoryRate}/min <span className="text-slate-500 text-[9px]">(Normal: {baselines.respiratoryRate})</span></span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="22"
                    value={vitals.respiratoryRate}
                    onChange={(e) => setVitals({ ...vitals, respiratoryRate: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>

                {/* 5. Blood Oxygen Saturation */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">SpO2 (Blood Oxygen)</span>
                    <span className="text-white font-medium">{vitals.spo2}%</span>
                  </div>
                  <input
                    type="range"
                    min="90"
                    max="100"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>

              </div>
            </div>

            {/* Baseline Calibration panel */}
            <div className="bg-slate-900/40 p-4 border border-slate-900 rounded-2xl mt-4">
              <h4 className="text-xs font-display font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                Establish Personal Baselines
              </h4>
              <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                Your body's baseline homeostasis zone is computed dynamically. Alter your baseline parameters to see how the anomaly indicators react.
              </p>
              
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <label className="text-[9px] text-slate-500 uppercase block mb-1">Baseline RHR</label>
                  <input 
                    type="number" 
                    value={baselines.restingHeartRate}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200"
                    onChange={(e) => setBaselines({ ...baselines, restingHeartRate: Math.max(30, parseInt(e.target.value) || 50) })}
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 uppercase block mb-1">Baseline HRV (ms)</label>
                  <input 
                    type="number" 
                    value={baselines.hrv}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200"
                    onChange={(e) => setBaselines({ ...baselines, hrv: Math.max(10, parseInt(e.target.value) || 60) })}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 3 (4 cols): Predictive Brain (Score, Journal Mind Marker & Coach Feed) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Real-time calculated Balance Score gauge */}
            <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl text-center">
              <span className="text-xs font-mono text-teal-400 tracking-wider block mb-1">UNIFIED INTEGRATION STATUS</span>
              <h3 className="text-lg font-display font-bold text-white mb-4">Autonomic Balance Index</h3>

              {/* Threshold Breach Alarm State */}
              {balanceScore < activeThreshold ? (
                <div className="mb-4 bg-rose-950/40 border border-rose-500/20 rounded-2xl p-3 text-left animate-pulse">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <span className="text-xs font-mono font-bold uppercase text-rose-400">🚨 Threshold Breached ({balanceScore}/{activeThreshold})</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-normal">
                    Nervous & physical systems under compensatory strain. Rebalance Plan auto-constructed below.
                  </p>
                </div>
              ) : (
                <div className="mb-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-semibold mb-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Autonomic Stable ({balanceScore}%)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Biometric markers are healthy and stay comfortably above safety floor ({activeThreshold}%).
                  </p>
                </div>
              )}

              {/* Main Circular Score representation */}
              <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                {/* SVG background circle */}
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="54" className="stroke-slate-900 fill-none" strokeWidth="6" />
                  <circle 
                    cx="64" 
                    cy="64" 
                    r="54" 
                    className={`fill-none transition-all duration-500 ${balanceScore < activeThreshold ? 'stroke-rose-500' : 'stroke-teal-400'}`} 
                    strokeWidth="6"
                    strokeDasharray={339.29}
                    strokeDashoffset={339.29 - (339.29 * balanceScore) / 100}
                  />
                </svg>

                {/* Score Number overlay */}
                <div>
                  <p className="text-3xl font-display font-extrabold text-white tracking-tighter">{balanceScore}</p>
                  <p className="text-[9px] font-mono text-slate-500">HOMEOSTASIS %</p>
                </div>
              </div>

              {/* Status text capsule */}
              <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-mono border ${balanceStatus.color}`}>
                {balanceStatus.label}
              </div>

              {/* THRESHOLD SELECTORS INTERFACE */}
              <div className="mt-5 pt-4 border-t border-slate-900 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-mono font-semibold text-slate-300">Biometric Alert Floor</span>
                  <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px] font-mono">
                    <button 
                      onClick={() => setUseAiThreshold(true)}
                      className={`px-2 py-0.5 rounded ${useAiThreshold ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      AI Watch
                    </button>
                    <button 
                      onClick={() => setUseAiThreshold(false)}
                      className={`px-2 py-0.5 rounded ${!useAiThreshold ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      User Set
                    </button>
                  </div>
                </div>

                {useAiThreshold ? (
                  <div className="bg-slate-900/45 p-2 rounded-xl border border-slate-900 text-[10px] space-y-1">
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-teal-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Guard Level
                      </span>
                      <strong className="text-white text-xs">{activeThreshold}%</strong>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-tight leading-relaxed">
                      Automatically heightened as toxic particles or physiological markers fluctuate from normal baselines.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono font-bold">
                      <span className="text-slate-400">Custom Warning level:</span>
                      <span className="text-teal-400">{rebalanceThreshold}%</span>
                    </div>
                    <input 
                      type="range"
                      min="40"
                      max="90"
                      value={rebalanceThreshold}
                      onChange={(e) => setRebalanceThreshold(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-400"
                    />
                  </div>
                )}
              </div>

              {/* SYSTEM NOTIFICATIONS TRACKER */}
              <div className="mt-4 pt-3.5 border-t border-slate-900 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {notificationsEnabled ? (
                      <Bell className="w-3.5 h-3.5 text-teal-400 animate-bounce" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="text-[11px] font-mono font-semibold text-slate-300">Browser System Alerts</span>
                  </div>
                  <button
                    onClick={toggleNotifications}
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 border ${
                      notificationsEnabled
                        ? "bg-teal-500/10 border-teal-500/30 text-teal-300 hover:bg-teal-500/20 shadow-md shadow-teal-500/5"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {notificationsEnabled ? "ACTIVE WATCH" : "DISABLED"}
                  </button>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-1.5 leading-normal">
                  {notificationsEnabled 
                    ? "Continuous monitoring initialized. Dispatches warning pushes on floor breaches."
                    : "Turn on alerts to request browser authorizations. Fallbacks active in sandboxes."}
                </p>
                {notificationsSupported && Notification.permission === "denied" && (
                  <p className="text-[8.5px] text-rose-400/90 mt-1 font-mono leading-tight">
                    ⚠️ Browser: Permissions are blocked. Reset address bar config to allow push notifications.
                  </p>
                )}
              </div>

              {/* TECHNICAL BREAKDOWN EXPANDER */}
              <div className="mt-4 pt-3 border-t border-slate-900/60 text-left">
                <button 
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-white transition"
                >
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-teal-400" />
                    Homeostatic Calculations
                  </span>
                  <span>{showBreakdown ? "Hide ▲" : "Inspect Weights ▼"}</span>
                </button>

                {showBreakdown && (
                  <div className="mt-2.5 p-2.5 bg-slate-950 border border-slate-900 rounded-xl text-[10px] font-mono space-y-1.5 text-slate-300">
                    <div className="flex justify-between border-b border-slate-900 pb-1 text-[9px] text-slate-500 font-semibold">
                      <span>BIOMETRIC CATEGORY</span>
                      <span>DEDUCTION POINTS</span>
                    </div>

                    {/* Physiology */}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Resting Pulse Deviation (RHR)</span>
                      <span className={scoreData.rhrPenalty > 0 ? "text-amber-400" : "text-slate-500"}>
                        {scoreData.rhrPenalty > 0 ? `-${scoreData.rhrPenalty} pts` : "Optimal Baseline"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nervous Adaptability (HRV)</span>
                      <span className={scoreData.hrvPenalty > 0 ? "text-rose-400 font-semibold" : "text-slate-500"}>
                        {scoreData.hrvPenalty > 0 ? `-${scoreData.hrvPenalty} pts` : "Optimal Adaptive"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Circadian Sleep Deficit</span>
                      <span className={scoreData.sleepPenalty > 0 ? "text-amber-400" : "text-slate-500"}>
                        {scoreData.sleepPenalty > 0 ? `-${scoreData.sleepPenalty} pts` : "Perfect Recovery"}
                      </span>
                    </div>

                    {/* Environment */}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Particulate Matter Load (AQI)</span>
                      <span className={scoreData.aqiPenalty > 0 ? "text-rose-400 font-semibold" : "text-slate-500"}>
                        {scoreData.aqiPenalty > 0 ? `-${scoreData.aqiPenalty} pts` : "Clean Air"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Allergen Spora Burden</span>
                      <span className={scoreData.pollenPenalty > 0 ? "text-amber-400" : "text-slate-500"}>
                        {scoreData.pollenPenalty > 0 ? `-${scoreData.pollenPenalty} pts` : "Low Particle Charge"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Weather Strain (UV & Temp Shocks)</span>
                      <span className={scoreData.weatherPenalty > 0 ? "text-amber-400" : "text-slate-500"}>
                        {scoreData.weatherPenalty > 0 ? `-${scoreData.weatherPenalty} pts` : "Neutral Zone"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Daily Daylight Sync (Lux Index)</span>
                      <span className={scoreData.circadianPenalty > 0 ? "text-amber-400" : "text-slate-400 font-semibold"}>
                        {scoreData.circadianPenalty > 0 ? `-${scoreData.circadianPenalty} pts` : "Circadian Anchor Locked"}
                      </span>
                    </div>

                    {/* Mental */}
                    <div className="flex justify-between border-t border-slate-900 pt-1">
                      <span className="text-slate-400">Linguistic Mind Markers (Stress)</span>
                      <span className={scoreData.sentimentPenalty > 0 ? "text-amber-400" : "text-slate-500"}>
                        {scoreData.sentimentPenalty > 0 ? `-${scoreData.sentimentPenalty} pts` : "Optimal Zen Status"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Mind Journal markers */}
            <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-md font-display font-semibold text-white flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  Linguistic Mind Markers
                </h3>
                <span className="text-[8px] font-mono text-slate-500 uppercase">Subconscious stress auditing</span>
              </div>

              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="Write a quick daily log or insert speech transcripts..."
                className="w-full h-20 bg-slate-900 border border-slate-800 rounded-2xl p-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 transition resize-none"
              />

              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={analyzeSentiment}
                  disabled={loadingSentiment || !journalText.trim()}
                  className="flex items-center gap-1.5 text-xs font-mono px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white rounded-xl transition"
                >
                  {loadingSentiment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Auditing text...
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Analyze Linguistic Stress
                    </>
                  )}
                </button>
              </div>

              {/* Journal Sentiment parameters readout */}
              {journalSentiment && (
                <div className="mt-4 p-3 bg-slate-900/50 border border-slate-900 rounded-2xl text-xs space-y-2">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5 text-[10px] font-mono text-slate-400 uppercase">
                    <span>Metric Detected</span>
                    <span>Level</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cognitive Exertion</span>
                    <span className={`font-mono font-bold ${journalSentiment.cognitiveLoad > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{journalSentiment.cognitiveLoad}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sub-clinical Anxiety</span>
                    <span className={`font-mono font-bold ${journalSentiment.anxietyLevel > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{journalSentiment.anxietyLevel}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cumulative Burnout Risk</span>
                    <span className={`font-mono font-bold ${journalSentiment.burnoutRisk > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>{journalSentiment.burnoutRisk}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Stress Markers Located:</span>
                    <div className="flex flex-wrap gap-1">
                      {journalSentiment.linguisticMarkers.map((m, i) => (
                        <span key={i} className="text-[9px] bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-300 italic pt-1 border-t border-slate-900">
                    &ldquo;{journalSentiment.briefSummary}&rdquo;
                  </p>
                </div>
              )}

            </div>

          </div>

        </div>

        {/* 30-DAY HOMEOSTATIC TREND & CORRELATIONS PANEL */}
        <div className="mt-8 bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl">
          
          {/* Header & View Switchers */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-slate-900/60">
            <div>
              <div className="flex items-center gap-2">
                <div className="bg-teal-500/10 p-1.5 rounded-lg border border-teal-500/20 text-teal-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-display font-bold text-white">30-Day Homeostatic Trend & Correlations</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Analyze long-term nervous system shifts, baseline recoveries, and atmospheric environmental strains.
              </p>
            </div>

            {/* Selector tabs */}
            <div className="flex flex-wrap bg-slate-900/80 p-1 rounded-2xl border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setHistoryTab("balance")}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  historyTab === "balance"
                    ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Balance & Floor
              </button>
              <button
                onClick={() => setHistoryTab("nervous")}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  historyTab === "nervous"
                    ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                Autonomic (HRV/RHR)
              </button>
              <button
                onClick={() => setHistoryTab("environment")}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  historyTab === "environment"
                    ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Wind className="w-3.5 h-3.5" />
                Atmospheric Load
              </button>
            </div>
          </div>

          {/* Computed Trend Stats Row */}
          {(() => {
            const totalDays = historicalData.length;
            const sumScore = historicalData.reduce((acc, curr) => acc + curr.score, 0);
            const avgScore = Math.round(sumScore / totalDays);
            
            const breachDays = historicalData.filter(d => d.score < d.threshold).length;
            
            // Slope/trend calculation
            const firstHalf = historicalData.slice(0, 15);
            const secondHalf = historicalData.slice(15);
            const firstAvg = firstHalf.reduce((acc, curr) => acc + curr.score, 0) / 15;
            const secondAvg = secondHalf.reduce((acc, curr) => acc + curr.score, 0) / 15;
            const diff = secondAvg - firstAvg;
            
            let direction: "up" | "down" | "stable" = "stable";
            if (diff > 1.2) direction = "up";
            else if (diff < -1.2) direction = "down";
            
            const wellnessDays = historicalData.filter(d => d.score >= 82).length;
            const wellnessPercent = Math.round((wellnessDays / totalDays) * 100);

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                
                {/* Stat 1: 30-Day Health Mean */}
                <div className="bg-slate-900/30 p-4 border border-slate-900 rounded-2xl text-left">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">30-Day Score Mean</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-extrabold text-teal-400">{avgScore}%</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {avgScore >= 80 ? "Optimal" : "Compensating"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-teal-400 h-full" style={{ width: `${avgScore}%` }}></div>
                  </div>
                </div>

                {/* Stat 2: Direction Vector */}
                <div className="bg-slate-900/30 p-4 border border-slate-900 rounded-2xl text-left">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Homeostasis Trajectory</span>
                  <div className="flex items-center gap-1.5">
                    {direction === "up" && (
                      <>
                        <span className="text-xl font-mono font-extrabold text-emerald-400">Improving</span>
                        <span className="text-xs text-emerald-500 font-bold font-mono">+{Math.abs(Math.round(diff * 10) / 10)}%</span>
                      </>
                    )}
                    {direction === "down" && (
                      <>
                        <span className="text-xl font-mono font-extrabold text-rose-400">Degrading</span>
                        <span className="text-xs text-rose-500 font-bold font-mono">-{Math.abs(Math.round(diff * 10) / 10)}%</span>
                      </>
                    )}
                    {direction === "stable" && (
                      <>
                        <span className="text-xl font-mono font-extrabold text-amber-400">Consolidated</span>
                        <span className="text-xs text-amber-500 font-bold font-mono">±{Math.abs(Math.round(diff * 10) / 10)}%</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-1">Comparing early vs late half</span>
                </div>

                {/* Stat 3: Vulnerability Incidents */}
                <div className="bg-slate-900/30 p-4 border border-slate-900 rounded-2xl text-left">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Floor Breach Days</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-mono font-extrabold ${breachDays > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {breachDays} <span className="text-xs text-slate-500 font-normal">/ 30 Days</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-1.5">
                    {breachDays > 0 ? "⚠️ Recovery protocols triggered" : "🛡️ Immune/Circadian zone safe"}
                  </span>
                </div>

                {/* Stat 4: Resilience Index */}
                <div className="bg-slate-900/30 p-4 border border-slate-900 rounded-2xl text-left">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Restorial Efficiency</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-extrabold text-cyan-400">{wellnessPercent}%</span>
                    <span className="text-[10px] font-mono text-slate-400">Zen Zone</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-1.5">
                    {wellnessPercent >= 75 ? "Excellent vagus tone" : "Mild fatigue vulnerability"}
                  </span>
                </div>

              </div>
            );
          })()}

          {/* Main Visual Chart */}
          <div className="h-80 w-full bg-slate-950 p-2.5 rounded-2xl border border-dashed border-slate-900">
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                const CustomTooltip = ({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isBreached = data.score < data.threshold;
                    return (
                      <div className="bg-slate-950/95 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs font-mono space-y-1.5 z-50">
                        <p className="text-slate-500 font-bold border-b border-slate-900/80 pb-1 text-[9px] uppercase">
                          {data.date === "Jun 14" ? `${data.date} (Today / Live)` : data.date}
                        </p>
                        <div className="flex justify-between items-center gap-6 pt-1">
                          <span className="text-slate-400">Balance Score:</span>
                          <span className={`font-bold text-sm ${isBreached ? 'text-rose-400' : 'text-teal-400'}`}>{data.score}%</span>
                        </div>
                        <div className="flex justify-between items-center gap-6">
                          <span className="text-slate-400">Threshold Floor:</span>
                          <span className="text-slate-500 font-semibold">{data.threshold}%</span>
                        </div>
                        <div className="border-t border-slate-900 pt-1.5 mt-1 space-y-1 text-[10px]">
                          <div className="flex justify-between text-slate-400">
                            <span>HRV (Nervous):</span>
                            <span className="text-slate-200">{data.hrv} ms</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Resting Heart:</span>
                            <span className="text-slate-200">{data.rhr} bpm</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Circadian Sleep:</span>
                            <span className="text-slate-200">{data.sleep} hrs</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Air Quality (AQI):</span>
                            <span className="text-slate-200">{data.aqi}</span>
                          </div>
                        </div>
                        {isBreached && (
                          <p className="text-[9px] text-rose-400 font-bold bg-rose-950/40 border border-rose-500/20 rounded px-1.5 py-0.5 mt-1.5 uppercase text-center animate-pulse">
                            ⚠️ Floor Breached
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                };

                // Render Chart conditionally according to active tab
                if (historyTab === "balance") {
                  return (
                    <AreaChart data={historicalData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#121824" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        stroke="#475569"
                        fontSize={9}
                        fontFamily="monospace"
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={9}
                        fontFamily="monospace"
                        domain={[20, 100]}
                        tickLine={false}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      
                      {/* Active Alert Reference Line */}
                      <ReferenceLine 
                        y={activeThreshold} 
                        stroke="#f43f5e" 
                        strokeDasharray="4 4"
                        label={{ value: `Live Alert Floor: ${activeThreshold}%`, fill: '#ef4444', fontSize: 9, fontFamily: 'monospace', position: 'top' }} 
                      />

                      <Area
                        type="monotone"
                        dataKey="score"
                        name="Balance Score"
                        stroke="#2dd4bf"
                        strokeWidth={2}
                        fill="url(#balanceGrad)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  );
                } else if (historyTab === "nervous") {
                  return (
                    <LineChart data={historicalData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid stroke="#121824" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        stroke="#475569"
                        fontSize={9}
                        fontFamily="monospace"
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={9}
                        fontFamily="monospace"
                        domain={[20, 110]}
                        tickLine={false}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend 
                        wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', marginTop: '5px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        name="Autonomic Score %"
                        stroke="#2dd4bf"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="hrv"
                        name="HRV (ms)"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rhr"
                        name="Resting Heart Rate (bpm)"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </LineChart>
                  );
                } else {
                  // environmental burden correlation view
                  return (
                    <LineChart data={historicalData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid stroke="#121824" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        stroke="#475569"
                        fontSize={9}
                        fontFamily="monospace"
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={9}
                        fontFamily="monospace"
                        domain={[4, 150]}
                        tickLine={false}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend 
                        wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', marginTop: '5px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        name="Autonomic Score %"
                        stroke="#2dd4bf"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="aqi"
                        name="Outdoor Air Quality (AQI)"
                        stroke="#fbbf24"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="sleep"
                        name="Sleep Duration (x10 hr)"
                        stroke="#818cf8"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  );
                }
              })()}
            </ResponsiveContainer>
          </div>

          {/* Underlay Info Annotation */}
          <div className="mt-3 text-[10px] font-mono text-slate-500 leading-normal flex items-center justify-between">
            <span>
              {historyTab === "balance" && "🟢 Hover lines to review exact multi-modal parameters on past dates."}
              {historyTab === "nervous" && "⚡ Autonomic resilience (HRV) is inversely proportional to resting metabolic heart loads."}
              {historyTab === "environment" && "🌪️ High particulate and severe allergy index peaks map directly to dips in overall recovery scores."}
            </span>
            <span className="hidden sm:inline">Updated automatically in sync with Wearable sliders</span>
          </div>

        </div>

        {/* FULL WIDTH AI COACH PANEL (Predictions & immediate Circadian response actions) */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Proactive Coaching (8 cols) */}
          <div className="md:col-span-8 bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-400" />
                    Proactive AI Health Coach
                  </h3>
                  <p className="text-xs text-slate-400">
                    Your digital twin model correlates outdoor stressors with current autonomic values to prevent metabolic drop.
                  </p>
                </div>

                <button
                  onClick={fetchAiCoaching}
                  disabled={loadingCoach}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 hover:opacity-90 font-mono text-xs font-semibold rounded-full shadow-lg shadow-teal-500/10 transition"
                >
                  {loadingCoach ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Computing Homeostasis Zone...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-slate-950" />
                      Sync Twin & Generate Coaching
                    </>
                  )}
                </button>
              </div>

              {/* Coaching Feedback state */}
              {coachingResult ? (
                <div className="space-y-4">
                  {/* Digital Twin warning ticker */}
                  <div className={`p-4 rounded-2xl border ${coachingResult.anomalyDetected ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                        {coachingResult.anomalyDetected ? "Homeostatic Stress Deviation Alerts" : "Autonomic Homeostasis Maintained"}
                      </span>
                    </div>
                    <ul className="text-xs font-mono list-disc list-inside space-y-1 text-slate-300">
                      {coachingResult.detectedDeviations.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Predictions paragraph */}
                  <div>
                    <label className="text-[10px] font-mono text-teal-400 uppercase tracking-widest block mb-1">PROACTIVE TWIN CORRELATION PREDICTION</label>
                    <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/45 p-4 border border-slate-900 rounded-2xl font-sans">
                      {coachingResult.predictiveInsight}
                    </p>
                  </div>

                  {/* Immediate health recommendations */}
                  <div>
                    <label className="text-[10px] font-mono text-teal-400 uppercase tracking-widest block mb-1.5">TARGETED ADAPTATION STEPS</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {coachingResult.customizedAdvice.map((a, i) => (
                        <div key={i} className="bg-slate-900/60 p-3.5 border border-slate-900 rounded-2xl text-xs text-slate-300 leading-relaxed shadow-sm">
                          <span className="inline-block w-4 h-4 bg-teal-500/10 text-teal-300 font-mono rounded-full text-center text-[10px] font-semibold leading-4 mr-2">
                            {i + 1}
                          </span>
                          {a}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coach Nudge transcription */}
                  <div className="border-t border-slate-900 pt-4 mt-6">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">COACH VOCAL TRANSMISSION TEXT</span>
                    <p className="text-xs text-slate-400 italic bg-slate-950 p-3 border border-slate-900/60 rounded-xl leading-relaxed">
                      &ldquo;{coachingResult.coachNudgeText}&rdquo;
                    </p>
                  </div>

                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-900 rounded-2xl text-center bg-slate-900/20">
                  <Sparkles className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
                  <p className="text-sm font-medium text-slate-400">Your AI health twin model is loaded.</p>
                  <p className="text-xs text-slate-600 mt-1">Adjust vitals or load weather, then click "Sync Twin" above to predict somatic responses.</p>
                </div>
              )}
            </div>
          </div>

          {/* Rebalance Plan (4 cols) */}
          <div className="md:col-span-4 bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col justify-between">
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono text-teal-400 tracking-wider">KILLER FEATURE</span>
                  <h3 className="text-md font-display font-semibold text-white">Stabilizing Plan</h3>
                </div>
                <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                When vitals start to fall, trigger the neural stabilization action to produce an immediate somatic recovery schedule.
              </p>

              <button
                onClick={fetchRebalancePlan}
                disabled={loadingRebalance}
                className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100 hover:text-white font-mono text-xs font-medium rounded-2xl shadow-md transition"
              >
                {loadingRebalance ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin inline-block mr-1.5" />
                    Assembling metabolic plan...
                  </>
                ) : (
                  "Generate Somatic Rebalance Plan"
                )}
              </button>

              <AnimatePresence mode="wait">
                {rebalancePlan ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 pt-3 border-t border-slate-900"
                  >
                    <div className="bg-amber-400/10 border border-amber-500/20 text-amber-300 rounded-xl px-3 py-1 text-xs font-semibold">
                      {rebalancePlan.recoveryTitle}
                    </div>

                    <div className="text-xs space-y-3">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">🌅 AM Circadian Sync</span>
                        <p className="text-slate-300 leading-relaxed font-sans">{rebalancePlan.morningProtocol}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">☀️ Afternoon Protection</span>
                        <p className="text-slate-300 leading-relaxed font-sans">{rebalancePlan.afternoonProtocol}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block">🌌 PM Neural Trigger</span>
                        <p className="text-slate-300 leading-relaxed font-sans">{rebalancePlan.eveningProtocol}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-900/60 rounded-xl">
                      <span className="text-[9px] font-mono text-teal-400 uppercase tracking-wider block mb-1">METABOLIC VALIDATION</span>
                      <p className="text-[11px] text-slate-400 italic leading-relaxed">
                        &ldquo;{rebalancePlan.biofeedbackReasoning}&rdquo;
                      </p>
                    </div>

                  </motion.div>
                ) : (
                  <div className="pt-4 border-t border-slate-900/60 text-center py-10">
                    <p className="text-xs text-slate-600 font-mono">No active rescue protocol compiled.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>
        </>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-950 bg-slate-950 py-8 px-6 text-center text-xs text-slate-600 font-mono mt-20">
        <div className="max-w-7xl mx-auto space-y-2">
          <p>Digital Twin Health Coach conforms to mobile FDA General Wellness guidance rules. No medical advice provided.</p>
          <p>© 2026 Core Autonomic Twin Systems. Aggregating Google Environment API & Free Open-Meteo Street Pollen Channels.</p>
        </div>
      </footer>

      {/* Floating System Alerts / Toasts Panel */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {inAppAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="pointer-events-auto bg-slate-950/95 border border-rose-500/30 shadow-2xl rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden backdrop-blur-md"
            >
              {/* Pulsing warning accent line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 animate-pulse"></div>
              
              <div className="flex items-start gap-2.5">
                <div className="bg-rose-500/10 p-1.5 rounded-xl text-rose-400 mt-0.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">System Floor Alert</span>
                    <button 
                      onClick={() => setInAppAlerts(prev => prev.filter(x => x.id !== alert.id))}
                      className="text-slate-500 hover:text-slate-300 transition text-[10px] font-mono select-none px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                    >
                      Dismiss
                    </button>
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1 leading-snug">{alert.title}</h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-snug">{alert.text}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-slate-900 pt-2.5 mt-1 text-[10px] font-mono">
                <span className="text-slate-500">Live Score: <strong className="text-rose-400">{alert.score}%</strong></span>
                <span className="text-slate-500">Floor Level: <strong className="text-slate-300">{alert.floor}%</strong></span>
                <span className="text-slate-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold animate-pulse">Strain Active</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
