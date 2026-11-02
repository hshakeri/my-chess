import type { QuestionKind } from './microQuestions';

/**
 * The record of board questions answered (CL-5): every answer from the lesson gate, the warm-up and the
 * Play tab's question,
 * kept in this browser (localStorage, the newest 1000), for the warm-up's choice of what to ask next
 * and for a later progress panel. Reading or writing never throws: without storage nothing is kept.
 */
export interface CctEvent {
  at: number;
  kind: QuestionKind;
  correct: boolean;
  /** Time from the question appearing to the answer. */
  ms: number;
  source: 'lesson' | 'warmup' | 'play';
  fen: string;
  lessonId?: string;
}

export const CCT_LOG_KEY = 'my_chess_cct_log_v1';
export const CCT_GATE_KEY = 'my_chess_cct_gate';
const MAX_EVENTS = 1000;

export function readCctLog(): CctEvent[] {
  try {
    const raw = localStorage.getItem(CCT_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logCct(event: CctEvent): void {
  try {
    const events = [...readCctLog(), event].slice(-MAX_EVENTS);
    localStorage.setItem(CCT_LOG_KEY, JSON.stringify(events));
  } catch {
    /* no storage: nothing is kept */
  }
}

/** Mean answer time and accuracy per kind, over the given events. */
export function cctStats(events: CctEvent[]): Partial<Record<QuestionKind, { n: number; meanMs: number; correct: number }>> {
  const out: Partial<Record<QuestionKind, { n: number; meanMs: number; correct: number }>> = {};
  for (const e of events) {
    const s = (out[e.kind] ??= { n: 0, meanMs: 0, correct: 0 });
    s.meanMs = (s.meanMs * s.n + e.ms) / (s.n + 1);
    s.n += 1;
    if (e.correct) s.correct += 1;
  }
  return out;
}

export interface CctSourceStats {
  source: CctEvent['source'];
  n: number;
  correct: number;
  /** Share right over the newest 20 answers, and over the 20 before them (null when there are none). */
  recent: number | null;
  before: number | null;
}

/** The board questions answered, by where they were asked: the lessons, games, the warm-up. */
export function cctBySource(events: CctEvent[]): CctSourceStats[] {
  const share = (xs: CctEvent[]) => (xs.length ? xs.filter((e) => e.correct).length / xs.length : null);
  return (['lesson', 'play', 'warmup'] as const)
    .map((source) => {
      const mine = events.filter((e) => e.source === source).sort((a, b) => a.at - b.at);
      return {
        source,
        n: mine.length,
        correct: mine.filter((e) => e.correct).length,
        recent: share(mine.slice(-20)),
        before: share(mine.slice(-40, -20)),
      };
    })
    .filter((row) => row.n > 0);
}

/** Whether the lesson asks a board question before each decision (on unless switched off). */
export function readGateEnabled(): boolean {
  try {
    return localStorage.getItem(CCT_GATE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeGateEnabled(on: boolean): void {
  try {
    localStorage.setItem(CCT_GATE_KEY, on ? 'on' : 'off');
  } catch {
    /* the choice lasts until the page closes */
  }
}
