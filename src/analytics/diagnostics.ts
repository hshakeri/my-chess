import { Chess, Square } from 'chess.js';
import { StoredGame } from '../types/db';
import {
  DiagnosticReport,
  OpeningDeviation,
  OpeningStats,
  PatternImpact,
  PatternSummary,
  RepertoireLeak,
  RepertoirePlan,
} from '../types/diagnostics';
import {
  getRecommendedWhiteRepertoire,
  getRecommendedBlackRepertoire,
  buildRepertoireTree,
  fenKey,
  findChildByFen,
  RepertoireNode,
} from './repertoire';
import { CANONICAL_HOOT65_GAMES } from './canonicalGames';

/**
 * Real hoot65 archive games used as test fixtures for the detectors below.
 * They are NOT injected into analysis: the report describes exactly the games
 * it is given (the live IndexedDB archive in the app).
 */
export { CANONICAL_HOOT65_GAMES };

export type PatternId =
  | 'white-scandi-e5'
  | 'black-bg4-chase'
  | 'early-queen-sortie'
  | 'blackburne-shilling-handling'
  | 'mated-while-ahead'
  | 'lost-on-time-while-ahead'
  | 'repertoire-divergence';

/** Patterns measured as a PatternSummary; repertoire divergences are aggregated separately as RepertoireLeaks. */
export type DetectorPatternId = Exclude<PatternId, 'repertoire-divergence'>;

interface PatternMeta {
  id: DetectorPatternId;
  label: string;
  color: 'white' | 'black' | 'both';
  theoryVerdict: 'inferior' | 'neutral';
  description: string;
}

const PATTERN_META: Record<DetectorPatternId, PatternMeta> = {
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
  'blackburne-shilling-handling': {
    id: 'blackburne-shilling-handling',
    label: 'Blackburne-Shilling: 4.Nxe5? instead of 4.Nxd4',
    color: 'white',
    theoryVerdict: 'inferior',
    description:
      'After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 the e5 pawn is bait: 4.Nxe5? Qg5 attacks the e5 knight and g2 at once, and 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3 is checkmate. Take the knight instead: 4.Nxd4 exd4 5.c3 hits the d4 pawn with the knight gone, or play 4.c3 first. Black has moved the same knight twice and left the e5 pawn undefended; the knight on d4, not the pawn, is the piece to take.',
  },
  'mated-while-ahead': {
    id: 'mated-while-ahead',
    label: 'Checkmated while two or more points ahead',
    color: 'both',
    theoryVerdict: 'neutral',
    description:
      'The game ended in checkmate while you were at least two points of material up on the final position. When ahead, the opponent\'s only hope is a direct attack on the king: before every move list the opponent\'s checks and captures, keep an escape square for the king, and trade pieces to take the attackers off the board.',
  },
  'lost-on-time-while-ahead': {
    id: 'lost-on-time-while-ahead',
    label: 'Lost on time while two or more points ahead',
    color: 'both',
    theoryVerdict: 'neutral',
    description:
      'The clock ran out while you were at least two points of material up. A won position on the board scores nothing when the flag falls: once ahead, simplify into a position you can play quickly, move at once when there is only one sensible move, and look at the clock before every move after move 30.',
  },
};

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material balance from `color`'s point of view in pawn units (queen 9, rook 5, minor 3, pawn 1). */
export function materialBalance(chess: Chess, color: 'w' | 'b'): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      total += (piece.color === color ? 1 : -1) * PIECE_VALUES[piece.type];
    }
  }
  return total;
}

/** Replay a SAN list from the start position; `fensBefore[i]` is the position before ply i. Null on an illegal move. */
function replayGame(moves: string[]): { chess: Chess; fensBefore: string[] } | null {
  const chess = new Chess(START_FEN);
  const fensBefore: string[] = [];
  for (const raw of moves) {
    fensBefore.push(chess.fen());
    try {
      chess.move(cleanSan(raw));
    } catch {
      return null;
    }
  }
  return { chess, fensBefore };
}

/** 0-based index of the last ply played by `mover` in a game of `length` plies, or -1. */
function lastPlyOf(length: number, mover: 'w' | 'b'): number {
  const wanted = mover === 'w' ? 0 : 1;
  for (let i = length - 1; i >= 0; i--) if (i % 2 === wanted) return i;
  return -1;
}

function terminationOf(game: StoredGame): string | undefined {
  return game.pgn?.match(/\[Termination "([^"]+)"\]/)?.[1];
}

