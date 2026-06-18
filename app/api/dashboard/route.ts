import { getCoach } from "../../runtime.ts";
import { computeMetrics } from "../../../src/governance/metrics/metrics.ts";
import { buildDashboard } from "../../../src/governance/dashboard/dashboard.ts";

/** GET /api/dashboard — governance snapshot for non-technical stakeholders (H5). */
export async function GET(): Promise<Response> {
  const ctx = getCoach();
  const events = (await ctx.audit.all()).map((e) => e.event);
  const metrics = computeMetrics(events);
  const auditVerification = await ctx.audit.verify();
  const snapshot = buildDashboard({
    metrics,
    breakerState: ctx.breaker.state,
    auditVerification,
    generatedAt: ctx.clock.iso(),
  });
  return Response.json(snapshot);
}
