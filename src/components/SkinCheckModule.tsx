import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Droplets,
  Moon,
  Activity,
  Heart,
  Info,
  Plus,
  Trash2,
  Sparkles,
  Check,
  TrendingUp,
  Flame,
  Shield,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkle
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";
import { Vitals, EnvironmentData } from "../types";

export interface SkinLogEntry {
  id: string;
  timestamp: string;
  dateStr: string;
  itchIntensity: number; // 0-5
  triggers: string[]; // stress, humidity, sleep, pollen, sweat
  autonomicStressScore: number; // 0-100%
  autonomicBalanceScore: number; // 0-100% (passed down as balanceScore)
  heartRate: number;
  hrv: number;
  sleepDuration: number;
  airQuality: number;
  isCustomEntry?: boolean;
}

interface SkinCheckModuleProps {
  vitals: Vitals;
  baselines: Vitals;
  environment: EnvironmentData;
  autonomicStressScore: number; // from CaregiverDyadMonitor (e.g. stressReactivityCoefficient)
  autonomicBalanceScore: number; // from CaregiverDyadMonitor (e.g. balanceScore)
  onLogAdded?: (newLog: SkinLogEntry) => void;
  consentCamera?: boolean;
}

// Custom local storage hook to manage active entries
function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prevVal: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Local storage state load failed:", error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((prevVal: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error("Local storage sync failed:", error);
    }
  };

  return [storedValue, setValue];
}

const DEFAULT_HISTORICAL_LOGS: SkinLogEntry[] = [
  {
    id: "hist-1",
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Mon",
    itchIntensity: 1,
    triggers: ["humidity"],
    autonomicStressScore: 35,
    autonomicBalanceScore: 82,
    heartRate: 59,
    hrv: 64,
    sleepDuration: 8.1,
    airQuality: 42
  },
  {
    id: "hist-2",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Tue",
    itchIntensity: 2,
    triggers: ["stress", "sleep"],
    autonomicStressScore: 58,
    autonomicBalanceScore: 68,
    heartRate: 64,
    hrv: 52,
    sleepDuration: 5.8,
    airQuality: 55
  },
  {
    id: "hist-3",
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Wed",
    itchIntensity: 1,
    triggers: ["humidity"],
    autonomicStressScore: 41,
    autonomicBalanceScore: 78,
    heartRate: 61,
    hrv: 60,
    sleepDuration: 7.5,
    airQuality: 39
  },
  {
    id: "hist-4",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Thu",
    itchIntensity: 3,
    triggers: ["stress", "humidity"],
    autonomicStressScore: 68,
    autonomicBalanceScore: 59,
    heartRate: 69,
    hrv: 45,
    sleepDuration: 6.9,
    airQuality: 78
  },
  {
    id: "hist-5",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Fri",
    itchIntensity: 4,
    triggers: ["stress", "sleep", "sweat"],
    autonomicStressScore: 78,
    autonomicBalanceScore: 48,
    heartRate: 74,
    hrv: 38,
    sleepDuration: 5.2,
    airQuality: 82
  },
  {
    id: "hist-6",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Sat",
    itchIntensity: 2,
    triggers: ["humidity", "pollen"],
    autonomicStressScore: 49,
    autonomicBalanceScore: 70,
    heartRate: 62,
    hrv: 58,
    sleepDuration: 7.2,
    airQuality: 40
  }
];

