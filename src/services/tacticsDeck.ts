import deckData from '../data/tactics_deck.json';
import { isTacticMastered } from '../curriculum/itemCodes';

/**
 * The tactics deck (DC-2), Woodpecker style: positions from hoot65's own games right after a blunder,
 * by either player, where the side to move has one clearly winning move (Stockfish 19; the build is
 * in `scripts/game-analysis/tactics.mjs`), and a few quiet control positions where nothing is to be
 * won and the right answer is any of several solid moves (`tactics-quiet.mjs`), so the deck does not
 * teach that there is always a tactic, and keep-the-lead positions where hoot65 was ahead and any of
 * several safe moves keeps the win (`tactics-lead.mjs`). A position is graded by the time to the right move: under
 * five seconds Good, up to twenty Hard, slower or wrong Again. A session takes the Again ones first,
 * then the Hard ones, then new ones, then the Good ones seen longest ago, mixing the motifs; a
 * position retires after three Good solves in a row. Kept in this browser.
 */

export type TacticMotif = 'mate-in-one' | 'mate' | 'free-piece' | 'fork' | 'check' | 'promotion' | 'other' | 'quiet' | 'lead';

export const MOTIF_LABEL: Record<TacticMotif, string> = {
  'mate-in-one': 'Mate in one',
  mate: 'A forced mate',
  'free-piece': 'A piece to take',
  fork: 'A fork',
  check: 'A check that wins material',
  promotion: 'A promotion',
  other: 'A winning combination',
  quiet: 'Nothing to win: a solid move',
  lead: 'Ahead: a safe move keeps it',
};

export interface TacticPosition {
  id: string;
  fen: string;
  /** The move that had just been played, the blunder. */
  lastMove: { from: string; to: string; san: string };
  /** Stockfish's best move; `accepted` adds the others that win about as much (every mate, when it mates). */
  solution: string;
  accepted: string[];
  /** Stockfish's line from the solution on, a few plies. */
  line: string[];
  motif: TacticMotif;
  mateIn: number | null;
  date: string;
  /** Whether hoot65 is the side to move (the opponent had blundered), and the move played in the game. */
  ownSide: boolean;
  played: string;
  /** The position two plies earlier and the two moves that led here, for the "two moves ahead" sheet. */
  before?: { fen: string; moves: string[] };
  /** How often players of the game's ratings play the winning move, by Maia (null when unknown, and for quiet positions). */
  share?: number | null;
  game?: string;
}

export const tacticsDeck = deckData as TacticPosition[];

/** The deck less the positions on the mastered list (src/data/mastered.json): what the app practises and prints. */
export const practiceDeck = tacticsDeck.filter((t) => !isTacticMastered(t.id));

export const TACTICS_STORAGE_KEY = 'my_chess_tactics_v1';
export const GOOD_MS = 5_000;
export const HARD_MS = 20_000;
export const RETIRE_STREAK = 3;
export const SESSION_SIZE = 10;

export type TacticGrade = 'good' | 'hard' | 'again';

export interface TacticState {
  tries: number;
  /** Good solves in a row. */
  streak: number;
  grade: TacticGrade;
  at: number;
  bestMs?: number;
}

export function gradeSolve(correct: boolean, ms: number): TacticGrade {
  if (!correct || ms > HARD_MS) return 'again';
  return ms < GOOD_MS ? 'good' : 'hard';
}

export const isRetired = (state?: TacticState) => (state?.streak ?? 0) >= RETIRE_STREAK;

