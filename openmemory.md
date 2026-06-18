# OpenMemory Guide — Digital Twin Health Coach

**project_id:** `coreyalejandro/digital-twin-health-coach`  
**Repository:** https://github.com/coreyalejandro/digital-twin-health-coach  
**Branch:** `main`  
**Stack:** Vite + React 19 + Express + TypeScript + Tailwind CSS 4 + Google Gemini (`@google/genai`)

---

## Overview

Original **Google AI Studio** digital twin health coach prototype (restored on `main` at commit `19818a7`). Combines simulated wearable vitals, live environmental data (Open-Meteo), journal sentiment analysis, and Gemini-powered predictive coaching into a single autonomic balance dashboard.

A rebalanced safety build (SentinelOS governance, informed-consent model, 106 tests) exists in git history at `c488dcd` but is **not** the current `main` branch content.

**Run locally:** `npm install` → set `GEMINI_API_KEY` in `.env.local` → `npm run dev` (port 3000).

**AI Studio link:** https://ai.studio/apps/138596d9-7c47-441e-a8e1-2b8a9b86f188

---

## Architecture

```text
Browser (React SPA)
  ├── App.tsx — main dashboard, balance score engine, portal tabs
  ├── CaregiverDyadMonitor — caregiver-mother dyadic hub (consent-gated features)
  └── utils/environmentalApi.ts — client-side Open-Meteo fetch (weather + air quality)

Express server (server.ts, port 3000)
  ├── GET  /api/health — geminiConfigured flag
  ├── POST /api/predictive/journal-sentiment — Gemini structured JSON
  ├── POST /api/predictive/coach — vitals + environment correlation
  ├── POST /api/predictive/rebalance-plan — circadian recovery plan
  └── Vite middleware (dev) or static dist (production)

External APIs
  ├── Google Gemini (gemini-3.5-flash) — server-side only via GEMINI_API_KEY
  └── Open-Meteo — weather, AQI, pollen (no API key, client-side)
```

**Key design choices:**
- **Offline/demo fallback:** When `GEMINI_API_KEY` is missing or API calls fail, `App.tsx` uses hardcoded coaching/sentiment/rebalance responses so the UI remains interactive.
- **Autonomic Balance Score:** Computed client-side in `App.tsx` from vitals, environment, and journal sentiment penalties (0–100 scale).
- **Alert floor:** User-set threshold or AI-adjusted threshold; breach auto-triggers rebalance plan + coaching.
- **Secrets:** `.env*` gitignored except `.env.example`; never commit `.env.local`.

---

## User Defined Namespaces

- frontend
- backend
- ai-coaching
- caregiver-dyad

---

## Components

| Component | Path | Purpose |
| --------- | ---- | ------- |
| **App** | `src/App.tsx` | Main UI: vitals sliders, environment card, balance score, 30-day charts, AI coach panel, preset scenarios, notifications |
| **DigitalTwinVisualization** | `src/components/DigitalTwinVisualization.tsx` | Visual human body map with threat-system highlights |
| **CaregiverDyadMonitor** | `src/components/CaregiverDyadMonitor.tsx` | Caregiver-mother dyadic portal: consent UI, mood journal, skin check, respite toolbox, HTML report export |
| **CaregiverMoodJournal** | `src/components/CaregiverMoodJournal.tsx` | Caregiver mood logging sub-module |
| **SkinCheckModule** | `src/components/SkinCheckModule.tsx` | Skin check capture/analysis UI |
| **RespiteToolbox** | `src/components/RespiteToolbox.tsx` | Caregiver respite resources |
| **Express server** | `server.ts` | API routes, Gemini client lazy init, Vite dev middleware |
| **environmentalApi** | `src/utils/environmentalApi.ts` | Open-Meteo weather + air-quality aggregation |
| **reportGenerator** | `src/utils/reportGenerator.ts` | HTML report generation for dyad monitor |
| **Types** | `src/types.ts` | `Vitals`, `EnvironmentData`, `JournalSentiment`, `CoachingResponse`, `RebalancePlan`, `PresetScenario` |

---

## Patterns

### API route pattern (`server.ts`)
- Lazy `getGeminiClient()` throws if `GEMINI_API_KEY` unset.
- Gemini calls use `responseMimeType: "application/json"` + `responseSchema` for structured output.
- Model: `gemini-3.5-flash`.

### Balance score algorithm (`App.tsx` → `calculateBalanceScore`)
Penalties applied to base 100 from: RHR above baseline, HRV below baseline, sleep deficit, AQI/PM2.5, pollen, temperature/UV extremes, low luminous flux, journal sentiment (cognitive load + anxiety).

### Preset scenarios (`PRESETS` in `App.tsx`)
Three demo states: Optimal Homeostasis, Wildfire & Allergic Air Load, Severe Strain & Overtrained Sleep Deficit.

### Environment live fetch
`requestUserLocation()` → browser geolocation → `fetchLiveEnvironment(lat, lon)` → updates `environment` state.

### Build & deploy
- `npm run dev` — `tsx server.ts` with Vite HMR
- `npm run build` — Vite client build + esbuild server bundle → `dist/`
- `npm start` — production `node dist/server.cjs`

### Git / secrets hygiene
- `.gitignore` blocks `.env*` (allows `.env.example` only).
- `.cursor/rules/openmemory.mdc` excluded from git (IDE-local OpenMemory rules).

---

## Environment Variables

| Variable | Required | Location | Notes |
| -------- | -------- | -------- | ----- |
| `GEMINI_API_KEY` | For live AI | `.env.local` | Server loads `.env.local` then `.env` via dotenv; health endpoint exposes `geminiConfigured` boolean only |
| `APP_URL` | Optional | `.env.local` | AI Studio hosting URL |
| `NODE_ENV` | Auto | — | `production` serves static `dist/` |
| `DISABLE_HMR` | Optional | — | Set `true` to disable Vite HMR (`vite.config.ts`) |

---

## Git History Notes

| Commit | Description |
| ------ | ----------- |
| `ef305c2` | OpenMemory scaffold + gitignore Cursor rules |
| `19818a7` | **Current main:** restored original AI Studio interface |
| `c488dcd` | Rebalanced safety build (tests, SentinelOS) — preserved in history |
| `3414b44` | Initial platform scaffold |

**Security audit (2026-06-18):** `.env.local` has **never** been committed. Only `.env.example` (placeholder values) appears in git history.
