import { Chess } from 'chess.js';
import { finalLead } from './clock';
import { finalFen } from './finalPosition';
import type { StoredGame } from '../types/db';

/**
 * How hoot65's games end (DC-3, DC-8): every game by result and by the way it ended, read from the
 * PGN's Termination header (Chess.com words it "X won by resignation", "Game drawn by stalemate"), or
 * from the final position when the header does not say (Lichess writes "Normal" for a mate and a
 * resignation alike). Two lists come with it: the games hoot65 resigned with less than a rook's
 * worth of material down (leaving out the positions where mate in one was coming), and the
 * stalemates hoot65 gave while ahead.
 *
 * The archive analysis puts "do not resign unless a rook or more down" at 1.7 points per 100 games,
 * since opponents of hoot65's rating still go wrong in those positions.
 */

export type EndKind = 'checkmate' | 'resignation' | 'time' | 'abandoned' | 'stalemate' | 'agreement' | 'repetition' | 'insufficient' | 'fifty_moves' | 'other';

export const END_LABEL: Record<EndKind, string> = {
  checkmate: 'Checkmate',
  resignation: 'Resignation',
  time: 'On time',
  abandoned: 'Abandoned',
  stalemate: 'Stalemate',
  agreement: 'Agreement',
  repetition: 'Repetition',
  insufficient: 'Insufficient material',
  fifty_moves: '50-move rule',
  other: 'Other',
};

/** Material down at the resignation, in points, below which the game counts as resigned too soon: a rook. */
export const ROOK_POINTS = 5;

/**
 * Whether mate in one is coming in the game's final position: the opponent, to move, has a mate in
 * one, or hoot65, to move, has no move that stops one. Resigning there is not resigning too soon.
 */
const mateCache = new Map<string, boolean>();

export function mateInOneComing(game: StoredGame): boolean {
  const key = `${game.id}:${game.movesSan.length}`;
  const hit = mateCache.get(key);
  if (hit !== undefined) return hit;
  const coming = mateInOneComingAt(game);
  mateCache.set(key, coming);
  return coming;
}

function mateInOneComingAt(game: StoredGame): boolean {
  const fen = finalFen(game);
  if (!fen) return false;
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return false;
  }
  const mine = game.userColor === 'black' ? 'b' : 'w';
  // chess.js writes a mating move's SAN with "#"
  const opponentMates = (c: Chess) => c.moves().some((san) => san.endsWith('#'));
  if (chess.turn() !== mine) return opponentMates(chess);
  // hoot65 to move: with no mate in one threatened (the opponent mates nothing if hoot65 could pass),
  // some move stops it, so the two-ply search is only for the positions with a threat
  if (!chess.inCheck()) {
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-';
    try {
      if (!opponentMates(new Chess(parts.join(' ')))) return false;
    } catch {
      // an illegal position after the pass: fall through to the full search
    }
  }
  return chess.moves().every((san) => {
    chess.move(san);
    const mate = opponentMates(chess);
    chess.undo();
    return mate;
  });
}

export interface GameEnd {
  result: 'win' | 'loss' | 'draw';
  kind: EndKind;
}

export function endOf(game: StoredGame): GameEnd | null {
  if (!game.userResult || game.userResult === '*') return null;
  const result = game.userResult;
  const header = (/\[Termination "([^"]+)"\]/.exec(game.pgn ?? '')?.[1] ?? '').toLowerCase();
  // Chess.com writes "<winner> won by resignation" or "Game drawn by repetition": read only the way it
  // ended, so a player named "resign4life" or "CheckmateKid" does not count
  const term = /\bwon (.*)$/.exec(header)?.[1] ?? /\bdrawn (.*)$/.exec(header)?.[1] ?? header;
  const kinds: Array<[RegExp, EndKind]> = [
    [/checkmate/, 'checkmate'],
    [/resign/, 'resignation'],
    [/insufficient/, 'insufficient'],
    [/on time|time forfeit|timeout/, 'time'],
    [/abandon/, 'abandoned'],
    [/stalemate/, 'stalemate'],
    [/agree/, 'agreement'],
    [/repetition/, 'repetition'],
    [/50|fifty/, 'fifty_moves'],
  ];
  for (const [re, kind] of kinds) if (re.test(term)) return { result, kind };
  // No telling header: read the final position
  const fen = finalFen(game);
  let chess: Chess;
  try {
    chess = new Chess(fen ?? undefined);
    if (!fen) return { result, kind: 'other' };
  } catch {
    return { result, kind: 'other' };
  }
  if (chess.isCheckmate()) return { result, kind: 'checkmate' };
  if (chess.isStalemate()) return { result, kind: 'stalemate' };
  if (result !== 'draw') return { result, kind: 'resignation' };
  if (chess.isInsufficientMaterial()) return { result, kind: 'insufficient' };
  // A repetition needs the moves before: from the final position alone it is not seen
  return { result, kind: 'other' };
}

export interface EndedGame {
  game: StoredGame;
  date: string;
  opponent: string;
  /** hoot65's material lead in the final position (negative: down). */
  lead: number;
  /** hoot65's moves in the game. */
  moves: number;
}

export interface EndingsSummary {
  games: number;
  /** Games by result and way of ending, the most frequent first within each result. */
  rows: Array<GameEnd & { count: number }>;
  resigned: number;
  /** Resigned with less than ROOK_POINTS of material down and no mate in one coming, newest first. */
  resignedEarly: EndedGame[];
  /** Stalemates hoot65 gave (made the last move) while ahead in material, newest first. */
  stalematedAhead: EndedGame[];
}

function ended(game: StoredGame): EndedGame {
  const me = game.userColor === 'black' ? 1 : 0;
  return {
    game,
    date: new Date(game.timestamp).toISOString().slice(0, 10),
    opponent: me === 0 ? game.black.name : game.white.name,
    lead: finalLead(game) ?? 0,
    moves: Math.ceil((game.movesSan.length - me) / 2),
  };
}

export function summarizeEndings(games: StoredGame[]): EndingsSummary {
  const counts = new Map<string, GameEnd & { count: number }>();
  const resignedEarly: EndedGame[] = [];
  const stalematedAhead: EndedGame[] = [];
  let n = 0;
  let resigned = 0;
  for (const game of games) {
    if (!game.userColor) continue;
    const end = endOf(game);
    if (!end) continue;
    n++;
    const key = `${end.result}|${end.kind}`;
    counts.set(key, { ...end, count: (counts.get(key)?.count ?? 0) + 1 });
    if (end.result === 'loss' && end.kind === 'resignation') {
      resigned++;
      const e = ended(game);
      if (finalLead(game) !== null && e.lead > -ROOK_POINTS && !mateInOneComing(game)) resignedEarly.push(e);
    }
    if (end.kind === 'stalemate') {
      const e = ended(game);
      // hoot65 made the last move when the number of plies matches their colour (White moves on odd counts)
      const lastByMe = (game.movesSan.length % 2 === 1) === (game.userColor === 'white');
      if (lastByMe && e.lead > 0) stalematedAhead.push(e);
    }
  }
  const order: GameEnd['result'][] = ['win', 'loss', 'draw'];
  const newestFirst = (a: EndedGame, b: EndedGame) => b.game.timestamp - a.game.timestamp;
  return {
    games: n,
    rows: [...counts.values()].sort((a, b) => order.indexOf(a.result) - order.indexOf(b.result) || b.count - a.count),
    resigned,
    resignedEarly: resignedEarly.sort(newestFirst),
    stalematedAhead: stalematedAhead.sort(newestFirst),
  };
}
