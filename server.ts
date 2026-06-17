import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Lazy initialization of Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required to execute AI Coaching.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// 1. API Health & Configuration Endpoint
app.get("/api/health", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: "ok",
    geminiConfigured: hasKey,
    timestamp: new Date().toISOString()
  });
});

// 2. Journal & Voice Memo Sentiment Extraction Endpoint
app.post("/api/predictive/journal-sentiment", async (req, res) => {
  try {
    const { journalText } = req.body;
    if (!journalText || String(journalText).trim() === "") {
      return res.status(400).json({ error: "Journal text is required." });
    }

    const ai = getGeminiClient();
    const systemPrompt = `You are a clinical psychology AI specialized in health informatics. 
Analyze the provided user journal entry to extract linguistic markers of stress, anxiety, burnout, sleep quality, and active coping mechanisms. 
Identify markers before the user is consciously overwhelmed. Return your response in clear, strict JSON format with the following keys:
- cognitiveLoad: integer from 0 (calm) to 100 (severe mental exhaustion)
- anxietyLevel: integer from 0 to 100
- burnoutRisk: integer from 0 to 100
- primaryEmotion: string representing the primary emotional undertone
- linguisticMarkers: array of short strings pointing out specific marker phrases or traits detected in the text
- briefSummary: a 1-sentence assessment of their current psychological homeostasis.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Journal entry to analyze: "${journalText}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cognitiveLoad: { type: Type.INTEGER, description: "Mental exertion score from 0 to 100" },
            anxietyLevel: { type: Type.INTEGER, description: "Anxiety/stress score from 0 to 100" },
            burnoutRisk: { type: Type.INTEGER, description: "Burnout risk score from 0 to 100" },
            primaryEmotion: { type: Type.STRING, description: "Identified primary emotion" },
            linguisticMarkers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Phrases or voice sentiment indicators detected in text"
            },
            briefSummary: { type: Type.STRING, description: "A concise 1-sentence psychological assessment" }
          },
          required: ["cognitiveLoad", "anxietyLevel", "burnoutRisk", "primaryEmotion", "linguisticMarkers", "briefSummary"]
        }
      }
    });

    const rating = JSON.parse(response.text || "{}");
    res.json(rating);
  } catch (error: any) {
    console.error("Journal Sentiment Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze journal sentiment." });
  }
});

// 3. Proactive AI Coaching & Predictions Endpoint (Correlating Vitals and Environmental data)
app.post("/api/predictive/coach", async (req, res) => {
  try {
    const { vitals, environment, journalSentiment, historyBaselines, balanceScore, activeThreshold } = req.body;

    const ai = getGeminiClient();
    const currentScore = balanceScore !== undefined ? balanceScore : 75;
    const thresholdLimit = activeThreshold !== undefined ? activeThreshold : 70;
    const isBreached = currentScore < thresholdLimit;

    const systemPrompt = `You are a predictive Digital Twin AI Health Coach. Your goal is to analyze current physiology (vitals) alongside local physical environment loads (weather, air quality, allergens) to detect subtle deviations from the user's computed homeostasis baseline of the previous 14-30 days.

Establish a holistic prediction correlating:
1. Physiology: HRV, resting heart rate, sleep duration, respiratory rate, and oxygen saturation.
2. Environmental load: Air Quality Index (AQI), PM2.5, Nitrogen Dioxide (NO2), allergen levels (Birch, Grass), UV Index, temperature, and light levels (luminous flux).
3. Psychological states: Cognitive load and anxiety levels retrieved from recent logging.

ALERT MONITORING TASK:
You must explicitly monitor the user's Autonomic Balance Score (currently ${currentScore}/100) against their safety alert threshold (currently ${thresholdLimit}/100). 
${isBreached ? `⚠️ WARNING: The user's Balance Score has fallen below their alert threshold! You MUST treat this as an active homeostatic emergency. Flag anomalyDetected=true, list the threshold breach as a high-priority deviation in 'detectedDeviations', and write a targeted, empathetic, but urgent coaching nudge starting with a clear reference to the score of ${currentScore} breaching the threshold level of ${thresholdLimit}.` : `The user's Balance Score is stable above their alert threshold.`}

Formulate a predictive alert explaining the bodily impacts in the next 12-24 hours and supply action-guided advice.

Return your response in strict JSON format with the following keys:
- anomalyDetected: boolean (true if resting heart rate, HRV, sleep, or air quality deviates from baseline by over 10-15%, OR if their balanceScore has breached their alert threshold)
- detectedDeviations: array of strings detailing which vitals/environmental fields are off-normal (e.g. "Resting HR is 11% above homeostasis zone", "PM2.5 is high", or "Autonomic Balance Score of ${currentScore} breached safety threshold of ${thresholdLimit}")
- predictiveInsight: a 2-sentence explanation of what physical or stress events are highly probable in the next 24 hours (e.g., respiratory flare-up, mental fatigue crash, physical overtraining danger)
- customizedAdvice: a bulleted list of 3 highly-actionable, proactive rebalance steps (e.g., skip the high-intensity trail run, run air purifier, take 15 mins of direct soft morning light for circadian repair)
- coachNudgeText: a friendly, highly professional, direct 2-3 sentence coaching reminder. Ground it strictly in the exact parameters supplied. If breached, mention the score ${currentScore} and threshold ${thresholdLimit} directly.
- physicalThreatSystems: array of strings mentioning affected body networks (e.g., "respiratory", "cardiovascular", "nervous-system", "circadian-rythms")`;

    const instructions = `
    CURRENT USER PROFILE & VITALS:
    - Resting Heart Rate (RHR): ${vitals.restingHeartRate} bpm (Normal Baseline: ${historyBaselines.restingHeartRate} bpm)
    - Heart Rate Variability (HRV): ${vitals.hrv} ms (Normal Baseline: ${historyBaselines.hrv} ms)
    - Sleep Duration: ${vitals.sleepDuration} hrs (Normal Baseline: ${historyBaselines.sleepDuration} hrs)
    - Respiratory Rate: ${vitals.respiratoryRate} /min (Normal Baseline: ${historyBaselines.respiratoryRate} /min)
    - SpO2: ${vitals.spo2}%
    - Cognitive State: Load=${journalSentiment?.cognitiveLoad || 30}, Anxiety=${journalSentiment?.anxietyLevel || 20}, Burnout Risk=${journalSentiment?.burnoutRisk || 15}
    - Balance Score: ${currentScore}/100, Safety Threshold: ${thresholdLimit}/100
    
    LOCAL OUTDOOR ENVIRONMENTAL DATA:
    - Weather: ${environment.weatherCondition}, Temp: ${environment.temperature}°C, UV Index: ${environment.uvIndex}
    - Air Quality Index (AQI): ${environment.aqi}
    - PM2.5 level: ${environment.pm25} µg/m³
    - Ozone (O3): ${environment.ozone} µg/m³
    - Nitrogen Dioxide (NO2): ${environment.no2} µg/m³
    - Birch Pollen: ${environment.birchPollen || 0} grains/m³
    - Grass Pollen: ${environment.grassPollen || 0} grains/m³
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Perform Digital Twin Predictive Correlation Analysis and Coaching for this input data:\n${instructions}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            anomalyDetected: { type: Type.BOOLEAN },
            detectedDeviations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            predictiveInsight: { type: Type.STRING, description: "2-sentence scientific prediction of physical state shifts" },
            customizedAdvice: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 direct bullet points to rebalance physical loads"
            },
            coachNudgeText: { type: Type.STRING, description: "Friendly, direct, scientifically-sound AI Coach text" },
            physicalThreatSystems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Vulnerable physiological networks (e.g., respiratory, nervous, etc.)"
            }
          },
          required: ["anomalyDetected", "detectedDeviations", "predictiveInsight", "customizedAdvice", "coachNudgeText", "physicalThreatSystems"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Coaching API Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate coaching suggestions." });
  }
});

