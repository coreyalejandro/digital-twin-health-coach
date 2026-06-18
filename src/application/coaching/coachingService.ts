import { newId } from "../../domain/ids.ts";
import type { Clock } from "../../domain/time.ts";
import { event } from "../../domain/events.ts";
import {
  type CoachResponse,
  type ResponseDisposition,
  type UserQuery,
} from "../../domain/query.ts";
import { type ConfidenceTier } from "../../domain/confidence.ts";
import { profileComplexity, type HealthProfile } from "../../domain/health.ts";

import { classify, type Classification } from "../classify/classifier.ts";
import { applyMedicalBoundary, type BoundaryDecision } from "../safety/medicalBoundary.ts";
import { detectInputRisks, filterOutput } from "../safety/filters.ts";
import { assessSafetyNet, type ConversationTurn } from "../safety/safetyNetting.ts";
import { buildExplanation } from "../explain/explanationBuilder.ts";
import { CRISIS_RESOURCES, type EscalationService } from "../safety/escalation.ts";
import { KnowledgeBase } from "../knowledge/knowledgeBase.ts";
import { ProfileService } from "../profile/profileService.ts";
import { ConsentService } from "../consent/consentService.ts";
import { SessionMemory } from "./sessionMemory.ts";
import { RateLimiter } from "../resilience/rateLimiter.ts";
import { CircuitBreaker } from "../resilience/circuitBreaker.ts";
import { withTimeout } from "../resilience/timeout.ts";
import { gateInteraction, type RolloutMode } from "../modes/rollout.ts";

import { MultiModelRouter, disagreementDetected, type RoutedCompletion } from "../../infrastructure/providers/multiModel.ts";
import { AuditLog } from "../../governance/audit/auditLog.ts";
import { PromptRegistry } from "../../governance/prompts/promptRegistry.ts";
import {
  evaluateInvariants,
  type CandidateResponse,
  type InvariantReport,
} from "../../governance/invariants/sentinelos.ts";
import { detectAnomalies, type Anomaly, type InteractionSignal } from "../../governance/sentinel/anomaly.ts";
import { assessAgency, type AgencyScore } from "../../governance/agency/agencyScore.ts";

/**
 * CoachingService — the pipeline spine, REBALANCED to an informed-consent model.
 *
 * Philosophy: inform and assist by default, with clear disclaimers. The coach
 * ANSWERS wellness, health-information and medical questions (the last as
 * general education, never a specific directive). The only forced human path is
 * an acute emergency / self-harm, which gets supportive text + crisis resources.
 * Distress short of that no longer interrupts the user — it gently offers a human.
 *
 * The governance layer (SentinelOS I1–I6, audit log, anomaly + agency tracking)
 * still runs on every turn, but it now governs the *quality and honesty* of an
 * answer rather than blocking people from getting one.
 */

export interface CoachDeps {
  profiles: ProfileService;
  consent: ConsentService;
  knowledge: KnowledgeBase;
  router: MultiModelRouter;
  escalation: EscalationService;
  audit: AuditLog;
  prompts: PromptRegistry;
  memory: SessionMemory;
  rateLimiter: RateLimiter;
  breaker: CircuitBreaker;
  clock: Clock;
  capabilities: string[];
  mode: RolloutMode;
  promptName?: string;
  timeoutMs?: number;
}

export interface CoachOutcome {
  response: CoachResponse;
  invariantReport?: InvariantReport;
  anomalies: Anomaly[];
  agency?: AgencyScore;
  degraded: boolean;
}

export const SAFE_DEFAULT_SYSTEM =
  "You are a warm, practical health and wellness coach. Help the user directly with general, " +
  "evidence-informed wellness guidance and plain-language health information, and add a brief disclaimer. " +
  "You never give a specific medical directive (no specific dose, no 'start/stop this medication', no diagnosis) — " +
  "for those, give general context and suggest the user confirm specifics with their prescriber. " +
  "You never handle emergencies. Acknowledge uncertainty honestly.";

