import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  DiagnosticAnalyzer,
  analyzeGames,
  CANONICAL_HOOT65_GAMES,
} from '../../../src/analytics/diagnostics';
import { StoredGame } from '../../../src/types/db';
import seedGamesRaw from '../../../src/data/seed_hoot65_games.json';

const seedGames = seedGamesRaw as unknown as StoredGame[];

const byId = (id: string): StoredGame => {
  const g = CANONICAL_HOOT65_GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`fixture ${id} missing`);
  return g;
};

/** A minimal uploaded game by hoot65 (as Black unless the first mover is hoot65) for detector edge cases. */
const synthetic = (movesSan: string[], color: 'white' | 'black' = 'black'): StoredGame => ({
  id: `synthetic-${movesSan.join('-')}`,
  source: 'upload',
  pgn: '',
  white: { name: color === 'white' ? 'hoot65' : 'rival' },
  black: { name: color === 'black' ? 'hoot65' : 'rival' },
  result: '1/2-1/2',
  timestamp: 0,
  movesSan,
  userColor: color,
  userResult: 'draw',
});

describe('DiagnosticAnalyzer & Game Diagnostics Engine', () => {
  it('conforms to the PROJECT.md § 4 DiagnosticReport interface contract and injects nothing', () => {
    const report = analyzeGames([], 'hoot65');

    expect(report.playerHandle).toBe('hoot65');
    // The report describes exactly the games it is given: an empty archive is an empty report
    expect(report.totalGamesAnalyzed).toBe(0);
    expect(report.whiteStats.keyLeaks).toEqual([]);
    expect(report.blackStats.keyLeaks).toEqual([]);
    expect(Number.isNaN(report.whiteStats.winRate)).toBe(false);
    expect(Number.isNaN(report.blackStats.winRate)).toBe(false);

    expect(report.recommendedWhiteRepertoire).toContain('Italian Game');
    expect(report.recommendedWhiteRepertoire).toContain('Anti-Scandinavian');
    expect(report.recommendedBlackRepertoire).toContain('Caro-Kann');
    expect(Array.isArray(report.patterns)).toBe(true);
  });

  it('fixture games are real archive games: every id resolves to a seed game and the moves are a prefix of it', () => {
    for (const fixture of CANONICAL_HOOT65_GAMES) {
      const real = seedGames.find((g) => g.url && g.url.endsWith(`/${fixture.id}`));
      expect(real, `fixture ${fixture.id} must exist in the archive`).toBeDefined();
      expect(real!.movesSan.slice(0, fixture.movesSan.length)).toEqual(fixture.movesSan);
      expect(real!.white.name).toBe(fixture.white.name);
      expect(real!.black.name).toBe(fixture.black.name);
      expect(real!.result).toBe(fixture.result);
      const date = fixture.pgn.match(/\[Date "([^"]+)"\]/)?.[1];
      expect(real!.pgn).toContain(`[Date "${date}"]`);
    }
  });

  it('analyzes White and Black games separately with accurate partition counts', () => {
    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    expect(report.whiteStats.totalGames! + report.blackStats.totalGames!).toBe(CANONICAL_HOOT65_GAMES.length);
    expect(report.totalGamesAnalyzed).toBe(CANONICAL_HOOT65_GAMES.length);
    expect(report.whiteStats.totalGames).toBe(5);
    expect(report.blackStats.totalGames).toBe(6);
  });

  it('detects and cites real hoot65 White Scandinavian 2.e5?! games with exact game IDs and plies', () => {
    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    const whiteLeaks = report.whiteStats.keyLeaks;

    const scandiIds = whiteLeaks.filter((l) => l.patternId === 'white-scandi-e5').map((l) => l.gameId);
    expect(scandiIds).toEqual(
      expect.arrayContaining(['185031553576', '185035281692', '184582182704', '171000270176'])
    );

    const scandiLeak = whiteLeaks.find((l) => l.gameId === '185031553576');
    expect(scandiLeak).toBeDefined();
    expect(scandiLeak?.ply).toBe(3);
    expect(scandiLeak?.playedSan).toBe('e5');
    expect(scandiLeak?.bookSan).toBe('exd5');
    expect(scandiLeak?.playedColor).toBe('white');
    expect(scandiLeak?.gameDate).toBe('2026-10-08');
    expect(scandiLeak?.fen).toBe('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(scandiLeak?.gameUrl).toContain('185031553576');
    expect(scandiLeak?.description).toContain('Scandinavian');
    expect(scandiLeak?.description).toContain('2.exd5!');

    // Impact is measured, not a constant: all four fixture Scandinavians were lost
    expect(scandiLeak?.impact?.gamesWith).toBe(4);
    expect(scandiLeak?.impact?.scoreWith).toBe(0);
    expect(scandiLeak?.evaluationDelta).toMatch(/^[+-]\d+\.\d pts$/);
  });

  it('flags early queen sorties with at least two undeveloped minor pieces, for both colours', () => {
    const qb6 = DiagnosticAnalyzer.detectEarlyQueenSortie(byId('171894388406'), byId('171894388406').movesSan, 'black');
    expect(qb6).not.toBeNull();
    expect(qb6?.ply).toBe(6);
    expect(qb6?.playedSan).toBe('Qb6');
    expect(qb6?.patternId).toBe('early-queen-sortie');
    expect(qb6?.bookSan).toBeUndefined();

    const qb6Early = DiagnosticAnalyzer.detectEarlyQueenSortie(byId('185346239794'), byId('185346239794').movesSan, 'black');
    expect(qb6Early?.ply).toBe(4);

    // 2.exd5 Qxd5 style recaptures are not sorties, and a queen move after ply 10 is not flagged
    const italian = byId('185894059676');
    expect(DiagnosticAnalyzer.detectEarlyQueenSortie(italian, italian.movesSan, 'white')).toBeNull();

    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    const queenLeakIds = report.blackStats.keyLeaks
      .filter((l) => l.patternId === 'early-queen-sortie')
      .map((l) => l.gameId);
    expect(queenLeakIds).toEqual(
      expect.arrayContaining(['171894388406', '185129553252', '168910457740', '185346239794'])
    );
  });

  it('flags ...Bg4 only when the aftermath cost something (a real chase or a queen that hits something), not every ...Bg4', () => {
    const chased = byId('169098759508');
    const chase = DiagnosticAnalyzer.detectBlackBg4ChaseLeak(chased, chased.movesSan);
    expect(chase).not.toBeNull();
    expect(chase?.playedSan).toBe('Bg4');
    expect(chase?.description).toMatch(/chased|g4/);

    // In 168471072534 White closed the fourth rank with 5.d4 before 6.Qa4+, so the check hit nothing: not a leak
    const closedRank = byId('168471072534');
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(closedRank, closedRank.movesSan)).toBeNull();

    // A theory-approved ...Bg4 that was never punished is not a leak (1.e4 c6 2.Nf3 d5 3.e5 Bg4)
    const quietBg4 = seedGames.find((g) => g.url?.endsWith('/173676860416'))!;
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(quietBg4, quietBg4.movesSan)).toBeNull();
  });

  it('reads the board for the ...Bg4 aftermath: b7 must be hit with a clear path, a check must also hit the bishop, a chase needs h3/f3 first', () => {
    const b7 = synthetic(['e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'c3', 'Bg4', 'Qb3']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(b7, b7.movesSan)?.description).toMatch(/b7 pawn is loose/);

    const fork = synthetic(['e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'c3', 'Bg4', 'Qa4+']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(fork, fork.movesSan)?.description).toMatch(/check also hit your bishop/);

    // b7 is empty, so Qa4+ hits nothing that ...Bg4 left behind
    const harmless = synthetic(['d4', 'd5', 'Nf3', 'b6', 'c4', 'Bg4', 'Qa4+']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(harmless, harmless.movesSan)).toBeNull();

    // g4 without a preceding kick on the bishop is not the chase pattern
    const noKick = synthetic(['e4', 'c6', 'Nf3', 'd5', 'e5', 'Bg4', 'd4', 'Bh5', 'g4']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(noKick, noKick.movesSan)).toBeNull();

    // The kick is read from the board, not from a SAN list, and the message names the real move
    const knightKick = seedGames.find((g) => g.url?.endsWith('/168526222308'))!;
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(knightKick, knightKick.movesSan)?.description).toMatch(/after Ne5 it retreated/);
    const f3Kick = seedGames.find((g) => g.url?.endsWith('/184423467872'))!;
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(f3Kick, f3Kick.movesSan)?.description).toMatch(/after f3 it retreated/);

    // A defended b7 pawn is not loose, and an unrelated queen capture (Qxb4 winning a knight) is not a ...Bg4 cost
    const defendedB7 = synthetic(['e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'c3', 'Qc7', 'd4', 'Bg4', 'Qb3']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(defendedB7, defendedB7.movesSan)).toBeNull();
    const knightWin = seedGames.find((g) => g.url?.endsWith('/185778503204'))!;
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(knightWin, knightWin.movesSan)).toBeNull();

    // A queen already on b3 that simply takes b7 is the most direct cost of all
    const takesB7 = synthetic(['e4', 'c6', 'Nf3', 'd5', 'exd5', 'cxd5', 'c3', 'Nf6', 'Qb3', 'Bg4', 'Qxb7']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(takesB7, takesB7.movesSan)?.description).toMatch(/took it with Qxb7/);

    // The f7 battery needs an open diagonal; a bishop on b3 behind its own pawn on d5 is not one
    const blockedBattery = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'd5', 'Bb3', 'Bg4', 'h3', 'Bxf3', 'Qxf3']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(blockedBattery, blockedBattery.movesSan)).toBeNull();
    const openBattery = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6', 'd3', 'Bg4', 'h3', 'Bxf3', 'Qxf3']);
    expect(DiagnosticAnalyzer.detectBlackBg4ChaseLeak(openBattery, openBattery.movesSan)?.description).toMatch(/the c4 bishop form a battery/);
  });

  it('calls a queen move a sortie only when the queen leaves its home square', () => {
    // The forced Scandinavian recapture and retreat are not sorties
    const scandi = synthetic(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5']);
    expect(DiagnosticAnalyzer.detectEarlyQueenSortie(scandi, scandi.movesSan, 'black')).toBeNull();
    const retreat = synthetic(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qd8']);
    expect(DiagnosticAnalyzer.detectEarlyQueenSortie(retreat, retreat.movesSan, 'black')).toBeNull();

    // A queen leaving d8 with both knights and bishops at home is one
    const sortie = synthetic(['e4', 'e5', 'Nf3', 'Qf6']);
    const flagged = DiagnosticAnalyzer.detectEarlyQueenSortie(sortie, sortie.movesSan, 'black');
    expect(flagged?.playedSan).toBe('Qf6');
    expect(flagged?.ply).toBe(4);
    expect(flagged?.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  });

  it('prints n/a instead of a fabricated delta when there are no games to compare against', () => {
    const onlyScandis = CANONICAL_HOOT65_GAMES.filter((g) =>
      ['185031553576', '185035281692', '184582182704', '171000270176'].includes(g.id)
    );
    const report = analyzeGames(onlyScandis, 'hoot65');
    const scandi = report.patterns!.find((p) => p.id === 'white-scandi-e5')!;
    expect(scandi.impact.gamesWith).toBe(4);
    expect(scandi.impact.gamesWithout).toBe(0);
    expect(scandi.isLeak).toBe(true); // inferior by theory, so still a leak
    for (const leak of report.whiteStats.keyLeaks) expect(leak.evaluationDelta).toBe('n/a');

    const onlyChase = analyzeGames([byId('169098759508')], 'hoot65');
    const bg4 = onlyChase.patterns!.find((p) => p.id === 'black-bg4-chase')!;
    expect(bg4.impact.gamesWith).toBe(1);
    expect(bg4.impact.gamesWithout).toBe(0);
    expect(bg4.isLeak).toBe(false); // neutral and nothing to compare against: information only
    expect(bg4.deviations[0].evaluationDelta).toBe('n/a');
  });

  it('lists a neutral pattern as a leak only when it measurably costs points', () => {
    // Fixtures: the one chased ...Bg4 game was lost while the other Black games scored 20%, so it is a leak here
    const report = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    const bg4 = report.patterns!.find((p) => p.id === 'black-bg4-chase')!;
    expect(bg4.theoryVerdict).toBe('neutral');
    expect(bg4.impact.gamesWith).toBe(1);
    expect(bg4.impact.scoreWith).toBeLessThan(bg4.impact.scoreWithout);
    expect(bg4.isLeak).toBe(true);
    expect(report.blackStats.keyLeaks.some((l) => l.patternId === 'black-bg4-chase')).toBe(true);

    const scandi = report.patterns!.find((p) => p.id === 'white-scandi-e5')!;
    expect(scandi.theoryVerdict).toBe('inferior');
    expect(scandi.isLeak).toBe(true);

    // Whole archive: the ...Bg4 games scored better than the rest, so the same pattern is information, not a leak
    const archive = analyzeGames(seedGames, 'hoot65');
    const bg4All = archive.patterns!.find((p) => p.id === 'black-bg4-chase')!;
    expect(bg4All.impact.gamesWith).toBe(13);
    expect(bg4All.impact.scoreWith).toBeGreaterThan(bg4All.impact.scoreWithout);
    expect(bg4All.isLeak).toBe(false);
    expect(archive.blackStats.keyLeaks.some((l) => l.patternId === 'black-bg4-chase')).toBe(false);
    expect(bg4All.deviations[0].evaluationDelta).toMatch(/^\+\d+\.\d pts$/);
  });

  it('on the full archive reports exactly the stored games and only legal book moves', () => {
    const report = analyzeGames(seedGames, 'hoot65');
    expect(report.totalGamesAnalyzed).toBe(seedGames.length);
    expect(report.whiteStats.totalGames).toBe(150);
    expect(report.blackStats.totalGames).toBe(151);

    const scandi = report.patterns!.find((p) => p.id === 'white-scandi-e5')!;
    expect(scandi.impact.gamesWith).toBe(15);
    expect(scandi.isLeak).toBe(true);
    const queen = report.patterns!.find((p) => p.id === 'early-queen-sortie')!;
    expect(queen.impact.gamesWith).toBe(56);
    expect(queen.impact.scoreWith).toBeLessThan(queen.impact.scoreWithout);
    expect(queen.isLeak).toBe(true);

    for (const leak of [...report.whiteStats.keyLeaks, ...report.blackStats.keyLeaks]) {
      const chess = new Chess(leak.fen);
      expect(chess.fen()).toBe(leak.fen);
      if (leak.bookSan) {
        expect(() => chess.move(leak.bookSan!)).not.toThrow();
      }
      expect(leak.gameDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('groups the opening matrix by the first six plies, sorted by frequency', () => {
    const report = analyzeGames(seedGames, 'hoot65');
    const white = report.whiteStats.openings!;
    expect(white.length).toBeGreaterThan(0);
    for (let i = 1; i < white.length; i++) {
      expect(white[i - 1].totalGames).toBeGreaterThanOrEqual(white[i].totalGames);
    }
    expect(white[0].lineSan).toBe('e4 e5 Nf3 Nc6 Bc4 h6');
    expect(white[0].totalGames).toBe(16);
    const nd4 = white.find((o) => o.lineSan === 'e4 e5 Nf3 Nc6 Bc4 Nd4');
    expect(nd4?.totalGames).toBe(5);
    expect(nd4?.wins).toBe(0);
    for (const row of white) {
      expect(row.winRate).toBeCloseTo((row.wins + row.draws * 0.5) / row.totalGames, 3);
    }
  });

  it('calculates win rates without division by zero or NaN', () => {
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
    expect(singleWinReport.whiteStats.winRate).toBe(1);
    expect(Number.isNaN(singleWinReport.blackStats.winRate)).toBe(false);
  });

  it('identifies the Scandinavian deviation in arbitrary user-provided games', () => {
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
    const leak = DiagnosticAnalyzer.detectWhiteScandinavianLeak(customScandiGame, customScandiGame.movesSan);
    expect(leak).not.toBeNull();
    expect(leak?.gameId).toBe('user-scandi-test');
    expect(leak?.ply).toBe(3);
    expect(leak?.playedSan).toBe('e5');
    expect(leak?.bookSan).toBe('exd5');
  });
});
