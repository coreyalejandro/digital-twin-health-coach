/**
 * Safety netting (report E6 / §2.3). Proactive detection of distress across a
 * conversation — the user most at risk is the least likely to explicitly ask
 * for help, so we watch for the signals rather than waiting to be asked.
 *
 * This is the IMMEDIATE, per-conversation check (vs. the longitudinal Agent
 * Sentinel anomaly detector). When it fires, the coaching pipeline opens a
 * human escalation regardless of what the model wanted to say.
 */

import type { EscalationReason } from "./escalation.ts";

export interface ConversationTurn {
  topic: string;
  anxietyMarkers: number;
  selfHarm: boolean;
  eatingDisorder: boolean;
}

export interface SafetyNetResult {
  distress: boolean;
  /** Forced human escalation — reserved for ACUTE signals (self-harm) only. */
  escalate: boolean;
  /** Gently OFFER a human as an option, without interrupting the answer. */
  offerHuman: boolean;
  severity: "none" | "elevated" | "critical";
  reasons: string[];
  escalationReason?: EscalationReason;
}

export interface SafetyNetConfig {
  window: number;
  repeatThreshold: number;
  anxietyThreshold: number;
}

export const DEFAULT_SAFETY_NET_CONFIG: SafetyNetConfig = {
  window: 5,
  repeatThreshold: 3,
  anxietyThreshold: 4,
};

export function assessSafetyNet(
  history: ConversationTurn[],
  current: ConversationTurn,
  config: SafetyNetConfig = DEFAULT_SAFETY_NET_CONFIG,
): SafetyNetResult {
  const reasons: string[] = [];

  // Acute signals in the current turn are the ONLY forced escalation.
  if (current.selfHarm) {
    return {
      distress: true,
      escalate: true,
      offerHuman: true,
      severity: "critical",
      reasons: ["self-harm language detected"],
      escalationReason: "emergency",
    };
  }

  const window = [...history, current].slice(-config.window);

  const topicCounts = new Map<string, number>();
  for (const t of window) topicCounts.set(t.topic, (topicCounts.get(t.topic) ?? 0) + 1);
  const maxRepeat = Math.max(0, ...topicCounts.values());
  if (maxRepeat >= config.repeatThreshold) {
    reasons.push(`repeated questioning on the same topic (${maxRepeat}×)`);
  }

  const anxietyTotal = window.reduce((a, t) => a + t.anxietyMarkers, 0);
  if (anxietyTotal >= config.anxietyThreshold) {
    reasons.push(`escalating anxiety language (${anxietyTotal} markers)`);
  }

  if (window.some((t) => t.eatingDisorder)) {
    reasons.push("eating-disorder signals present");
  }

  const distress = reasons.length > 0;
  // Non-acute distress no longer interrupts the user with a forced escalation
  // (that was the paternalistic behaviour). Instead we keep answering and gently
  // OFFER a human when several signals stack up or an eating-disorder signal appears.
  const offerHuman = reasons.length >= 2 || window.some((t) => t.eatingDisorder);
  const severity: SafetyNetResult["severity"] = distress ? "elevated" : "none";

  return {
    distress,
    escalate: false,
    offerHuman,
    severity,
    reasons,
    escalationReason: undefined,
  };
}