const DEGRADED_MESSAGE =
  "I can't generate a full response right now. As a general, low-risk step you might jot down how you're " +
  "feeling and what you'd like to focus on, and try again shortly. If anything feels urgent, the " +
  "“I need human help” option always works.";

const MEDICAL_DISCLAIMER =
  "This is general information, not personal medical advice. I can't tell you your specific dose, whether to " +
  "start or stop a medication, or give you a diagnosis — those decisions belong with your prescriber, who has " +
  "the full picture. If it helps, I can help you prepare questions to bring to them.";

const ED_RESOURCES = [
  { name: "NEDA Helpline", contact: "Call or text (800) 931-2237", region: "US", available: "Business hours, ET" },
  { name: "Crisis Text Line", contact: "Text HOME to 741741", region: "US/CA/UK/IE", available: "24/7" },
];

export class CoachingService {
  private readonly d: CoachDeps;
  constructor(deps: CoachDeps) {
    this.d = deps;
  }

  async coach(input: { userId: string; sessionId: string; text: string }): Promise<CoachOutcome> {
    const { clock } = this.d;
    const query: UserQuery = {
      id: newId("q"),
      userId: input.userId,
      sessionId: input.sessionId,
      text: input.text,
      createdAt: clock.iso(),
    };
    await this.d.audit.record(event("query_received", clock.iso(), { length: input.text.length }, ctx(query)));

    // 1) Rate limiting.
    if (!this.d.rateLimiter.tryConsume(input.userId)) {
      return this.safe(query, "You're sending messages very quickly. Take a breath — I'm here. Please try again in a moment.", "answered_with_disclaimer", "heuristic", ["§6.1:rate_limit"], []);
    }

    // 2) Circuit breaker.
    if (!this.d.breaker.allow()) {
      await this.d.audit.record(event("circuit_tripped", clock.iso(), {}, ctx(query)));
      return this.safe(query, DEGRADED_MESSAGE, "answered_with_disclaimer", "heuristic", ["§6.2:graceful_degradation"], [], true);
    }

    // 3) Input risk + classification (risk may raise the tier; conservative).
    const risk = detectInputRisks(input.text);
    const hint = risk.selfHarm ? "emergency" : risk.drugMentions.length > 0 ? "medical_advice" : undefined;
    const classification = classify(input.text, hint);

    const topic = this.deriveTopic(input.text);
    const turn: ConversationTurn = { topic, anxietyMarkers: risk.anxietyMarkers, selfHarm: risk.selfHarm, eatingDisorder: risk.eatingDisorder };
    const history = this.d.memory.getTurns(input.sessionId);
    this.d.memory.appendTurn(input.sessionId, turn);
    await this.d.audit.record(event("query_classified", clock.iso(), { tier: classification.tier, confidence: classification.confidence, ambiguous: classification.ambiguous }, ctx(query)));

    // 4) Safety netting — only ACUTE self-harm forces a human.
    const safetyNet = assessSafetyNet(history, turn);
    if (safetyNet.escalate) {
      return await this.crisisResponse(query, classification.tier, "emergency");
    }

    const decision = applyMedicalBoundary(classification);
    const profile = await this.d.profiles.getOrCreate(input.userId);
    const complexity = profileComplexity(profile);
    const gate = gateInteraction(this.d.mode, classification.tier, complexity);
    const offer = safetyNet.offerHuman ? " If it would help, I can also connect you with a human — just say the word." : "";

    // 5) Emergency: supportive response + crisis resources (the one carve-out).
    if (decision.stance === "crisis") {
      return await this.crisisResponse(query, classification.tier, "emergency");
    }

    // 5b) Eating-disorder facilitation is a harm line we hold: never coach
    //     purging/starving; respond supportively with specialised resources.
    if (risk.eatingDisorder) {
      return await this.crisisResponse(query, classification.tier, "eating_disorder");
    }

    // 6) Medical question: answer with GENERAL information, never a directive.
    //    Built from the knowledge base (not raw model text) so no unsafe
    //    directive can slip through, while still genuinely helping.
    if (classification.tier === "medical_advice") {
      return await this.informationalMedicalResponse(query, classification, input.text, decision, offer);
    }

    // 7) Wellness / health-information: model-generated, filtered answer.
    const kbHits = this.d.knowledge.search(input.text, 3);
    const citations = this.d.knowledge.toCitations(kbHits);
    const system = this.activeSystemPrompt();
    const context = kbHits.length
      ? `Relevant frameworks you may ground guidance in:\n${kbHits.map((e) => `- ${e.title}: ${e.guidance}`).join("\n")}`
      : undefined;
    const highStakes = classification.tier === "health_information" || risk.highRisk;

    let routed: RoutedCompletion | undefined;
    try {
      const routedRes = await withTimeout(this.d.router.route({ system, user: input.text, context }, { highStakes }), this.d.timeoutMs ?? 8000);
      if (routedRes.ok) { routed = routedRes.value; this.d.breaker.reportProbe(true); }
      else { this.d.breaker.reportProbe(false); }
    } catch {
      this.d.breaker.reportProbe(false);
    }
    if (!routed) {
      await this.d.audit.record(event("circuit_tripped", clock.iso(), { reason: "generation_unavailable" }, ctx(query)));
      return this.safe(query, DEGRADED_MESSAGE, "answered_with_disclaimer", "heuristic", ["§6.2:graceful_degradation"], [], true);
    }

    // Model disagreement on high-stakes: don't refuse — answer cautiously + hedge.
    let hedge = "";
    if (highStakes && disagreementDetected(routed)) {
      await this.d.audit.record(event("provider_disagreement", clock.iso(), { agreement: routed.agreement }, ctx(query)));
      hedge = " (My sources weren't fully aligned here, so please treat this as general and double-check anything important.)";
    }

    // 8) Output filter — still withholds genuinely harmful text (shaming, PII).
    const filtered = filterOutput(routed.primary.text);
    let bodyText: string;
    if (!filtered.ok) {
      await this.d.audit.record(event("output_filtered", clock.iso(), { violations: filtered.violations }, ctx(query)));
      bodyText = "Here are some general, supportive ideas to consider. (I held back part of my draft because it didn't meet my own safety bar.)";
    } else {
      bodyText = filtered.text;
    }

    // 9) Confidence + explanation. Citations strengthen confidence but aren't required.
    const confidence: ConfidenceTier = citations.length > 0 ? "evidence_backed" : "heuristic";
    const text = `${bodyText}${hedge}${offer}`;
    const disposition: ResponseDisposition = "answered_with_disclaimer";
    const explanation = buildExplanation({
      summary: this.firstSentence(bodyText),
      reasoning: kbHits.map((e) => ({ data: `your question + ${e.title}`, inference: e.guidance })),
      alternativesConsidered: kbHits.slice(1).map((e) => e.title),
      confidence,
      citations,
    });

    // 10) SentinelOS I1–I6 (governs honesty/quality; should pass for a normal answer).
    const requirementTrace = [...decision.requirementTrace, "E7:explainability", gate.allowed ? "§10:rollout_gate" : "§10:rollout_blocked"];
    const candidate: CandidateResponse = { text, disposition, confidence: explanation.confidence, citationCount: explanation.citations.length, requirementTrace };
    const invariantReport = evaluateInvariants({ phase: "response", tier: classification.tier, capabilities: this.d.capabilities, response: candidate });
    await this.d.audit.record(event("invariant_evaluated", clock.iso(), { passed: invariantReport.passed, blockedBy: invariantReport.blockedBy }, ctx(query)));
    if (!invariantReport.passed) {
      const out = this.safe(query, `Here's a general, supportive thought, kept cautious.${offer}`, "answered_with_disclaimer", "heuristic", ["I6:fail_closed"], []);
      out.invariantReport = invariantReport;
      return out;
    }

    const response = this.deliver(query, classification.tier, disposition, text, explanation, invariantReport);
    await this.d.audit.record(event("response_delivered", clock.iso(), { tier: response.tier, disposition }, ctx(query)));
    const { anomalies, agency } = await this.updateBehaviour(input.userId, input.text, topic, risk.anxietyMarkers, profile);
    return { response, invariantReport, anomalies, agency, degraded: false };
  }