function opponentOf(game: StoredGame, color: 'white' | 'black'): string {
  return (color === 'white' ? game.black?.name : game.white?.name) || 'Opponent';
}

function pointsText(n: number): string {
  return `${n} point${n === 1 ? '' : 's'} of material`;
}


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
  // No occurrences, or nothing to compare against: there is no honest number to print
  if (impact.gamesWith === 0 || impact.gamesWithout === 0) return 'n/a';
  const delta = (impact.scoreWith - impact.scoreWithout) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} pts`;
}

/** Does a queen on `from` attack `to`: same rank, file or diagonal with nothing in between? */
function queenAttacks(chess: Chess, from: string, to: string): boolean {
  const fx = from.charCodeAt(0) - 97;
  const fy = Number(from[1]) - 1;
  const tx = to.charCodeAt(0) - 97;
  const ty = Number(to[1]) - 1;
  const dx = Math.sign(tx - fx);
  const dy = Math.sign(ty - fy);
  const aligned = fx === tx || fy === ty || Math.abs(tx - fx) === Math.abs(ty - fy);
  if (!aligned || (dx === 0 && dy === 0)) return false;
  let x = fx + dx;
  let y = fy + dy;
  while (x !== tx || y !== ty) {
    if (chess.get(`${String.fromCharCode(97 + x)}${y + 1}` as Square)) return false;
    x += dx;
    y += dy;
  }
  return true;
}

/** True when `san` moves the queen off its starting square: a genuine sortie, not a retreat or regrouping move. */
function queenLeavesHome(chess: Chess, san: string, mover: 'w' | 'b'): boolean {
  const probe = new Chess(chess.fen());
  try {
    const mv = probe.move(san);
    return mv.piece === 'q' && mv.from === (mover === 'w' ? 'd1' : 'd8');
  } catch {
    return false;
  }
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
    let kick: string | null = null; // the White move that first attacked the bishop on g4 (h3, f3, Ne5, ...)
    let sawBh5 = false;
    const blackBishopOn = (sq: Square) => {
      const p = chess.get(sq);
      return !!p && p.color === 'b' && p.type === 'b';
    };
    const looseB7 = (how: string) =>
      `With the bishop gone from c8 the b7 pawn is loose: ${how}. Before ...Bg4 make sure b7 is covered or that ...Qb6/...Qd7 is available.`;

    for (let k = 0; k < window.length; k++) {
      const san = window[k];
      const isWhiteMove = k % 2 === 0; // the ply right after ...Bg4 is White's
      let played;
      try {
        played = chess.move(san);
      } catch {
        return null;
      }

      if (isWhiteMove) {
        if (!kick && blackBishopOn('g4') && chess.isAttacked('g4', 'w')) kick = san;
        if (san === 'g4' && kick && sawBh5 && blackBishopOn('h5')) {
          return `Your bishop was chased: after ${kick} it retreated to h5 and g4 drove it again, costing tempi and leaving it short of squares. Retreat only when the bishop has an exit (...h6 or ...h5 prepared), otherwise take on f3 or go back to d7.`;
        }
        if (played.piece === 'q') {
          // Only a queen that really hits something counts: a pawn on b7 that is undefended with a clear path
          // (or simply taken), or a check that also hits an undefended bishop on g4.
          if (played.to === 'b7' && played.captured === 'p') {
            return looseB7('the queen simply took it with Qxb7');
          }
          const b7 = chess.get('b7');
          if (
            !played.captured &&
            b7 &&
            b7.color === 'b' &&
            b7.type === 'p' &&
            queenAttacks(chess, played.to, 'b7') &&
            !chess.isAttacked('b7', 'b')
          ) {
            return looseB7(`the queen came to ${played.to} hitting b7 (and f7 or the king)`);
          }
          if (
            chess.inCheck() &&
            blackBishopOn('g4') &&
            queenAttacks(chess, played.to, 'g4') &&
            !chess.isAttacked('g4', 'b')
          ) {
            return 'The check also hit your bishop: with the fourth rank open, the queen checked the king and attacked the undefended bishop on g4 at once, so the pin had to be given up with a blocking move (...Bd7, ...Qd7 or ...Nc6). Pin on g4 only when the rank is closed by a pawn on d4 or e4.';
          }
        }
        if (san === 'Qxf3') {
          const batterySquare = (['c4', 'b3', 'a2', 'd5'] as Square[]).find((sq) => {
            const p = chess.get(sq);
            return p && p.color === 'w' && p.type === 'b' && queenAttacks(chess, sq, 'f7');
          });
          if (batterySquare) {
            return `After ...Bxf3 Qxf3 the queen and the ${batterySquare} bishop form a battery against f7. Trading on f3 is only safe when f7 is already covered (...e6, ...Nf6 or ...Qd7).`;
          }
        }
      } else if (san === 'Bh5') {
        sawBh5 = true;
      }
    }

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

      if (turn === mover && san.startsWith('Q') && !san.includes('x') && queenLeavesHome(chess, san, mover)) {
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
   * Blackburne-Shilling handling: as White after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 the
   * player took the bait with 4.Nxe5?. The book move 4.Nxd4 is legal by
   * construction in the position after 3...Nd4.
   */
  public static detectBlackburneShillingHandling(game: StoredGame, moves: string[]): OpeningDeviation | null {
    const prefix = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5'];
    if (moves.length < prefix.length) return null;
    for (let i = 0; i < prefix.length; i++) if (cleanSan(moves[i]) !== prefix[i]) return null;
    return {
      gameId: displayGameId(game),
      gameUrl: gameUrlOf(game),
      gameDate: toDateString(game),
      opponent: game.black?.name || 'Opponent',
      playedColor: 'white',
      ply: 7,
      fen: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      playedSan: 'Nxe5',
      bookSan: 'Nxd4',
      evaluationDelta: '',
      patternId: 'blackburne-shilling-handling',
      description:
        'After 3...Nd4 the e5 pawn is poisoned: 4.Nxe5? Qg5 hits the e5 knight and g2 at the same time, and 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3 is checkmate. 4.Nxd4 exd4 5.c3 removes the knight and attacks the d4 pawn; 4.c3 also works.',
    };
  }

  /**
   * The player was checkmated while at least two points of material up on the
   * final position (chess.js replays the whole game). The deviation points at the
   * player's last move; no single book move is claimed.
   */
  public static detectMatedWhileAhead(game: StoredGame, moves: string[], color: 'white' | 'black'): OpeningDeviation | null {
    if (this.getPlayerResult(game, color) !== 'loss') return null;
    const replay = replayGame(moves);
    if (!replay || !replay.chess.isCheckmate()) return null;
    const mover: 'w' | 'b' = color === 'white' ? 'w' : 'b';
    if (replay.chess.turn() !== mover) return null; // the mated side is the side to move
    const material = materialBalance(replay.chess, mover);
    if (material < 2) return null;
    const last = lastPlyOf(moves.length, mover);
    if (last < 0) return null;
    const moveNo = Math.floor(moves.length / 2) + (moves.length % 2);
    return {
      gameId: displayGameId(game),
      gameUrl: gameUrlOf(game),
      gameDate: toDateString(game),
      opponent: opponentOf(game, color),
      playedColor: color,
      ply: last + 1,
      fen: replay.fensBefore[last],
      playedSan: cleanSan(moves[last]),
      evaluationDelta: '',
      patternId: 'mated-while-ahead',
      description: `You were checkmated on move ${moveNo} while ${pointsText(material)} ahead. In this position, before ${cleanSan(moves[last])}, the opponent's checks and captures needed an answer first: when ahead, every move starts with "what does the opponent threaten against my king?".`,
    };
  }

  /**
   * The player lost on the clock (PGN Termination mentions time) while at least
   * two points of material up on the final position.
   */
  public static detectLostOnTimeWhileAhead(game: StoredGame, moves: string[], color: 'white' | 'black'): OpeningDeviation | null {
    if (this.getPlayerResult(game, color) !== 'loss') return null;
    const termination = terminationOf(game);
    if (!termination || !/time/i.test(termination)) return null;
    const replay = replayGame(moves);
    if (!replay) return null;
    const mover: 'w' | 'b' = color === 'white' ? 'w' : 'b';
    const material = materialBalance(replay.chess, mover);
    if (material < 2) return null;
    const last = lastPlyOf(moves.length, mover);
    if (last < 0) return null;
    const moveNo = Math.floor(last / 2) + 1;
    return {
      gameId: displayGameId(game),
      gameUrl: gameUrlOf(game),
      gameDate: toDateString(game),
      opponent: opponentOf(game, color),
      playedColor: color,
      ply: last + 1,
      fen: replay.fensBefore[last],
      playedSan: cleanSan(moves[last]),
      evaluationDelta: '',
      patternId: 'lost-on-time-while-ahead',
      description: `The flag fell after your move ${moveNo} with ${pointsText(material)} on the board in your favour. A won position scores nothing on time: once ahead, trade down, play the obvious move at once, and check the clock before every move.`,
    };
  }

  /**
   * Walk the game down the repertoire tree (positions matched by their first
   * four FEN fields, so transpositions count). Stop at the first move not in
   * the tree: when it is the player's, report it with the tree's move as
   * `bookSan`; when it is the opponent's, or the plan simply ends, it is not a leak.
   */
  public static detectRepertoireDivergence(
    game: StoredGame,
    tree: RepertoireNode,
    color: 'white' | 'black',
    opts: { lineNames?: Record<string, string> } = {}
  ): OpeningDeviation | null {
    const moves = game.movesSan || [];
    const mover: 'w' | 'b' = color === 'white' ? 'w' : 'b';
    const chess = new Chess(tree.fen);
    let node = tree;

    for (let i = 0; i < moves.length; i++) {
      if (node.children.length === 0) return null; // the plan ends here
      const fenBefore = chess.fen();
      const turn = chess.turn();
      let played;
      try {
        played = chess.move(cleanSan(moves[i]));
      } catch {
        return null; // corrupted move list
      }
      const next = findChildByFen(node, chess.fen());
      if (next) {
        node = next;
        continue;
      }
      if (turn !== mover) return null; // the opponent left the plan

      const book = node.children.find((c) => c.isStudentMove) || node.children[0];
      const lineId = book.lineIds[0] || node.lineIds[0] || '';
      const lineName = opts.lineNames?.[lineId] || lineId;
      const moveNo = Math.floor(i / 2) + 1;
      const label = turn === 'w' ? `${moveNo}.${played.san}` : `${moveNo}...${played.san}`;
      const bookLabel = turn === 'w' ? `${moveNo}.${book.san}` : `${moveNo}...${book.san}`;
      return {
        gameId: displayGameId(game),
        gameUrl: gameUrlOf(game),
        gameDate: toDateString(game),
        opponent: opponentOf(game, color),
        playedColor: color,
        ply: i + 1,
        fen: fenBefore,
        playedSan: played.san,
        bookSan: book.san,
        evaluationDelta: '',
        patternId: 'repertoire-divergence',
        lineName,
        description: `You left the ${lineName} with ${label}; the plan is ${bookLabel}.${book.annotation ? ` ${book.annotation}` : ''}`,
      };
    }
    return null;
  }

  /**
   * Aggregate one divergence per game into leaks keyed by (position, played move),
   * scored against the player's other games of the same colour, and sorted by
   * games x score deficit, then by games.
   */
  private static aggregateRepertoireLeaks(
    entries: Array<{ game: StoredGame; deviation: OpeningDeviation }>,
    gamesByColor: Record<'white' | 'black', StoredGame[]>,
    handle: string
  ): RepertoireLeak[] {
    const groups = new Map<string, Array<{ game: StoredGame; deviation: OpeningDeviation }>>();
    for (const entry of entries) {
      const key = `${entry.deviation.playedColor}|${fenKey(entry.deviation.fen)}|${entry.deviation.playedSan}`;
      const list = groups.get(key) || [];
      list.push(entry);
      groups.set(key, list);
    }

    const leaks: RepertoireLeak[] = [];
    for (const list of groups.values()) {
      const first = list[0].deviation;
      const ids = new Set(list.map((e) => e.game.id));
      const withGames = list.map((e) => e.game);
      const otherGames = gamesByColor[first.playedColor].filter((g) => !ids.has(g.id));
      const impact: PatternImpact = {
        gamesWith: withGames.length,
        scoreWith: scoreOf(withGames, handle),
        gamesWithout: otherGames.length,
        scoreWithout: scoreOf(otherGames, handle),
      };
      const deltaText = formatImpact(impact);
      const deviations = list
        .map((e) => ({ ...e.deviation, impact, evaluationDelta: deltaText }))
        .sort((a, b) => (b.gameDate || '').localeCompare(a.gameDate || ''));
      leaks.push({
        fenKey: fenKey(first.fen),
        fen: first.fen,
        playedSan: first.playedSan,
        bookSan: first.bookSan || '',
        lineName: first.lineName || '',
        color: first.playedColor,
        games: withGames.length,
        score: impact.scoreWith,
        scoreOther: impact.scoreWithout,
        deviations,
      });
    }

    const deficit = (l: RepertoireLeak) => l.games * Math.max(0, l.scoreOther - l.score);
    leaks.sort((a, b) => deficit(b) - deficit(a) || b.games - a.games);
    return leaks;
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

    const whiteRepertoire = getRecommendedWhiteRepertoire();
    const blackRepertoire = getRecommendedBlackRepertoire();
    const whiteTree = buildRepertoireTree(whiteRepertoire);
    const blackTree = buildRepertoireTree(blackRepertoire);
    const lineNames: Record<string, string> = {};
    for (const plan of [whiteRepertoire, blackRepertoire] as RepertoirePlan[]) {
      for (const line of plan.lines) lineNames[line.id] = line.name;
    }

    // Run detectors
    const patternDeviations = {} as Record<DetectorPatternId, OpeningDeviation[]>;
    const patternGameIds = {} as Record<DetectorPatternId, Set<string>>;
    for (const id of Object.keys(PATTERN_META) as DetectorPatternId[]) {
      patternDeviations[id] = [];
      patternGameIds[id] = new Set();
    }
    const record = (id: DetectorPatternId, g: StoredGame, dev: OpeningDeviation | null) => {
      if (!dev) return;
      patternDeviations[id].push(dev);
      patternGameIds[id].add(g.id);
    };
    const divergences: Array<{ game: StoredGame; deviation: OpeningDeviation }> = [];

    for (const g of whiteGames) {
      const moves = g.movesSan || [];
      record('white-scandi-e5', g, this.detectWhiteScandinavianLeak(g, moves));
      record('early-queen-sortie', g, this.detectEarlyQueenSortie(g, moves, 'white'));
      record('blackburne-shilling-handling', g, this.detectBlackburneShillingHandling(g, moves));
      record('mated-while-ahead', g, this.detectMatedWhileAhead(g, moves, 'white'));
      record('lost-on-time-while-ahead', g, this.detectLostOnTimeWhileAhead(g, moves, 'white'));
      const divergence = this.detectRepertoireDivergence(g, whiteTree, 'white', { lineNames });
      if (divergence) divergences.push({ game: g, deviation: divergence });
    }
    for (const g of blackGames) {
      const moves = g.movesSan || [];
      record('black-bg4-chase', g, this.detectBlackBg4ChaseLeak(g, moves));
      record('early-queen-sortie', g, this.detectEarlyQueenSortie(g, moves, 'black'));
      record('mated-while-ahead', g, this.detectMatedWhileAhead(g, moves, 'black'));
      record('lost-on-time-while-ahead', g, this.detectLostOnTimeWhileAhead(g, moves, 'black'));
      const divergence = this.detectRepertoireDivergence(g, blackTree, 'black', { lineNames });
      if (divergence) divergences.push({ game: g, deviation: divergence });
    }

    const repertoireLeaks = this.aggregateRepertoireLeaks(
      divergences,
      { white: whiteGames, black: blackGames },
      playerHandle
    );

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
      const measuredCost = impact.gamesWith > 0 && impact.gamesWithout > 0 && impact.scoreWith < impact.scoreWithout;
      const isLeak = impact.gamesWith > 0 && (meta.theoryVerdict === 'inferior' || measuredCost);
      patterns.push({ ...meta, isLeak, impact, deviations });
    }

    // Key leaks: patterns theory calls inferior, plus neutral patterns that
    // measurably cost points in this player's own games.
    const allDeviations = patterns.filter((p) => p.isLeak).flatMap((p) => p.deviations);
    const whiteLeaks = allDeviations.filter((d) => d.playedColor === 'white');
    const blackLeaks = allDeviations.filter((d) => d.playedColor === 'black');

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
      repertoireLeaks,
      // The headlines are the plans' own names, so the view and the plan cannot drift apart
      recommendedWhiteRepertoire: whiteRepertoire.name,
      recommendedBlackRepertoire: blackRepertoire.name,
      whiteRepertoirePlan: whiteRepertoire,
      blackRepertoirePlan: blackRepertoire,
      generatedAt: Date.now(),
    };
  }
}

/**
 * First divergence of a game from a repertoire tree; see
 * DiagnosticAnalyzer.detectRepertoireDivergence.
 */
export function detectRepertoireDivergence(
  game: StoredGame,
  tree: RepertoireNode,
  color: 'white' | 'black',
  opts: { lineNames?: Record<string, string> } = {}
): OpeningDeviation | null {
  return DiagnosticAnalyzer.detectRepertoireDivergence(game, tree, color, opts);
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
