import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import fixture from './fixtures/search-regression.json';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';
import { TacticalEvaluator, SearchTimeout } from '@/engine/human/tacticalEvaluator';
import {
  HeuristicFallbackEngine,
  ELO_PROFILES,
  DEEPEN_MARGIN_CP,
  scoreRootMoves,
  deepenCandidates,
} from '@/engine/human/heuristicFallback';
import { thinkingDelayMs } from '@/engine/worker/thinkingDelay';
import { HumanElo } from '@/types/engine';

// The middlegame the engine specs use (Italian Game after 6...O-O, White to move)
const SPEC_FEN = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';
const seedGames = seedGamesRaw as Array<{ id: string; movesSan: string[] }>;

describe('TacticalEvaluator: one SAN move generation per node gives the same scores, faster', () => {
  it('the fixture holds 30 distinct positions from hoot65 games, plies 20 to 30', () => {
    expect(fixture.positions).toHaveLength(30);
    expect(new Set(fixture.positions.map((p) => p.fen)).size).toBe(30);
    for (const p of fixture.positions) {
      const game = seedGames.find((g) => g.id === p.gameId);
      expect(game, p.gameId).toBeDefined();
      expect(p.ply).toBeGreaterThanOrEqual(20);
      expect(p.ply).toBeLessThanOrEqual(30);
      const chess = new Chess();
      for (const san of game!.movesSan.slice(0, p.ply)) chess.move(san);
      expect(chess.fen()).toBe(p.fen);
    }
  });

  it('reproduces the scores recorded before the change at depth 1 and 2', { timeout: 60000 }, () => {
    for (const p of fixture.positions) {
      expect(TacticalEvaluator.search(new Chess(p.fen), 1), `depth 1 ${p.fen}`).toBe(p.depth1);
      expect(TacticalEvaluator.search(new Chess(p.fen), 2), `depth 2 ${p.fen}`).toBe(p.depth2);
    }
  });

  it('keeps mate, stalemate, en passant, promotion, check and draw-by-rule scores unchanged', { timeout: 30000 }, () => {
    expect(fixture.edgeCases.map((e) => e.name)).toEqual([
      'en passant available',
      'promotion with and without capture',
      'mate in one (back rank)',
      'stalemate on the board',
      'one queen move stalemates, others mate',
      'side to move in check',
      'insufficient material',
      'mate in one along the b-file',
    ]);
    for (const e of fixture.edgeCases) {
      expect(TacticalEvaluator.search(new Chess(e.fen), 1), `depth 1 ${e.name}`).toBe(e.depth1);
      expect(TacticalEvaluator.search(new Chess(e.fen), 2), `depth 2 ${e.name}`).toBe(e.depth2);
      expect(TacticalEvaluator.evaluateStatic(new Chess(e.fen)), `static ${e.name}`).toBe(e.static);
    }
  });

  it('a search that runs past its deadline throws SearchTimeout and leaves the board as it was', () => {
    const chess = new Chess(SPEC_FEN);
    expect(() => TacticalEvaluator.search(chess, 3, -Infinity, Infinity, performance.now() + 5)).toThrow(SearchTimeout);
    expect(chess.fen()).toBe(SPEC_FEN);
    expect(chess.history()).toHaveLength(0);
  });
});

describe('HeuristicFallbackEngine: every Elo band answers quickly', () => {
  it('no band searches more than two plies for every move; only 1900 looks a third ply deep, within a budget', () => {
    for (const elo of [1100, 1300, 1500, 1700, 1900] as HumanElo[]) {
      expect(ELO_PROFILES[elo].depth, `Elo ${elo}`).toBeLessThanOrEqual(2);
    }
    expect(ELO_PROFILES[1900].deepen).toMatchObject({ depth: 3 });
    expect(ELO_PROFILES[1900].deepen!.moveBudgetMs).toBeLessThanOrEqual(1000);
    for (const elo of [1100, 1300, 1500, 1700] as HumanElo[]) expect(ELO_PROFILES[elo].deepen).toBeUndefined();
  });

  it('answers the spec middlegame with a legal move in under 2 s at every Elo', { timeout: 60000 }, () => {
    const legal = new Chess(SPEC_FEN).moves();
    for (const elo of [1100, 1300, 1500, 1700, 1900] as HumanElo[]) {
      const timed = () => {
        const t = performance.now();
        const res = HeuristicFallbackEngine.search(SPEC_FEN, elo, 'balanced');
        return { ms: performance.now() - t, san: res.bestMoveSan };
      };
      let run = timed();
      // One retry, so a single garbage-collection pause or a busy machine does not fail the test
      if (run.ms >= 2000) run = timed();
      expect(legal, `Elo ${elo}`).toContain(run.san);
      expect(run.ms, `Elo ${elo} took ${Math.round(run.ms)} ms`).toBeLessThan(2000);
    }
  });

  it('1900 re-scores only its candidate moves, exactly where it matters, or keeps the first pass when out of time', { timeout: 60000 }, () => {
    const deepen = ELO_PROFILES[1900].deepen!;
    const legal = new Chess(SPEC_FEN).moves({ verbose: true });
    const first = scoreRootMoves(SPEC_FEN, legal, 2, 'balanced');

    // Out of time, before or during the deeper pass: the complete first pass, never a mix of depths
    expect(deepenCandidates(SPEC_FEN, legal, first, deepen, 'balanced', performance.now() - 1)).toBe(first);
    expect(deepenCandidates(SPEC_FEN, legal, first, deepen, 'balanced', performance.now() + 5)).toBe(first);

    const deep = deepenCandidates(SPEC_FEN, legal, first, deepen, 'balanced', Infinity);
    const best1 = Math.max(...first.map((m) => m.score));
    const candidates = [...first]
      .sort((a, b) => b.score - a.score)
      .filter((m) => m.score >= best1 - deepen.candidateWindowCp)
      .slice(0, deepen.maxCandidates);
    expect(candidates.length).toBeGreaterThan(0);
    const isCandidate = new Set(candidates.map((m) => m.uci));

    const bestDeep = Math.max(...deep.filter((m) => isCandidate.has(m.uci)).map((m) => m.score));
    for (const m of deep) {
      const before = first.find((f) => f.uci === m.uci)!;
      if (!isCandidate.has(m.uci)) {
        expect(m.score, `${m.san} is not a candidate`).toBe(before.score);
        continue;
      }
      // A candidate's deeper score is exact whenever it is within the margin of the best one
      const exact = scoreRootMoves(SPEC_FEN, legal.filter((l) => l.san === m.san), 3, 'balanced')[0].score;
      if (exact > bestDeep - DEEPEN_MARGIN_CP) expect(m.score, m.san).toBe(exact);
      else expect(m.score, `${m.san} bound`).toBeGreaterThanOrEqual(exact);
    }
  });
});

describe('Engine worker: thinking delay', () => {
  it('pauses 250 ms before a played move, not at all before an evaluation, and honours an explicit time up to 3 s', () => {
    expect(thinkingDelayMs({ type: 'search' })).toBe(250);
    expect(thinkingDelayMs({ type: 'evaluate' })).toBe(0);
    expect(thinkingDelayMs({ type: 'evaluate', options: { thinkingTimeMs: 400 } })).toBe(400);
    expect(thinkingDelayMs({ type: 'search', options: { thinkingTimeMs: 0 } })).toBe(0);
    expect(thinkingDelayMs({ type: 'search', options: { thinkingTimeMs: 9000 } })).toBe(3000);
  });
});
