import { Chess } from 'chess.js';

/**
 * Canonical position key for the card store (CL-1).
 *
 * The key is the first four FEN fields (piece placement, side to move, castling
 * rights, en-passant square) so that transpositions reached by different move
 * orders share one card. The en-passant field is normalised to `-` unless an
 * en-passant capture is actually legal in the position, because FEN writers
 * disagree on whether to print the square after every double pawn push.
 *
 * Throws when chess.js cannot load the FEN, so an illegal position never
 * becomes a card id.
 */
export function canonicalFenKey(fen: string): string {
  if (typeof fen !== 'string') {
    throw new Error('canonicalFenKey: FEN must be a string');
  }
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 4) {
    throw new Error(`canonicalFenKey: FEN needs at least four fields, got "${fen}"`);
  }
  const [placement, turn, castling, ep] = fields;
  const halfmove = fields[4] ?? '0';
  const fullmove = fields[5] ?? '1';

  // chess.js validates the placement, the side to move and the castling field
  // and throws a descriptive error on illegal input.
  const chess = new Chess(`${placement} ${turn} ${castling} ${ep} ${halfmove} ${fullmove}`);

  let epField = '-';
  if (ep !== '-') {
    const canCapture = chess.moves({ verbose: true }).some((m) => m.isEnPassant());
    if (canCapture) epField = ep;
  }

  return `${placement} ${turn} ${castling} ${epField}`;
}
