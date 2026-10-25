import { Chess } from 'chess.js';
import { StoredGame } from '../types/db';
import {
  DiagnosticReport,
  OpeningDeviation,
  OpeningStats,
  PatternImpact,
  PatternSummary,
} from '../types/diagnostics';
import {
  getRecommendedWhiteRepertoire,
  getRecommendedBlackRepertoire,
} from './repertoire';
import { CANONICAL_HOOT65_GAMES } from './canonicalGames';

/**
 * Real hoot65 archive games used as test fixtures for the detectors below.
 * They are NOT injected into analysis: the report describes exactly the games
 * it is given (the live IndexedDB archive in the app).
 */
export { CANONICAL_HOOT65_GAMES };

export type PatternId = 'white-scandi-e5' | 'black-bg4-chase' | 'early-queen-sortie';

interface PatternMeta {
  id: PatternId;
  label: string;
  color: 'white' | 'black' | 'both';
  theoryVerdict: 'inferior' | 'neutral';
  description: string;
}

const PATTERN_META: Record<PatternId, PatternMeta> = {
  'white-scandi-e5': {
    id: 'white-scandi-e5',
    label: 'Scandinavian: 2.e5?! instead of 2.exd5',
    color: 'white',
    theoryVerdict: 'inferior',
    description:
      'After 1.e4 d5 the pawn push 2.e5 hands Black a comfortable French-style structure with the light-squared bishop already free. 2.exd5 keeps the initiative: after 2...Qxd5 the knight comes to c3 with tempo on the queen, after 2...Nf6 White holds the extra pawn with d4 and c4.',
  },
  'black-bg4-chase': {
    id: 'black-bg4-chase',
    label: '...Bg4 that got chased or cost b7/f7',
    color: 'black',
    theoryVerdict: 'neutral',
    description:
      'An early ...Bg4 is fine when there is a knight on f3 to pin and the bishop has an exit. It costs tempi or material when the retreat ...Bh5 can be hit by g4, when a queen check on a4 or Qb3 picks up the loose b7 pawn, or when ...Bxf3 Qxf3 builds a battery against f7. Before ...Bg4 ask: is there a knight to pin, am I happy to give bishop for knight, and does the bishop have an exit square?',
  },
  'early-queen-sortie': {
    id: 'early-queen-sortie',
    label: 'Queen out before the minor pieces',
    color: 'both',
    theoryVerdict: 'inferior',
    description:
      'The queen left home within the first five moves while at least two minor pieces were still on their starting squares. A queen that comes out early becomes a target for developing moves (Nc3, Bd2, b4), and every retreat is a lost tempo. Develop knights and bishops first; the queen decides later.',
  },
};

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function cleanSan(san: string): string {
  return san.replace(/[!?]/g, '');
}

