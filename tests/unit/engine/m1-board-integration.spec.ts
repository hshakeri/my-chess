import { describe, it, expect } from 'vitest';
import { RulesEngine } from '../../../src/engine/rules';
import { HybridEngine } from '../../../src/engine/human/hybridEngine';
import { HumanElo } from '../../../src/types/engine';
import { Square } from '../../../src/types/chess';

describe('Milestone 1: 2D Board, Navigation & Engine Controls Integration', () => {
  it('correctly maps 8x8 board squares and piece positions from starting position', () => {
    const engine = new RulesEngine();
    const board = engine.getBoard();

    expect(board).toHaveLength(8);
    board.forEach((row) => expect(row).toHaveLength(8));

    // Verify row 0 (rank 8 - Black pieces)
    expect(board[0][0]?.square).toBe('a8');
    expect(board[0][0]?.type).toBe('r');
    expect(board[0][0]?.color).toBe('b');

    expect(board[0][4]?.square).toBe('e8');
    expect(board[0][4]?.type).toBe('k');
    expect(board[0][4]?.color).toBe('b');

    // Verify row 7 (rank 1 - White pieces)
    expect(board[7][0]?.square).toBe('a1');
    expect(board[7][0]?.type).toBe('r');
    expect(board[7][0]?.color).toBe('w');

    expect(board[7][4]?.square).toBe('e1');
    expect(board[7][4]?.type).toBe('k');
    expect(board[7][4]?.color).toBe('w');

    // Verify row 6 (rank 2 - White pawns)
    for (let c = 0; c < 8; c++) {
      expect(board[6][c]?.type).toBe('p');
      expect(board[6][c]?.color).toBe('w');
    }
  });

  it('calculates legal move targets for selected squares', () => {
    const engine = new RulesEngine();

    // e2 pawn has 2 legal targets: e3 and e4
    const e2Moves = engine.getLegalMovesForSquare('e2');
    expect(e2Moves.map((m) => m.to).sort()).toEqual(['e3', 'e4']);

    // b1 knight has 2 legal targets: a3 and c3
    const b1Moves = engine.getLegalMovesForSquare('b1');
    expect(b1Moves.map((m) => m.to).sort()).toEqual(['a3', 'c3']);

    // e1 king has 0 legal moves initially because it is blocked
    const e1Moves = engine.getLegalMovesForSquare('e1');
    expect(e1Moves).toHaveLength(0);
  });

  it('detects pawn promotion requirements when moving to final rank', () => {
    // Position where White pawn on e7 is about to promote
    const engine = new RulesEngine('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
    const e7Moves = engine.getLegalMovesForSquare('e7');

    expect(e7Moves.length).toBeGreaterThan(0);
    // All moves from e7 to e8 must carry promotion
    e7Moves.forEach((m) => {
      expect(m.to).toBe('e8');
      expect(['q', 'r', 'b', 'n']).toContain(m.promotion);
    });

    // Executing promotion to Queen
    const promoMove = engine.makeMove({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(promoMove.success).toBe(true);
    expect(engine.getFen()).toContain('4Q3');
  });

  it('detects check state and king in check', () => {
    // Scholar's Mate checkmate position
    const engine = new RulesEngine('r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
    const pos = engine.getPosition();

    expect(pos.isCheck).toBe(true);
    expect(pos.isCheckmate).toBe(true);
    expect(pos.turn).toBe('b');

    // Find black king square
    const board = engine.getBoard();
    let blackKingSquare: Square | null = null;
    for (const row of board) {
      for (const piece of row) {
        if (piece && piece.type === 'k' && piece.color === 'b') {
          blackKingSquare = piece.square;
        }
      }
    }
    expect(blackKingSquare).toBe('e8');
  });

  it('supports move list navigation and historical FEN reconstruction', () => {
    const engine = new RulesEngine();
    engine.makeMove('e4');
    engine.makeMove('e5');
    engine.makeMove('Nf3');
    engine.makeMove('Nc6');

    const history = engine.getHistory();
    expect(history).toHaveLength(4);

    // Verify ply 1 FEN (after 1. e4)
    expect(history[0].san).toBe('e4');
    expect(history[0].fenAfter).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq');

    // Verify ply 2 FEN (after 1... e5)
    expect(history[1].san).toBe('e5');
    expect(history[1].fenAfter).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq');

    // Verify historical review with temp engine
    const ply2Engine = new RulesEngine(history[1].fenAfter);
    expect(ply2Engine.getTurn()).toBe('w');
    expect(ply2Engine.getPosition().legalMovesSan).toContain('Nf3');
  });

  it('supports takeback / move undo cleanly', () => {
    const engine = new RulesEngine();
    engine.makeMove('e4');
    engine.makeMove('d5');
    expect(engine.getHistory()).toHaveLength(2);

    const undone = engine.undoMove();
    expect(undone).toBe(true);
    expect(engine.getHistory()).toHaveLength(1);
    expect(engine.getTurn()).toBe('b');

    const undone2 = engine.undoMove();
    expect(undone2).toBe(true);
    expect(engine.getHistory()).toHaveLength(0);
    expect(engine.getTurn()).toBe('w');
  });

  it('supports custom FEN loading and rejects invalid FENs', () => {
    const engine = new RulesEngine();

    // Valid Scandinavian setup
    const valid = engine.loadFen('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(valid.success).toBe(true);
    expect(engine.getTurn()).toBe('w');

    // Invalid FEN
    const invalid = engine.loadFen('invalid-fen-string-not-chess');
    expect(invalid.success).toBe(false);
    expect(invalid.error).toBeDefined();
  });

  it('supports all human Elo tiers for engine play', async () => {
    const hybrid = new HybridEngine();
    const testElos: HumanElo[] = [1100, 1300, 1500, 1700, 1900];

    for (const elo of testElos) {
      const res = await hybrid.processRequest({
        type: 'search',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        elo,
      });

      expect(res.bestMoveSan).toBeDefined();
      expect(res.bestMoveUci).toBeDefined();
      expect(res.tierUsed).toBeDefined();
    }
  });
});
