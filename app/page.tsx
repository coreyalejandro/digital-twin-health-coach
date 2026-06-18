"use client";

import { useState } from "react";

/**
 * Neurodivergent-first coaching surface (report E4/E7/T7). Mirrors the bundled
 * vanilla UI: structured-first interaction, a persistent "I need human help"
 * control, layered explainability the user controls, and an explicit turn
 * signal. Styling is intentionally minimal here; the production app would use
 * the design system.
 */
interface CoachResponse {
  text: string;
  disposition: string;
  tier: string;
  explanation: { summary: string; confidence: string; disclaimer?: string; reasoning: { data: string; inference: string }[]; citations: { title: string }[] };
  crisisResources?: { name: string; contact: string }[];
}
interface CoachOutcome {
  response: CoachResponse;
  agency?: { score: number; band: string };
  degraded: boolean;
}

export default function Page() {
  const [text, setText] = useState("");
  const [turn, setTurn] = useState("Your turn.");
  const [depth, setDepth] = useState<"summary" | "detailed">("summary");
  const [outcome, setOutcome] = useState<CoachOutcome | null>(null);

  async function send() {
    if (!text.trim()) return;
    setTurn("Coach is thinking…");
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setOutcome(await res.json());
    setTurn("Your turn.");
  }

  async function panic() {
    const res = await fetch("/api/panic", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const data = await res.json();
    alert(`Connected to a human. ${(data.resources ?? []).map((r: { name: string; contact: string }) => `${r.name}: ${r.contact}`).join("\n")}`);
  }

  const r = outcome?.response;
  return (
    <main>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Digital Twin Health Coach</h1>
        <button onClick={panic} aria-label="I need human help right now">I need human help</button>
      </header>

      <label htmlFor="msg">What would you like to work on?</label>
      <textarea id="msg" value={text} onChange={(e) => setText(e.target.value)} aria-describedby="msg-help" />
      <p id="msg-help">One focus at a time. Anything clinical is routed to a human.</p>

      <label htmlFor="depth">Explanation depth</label>
      <select id="depth" value={depth} onChange={(e) => setDepth(e.target.value as "summary" | "detailed")}>
        <option value="summary">Summary only</option>
        <option value="detailed">Show reasoning</option>
      </select>

      <p aria-live="polite">{turn}</p>
      <button onClick={send}>Send to coach</button>

      {r && (
        <section aria-live="polite">
          <p>{r.text}</p>
          <p><small>Confidence: {r.explanation.confidence}</small></p>
          {r.crisisResources && (
            <ul>{r.crisisResources.map((c) => <li key={c.name}>{c.name} — {c.contact}</li>)}</ul>
          )}
          {r.explanation.disclaimer && <p><em>{r.explanation.disclaimer}</em></p>}
          {depth === "detailed" && r.explanation.reasoning.length > 0 && (
            <details open>
              <summary>Why did I say this?</summary>
              <ul>{r.explanation.reasoning.map((s, i) => <li key={i}>{s.data} → {s.inference}</li>)}</ul>
              {r.explanation.citations.length > 0 && (
                <ul>{r.explanation.citations.map((c) => <li key={c.title}>Source: {c.title}</li>)}</ul>
              )}
            </details>
          )}
          {outcome?.agency && <p><small>Health-agency score: {outcome.agency.score}/100 ({outcome.agency.band})</small></p>}
          {outcome?.degraded && <p><small>Running in safe degraded mode.</small></p>}
        </section>
      )}
    </main>
  );
}
