import {
  type HealthProfile,
  type Condition,
  type Medication,
  type Goal,
  type InteractionPreferences,
  type CareTeamMember,
  type Complexity,
  emptyProfile,
  profileComplexity,
  requiresClinicianOversight,
} from "../../domain/health.ts";
import type { Clock } from "../../domain/time.ts";
import { newId } from "../../domain/ids.ts";
import type { KeyValueRepository } from "../../infrastructure/storage/repository.ts";

/**
 * Structured health profile storage (report T2). Gives the coach memory of the
 * user's conditions, medications, goals and care team — the thing that
 * distinguishes a coach from a stateless search engine.
 */
export class ProfileService {
  private readonly repo: KeyValueRepository<HealthProfile>;
  private readonly clock: Clock;

  constructor(repo: KeyValueRepository<HealthProfile>, clock: Clock) {
    this.repo = repo;
    this.clock = clock;
  }

  async getOrCreate(userId: string): Promise<HealthProfile> {
    const existing = await this.repo.get(userId);
    if (existing) return existing;
    const p = emptyProfile(userId, this.clock.iso());
    await this.repo.put(userId, p);
    return p;
  }

  async get(userId: string): Promise<HealthProfile | undefined> {
    return this.repo.get(userId);
  }

  private async mutate(userId: string, fn: (p: HealthProfile) => void): Promise<HealthProfile> {
    const p = await this.getOrCreate(userId);
    fn(p);
    p.updatedAt = this.clock.iso();
    await this.repo.put(userId, p);
    return p;
  }

  addCondition(userId: string, c: Omit<Condition, "id">): Promise<HealthProfile> {
    return this.mutate(userId, (p) => p.conditions.push({ ...c, id: newId("cond") }));
  }
  addMedication(userId: string, m: Omit<Medication, "id">): Promise<HealthProfile> {
    return this.mutate(userId, (p) => p.medications.push({ ...m, id: newId("med") }));
  }
  addGoal(userId: string, g: Omit<Goal, "id" | "createdAt">): Promise<HealthProfile> {
    return this.mutate(userId, (p) => p.goals.push({ ...g, id: newId("goal"), createdAt: this.clock.iso() }));
  }
  addCareTeamMember(userId: string, m: Omit<CareTeamMember, "id">): Promise<HealthProfile> {
    return this.mutate(userId, (p) => p.careTeam.push({ ...m, id: newId("care") }));
  }
  updatePreferences(userId: string, prefs: Partial<InteractionPreferences>): Promise<HealthProfile> {
    return this.mutate(userId, (p) => {
      p.preferences = { ...p.preferences, ...prefs };
    });
  }

  async complexity(userId: string): Promise<Complexity> {
    return profileComplexity(await this.getOrCreate(userId));
  }
  async needsOversight(userId: string): Promise<boolean> {
    return requiresClinicianOversight(await this.getOrCreate(userId));
  }
}
