import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  DiagnosticAnalyzer,
  analyzeGames,
  CANONICAL_HOOT65_GAMES,
} from '../../../src/analytics/diagnostics';
import { StoredGame } from '../../../src/types/db';

describe('DiagnosticAnalyzer & Game Diagnostics Engine', () => {
  it('conforms strictly to the PROJECT.md § 4 DiagnosticReport interface contract', () => {
    const report = analyzeGames([], 'hoot65');

    // Root schema assertions
    expect(report.playerHandle).toBe('hoot65');
    expect(typeof report.totalGamesAnalyzed).toBe('number');
    expect(report.totalGamesAnalyzed).toBeGreaterThan(0);

    // White stats schema
    expect(typeof report.whiteStats.winRate).toBe('number');
    expect(report.whiteStats.winRate).toBeGreaterThanOrEqual(0);
    expect(report.whiteStats.winRate).toBeLessThanOrEqual(1);
    expect(Array.isArray(report.whiteStats.keyLeaks)).toBe(true);

    // Black stats schema
    expect(typeof report.blackStats.winRate).toBe('number');
    expect(report.blackStats.winRate).toBeGreaterThanOrEqual(0);
    expect(report.blackStats.winRate).toBeLessThanOrEqual(1);
    expect(Array.isArray(report.blackStats.keyLeaks)).toBe(true);

    // Repertoire recommendations
    expect(report.recommendedWhiteRepertoire).toContain('Italian Game');
    expect(report.recommendedWhiteRepertoire).toContain('Anti-Scandinavian');
    expect(report.recommendedBlackRepertoire).toContain('Caro-Kann');
    expect(report.recommendedBlackRepertoire).toContain("King's Indian");
  });

  it('analyzes White and Black games separately with accurate partition counts', () => {
    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');

    expect(report.whiteStats.totalGames).toBeDefined();
    expect(report.blackStats.totalGames).toBeDefined();
    expect(report.whiteStats.totalGames! + report.blackStats.totalGames!).toBe(
      CANONICAL_HOOT65_GAMES.length
    );
    expect(report.whiteStats.totalGames).toBeGreaterThan(0);
    expect(report.blackStats.totalGames).toBeGreaterThan(0);
  });

  it('detects and cites real hoot65 White Scandinavian 2.e5?! leaks with exact game IDs and plies', () => {
    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    const whiteLeaks = report.whiteStats.keyLeaks;

    expect(whiteLeaks.length).toBeGreaterThanOrEqual(4);

    const citedGameIds = whiteLeaks.map(l => l.gameId);
    expect(citedGameIds).toContain('185031553576');
    expect(citedGameIds).toContain('185035281692');
    expect(citedGameIds).toContain('184582182704');
    expect(citedGameIds).toContain('171000270176');

    // Verify properties of the cited Scandinavian leak
    const scandiLeak = whiteLeaks.find(l => l.gameId === '185031553576');
    expect(scandiLeak).toBeDefined();
    expect(scandiLeak?.ply).toBe(3);
    expect(scandiLeak?.playedSan).toBe('e5');
    expect(scandiLeak?.bookSan).toBe('exd5');
    expect(scandiLeak?.playedColor).toBe('white');
    expect(scandiLeak?.fen).toBe(
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    );
    expect(scandiLeak?.gameUrl).toContain('185031553576');
    expect(scandiLeak?.description).toContain('Scandinavian');
    expect(scandiLeak?.description).toContain('2.exd5!');
    expect(scandiLeak?.evaluationDelta).toBe('-0.80');
  });

  it('detects and cites real hoot65 Black premature ...Bg4 leaks with exact game IDs and plies', () => {
    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    const blackLeaks = report.blackStats.keyLeaks;

    expect(blackLeaks.length).toBeGreaterThanOrEqual(4);

    const citedGameIds = blackLeaks.map(l => l.gameId);
    expect(citedGameIds).toContain('185282462950');
    expect(citedGameIds).toContain('173676860416');
    expect(citedGameIds).toContain('171894388406');
    expect(citedGameIds).toContain('184720164178');

    // Inspect game 173676860416 (Caro-Kann Advance where hoot65 played ply 6 ...Bg4)
    const ckAdvanceLeak = blackLeaks.find(l => l.gameId === '173676860416');
    expect(ckAdvanceLeak).toBeDefined();
    expect(ckAdvanceLeak?.ply).toBe(6);
    expect(ckAdvanceLeak?.playedSan).toBe('Bg4');
    expect(ckAdvanceLeak?.bookSan).toBe('Bf5');
    expect(ckAdvanceLeak?.playedColor).toBe('black');
    expect(ckAdvanceLeak?.description).toContain('Bg4');
    expect(ckAdvanceLeak?.description).toContain('3...Bf5!');

    // Inspect game 184720164178 (Pirc Czech where hoot65 played ply 8 ...Bg4)
    const pircLeak = blackLeaks.find(l => l.gameId === '184720164178');
    expect(pircLeak).toBeDefined();
    expect(pircLeak?.ply).toBe(8);
    expect(pircLeak?.playedSan).toBe('Bg4');
    expect(pircLeak?.playedColor).toBe('black');
    expect(pircLeak?.description).toContain('Pirc');
  });

  it('calculates win rates by opening and color without division by zero or NaN', () => {
    // Test with clean empty set
    const emptyReport = DiagnosticAnalyzer.analyze([], 'hoot65');
    expect(Number.isNaN(emptyReport.whiteStats.winRate)).toBe(false);
    expect(Number.isNaN(emptyReport.blackStats.winRate)).toBe(false);

    // Test with synthetic single-game data
    const mockWinGame: StoredGame = {
      id: 'mock-1',
      source: 'upload',
      pgn: '1. e4 e5 1-0',
      white: { name: 'hoot65' },
      black: { name: 'rival' },
      result: '1-0',
      timestamp: Date.now(),
      movesSan: ['e4', 'e5'],
      userColor: 'white',
      userResult: 'win',
    };

    const singleWinReport = DiagnosticAnalyzer.analyze([mockWinGame], 'hoot65');
    expect(singleWinReport.whiteStats.winRate).toBeGreaterThan(0);
    expect(Number.isNaN(singleWinReport.whiteStats.winRate)).toBe(false);
  });

  it('dynamically identifies deviations from arbitrary user-provided games', () => {
    const customScandiGame: StoredGame = {
      id: 'user-scandi-test',
      source: 'upload',
      url: 'https://example.com/test-game',
      pgn: '1. e4 d5 2. e5 c5 0-1',
      white: { name: 'hoot65' },
      black: { name: 'grandmaster' },
      result: '0-1',
      timestamp: Date.now(),
      movesSan: ['e4', 'd5', 'e5', 'c5'],
      userColor: 'white',
      userResult: 'loss',
    };

    const leak = DiagnosticAnalyzer.detectWhiteScandinavianLeak(
      customScandiGame,
      customScandiGame.movesSan
    );
    expect(leak).not.toBeNull();
    expect(leak?.gameId).toBe('user-scandi-test');
    expect(leak?.ply).toBe(3);
    expect(leak?.playedSan).toBe('e5');
    expect(leak?.bookSan).toBe('exd5');
  });

  it('ensures all FEN positions cited in leaks are valid according to the chess rules engine', () => {
    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    const allLeaks = [...report.whiteStats.keyLeaks, ...report.blackStats.keyLeaks];

    for (const leak of allLeaks) {
      expect(leak.fen).toBeDefined();
      expect(leak.fen.length).toBeGreaterThan(10);

      // Verify FEN parses cleanly in Chess engine
      const testChess = new Chess(leak.fen);
      expect(testChess.fen()).toBe(leak.fen);
      expect(['w', 'b']).toContain(testChess.turn());
    }
  });
});
