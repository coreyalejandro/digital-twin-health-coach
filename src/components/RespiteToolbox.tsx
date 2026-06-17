import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wind,
  CheckCircle,
  Clock,
  Sparkles,
  Info,
  Droplet,
  Shuffle,
  Sun,
  Activity,
  ChevronRight,
  ShieldAlert,
  Smartphone,
  Brain,
  Music,
  Heart,
  Smile
} from "lucide-react";
import { Vitals } from "../types";

interface RespiteToolboxProps {
  vitals: Vitals;
  setVitals: (v: Vitals) => void;
  balanceScore: number;
  activeThreshold: number;
  setInAppAlerts: React.Dispatch<React.SetStateAction<any[]>>;
}

interface Intervention {
  id: string;
  name: string;
  category: string;
  durationSec: number;
  icon: any;
  color: string;
  borderColor: string;
  bgColor: string;
  description: string;
  detailedGuide: string[];
  vitalImpact: {
    hrvBoost: number;
    hrDrop: number;
  };
}

export function RespiteToolbox({
  vitals,
  setVitals,
  balanceScore,
  activeThreshold,
  setInAppAlerts
}: RespiteToolboxProps) {
  const isHighStress = balanceScore < activeThreshold;

  const interventions: Intervention[] = [
    {
      id: "sigh",
      name: "Physiological Sigh Breathing",
      category: "🌬️ Vagal Restoration",
      durationSec: 60,
      icon: Wind,
      color: "text-teal-400",
      borderColor: "border-teal-500/20",
      bgColor: "bg-teal-950/20",
      description: "Two quick nasal inhales followed by one long, slow mouth sigh. Fastest way to reduce carbon dioxide and drop immediate pulse rate.",
      detailedGuide: [
        "Inhale deeply through your nose (expand chest)...",
        "Take a final quick 'sniff' at the very top to pop open lung alveoli...",
        "Exhale slowly and fully through your mouth with a soft sigh..."
      ],
      vitalImpact: { hrvBoost: 8, hrDrop: -4 }
    },
    {
      id: "vagal-splash",
      name: "Mammalian Dive Reflex Splash",
      category: "❄️ Cold Shock Cooldown",
      durationSec: 30,
      icon: Droplet,
      color: "text-blue-400",
      borderColor: "border-blue-500/20",
      bgColor: "bg-blue-950/20",
      description: "Splash cold tap water on your eyes and forehead. Stimulates cranial nerve X (Vagus nerve) to trigger bradycardia.",
      detailedGuide: [
        "Hold cool water in cupped hands...",
        "Gently lean in and splash over eyes, cheekbones, and ocular branch...",
        "Hold breath for 5 seconds while face is cooled...",
        "Dry off gently; feel your resting pulse stabilize."
      ],
      vitalImpact: { hrvBoost: 12, hrDrop: -5 }
    },
    {
      id: "circadian-gaze",
      name: "Circadian Outdoor Horizon Gaze",
      category: "🚶 Biophilic Grounding",
      durationSec: 120,
      icon: Sun,
      color: "text-amber-400",
      borderColor: "border-amber-500/20",
      bgColor: "bg-amber-950/20",
      description: "Step onto a balcony or by a window. Look at the farthest horizon point for visual un-focusing.",
      detailedGuide: [
        "Step away from all screen-telemetry light...",
        "Look into the distance towards natural outdoor landscapes...",
        "Relax your focus; allow peripheral vision to slide wide...",
        "Engage in passive rhythmic breathing for two full minutes."
      ],
      vitalImpact: { hrvBoost: 10, hrDrop: -3 }
    },
    {
      id: "somatic-shaking",
      name: "60s Somatic Trauma Release",
      category: "⚡ Neurogenic Dissipation",
      durationSec: 60,
      icon: Shuffle,
      color: "text-indigo-400",
      borderColor: "border-indigo-500/20",
      bgColor: "bg-indigo-950/20",
      description: "Loosely shake your hands, arms, and legs. Releases built-up emergency motor tension stored in major skeletal groups.",
      detailedGuide: [
        "Stand tall; drop your jaw completely...",
        "Begin shaking your wrists and fingers loosely...",
        "Extend the gentle tremor to your shoulders and neck bands...",
        "Bounce light feet shakes to rid excess adrenaline and pacing energy."
      ],
      vitalImpact: { hrvBoost: 6, hrDrop: -2 }
    },
    {
      id: "sensory-grounding",
      name: "5-4-3-2-1 Sensory Grounding",
      category: "🧠 Mindfulness Calibration",
      durationSec: 40,
      icon: Brain,
      color: "text-pink-400",
      borderColor: "border-pink-500/20",
      bgColor: "bg-pink-950/20",
      description: "A comprehensive somatic intake. Focus sequentially on 5 sights, 4 physical contacts, 3 sounds, 2 scents, and 1 taste to halt acute panic cycles.",
      detailedGuide: [
        "Acknowledge 5 visual textures or colors in your immediate sight lines...",
        "Feel 4 tactile surfaces (your clothes, chair support, skin warmths)...",
        "Name 3 distinct audiometric inputs (hum of a fan, birds, clock ticks)...",
        "Detect 2 subtle scent traces or air currents near you...",
        "Observe 1 real or imagined taste marker (mint, cool water, clear breath)..."
      ],
      vitalImpact: { hrvBoost: 9, hrDrop: -3 }
    },
    {
      id: "vagal-toning",
      name: "Vagal Coherent Humming",
      category: "🎵 Resonant Tone Toning",
      durationSec: 45,
      icon: Music,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/20",
      bgColor: "bg-emerald-950/20",
      description: "Create a continuous humming vibration on your exhalations. This physically stimulates vocal cord vagal sensory roots, halting panic-driven over-ventilation.",
      detailedGuide: [
        "Inhale quietly and fully through your nose...",
        "Exhale while producing a sustained, low-frequency 'Hummmm' sound...",
        "Feel the resonance vibrate inside your throat, chest wall, and sinus cavities...",
        "Exhaust your air supply fully, then begin the subsequent humming cycle..."
      ],
      vitalImpact: { hrvBoost: 11, hrDrop: -4 }
    },
    {
      id: "butterfly-tapping",
      name: "Butterfly Bilateral Tapping",
      category: "🌀 Bilateral Integration",
      durationSec: 50,
      icon: Heart,
      color: "text-rose-400",
      borderColor: "border-rose-500/20",
      bgColor: "bg-rose-950/20",
      description: "Form a butterfly shape to alternately tap opposite shoulders. Restores dual-hemisphere brain coordination and down-regulates adrenal firing.",
      detailedGuide: [
        "Cross your forearms over your chest, hooking thumbs to mirror wings...",
        "Place fingers flat on opposite upper shoulders or collarbone regions...",
        "Tap alternately (left, right, left, right) in slow rhythmic shifts...",
        "Let your breath find an even, untroubled nasal pacing rhythm..."
      ],
      vitalImpact: { hrvBoost: 7, hrDrop: -3 }
    },
    {
      id: "ocular-relaxation",
      name: "Ocular Peripheral Relaxation",
      category: "👁️ Brainstem Override",
      durationSec: 35,
      icon: Smile,
      color: "text-fuchsia-400",
      borderColor: "border-fuchsia-500/20",
      bgColor: "bg-fuchsia-950/20",
      description: "Keep head static while allowing visual awareness to expand sideways. This visual softening cues the reticular activating system to power down emergency alerting.",
      detailedGuide: [
        "Keep your head facing directly forward; select a single static focus spot...",
        "Soften your vision to consciously attend to the far left and right edges...",
        "Stay with this broad panoramic view without scanning left-to-right...",
        "Observe the soft relaxation expanding through your forehead, brows, and jaw musculature..."
      ],
      vitalImpact: { hrvBoost: 10, hrDrop: -4 }
    }
  ];

  // Active playing state
  const [activeIntervention, setActiveIntervention] = useState<Intervention | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [historyCount, setHistoryCount] = useState<number>(() => {
    return Number(localStorage.getItem("respite_toolbox_complete_count") || "0");
  });

  // Countdown timer for active intervention
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeIntervention && timeLeft > 0 && !isCompleted) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsCompleted(true);
            return 0;
          }
          // Increment guide steps depending on progress
          const totalSec = activeIntervention.durationSec;
          const progressRatio = (totalSec - (prev - 1)) / totalSec;
          const guideLength = activeIntervention.detailedGuide.length;
          const nextIdx = Math.min(guideLength - 1, Math.floor(progressRatio * guideLength));
          setCurrentStepIdx(nextIdx);
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeIntervention, timeLeft, isCompleted]);

  // Handle active completion
  const handleFinalize = () => {
    if (!activeIntervention) return;

    // 1. Calculate dynamic vitals boost
    const currentHr = vitals.restingHeartRate;
    const currentHrv = vitals.hrv;
    const nextHr = Math.max(52, currentHr + activeIntervention.vitalImpact.hrDrop);
    const nextHrv = Math.min(125, currentHrv + activeIntervention.vitalImpact.hrvBoost);

    // 2. Update parent state
    setVitals({
      ...vitals,
      restingHeartRate: nextHr,
      hrv: nextHrv
    });

    // 3. Add to alerts
    setInAppAlerts((prev) => [
      {
        id: Date.now().toString(),
        title: `💚 Respite Completed: ${activeIntervention.name}`,
        text: `Nervous system unburdened. Pulse decreased to ${nextHr} bpm. Heart Rate Variability (HRV) strengthened to ${nextHrv} ms.`,
        score: Math.min(100, Math.round(balanceScore + 8)),
        floor: activeThreshold
      },
      ...prev
    ]);

    // 4. Update local storage history
    const nextCount = historyCount + 1;
    setHistoryCount(nextCount);
    localStorage.setItem("respite_toolbox_complete_count", String(nextCount));

    // Reset interface
    setActiveIntervention(null);
    setIsCompleted(false);
  };

  return (
    <div className="bg-slate-950/80 border border-slate-900 rounded-3xl p-6 backdrop-blur-md shadow-xl flex flex-col justify-between leading-relaxed" id="respite-toolbox-panel">
      <div>
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-xs font-mono text-indigo-400 tracking-wider">REPLICABLE BIOMETRIC RELIEF</span>
            <h3 className="text-sm font-display font-semibold text-white">Emergency Respite Toolbox</h3>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-400/20 px-2 py-0.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-[#fbbf24] animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-indigo-300">{historyCount} Rescues Logged</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 mb-4 leading-normal">
          Autonomic bio-interventions engineered to restore heart mechanics and down-regulate physiological load.
        </p>

        {/* HIGH STRESS FLOATING TRIGGER BANNER */}
        <AnimatePresence>
          {isHighStress && !activeIntervention && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex gap-2.5 items-start text-[10.5px] leading-relaxed shadow-sm shadow-amber-500/5"
            >
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <span className="font-bold text-amber-300 block font-mono text-[9.5px] uppercase">Autonomic Guard Rail Triggered</span>
                <p className="text-slate-300 font-sans">
                  Autonomic balance has breached compensatory reserve threshold (<strong>{balanceScore}%</strong>). Execute a clinical self-care relief task below to restore parasympathetic safety limits.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTIVE COOLDOWN SCREEN */}
        <AnimatePresence mode="wait">
          {activeIntervention ? (
            <motion.div
              key="active-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-slate-900/50 border border-slate-900 rounded-2xl p-4 relative space-y-4 text-center overflow-hidden"
            >
              {/* Animated pulsating circular timer */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full border-4 border-slate-950/60 transition-all duration-500 ${
                  isCompleted ? "border-emerald-500/40" : "border-slate-850"
                }`}></div>
                {!isCompleted && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                    className={`absolute inset-1.5 rounded-full bg-slate-950/80 border border-slate-800/60 filter blur-sm`}
                  />
                )}
                <div className="relative z-10 space-y-0.5">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Timer</span>
                  <p className="text-xl font-mono font-extrabold text-white tracking-tighter">
                    {isCompleted ? "DONE" : `${timeLeft}s`}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">{activeIntervention.category}</span>
                <h4 className="text-xs font-display font-semibold text-white">{activeIntervention.name}</h4>
                
                {/* Steps Visual Progress */}
                <div className="p-3 bg-slate-950/60 border border-slate-900/60 rounded-xl min-h-[58px] flex items-center justify-center font-sans text-[10px] text-slate-350 leading-relaxed italic px-4">
                  {isCompleted ? (
                    <span className="text-emerald-400 font-bold font-mono">🎉 Safe recovery completed successfully. Take a slow deep sigh.</span>
                  ) : (
                    <span>"{activeIntervention.detailedGuide[currentStepIdx]}"</span>
                  )}
                </div>

                {/* Hidden live-region for screen readers to announce progress changes */}
                <div className="sr-only" aria-live="assertive">
                  {isCompleted ? "Routine completed. Apply relief metrics as needed." : `Step ${currentStepIdx + 1} of ${activeIntervention.detailedGuide.length}: ${activeIntervention.detailedGuide[currentStepIdx]}`}
                </div>
              </div>

              {/* Steps indicators */}
              <div className="flex justify-center gap-1.5">
                {activeIntervention.detailedGuide.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isCompleted 
                        ? "bg-emerald-500 w-3" 
                        : idx === currentStepIdx 
                          ? "bg-indigo-400 w-4 animate-pulse" 
                          : idx < currentStepIdx 
                            ? "bg-indigo-500/40 w-1.5" 
                            : "bg-slate-800 w-1.5"
                    }`}
                  />
                ))}
              </div>

              {/* Finish Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveIntervention(null);
                    setIsCompleted(false);
                  }}
                  className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-900 hover:border-slate-800 font-mono text-[9px] font-bold rounded-xl transition"
                >
                  Terminate Early
                </button>
                <button
                  type="button"
                  disabled={!isCompleted}
                  onClick={handleFinalize}
                  className={`flex-1 py-1.5 rounded-xl font-mono text-[9.5px] font-bold transition flex items-center justify-center gap-1 ${
                    isCompleted
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10"
                      : "bg-slate-900 border border-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Apply relief metrics
                </button>
              </div>
            </motion.div>
          ) : (
            /* INTERVENTION LIST CARD GRID */
            <motion.div
              key="list-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {interventions.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-2xl p-3.5 transition flex flex-col justify-between gap-3 ${item.borderColor} ${item.bgColor} ${
                        isHighStress 
                          ? "hover:border-amber-400/40 transition-colors shadow-sm shadow-indigo-500/[0.02]" 
                          : "hover:border-slate-800"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[8.5px] font-mono text-slate-400 font-bold uppercase tracking-wider">{item.category}</span>
                          <span className="text-[8.5px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {item.durationSec}s
                          </span>
                        </div>
                        <h4 className="text-xs font-display font-bold text-white flex items-center gap-1.5">
                          <ItemIcon className={`w-3.5 h-3.5 ${item.color}`} />
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-sans line-clamp-3">
                          {item.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveIntervention(item);
                          setTimeLeft(item.durationSec);
                          setCurrentStepIdx(0);
                          setIsCompleted(false);
                        }}
                        className={`w-full mt-1.5 py-1.5 px-3 border border-slate-800 text-[9.5px] font-mono font-bold rounded-xl hover:bg-slate-900 transition flex items-center justify-center gap-1.5 ${
                          isHighStress 
                            ? "bg-indigo-500 text-slate-950 border-transparent hover:bg-indigo-400 shadow-sm" 
                            : "bg-slate-950 text-slate-350"
                        }`}
                      >
                        Launch Routine <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* PHYSIOLOGICAL INFO TRACE */}
              <div className="bg-slate-900/15 border border-slate-900/60 rounded-2xl p-3 flex gap-2 text-[9px] text-slate-400">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Clinical efficacy trace:</strong> Respite tools physically shift visual focus states and trigger cardiopulmonary and blood gas compensations, allowing caregiver autonomic parameters to snap back to safe baselines rapidly under stressful biphasic pacing spikes.
                </p>
              </div>

              {/* CLINICAL CRISIS EMERGENCY SUPPORT PANEL */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-3 text-[9.5px] text-left" id="clinical-crisis-hotline-panel">
                <div className="flex items-center gap-1.5 mb-1 text-red-400 font-mono font-bold leading-none">
                  <ShieldAlert className="w-3.5 h-3.5 fill-red-500/15" />
                  <span>EMERGENCY CLINICAL COORDINATION BACKUP</span>
                </div>
                <p className="text-slate-400 mb-2 leading-relaxed font-sans">
                  If you are experiencing acute psychobiological fatigue, panic symptoms, or an active family crisis, execute immediate safety procedures. Let clinicians or professional hotlines coordinate with you.
                </p>
                <div className="flex flex-wrap gap-2 text-[9px] font-mono">
                  <a 
                    href="tel:988" 
                    className="bg-red-500 hover:bg-red-450 text-slate-950 font-bold px-2 py-0.5 rounded transition flex items-center gap-1 no-underline"
                    aria-label="Call 988 Mental Health Crisis Lifeline"
                  >
                    📞 Call/Text 988 Lifeline
                  </a>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    🌎 National Caregiver Support: <strong>1-800-445-8106</strong>
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
