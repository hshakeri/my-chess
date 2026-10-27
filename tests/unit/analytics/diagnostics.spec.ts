import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  DiagnosticAnalyzer,
  analyzeGames,
  detectRepertoireDivergence,
  materialBalance,
  CANONICAL_HOOT65_GAMES,
} from '../../../src/analytics/diagnostics';
import {
  buildRepertoireTree,
  fenKey,
  getRecommendedBlackRepertoire,
  getRecommendedWhiteRepertoire,
} from '../../../src/analytics/repertoire';
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

/** A constructed game with a result and an optional PGN Termination header. */
const game = (
  movesSan: string[],
  opts: { color: 'white' | 'black'; result: '1-0' | '0-1' | '1/2-1/2'; termination?: string; id?: string }
): StoredGame => {
  const userResult =
    opts.result === '1/2-1/2' ? 'draw' : (opts.result === '1-0') === (opts.color === 'white') ? 'win' : 'loss';
  return {
    id: opts.id ?? `constructed-${movesSan.join('-')}`,
    source: 'upload',
    pgn: `[Date "2026.02.02"]\n${opts.termination ? `[Termination "${opts.termination}"]\n` : ''}`,
    white: { name: opts.color === 'white' ? 'hoot65' : 'rival' },
    black: { name: opts.color === 'black' ? 'hoot65' : 'rival' },
    result: opts.result,
    timestamp: 0,
    movesSan,
    userColor: opts.color,
    userResult,
  };
};

const fenAfter = (sans: string[]): string => {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
};

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
    // The headlines are the plans' own names, not constants
    expect(report.recommendedWhiteRepertoire).toBe(getRecommendedWhiteRepertoire().name);
    expect(report.recommendedBlackRepertoire).toBe(getRecommendedBlackRepertoire().name);
    expect(report.recommendedBlackRepertoire).toBe('Caro-Kann & the c6-d5 Wall');
    expect(Array.isArray(report.patterns)).toBe(true);
    expect(report.repertoireLeaks).toEqual([]);
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

