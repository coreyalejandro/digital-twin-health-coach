import http from "node:http";
import { buildInMemoryCoach, providersFromEnv } from "../application/coaching/buildCoach.ts";
import { computeMetrics } from "../governance/metrics/metrics.ts";
import { buildDashboard } from "../governance/dashboard/dashboard.ts";
import { LightTwin } from "../application/twin/twinEngine.ts";
import { computeTwinFidelity } from "../application/twin/fidelity.ts";
import { exportProfile } from "../application/portability/fhir.ts";
import { runBattery } from "../../redteam/battery.ts";
import type { ConsentScope } from "../domain/consent.ts";
import { PAGE_HTML } from "./ui.ts";

/**
 * Dependency-free HTTP presentation layer (the runnable app in this sandbox).
 * Wires the real coaching pipeline and exposes the JSON API consumed by both
 * the bundled HTML UI and the Next.js App Router target (see ../../app).
 *
 * NOTE: avoids the platform-reserved paths (/run /events /health /interrupt
 * /keepalive); health check lives at /api/health.
 */

const { providers, checker } = providersFromEnv();
const ctx = buildInMemoryCoach({
  providers: providers.length ? providers : undefined,
  checker,
  rateLimit: 60,
});

async function seed(): Promise<void> {
  // Seed a demo profile with memory of a real condition.
  await ctx.profiles.addCondition("demo", {
    name: "Hypothyroidism",
    status: "active",
    complexity: "moderate",
    requiresClinicianOversight: false,
  });
  await ctx.profiles.addMedication("demo", { name: "Levothyroxine", active: true, schedule: { label: "morning", times: ["08:00"] } });
  await ctx.profiles.addGoal("demo", { description: "Walk 15 minutes daily", category: "activity", origin: "user_initiated", status: "active" });
  await ctx.consent.setGrant("demo", "coaching", true);

  // Demonstrate the prompt-registry gate (clinical review + adversarial battery).
  ctx.prompts.draft("coach.system", "You are a careful, non-directive wellness coach. Never diagnose, prescribe, or change medication. Cite frameworks. Defer clinical questions to humans.");
  ctx.prompts.submitForReview("coach.system", 1);
  ctx.prompts.recordSafetyReview("coach.system", 1, { reviewer: "dr.cso", approved: true });
  const battery = await runBattery();
  ctx.prompts.recordAdversarialGate("coach.system", 1, { passed: battery.failures === 0, total: battery.total, failures: battery.failures });
  ctx.prompts.activate("coach.system", 1);
}

function send(res: http.ServerResponse, status: number, body: unknown, contentType = "application/json"): void {
  const payload = contentType === "application/json" ? JSON.stringify(body) : String(body);
  res.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  res.end(payload);
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function dashboardSnapshot() {
  const events = (await ctx.audit.all()).map((e) => e.event);
  const metrics = computeMetrics(events);
  const verification = await ctx.audit.verify();
  return buildDashboard({ metrics, breakerState: ctx.breaker.state, auditVerification: verification, generatedAt: ctx.clock.iso() });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && path === "/") return send(res, 200, PAGE_HTML, "text/html; charset=utf-8");
    if (method === "GET" && path === "/api/health") return send(res, 200, { ok: true, at: ctx.clock.iso() });

    if (method === "POST" && path === "/api/coach") {
      const body = await readJson(req);
      const userId = String(body.userId ?? "demo");
      const sessionId = String(body.sessionId ?? "web");
      const text = String(body.text ?? "");
      if (!text.trim()) return send(res, 400, { error: "text required" });
      const out = await ctx.coach.coach({ userId, sessionId, text });
      return send(res, 200, {
        response: out.response,
        agency: out.agency,
        anomalies: out.anomalies,
        degraded: out.degraded,
        invariants: out.invariantReport?.results ?? [],
      });
    }

    if (method === "POST" && path === "/api/panic") {
      const body = await readJson(req);
      const out = await ctx.escalation.panic(String(body.userId ?? "demo"), String(body.sessionId ?? "web"));
      return send(res, 200, out);
    }

    if (method === "POST" && path === "/api/consent") {
      const body = await readJson(req);
      const state = await ctx.consent.setGrant(String(body.userId ?? "demo"), body.scope as ConsentScope, Boolean(body.granted));
      return send(res, 200, state);
    }

    if (method === "GET" && path === "/api/profile") {
      const profile = await ctx.profiles.getOrCreate(url.searchParams.get("userId") ?? "demo");
      return send(res, 200, profile);
    }

    if (method === "GET" && path === "/api/twin") {
      const profile = await ctx.profiles.getOrCreate(url.searchParams.get("userId") ?? "demo");
      const state = new LightTwin().model(profile);
      const fidelity = computeTwinFidelity(profile, ctx.clock, { reliableSourceFraction: 0.4, modelConfidence: 0.5 });
      return send(res, 200, { state, fidelity });
    }

    if (method === "GET" && path === "/api/dashboard") return send(res, 200, await dashboardSnapshot());

    if (method === "GET" && path === "/api/audit/verify") {
      const v = await ctx.audit.verify();
      return send(res, 200, { verified: v.ok, detail: v.ok ? { count: v.value.count } : v.error });
    }

    if (method === "GET" && path === "/api/export") {
      const profile = await ctx.profiles.getOrCreate(url.searchParams.get("userId") ?? "demo");
      return send(res, 200, exportProfile(profile));
    }

    return send(res, 404, { error: "not found", path });
  } catch (e) {
    return send(res, 500, { error: "internal", detail: String(e) });
  }
});

const PORT = Number(process.env.PORT ?? 3000);
seed().then(() => {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`digital-twin-health-coach listening on http://127.0.0.1:${PORT}`);
  });
});

export { server, ctx };
