import type { Citation } from "../../domain/explanation.ts";

/**
 * Structured clinical knowledge base (report CSO Table Stakes: "integrate a
 * structured clinical knowledge base — validated behaviour-change frameworks
 * like COM-B or Motivational Interviewing — rather than relying on the LLM's
 * parametric knowledge"). Entries here are the ONLY legitimate source for a
 * "verified" / "evidence_backed" confidence tier (I1), so the coach cites its
 * reasoning pathway rather than generating fluent but ungrounded advice.
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  framework: string;
  summary: string;
  tags: string[];
  /** Coaching guidance grounded in the framework (non-clinical). */
  guidance: string;
}

const ENTRIES: KnowledgeEntry[] = [
  {
    id: "kb:com-b",
    title: "COM-B model of behaviour change",
    framework: "COM-B (Michie et al., 2011)",
    summary: "Behaviour requires Capability, Opportunity and Motivation acting together.",
    tags: ["habit", "behaviour", "change", "motivation", "goal", "routine"],
    guidance:
      "When a habit stalls, check which of Capability, Opportunity or Motivation is the bottleneck and address that one, rather than pushing harder on willpower.",
  },
  {
    id: "kb:mi",
    title: "Motivational Interviewing principles",
    framework: "Motivational Interviewing (Miller & Rollnick)",
    summary: "Evoke the person's own reasons for change through open questions and reflective listening.",
    tags: ["motivation", "ambivalence", "change", "goal", "habit", "support"],
    guidance:
      "Use open questions and reflections; avoid the 'righting reflex' of telling people what to do. Let the user voice their own change talk.",
  },
  {
    id: "kb:smart-goals",
    title: "SMART goal setting",
    framework: "SMART goals",
    summary: "Effective goals are Specific, Measurable, Achievable, Relevant and Time-bound.",
    tags: ["goal", "planning", "habit", "target", "progress"],
    guidance:
      "Reframe a vague aim ('exercise more') into a specific, measurable, time-bound next step the user chooses themselves.",
  },
  {
    id: "kb:sleep-hygiene",
    title: "Sleep hygiene fundamentals",
    framework: "CDC / AASM sleep-hygiene guidance",
    summary: "Consistent schedule, dark cool room, limiting evening screens and caffeine support sleep.",
    tags: ["sleep", "insomnia", "rest", "fatigue", "routine", "night"],
    guidance:
      "Offer general, low-risk sleep-hygiene ideas (consistent wake time, wind-down routine). Defer anything involving sleep medication to a clinician.",
  },
  {
    id: "kb:physical-activity",
    title: "Physical activity guidance",
    framework: "WHO physical activity guidelines",
    summary: "Adults benefit from ~150 min/week of moderate activity, building up gradually.",
    tags: ["exercise", "activity", "walking", "movement", "fitness", "steps"],
    guidance:
      "Encourage gradual, enjoyable movement the user can sustain; emphasise starting small. Flag chest pain or breathlessness as reasons to seek care, not coaching.",
  },
  {
    id: "kb:stress-management",
    title: "Stress management basics",
    framework: "Stress & coping (Lazarus & Folkman)",
    summary: "Distinguish what is and isn't controllable; use problem- and emotion-focused coping.",
    tags: ["stress", "anxiety", "coping", "overwhelm", "burnout", "mood"],
    guidance:
      "Offer general coping ideas and normalise help-seeking. Persistent distress, hopelessness or self-harm thoughts are for human professionals, not the coach.",
  },
];

export class KnowledgeBase {
  private readonly entries: KnowledgeEntry[];
  constructor(entries: KnowledgeEntry[] = ENTRIES) {
    this.entries = entries;
  }

  getById(id: string): KnowledgeEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  all(): KnowledgeEntry[] {
    return [...this.entries];
  }

  /** Rank entries by tag/keyword overlap with the query (simple, transparent). */
  search(query: string, limit = 3): KnowledgeEntry[] {
    const words = new Set(
      query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2),
    );
    const scored = this.entries
      .map((e) => {
        let score = 0;
        for (const tag of e.tags) if (words.has(tag)) score += 2;
        for (const w of words) if (e.title.toLowerCase().includes(w)) score += 1;
        return { e, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map((s) => s.e);
  }

  toCitations(entries: KnowledgeEntry[]): Citation[] {
    return entries.map((e) => ({ sourceId: e.id, title: e.title, note: e.framework }));
  }
}
