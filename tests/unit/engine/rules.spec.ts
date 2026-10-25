import { describe, it, expect, beforeEach } from 'vitest';
import { RulesEngine } from '@/engine/rules';

describe('F02 Legal Chess Rules Engine', () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = new RulesEngine();
  });

  // 1. Initial State & Basic Moves
  it('initializes with standard start position and White to move', () => {
    const pos = engine.getPosition();
    expect(pos.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(pos.turn).toBe('w');
    expect(pos.isCheck).toBe(false);
    expect(pos.isCheckmate).toBe(false);
    expect(pos.isStalemate).toBe(false);
    expect(pos.isDraw).toBe(false);
    expect(pos.legalMovesSan.length).toBe(20); // 16 pawn + 4 knight moves
  });

  // 2. Standard Piece Moves & Board Verification
  it('executes legal standard piece moves (pawns, knights, bishops, rooks, queens, kings)', () => {
    const move1 = engine.makeMove('e4');
    expect(move1.success).toBe(true);
    expect(move1.moveRecord?.san).toBe('e4');
    expect(move1.moveRecord?.ply).toBe(1);
    expect(engine.getTurn()).toBe('b');

    const move2 = engine.makeMove('e5');
    expect(move2.success).toBe(true);
    expect(move2.moveRecord?.ply).toBe(2);

    const move3 = engine.makeMove('Nf3');
    expect(move3.success).toBe(true);
    expect(move3.moveRecord?.san).toBe('Nf3');

    const move4 = engine.makeMove('Nc6');
    expect(move4.success).toBe(true);

    const move5 = engine.makeMove('Bc4'); // Bishop move
    expect(move5.success).toBe(true);

    const move6 = engine.makeMove('Bc5');
    expect(move6.success).toBe(true);

    expect(engine.getHistory().length).toBe(6);
  });

  // 3. Castling Rules (Kingside & Queenside, Restrictions)
  it('enforces castling rules and prevents castling through check or when pieces obstruct', () => {
    // Italian game position leading to kingside castling
    engine.makeMove('e4');
    engine.makeMove('e5');
    engine.makeMove('Nf3');
    engine.makeMove('Nc6');
    engine.makeMove('Bc4');
    engine.makeMove('Bc5');

    // White can castle kingside (O-O)
    const castleMove = engine.makeMove('O-O');
    expect(castleMove.success).toBe(true);
    expect(castleMove.moveRecord?.san).toBe('O-O');
    expect(engine.getFen()).toContain('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq -');

    // Test: Castling illegal when pieces obstruct
    const freshEngine = new RulesEngine();
    freshEngine.makeMove('e4');
    freshEngine.makeMove('e5');
    const prematureCastle = freshEngine.makeMove('O-O');
    expect(prematureCastle.success).toBe(false);

    // Test: Castling legal when open and not attacked
    const checkCastleEngine = new RulesEngine('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(checkCastleEngine.makeMove('O-O').success).toBe(true);
    // Load position where f1 is attacked by Black rook
    const attackedF1Engine = new RulesEngine('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');
    const castleThroughCheck = attackedF1Engine.makeMove('O-O');
    expect(castleThroughCheck.success).toBe(false);
  });

  // 4. En Passant Pawn Capture
  it('enforces en passant capture strictly on the immediate next ply', () => {
    // 1. e4 a6 2. e5 d5 -> White can capture exd6 e.p.
    engine.makeMove('e4');
    engine.makeMove('a6');
    engine.makeMove('e5');
    engine.makeMove('d5');

    // Immediate en passant capture is legal
    expect(engine.getPosition().legalMovesSan).toContain('exd6');
    const epMove = engine.makeMove('exd6');
    expect(epMove.success).toBe(true);
    expect(epMove.moveRecord?.san).toBe('exd6');
    expect(engine.getFen()).toContain('p2P4'); // White pawn on d6

    // Test that en passant expires if an intermediate move is played
    const epExpiryEngine = new RulesEngine();
    epExpiryEngine.makeMove('e4');
    epExpiryEngine.makeMove('a6');
    epExpiryEngine.makeMove('e5');
    epExpiryEngine.makeMove('d5');
    // White plays h3 instead of exd6
    epExpiryEngine.makeMove('h3');
    epExpiryEngine.makeMove('h6');
    // Now exd6 is no longer legal
    expect(epExpiryEngine.getPosition().legalMovesSan).not.toContain('exd6');
    const expiredEp = epExpiryEngine.makeMove('exd6');
    expect(expiredEp.success).toBe(false);
  });

  // 5. Pawn Promotion (Queen, Rook, Bishop, Knight)
  it('handles pawn promotion with multiple piece options and FEN update', () => {
    // White pawn on a7, Black king on h8
    const promoEngine = new RulesEngine('8/P7/8/8/8/8/8/4K2k w - - 0 1');
    const legalMoves = promoEngine.getPosition().legalMovesSan;
    expect(legalMoves).toContain('a8=Q+');
    expect(legalMoves).toContain('a8=R');
    expect(legalMoves).toContain('a8=B+');
    expect(legalMoves).toContain('a8=N');

    const promoResult = promoEngine.makeMove({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(promoResult.success).toBe(true);
    expect(promoResult.moveRecord?.san).toBe('a8=Q+');
    expect(promoEngine.getFen()).toContain('Q7/');
  });

  // 6. Check and Checkmate Detection
  it('accurately identifies check and checkmate terminal states', () => {
    // Scholar's Mate: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    engine.makeMove('e4');
    engine.makeMove('e5');
    engine.makeMove('Qh5');
    engine.makeMove('Nc6');
    engine.makeMove('Bc4');
    engine.makeMove('Nf6');

    expect(engine.getPosition().isCheck).toBe(false);
    const mateMove = engine.makeMove('Qxf7#');
    expect(mateMove.success).toBe(true);

    const pos = engine.getPosition();
    expect(pos.isCheck).toBe(true);
    expect(pos.isCheckmate).toBe(true);
    expect(pos.isDraw).toBe(false);
    expect(pos.legalMovesSan.length).toBe(0);

    const status = engine.getGameOverStatus();
    expect(status.isOver).toBe(true);
    expect(status.result).toBe('1-0');
    expect(status.reason).toContain('Checkmate — White wins');
  });

  // 7. Stalemate Detection
  it('detects stalemate draw when king has no legal moves and is not in check', () => {
    // Classical stalemate position: Black king on a8, White queen on c7, White king on c6
    const stalemateEngine = new RulesEngine('k7/2Q5/2K5/8/8/8/8/8 b - - 0 1');
    const pos = stalemateEngine.getPosition();
    expect(pos.isCheck).toBe(false);
    expect(pos.isCheckmate).toBe(false);
    expect(pos.isStalemate).toBe(true);
    expect(pos.isDraw).toBe(true);
    expect(pos.drawReason).toBe('stalemate');

    const status = stalemateEngine.getGameOverStatus();
    expect(status.isOver).toBe(true);
    expect(status.result).toBe('1/2-1/2');
    expect(status.reason).toContain('Draw by stalemate');
  });

  // 8. Draw by Insufficient Material
  it('identifies draw by insufficient material for K vs K, K+N vs K, and K+B vs K', () => {
    // King vs King
    const kvk = new RulesEngine('8/8/8/4k3/8/8/4K3/8 w - - 0 1');
    expect(kvk.getPosition().isDraw).toBe(true);
    expect(kvk.getPosition().drawReason).toBe('insufficient_material');

    // King + Knight vs King
    const kvkn = new RulesEngine('8/8/8/4k3/8/5N2/4K3/8 w - - 0 1');
    expect(kvkn.getPosition().isDraw).toBe(true);
    expect(kvkn.getPosition().drawReason).toBe('insufficient_material');

    // King + Bishop vs King
    const kvkb = new RulesEngine('8/8/8/4k3/8/5B2/4K3/8 w - - 0 1');
    expect(kvkb.getPosition().isDraw).toBe(true);
    expect(kvkb.getPosition().drawReason).toBe('insufficient_material');
  });

  // 9. Threefold Repetition Draw
  it('detects draw by threefold repetition', () => {
    // Knights bouncing back and forth
    engine.makeMove('Nf3'); // White
    engine.makeMove('Nf6'); // Black
    engine.makeMove('Ng1'); // White
    engine.makeMove('Ng8'); // Black (position repeated 2nd time)

    engine.makeMove('Nf3'); // White
    engine.makeMove('Nf6'); // Black
    engine.makeMove('Ng1'); // White
    engine.makeMove('Ng8'); // Black (position repeated 3rd time)

    const pos = engine.getPosition();
    expect(pos.isDraw).toBe(true);
    expect(pos.drawReason).toBe('threefold_repetition');
    const status = engine.getGameOverStatus();
    expect(status.isOver).toBe(true);
    expect(status.result).toBe('1/2-1/2');
  });

  // 10. Undo / Takeback functionality
  it('supports move takebacks and restores exact previous state', () => {
    engine.makeMove('e4');
    engine.makeMove('e5');
    expect(engine.getHistory().length).toBe(2);

    const undone1 = engine.undoMove();
    expect(undone1).toBe(true);
    expect(engine.getHistory().length).toBe(1);
    expect(engine.getTurn()).toBe('b');

    const undone2 = engine.undoMove();
    expect(undone2).toBe(true);
    expect(engine.getHistory().length).toBe(0);
    expect(engine.getTurn()).toBe('w');

    // Attempting to undo when no moves exist returns false
    const undoneEmpty = engine.undoMove();
    expect(undoneEmpty).toBe(false);
  });
});
