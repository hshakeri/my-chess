import { Chess } from 'chess.js';

// Standard piece values in centipawns
export const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (from White's perspective; inverted for Black)
const PAWN_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
 50, 50, 50, 50, 50, 50, 50, 50,
 10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 25, 25, 10,  5,  5,
  0,  0,  0, 20, 20,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-20,-20, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_PST = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_PST = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20
];

const ROOK_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0
];

const QUEEN_PST = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20
];

const KING_MG_PST = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20
];

export interface TacticalEvaluation {
  centipawns: number; // Positive = White advantage, negative = Black advantage
  isCheckmate: boolean;
  mateIn?: number;
  blunderDelta?: number;
  classification?: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  annotation?: string;
}

export class TacticalEvaluator {
  /**
   * Evaluate a position statically in centipawns (from White's perspective).
   */
  public static evaluateStatic(chess: Chess): number {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -20000 : 20000;
    }
    if (chess.isDraw()) {
      return 0;
    }

    let score = 0;
    const board = chess.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const val = PIECE_VALUES[piece.type] || 0;
        const squareIndex = r * 8 + c;
        let pstVal = 0;

        switch (piece.type) {
          case 'p':
            pstVal = piece.color === 'w' ? PAWN_PST[squareIndex] : PAWN_PST[(7 - r) * 8 + c];
            break;
          case 'n':
            pstVal = piece.color === 'w' ? KNIGHT_PST[squareIndex] : KNIGHT_PST[(7 - r) * 8 + c];
            break;
          case 'b':
            pstVal = piece.color === 'w' ? BISHOP_PST[squareIndex] : BISHOP_PST[(7 - r) * 8 + c];
            break;
          case 'r':
            pstVal = piece.color === 'w' ? ROOK_PST[squareIndex] : ROOK_PST[(7 - r) * 8 + c];
            break;
          case 'q':
            pstVal = piece.color === 'w' ? QUEEN_PST[squareIndex] : QUEEN_PST[(7 - r) * 8 + c];
            break;
          case 'k':
            pstVal = piece.color === 'w' ? KING_MG_PST[squareIndex] : KING_MG_PST[(7 - r) * 8 + c];
            break;
        }

        const pieceTotal = val + pstVal;
        if (piece.color === 'w') {
          score += pieceTotal;
        } else {
          score -= pieceTotal;
        }
      }
    }

    // Small bonus for side to move / tempo
    score += chess.turn() === 'w' ? 10 : -10;

    return score;
  }

  /**
   * Minimax search with alpha-beta pruning and quiescence search.
   */
  public static search(
    chess: Chess,
    depth: number,
    alpha: number = -Infinity,
    beta: number = Infinity
  ): number {
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        return chess.turn() === 'w' ? -20000 - depth : 20000 + depth;
      }
      return 0;
    }

    if (depth <= 0) {
      return this.quiescence(chess, alpha, beta, 2);
    }

    const isWhite = chess.turn() === 'w';
    const moves = chess.moves({ verbose: true });

    // Move ordering: captures first
    moves.sort((a, b) => {
      const aVal = a.captured ? PIECE_VALUES[a.captured] : 0;
      const bVal = b.captured ? PIECE_VALUES[b.captured] : 0;
      return bVal - aVal;
    });

    if (isWhite) {
      let maxEval = -Infinity;
      for (const m of moves) {
        chess.move(m);
        const ev = this.search(chess, depth - 1, alpha, beta);
        chess.undo();
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of moves) {
        chess.move(m);
        const ev = this.search(chess, depth - 1, alpha, beta);
        chess.undo();
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /**
   * Quiescence search to avoid the horizon effect on tactical captures.
   */
  private static quiescence(
    chess: Chess,
    alpha: number,
    beta: number,
    maxQDepth: number
  ): number {
    const standPat = this.evaluateStatic(chess);
    const isWhite = chess.turn() === 'w';

    if (maxQDepth <= 0) return standPat;

    if (isWhite) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;
    }

    const captures = chess.moves({ verbose: true }).filter((m) => m.captured);
    captures.sort((a, b) => (PIECE_VALUES[b.captured!] || 0) - (PIECE_VALUES[a.captured!] || 0));

    for (const cap of captures) {
      chess.move(cap);
      const score = this.quiescence(chess, alpha, beta, maxQDepth - 1);
      chess.undo();

      if (isWhite) {
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      } else {
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
      }
    }

    return isWhite ? alpha : beta;
  }

  /**
   * Classify move quality based on evaluation delta.
   */
  public static classifyMoveDelta(
    turn: 'w' | 'b',
    evalBefore: number,
    evalAfter: number
  ): {
    delta: number;
    classification: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
    description: string;
  } {
    // Delta from moving player's perspective
    const delta = turn === 'w' ? evalBefore - evalAfter : evalAfter - evalBefore;

    if (delta <= 10) {
      return { delta, classification: 'best', description: 'Best move' };
    }
    if (delta <= 50) {
      return { delta, classification: 'good', description: 'Good move' };
    }
    if (delta <= 100) {
      return { delta, classification: 'inaccuracy', description: `Inaccuracy (${Math.round(delta)}cp)` };
    }
    if (delta <= 250) {
      return { delta, classification: 'mistake', description: `Mistake (${Math.round(delta)}cp)` };
    }
    return { delta, classification: 'blunder', description: `Blunder (${Math.round(delta)}cp)` };
  }
}
