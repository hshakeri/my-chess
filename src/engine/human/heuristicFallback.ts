import { Chess, Move } from 'chess.js';
import { HumanElo, EngineStyle, MoveCandidate } from '../../types/engine';
import { SearchTimeout, TacticalEvaluator } from './tacticalEvaluator';

export interface EloProfile {
  /** Plies searched for every root move, the root move included, in a pass that always completes. */
  depth: number;
  /**
   * An optional deeper search of the candidate moves: those within `candidateWindowCp` of the best
   * first-pass score, at most `maxCandidates`. It runs only in what is left of `moveBudgetMs`, counted
   * from the start of the move, and its scores replace the first-pass ones only if every candidate
   * finishes in time; otherwise the first pass stands unchanged.
   */
  deepen?: { depth: number; moveBudgetMs: number; candidateWindowCp: number; maxCandidates: number };
  temperature: number;
  blunderProbability: number;
  tacticalOversightRate: number;
}

// Depth 3 for every root move took 14 s and depth 4 took 70 s on a typical middlegame (the worker gives
// up after 4 s and the page then froze running the same search again). 1700 now searches like 1500 with
// a colder choice. 1900 looks a third ply deep only at the moves it could actually play, and only within
// one second for the whole move: at its temperature (20 cp) a move 60 cp below the best is chosen less
// than 5% as often, and a third ply for every root move takes several seconds.
export const ELO_PROFILES: Readonly<Record<HumanElo, EloProfile>> = {
  1100: {
    depth: 1,
    temperature: 1.6,
    blunderProbability: 0.14,
    tacticalOversightRate: 0.20,
  },
  1300: {
    depth: 2,
    temperature: 1.2,
    blunderProbability: 0.08,
    tacticalOversightRate: 0.12,
  },
  1500: {
    depth: 2,
    temperature: 0.8,
    blunderProbability: 0.04,
    tacticalOversightRate: 0.06,
  },
  1700: {
    depth: 2,
    temperature: 0.45,
    blunderProbability: 0.02,
    tacticalOversightRate: 0.03,
  },
  1900: {
    depth: 2,
    deepen: { depth: 3, moveBudgetMs: 1000, candidateWindowCp: 60, maxCandidates: 8 },
    temperature: 0.20,
    blunderProbability: 0.008,
    tacticalOversightRate: 0.01,
  },
};

/**
 * In the deeper pass a candidate only needs an exact score while it could still be chosen. One that falls
 * more than this many centipawns below the best candidate so far is searched with a window that stops as
 * soon as that is certain; the bound it returns is above its true score, but at the 1900 temperature
 * (20 cp) its share of the choice is below e^-15 either way.
 */
export const DEEPEN_MARGIN_CP = 300;