function toDateString(game: StoredGame): string | undefined {
  const m = game.pgn?.match(/\[Date "(\d{4})\.(\d{2})\.(\d{2})"\]/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (game.timestamp) return new Date(game.timestamp).toISOString().slice(0, 10);
  return undefined;
}

function gameUrlOf(game: StoredGame): string {
  if (game.url) return game.url;
  const numeric = game.id.replace(/^chesscom:/, '');
  return `https://www.chess.com/game/live/${numeric}`;
}

/** Numeric Chess.com game id when the URL carries one, otherwise the stored id. */
export function displayGameId(game: StoredGame): string {
  const fromUrl = game.url?.match(/\/(\d+)\/?$/);
  if (fromUrl) return fromUrl[1];
  return game.id;
}

function scoreOf(games: StoredGame[], handle: string): number {
  if (games.length === 0) return 0;
  let points = 0;
  for (const g of games) {
    const color = DiagnosticAnalyzer.getPlayerColor(g, handle);
    if (!color) continue;
    const res = DiagnosticAnalyzer.getPlayerResult(g, color);
    if (res === 'win') points += 1;
    else if (res === 'draw') points += 0.5;
  }
  return Number((points / games.length).toFixed(3));
}

function formatImpact(impact: PatternImpact): string {
  if (impact.gamesWith === 0) return 'n/a';
  const delta = (impact.scoreWith - impact.scoreWithout) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} pts`;
}

const MINOR_START_SQUARES: Record<'w' | 'b', string[]> = {
  w: ['b1', 'g1', 'c1', 'f1'],
  b: ['b8', 'g8', 'c8', 'f8'],
};

function undevelopedMinors(chess: Chess, color: 'w' | 'b'): number {
  let count = 0;
  for (const sq of MINOR_START_SQUARES[color]) {
    const piece = chess.get(sq as any);
    if (piece && piece.color === color && (piece.type === 'n' || piece.type === 'b')) count++;
  }
  return count;
}

/**
 * Diagnostic Game Analyzer Engine
 * Analyzes the games it is given for recurring, measurable opening habits.
 */
export class DiagnosticAnalyzer {
  /**
   * Determine played color for playerHandle in a game.
   */
  public static getPlayerColor(game: StoredGame, handle: string): 'white' | 'black' | null {
    if (game.userColor) return game.userColor;
    const cleanHandle = handle.trim().toLowerCase();
    if (game.white?.name?.trim().toLowerCase() === cleanHandle) return 'white';
    if (game.black?.name?.trim().toLowerCase() === cleanHandle) return 'black';
    return null;
  }

  /**
   * Determine result for playerHandle in a game.
   */
  public static getPlayerResult(game: StoredGame, color: 'white' | 'black'): 'win' | 'loss' | 'draw' {
    if (game.userResult && game.userResult !== '*') {
      return game.userResult as 'win' | 'loss' | 'draw';
    }
    if (game.result === '1-0') return color === 'white' ? 'win' : 'loss';
    if (game.result === '0-1') return color === 'black' ? 'win' : 'loss';
    return 'draw';
  }

  /**
   * Detect Scandinavian 2.e5?! deviation in a White game.
   * bookSan 2.exd5 is legal by construction in the position after 1.e4 d5.
   */
  public static detectWhiteScandinavianLeak(
    game: StoredGame,
    moves: string[]
  ): OpeningDeviation | null {
    if (moves.length < 3) return null;
    if (cleanSan(moves[0]) === 'e4' && cleanSan(moves[1]) === 'd5' && cleanSan(moves[2]) === 'e5') {
      const fenBeforeE5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      return {
        gameId: displayGameId(game),
        gameUrl: gameUrlOf(game),
        gameDate: toDateString(game),
        opponent: game.black?.name || 'Opponent',
        playedColor: 'white',
        ply: 3,
        fen: fenBeforeE5,
        playedSan: 'e5',
        bookSan: 'exd5',
        evaluationDelta: '',
        patternId: 'white-scandi-e5',
        description:
          'Against the Scandinavian Defense (1...d5), 2.e5?! closes the center and gives Black a comfortable French-style setup with the light-squared bishop already out (2...Bf5 or 2...c5). Take the pawn: 2.exd5! and after 2...Qxd5 develop with 3.Nc3, gaining a tempo on the queen; after 2...Nf6 keep the pawn with 3.d4 and 4.c4.',
      };
    }
    return null;
  }

  /**
   * Detect an early ...Bg4 by Black that actually cost something within the next
   * six plies: chased by h3 ...Bh5 g4, a Qb3/Qa4+ hit on the loose b7 pawn, or a
   * ...Bxf3 Qxf3 battery against f7 with a white bishop on the a2-g8 diagonal.
   * A plain ...Bg4 that was never punished is NOT flagged.
   */
  public static detectBlackBg4ChaseLeak(
    game: StoredGame,
    moves: string[]
  ): OpeningDeviation | null {
    if (moves.length < 6) return null;

    const chess = new Chess(START_FEN);
    for (let i = 0; i < Math.min(moves.length, 12); i++) {
      const san = cleanSan(moves[i]);
      const isBlackTurn = i % 2 === 1;
      const fenBefore = chess.fen();

      if (isBlackTurn && san === 'Bg4') {
        const tax = this.classifyBg4Aftermath(fenBefore, moves, i);
        if (!tax) return null;
        return {
          gameId: displayGameId(game),
          gameUrl: gameUrlOf(game),
          gameDate: toDateString(game),
          opponent: game.white?.name || 'Opponent',
          playedColor: 'black',
          ply: i + 1,
          fen: fenBefore,
          playedSan: 'Bg4',
          evaluationDelta: '',
          patternId: 'black-bg4-chase',
          description: tax,
        };
      }

      try {
        chess.move(san);
      } catch {
        return null; // corrupted move list
      }
    }
    return null;
  }

  private static classifyBg4Aftermath(fenBefore: string, moves: string[], bg4Index: number): string | null {
    const chess = new Chess(fenBefore);
    try {
      chess.move(cleanSan(moves[bg4Index]));
    } catch {
      return null;
    }
    const window = moves.slice(bg4Index + 1, bg4Index + 7).map(cleanSan);
    let sawH3 = false;
    let sawBh5 = false;

    for (let k = 0; k < window.length; k++) {
      const san = window[k];
      const isWhiteMove = k % 2 === 0; // the ply right after ...Bg4 is White's

      if (isWhiteMove) {
        if (san === 'h3' || san === 'f3') sawH3 = true;
        if (san === 'g4' && sawBh5) {
          return 'Your bishop was chased: after h3 it retreated to h5 and g4 drove it again, costing tempi and leaving it short of squares. Retreat only when the bishop has an exit (...h6 or ...h5 prepared), otherwise take on f3 or go back to d7.';
        }
        if (san === 'Qb3' || san === 'Qa4+' || san === 'Qa4') {
          return 'With the bishop gone from c8 the b7 pawn is loose: the queen came to b3/a4 hitting b7 (and f7 or the king). Before ...Bg4 make sure b7 is covered or that ...Qb6/...Qd7 is available.';
        }
        if (san === 'Qxf3') {
          const bishopOnDiagonal = ['c4', 'b3', 'a2', 'd5'].some((sq) => {
            const p = chess.get(sq as any);
            return p && p.color === 'w' && p.type === 'b';
          });
          if (bishopOnDiagonal) {
            return 'After ...Bxf3 Qxf3 the queen and the c4 bishop form a battery against f7. Trading on f3 is only safe when f7 is already covered (...e6, ...Nf6 or ...Qd7).';
          }
        }
      } else {
        if (san === 'Bh5') sawBh5 = true;
      }

      try {
        chess.move(san);
      } catch {
        return null;
      }
    }

    void sawH3;
    return null;
  }

  /**
   * Detect an early queen sortie by the player: the queen leaves its home square
   * within the first ten plies (move 5) while at least two of the player's minor
   * pieces are still undeveloped, and the move is not a capture.
   */
  public static detectEarlyQueenSortie(
    game: StoredGame,
    moves: string[],
    color: 'white' | 'black'
  ): OpeningDeviation | null {
    const mover: 'w' | 'b' = color === 'white' ? 'w' : 'b';
    const chess = new Chess(START_FEN);
    for (let i = 0; i < Math.min(moves.length, 10); i++) {
      const san = cleanSan(moves[i]);
      const turn = chess.turn();
      const fenBefore = chess.fen();

      if (turn === mover && san.startsWith('Q') && !san.includes('x')) {
        const undeveloped = undevelopedMinors(chess, mover);
        if (undeveloped >= 2) {
          const opponentName = color === 'white' ? game.black?.name : game.white?.name;
          return {
            gameId: displayGameId(game),
            gameUrl: gameUrlOf(game),
            gameDate: toDateString(game),
            opponent: opponentName || 'Opponent',
            playedColor: color,
            ply: i + 1,
            fen: fenBefore,
            playedSan: san,
            evaluationDelta: '',
            patternId: 'early-queen-sortie',
            description: `${san} brought the queen out on move ${Math.floor(i / 2) + 1} with ${undeveloped} minor pieces still at home. Each developing move that hits the queen wins a tempo for the opponent. Develop a knight or bishop instead and keep the queen flexible until the center is decided.`,
          };
        }
      }

      try {
        chess.move(san);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Group games by their first six plies, sort by frequency, and compute score rates.
   */
  private static buildOpeningStats(games: StoredGame[], color: 'white' | 'black'): OpeningStats[] {
    const map = new Map<string, OpeningStats & { nameCounts: Map<string, number> }>();
    for (const g of games) {
      const line = (g.movesSan || []).slice(0, 6).map(cleanSan).join(' ');
      const key = line || '(no moves)';
      if (!map.has(key)) {
        map.set(key, {
          eco: g.eco || (color === 'white' ? 'C00' : 'B00'),
          openingName: g.openingName || 'Unnamed opening',
          lineSan: line,
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          nameCounts: new Map(),
        });
      }
      const stat = map.get(key)!;
      stat.totalGames++;
      const res = this.getPlayerResult(g, color);
      if (res === 'win') stat.wins++;
      else if (res === 'loss') stat.losses++;
      else stat.draws++;
      const name = g.openingName || 'Unnamed opening';
      stat.nameCounts.set(name, (stat.nameCounts.get(name) || 0) + 1);
    }

    const result: OpeningStats[] = [];
    for (const stat of map.values()) {
      let bestName = stat.openingName;
      let bestCount = -1;
      for (const [name, count] of stat.nameCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestName = name;
        }
      }
      result.push({
        eco: stat.eco,
        openingName: bestName,
        lineSan: stat.lineSan,
        totalGames: stat.totalGames,
        wins: stat.wins,
        losses: stat.losses,
        draws: stat.draws,
        winRate: Number(((stat.wins + stat.draws * 0.5) / stat.totalGames).toFixed(3)),
      });
    }
    result.sort((a, b) => b.totalGames - a.totalGames || a.openingName.localeCompare(b.openingName));
    return result;
  }

  /**
   * Analyze the given games for a specific player handle. Nothing is injected:
   * the report describes exactly the games passed in.
   */
  public static analyze(
    games: StoredGame[] = [],
    playerHandle: 'hoot65' = 'hoot65'
  ): DiagnosticReport {
    const whiteGames: StoredGame[] = [];
    const blackGames: StoredGame[] = [];

    for (const g of games) {
      const color = this.getPlayerColor(g, playerHandle);
      if (color === 'white') whiteGames.push(g);
      else if (color === 'black') blackGames.push(g);
    }

    const tally = (list: StoredGame[], color: 'white' | 'black') => {
      let wins = 0, losses = 0, draws = 0;
      for (const g of list) {
        const res = this.getPlayerResult(g, color);
        if (res === 'win') wins++;
        else if (res === 'loss') losses++;
        else draws++;
      }
      const winRate = list.length > 0 ? Number(((wins + draws * 0.5) / list.length).toFixed(3)) : 0;
      return { wins, losses, draws, winRate };
    };

    const whiteTally = tally(whiteGames, 'white');
    const blackTally = tally(blackGames, 'black');

    // Run detectors
    const patternDeviations: Record<PatternId, OpeningDeviation[]> = {
      'white-scandi-e5': [],
      'black-bg4-chase': [],
      'early-queen-sortie': [],
    };
    const patternGameIds: Record<PatternId, Set<string>> = {
      'white-scandi-e5': new Set(),
      'black-bg4-chase': new Set(),
      'early-queen-sortie': new Set(),
    };

    for (const g of whiteGames) {
      const moves = g.movesSan || [];
      const scandi = this.detectWhiteScandinavianLeak(g, moves);
      if (scandi) {
        patternDeviations['white-scandi-e5'].push(scandi);
        patternGameIds['white-scandi-e5'].add(g.id);
      }
      const queen = this.detectEarlyQueenSortie(g, moves, 'white');
      if (queen) {
        patternDeviations['early-queen-sortie'].push(queen);
        patternGameIds['early-queen-sortie'].add(g.id);
      }
    }
    for (const g of blackGames) {
      const moves = g.movesSan || [];
      const bg4 = this.detectBlackBg4ChaseLeak(g, moves);
      if (bg4) {
        patternDeviations['black-bg4-chase'].push(bg4);
        patternGameIds['black-bg4-chase'].add(g.id);
      }
      const queen = this.detectEarlyQueenSortie(g, moves, 'black');
      if (queen) {
        patternDeviations['early-queen-sortie'].push(queen);
        patternGameIds['early-queen-sortie'].add(g.id);
      }
    }

    // Measured impact per pattern: games with the pattern vs the player's other
    // games of the colour(s) the pattern applies to.
    const patterns: PatternSummary[] = [];
    for (const meta of Object.values(PATTERN_META)) {
      const pool =
        meta.color === 'white' ? whiteGames : meta.color === 'black' ? blackGames : [...whiteGames, ...blackGames];
      const ids = patternGameIds[meta.id];
      const withGames = pool.filter((g) => ids.has(g.id));
      const withoutGames = pool.filter((g) => !ids.has(g.id));
      const impact: PatternImpact = {
        gamesWith: withGames.length,
        scoreWith: scoreOf(withGames, playerHandle),
        gamesWithout: withoutGames.length,
        scoreWithout: scoreOf(withoutGames, playerHandle),
      };
      const deltaText = formatImpact(impact);
      const deviations = patternDeviations[meta.id]
        .map((d) => ({ ...d, impact, evaluationDelta: deltaText }))
        .sort((a, b) => (b.gameDate || '').localeCompare(a.gameDate || '') || a.ply - b.ply);
      const measuredCost = impact.gamesWith > 0 && impact.scoreWith < impact.scoreWithout;
      const isLeak = impact.gamesWith > 0 && (meta.theoryVerdict === 'inferior' || measuredCost);
      patterns.push({ ...meta, isLeak, impact, deviations });
    }

    // Key leaks: patterns theory calls inferior, plus neutral patterns that
    // measurably cost points in this player's own games.
    const allDeviations = patterns.filter((p) => p.isLeak).flatMap((p) => p.deviations);
    const whiteLeaks = allDeviations.filter((d) => d.playedColor === 'white');
    const blackLeaks = allDeviations.filter((d) => d.playedColor === 'black');

    const whiteRepertoire = getRecommendedWhiteRepertoire();
    const blackRepertoire = getRecommendedBlackRepertoire();

    return {
      playerHandle,
      totalGamesAnalyzed: whiteGames.length + blackGames.length,
      whiteStats: {
        winRate: whiteTally.winRate,
        keyLeaks: whiteLeaks,
        totalGames: whiteGames.length,
        wins: whiteTally.wins,
        losses: whiteTally.losses,
        draws: whiteTally.draws,
        openings: this.buildOpeningStats(whiteGames, 'white'),
      },
      blackStats: {
        winRate: blackTally.winRate,
        keyLeaks: blackLeaks,
        totalGames: blackGames.length,
        wins: blackTally.wins,
        losses: blackTally.losses,
        draws: blackTally.draws,
        openings: this.buildOpeningStats(blackGames, 'black'),
      },
      patterns,
      // Recommendation headlines are reviewed in the repertoire-divergence work
      // (roadmap CL-4); the Black plan will move from a King's Indian to the
      // c6-d5 structures hoot65 already plays.
      recommendedWhiteRepertoire: 'Italian Game & Anti-Scandinavian (2.exd5!)',
      recommendedBlackRepertoire: 'Caro-Kann & King\'s Indian',
      whiteRepertoirePlan: whiteRepertoire,
      blackRepertoirePlan: blackRepertoire,
      generatedAt: Date.now(),
    };
  }
}

/**
 * Top-level convenience function conforming to PROJECT.md § 4.
 */
export function analyzeGames(
  games: StoredGame[] = [],
  playerHandle: 'hoot65' = 'hoot65'
): DiagnosticReport {
  return DiagnosticAnalyzer.analyze(games, playerHandle);
}
