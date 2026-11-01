import { Chess, Square } from 'chess.js';

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

/** Score of a checkmate in centipawns; the search adds the remaining depth so faster mates score higher. */
export const MATE_SCORE = 20000;
/** Any evaluation this large is a forced mate: material and square tables never reach it. */
const MATE_THRESHOLD = 19000;
/** Evaluations are clamped to this many centipawns before a delta is taken, so a mate is not "Blunder (20285cp)". */
export const EVAL_CLAMP = 1000;

export type MoveClassification =
  | 'fine'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_mate'
  | 'allowed_mate';

export interface TacticalEvaluation {
  centipawns: number; // Positive = White advantage, negative = Black advantage
  isCheckmate: boolean;
  mateIn?: number;
  blunderDelta?: number;
  classification?: MoveClassification;
  annotation?: string;
}

/** Thrown by `search` when its deadline passes; the Chess object is left as it was before the call. */
export class SearchTimeout extends Error {
  constructor() {
    super('Search time budget exhausted');
    this.name = 'SearchTimeout';
  }
}

/** Draws by rule that need no move generation: fifty moves, insufficient material, threefold repetition. */
function isRuleDraw(chess: Chess): boolean {
  return chess.isDrawByFiftyMoves() || chess.isInsufficientMaterial() || chess.isThreefoldRepetition();
}

/** Value of the piece a SAN move captures (en passant takes a pawn); 0 for a move that captures nothing. */
function victimValue(chess: Chess, san: string): number {
  if (!san.includes('x')) return 0;
  const squares = san.match(/[a-h][1-8]/g);
  const target = squares ? squares[squares.length - 1] : null;
  const victim = target ? chess.get(target as Square) : undefined;
  return victim ? PIECE_VALUES[victim.type] : PIECE_VALUES.p;
}

/** Most valuable victim first; moves that capture nothing keep their generation order at the end. */
function orderByVictim(chess: Chess, sans: string[]): string[] {
  return sans
    .map((san) => ({ san, value: victimValue(chess, san) }))
    .sort((a, b) => b.value - a.value)
    .map((m) => m.san);
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class TacticalEvaluator {
  /**
   * Evaluate a position statically in centipawns (from White's perspective).
   */
  public static evaluateStatic(chess: Chess): number {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -MATE_SCORE : MATE_SCORE;
    }
    if (chess.isDraw()) {
      return 0;
    }
    return this.material(chess);
  }

  /**
   * The same value as `evaluateStatic`, for a node whose legal moves are already generated:
   * no legal move is mate or stalemate, so the checks need no second move generation.
   */
  private static staticScore(chess: Chess, legalMoveCount: number): number {
    if (legalMoveCount === 0) {
      if (!chess.inCheck()) return 0;
      return chess.turn() === 'w' ? -MATE_SCORE : MATE_SCORE;
    }
    if (isRuleDraw(chess)) return 0;
    return this.material(chess);
  }

  /** Material plus piece-square tables plus a tempo bonus, from White's perspective. */
  private static material(chess: Chess): number {
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
   *
   * Legal moves are generated once per node as SAN (chess.js builds a full Move object, with two FEN
   * strings, for every verbose move, which cost over 90% of the old search's time). Mate and stalemate
   * follow from an empty move list. A finite `deadline` (performance.now() milliseconds) makes the
   * search throw SearchTimeout once it passes; every move made is undone first.
   */
  public static search(
    chess: Chess,
    depth: number,
    alpha: number = -Infinity,
    beta: number = Infinity,
    deadline: number = Infinity
  ): number {
    const moves = chess.moves();
    if (moves.length === 0) {
      if (!chess.inCheck()) return 0;
      return chess.turn() === 'w' ? -MATE_SCORE - depth : MATE_SCORE + depth;
    }
    if (isRuleDraw(chess)) return 0;

    if (depth <= 0) {
      return this.quiescence(chess, alpha, beta, 2, moves);
    }
    if (deadline !== Infinity && now() > deadline) throw new SearchTimeout();

    const isWhite = chess.turn() === 'w';
    // Move ordering: captures first, most valuable victim first
    const ordered = orderByVictim(chess, moves);

    if (isWhite) {
      let maxEval = -Infinity;
      for (const san of ordered) {
        chess.move(san);
        let ev: number;
        try {
          ev = this.search(chess, depth - 1, alpha, beta, deadline);
        } finally {
          chess.undo();
        }
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const san of ordered) {
        chess.move(san);
        let ev: number;
        try {
          ev = this.search(chess, depth - 1, alpha, beta, deadline);
        } finally {
          chess.undo();
        }
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /**
   * Quiescence search to avoid the horizon effect on tactical captures.
   * `legalMoves` is the node's SAN move list when the caller already generated it.
   */
  private static quiescence(
    chess: Chess,
    alpha: number,
    beta: number,
    maxQDepth: number,
    legalMoves?: string[]
  ): number {
    // A leaf needs only the static value, which costs one internal move generation
    if (maxQDepth <= 0) return legalMoves ? this.staticScore(chess, legalMoves.length) : this.evaluateStatic(chess);

    const moves = legalMoves ?? chess.moves();
    const standPat = this.staticScore(chess, moves.length);
    const isWhite = chess.turn() === 'w';

    if (isWhite) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;
    }

    const captures = orderByVictim(chess, moves.filter((san) => san.includes('x')));

    for (const san of captures) {
      chess.move(san);
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

  /** True for an evaluation that is a forced mate (for either side). */
  public static isMateScore(cp: number): boolean {
    return Math.abs(cp) >= MATE_THRESHOLD;
  }

  /**
   * Classify move quality from the evaluations before and after it (both from White's perspective).
   *
   * A move that turns a position the opponent could not mate into one they can is 'allowed_mate';
   * a move that lets a forced mate for the mover slip away is 'missed_mate'. Otherwise both
   * evaluations are clamped to +/-EVAL_CLAMP and the drop is graded. 'fine' means the move lost
   * at most 10 centipawns; no best move is computed, so it is never called "best".
   */
  public static classifyMoveDelta(
    turn: 'w' | 'b',
    evalBefore: number,
    evalAfter: number
  ): {
    delta: number;
    classification: MoveClassification;
    description: string;
  } {
    const sign = turn === 'w' ? 1 : -1;
    const before = sign * evalBefore; // from the mover's perspective
    const after = sign * evalAfter;
    const clamp = (cp: number) => Math.max(-EVAL_CLAMP, Math.min(EVAL_CLAMP, cp));
    const delta = clamp(before) - clamp(after);

    if (after <= -MATE_THRESHOLD && before > -MATE_THRESHOLD) {
      return { delta, classification: 'allowed_mate', description: 'Allowed a forced mate' };
    }
    if (before >= MATE_THRESHOLD && after < MATE_THRESHOLD) {
      return { delta, classification: 'missed_mate', description: 'Missed a forced mate' };
    }
    if (delta <= 10) {
      return { delta, classification: 'fine', description: 'Fine move' };
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
