import { clocksFromPgn, phaseOf, timeControlFromPgn } from './review';
import { MISTAKE_CHECK, MISTAKE_LABEL } from './errorTaxonomy';
import type { GamePhase, GameReview, MistakeType } from '../types/review';
import type { StoredGame } from '../types/db';

/**
 * "Your patterns" (CL-3): the mistakes of every reviewed game, per 100 of hoot65's moves, by kind, by
 * phase of the game and by the time left on the clock, with a month-by-month trend.
 *
 * The denominators come from the games themselves: every move of hoot65's counts toward its phase,
 * and, when the game's PGN has a clock time for every move, toward its clock bucket. A review whose
 * game is no longer in the database is left out, since its moves cannot be counted.
 */

export type ClockBucket = 'over_half' | 'quarter_to_half' | 'tenth_to_quarter' | 'under_tenth';

export const CLOCK_BUCKETS: ClockBucket[] = ['over_half', 'quarter_to_half', 'tenth_to_quarter', 'under_tenth'];

export const CLOCK_LABEL: Record<ClockBucket, string> = {
  over_half: 'More than half your time left',
  quarter_to_half: 'A quarter to half left',
  tenth_to_quarter: 'A tenth to a quarter left',
  under_tenth: 'Less than a tenth left',
};

export const PHASE_LABEL: Record<GamePhase, string> = {
  opening: 'Opening (moves 1-10)',
  middlegame: 'Middlegame (moves 11-30)',
  endgame: 'Endgame (move 31 on)',
};

export interface RateRow<K extends string> {
  key: K;
  label: string;
  /** hoot65's moves in this group. */
  moves: number;
  mistakes: number;
  per100: number;
}

export interface TypeRow {
  type: MistakeType;
  label: string;
  /** The board check that catches this kind of mistake. */
  check: string;
  mistakes: number;
  per100: number;
}

export interface MonthRow {
  /** "2026-10". */
  month: string;
  games: number;
  moves: number;
  mistakes: number;
  per100: number;
}

export interface MistakeSummary {
  games: number;
  /** Reviews made with Maia; the others found only material mistakes. */
  maiaGames: number;
  moves: number;
  mistakes: number;
  per100: number;
  /** The kinds seen, most frequent first. */
  byType: TypeRow[];
  byPhase: RateRow<GamePhase>[];
  /** Only games whose PGN has a clock time for every move. */
  byClock: RateRow<ClockBucket>[];
  clockGames: number;
  /** Months with reviewed games, oldest first. */
  byMonth: MonthRow[];
}

/** Mistakes per 100 moves, to one decimal. */
export const per100 = (mistakes: number, moves: number): number => (moves > 0 ? Math.round((1000 * mistakes) / moves) / 10 : 0);

/** The share of the base time left: over half, a quarter to half, a tenth to a quarter, under a tenth. */
export function clockBucket(secondsLeft: number, baseSeconds: number): ClockBucket {
  const share = secondsLeft / baseSeconds;
  return share > 0.5 ? 'over_half' : share > 0.25 ? 'quarter_to_half' : share > 0.1 ? 'tenth_to_quarter' : 'under_tenth';
}

/** Seconds on the mover's clock before each ply, or null when the PGN lacks a clock time for a move. */
function clockBefore(game: StoredGame): ((ply: number) => number) | null {
  const clocks = clocksFromPgn(game.pgn);
  const control = timeControlFromPgn(game.pgn);
  if (!control || control.base <= 0 || clocks.length < game.movesSan.length) return null;
  return (ply) => (ply >= 2 ? clocks[ply - 2] : control.base);
}

export function summarizeReviews(reviews: GameReview[], storedGames: StoredGame[]): MistakeSummary {
  const byId = new Map(storedGames.map((g) => [g.id, g]));
  const typeCount = new Map<MistakeType, number>();
  const phase = new Map<GamePhase, { moves: number; mistakes: number }>(
    (['opening', 'middlegame', 'endgame'] as GamePhase[]).map((p) => [p, { moves: 0, mistakes: 0 }])
  );
  const clock = new Map<ClockBucket, { moves: number; mistakes: number }>(CLOCK_BUCKETS.map((b) => [b, { moves: 0, mistakes: 0 }]));
  const month = new Map<string, MonthRow>();
  let games = 0;
  let maiaGames = 0;
  let moves = 0;
  let mistakes = 0;
  let clockGames = 0;

  for (const review of reviews) {
    const game = byId.get(review.gameId);
    if (!game) continue;
    games++;
    if (review.engine === 'maia') maiaGames++;
    const white = review.userColor === 'white';
    const userPlies = game.movesSan.map((_, i) => i).filter((i) => (i % 2 === 0) === white);
    const before = clockBefore(game);
    const base = before ? timeControlFromPgn(game.pgn)!.base : 0;
    if (before) clockGames++;

    for (const ply of userPlies) {
      phase.get(phaseOf(ply))!.moves++;
      if (before) clock.get(clockBucket(before(ply), base))!.moves++;
    }
    for (const m of review.criticalMoments) {
      typeCount.set(m.type, (typeCount.get(m.type) ?? 0) + 1);
      phase.get(phaseOf(m.ply))!.mistakes++;
      if (before) clock.get(clockBucket(before(m.ply), base))!.mistakes++;
    }
    moves += userPlies.length;
    mistakes += review.criticalMoments.length;

    const key = new Date(game.timestamp).toISOString().slice(0, 7);
    const row = month.get(key) ?? { month: key, games: 0, moves: 0, mistakes: 0, per100: 0 };
    row.games++;
    row.moves += userPlies.length;
    row.mistakes += review.criticalMoments.length;
    month.set(key, row);
  }

  return {
    games,
    maiaGames,
    moves,
    mistakes,
    per100: per100(mistakes, moves),
    byType: [...typeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => ({ type, label: MISTAKE_LABEL[type], check: MISTAKE_CHECK[type], mistakes: n, per100: per100(n, moves) })),
    byPhase: [...phase.entries()].map(([key, r]) => ({ key, label: PHASE_LABEL[key], ...r, per100: per100(r.mistakes, r.moves) })),
    byClock: clockGames ? [...clock.entries()].map(([key, r]) => ({ key, label: CLOCK_LABEL[key], ...r, per100: per100(r.mistakes, r.moves) })) : [],
    clockGames,
    byMonth: [...month.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ ...r, per100: per100(r.mistakes, r.moves) })),
  };
}
