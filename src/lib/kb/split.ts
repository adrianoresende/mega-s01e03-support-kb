// How #4471 splits into the problems it really holds. causes.ts places a report by its tenant;
// this file also honours what the report says, so a report the desk read as a one-day move
// (desk-notes.json) is its own problem, not a footnote under the tenant's cause.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'shift' | 'unplaced';

export const PROBLEMS: Record<Problem, { title: string; issue: number | null }> = {
  parser: { title: 'Shared parser reads day-first dates month first', issue: 1 },
  hint: { title: 'booking-v3 form hints MM/DD/YYYY to day-first tenants', issue: 2 },
  shift: { title: 'Invites land one day off (time zone), not a day/month flip', issue: 3 },
  unplaced: { title: 'No tenant on file, or tenant writes month first', issue: null },
};

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'shift';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemGroup = { problem: Problem; reports: Report[]; tenants: number; firstSeen: string; lastSeen: string };

// One id, one report; only reports merged into `ticket`; grouped by problem, biggest first.
export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): { merged: number; rows: number; groups: ProblemGroup[] } {
  const merged = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of merged) {
    const p = problemOf(r, tenantOf(r), oneDayMove);
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const groups = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return { problem, reports: rs, tenants: new Set(rs.map((r) => r.tenant)).size, firstSeen: days[0], lastSeen: days[days.length - 1] };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { merged: merged.length, rows: all.filter((r) => r.mergedInto === ticket).length, groups };
}
