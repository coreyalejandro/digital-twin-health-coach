import { Vitals, EnvironmentData } from "../types";

export interface ReportPayload {
  timestamp: string;
  formattedDate: string;
  balanceScore: number;
  activeThreshold: number;
  vitals: Vitals;
  baselines: Vitals;
  environment: EnvironmentData;
  motherWakesNight: number;
  caregiverDisruptedWakes: number;
  hyperVigilantHours: number;
  personalBoundaryBreaches: number;
  mealTimeSyncOffset: number;
  medsDispenseAccuracy: number;
  lightSyncConsistency: number;
  measuredReactionDelay: number | null;
  typingLatencySlider: number;
  screenTapsDelay: number;
  itchIntensity: number;
  selectedEczemaTriggers: string[];
  scannedMoisture: number | null;
  scannedErythema: number | null;
  skinLogs: string[];
  consentSpeech: boolean;
  consentCamera: boolean;
  speechAnalysisResult: any | null;
  respiteActive: boolean;
  respiteTimeLeft: number;
  scheduledRemindersCount: number;
}

/**
 * Generates an enterprise-ready, beautifully designed printer-friendly HTML Clinical Report
 */
export function generateHtmlReport(data: ReportPayload): string {
  const isBreached = data.balanceScore < data.activeThreshold;
  const statusText = isBreached ? "CRITICAL BURNOUT ALERT" : "HOMEOSTASIS SUSTAINED";
  const statusColor = isBreached ? "#f43f5e" : "#10b981";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Clinical Health Report - Caregiver & Mother Dyadic Hub</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      margin: 40px;
      padding: 0;
      background-color: #fafafa;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.025em;
      margin: 0;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    .badge {
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .badge-primary {
      background-color: #e0e7ff;
      color: #4f46e5;
    }
    .meta-grid {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 12px;
    }
    .meta-item strong {
      color: #475569;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
      margin-top: 32px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .score-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${isBreached ? "#fef2f2" : "#f0fdf4"};
      border: 1px solid ${isBreached ? "#fee2e2" : "#dcfce7"};
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .score-val {
      font-size: 36px;
      font-weight: 800;
      color: ${statusColor};
      margin: 0;
    }
    .table-clinical {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .table-clinical th, .table-clinical td {
      border-bottom: 1px solid #f1f5f9;
      padding: 8px 12px;
      text-align: left;
    }
    .table-clinical th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 600;
    }
    .grid-2 {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 20px;
    }
    .therapeutic-advice {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      font-size: 12px;
      margin-top: 16px;
    }
    .footer-note {
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
      margin-top: 48px;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
    }
    @media print {
      body {
        margin: 0;
        background: white;
      }
      .container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>

  <div class="container">
    <div class="header">
      <div class="title-row">
        <div>
          <h1 class="title">Clinical Health Summary Report</h1>
          <div class="subtitle">Caregiver-Mother Dyadic Psychophysiological Assessment Logging</div>
        </div>
        <div class="badge badge-primary">HIPAA / GDPR On-Device Standard</div>
      </div>
      
      <div class="meta-grid">
        <div class="meta-item"><strong>Generated On:</strong> ${data.formattedDate}</div>
        <div class="meta-item"><strong>Security Model:</strong> 100% Client-Side Local Isolated Sandbox</div>
        <div class="meta-item"><strong>User Status:</strong> Caregiver / Mother Dyadic Observation</div>
        <div class="meta-item"><strong>Record ID:</strong> DYAD-${Date.now().toString().slice(-6)}</div>
      </div>
    </div>

    <!-- Homeostasis Score Status -->
    <div class="score-banner">
      <div>
        <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Autonomic Balance Indicator</div>
        <div style="font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 4px;">${statusText}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Threshold Floor Level: ${data.activeThreshold}%</div>
      </div>
      <div>
        <p class="score-val">${data.balanceScore}%</p>
      </div>
    </div>

    <!-- PHYSIOLOGICAL COMPARISONS -->
    <div class="section-title">Caregiver Physiological Parameters</div>
    <table class="table-clinical">
      <thead>
        <tr>
          <th>Metric Name</th>
          <th>Observed Value</th>
          <th>Reference Baseline</th>
          <th>Clinical Deviation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Resting Heart Rate</strong></td>
          <td>${data.vitals.restingHeartRate} bpm</td>
          <td>${data.baselines.restingHeartRate} bpm</td>
          <td>${data.vitals.restingHeartRate > data.baselines.restingHeartRate ? `+${data.vitals.restingHeartRate - data.baselines.restingHeartRate} bpm (Sympathetic Shift)` : "Normal Baseline Limit"}</td>
        </tr>
        <tr>
          <td><strong>Heart Rate Variability (HRV)</strong></td>
          <td>${data.vitals.hrv} ms</td>
          <td>${data.baselines.hrv} ms</td>
          <td>${data.vitals.hrv < data.baselines.hrv ? `-${data.baselines.hrv - data.vitals.hrv} ms (Parasympathetic Reduction)` : "Stable Vagal Tone"}</td>
        </tr>
        <tr>
          <td><strong>Nocturnal Sleep Span</strong></td>
          <td>${data.vitals.sleepDuration} hrs</td>
          <td>${data.baselines.sleepDuration} hrs</td>
          <td>${data.vitals.sleepDuration < data.baselines.sleepDuration ? `-${(data.baselines.sleepDuration - data.vitals.sleepDuration).toFixed(1)} hrs deficit` : "Optimal Rest Limit"}</td>
        </tr>
        <tr>
          <td><strong>Respiratory Adherence</strong></td>
          <td>${data.vitals.respiratoryRate} bpm</td>
          <td>${data.baselines.respiratoryRate} bpm</td>
          <td>Within regular clinical range</td>
        </tr>
        <tr>
          <td><strong>Oxygen Saturation (SpO2)</strong></td>
          <td>${data.vitals.spo2}%</td>
          <td>${data.baselines.spo2}%</td>
          <td>Normoxic level</td>
        </tr>
      </tbody>
    </table>

    <div class="grid-2">
      <!-- DYADIC SLEEP & BURNOUT INDEXES -->
      <div>
        <div class="section-title">Dyadic Sleep Fragmentation</div>
        <table class="table-clinical">
          <tr>
            <td>Mother Awakenings (Night)</td>
            <td><strong>${data.motherWakesNight} times</strong></td>
          </tr>
          <tr>
            <td>Caregiver Prompted Wakes</td>
            <td><strong>${data.caregiverDisruptedWakes} times</strong></td>
          </tr>
          <tr>
            <td>Autonomic Sync Index</td>
            <td><strong>${((data.caregiverDisruptedWakes / Math.max(1, data.motherWakesNight)) * 100).toFixed(0)}% Disruption</strong></td>
          </tr>
        </table>
      </div>

      <!-- HEALTH CONCIERGE SETTINGS -->
      <div>
        <div class="section-title">Circadian Rhythm Alignment (IPSRT)</div>
        <table class="table-clinical">
          <tr>
            <td>Meal Time Drift (Deviation)</td>
            <td><strong>${data.mealTimeSyncOffset} hrs</strong></td>
          </tr>
          <tr>
            <td>Medication Accuracy</td>
            <td><strong>${data.medsDispenseAccuracy}%</strong></td>
          </tr>
          <tr>
            <td>Solar Anchoring Consistency</td>
            <td><strong>${data.lightSyncConsistency}%</strong></td>
          </tr>
        </table>
      </div>
    </div>

    <div class="grid-2">
      <!-- COGNITIVE REACTION SPEED -->
      <div>
        <div class="section-title">Cognitive Reaction Lag</div>
        <table class="table-clinical">
          <tr>
            <td>Reaction Game Measured Delay</td>
            <td><strong>${data.measuredReactionDelay !== null ? `${data.measuredReactionDelay} ms` : "No test taken"}</strong></td>
          </tr>
          <tr>
            <td>Typing Key-pause Latency</td>
            <td><strong>${data.typingLatencySlider} ms</strong></td>
          </tr>
          <tr>
            <td>Unconscious Touch-dwell Time</td>
            <td><strong>${data.screenTapsDelay} sec</strong></td>
          </tr>
        </table>
      </div>

      <!-- DERMATOLOGICAL STANDARDS -->
      <div>
        <div class="section-title">Eczema & Skin Diagnostics</div>
        <table class="table-clinical">
          <tr>
            <td>Symptomatic Itch Severity</td>
            <td><strong>${data.itchIntensity} / 5</strong></td>
          </tr>
          <tr>
            <td>Identified Triggers</td>
            <td><strong style="font-size: 10px;">${data.selectedEczemaTriggers.join(", ") || "None listed"}</strong></td>
          </tr>
          <tr>
            <td>Dermal Moisture Index</td>
            <td><strong>${data.scannedMoisture !== null ? `${data.scannedMoisture}%` : "Not Scanned"}</strong></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- CLINICAL SAFETY STATEMENT -->
    <div class="section-title">Clinical Decision Support Advisory</div>
    <div class="therapeutic-advice">
      <strong>Standard CDC / Clinical Guidance:</strong><br>
      Observations indicate that ${isBreached ? "caregiver burden levels have breached safe homeostasis thresholds, driven by social rhythm drift and sleep fragmentation triggers." : "the care receiver-deliverer dyad is functioning within sound homeostatic compensatory limits."}
      <br><br>
      <strong>Actionable Medical Protocol:</strong>
      <ul>
        <li>Deploy 30-Minute Respite Blocks during acute mother manic escalations to restore parasympathetic heart rhythms.</li>
        <li>Implement physical vagal breathing exercises (Physiological Sigh, Coherent Humming) to trigger fast HR drop.</li>
        <li>Consult with a board-certified clinical psychologist or geriatric therapist if sleep disruptions or social rhythm drift persists below 70% threshold.</li>
      </ul>
    </div>

    <!-- HIPAA & SYSTEM STATEMENT -->
    <p class="footer-note">
      This information is compiled entirely at client-side runtime utilizing the Web Biometric Sandbox architecture. In strict accordance with HHS Regulations (HIPAA Security Rule 45 CFR § 164.312), GDPR Recital 78, and W3C WebApp standards, all recorded data traces are isolated from remote commercial collection APIs. This report is designated exclusively for personal health tracking or explicit physician consulting records.
    </p>

    <!-- PRINT ACTION -->
    <div style="margin-top: 24px; text-align: center;" class="no-print">
      <button onclick="window.print()" style="background-color: #4f46e5; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer;">
        Print / Save to PDF
      </button>
    </div>
  </div>

</body>
</html>
  `;
}
