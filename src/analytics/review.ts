import { Chess } from 'chess.js';
import { classifyMove, enPrise, matesInOne } from './errorTaxonomy';
import type { DecisionSpec } from '../services/cards';
import type { CriticalMoment, GamePhase, GameReview } from '../types/review';

/**
 * Post-game review of one game (CL-3).
 *
 * Maia scores every position for players of the two ratings: its value head is the expected score of
 * the side to move, its policy how often a player of that rating chooses each move. A move of
 * hoot65's that lowers hoot65's expected score by SWING or more is a critical moment, unless the game
 * was already lost. Each moment is then named by the material search in errorTaxonomy.ts. Without
 * Maia (the model failed to load) the review falls back to material alone: the moves after which a
 * mate in one, a loose piece or a missed capture shows on the board are classified, and those that
 * lose material are the moments.
 */

/** A drop of at least this much in hoot65's expected score makes a move a critical moment. */
export const SWING = 0.15;
/** A move made when hoot65's expected score was already below this is not reviewed. */
export const LOST = 0.15;
/**
 * Maia was trained on Lichess games, so Chess.com ratings get +400 before they reach it, as in the
 * archive analysis (scripts/game-analysis). An assumption: it moves the absolute expected scores more
 * than the comparison between moves.
 */
export const MAIA_RATING_OFFSET = 400;
const DEFAULT_RATING = 1150;

export interface ReviewInput {
  gameId: string;
  movesSan: string[];
  userColor: 'white' | 'black';
  whiteRating?: number;
  blackRating?: number;
  /** The game's PGN, for the clock times ([%clk]) and the time control. */
  pgn?: string;
  /** The position the moves start from (a spar from a lesson); the standard start when absent. */
  initialFen?: string;
}

/** One position for Maia: the position, up to seven positions before it, and the two ratings. */
export interface ScoreRequest {
  fen: string;
  priorFens: string[];
  selfElo: number;
  oppoElo: number;
}

export interface PositionScore {
  /** Expected score of the side to move, 0 to 1 (a draw counting half). */
  winProbability: number;
  /** UCI move → how often a player of `selfElo` plays it. */
  moves: Map<string, number>;
}

/** Scores positions in batches; one result per request, null where a position could not be scored. */
export type PositionScorer = (
  requests: ScoreRequest[],
  onProgress?: (done: number, total: number) => void
) => Promise<Array<PositionScore | null>>;

export interface ReviewOptions {
  onProgress?: (stage: 'scoring' | 'classifying', done: number, total: number) => void;
  isCancelled?: () => boolean;
  now?: number;
}

export class ReviewCancelled extends Error {
  constructor() {
    super('Review cancelled');
  }
}

/** Seconds left on the mover's clock after each ply, from the PGN's [%clk h:mm:ss] comments. */
export function clocksFromPgn(pgn: string | undefined): number[] {
  if (!pgn) return [];
  return [...pgn.matchAll(/\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/g)].map(([, h, m, s]) => Number(h) * 3600 + Number(m) * 60 + Number(s));
}

/** Base time and increment in seconds from the PGN's TimeControl header ("600" or "600+5"). */
export function timeControlFromPgn(pgn: string | undefined): { base: number; increment: number } | null {
  const m = pgn ? /\[TimeControl "(\d+)(?:\+(\d+))?"\]/.exec(pgn) : null;
  return m ? { base: Number(m[1]), increment: Number(m[2] ?? 0) } : null;
}

/** The phase of a ply as the audit's archive scan counts it: plies 1-20 opening, 21-60 middlegame, then endgame. */
export function phaseOf(ply: number): GamePhase {
  return ply < 20 ? 'opening' : ply < 60 ? 'middlegame' : 'endgame';
}

/** "23...Qxb2" for the move at index `ply` of a game from the standard start. */
export function moveLabel(ply: number, san: string): string {
  const no = Math.floor(ply / 2) + 1;
  return ply % 2 === 0 ? `${no}.${san}` : `${no}...${san}`;
}

/** "23...Qxb2" for `san` played in the position `fen` (its move number and side to move). */
export function labelAt(fen: string, san: string): string {
  const [, turn, , , , fullmove] = fen.split(' ');
  return turn === 'w' ? `${fullmove}.${san}` : `${fullmove}...${san}`;
}

/** The label of the reply to a move played in `fenBefore`: "24.Bxa1" after a move of Black's on move 23. */
export function replyLabel(fenBefore: string, san: string): string {
  const [, turn, , , , fullmove] = fenBefore.split(' ');
  return turn === 'w' ? `${fullmove}...${san}` : `${Number(fullmove) + 1}.${san}`;
}

/** The game ply of the position `fen` counted from the standard start (0 before White's first move). */
function absolutePly(fen: string): number {
  const [, turn, , , , fullmove] = fen.split(' ');
  return (Number(fullmove) - 1) * 2 + (turn === 'b' ? 1 : 0);
}

