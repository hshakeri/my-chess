import { clocksFromPgn, timeControlFromPgn } from './review';
import { finalFen, leadInFen } from './finalPosition';
import type { StoredGame } from '../types/db';

/**
 * Your clock (DC-3), from the clock times in the PGNs ([%clk]) at the time control played most: how
 * often hoot65 and the opponents lose on time, the games hoot65 lost on time while ahead in material,
 * the clock left after moves 10, 20, 30 and 40 against the opponent's in the same games, the seconds
 * a move in the opening and the middlegame, and how many moves a game take longer than 30 seconds.
 *
 * The opponents are players of hoot65's rating in the same games, and they seldom lose on time, so
 * their pace is a fair target. Only games with a clock time for every move are counted.
 */

/** A move that takes longer than this many seconds is a long think (the archive analysis caps a think at 30 s). */
export const LONG_THINK_S = 30;
export const PACE_MOVES = [10, 20, 30, 40];
/** A lead of at least this much material at the end (a knight or a bishop) counts as ahead. */
export const AHEAD_POINTS = 3;


export interface PaceRow {
  /** The move number: hoot65's clock after their move N against the opponent's after theirs. */
  move: number;
  /** Games that reached it. */
  games: number;
  /** Median seconds left. */
  mine: number;
  theirs: number;
}

export interface TimeLoss {
  gameId: string;
  url?: string;
  date: string;
  opponent: string;
  /** hoot65's material lead in the final position, in points (pawn 1, knight and bishop 3, rook 5, queen 9). */
  lead: number;
  /** hoot65's moves in the game. */
  moves: number;
}

export interface ClockSummary {
  base: number;
  increment: number;
  /** "10+0". */
  label: string;
  /** Games at this time control with a clock time for every move. */
  games: number;
  lostOnTime: number;
  wonOnTime: number;
  /** Games hoot65 lost on time with a lead of AHEAD_POINTS or more on the board, newest first. */
  lostAhead: TimeLoss[];
  pace: PaceRow[];
  /** Mean seconds a move, moves 1-10 and moves 11-30. */
  perMove: { opening: { mine: number; theirs: number }; middlegame: { mine: number; theirs: number } };
  /** Moves longer than LONG_THINK_S, per game. */
  longThinks: { mine: number; theirs: number };
}

/** Who lost the game on time: hoot65 ('me'), the opponent ('them'), or neither (null). */
export function timeLoser(game: StoredGame): 'me' | 'them' | null {
  if (!game.userColor) return null;
  const term = /\[Termination "([^"]+)"\]/.exec(game.pgn ?? '')?.[1] ?? '';
  const mine = (game.userColor === 'white' ? game.white.name : game.black.name).toLowerCase();
  const winner = /^(.+) won on time$/i.exec(term)?.[1];
  if (winner) return winner.toLowerCase() === mine ? 'them' : 'me';
  if (/time forfeit/i.test(term)) return game.userResult === 'loss' ? 'me' : game.userResult === 'win' ? 'them' : null;
  return null;
}

/** hoot65's material lead in the game's final position, or null when the moves do not replay. */
export function finalLead(game: StoredGame): number | null {
  const fen = finalFen(game);
  return fen ? leadInFen(fen, game.userColor === 'black' ? 'b' : 'w') : null;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

interface Timed {
  game: StoredGame;
  clocks: number[];
  base: number;
  increment: number;
}

export function summarizeClock(games: StoredGame[]): ClockSummary | null {
  const byControl = new Map<string, Timed[]>();
  for (const game of games) {
    if (!game.userColor || game.movesSan.length < 2) continue;
    const tc = timeControlFromPgn(game.pgn);
    const clocks = clocksFromPgn(game.pgn);
    if (!tc || clocks.length !== game.movesSan.length) continue;
    const key = `${tc.base}+${tc.increment}`;
    byControl.set(key, [...(byControl.get(key) ?? []), { game, clocks, ...tc }]);
  }
  const timed = [...byControl.values()].sort((a, b) => b.length - a.length)[0];
  if (!timed) return null;
  const { base, increment } = timed[0];

  const spent = { opening: [[], []] as number[][], middlegame: [[], []] as number[][] };
  const long = [0, 0];
  const left = new Map<number, number[][]>(PACE_MOVES.map((m) => [m, [[], []]]));
  const lostAhead: TimeLoss[] = [];
  let lostOnTime = 0;
  let wonOnTime = 0;

  for (const { game, clocks } of timed) {
    const me = game.userColor === 'white' ? 0 : 1;
    clocks.forEach((clock, ply) => {
      const who = ply % 2 === me ? 0 : 1;
      // The clock after a move already has the increment added, from the first move on
      const used = Math.max(0, (ply >= 2 ? clocks[ply - 2] : base) + increment - clock);
      const moveNo = Math.floor(ply / 2) + 1;
      if (moveNo <= 10) spent.opening[who].push(used);
      else if (moveNo <= 30) spent.middlegame[who].push(used);
      if (used > LONG_THINK_S) long[who]++;
    });
    for (const move of PACE_MOVES) {
      const mine = 2 * (move - 1) + me;
      const theirs = 2 * (move - 1) + 1 - me;
      if (Math.max(mine, theirs) >= clocks.length) continue;
      left.get(move)![0].push(clocks[mine]);
      left.get(move)![1].push(clocks[theirs]);
    }
    const loser = timeLoser(game);
    if (loser === 'them') wonOnTime++;
    if (loser === 'me') {
      lostOnTime++;
      const lead = finalLead(game);
      if (lead !== null && lead >= AHEAD_POINTS) {
        lostAhead.push({
          gameId: game.id,
          url: game.url,
          date: new Date(game.timestamp).toISOString().slice(0, 10),
          opponent: me === 0 ? game.black.name : game.white.name,
          lead,
          moves: Math.ceil((game.movesSan.length - me) / 2),
        });
      }
    }
  }

  const n = timed.length;
  return {
    base,
    increment,
    label: `${Math.round(base / 60)}+${increment}`,
    games: n,
    lostOnTime,
    wonOnTime,
    lostAhead: lostAhead.sort((a, b) => b.date.localeCompare(a.date)),
    pace: PACE_MOVES.map((move) => {
      const [mine, theirs] = left.get(move)!;
      return { move, games: mine.length, mine: mine.length ? median(mine) : 0, theirs: theirs.length ? median(theirs) : 0 };
    }).filter((row) => row.games > 0),
    perMove: {
      opening: { mine: mean(spent.opening[0]), theirs: mean(spent.opening[1]) },
      middlegame: { mine: mean(spent.middlegame[0]), theirs: mean(spent.middlegame[1]) },
    },
    longThinks: { mine: long[0] / n, theirs: long[1] / n },
  };
}
