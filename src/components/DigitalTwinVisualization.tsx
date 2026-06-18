import React from "react";
import { Vitals, EnvironmentData, JournalSentiment } from "../types";

interface DigitalTwinVisProps {
  vitals: Vitals;
  environment: EnvironmentData;
  journalSentiment: JournalSentiment | null;
  baselines: Vitals;
  threatSystems: string[];
}

export const DigitalTwinVisualization: React.FC<DigitalTwinVisProps> = ({
  vitals,
  environment,
  journalSentiment,
  baselines,
  threatSystems,
}) => {
  // Analyze current state compared to baseline
  const rhrDiff = ((vitals.restingHeartRate - baselines.restingHeartRate) / baselines.restingHeartRate) * 100;
  const hrvDiff = ((vitals.hrv - baselines.hrv) / baselines.hrv) * 100;
  const sleepDiff = ((vitals.sleepDuration - baselines.sleepDuration) / baselines.sleepDuration) * 100;

  // Cardiovascular Stress Check (e.g. high RHR, low HRV)
  const isCardioStressed = rhrDiff > 10 || hrvDiff < -15 || threatSystems.includes("cardiovascular");
  // Respiratory Stress Check (e.g. high PM2.5, respiratory rate deviations)
  const isRespiratoryStressed = environment.aqi > 100 || environment.pm25 > 35 || vitals.respiratoryRate > baselines.respiratoryRate + 2 || threatSystems.includes("respiratory");
  // Cognitive / Nervous system Stress Check
  const cognitiveVal = journalSentiment?.cognitiveLoad ?? 30;
  const anxietyVal = journalSentiment?.anxietyLevel ?? 20;
  const isNervousStressed = cognitiveVal > 60 || anxietyVal > 55 || threatSystems.includes("nervous-system");
  // Circadian / Pineal Stress Check (insufficient sleep, poor light exposure status)
  const isCircadianStressed = sleepDiff < -15 || (environment.luminousFlux < 500 && vitals.sleepDuration < 6.5) || threatSystems.includes("circadian-rythms") || threatSystems.includes("circadian");

  // Colors based on stress levels
  const getColor = (isStressed: boolean) => {
    return isStressed ? "text-rose-500 fill-rose-500/20 stroke-rose-500" : "text-emerald-400 fill-emerald-400/10 stroke-emerald-400";
  };

  const getGlowId = (isStressed: boolean, name: string) => {
    return isStressed ? `glow-red-${name}` : `glow-green-${name}`;
  };

  return (
    <div className="relative bg-slate-950/60 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-between text-white overflow-hidden shadow-2xl h-full backdrop-blur-md">
      {/* Background Grid Lines & Futuristic Elements */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-teal-500/5 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,41,59,0.3)_0%,rgba(3,7,18,0.7)_100%)] pointer-events-none" />
      
      {/* Dynamic scan line effect */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/20 to-transparent animate-bounce pointer-events-none" style={{ animationDuration: '8s' }} />

      {/* Header and Telemetry Indicators */}
      <div className="w-full flex justify-between items-start z-10">
        <div>
          <span className="text-xs font-mono text-teal-400 tracking-widest uppercase">System Twin</span>
          <h3 className="text-xl font-display font-semibold tracking-tight">Active Homeostasis Map</h3>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${threatSystems.length > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'} `} />
            <span className="text-xs font-mono text-slate-400">
              {threatSystems.length > 0 ? "DEVIATION ALERT" : "HOMEOSTASIS STABLE"}
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-500 mt-1">BIOMETRIC RECONSTRUCTION LIVE</p>
        </div>
      </div>

      {/* SVG Body Render Container */}
      <div className="relative w-full max-w-[280px] h-[360px] my-4 flex items-center justify-center z-10">
        {/* SVG Interactive Human Wireframe */}
        <svg
          viewBox="0 0 100 150"
          className="w-full h-full select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* SVG Filters for Futuristic Cyber Glows */}
            <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Reference Circular Radar Rings */}
          <circle cx="50" cy="75" r="45" className="stroke-slate-900 fill-none" strokeWidth="0.5" strokeDasharray="3 3" />
          <circle cx="50" cy="75" r="30" className="stroke-slate-900/60 fill-none" strokeWidth="0.5" />
          <circle cx="50" cy="75" r="15" className="stroke-slate-900/30 fill-none" strokeWidth="0.5" strokeDasharray="1 5" />
          
          {/* Main Axis Telemetry Matrix */}
          <line x1="50" y1="5" x2="50" y2="145" className="stroke-slate-900/40" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="5" y1="75" x2="95" y2="75" className="stroke-slate-900/40" strokeWidth="0.5" strokeDasharray="2 2" />

          {/* HUMAN BODY OUTLINE WIREFRAME (Stylized Aesthetic Polygonal / Curved Path) */}
          <g className="transition-all duration-700">
            {/* Human silhouette paths */}
            <path
              d="M 50 15 
                 C 47 15, 45 17, 45 20
                 C 45 23, 47 25, 50 25
                 C 53 25, 55 23, 55 20
                 C 55 17, 53 15, 50 15 Z"
              className="stroke-slate-800 fill-slate-950/45"
              strokeWidth="0.50"
            />
            {/* Neck to shoulders */}
            <path
              d="M 50 25 
                 C 50 27, 47 28, 44 29
                 L 30 31
                 C 28 32, 27 34, 27 36
                 L 27 45
                 C 27 47, 28 48, 29 48
                 L 31 48
                 C 32 46, 32 44, 32 41
                 L 33 55
                 L 31 75
                 L 27 95
                 C 26 100, 29 101, 30 96
                 L 33 78
                 L 35 60
                 L 36 85
                 L 36 120
                 L 34 142
                 C 34 145, 37 145, 38 142
                 L 41 120
                 L 45 85
                 L 50 85
                 L 55 85
                 L 59 120
                 L 62 142
                 C 63 145, 66 145, 66 142
                 L 64 120
                 L 64 85
                 L 65 60
                 L 67 78
                 L 70 96
                 C 71 101, 74 100, 73 95
                 L 69 75
                 L 67 55
                 L 68 41
                 C 68 44, 68 46, 69 48
                 L 71 48
                 C 72 48, 73 47, 73 45
                 L 73 36
                 C 73 34, 72 32, 70 31
                 L 56 29
                 C 53 28, 50 27, 50 25 Z"
              className="stroke-slate-800 fill-slate-950/25"
              strokeWidth="0.75"
            />
          </g>

          {/* SYSTEM OVERLAYS & NODE RECONSTRUCTIONS */}
          
          {/* 1. BRAIN (Nervous System Map) - Node at Head */}
          <g className={`transition-all duration-500 cursor-pointer`}>
            <circle
              cx="50"
              cy="20"
              r="2.5"
              className={`transition-colors duration-500 ${getColor(isNervousStressed)}`}
              filter={isNervousStressed ? "url(#glow-red)" : "url(#glow-green)"}
              strokeWidth="0.75"
            />
            {/* Brain signal ripples */}
            <circle
              cx="50"
              cy="20"
              r="5"
              className={`fill-none stroke-2 stroke-current opacity-30 ${isNervousStressed ? 'stroke-rose-500 animate-ping' : 'stroke-emerald-400 opacity-20'}`}
              style={{ animationDuration: '3s' }}
            />
          </g>

          {/* 2. CARDIOVASCULAR (Heart node) */}
          <g className="transition-all duration-500">
            {/* Pulsing visual core linked to current Heart Rate */}
            <circle
              cx="50"
              cy="39"
              r="3"
              className={`transition-colors duration-500 ${getColor(isCardioStressed)}`}
              filter={isCardioStressed ? "url(#glow-red)" : "url(#glow-green)"}
              strokeWidth="1"
            />
            <circle
              cx="50"
              cy="39"
              r="6.5"
              className={`fill-none stroke-1 transition-colors duration-500 ${isCardioStressed ? 'stroke-rose-500 animate-heartbeat' : 'stroke-emerald-400/50 animate-pulse'}`}
            />
            {/* Auxiliary heart wiring paths */}
            <path d="M 50 39 Q 47 45 42 45 M 50 39 Q 53 45 58 45" className={`fill-none ${isCardioStressed ? 'stroke-rose-500/40' : 'stroke-emerald-500/20'}`} strokeWidth="0.5" />
          </g>

          {/* 3. RESPIRATORY (Lungs node) */}
          <g className="transition-all duration-500">
            <path
              d="M 45 35 L 48 38 L 48 42 L 44 44 Z M 55 35 L 52 38 L 52 42 L 56 44 Z"
              className={`transition-colors duration-500 border fill-current ${isRespiratoryStressed ? 'text-rose-500/30 stroke-rose-500' : 'text-emerald-400/10 stroke-emerald-400/60'}`}
              strokeWidth="0.5"
            />
            <circle
              cx="44"
              cy="40"
              r="1.5"
              className={`transition-all duration-500 ${getColor(isRespiratoryStressed)}`}
              strokeWidth="0.5"
            />
            <circle
              cx="56"
              cy="40"
              r="1.5"
              className={`transition-all duration-500 ${getColor(isRespiratoryStressed)}`}
              strokeWidth="0.5"
            />
          </g>

          {/* 4. CIRCADIAN CLOCK / METABOLIC (Adrenal-endocrine / Pineal) - Core centered node */}
          <g className="transition-all duration-500">
            <circle
              cx="50"
              cy="52"
              r="2"
              className={`transition-colors duration-500 ${getColor(isCircadianStressed)}`}
              filter={isCircadianStressed ? "url(#glow-red)" : "url(#glow-green)"}
              strokeWidth="0.5"
            />
            <line x1="50" y1="52" x2="38" y2="52" className={`stroke-1 ${isCircadianStressed ? 'stroke-rose-500/30' : 'stroke-emerald-500/20'}`} strokeDasharray="1 1" />
          </g>

          {/* EXPLANATORY GRAPHICAL CALLOUT LEADERS */}
          {/* L1: NERVOUS SYSTEM */}
          <line x1="50" y1="20" x2="16" y2="20" className={`stroke-[0.5] ${isNervousStressed ? 'stroke-rose-500' : 'stroke-slate-700'}`} />
          <circle cx="16" cy="20" r="1" className={isNervousStressed ? "fill-rose-500" : "fill-slate-600"} />

          {/* L2: RESPIRATORY */}
          <line x1="44" y1="40" x2="14" y2="46" className={`stroke-[0.5] ${isRespiratoryStressed ? 'stroke-rose-500' : 'stroke-slate-700'}`} />
          <circle cx="14" cy="46" r="1" className={isRespiratoryStressed ? "fill-rose-500" : "fill-slate-600"} />

          {/* L3: CARDIOVASCULAR */}
          <line x1="50" y1="39" x2="84" y2="34" className={`stroke-[0.5] ${isCardioStressed ? 'stroke-rose-500' : 'stroke-slate-700'}`} />
          <circle cx="84" cy="34" r="1" className={isCardioStressed ? "fill-rose-500" : "fill-slate-600"} />

          {/* L4: CIRCADIAN / ENDOCRINE */}
          <line x1="50" y1="52" x2="82" y2="58" className={`stroke-[0.5] ${isCircadianStressed ? 'stroke-rose-500' : 'stroke-slate-700'}`} />
          <circle cx="82" cy="58" r="1" className={isCircadianStressed ? "fill-rose-500" : "fill-slate-600"} />
        </svg>

        {/* Dynamic labels floating on SVG bounding box edges */}
        
        {/* Top Left: Brain/Mind */}
        <div className="absolute top-[3%] left-[2%] text-left">
          <p className="text-[10px] font-mono text-slate-400">CNS / MENTAL LOAD</p>
          <p className={`text-xs font-display font-medium ${isNervousStressed ? 'text-rose-400' : 'text-emerald-400'}`}>
            {isNervousStressed ? `Overloaded (${cognitiveVal}%)` : `Optimal (${cognitiveVal}%)`}
          </p>
        </div>

        {/* Mid Left: Lungs/Respiratory */}
        <div className="absolute top-[23%] left-[1%] text-left">
          <p className="text-[10px] font-mono text-slate-400">RESPIRATORY SYSTEM</p>
          <p className={`text-xs font-display font-medium ${isRespiratoryStressed ? 'text-rose-400' : 'text-emerald-400'}`}>
            {isRespiratoryStressed ? "Elevated Load" : "Steady Flow"}
          </p>
          <p className="text-[8px] font-mono text-slate-500">AQI Load: {environment.aqi}, RR: {vitals.respiratoryRate}/m</p>
        </div>

        {/* Mid Right: Heart/Cardio */}
        <div className="absolute top-[17%] right-[1%] text-right font-sans">
          <p className="text-[10px] font-mono text-slate-400">AUTONOMIC / HEART</p>
          <p className={`text-xs font-display font-medium ${isCardioStressed ? 'text-rose-400' : 'text-emerald-400'}`}>
            {isCardioStressed ? "Deviation" : "Homeostatic"}
          </p>
          <p className="text-[8px] font-mono text-slate-500">{vitals.restingHeartRate} bpm | HRV {vitals.hrv}ms</p>
        </div>

        {/* Lower Right: Circadian Clock */}
        <div className="absolute top-[36%] right-[1%] text-right">
          <p className="text-[10px] font-mono text-slate-400">CIRCADIAN RETINA CLOCK</p>
          <p className={`text-xs font-display font-medium ${isCircadianStressed ? 'text-rose-400' : 'text-emerald-400'}`}>
            {isCircadianStressed ? "Disrupted" : "Synchronized"}
          </p>
          <p className="text-[8px] font-mono text-slate-500">Light: {environment.luminousFlux} lx</p>
        </div>
      </div>

      {/* Footer System Summary Overlay */}
      <div className="w-full bg-slate-900/40 border border-slate-900 rounded-2xl p-3 z-10">
        <h4 className="text-xs font-mono text-teal-400 uppercase tracking-wider mb-2">Internal vs External Integration</h4>
        <div className="grid grid-cols-2 gap-2 text-left">
          <div>
            <p className="text-[9px] font-mono text-slate-500">PHYSICAL ZONE</p>
            <p className="text-xs font-medium text-slate-300">
              RHR Variation: <span className={rhrDiff > 10 ? "text-rose-400" : "text-emerald-400"}>+{rhrDiff.toFixed(1)}%</span>
            </p>
            <p className="text-xs font-medium text-slate-300">
              HRV Stable: <span className={hrvDiff < -15 ? "text-rose-400" : "text-emerald-400"}>{hrvDiff > 0 ? "+" : ""}{hrvDiff.toFixed(0)}%</span>
            </p>
          </div>
          <div>
            <p className="text-[9px] font-mono text-slate-500">ENV SHIELD</p>
            <p className="text-xs font-medium text-slate-300">
              Outdoor PM2.5: <span className={environment.pm25 > 35 ? "text-rose-400" : "text-emerald-400"}>{environment.pm25} µg/m³</span>
            </p>
            <p className="text-xs font-medium text-slate-300">
              Total Pollen: <span className="text-slate-200">{environment.birchPollen + environment.grassPollen} gr/m³</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