export async function reviewGame(input: ReviewInput, scorer: PositionScorer | null, opts: ReviewOptions = {}): Promise<GameReview> {
  const stop = () => {
    if (opts.isCancelled?.()) throw new ReviewCancelled();
  };
  const user: 'w' | 'b' = input.userColor === 'white' ? 'w' : 'b';
  const opponent: 'w' | 'b' = user === 'w' ? 'b' : 'w';

  // The position before every ply, and after the last
  const chess = new Chess(input.initialFen);
  const fens = [chess.fen()];
  const sans: string[] = [];
  const ucis: string[] = [];
  const movers: Array<'w' | 'b'> = [];
  for (const san of input.movesSan) {
    let move;
    try {
      move = chess.move(san);
    } catch {
      break;
    }
    sans.push(move.san);
    ucis.push(`${move.from}${move.to}${move.promotion ?? ''}`);
    movers.push(move.color);
    fens.push(chess.fen());
  }
  const userPlies = sans.map((_, i) => i).filter((i) => movers[i] === user);

  // Clocks: only when every move has one
  const clocks = clocksFromPgn(input.pgn);
  const control = timeControlFromPgn(input.pgn);
  const clockAt = (ply: number): Pick<CriticalMoment, 'clockLeft' | 'spent'> => {
    if (clocks.length < sans.length) return {};
    const before = ply >= 2 ? clocks[ply - 2] : control?.base;
    if (before === undefined) return {};
    return { clockLeft: Math.round(before), spent: Math.max(0, Math.round(before - clocks[ply] + (control?.increment ?? 0))) };
  };

  // Maia: the expected score and the policy of every position
  let scores: Array<PositionScore | null> = [];
  if (scorer) {
    const rating = (c: 'w' | 'b') => (c === 'w' ? input.whiteRating : input.blackRating) || DEFAULT_RATING;
    const requests = fens.map((fen, i) => {
      const turn = fen.split(' ')[1] as 'w' | 'b';
      return {
        fen,
        priorFens: fens.slice(Math.max(0, i - 7), i),
        selfElo: rating(turn) + MAIA_RATING_OFFSET,
        oppoElo: rating(turn === 'w' ? 'b' : 'w') + MAIA_RATING_OFFSET,
      };
    });
    scores = await scorer(requests, (done, total) => opts.onProgress?.('scoring', done, total));
    stop();
  }
  const engine: GameReview['engine'] = scores.some(Boolean) ? 'maia' : 'material';

  /** hoot65's expected score in position `i`: from the result when the game is over there, else from Maia. */
  const expected = (i: number): number | undefined => {
    const position = new Chess(fens[i]);
    if (position.isCheckmate()) return position.turn() === user ? 0 : 1;
    if (position.isStalemate() || position.isInsufficientMaterial()) return 0.5;
    const score = scores[i];
    if (!score) return undefined;
    return position.turn() === user ? score.winProbability : 1 - score.winProbability;
  };

  // The moves to classify
  let candidates: number[];
  if (engine === 'maia') {
    candidates = userPlies.filter((i) => {
      const before = expected(i);
      const after = expected(i + 1);
      return before !== undefined && after !== undefined && before >= LOST && before - after >= SWING;
    });
  } else {
    // Without Maia: the moves where a mate in one, a loose piece or a free capture shows on the board
    candidates = userPlies.filter((i) => {
      const before = new Chess(fens[i]);
      const after = new Chess(fens[i + 1]);
      return matesInOne(fens[i]).length > 0 || after.moves().some((m) => m.endsWith('#')) || enPrise(before, opponent).length > 0 || enPrise(after, user).length > 0;
    });
  }

  const moments: CriticalMoment[] = [];
  for (const [k, i] of candidates.entries()) {
    stop();
    opts.onProgress?.('classifying', k, candidates.length);
    const classification = classifyMove(fens[i], sans[i]);
    if (engine === 'material' && classification.type === 'positional') continue;
    const policy = scores[i]?.moves;
    let maiaBest: string | undefined;
    if (policy && policy.size) {
      const [bestUci] = [...policy.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
      maiaBest = new Chess(fens[i]).moves({ verbose: true }).find((m) => `${m.from}${m.to}${m.promotion ?? ''}` === bestUci)?.san;
    }
    const before = expected(i);
    const after = expected(i + 1);
    moments.push({
      ply: i,
      label: labelAt(fens[i], sans[i]),
      fenBefore: fens[i],
      played: sans[i],
      ...(before !== undefined && after !== undefined && engine === 'maia' ? { expectedBefore: before, expectedAfter: after } : {}),
      ...(policy ? { playedShare: policy.get(ucis[i]) ?? 0, maiaBest } : {}),
      ...classification,
      ...clockAt(i),
      phase: phaseOf(absolutePly(fens[i])),
    });
  }
  opts.onProgress?.('classifying', candidates.length, candidates.length);

  return {
    gameId: input.gameId,
    reviewedAt: opts.now ?? Date.now(),
    engine,
    userColor: input.userColor,
    movesReviewed: userPlies.length,
    criticalMoments: moments,
    marks: [],
    cardIds: [],
  };
}

/**
 * Review cards from a game's moments (CL-1 cards): one per mistake that lost material or allowed or
 * missed a mate, at the position before the move, answered by any move that avoids the mistake.
 * Positional moments get no card: the material search has no answer to check a move against.
 */
export function cardSpecsFromReview(review: GameReview, opponent: string): DecisionSpec[] {
  const color: 'w' | 'b' = review.userColor === 'white' ? 'w' : 'b';
  return review.criticalMoments
    .filter((m) => m.type !== 'positional' && m.keeping.length > 0)
    .map((m) => ({
      fen: m.fenBefore,
      acceptedSan: m.keeping,
      lessonId: `review:${review.gameId}`,
      ply: m.ply,
      color,
      path: [],
      tags: [`blunder:${m.type}`, `game:${review.gameId}`],
      title: `Your game vs ${opponent}, move ${Math.floor(m.ply / 2) + 1}`,
    }));
}
