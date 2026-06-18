import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smile,
  Meh,
  Frown,
  BookOpen,
  Plus,
  Trash2,
  Brain,
  Quote,
  Sparkles,
  Heart,
  TrendingDown,
  Clock
} from "lucide-react";

export interface MoodLogEntry {
  id: string;
  timestamp: string;
  dateStr: string;
  mood: "smile" | "meh" | "frown";
  sentence: string;
  sentiment: {
    label: string;
    score: number; // 0-100 indicating positive valence
    color: string;
    bgColor: string;
  };
}

interface CaregiverMoodJournalProps {
  onLogAdded?: (log: MoodLogEntry) => void;
}

// Custom hook matching the local storage standard used in the monitor
function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prevVal: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Local storage state load failed for mood journal:", error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((prevVal: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error("Local storage sync failed for mood journal:", error);
    }
  };

  return [storedValue, setValue];
}

const DEFAULT_MOOD_HISTORY: MoodLogEntry[] = [
  {
    id: "mood-1",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Fri",
    mood: "smile",
    sentence: "Stable afternoon; we spent 20 minutes sitting in the back garden together listening to birds.",
    sentiment: { label: "Resilient & Calm", score: 85, color: "text-emerald-400 border-emerald-500/20", bgColor: "bg-emerald-500/10" }
  },
  {
    id: "mood-2",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Sat",
    mood: "meh",
    sentence: "Felt quite burnt out by noon, but standard breathing intervals helped settle my racing heart.",
    sentiment: { label: "Overburdened but Centered", score: 52, color: "text-amber-400 border-amber-500/20", bgColor: "bg-amber-500/10" }
  },
  {
    id: "mood-3",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    dateStr: "Sun",
    mood: "frown",
    sentence: "Very little sleep last night due to repetitive motor pacing flares; struggling to hold focus.",
    sentiment: { label: "Cognitive Fatigue Warning", score: 24, color: "text-rose-400 border-rose-500/20", bgColor: "bg-rose-500/10" }
  }
];

