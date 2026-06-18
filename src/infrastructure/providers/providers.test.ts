import { test } from "node:test";
import assert from "node:assert/strict";

import { MockProvider } from "./mockProvider.ts";
import { MultiModelRouter, assessAgreement, disagreementDetected, jaccard } from "./multiModel.ts";
import { GeminiProvider } from "./geminiProvider.ts";
import { ClaudeProvider } from "./claudeProvider.ts";
import { OpenAIProvider } from "./openaiProvider.ts";
import type { HttpPostJson } from "./provider.ts";

const req = { system: "sys", user: "How do I build a walking habit?" };

test("MockProvider returns configured reply and identity", async () => {
  const p = new MockProvider({ reply: "walk daily", presentAs: "gemini" });
  const r = await p.complete(req);
  assert.equal(r.text, "walk daily");
  assert.equal(r.provider, "gemini");
});

test("MultiModelRouter falls through to a working provider", async () => {
  const broken = new MockProvider({ fail: true, presentAs: "gemini" });
  const good = new MockProvider({ reply: "ok", presentAs: "openai" });
  const router = new MultiModelRouter([broken, good]);
  const routed = await router.route(req);
  assert.equal(routed.primary.text, "ok");
  assert.equal(routed.usedFallback, true);
});

test("MultiModelRouter throws only when ALL providers fail", async () => {
  const router = new MultiModelRouter([
    new MockProvider({ fail: true }),
    new MockProvider({ fail: true }),
  ]);
  await assert.rejects(() => router.route(req));
});

test("high-stakes agreement: similar answers agree", async () => {
  const primary = new MockProvider({ reply: "Try short daily walks and track them.", presentAs: "gemini" });
  const checker = new MockProvider({ reply: "Try short daily walks and track them each day.", presentAs: "claude" });
  const router = new MultiModelRouter([primary], checker);
  const routed = await router.route(req, { highStakes: true });
  assert.ok(routed.agreement?.agreed, "similar answers should agree");
  assert.equal(disagreementDetected(routed), false);
});

test("high-stakes disagreement: contradictory stance escalates", () => {
  const a = assessAgreement(
    "You should increase your dose to feel better.",
    "Do not change your dose; that is not safe without a doctor.",
  );
  assert.equal(a.contradiction, true);
  assert.equal(a.agreed, false);
});

test("checker outage on high-stakes fails closed (no agreement)", async () => {
  const primary = new MockProvider({ reply: "answer", presentAs: "gemini" });
  const checker = new MockProvider({ fail: true, presentAs: "claude" });
  const router = new MultiModelRouter([primary], checker);
  const routed = await router.route(req, { highStakes: true });
  assert.equal(routed.agreement?.agreed, false);
  assert.equal(disagreementDetected(routed), true);
});

test("jaccard similarity basic sanity", () => {
  assert.equal(jaccard("the cat sat", "the cat sat"), 1);
  assert.ok(jaccard("walking habit daily", "completely different words here") < 0.2);
});

// --- Vendor adapters: request shape + response parsing via fake transport ---

function captureHttp(responseJson: unknown, status = 200): { http: HttpPostJson; calls: { url: string; headers: Record<string, string>; body: unknown }[] } {
  const calls: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const http: HttpPostJson = async (url, headers, body) => {
    calls.push({ url, headers, body });
    return { status, json: responseJson, text: JSON.stringify(responseJson) };
  };
  return { http, calls };
}

test("GeminiProvider builds v1beta body and parses candidates", async () => {
  const { http, calls } = captureHttp({
    candidates: [{ content: { parts: [{ text: "gemini says hi" }] } }],
  });
  const p = new GeminiProvider({ apiKey: "k", http, model: "gemini-1.5-pro" });
  const r = await p.complete({ system: "s", user: "u", context: "ctx" });
  assert.equal(r.text, "gemini says hi");
  assert.match(calls[0]!.url, /generateContent\?key=k/);
  const body = calls[0]!.body as { contents: { parts: { text: string }[] }[] };
  assert.match(body.contents[0]!.parts[0]!.text, /ctx[\s\S]*u/);
});

test("ClaudeProvider sets auth headers and parses content blocks", async () => {
  const { http, calls } = captureHttp({ content: [{ type: "text", text: "claude says hi" }] });
  const p = new ClaudeProvider({ apiKey: "ak", http });
  const r = await p.complete({ system: "s", user: "u" });
  assert.equal(r.text, "claude says hi");
  assert.equal(calls[0]!.headers["x-api-key"], "ak");
  assert.ok(calls[0]!.headers["anthropic-version"]);
});

test("OpenAIProvider sets bearer and parses choices", async () => {
  const { http, calls } = captureHttp({ choices: [{ message: { content: "openai says hi" } }] });
  const p = new OpenAIProvider({ apiKey: "ok", http });
  const r = await p.complete({ system: "s", user: "u" });
  assert.equal(r.text, "openai says hi");
  assert.equal(calls[0]!.headers["authorization"], "Bearer ok");
});

test("adapter surfaces non-2xx as ProviderError", async () => {
  const { http } = captureHttp({ error: "bad" }, 500);
  const p = new OpenAIProvider({ apiKey: "ok", http });
  await assert.rejects(() => p.complete({ system: "s", user: "u" }), /openai/);
});