describe('Repertoire divergence (CL-4)', () => {
  const white = getRecommendedWhiteRepertoire();
  const black = getRecommendedBlackRepertoire();
  const whiteTree = buildRepertoireTree(white);
  const blackTree = buildRepertoireTree(black);
  const lineNames = Object.fromEntries([...white.lines, ...black.lines].map((l) => [l.id, l.name]));

  it('reports the player\'s first move off the tree with the tree\'s move as bookSan and the position before it', () => {
    const scandi = byId('185031553576');
    const dev = detectRepertoireDivergence(scandi, whiteTree, 'white', { lineNames });
    expect(dev).toMatchObject({
      gameId: '185031553576',
      playedColor: 'white',
      ply: 3,
      fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      playedSan: 'e5',
      bookSan: 'exd5',
      patternId: 'repertoire-divergence',
      lineName: 'Anti-Scandinavian Refutation (2.exd5!)',
      gameDate: '2026-10-08',
      opponent: 'meny_26',
    });
    expect(dev!.description).toContain('2.e5');
    expect(dev!.description).toContain('2.exd5');
    expect(() => new Chess(dev!.fen).move(dev!.bookSan!)).not.toThrow();

    // Black: 1.e4 c6 2.d4 Qb6 leaves the Caro-Kann at move 2 where the plan says 2...d5
    const qb6 = byId('185346239794');
    expect(detectRepertoireDivergence(qb6, blackTree, 'black', { lineNames })).toMatchObject({
      ply: 4,
      playedSan: 'Qb6',
      bookSan: 'd5',
      fen: fenAfter(['e4', 'c6', 'd4']),
      lineName: 'Caro-Kann Advance (Disciplined 3...Bf5!)',
    });
  });

  it('is not a leak when the opponent leaves the plan first, when the plan ends, or when the move list is corrupt', () => {
    // 1.e4 c6 2.f4: White left the plan before hoot65 could
    expect(detectRepertoireDivergence(byId('171894388406'), blackTree, 'black', { lineNames })).toBeNull();
    // 1.c4 is not in the Black plan at all: the opponent diverged at ply 1
    expect(detectRepertoireDivergence(synthetic(['c4', 'e5'], 'black'), blackTree, 'black')).toBeNull();
    // A game that follows the Scandinavian line to its end and plays on is inside the plan
    const scandiLine = white.lines.find((l) => l.id === 'white-scandi-refutation')!;
    const end = new Chess(scandiLine.moves[scandiLine.moves.length - 1].fen);
    const beyond = synthetic([...scandiLine.movesSan, end.moves()[0]], 'white');
    expect(detectRepertoireDivergence(beyond, whiteTree, 'white')).toBeNull();
    // An empty or illegal move list is not a divergence
    expect(detectRepertoireDivergence(synthetic([], 'white'), whiteTree, 'white')).toBeNull();
    expect(detectRepertoireDivergence(synthetic(['e4', 'Ke7'], 'white'), whiteTree, 'white')).toBeNull();
  });

  it('matches positions, not move orders: the 2.Nf3 move orders join the London and Slav lines and are judged by their continuations', () => {
    // 1.d4 d5 2.Nf3 c6 3.Bf4 Bf5 4.e3 e6 5.Bd3 Bxd3 6.Qxd3 is the London line by transposition; 6...Nf6 instead of 6...Qb6
    const london = synthetic(['d4', 'd5', 'Nf3', 'c6', 'Bf4', 'Bf5', 'e3', 'e6', 'Bd3', 'Bxd3', 'Qxd3', 'Nf6'], 'black');
    expect(detectRepertoireDivergence(london, blackTree, 'black', { lineNames })).toMatchObject({
      ply: 12,
      playedSan: 'Nf6',
      bookSan: 'Qb6',
      lineName: 'The c6-d5 wall vs the London (2.Bf4)',
      fen: fenAfter(['d4', 'd5', 'Nf3', 'c6', 'Bf4', 'Bf5', 'e3', 'e6', 'Bd3', 'Bxd3', 'Qxd3']),
    });
    // 2.Nf3 c6 3.c4 Nf6 is the Slav; after the transposition the 2.c4 line's 7...Bb4 is the book move
    const slav = synthetic(['d4', 'd5', 'Nf3', 'c6', 'c4', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5', 'e3', 'e6', 'Bxc4', 'Be7'], 'black');
    expect(detectRepertoireDivergence(slav, blackTree, 'black', { lineNames })).toMatchObject({
      ply: 14,
      playedSan: 'Be7',
      bookSan: 'Bb4',
      lineName: 'Slav Defence: the c6-d5 wall vs 2.c4',
    });
    // Check markers and glyphs in the stored SAN do not matter
    const glyphs = synthetic(['e4', 'd5', 'e5?!'], 'white');
    expect(detectRepertoireDivergence(glyphs, whiteTree, 'white')?.playedSan).toBe('e5');
  });

  it('keeps 4.b4 inside the plan and gives it as the book move after 3...Bc5; 4.c3 is also in the plan', () => {
    const evans = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bc5', 'd4', 'exd4', 'O-O', 'd6', 'cxd4', 'Bb6', 'Nc3', 'Nf6'], 'white');
    expect(detectRepertoireDivergence(evans, whiteTree, 'white')).toBeNull();
    const giuoco = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4'], 'white');
    expect(detectRepertoireDivergence(giuoco, whiteTree, 'white')).toBeNull();
    const castled = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'], 'white');
    expect(detectRepertoireDivergence(castled, whiteTree, 'white', { lineNames })).toMatchObject({
      ply: 7,
      playedSan: 'O-O',
      bookSan: 'b4',
      lineName: 'Italian Game: Evans Gambit (4.b4)',
    });
  });

  it('aggregates one divergence per game into leaks keyed by position and move, scored against the other games of that colour, sorted by games x score deficit', () => {
    const report = analyzeGames(seedGames, 'hoot65');
    const leaks = report.repertoireLeaks;
    expect(leaks.length).toBeGreaterThan(0);

    // Every leak: legal position, legal played and book moves, consistent key, one deviation per game
    for (const leak of leaks) {
      const chess = new Chess(leak.fen);
      expect(chess.fen()).toBe(leak.fen);
      expect(fenKey(leak.fen)).toBe(leak.fenKey);
      expect(() => new Chess(leak.fen).move(leak.playedSan)).not.toThrow();
      expect(() => new Chess(leak.fen).move(leak.bookSan)).not.toThrow();
      expect(leak.deviations).toHaveLength(leak.games);
      expect(new Set(leak.deviations.map((d) => d.gameId)).size).toBe(leak.games);
      for (const d of leak.deviations) {
        expect(d.patternId).toBe('repertoire-divergence');
        expect(d.playedColor).toBe(leak.color);
        expect(d.bookSan).toBe(leak.bookSan);
        expect(d.lineName).toBe(leak.lineName);
        expect(d.impact).toEqual({ gamesWith: leak.games, scoreWith: leak.score, gamesWithout: expect.any(Number), scoreWithout: leak.scoreOther });
        expect(d.evaluationDelta).toMatch(/^[+-]\d+\.\d pts$|^n\/a$/);
      }
    }

    // Sorted by games x max(0, scoreOther - score), then by games
    const deficit = (l: (typeof leaks)[number]) => l.games * Math.max(0, l.scoreOther - l.score);
    for (let i = 1; i < leaks.length; i++) {
      const a = leaks[i - 1];
      const b = leaks[i];
      expect(deficit(a)).toBeGreaterThanOrEqual(deficit(b));
      if (deficit(a) === deficit(b)) expect(a.games).toBeGreaterThanOrEqual(b.games);
    }

    // The maintainer's decision shows up in the data: 1...Nf6 against 1.d4 in 29 games is the biggest leak
    const top = leaks[0];
    expect(top).toMatchObject({ color: 'black', playedSan: 'Nf6', bookSan: 'd5', games: 29 });
    expect(top.fenKey).toBe(fenKey(fenAfter(['d4'])));
    expect(top.lineName).toBe('Slav Defence: the c6-d5 wall vs 2.c4');
    expect(top.score).toBeCloseTo(0.379, 3);
    expect(top.scoreOther).toBeCloseTo(0.508, 3);
    // scoreOther is measured on the other Black games (151 - 29)
    expect(top.deviations[0].impact?.gamesWithout).toBe(151 - 29);

    // The 15 Scandinavian 2.e5 games are one White leak; the Evans 4.b4 is in the plan and never a leak
    const scandi = leaks.find((l) => l.color === 'white' && l.playedSan === 'e5' && l.bookSan === 'exd5')!;
    expect(scandi.games).toBe(15);
    expect(scandi.fen).toBe('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(leaks.some((l) => l.playedSan === 'b4')).toBe(false);
    const castled = leaks.find((l) => l.color === 'white' && l.playedSan === 'O-O' && l.bookSan === 'b4')!;
    expect(castled.games).toBe(3);

    // 1...d6 (41 games) scored about the same as the other Black games, so it sorts below the costly leaks
    const pirc = leaks.find((l) => l.color === 'black' && l.playedSan === 'd6' && l.bookSan === 'c6')!;
    expect(pirc.games).toBe(41);
    expect(leaks.indexOf(pirc)).toBeGreaterThan(leaks.indexOf(scandi));

    // Repertoire divergences are not mixed into the pattern cards or the key leaks
    expect(report.patterns!.some((p) => (p.id as string) === 'repertoire-divergence')).toBe(false);
    expect([...report.whiteStats.keyLeaks, ...report.blackStats.keyLeaks].some((l) => l.patternId === 'repertoire-divergence')).toBe(false);
  });
});

describe('Result and trap detectors (CL-4)', () => {
  it('mated-while-ahead: Legal\'s mate leaves Black seven points up and mated; the mated side, the material and the result all have to match', () => {
    const legal = ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'h6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'];
    const g = game(legal, { color: 'black', result: '1-0' });
    const final = new Chess();
    for (const san of legal) final.move(san);
    expect(final.isCheckmate()).toBe(true);
    expect(materialBalance(final, 'b')).toBe(7);

    const dev = DiagnosticAnalyzer.detectMatedWhileAhead(g, g.movesSan, 'black');
    expect(dev).toMatchObject({
      playedColor: 'black',
      ply: 12,
      playedSan: 'Ke7',
      fen: fenAfter(legal.slice(0, 11)),
      patternId: 'mated-while-ahead',
      gameDate: '2026-02-02',
      opponent: 'rival',
    });
    expect(dev!.bookSan).toBeUndefined();
    expect(dev!.description).toContain('7 points of material');
    expect(dev!.description).toContain('move 7');

    // The winner is not flagged, nor a mate while level (fool's mate), nor a loss by mate while behind, nor a resignation
    expect(DiagnosticAnalyzer.detectMatedWhileAhead(game(legal, { color: 'white', result: '1-0' }), legal, 'white')).toBeNull();
    const fools = ['f3', 'e5', 'g4', 'Qh4#'];
    expect(DiagnosticAnalyzer.detectMatedWhileAhead(game(fools, { color: 'white', result: '0-1' }), fools, 'white')).toBeNull();
    const behind = byId('185031553576'); // mated by Qe1# while down material
    expect(DiagnosticAnalyzer.detectMatedWhileAhead(behind, behind.movesSan, 'white')).toBeNull();
    expect(DiagnosticAnalyzer.detectMatedWhileAhead(game(legal.slice(0, 12), { color: 'black', result: '1-0' }), legal.slice(0, 12), 'black')).toBeNull();
  });

  it('lost-on-time-while-ahead: needs a loss, a Termination header mentioning time, and two or more points of material', () => {
    // 1.e4 e5 2.Nf3 Qf6 3.Nc3 Qg6 4.d4 Qxg2 5.Bxg2: White is a queen for a pawn up (+8)
    const moves = ['e4', 'e5', 'Nf3', 'Qf6', 'Nc3', 'Qg6', 'd4', 'Qxg2', 'Bxg2'];
    const final = new Chess();
    for (const san of moves) final.move(san);
    expect(materialBalance(final, 'w')).toBe(8);

    const lost = game(moves, { color: 'white', result: '0-1', termination: 'rival won on time' });
    const dev = DiagnosticAnalyzer.detectLostOnTimeWhileAhead(lost, moves, 'white');
    expect(dev).toMatchObject({
      playedColor: 'white',
      ply: 9,
      playedSan: 'Bxg2',
      fen: fenAfter(moves.slice(0, 8)),
      patternId: 'lost-on-time-while-ahead',
    });
    expect(dev!.bookSan).toBeUndefined();
    expect(dev!.description).toContain('8 points of material');
    expect(dev!.description).toContain('move 5');

    // No Termination, a resignation, a draw on time, a win on time, or no material edge: not flagged
    expect(DiagnosticAnalyzer.detectLostOnTimeWhileAhead(game(moves, { color: 'white', result: '0-1' }), moves, 'white')).toBeNull();
    expect(DiagnosticAnalyzer.detectLostOnTimeWhileAhead(game(moves, { color: 'white', result: '0-1', termination: 'rival won by resignation' }), moves, 'white')).toBeNull();
    expect(DiagnosticAnalyzer.detectLostOnTimeWhileAhead(game(moves, { color: 'white', result: '1/2-1/2', termination: 'Game drawn by timeout vs insufficient material' }), moves, 'white')).toBeNull();
    expect(DiagnosticAnalyzer.detectLostOnTimeWhileAhead(game(moves, { color: 'white', result: '1-0', termination: 'hoot65 won on time' }), moves, 'white')).toBeNull();
    const level = ['e4', 'e5', 'Nf3', 'Nc6'];
    expect(DiagnosticAnalyzer.detectLostOnTimeWhileAhead(game(level, { color: 'black', result: '1-0', termination: 'rival won on time' }), level, 'black')).toBeNull();
    // As Black the last ply is Black's own move
    const blackUp = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Nxe5', 'Nxe5', 'd4', 'Nxc4'];
    const b = game(blackUp, { color: 'black', result: '1-0', termination: 'rival won on time' });
    expect(DiagnosticAnalyzer.detectLostOnTimeWhileAhead(b, blackUp, 'black')).toMatchObject({ ply: 10, playedSan: 'Nxc4' });
  });

  it('blackburne-shilling-handling flags 4.Nxe5? after 3...Nd4 with 4.Nxd4 as the book move, and not 4.Nxd4 or 4.c3', () => {
    const bad = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5'], 'white');
    const dev = DiagnosticAnalyzer.detectBlackburneShillingHandling(bad, bad.movesSan);
    expect(dev).toMatchObject({
      playedColor: 'white',
      ply: 7,
      playedSan: 'Nxe5',
      bookSan: 'Nxd4',
      patternId: 'blackburne-shilling-handling',
      fen: fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4']),
    });
    expect(() => new Chess(dev!.fen).move('Nxd4')).not.toThrow();
    // The description's refutation is a real mate
    const trap = new Chess(dev!.fen);
    for (const san of ['Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#']) trap.move(san);
    expect(trap.isCheckmate()).toBe(true);

    const good = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxd4', 'exd4'], 'white');
    expect(DiagnosticAnalyzer.detectBlackburneShillingHandling(good, good.movesSan)).toBeNull();
    const c3 = synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'c3'], 'white');
    expect(DiagnosticAnalyzer.detectBlackburneShillingHandling(c3, c3.movesSan)).toBeNull();
    expect(DiagnosticAnalyzer.detectBlackburneShillingHandling(synthetic(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4'], 'white'), ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4'])).toBeNull();
  });

  it('on the archive: 2 Blackburne-Shilling 4.Nxe5 games, 6 mates and 7 time losses while ahead, all measured and all leaks', () => {
    const report = analyzeGames(seedGames, 'hoot65');
    const byPattern = (id: string) => report.patterns!.find((p) => p.id === id)!;

    const bs = byPattern('blackburne-shilling-handling');
    expect(bs.theoryVerdict).toBe('inferior');
    expect(bs.color).toBe('white');
    expect(bs.impact.gamesWith).toBe(2);
    expect(bs.impact.scoreWith).toBe(0);
    expect(bs.isLeak).toBe(true);
    expect(bs.deviations.map((d) => d.gameId).sort()).toEqual(['169351731946', '184018513142']);

    const mated = byPattern('mated-while-ahead');
    expect(mated.theoryVerdict).toBe('neutral');
    expect(mated.color).toBe('both');
    expect(mated.impact.gamesWith).toBe(6);
    expect(mated.impact.gamesWithout).toBe(301 - 6);
    expect(mated.impact.scoreWith).toBe(0);
    expect(mated.isLeak).toBe(true);

    const time = byPattern('lost-on-time-while-ahead');
    expect(time.theoryVerdict).toBe('neutral');
    expect(time.impact.gamesWith).toBe(7);
    expect(time.impact.scoreWith).toBe(0);
    expect(time.isLeak).toBe(true);
    for (const d of time.deviations) expect(d.evaluationDelta).toMatch(/^-\d+\.\d pts$/);

    // The existing pins are untouched by the new detectors
    expect(report.totalGamesAnalyzed).toBe(301);
    expect(byPattern('white-scandi-e5').impact.gamesWith).toBe(15);
    expect(byPattern('early-queen-sortie').impact.gamesWith).toBe(56);
    expect(byPattern('black-bg4-chase').impact.gamesWith).toBe(13);

    // Fixture games (24 plies, no Termination header): the result detectors stay silent, so the fixture leak order is unchanged
    const fixtures = analyzeGames(CANONICAL_HOOT65_GAMES, 'hoot65');
    expect(fixtures.patterns!.find((p) => p.id === 'mated-while-ahead')!.impact.gamesWith).toBe(0);
    expect(fixtures.patterns!.find((p) => p.id === 'lost-on-time-while-ahead')!.impact.gamesWith).toBe(0);
    expect(fixtures.whiteStats.keyLeaks[0].patternId).toBe('white-scandi-e5');
  });
});
