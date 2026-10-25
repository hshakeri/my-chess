import openingBookData from '../../data/openingBook.json';
import { MoveCandidate } from '../../types/engine';

export class HumanOpeningBook {
  private static book: Record<string, MoveCandidate[]> = openingBookData as any;

  /**
   * Normalize FEN string for robust opening book matching:
   * Keeps piece placement, turn, castling rights, and en passant square.
   * Discards halfmove clock and fullmove number for broader matching.
   */
  public static normalizeFen(fen: string): string {
    const parts = fen.trim().split(/\s+/);
    if (parts.length >= 4) {
      return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
    }
    return fen.trim();
  }

  /**
   * Look up candidate moves for a given position in the human opening book.
   */
  public static lookup(fen: string): MoveCandidate[] | null {
    // Try exact FEN match first
    if (this.book[fen] && this.book[fen].length > 0) {
      return this.book[fen];
    }

    // Try normalized match (ignoring move count and 50-move clock)
    const normTarget = this.normalizeFen(fen);
    for (const [bookFen, moves] of Object.entries(this.book)) {
      if (this.normalizeFen(bookFen) === normTarget && moves.length > 0) {
        return moves;
      }
    }

    return null;
  }

  /**
   * Select a move from the opening book weighted by human play frequency.
   */
  public static selectMove(fen: string): {
    bestMoveSan: string;
    bestMoveUci: string;
    candidateMoves: MoveCandidate[];
  } | null {
    const candidates = this.lookup(fen);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    // Weighted random selection
    const rand = Math.random();
    let cumulative = 0;
    let selected = candidates[0];

    for (const candidate of candidates) {
      cumulative += candidate.probability;
      if (rand <= cumulative) {
        selected = candidate;
        break;
      }
    }

    return {
      bestMoveSan: selected.san,
      bestMoveUci: selected.uci,
      candidateMoves: candidates,
    };
  }
}
