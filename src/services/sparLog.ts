import type { HumanElo } from '../types/engine';
import type { PlanMilestone } from '../types/curriculum';
import type { MilestoneResult } from '../analytics/planMilestones';
import type { MistakeType } from '../types/review';

/** Playing a lesson's position on against Maia (CL-6). */
export interface SparRequest {
  lessonId: string;
  title: string;
  /** The lesson's start and the moves that reach the position the spar begins from. */
  initialFen: string;
  movesSan: string[];
  studentColor: 'w' | 'b';
  elo: HumanElo;
  /** The lesson's own plan goals, checked with the goals every spar has. */
  milestones: PlanMilestone[];
}

/** One finished spar, kept for a later progress panel. */
export interface SparRecord {
  at: number;
  lessonId: string;
  title: string;
  elo: HumanElo;
  studentColor: 'w' | 'b';
  startFen: string;
  moves: string[];
  milestones: MilestoneResult[];
  moments: Array<{ label: string; type: MistakeType }>;
  engine: 'maia' | 'material';
}

export const SPAR_LOG_KEY = 'my_chess_spar_log_v1';
const MAX_RECORDS = 200;

export function readSparLog(): SparRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SPAR_LOG_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logSpar(record: SparRecord): void {
  try {
    localStorage.setItem(SPAR_LOG_KEY, JSON.stringify([...readSparLog(), record].slice(-MAX_RECORDS)));
  } catch {
    /* no storage: the result is shown but not kept */
  }
}
