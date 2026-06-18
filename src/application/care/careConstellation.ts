import type { CareRole, CareTeamMember, HealthProfile } from "../../domain/health.ts";
import type { ConsentState } from "../../domain/consent.ts";
import { hasConsent } from "../../domain/consent.ts";
import { type Result, ok, err } from "../../domain/result.ts";

/**
 * Care Constellation (report H6 / §7.1). Health is socially embedded, so the
 * coach is explicitly ONE node among several, each with a clearly bounded role.
 * The critical invariant: only a human_provider carries medical authority; the
 * AI coach is supportive and non-diagnostic and can never give medical direction.
 */

export interface RolePermission {
  role: CareRole;
  authority: "none" | "supportive" | "medical";
  canReceiveSharedContext: boolean;
  canGiveMedicalDirection: boolean;
  description: string;
}

export const ROLE_PERMISSIONS: Record<CareRole, RolePermission> = {
  self: {
    role: "self",
    authority: "supportive",
    canReceiveSharedContext: true,
    canGiveMedicalDirection: false,
    description: "The user — owns their goals and decisions.",
  },
  ai_coach: {
    role: "ai_coach",
    authority: "supportive",
    canReceiveSharedContext: true,
    canGiveMedicalDirection: false,
    description: "Supportive, non-diagnostic coaching. Never replaces clinical judgement.",
  },
  human_provider: {
    role: "human_provider",
    authority: "medical",
    canReceiveSharedContext: true,
    canGiveMedicalDirection: true,
    description: "Licensed clinician — the only node with medical authority.",
  },
  family_caregiver: {
    role: "family_caregiver",
    authority: "supportive",
    canReceiveSharedContext: true,
    canGiveMedicalDirection: false,
    description: "Trusted social support; receives context only with explicit consent.",
  },
  peer_support: {
    role: "peer_support",
    authority: "supportive",
    canReceiveSharedContext: false,
    canGiveMedicalDirection: false,
    description: "Lived-experience peer support; no access to clinical context by default.",
  },
};

export function canGiveMedicalDirection(role: CareRole): boolean {
  return ROLE_PERMISSIONS[role].canGiveMedicalDirection;
}

export class CareConstellation {
  /**
   * Decide whether coaching context may be shared with a given care-team member.
   * Requires BOTH the provider_sharing consent scope AND the member's own
   * canReceiveShares flag AND the role permitting shared context.
   */
  canShareWith(member: CareTeamMember, consent: ConsentState): Result<true> {
    if (!ROLE_PERMISSIONS[member.role].canReceiveSharedContext) {
      return err(`role '${member.role}' is not permitted to receive shared context`);
    }
    if (!member.canReceiveShares) return err("member has not been granted share access");
    if (!hasConsent(consent, "provider_sharing")) return err("provider_sharing consent not granted");
    return ok(true);
  }

  roleClarity(profile: HealthProfile): { role: CareRole; member: string; authority: string; note: string }[] {
    return profile.careTeam.map((m) => ({
      role: m.role,
      member: m.displayName,
      authority: ROLE_PERMISSIONS[m.role].authority,
      note: ROLE_PERMISSIONS[m.role].description,
    }));
  }

  hasHumanProvider(profile: HealthProfile): boolean {
    return profile.careTeam.some((m) => m.role === "human_provider");
  }
}