  /** Medical question → general, knowledge-grounded information (never a directive). */
  private async informationalMedicalResponse(
    query: UserQuery,
    classification: Classification,
    text: string,
    decision: BoundaryDecision,
    offer: string,
  ): Promise<CoachOutcome> {
    const kbHits = this.d.knowledge.search(text, 2);
    const citations = this.d.knowledge.toCitations(kbHits);
    const general = kbHits.length
      ? `Here's some general, non-prescriptive context: ${kbHits.map((e) => e.guidance).join(" ")}`
      : "Here's some general, non-prescriptive context on this topic.";
    const body = `${general} ${MEDICAL_DISCLAIMER}${offer}`;
    const confidence: ConfidenceTier = citations.length > 0 ? "evidence_backed" : "heuristic";
    const explanation = buildExplanation({
      summary: "General information only — specifics about your medication or diagnosis are for your prescriber.",
      reasoning: kbHits.map((e) => ({ data: e.title, inference: e.guidance })),
      alternativesConsidered: ["Prepare questions for your prescriber", "Discuss specifics with your care team"],
      confidence,
      citations,
    });
    const requirementTrace = [...decision.requirementTrace, "E7:explainability"];
    const candidate: CandidateResponse = { text: body, disposition: "answered_with_disclaimer", confidence: explanation.confidence, citationCount: explanation.citations.length, requirementTrace };
    const invariantReport = evaluateInvariants({ phase: "response", tier: classification.tier, capabilities: this.d.capabilities, response: candidate });
    await this.d.audit.record(event("invariant_evaluated", this.d.clock.iso(), { passed: invariantReport.passed, blockedBy: invariantReport.blockedBy, stance: "informational_medical" }, ctx(query)));

    const response = this.deliver(query, classification.tier, "answered_with_disclaimer", body, explanation, invariantReport);
    await this.d.audit.record(event("response_delivered", this.d.clock.iso(), { tier: response.tier, disposition: "answered_with_disclaimer", stance: "informational_medical" }, ctx(query)));
    const profile = await this.d.profiles.getOrCreate(query.userId);
    const { anomalies, agency } = await this.updateBehaviour(query.userId, text, this.deriveTopic(text), 0, profile);
    return { response, invariantReport, anomalies, agency, degraded: false };
  }

