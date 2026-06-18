import { newId } from "../../domain/ids.ts";
import type { Clock } from "../../domain/time.ts";
import { type Result, ok, err } from "../../domain/result.ts";

/**
 * User Data Trust — SOFTWARE side (report H8 / §8.3).
 *
 * IMPORTANT (No Phantom Work, I2): a real data trust is a legal/organisational
 * entity with fiduciary duties; that part is a documented human-action item
 * (see specs/human-action/user-data-trust.md). What is implemented HERE is the
 * software substrate: membership, proposals for data use, democratic voting
 * with quorum, and a transparent, append-only accounting ledger of how data is
 * actually used (and any revenue attributed).
 */

export type VoteChoice = "for" | "against" | "abstain";
export type ProposalStatus = "open" | "passed" | "rejected";

export interface DataUseProposal {
  id: string;
  title: string;
  description: string;
  dataUse: string;
  createdAt: string;
  status: ProposalStatus;
}

export interface Vote {
  proposalId: string;
  memberId: string;
  choice: VoteChoice;
  at: string;
}

export interface Tally {
  for: number;
  against: number;
  abstain: number;
  totalVotes: number;
  eligibleMembers: number;
  quorumMet: boolean;
  outcome: ProposalStatus;
}

export interface LedgerEntry {
  at: string;
  dataUse: string;
  proposalId?: string;
  recordCount: number;
  revenueAttributedUsd: number;
  note?: string;
}

export class DataTrust {
  private readonly clock: Clock;
  private readonly members = new Set<string>();
  private readonly proposals = new Map<string, DataUseProposal>();
  private readonly votes = new Map<string, Map<string, Vote>>();
  private readonly ledger: LedgerEntry[] = [];
  private readonly quorumFraction: number;

  constructor(clock: Clock, quorumFraction = 0.5) {
    this.clock = clock;
    this.quorumFraction = quorumFraction;
  }

  addMember(memberId: string): void {
    this.members.add(memberId);
  }
  memberCount(): number {
    return this.members.size;
  }

  createProposal(title: string, description: string, dataUse: string): DataUseProposal {
    const p: DataUseProposal = {
      id: newId("prop"),
      title,
      description,
      dataUse,
      createdAt: this.clock.iso(),
      status: "open",
    };
    this.proposals.set(p.id, p);
    this.votes.set(p.id, new Map());
    return p;
  }

  castVote(proposalId: string, memberId: string, choice: VoteChoice): Result<Vote> {
    const p = this.proposals.get(proposalId);
    if (!p) return err(`unknown proposal ${proposalId}`);
    if (p.status !== "open") return err("voting is closed for this proposal");
    if (!this.members.has(memberId)) return err("only members may vote");
    const v: Vote = { proposalId, memberId, choice, at: this.clock.iso() };
    this.votes.get(proposalId)!.set(memberId, v); // one vote per member (overwrites)
    return ok(v);
  }

  tally(proposalId: string): Result<Tally> {
    const p = this.proposals.get(proposalId);
    if (!p) return err(`unknown proposal ${proposalId}`);
    const votes = [...(this.votes.get(proposalId)?.values() ?? [])];
    const forV = votes.filter((v) => v.choice === "for").length;
    const against = votes.filter((v) => v.choice === "against").length;
    const abstain = votes.filter((v) => v.choice === "abstain").length;
    const eligible = this.members.size;
    const quorumMet = eligible > 0 && votes.length / eligible >= this.quorumFraction;
    const outcome: ProposalStatus = quorumMet ? (forV > against ? "passed" : "rejected") : "open";
    return ok({ for: forV, against, abstain, totalVotes: votes.length, eligibleMembers: eligible, quorumMet, outcome });
  }

  /** Finalise a proposal by recording the tallied outcome. */
  close(proposalId: string): Result<DataUseProposal> {
    const t = this.tally(proposalId);
    if (!t.ok) return t;
    if (!t.value.quorumMet) return err("cannot close: quorum not met");
    const p = this.proposals.get(proposalId)!;
    p.status = t.value.outcome;
    return ok(p);
  }

  /** Transparent, append-only record of how data was actually used. */
  recordUse(entry: Omit<LedgerEntry, "at">): void {
    this.ledger.push({ ...entry, at: this.clock.iso() });
  }

  accounting(): { totalRecordsUsed: number; totalRevenueUsd: number; entries: LedgerEntry[] } {
    return {
      totalRecordsUsed: this.ledger.reduce((a, e) => a + e.recordCount, 0),
      totalRevenueUsd: Number(this.ledger.reduce((a, e) => a + e.revenueAttributedUsd, 0).toFixed(2)),
      entries: [...this.ledger],
    };
  }
}
