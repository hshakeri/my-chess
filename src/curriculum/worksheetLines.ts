import { Chess } from 'chess.js';
import { PrintableWorksheetData } from '../types/curriculum';

/**
 * Move-text helpers for the printable worksheets: the sheet shows only the moves that reach its
 * diagram (no annotation glyphs), and the answer page shows the rest.
 */

/** SAN without its move number or annotation glyphs: "9...Nd4!!" -> "Nd4". Check and mate signs stay. */
export function worksheetSan(token: string): string {
  return token.replace(/^\d+\.(\.\.)?/, '').replace(/[!?]+$/, '').trim();
}

/** The worksheet's full line as clean SAN, in order ("1.e4 e5" pairs are split). */
export function worksheetLine(ws: PrintableWorksheetData): string[] {
  return ws.movesSan
    .flatMap((pair) => pair.split(/\s+/))
    .map(worksheetSan)
    .filter((san) => san.length > 0);
}

/** Placement, side to move, castling and en passant: the part of a FEN that identifies the position. */
function positionPart(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** True when two FENs describe the same position (move counters ignored). */
export function samePosition(a: string, b: string): boolean {
  return positionPart(a) === positionPart(b);
}

/**
 * The moves from the start position that reach the sheet diagram, as chess.js prints them, or null
 * when the worksheet's line never passes through the diagram.
 */
export function worksheetSetupMoves(ws: PrintableWorksheetData): string[] | null {
  const chess = new Chess();
  const target = positionPart(ws.diagramFen);
  if (positionPart(chess.fen()) === target) return [];
  for (const san of worksheetLine(ws)) {
    try {
      chess.move(san);
    } catch {
      return null;
    }
    if (positionPart(chess.fen()) === target) return chess.history();
  }
  return null;
}

/** "1.e4 e5 2.Nf3" text for moves played from the start position. */
export function numberedLine(moves: string[]): string {
  return moves.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ');
}

/** The side to move in a FEN. */
export function fenSideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** The solutions as bare SAN: none of these may appear on the sheet before the answer page. */
export function worksheetAnswerTokens(ws: PrintableWorksheetData): string[] {
  return ws.answerKey.map((a) => worksheetSan(a.solutionSan).replace(/[+#]$/, ''));
}