// 4. Personalized "Rebalance Plan" Generator Endpoint
app.post("/api/predictive/rebalance-plan", async (req, res) => {
  try {
    const { vitals, environment, journalSentiment, balanceScore } = req.body;

    const ai = getGeminiClient();
    const systemPrompt = `You are a clinical-grade sports physiology and environment-health rebalance counselor.
The user's cumulative Digital Twin Balance Score has dipped to ${balanceScore}/100.
Create an immediate tactical morning-to-night "Circadian Rebalance Plan" (a recovery program) designed to downregulate stress, bypass environmental toxins, and restore autonomic homeostasis.

Keep the tone expert, compassionate, and precise. No generic guidance. Ground it in their vital deviations and environmental loads.
Return your response in strict JSON format with the following keys:
- recoveryTitle: a motivating, personalized therapy title (e.g., "Autonomic Restoration Plan", "Cardiorespiratory Rescue Routine")
- morningProtocol: string detailing exact morning actions
- afternoonProtocol: string detailing exact afternoon environmental adaptation
- eveningProtocol: string detailing precise evening parasympathetic trigger
- biofeedbackReasoning: a 2-sentence metabolic validation explaining why these protocols will physically reverse their vitals dip.`;

    const parsedInput = `vitals: ${JSON.stringify(vitals)}, environment: ${JSON.stringify(environment)}, mind: ${JSON.stringify(journalSentiment)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Create physical Circadian Rebalance Plan for:\n${parsedInput}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recoveryTitle: { type: Type.STRING },
            morningProtocol: { type: Type.STRING },
            afternoonProtocol: { type: Type.STRING },
            eveningProtocol: { type: Type.STRING },
            biofeedbackReasoning: { type: Type.STRING }
          },
          required: ["recoveryTitle", "morningProtocol", "afternoonProtocol", "eveningProtocol", "biofeedbackReasoning"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Rebalance Plan Error:", error);
    res.status(500).json({ error: error.message || "Failed to compile Rebalance Plan." });
  }
});

// 5. Serve Vite Assets in Production or proxy in Dev
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Digital Twin Health Coach server listening on http://localhost:${PORT}`);
  });
}

startServer();
