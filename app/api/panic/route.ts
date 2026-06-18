import { getCoach } from "../../runtime.ts";

/** POST /api/panic — the unconditional "I need human help" path (report T7). */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { userId?: string; sessionId?: string };
  const ctx = getCoach();
  const out = await ctx.escalation.panic(body.userId ?? "demo", body.sessionId ?? "web");
  return Response.json(out);
}