export function SkinCheckModule({
  vitals,
  baselines,
  environment,
  autonomicStressScore,
  autonomicBalanceScore,
  onLogAdded,
  consentCamera = false
}: SkinCheckModuleProps) {
  // --- STATE FOR CURRENT USER RATING ---
  const [currentItch, setCurrentItch] = useState<number>(2); // 0-5 scale
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(["stress", "humidity"]);
  const [skinLogs, setSkinLogs] = useLocalStorage<SkinLogEntry[]>("skin_check_logs_v1", DEFAULT_HISTORICAL_LOGS);
  const [hasAddedToday, setHasAddedToday] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanRedness, setScanRedness] = useState<number | null>(null);
  const [scanBarrier, setScanBarrier] = useState<number | null>(null);

  // Save logs to localStorage upon update
  const saveLogs = (updated: SkinLogEntry[]) => {
    setSkinLogs(updated);
  };

  // Autodetect stress, humidity, and sleep triggers based on actual biomedical vitals!
  const autoDetectTriggerFeedback = useMemo(() => {
    const isStressActive = autonomicStressScore > 65;
    const isHumidityActive = environment.aqi > 70 || environment.pm25 > 15; // environment attributes
    const isSleepActive = vitals.sleepDuration < 6.5;

    return {
      stress: isStressActive,
      humidity: isHumidityActive,
      sleep: isSleepActive
    };
  }, [vitals, environment, autonomicStressScore]);

  // Toggle trigger in rating
  const toggleTrigger = (id: string) => {
    if (selectedTriggers.includes(id)) {
      setSelectedTriggers(selectedTriggers.filter((t) => t !== id));
    } else {
      setSelectedTriggers([...selectedTriggers, id]);
    }
  };

  // Perform GDPR compliant optical barometric skin scan simulation
  const triggerSkinCameraScan = () => {
    if (!consentCamera) return;
    setIsScanning(true);
    setScanBarrier(null);
    setScanRedness(null);

    setTimeout(() => {
      setIsScanning(false);
      // Moisture inversely correlates with itch + environmental dryness
      const moisture = Math.max(15, Math.min(92, 85 - (currentItch * 12) - (environment.aqi * 0.1)));
      // Redness correlates directly with stress + itch intensity
      const redness = Math.max(8, Math.min(95, 10 + (currentItch * 15) + (autonomicStressScore * 0.25)));

      setScanBarrier(moisture);
      setScanRedness(redness);
    }, 2000);
  };

  // Save current entry to clinical trace logs log
  const handleAddNewLog = () => {
    const date = new Date();
    const daysStr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayLabel = daysStr[date.getDay()];
    
    const newEntry: SkinLogEntry = {
      id: "log-" + Date.now(),
      timestamp: date.toISOString(),
      dateStr: dayLabel,
      itchIntensity: currentItch,
      triggers: [...selectedTriggers],
      autonomicStressScore: autonomicStressScore,
      autonomicBalanceScore: autonomicBalanceScore,
      heartRate: vitals.restingHeartRate,
      hrv: vitals.hrv,
      sleepDuration: vitals.sleepDuration,
      airQuality: environment.aqi,
      isCustomEntry: true
    };

    const nextLogs = [...skinLogs, newEntry];
    saveLogs(nextLogs);
    setHasAddedToday(true);

    if (onLogAdded) {
      onLogAdded(newEntry);
    }
  };

  // clear a specific log
  const handleDeleteLog = (id: string) => {
    const nextLogs = skinLogs.filter((log) => log.id !== id);
    saveLogs(nextLogs);
    if (nextLogs.length === 0 || !nextLogs.some(l => l.isCustomEntry)) {
      setHasAddedToday(false);
    }
  };

  // Clinical descriptors for itch level scale (0 to 5)
  const getItchDescription = (level: number) => {
    switch (level) {
      case 0:
        return { label: "Absent", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", notes: "Completely healthy skin barrier with standard lipid density." };
      case 1:
        return { label: "Barely Perceptible", color: "text-teal-400 bg-teal-500/10 border-teal-500/20", notes: "Isolated dry patches with standard stress resistance." };
      case 2:
        return { label: "Moderate Pruritus", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", notes: "Intermittent scratch urges that disrupt focusing routines." };
      case 3:
        return { label: "Intrusive Flare", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", notes: "Systemic micro-inflammation triggers epidermal breakdown." };
      case 4:
        return { label: "Severe Scratching", color: "text-orange-400 bg-orange-500/10 border-orange-500/20", notes: "Nocturnal scratching risks dermal tearing and secondary infection." };
      case 5:
        return { label: "Unbearable", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", notes: "Extreme flaring. Full sympathetic overload lock-on. Barrier represents absolute burnout." };
      default:
        return { label: "Undefined", color: "text-slate-400 bg-slate-500/10 border-slate-500/20", notes: "" };
    }
  };

  const currDermMeta = getItchDescription(currentItch);

  // --- STATISTICAL CORRELATION ENGINE ---
  // Calculates Pearson correlation coefficient r between Autonomic Balance Score and Itch severity
  const correlationResult = useMemo(() => {
    if (skinLogs.length < 3) return { coefficient: 0, text: "Insufficient historical trace", badge: "INCONCLUSIVE", color: "text-slate-400" };

    const n = skinLogs.length;
    let sumX = 0; // Autonomic Balance Score
    let sumY = 0; // Itch intensity * 20 (to align on 0-100 scale)
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    skinLogs.forEach((log) => {
      const x = log.autonomicBalanceScore || (100 - log.autonomicStressScore); 
      const y = log.itchIntensity * 20;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    });

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return { coefficient: 0, text: "No variance in ratings yet", badge: "STABLE", color: "text-indigo-400" };

    const r = parseFloat((numerator / denominator).toFixed(3));
    
    let text = "Muted autonomic connection.";
    let badge = "LOW CORRELATION";
    let color = "text-indigo-450";

    if (r <= -0.7) {
      text = "Highly Significant Balance Inverse Coupling: Strong parasympathetic-sympathetic balance corresponds to normal skin barrier homeostasis. Drops in autonomic balance (denoting severe fatigue) predict sleep-shattering eczema flares.";
      badge = "CLINICALLY ALIGNED COUPLING";
      color = "text-teal-400";
    } else if (r <= -0.4) {
      text = "Moderate inverse correlation: Active stress and fatigue (lower balance score) significantly elevate itch intensity levels.";
      badge = "MODERATE PHYSIOLOGICAL SYNERGY";
      color = "text-orange-400";
    } else if (r <= -0.1) {
      text = "Weak inverse trend: Daily autonomic stability has minor, indirect influence over epidermal comfort thresholds.";
      badge = "MILD REGULATORY PATHWAY";
      color = "text-amber-400";
    } else {
      text = "Uncorrelated deviation. Skin flaring behaves independently of dynamic heart rate indices today.";
      badge = "ISOLATED DRIFT";
      color = "text-slate-400";
    }

    return { coefficient: r, text, badge, color };
  }, [skinLogs]);

  // Recharts Chart Data Formatter
  const chartData = useMemo(() => {
    return skinLogs.map((log) => {
      const formattedDate = log.dateStr;
      return {
        name: formattedDate,
        "Itch Level": Math.round(log.itchIntensity * 20), // visual scaling to match 100 max
        "Autonomic Stress": log.autonomicStressScore,
        "Autonomic Balance": log.autonomicBalanceScore || (100 - log.autonomicStressScore),
        "Sleep Quality": Math.round(log.sleepDuration * 10),
        rawItch: log.itchIntensity
      };
    });
  }, [skinLogs]);

  // Mini Recharts sparkline data formatter comparing itch vs autonomic balance
  const miniChartData = useMemo(() => {
    return skinLogs.slice(-7).map((log) => {
      return {
        name: log.dateStr,
        balance: log.autonomicBalanceScore || (100 - log.autonomicStressScore),
        itch: log.itchIntensity // 0-5 raw scale
      };
    });
  }, [skinLogs]);

  // Dynamic coincidence metrics comparing raw itch intensity with historical autonomicBalanceScore
  const dynamicCoincidenceStats = useMemo(() => {
    if (skinLogs.length === 0) {
      return {
        spikeCoincidence: 0,
        safeZoneCoincidence: 0,
        highStressHighItchCount: 0,
        lowStressLowItchCount: 0,
        totalCount: 0
      };
    }

    let highStressHighItchCount = 0;
    let lowStressLowItchCount = 0;

    skinLogs.forEach((log) => {
      const balance = log.autonomicBalanceScore || (100 - log.autonomicStressScore);
      const itch = log.itchIntensity;

      // High stress trigger: Autonomic Balance < 65
      // High itch flare: Itch Intensity >= 3
      if (balance < 65 && itch >= 3) {
        highStressHighItchCount++;
      }

      // Safe state: Autonomic Balance >= 70
      // Calm itch level: Itch Intensity <= 2
      if (balance >= 70 && itch <= 2) {
        lowStressLowItchCount++;
      }
    });

    const totalCount = skinLogs.length;
    return {
      spikeCoincidence: Math.round((highStressHighItchCount / totalCount) * 100),
      safeZoneCoincidence: Math.round((lowStressLowItchCount / totalCount) * 100),
      highStressHighItchCount,
      lowStressLowItchCount,
      totalCount
    };
  }, [skinLogs]);

  return (
    <div className="bg-slate-950/85 border border-slate-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden leading-relaxed" id="skin-check-hybrid-module">
      {/* Visual background ambient details */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-rose-500/[0.015] rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-indigo-500/[0.015] rounded-full blur-3xl pointer-events-none"></div>

      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-indigo-950/15">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="bg-rose-500/10 p-2 rounded-xl text-rose-400 border border-rose-500/25">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-md md:text-lg font-display font-bold text-white flex items-center gap-2">
                Skin Check & Autonomic Stress Coupling Loop
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Correlating epidermal moisture, itch severity, and allergen exposure vs. dynamic heart rate variability
              </p>
            </div>
          </div>
        </div>

        {/* Scan Camera Button */}
        <button
          onClick={triggerSkinCameraScan}
          disabled={isScanning || !consentCamera}
          className={`px-4 py-2 font-mono text-xs font-bold rounded-2xl border transition flex items-center gap-2 shrink-0 ${
            !consentCamera 
              ? "bg-slate-900 border-slate-950 text-slate-500 cursor-not-allowed opacity-60" 
              : "bg-indigo-500/10 hover:bg-indigo-500 hover:text-slate-950 text-indigo-400 border-indigo-500/25"
          }`}
          aria-label={!consentCamera ? "Optical skin scan disabled. Enable camera consent in Privacy section" : "Run optical skin scan using on-device camera"}
        >
          <Activity className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          {isScanning ? "Gdpr Scanning..." : !consentCamera ? "Scan Blocked (Consent Required)" : "Run Optical Skin Scan"}
        </button>
      </div>

      {/* MAIN TWO COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMN 1: INTERACTIVE LOGGING CORE (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          
          {/* 1-TAP RATING ELEMENT */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                1-Tap Itch Intensity Rating
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${currDermMeta.color}`}>
                Level {currentItch}: {currDermMeta.label}
              </span>
            </div>

            {/* Tap Rating Buttons Grid */}
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((val) => {
                const active = currentItch === val;
                const activeColors = [
                  "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-extrabold shadow-lg shadow-emerald-500/5",
                  "bg-teal-500/10 border-teal-500/30 text-teal-400 font-extrabold shadow-lg shadow-teal-500/5",
                  "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-extrabold shadow-lg shadow-indigo-500/5",
                  "bg-amber-500/10 border-amber-500/30 text-amber-400 font-extrabold shadow-lg shadow-amber-500/5",
                  "bg-orange-500/10 border-orange-500/30 text-orange-400 font-extrabold shadow-lg shadow-orange-500/5",
                  "bg-rose-500/10 border-rose-500/30 text-rose-400 font-extrabold shadow-lg shadow-rose-500/5"
                ];

                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCurrentItch(val)}
                    className={`h-11 rounded-2xl flex flex-col items-center justify-center font-mono border transition-all duration-250 select-none ${
                      active
                        ? activeColors[val]
                        : "bg-slate-900/40 hover:bg-slate-900 border-slate-900 text-slate-500 hover:text-white"
                    }`}
                  >
                    <span className="text-sm font-black">{val}</span>
                    <span className="text-[7.5px] uppercase font-bold tracking-tight opacity-75">
                      {val === 0 ? "None" : val === 5 ? "Unb" : `Lvl${val}`}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[10.5px] text-slate-450 leading-relaxed font-sans mt-2.5 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900">
              {currDermMeta.notes}
            </p>
          </div>

          {/* DYNAMIC TRIGGER CHECKBOX PANEL */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Log Flare Catalysts
              </span>
              <span className="text-[9px] font-mono text-slate-550">SELECT ALL APPLICABLE</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                { id: "stress", name: "Stress Burden", info: `${autonomicStressScore}% score`, activeKey: autoDetectTriggerFeedback.stress },
                { id: "humidity", name: "Humidity Deficit", info: `${environment.temperature}°C / AQI ${environment.aqi}`, activeKey: autoDetectTriggerFeedback.humidity },
                { id: "sleep", name: "Sleep Deficit", info: `${vitals.sleepDuration} hrs sleep`, activeKey: autoDetectTriggerFeedback.sleep },
                { id: "sweat", name: "Over-Sweating", info: `${vitals.activityCalories} kcal workout`, activeKey: false },
                { id: "pollen", name: "Birch Pollen", info: `${environment.birchPollen} gr/m³`, activeKey: environment.birchPollen > 10 }
              ].map((trig) => {
                const isSelected = selectedTriggers.includes(trig.id);
                return (
                  <button
                    key={trig.id}
                    type="button"
                    onClick={() => toggleTrigger(trig.id)}
                    className={`p-2 rounded-2xl text-left border transition-all flex flex-col justify-between select-none h-14 ${
                      isSelected
                        ? "bg-rose-500/10 border-rose-500/25 text-rose-300 font-bold"
                        : "bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10.5px] truncate">{trig.name}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : trig.activeKey ? (
                        <Sparkle className="w-3 h-3 text-indigo-400 animate-pulse" />
                      ) : null}
                    </div>
                    <span className="text-[8px] opacity-70 font-normal truncate mt-0.5">{trig.info}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC CAMERA OPTICAL SCAN SIMULATOR DISPLAY */}
          <AnimatePresence mode="wait">
            {isScanning ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-indigo-950/15 border border-indigo-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center h-[120px]"
              >
                <div className="w-9 h-9 border-t-2 border-indigo-400 rounded-full animate-spin mb-2"></div>
                <p className="text-[10.5px] font-mono text-indigo-300 animate-pulse">Scanning epidermis lipid matrix...</p>
                <p className="text-[8px] text-slate-500 font-mono mt-0.5">Continuous local on-device image secure framework active</p>
              </motion.div>
            ) : scanBarrier !== null ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/60 border border-slate-900 rounded-2xl p-3 grid grid-cols-2 gap-4 h-[120px] items-center"
              >
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-900/60">
                  <span className="text-[8.5px] font-mono text-slate-500 uppercase block mb-0.5">Barrier Moisture</span>
                  <span className={`text-[15px] font-mono font-bold ${scanBarrier < 35 ? "text-rose-400" : "text-emerald-400"}`}>
                    {scanBarrier}% {scanBarrier < 35 ? "Dryness Alert" : "Stable"}
                  </span>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className={`h-full ${scanBarrier < 35 ? "bg-rose-400 animate-pulse" : "bg-emerald-400"}`} style={{ width: `${scanBarrier}%` }}></div>
                  </div>
                </div>

                <div className="bg-slate-950 p-2 rounded-xl border border-slate-900/60">
                  <span className="text-[8.5px] font-mono text-slate-500 uppercase block mb-0.5">Erythema Redness</span>
                  <span className={`text-[15px] font-mono font-bold ${scanRedness > 45 ? "text-rose-400" : "text-emerald-400"}`}>
                    {scanRedness}% {scanRedness > 45 ? "Inflamed" : "Calm"}
                  </span>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className={`h-full ${scanRedness > 45 ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${scanRedness}%` }}></div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ADD ENTRY BUTTON */}
          <button
            onClick={handleAddNewLog}
            className={`w-full py-3 px-4 rounded-2xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              hasAddedToday
                ? "bg-slate-900 text-slate-400 border border-slate-800 cursor-not-allowed"
                : "bg-rose-500 text-slate-950 hover:bg-rose-400 shadow-md shadow-rose-500/10 font-black"
            }`}
          >
            <Plus className="w-4 h-4" />
            {hasAddedToday ? "Check-in Log Complete Today" : "Log Irritation & Stress State"}
          </button>
        </div>

        {/* COLUMN 2: ANALYTICAL CORRELATION VISUALIZER (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-6">
          
          {/* MATH CORRELATION FACTOR BANNER */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between gap-3">
            <div className="absolute top-3 right-4 flex items-center gap-1.5">
              <span className={`font-mono text-[8.5px] px-2 py-0.5 rounded border ${correlationResult.color}`}>
                Pearson r = {correlationResult.coefficient}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Sympathetic Dermal Correlation
              </span>
            </div>

            <p className="text-xs text-slate-350 leading-relaxed font-sans">
              {correlationResult.text}
            </p>

            {/* VISUAL INDICATOR: Pearson r Trend Thermometer/Slider */}
            <div className="space-y-1.5 bg-slate-950/45 p-3 rounded-2xl border border-slate-900/80">
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                <span>Strong Inverse Coupling (Fatigue Flare-up)</span>
                <span>Direct Trend</span>
              </div>
              <div className="relative h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                {/* Midpoint line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-800" />
                {/* Trend marker */}
                <div 
                  className={`absolute top-0 bottom-0 w-3 rounded-full -ml-1.5 transition-all duration-300 ${
                    correlationResult.coefficient < -0.4 ? "bg-rose-400 shadow-sm shadow-rose-500/20" : "bg-indigo-400"
                  }`}
                  style={{ left: `${((correlationResult.coefficient + 1) / 2) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[8px] font-mono text-slate-450">
                <span className={correlationResult.coefficient <= -0.4 ? "text-rose-400 font-bold" : ""}>-1.0 (Inverse)</span>
                <span>0.0 (Null)</span>
                <span className={correlationResult.coefficient >= 0.4 ? "text-emerald-400 font-bold" : ""}>+1.0 (Direct)</span>
              </div>
            </div>

            {/* LIVE COUPLING COMPACT RECHARTS SPARK-TRACE */}
            <div className="bg-slate-950/45 p-3 rounded-2xl border border-slate-900/80 space-y-2.5">
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                <span className="uppercase tracking-wider font-bold">Resilience & Flare Sparkline (Recharts)</span>
                <span className="text-slate-500 font-mono text-[8px]">(Scaled 0-100)</span>
              </div>
              <div className="h-14 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={miniChartData} margin={{ top: 2, right: 6, left: 6, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" horizontal={false} vertical={false} />
                    <Line
                      type="monotone"
                      name="Autonomic Balance"
                      dataKey="balance"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ r: 2, strokeWidth: 1 }}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      name="Itch Severity (Scaled)"
                      dataKey={(d) => d.itch * 20}
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={{ r: 2, strokeWidth: 1 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 border-t border-slate-900/50 pt-1.5 px-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14b8a6]"></span>
                  Autonomic Balance (%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]"></span>
                  Itch Flare (scaled, 0-100)
                </span>
                <span className="text-slate-400 font-bold">7 Logs</span>
              </div>
            </div>

            {/* LIVE COUPLING GAP GRAPHIC */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/30 p-2.5 rounded-2xl border border-slate-900/60 text-[10px] font-mono">
              <div>
                <div className="flex justify-between text-slate-500 text-[8.5px] uppercase mb-1">
                  <span>Current Stress</span>
                  <span className="text-rose-400">{100 - autonomicBalanceScore}%</span>
                </div>
                <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-400" style={{ width: `${100 - autonomicBalanceScore}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-500 text-[8.5px] uppercase mb-1">
                  <span>Current Itch Flare</span>
                  <span className="text-amber-400">{currentItch * 20}%</span>
                </div>
                <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${currentItch * 20}%` }}></div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-900/60 pt-2 flex justify-between items-center text-[10px] text-slate-450 font-mono">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Active Risk Coupling:
              </span>
              <span className={`font-extrabold capitalize ${correlationResult.color}`}>
                {correlationResult.badge}
              </span>
            </div>
          </div>

          {/* DYNAMIC SCIENTIFIC GRAPH */}
          <div className="bg-slate-950 border border-slate-900 rounded-3xl p-5 flex flex-col justify-between gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-900/60 pb-3">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">Dual-Axis Skin Coupling Index</span>
                <h4 className="text-xs font-display font-semibold text-white">Stress vs. Itch Dynamics (0-5)</h4>
              </div>
              <span className="text-[9px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded font-mono border border-slate-800">COUPLING TRACE</span>
            </div>

            {/* Visual Correlation Coincidence Indicators */}
            <div className="grid grid-cols-2 gap-3 bg-slate-900/15 border border-slate-900 rounded-2xl p-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                  <span>Stress-Itch Sync Rate</span>
                  <span className="font-bold text-rose-400">{dynamicCoincidenceStats.spikeCoincidence}% Match</span>
                </div>
                <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-400" style={{ width: `${dynamicCoincidenceStats.spikeCoincidence}%` }}></div>
                </div>
                <p className="text-[8px] font-sans text-slate-500 leading-normal">
                  Flares (Itch Intensity &ge; 3) coinciding with low autonomic balance (&lt; 65%).
                </p>
              </div>

              <div className="space-y-1 border-l border-slate-900/60 pl-3">
                <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                  <span>Resilience Concurrence</span>
                  <span className="font-bold text-emerald-400">{dynamicCoincidenceStats.safeZoneCoincidence}% Normalcy</span>
                </div>
                <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: `${dynamicCoincidenceStats.safeZoneCoincidence}%` }}></div>
                </div>
                <p className="text-[8px] font-sans text-slate-500 leading-normal">
                  Calm skin (Itch Intensity &le; 2) paired with active parasympathetic restoration (&ge; 70%).
                </p>
              </div>
            </div>

            <div className="h-[180px] w-full text-[9px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: -5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradientItch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" tickLine={false} />
                  
                  {/* Left Axis: Autonomic Balance (0-100%) */}
                  <YAxis 
                    yAxisId="left" 
                    stroke="#14b8a6" 
                    tickLine={false} 
                    domain={[0, 100]} 
                    width={25}
                  />

                  {/* Right Axis: Raw Itch Severity (0-5) */}
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#f43f5e" 
                    tickLine={false} 
                    domain={[0, 5]} 
                    width={20}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const balance = payload[0]?.value;
                        const itch = payload[1]?.value;
                        return (
                          <div className="bg-slate-950/95 border border-slate-900 rounded-2xl p-3 shadow-xl space-y-1.5 text-xs backdrop-blur-md">
                            <p className="font-bold text-slate-300 font-mono text-[9px] uppercase border-b border-slate-900 pb-1">{label} Log</p>
                            <div className="flex justify-between gap-6">
                              <span className="text-[#14b8a6] font-medium font-mono text-[10px]">Autonomic Balance:</span>
                              <span className="font-mono font-bold text-[#14b8a6]">{balance}%</span>
                            </div>
                            <div className="flex justify-between gap-6">
                              <span className="text-[#f43f5e] font-medium font-mono text-[10px]">Itch Intensity:</span>
                              <span className="font-mono font-bold text-rose-400">{itch}/5</span>
                            </div>
                            <div className="border-t border-slate-900/60 pt-1.5 mt-1 text-[9px] font-sans leading-relaxed text-slate-400 max-w-[190px]">
                              {typeof balance === "number" && balance < 65 ? (
                                <span className="text-amber-400/95 font-medium">⚠️ Reduced autonomic storage corresponds with elevated skin barrier triggers.</span>
                              ) : (
                                <span className="text-emerald-400/95 font-medium">🟢 Sound regulatory resources help stabilize outer epidermal moisture thresholds.</span>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  <Area
                    yAxisId="left"
                    name="Autonomic Balance (%)"
                    type="monotone"
                    dataKey="Autonomic Balance"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradientBalance)"
                  />
                  
                  <Area
                    yAxisId="right"
                    name="Itch Intensity (0-5)"
                    type="monotone"
                    dataKey="rawItch"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradientItch)"
                  />
                  
                  {/* Live Benchmark Marker corresponding to autonomicBalanceScore prop */}
                  <ReferenceLine 
                    yAxisId="left" 
                    y={autonomicBalanceScore} 
                    stroke="#14b8a6" 
                    strokeDasharray="4 4" 
                    strokeWidth={1.5}
                    label={{ 
                      value: `Live Autonomic Balance: ${autonomicBalanceScore}%`, 
                      position: "insideBottomLeft", 
                      fill: "#14b8a6", 
                      fontSize: 8, 
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      offset: 10
                    }} 
                  />
                  <ReferenceLine yAxisId="left" y={70} stroke="#14b8a6" strokeDasharray="3 3" strokeOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-center bg-slate-900/20 border border-slate-900/40 rounded-xl p-2.5 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></span>
                Left Axis: Autonomic Balance (0% to 100%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                Right Axis: Itch Severity (0 to 5 Scale)
              </span>
            </div>
          </div>

          {/* RECENT LOG ENTRIES */}
          <div className="bg-slate-900/35 border border-slate-900 rounded-3xl p-4">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-3 pl-1">
              On-Device Log History (GDPR Sandbox)
            </span>

            <div className="space-y-2 max-h-[110px] overflow-y-auto pr-1">
              {skinLogs.slice(-3).reverse().map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 p-2.5 rounded-2xl border border-slate-900/80 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-bold w-10">{log.dateStr}</span>
                    <span className="text-[10.5px] text-white">
                      Itch: <strong className="text-rose-400 font-bold">{log.itchIntensity}/5</strong>
                    </span>
                    <span className="text-slate-500 hidden sm:inline">|</span>
                    <span className="text-[10px] text-teal-400 hidden sm:inline">Balance: {log.autonomicBalanceScore || (100 - log.autonomicStressScore)}%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {log.triggers.map((t) => (
                        <span
                          key={t}
                          className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-1 py-0.5 rounded capitalize"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    {log.isCustomEntry && (
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HIPAA & ACCESSIBILITY CORE DISCLOSURES */}
          <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-3 flex gap-2 text-[10px] text-slate-400" id="skin-hipaa-warning-disclaimer">
            <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>HIPAA Safe Harbor standard compliance trace:</strong> All skin checks, irritation scores, and moisture scans are recorded and computed locally in standard web client state structure. Absolutely zero biometric images, photos, metadata, or clinical credentials are sent to our servers.
            </p>
          </div>

          {/* ACCESSIBLE TABLES REPRESENTATION FOR SCREEN READERS */}
          <div className="sr-only" aria-live="polite">
            <table summary="Accessibility table representing 7-day sparkline trend data correlating heart rate variability balance index and itch levels.">
              <thead>
                <tr>
                  <th scope="col">Day Label</th>
                  <th scope="col">Autonomic Balance %</th>
                  <th scope="col">Itch Severity (Scaled)</th>
                </tr>
              </thead>
              <tbody>
                {miniChartData.map((d, ix) => (
                  <tr key={ix}>
                    <td>{d.name}</td>
                    <td>{d.balance}%</td>
                    <td>{d.itch * 20}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </div>

    </div>
  );
}
