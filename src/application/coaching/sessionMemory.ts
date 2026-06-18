import type { ConversationTurn } from "../safety/safetyNetting.ts";
import type { InteractionSignal } from "../../governance/sentinel/anomaly.ts";

/**
 * Lightweight session/behavioural memory feeding the safety-netting,
 * Agent-Sentinel and agency layers. In production this is Redis-backed; here it
 * is in-process (swappable behind the same surface).
 */
export class SessionMemory {
  private readonly turns = new Map<string, ConversationTurn[]>();
  private readonly signals = new Map<string, InteractionSignal[]>();
  private readonly agency = new Map<string, number[]>();

  appendTurn(sessionId: string, turn: ConversationTurn): void {
    const list = this.turns.get(sessionId) ?? [];
    list.push(turn);
    this.turns.set(sessionId, list);
  }
  getTurns(sessionId: string): ConversationTurn[] {
    return [...(this.turns.get(sessionId) ?? [])];
  }

  appendSignal(userId: string, signal: InteractionSignal): void {
    const list = this.signals.get(userId) ?? [];
    list.push(signal);
    this.signals.set(userId, list);
  }
  getSignals(userId: string): InteractionSignal[] {
    return [...(this.signals.get(userId) ?? [])];
  }

  pushAgency(userId: string, score: number): void {
    const list = this.agency.get(userId) ?? [];
    list.push(score);
    this.agency.set(userId, list);
  }
  getAgencyHistory(userId: string): number[] {
    return [...(this.agency.get(userId) ?? [])];
  }

  /** Mark whether the user questioned the most recent recommendation (feedback). */
  markLastAcceptance(userId: string, acceptedWithoutQuestion: boolean): void {
    const list = this.signals.get(userId);
    if (list && list.length > 0) list[list.length - 1]!.acceptedWithoutQuestion = acceptedWithoutQuestion;
  }
}