export function readTacticStates(): Record<string, TacticState> {
  try {
    const raw = window.localStorage.getItem(TACTICS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** The states with one more solve of `id`, also written to this browser. */
export function recordSolve(states: Record<string, TacticState>, id: string, correct: boolean, ms: number, now = Date.now()): Record<string, TacticState> {
  const grade = gradeSolve(correct, ms);
  const old = states[id];
  const next: TacticState = {
    tries: (old?.tries ?? 0) + 1,
    streak: grade === 'good' ? (old?.streak ?? 0) + 1 : 0,
    grade,
    at: now,
    bestMs: correct ? Math.min(old?.bestMs ?? Infinity, ms) : old?.bestMs,
  };
  const all = { ...states, [id]: next };
  try {
    window.localStorage.setItem(TACTICS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // the session still runs; it is just not kept
  }
  return all;
}

export const TACTICS_LOG_KEY = 'my_chess_tactics_log_v1';

/** One finished session: how many positions, by grade, and the time on them. */
export interface TacticSession {
  at: number;
  good: number;
  hard: number;
  again: number;
  ms: number;
}

export function readTacticSessions(): TacticSession[] {
  try {
    const raw = window.localStorage.getItem(TACTICS_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Keep a finished session (the newest 200). */
export function logTacticSession(session: TacticSession): TacticSession[] {
  const all = [...readTacticSessions(), session].slice(-200);
  try {
    window.localStorage.setItem(TACTICS_LOG_KEY, JSON.stringify(all));
  } catch {
    // shown, just not kept
  }
  return all;
}

/** Positions where several moves are right and the game move gave something away: no single winning move to find. */
export const isControl = (t: TacticPosition) => t.motif === 'quiet' || t.motif === 'lead';

/** A win with hoot65 to move that hoot65 did not play in the game. */
export const missedInGame = (t: TacticPosition) => t.ownSide && !isControl(t) && t.played !== t.solution && !t.accepted.includes(t.played);

/** Positions last graded Again or Hard, and not retired: the ones a session takes first. */
export function toRedo(deck: TacticPosition[], states: Record<string, TacticState>): number {
  return deck.filter((t) => states[t.id] && states[t.id].grade !== 'good').length;
}

export interface TacticsProgress {
  deck: number;
  seen: number;
  retired: number;
  redo: number;
  sessions: number;
  /** Mean seconds a position in the first and in the last session (null before any). */
  firstSeconds: number | null;
  lastSeconds: number | null;
}

export function tacticsProgress(deck: TacticPosition[], states: Record<string, TacticState>, sessions: TacticSession[]): TacticsProgress {
  const perPosition = (x: TacticSession) => x.ms / 1000 / Math.max(1, x.good + x.hard + x.again);
  return {
    deck: deck.length,
    seen: deck.filter((t) => states[t.id]).length,
    retired: deck.filter((t) => isRetired(states[t.id])).length,
    redo: toRedo(deck, states),
    sessions: sessions.length,
    firstSeconds: sessions.length ? perPosition(sessions[0]) : null,
    lastSeconds: sessions.length ? perPosition(sessions[sessions.length - 1]) : null,
  };
}

/** The same positions with no two neighbours of one motif where that can be helped. */
export function interleave(items: TacticPosition[]): TacticPosition[] {
  const left = [...items];
  const out: TacticPosition[] = [];
  while (left.length) {
    const prev = out[out.length - 1]?.motif;
    const k = left.findIndex((t) => t.motif !== prev);
    out.push(...left.splice(k < 0 ? 0 : k, 1));
  }
  return out;
}

/** The next session: Again first, then Hard, then new ones in deck order, then Good, the oldest first; never a retired one. */
export function pickSession(deck: TacticPosition[], states: Record<string, TacticState>, size = SESSION_SIZE): TacticPosition[] {
  const rank = (t: TacticPosition) => {
    const s = states[t.id];
    if (!s) return 2;
    return s.grade === 'again' ? 0 : s.grade === 'hard' ? 1 : 3;
  };
  const live = deck.map((t, i) => ({ t, i })).filter(({ t }) => !isRetired(states[t.id]));
  live.sort((a, b) => rank(a.t) - rank(b.t) || (states[a.t.id]?.at ?? 0) - (states[b.t.id]?.at ?? 0) || a.i - b.i);
  return interleave(live.slice(0, size).map(({ t }) => t));
}

/** "27...Qf6#" style labels for a line starting in `fen`. */
export function numberLine(fen: string, sans: string[]): string {
  const [, turn, , , , full] = fen.split(' ');
  let n = Number(full);
  let white = turn === 'w';
  return sans
    .map((san, k) => {
      const label = white ? `${n}.${san}` : k === 0 ? `${n}...${san}` : san;
      if (!white) n++;
      white = !white;
      return label;
    })
    .join(' ');
}
