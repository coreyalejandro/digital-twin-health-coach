import {
  type HealthProfile,
  type Condition,
  type Medication,
  type Goal,
  emptyProfile,
} from "../../domain/health.ts";
import { type Result, ok, err } from "../../domain/result.ts";

/**
 * Health-data portability (report T8 / §7.2). Users can export their full
 * profile in a FHIR-compatible bundle and re-import it — preventing lock-in and
 * enabling care continuity. This is an ethical requirement for health data and
 * directly supports user agency.
 *
 * We emit a simplified FHIR R4-style Bundle (Patient, Condition,
 * MedicationStatement, Goal). It is intentionally a subset, clearly labelled,
 * rather than a false claim of full FHIR conformance (I2).
 */

export interface FhirBundle {
  resourceType: "Bundle";
  type: "collection";
  meta: { profile: string; exportedBy: string; note: string };
  entry: { resource: Record<string, unknown> }[];
}

export function exportProfile(profile: HealthProfile): FhirBundle {
  const entry: { resource: Record<string, unknown> }[] = [];

  entry.push({
    resource: {
      resourceType: "Patient",
      id: profile.userId,
      name: profile.displayName ? [{ text: profile.displayName }] : undefined,
    },
  });

  for (const c of profile.conditions) {
    entry.push({
      resource: {
        resourceType: "Condition",
        id: c.id,
        code: { text: c.name, coding: c.icd10 ? [{ system: "icd-10", code: c.icd10 }] : undefined },
        clinicalStatus: { text: c.status },
        extension: [
          { url: "x-complexity", valueString: c.complexity },
          { url: "x-requires-oversight", valueBoolean: c.requiresClinicianOversight },
        ],
      },
    });
  }

  for (const m of profile.medications) {
    entry.push({
      resource: {
        resourceType: "MedicationStatement",
        id: m.id,
        status: m.active ? "active" : "stopped",
        medicationCodeableConcept: { text: m.name, coding: m.rxnorm ? [{ system: "rxnorm", code: m.rxnorm }] : undefined },
        dosage: m.dose ? [{ text: m.dose }] : undefined,
      },
    });
  }

  for (const g of profile.goals) {
    entry.push({
      resource: {
        resourceType: "Goal",
        id: g.id,
        description: { text: g.description },
        lifecycleStatus: g.status,
        extension: [{ url: "x-origin", valueString: g.origin }],
      },
    });
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    meta: {
      profile: "digital-twin-health-coach/portable-profile/v1",
      exportedBy: "digital-twin-health-coach",
      note: "Simplified FHIR R4-style subset for portability; not a full FHIR conformance claim.",
    },
    entry,
  };
}

export function importBundle(bundle: unknown, nowIso: string): Result<HealthProfile> {
  if (!bundle || typeof bundle !== "object") return err("not an object");
  const b = bundle as Partial<FhirBundle>;
  if (b.resourceType !== "Bundle" || !Array.isArray(b.entry)) return err("not a FHIR Bundle");

  const patient = b.entry.find((e) => (e.resource as { resourceType?: string })?.resourceType === "Patient");
  const userId = (patient?.resource as { id?: string })?.id;
  if (!userId) return err("bundle has no Patient with id");

  const profile = emptyProfile(userId, nowIso);
  const nameText = (patient?.resource as { name?: { text?: string }[] })?.name?.[0]?.text;
  if (nameText) profile.displayName = nameText;

  for (const e of b.entry) {
    const r = e.resource as Record<string, unknown>;
    switch (r.resourceType) {
      case "Condition":
        profile.conditions.push(parseCondition(r));
        break;
      case "MedicationStatement":
        profile.medications.push(parseMedication(r));
        break;
      case "Goal":
        profile.goals.push(parseGoal(r, nowIso));
        break;
      default:
        break;
    }
  }
  return ok(profile);
}

function ext(r: Record<string, unknown>, url: string): unknown {
  const arr = r.extension as { url: string; valueString?: unknown; valueBoolean?: unknown }[] | undefined;
  const found = arr?.find((x) => x.url === url);
  return found?.valueString ?? found?.valueBoolean;
}

function parseCondition(r: Record<string, unknown>): Condition {
  const code = r.code as { text?: string } | undefined;
  const status = (r.clinicalStatus as { text?: string } | undefined)?.text;
  return {
    id: String(r.id ?? "cond"),
    name: code?.text ?? "unknown",
    status: status === "in_remission" || status === "resolved" ? status : "active",
    complexity: (ext(r, "x-complexity") as Condition["complexity"]) ?? "moderate",
    requiresClinicianOversight: ext(r, "x-requires-oversight") === true,
  };
}

function parseMedication(r: Record<string, unknown>): Medication {
  const med = r.medicationCodeableConcept as { text?: string } | undefined;
  const dosage = (r.dosage as { text?: string }[] | undefined)?.[0]?.text;
  return {
    id: String(r.id ?? "med"),
    name: med?.text ?? "unknown",
    active: r.status === "active",
    dose: dosage,
  };
}

function parseGoal(r: Record<string, unknown>, nowIso: string): Goal {
  const desc = (r.description as { text?: string } | undefined)?.text ?? "goal";
  const origin = ext(r, "x-origin");
  return {
    id: String(r.id ?? "goal"),
    description: desc,
    category: "imported",
    origin: origin === "user_initiated" || origin === "clinician_set" ? origin : "ai_suggested",
    status: (r.lifecycleStatus as Goal["status"]) ?? "active",
    createdAt: nowIso,
  };
}
