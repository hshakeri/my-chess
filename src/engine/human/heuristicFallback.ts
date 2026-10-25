import { Chess } from 'chess.js';
import { HumanElo, EngineStyle, MoveCandidate } from '../../types/engine';
import { TacticalEvaluator } from './tacticalEvaluator';

interface EloProfile {
  depth: number;
  temperature: number;
  blunderProbability: number;
  tacticalOversightRate: number;
}

const ELO_PROFILES: Record<HumanElo, EloProfile> = {
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
    depth: 3,
    temperature: 0.45,
    blunderProbability: 0.02,
    tacticalOversightRate: 0.03,
  },
  1900: {
    depth: 4,
    temperature: 0.20,
    blunderProbability: 0.008,
    tacticalOversightRate: 0.01,
  },
};

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
    const chess = new Chess(fen);
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
    const scoredMoves: Array<{
      san: string;
      uci: string;
      score: number;
      isCapture: boolean;
      isCheck: boolean;
    }> = [];

    for (const move of legalMoves) {
      chess.move(move);
      let evalScore = TacticalEvaluator.search(
        chess,
        profile.depth - 1,
        -Infinity,
        Infinity
      );

      // Score from moving side's perspective
      let sideScore = isWhite ? evalScore : -evalScore;

      // Adjust for style
      if (style === 'aggressive') {
        if (move.captured) sideScore += 30;
        if (chess.inCheck()) sideScore += 25;
      } else if (style === 'solid') {
        // Favor king safety and quiet development
        if (!move.captured && !chess.inCheck()) sideScore += 15;
      }

      chess.undo();

      scoredMoves.push({
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion || ''}`,
        score: sideScore,
        isCapture: !!move.captured,
        isCheck: false,
      });
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