export interface ScoredMove {
  san: string;
  uci: string;
  score: number; // from the moving side's perspective, style adjustment included
  isCapture: boolean;
  isCheck: boolean;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function styleBonus(style: EngineStyle, isCapture: boolean, givesCheck: boolean): number {
  if (style === 'aggressive') return (isCapture ? 30 : 0) + (givesCheck ? 25 : 0);
  // Favor king safety and quiet development
  if (style === 'solid') return !isCapture && !givesCheck ? 15 : 0;
  return 0;
}

/** Score every root move by searching `plies - 1` further plies (plus quiescence) after it. */
export function scoreRootMoves(
  fen: string,
  rootMoves: Move[],
  plies: number,
  style: EngineStyle,
  bounds?: { deadline: number; marginCp: number }
): ScoredMove[] {
  const chess = new Chess(fen);
  const isWhite = chess.turn() === 'w';
  const scored: ScoredMove[] = [];
  let best = -Infinity;

  for (const move of rootMoves) {
    chess.move(move);
    const givesCheck = chess.inCheck();
    const bonus = styleBonus(style, !!move.captured, givesCheck);

    let alpha = -Infinity;
    let beta = Infinity;
    if (bounds && best > -Infinity) {
      // The search value at which this move's score falls `marginCp` below the best so far
      const floor = best - bounds.marginCp - bonus;
      if (isWhite) alpha = floor;
      else beta = -floor;
    }

    let evalScore: number;
    try {
      evalScore = TacticalEvaluator.search(chess, plies - 1, alpha, beta, bounds ? bounds.deadline : Infinity);
    } finally {
      chess.undo();
    }

    const score = (isWhite ? evalScore : -evalScore) + bonus;
    if (score > best) best = score;
    scored.push({
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      score,
      isCapture: !!move.captured,
      isCheck: givesCheck,
    });
  }
  return scored;
}

/**
 * Re-score the candidate moves (best first) one ply deeper. All candidates get deeper scores or none do:
 * if `deadline` (performance.now() milliseconds) passes first, the first-pass scores are returned
 * unchanged. Moves outside the candidate set keep their first-pass scores, so a candidate refuted by the
 * deeper search can lose its place to them.
 */
export function deepenCandidates(
  fen: string,
  legalMoves: Move[],
  firstPass: ScoredMove[],
  deepen: NonNullable<EloProfile['deepen']>,
  style: EngineStyle,
  deadline: number
): ScoredMove[] {
  if (now() >= deadline) return firstPass;
  const bestFirst = [...firstPass].sort((a, b) => b.score - a.score);
  const cutoff = bestFirst[0].score - deepen.candidateWindowCp;
  const candidates = bestFirst.filter((m) => m.score >= cutoff).slice(0, deepen.maxCandidates);
  const byUci = new Map(legalMoves.map((m) => [`${m.from}${m.to}${m.promotion || ''}`, m]));

  let deeper: ScoredMove[];
  try {
    deeper = scoreRootMoves(fen, candidates.map((c) => byUci.get(c.uci)!), deepen.depth, style, {
      deadline,
      marginCp: DEEPEN_MARGIN_CP,
    });
  } catch (err) {
    if (err instanceof SearchTimeout) return firstPass;
    throw err;
  }
  const deeperByUci = new Map(deeper.map((m) => [m.uci, m]));
  return firstPass.map((m) => deeperByUci.get(m.uci) ?? m);
}

export class HeuristicFallbackEngine {
  /**
   * Search for the best move using heuristic evaluation and human blunder profiling.
   */
  public static search(
    fen: string,
    elo: HumanElo = 1500,
    style: EngineStyle = 'balanced'
  ): {
    bestMoveSan: string;
    bestMoveUci: string;
    candidateMoves: MoveCandidate[];
    centipawns: number;
  } {
    const startedAt = now();
    const chess = new Chess(fen);
    // Verbose moves only here at the root, where the capture flag and the squares are needed
    const legalMoves = chess.moves({ verbose: true });

    if (legalMoves.length === 0) {
      return {
        bestMoveSan: '',
        bestMoveUci: '',
        candidateMoves: [],
        centipawns: chess.inCheck() ? -20000 : 0,
      };
    }

    const profile = ELO_PROFILES[elo] || ELO_PROFILES[1500];
    const isWhite = chess.turn() === 'w';

    // Score all legal moves
    let scoredMoves = scoreRootMoves(fen, legalMoves, profile.depth, style);

    if (profile.deepen) {
      const deadline = startedAt + profile.deepen.moveBudgetMs;
      scoredMoves = deepenCandidates(fen, legalMoves, scoredMoves, profile.deepen, style, deadline);
    }

    // Sort descending by score
    scoredMoves.sort((a, b) => b.score - a.score);

    // Apply human blunder profiling:
    // With probability `blunderProbability`, amateur players may pick a move below the top tier
    const shouldBlunder = Math.random() < profile.blunderProbability && scoredMoves.length > 2;

    // Convert scores to probabilities via Softmax with temperature
    // Scale scores down to avoid exponent overflow
    const bestScore = scoredMoves[0].score;
    const temp = profile.temperature * 100; // in centipawns scale

    let expSum = 0;
    const expScores = scoredMoves.map((m) => {
      // Softmax over (score - bestScore) / temp
      const exp = Math.exp((m.score - bestScore) / temp);
      expSum += exp;
      return exp;
    });

    const candidateMoves: MoveCandidate[] = scoredMoves.map((m, idx) => ({
      san: m.san,
      uci: m.uci,
      probability: Math.round((expScores[idx] / expSum) * 1000) / 1000,
    }));

    // Pick move
    let pickedIndex = 0;
    if (shouldBlunder) {
      // Pick a move from the middle or lower tier (simulating an amateur blunder)
      pickedIndex = Math.min(
        Math.floor(1 + Math.random() * (scoredMoves.length - 1)),
        scoredMoves.length - 1
      );
    } else {
      // Sample according to softmax probabilities
      const rand = Math.random();
      let cum = 0;
      for (let i = 0; i < candidateMoves.length; i++) {
        cum += candidateMoves[i].probability;
        if (rand <= cum) {
          pickedIndex = i;
          break;
        }
      }
    }

    const selected = scoredMoves[pickedIndex] || scoredMoves[0];

    return {
      bestMoveSan: selected.san,
      bestMoveUci: selected.uci,
      candidateMoves: candidateMoves.slice(0, 5),
      centipawns: isWhite ? scoredMoves[0].score : -scoredMoves[0].score,
    };
  }
}