  /** Acute emergency / self-harm / eating-disorder → supportive message + resources + a human. */
  private async crisisResponse(query: UserQuery, tier: CoachResponse["tier"], reason: "emergency" | "eating_disorder"): Promise<CoachOutcome> {
    const esc = await this.d.escalation.open({
      userId: query.userId,
      sessionId: query.sessionId,
      kind: "crisis",
      reason: reason === "eating_disorder" ? "distress" : "emergency",
      context: { tier, reason },
    });
    const resources = reason === "eating_disorder" ? ED_RESOURCES : CRISIS_RESOURCES;
    const message =
      reason === "eating_disorder"
        ? "Thank you for trusting me with this. I'm not able to help with anything that could harm your body, and " +
          "I don't want to — but I do want you supported. People who understand this are available below, and I can " +
          "connect you with a human. You deserve care, not judgment."
        : "I'm really glad you told me, and I don't want you to be alone with this. I can't handle an emergency " +
          "myself, but people who can are available right now — please use a resource below or your local emergency " +
          "number, and I can connect you with a human too. I'm staying right here with you.";
    const candidate: CandidateResponse = { text: message, disposition: "escalated", confidence: "refused", citationCount: 0, requirementTrace: ["E1:emergency_support", "E6:crisis_resources"] };
    const invariantReport = evaluateInvariants({ phase: "response", tier, capabilities: this.d.capabilities, response: candidate });
    const response: CoachResponse = {
      id: newId("resp"),
      queryId: query.id,
      sessionId: query.sessionId,
      userId: query.userId,
      disposition: "escalated",
      tier,
      text: message,
      explanation: { summary: message, reasoning: [], alternativesConsidered: [], confidence: "refused", citations: [] },
      crisisResources: resources,
      escalationId: esc.id,
      governanceTrace: invariantReport.results.map((r) => `${r.id}:${r.passed ? "pass" : "fail"}`),
      createdAt: this.d.clock.iso(),
    };
    await this.d.audit.record(event("response_delivered", this.d.clock.iso(), { tier, disposition: "escalated", crisis: true }, ctx(query)));
    return { response, invariantReport, anomalies: [], degraded: false };
  }

