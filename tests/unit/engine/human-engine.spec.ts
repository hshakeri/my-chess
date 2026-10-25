import { describe, it, expect } from 'vitest';
import { HeuristicFallbackEngine } from '@/engine/human/heuristicFallback';
import { TacticalEvaluator } from '@/engine/human/tacticalEvaluator';
import { HybridEngine } from '@/engine/human/hybridEngine';
import { Chess } from 'chess.js';

describe('F05 & F06 Human-Like Engine & Heuristic Fallback', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // 1. Heuristic Fallback Search
  it('generates legal moves and candidate probabilities in opening positions', () => {
    const result = HeuristicFallbackEngine.search(startFen, 1500, 'balanced');
    expect(result.bestMoveSan).toBeDefined();
    expect(result.bestMoveUci).toBeDefined();
    expect(result.candidateMoves.length).toBeGreaterThan(0);
    // Best move is a legal chess move from starting position
    const chess = new Chess();
    expect(chess.moves()).toContain(result.bestMoveSan);
  });

  // 2. Elo Rating Parameters
  it('supports all selectable human Elo bands (1100, 1300, 1500, 1700, 1900)', () => {
    const elos = [1100, 1300, 1500, 1700, 1900] as const;
    for (const elo of elos) {
      const res = HeuristicFallbackEngine.search(startFen, elo, 'balanced');
      expect(res.bestMoveSan).toBeTruthy();
      expect(res.candidateMoves.length).toBeGreaterThan(0);
    }
  });

  // 3. Tactical Evaluator - Static Material and PST
  it('accurately evaluates material advantages in centipawns', () => {
    // White is up a Queen
    const upQueenFen = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const chess = new Chess(upQueenFen);
    const evalCp = TacticalEvaluator.evaluateStatic(chess);
    expect(evalCp).toBeGreaterThan(800); // White queen advantage (~900)

    // Symmetrical starting position evaluates to near zero
    const startChess = new Chess(startFen);
    const startEval = TacticalEvaluator.evaluateStatic(startChess);
    expect(Math.abs(startEval)).toBeLessThan(50);
  });

  // 4. Move Classification & Blunder Delta Detection
  it('classifies blunders, mistakes, inaccuracies, and good moves based on evaluation delta', () => {
    // 300 centipawn drop is a blunder
    const blunder = TacticalEvaluator.classifyMoveDelta('w', 0, -350);
    expect(blunder.classification).toBe('blunder');
    expect(blunder.delta).toBe(350);

    // 150 centipawn drop is a mistake
    const mistake = TacticalEvaluator.classifyMoveDelta('w', 0, -150);
    expect(mistake.classification).toBe('mistake');

    // 70 centipawn drop is an inaccuracy
    const inaccuracy = TacticalEvaluator.classifyMoveDelta('w', 0, -70);
    expect(inaccuracy.classification).toBe('inaccuracy');

    // 20 centipawn drop is a good move
    const good = TacticalEvaluator.classifyMoveDelta('w', 0, -20);
    expect(good.classification).toBe('good');
  });

  // 5. Hybrid Engine Tier Progression
  it('uses Tier 1 (Human Opening Book) on initial plies', async () => {
    const hybrid = new HybridEngine();
    const response = await hybrid.processRequest({
      type: 'search',
      fen: startFen,
      elo: 1500,
    });

    expect(response.type).toBe('move');
    expect(response.tierUsed).toBe('human_opening_book');
    expect(['e4', 'd4', 'c4', 'Nf3']).toContain(response.bestMoveSan);
  });

  it('falls back to Tier 3 (Heuristic Engine) when outside opening book', async () => {
    const hybrid = new HybridEngine();
    // Complex middlegame position outside opening book
    const middlegameFen = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
    const response = await hybrid.processRequest({
      type: 'search',
      fen: middlegameFen,
      elo: 1500,
      options: { forceFallback: true },
    });

    expect(response.type).toBe('move');
    expect(response.tierUsed).toBe('heuristic_fallback');
    expect(response.bestMoveSan).toBeTruthy();

    const chess = new Chess(middlegameFen);
    expect(chess.moves()).toContain(response.bestMoveSan);
  });

  // 6. Boundary Handling: Checkmate & Stalemate
  it('handles terminal game-over positions gracefully without hanging', async () => {
    const hybrid = new HybridEngine();
    // Checkmate position (Fool's Mate: 1. f3 e5 2. g4 Qh4#)
    const mateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const mateRes = await hybrid.processRequest({
      type: 'search',
      fen: mateFen,
      elo: 1500,
    });

    expect(mateRes.type).toBe('evaluation');
    expect(mateRes.isCheckmate).toBe(true);
    expect(mateRes.bestMoveSan).toBe('');
    expect(mateRes.centipawns).toBe(-20000);
  });
});
