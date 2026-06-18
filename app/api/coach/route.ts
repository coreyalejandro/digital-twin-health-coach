import { getCoach } from "../../runtime.ts";

/**
 * POST /api/coach — runs a user message through the full governed pipeline.
 * App Router route handler (Web Request/Response API; no framework lock-in).
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { userId?: string; sessionId?: string; text?: string };
  const text = String(body.text ?? "").trim();
  if (!text) return Response.json({ error: "text required" }, { status: 400 });

  const ctx = getCoach();
  const out = await ctx.coach.coach({
    userId: body.userId ?? "demo",
    sessionId: body.sessionId ?? "web",
    text,
  });
  return Response.json({
    response: out.response,
    agency: out.agency,
    anomalies: out.anomalies,
    degraded: out.degraded,
    invariants: out.invariantReport?.results ?? [],
  });
}