  private deliver(
    query: UserQuery,
    tier: CoachResponse["tier"],
    disposition: ResponseDisposition,
    text: string,
    explanation: CoachResponse["explanation"],
    invariantReport: InvariantReport,
  ): CoachResponse {
    return {
      id: newId("resp"),
      queryId: query.id,
      sessionId: query.sessionId,
      userId: query.userId,
      disposition,
      tier,
      text,
      explanation,
      governanceTrace: invariantReport.results.map((r) => `${r.id}:${r.passed ? "pass" : "fail"}`),
      createdAt: this.d.clock.iso(),
    };
  }

  private async updateBehaviour(userId: string, text: string, topic: string, anxietyMarkers: number, profile: HealthProfile) {
    const signal: InteractionSignal = {
      at: this.d.clock.iso(),
      topic,
      acceptedWithoutQuestion: false,
      askedQuestion: text.includes("?"),
      selfInitiated: true,
      anxietyMarkers,
    };
    this.d.memory.appendSignal(userId, signal);
    const signals = this.d.memory.getSignals(userId);
    const anomalies = detectAnomalies(signals);
    if (anomalies.length > 0) {
      await this.d.audit.record(event("anomaly_detected", this.d.clock.iso(), { kinds: anomalies.map((a) => a.kind) }, { userId }));
      for (const a of anomalies) if (a.severity === "critical") this.d.breaker.recordAnomaly();
    }
    const questionRate = ratio(signals, (s) => s.askedQuestion);
    const selfRate = ratio(signals, (s) => s.selfInitiated);
    const providerEngaged = profile.careTeam.some((m) => m.role === "human_provider");
    const assessment = assessAgency({ goals: profile.goals, questionRate, selfInitiationRate: selfRate, providerEngaged }, this.d.memory.getAgencyHistory(userId));
    this.d.memory.pushAgency(userId, assessment.current.score);
    await this.d.audit.record(event("agency_evaluated", this.d.clock.iso(), { score: assessment.current.score, trend: assessment.trajectory.trend }, { userId }));
    if (assessment.interventions.length > 0) {
      await this.d.audit.record(event("intervention_triggered", this.d.clock.iso(), { interventions: assessment.interventions }, { userId }));
    }
    return { anomalies, agency: assessment.current };
  }

  private activeSystemPrompt(): string {
    const active = this.d.prompts.getActive(this.d.promptName ?? "coach.system");
    return active.ok ? active.value.body : SAFE_DEFAULT_SYSTEM;
  }

  private deriveTopic(text: string): string {
    const hit = this.d.knowledge.search(text, 1)[0];
    return hit ? (hit.tags[0] ?? "general") : "general";
  }

  private firstSentence(text: string): string {
    const m = /^.*?[.!?](\s|$)/.exec(text.trim());
    return (m ? m[0] : text).trim().slice(0, 200);
  }

  private safe(query: UserQuery, text: string, disposition: ResponseDisposition, confidence: ConfidenceTier, trace: string[], anomalies: Anomaly[], degraded = false): CoachOutcome {
    const response: CoachResponse = {
      id: newId("resp"),
      queryId: query.id,
      sessionId: query.sessionId,
      userId: query.userId,
      disposition,
      tier: "wellness",
      text,
      explanation: buildExplanation({ summary: text, confidence, citations: [] }),
      governanceTrace: trace,
      createdAt: this.d.clock.iso(),
    };
    return { response, anomalies, degraded };
  }
}

function ctx(q: UserQuery): { userId: string; sessionId: string; queryId: string } {
  return { userId: q.userId, sessionId: q.sessionId, queryId: q.id };
}
function ratio<T>(arr: T[], pred: (t: T) => boolean): number {
  return arr.length === 0 ? 0 : arr.filter(pred).length / arr.length;
}