export function CaregiverMoodJournal({ onLogAdded }: CaregiverMoodJournalProps) {
  const [selectedMood, setSelectedMood] = useState<"smile" | "meh" | "frown">("meh");
  const [sentenceText, setSentenceText] = useState("");
  const [logs, setLogs] = useLocalStorage<MoodLogEntry[]>("caregiver_mood_logs_v1", DEFAULT_MOOD_HISTORY);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);

  // A light weight, client-side linguistic emotional classifier
  const analyzeSentiment = (text: string, moodType: "smile" | "meh" | "frown") => {
    const lower = text.toLowerCase();
    
    // Core weights
    const positiveKeywords = ["peaceful", "stable", "happy", "calm", "good", "balanced", "loved", "rested", "garden", "walk", "better"];
    const negativeKeywords = ["tired", "pacing", "struggling", "scared", "exhausted", "burnout", "difficult", "hard", "crying", "anxious", "sad"];

    let matchesPos = 0;
    let matchesNeg = 0;

    positiveKeywords.forEach(word => { if (lower.includes(word)) matchesPos++; });
    negativeKeywords.forEach(word => { if (lower.includes(word)) matchesNeg++; });

    let score = 50;
    if (moodType === "smile") score = 75 + matchesPos * 5 - matchesNeg * 5;
    else if (moodType === "frown") score = 25 + matchesPos * 5 - matchesNeg * 5;
    else score = 50 + matchesPos * 5 - matchesNeg * 5;

    // Constrain score
    score = Math.max(5, Math.min(95, score));

    let label = "Equilibrium Present";
    let color = "text-indigo-400 border-indigo-500/20";
    let bgColor = "bg-indigo-500/10";

    if (score >= 70) {
      label = "Adaptable & Grounded";
      color = "text-emerald-400 border-emerald-500/20";
      bgColor = "bg-emerald-500/10";
    } else if (score < 40) {
      label = "High Neural Saturation / Burnout Alert";
      color = "text-rose-400 border-rose-500/20";
      bgColor = "bg-rose-500/10";
    } else {
      label = "Reflective Neutrality";
      color = "text-amber-400 border-amber-500/20";
      bgColor = "bg-amber-500/10";
    }

    return { label, score, color, bgColor };
  };

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentenceText.trim()) return;

    const date = new Date();
    const daysStr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayLabel = daysStr[date.getDay()];

    const sentiment = analyzeSentiment(sentenceText, selectedMood);

    const newLog: MoodLogEntry = {
      id: "mood-" + Date.now(),
      timestamp: date.toISOString(),
      dateStr: dayLabel,
      mood: selectedMood,
      sentence: sentenceText.trim(),
      sentiment
    };

    setLogs([newLog, ...logs]);
    setSentenceText("");
    setHasLoggedToday(true);

    if (onLogAdded) {
      onLogAdded(newLog);
    }
  };

  const handleDeleteLog = (id: string) => {
    const updated = logs.filter(log => log.id !== id);
    setLogs(updated);
    if (!updated.some(log => {
      const logDate = new Date(log.timestamp).toDateString();
      const todayDate = new Date().toDateString();
      return logDate === todayDate;
    })) {
      setHasLoggedToday(false);
    }
  };

  // Aggregated mood statistics for dynamic analytics
  const moodBreakdown = useMemo(() => {
    if (logs.length === 0) return { smilePercent: 0, mehPercent: 0, frownPercent: 0, averageValence: 0 };
    let smiles = 0, mehs = 0, frowns = 0;
    let sumValence = 0;

    logs.forEach(l => {
      sumValence += l.sentiment.score;
      if (l.mood === "smile") smiles++;
      else if (l.mood === "meh") mehs++;
      else frowns++;
    });

    const total = logs.length;
    return {
      smilePercent: Math.round((smiles / total) * 100),
      mehPercent: Math.round((mehs / total) * 100),
      frownPercent: Math.round((frowns / total) * 100),
      averageValence: Math.round(sumValence / total)
    };
  }, [logs]);

  return (
    <div className="bg-slate-950/85 border border-slate-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden leading-relaxed" id="caregiver-mood-journal-module">
      {/* Background radial details */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/[0.01] rounded-full blur-2xl pointer-events-none"></div>

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-indigo-950/15">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-400 border border-indigo-500/25">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-md md:text-lg font-display font-bold text-white flex items-center gap-2">
              Caregiver Mood Journal & Mind State Log
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Daily single-sentence psychological grounding coupled with active valence sentiment tracking
            </p>
          </div>
        </div>

        {/* Dynamic average metric badge */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-2xl px-3 py-1 font-mono text-[10.5px]">
          <Brain className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">Mean Valence:</span>
          <span className={moodBreakdown.averageValence > 60 ? "text-emerald-400" : moodBreakdown.averageValence < 40 ? "text-rose-400" : "text-amber-400"}>
            {moodBreakdown.averageValence}%
          </span>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* JOURNAL INPUT (5 Cols) */}
        <form onSubmit={handleCreateEntry} className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div>
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block mb-2">
              1. Choose Core Emotional Profile
            </label>
            
            {/* Visual Mood Selector buttons */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { type: "smile", label: "Resilient / Grounded", icon: Smile, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 active:border-emerald-500/60" },
                { type: "meh", label: "Fatigued / Neutral", icon: Meh, color: "text-amber-400 bg-amber-500/10 border-amber-500/20 active:border-amber-500/60" },
                { type: "frown", label: "Overloaded / Stressed", icon: Frown, color: "text-rose-400 bg-rose-500/10 border-rose-500/20 active:border-rose-500/60" }
              ].map(item => {
                const isSelected = selectedMood === item.type;
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedMood(item.type as any)}
                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 select-none ${
                      isSelected
                        ? item.color + " ring-1 ring-slate-800"
                        : "bg-slate-900/40 border-slate-900 text-slate-500 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[9px] uppercase tracking-wider font-mono font-extrabold">{item.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block mb-2">
              2. Capture 1-Sentence Daily Check-in
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={140}
                value={sentenceText}
                onChange={e => setSentenceText(e.target.value)}
                placeholder="We sat near the open window; felt a serene summer breeze..."
                className="w-full bg-slate-900/40 border border-slate-900 focus:border-indigo-500/40 rounded-2xl p-3.5 pr-14 text-xs font-sans text-white placeholder-slate-600 focus:outline-none transition leading-relaxed"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-600">
                {sentenceText.length}/140
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono mt-1 w-full text-right leading-none">
              A single grounding thought builds steady daily mental clarity.
            </p>
          </div>

          <button
            type="submit"
            disabled={hasLoggedToday || !sentenceText.trim()}
            className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              hasLoggedToday
                ? "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
                : "bg-indigo-500 text-slate-950 hover:bg-indigo-400 font-extrabold shadow-md shadow-indigo-500/10"
            }`}
          >
            <Plus className="w-4 h-4" />
            {hasLoggedToday ? "Grounding Entry Saved Today" : "Submit Quiet Thought"}
          </button>
        </form>

        {/* JOURNAL HISTORY & ANALYTICS (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-5 col-span-1">
          
          {/* MOOD TREND ANALYTICS */}
          <div className="grid grid-cols-3 gap-2 bg-slate-900/30 p-3 rounded-2xl border border-slate-900">
            <div className="text-center">
              <span className="text-[8px] font-mono text-slate-500 uppercase block">Resilience Ratio</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{moodBreakdown.smilePercent}%</span>
              <div className="w-full bg-slate-950 h-1 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${moodBreakdown.smilePercent}%` }} />
              </div>
            </div>
            <div className="text-center border-l border-r border-slate-900/65 px-2">
              <span className="text-[8px] font-mono text-slate-500 uppercase block">Neutral Dwell</span>
              <span className="text-sm font-mono font-bold text-amber-400">{moodBreakdown.mehPercent}%</span>
              <div className="w-full bg-slate-950 h-1 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${moodBreakdown.mehPercent}%` }} />
              </div>
            </div>
            <div className="text-center">
              <span className="text-[8px] font-mono text-slate-500 uppercase block">Saturation Peak</span>
              <span className="text-sm font-mono font-bold text-rose-400">{moodBreakdown.frownPercent}%</span>
              <div className="w-full bg-slate-950 h-1 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-rose-400" style={{ width: `${moodBreakdown.frownPercent}%` }} />
              </div>
            </div>
          </div>

          {/* STREAM LIST OF CHRONICLES */}
          <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {logs.map((log) => {
                const MoodIcon = log.mood === "smile" ? Smile : log.mood === "meh" ? Meh : Frown;
                const moodColors = {
                  smile: "text-emerald-400 border-emerald-500/10 bg-emerald-500/5",
                  meh: "text-amber-400 border-amber-500/10 bg-amber-500/5",
                  frown: "text-rose-400 border-rose-500/10 bg-rose-500/5"
                };

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="p-3 bg-slate-950 border border-slate-900/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 rounded-xl border shrink-0 ${moodColors[log.mood]}`}>
                        <MoodIcon className="w-4 h-4" />
                      </div>
                      
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500 font-bold">{log.dateStr} Check-in</span>
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded-full border truncate font-mono ${log.sentiment.color} ${log.sentiment.bgColor}`}>
                            {log.sentiment.label} ({log.sentiment.score}%)
                          </span>
                        </div>
                        <p className="text-slate-300 font-sans italic text-[11px] leading-relaxed break-words">
                          "{log.sentence}"
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="text-slate-600 hover:text-rose-400 p-1 shrink-0 self-end sm:self-auto transition-colors"
                      title="Clear thought entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {logs.length === 0 && (
              <div className="h-20 flex flex-col items-center justify-center border border-dashed border-slate-900 rounded-2xl text-slate-500 text-xs font-mono">
                <Quote className="w-4 h-4 text-slate-600 mb-1" />
                No daily grounding logs entered yet.
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
