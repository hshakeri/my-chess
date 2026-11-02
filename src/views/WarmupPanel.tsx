import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from '../components/Chessboard';
import { BoardQuestion, isRight, questionSquareStyles, type QuestionAnswer, type QuestionStatus } from '../components/BoardQuestion';
import { enPrise, withinNodes } from '../analytics/errorTaxonomy';
import { isMoveSafe, knightSquares, opponentChecks, type MicroQuestion, type QuestionKind } from '../services/microQuestions';
import { cctStats, logCct, readCctLog } from '../services/cctLog';
import { gamesRepo } from '../db/gamesRepo';
import { RulesEngine } from '../engine/rules';
import { labelAt, moveLabel } from '../analytics/review';
import { gameDrillData, type GameDrill } from '../curriculum/gameDrills';
import type { Square } from '../types/chess';
import type { StoredGame } from '../types/db';
import seedGamesRaw from '../data/seed_hoot65_games.json';

/** The warm-up's length; the question on the board when it runs out is finished first. */
export const WARMUP_MS = 120_000;
const WARMUP_KINDS: QuestionKind[] = ['knight', 'loose', 'safe', 'checks'];
/** Weight of a kind not answered yet: about a slow answer, so every kind comes up early. */
const UNSEEN_MS = 8000;
/** Search nodes "Was it safe?" may take, about a fifth of a second: a position busier than that gets another question. */
export const SAFE_NODES = 2000;

interface WarmupItem {
  fen: string;
  orientation: 'w' | 'b';
  question: MicroQuestion;
}

/** A position from one of the student's games with the student to move, and the move played there. */
function pickPosition(games: StoredGame[], random: () => number): { fen: string; color: 'w' | 'b'; played: string; ply: number } | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    const game = games[Math.floor(random() * games.length)];
    if (!game || game.movesSan.length < 14) continue;
    const color: 'w' | 'b' = game.userColor === 'black' ? 'b' : 'w';
    const last = Math.min(game.movesSan.length - 1, 60);
    const plies: number[] = [];
    for (let ply = 10; ply <= last; ply++) if ((ply % 2 === 0 ? 'w' : 'b') === color) plies.push(ply);
    if (!plies.length) continue;
    const ply = plies[Math.floor(random() * plies.length)];
    const chess = new Chess();
    try {
      for (const san of game.movesSan.slice(0, ply)) chess.move(san);
    } catch {
      continue;
    }
    return { fen: chess.fen(), color, played: game.movesSan[ply], ply };
  }
  return null;
}

const PIECE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/**
 * Moves of the student's that were not safe: the threat and mate drill sets (an attacked piece left
 * where it was, a move that allowed mate), each refutation checked by chess.js where the drills are
 * built. Half of the "Was it safe?" questions come from these: most moves played are safe, so on
 * random positions alone "Yes" would nearly always be right.
 */
export const UNSAFE_DRILLS: GameDrill[] = [...gameDrillData.threat, ...(gameDrillData.mate ?? [])];

/** A "Was it safe?" question on one of UNSAFE_DRILLS, the answer No, with the reply that punishes the move. */
export function unsafeItem(random: () => number): WarmupItem | null {
  const d = UNSAFE_DRILLS[Math.floor(random() * UNSAFE_DRILLS.length)];
  if (!d?.refutation) return null;
  const chess = new Chess(d.fenBefore);
  chess.move(d.lastSan);
  const fen = chess.fen();
  const after = new Chess(fen);
  const played = after.move(d.played);
  const taken = after.get(new Chess(after.fen()).move(d.refutation).to as Square);
  const reply = after.move(d.refutation);
  const reason = reply.san.endsWith('#')
    ? `After ${played.san} the opponent mates with ${reply.san}.`
    : `After ${played.san}, ${reply.san} takes the ${PIECE[taken?.type ?? 'p']} on ${reply.to}.`;
  return {
    fen,
    orientation: d.color === 'black' ? 'b' : 'w',
    question: { kind: 'safe', prompt: `In this game you played ${labelAt(fen, played.san)} here. Was it safe?`, answer: false, move: played.san, reason },
  };
}

/** The kind to ask next: the slower the student answers a kind, the more often it comes up. */
function pickKind(random: () => number): QuestionKind {
  const stats = cctStats(readCctLog().filter((e) => e.source === 'warmup'));
  const weights = WARMUP_KINDS.map((k) => Math.max(1000, stats[k]?.meanMs ?? UNSEEN_MS));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (const [i, w] of weights.entries()) {
    r -= w;
    if (r <= 0) return WARMUP_KINDS[i];
  }
  return WARMUP_KINDS[WARMUP_KINDS.length - 1];
}

/** One warm-up question on a position from the student's games. */
export function makeWarmupItem(games: StoredGame[], random: () => number = Math.random): WarmupItem | null {
  const position = pickPosition(games, random);
  if (!position) return null;
  const { fen, color, played, ply } = position;
  const chess = new Chess(fen);
  const preferred = pickKind(random);
  for (const kind of [preferred, ...WARMUP_KINDS.filter((k) => k !== preferred)]) {
    if (kind === 'knight') {
      const knights = chess.board().flat().filter((p) => p && p.color === color && p.type === 'n');
      if (!knights.length) continue;
      const knight = knights[Math.floor(random() * knights.length)]!;
      return {
        fen,
        orientation: color,
        question: { kind: 'knight', prompt: `Click every square the knight on ${knight.square} attacks, then Done.`, answer: knightSquares(knight.square), focus: [knight.square] },
      };
    }
    if (kind === 'checks') {
      // Counting the opponent's checks is the habit behind "Does your move allow mate?"
      if (chess.inCheck()) continue;
      const checks = opponentChecks(fen);
      return {
        fen,
        orientation: color,
        question: {
          kind: 'checks',
          prompt: 'If it were your opponent\'s turn, how many checks would they have? Count every one, captures included.',
          answer: checks.length,
          checks,
        },
      };
    }
    if (kind === 'loose') {
      return {
        fen,
        orientation: color,
        question: {
          kind: 'loose',
          prompt: 'Which of your pieces could your opponent win: undefended, or attacked by something cheaper? Click them (pawns don\'t count), then Done.',
          noneLabel: 'None',
          answer: enPrise(chess, color).map((p) => p.square).sort(),
          focus: [],
        },
      };
    }
    if (random() < 0.5) {
      const item = unsafeItem(random);
      if (item) return item;
    }
    const verdict = withinNodes(SAFE_NODES, () => isMoveSafe(fen, played));
    if (!verdict) continue;
    const { safe, reason } = verdict;
    return {
      fen,
      orientation: color,
      question: { kind: 'safe', prompt: `In this game you played ${moveLabel(ply, played)} here. Was it safe?`, answer: safe, move: played, reason },
    };
  }
  return null;
}

interface WarmupPanelProps {
  onClose: () => void;
}

/**
 * A two-minute board-vision warm-up (CL-5) on positions from the student's own games: knight squares,
 * pieces that can be won, whether the move played was safe, and how many checks the opponent has. Untimed per question; what the student
 * answers slowest comes up most, from the answer times kept outside the review schedule.
 */
export const WarmupPanel: React.FC<WarmupPanelProps> = ({ onClose }) => {
  const [games, setGames] = useState<StoredGame[] | null>(null);
  const [item, setItem] = useState<WarmupItem | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [status, setStatus] = useState<QuestionStatus>('asking');
  const [askedAt, setAskedAt] = useState(Date.now());
  const [startedAt, setStartedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [results, setResults] = useState<Array<{ kind: QuestionKind; correct: boolean; ms: number }>>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    // The bundled games stand in while the database is still being seeded on a first visit
    const seed = seedGamesRaw as unknown as StoredGame[];
    const newest = (all: StoredGame[]) => [...(all.length ? all : seed)].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
    gamesRepo
      .getAllGames()
      .then((all) => alive && setGames(newest(all)))
      .catch(() => alive && setGames(newest([])));
    return () => {
      alive = false;
    };
  }, []);

  const next = useCallback(() => {
    if (!games) return;
    setItem(makeWarmupItem(games));
    setPicked([]);
    setStatus('asking');
    setAskedAt(Date.now());
  }, [games]);

  useEffect(() => {
    if (games && !item && !done) next();
  }, [games, item, done, next]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, WARMUP_MS - (now - startedAt));
  const remainingSec = Math.ceil(remaining / 1000);
  const board = useMemo(() => (item ? new RulesEngine(item.fen) : null), [item]);

  const submit = (answer: QuestionAnswer) => {
    if (!item || status !== 'asking') return;
    const correct = isRight(item.question, answer);
    const ms = Date.now() - askedAt;
    logCct({ at: Date.now(), kind: item.question.kind, correct, ms, source: 'warmup', fen: item.fen });
    setResults((r) => [...r, { kind: item.question.kind, correct, ms }]);
    if (Array.isArray(answer)) setPicked(answer);
    setStatus(correct ? 'right' : 'wrong');
  };

  const advance = () => {
    if (Date.now() - startedAt >= WARMUP_MS) setDone(true);
    else next();
  };

  const restart = () => {
    setResults([]);
    setDone(false);
    setStartedAt(Date.now());
    setNow(Date.now());
    next();
  };

  const byKind = useMemo(() => {
    const out = new Map<QuestionKind, { n: number; correct: number; ms: number }>();
    for (const r of results) {
      const s = out.get(r.kind) ?? { n: 0, correct: 0, ms: 0 };
      out.set(r.kind, { n: s.n + 1, correct: s.correct + (r.correct ? 1 : 0), ms: s.ms + r.ms });
    }
    return out;
  }, [results]);
  const kindName: Partial<Record<QuestionKind, string>> = {
    knight: 'Knight squares',
    loose: 'Pieces that can be won',
    safe: 'Was the move safe?',
    checks: 'Your opponent\'s checks',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm" data-modal="warmup">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Board-vision warm-up</h2>
            <p className="text-xs text-slate-400">Positions from your own games. Take your time on each; the questions you answer slowest come up most.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-sky-300" data-warmup-remaining={remainingSec}>
              {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
            </span>
            <button type="button" data-action="warmup-close" onClick={onClose} className="text-slate-400 hover:text-white text-sm underline">
              Close
            </button>
          </div>
        </div>

        {!games && <p className="text-sm text-slate-400">Reading your games…</p>}
        {games && !games.length && <p className="text-sm text-slate-400">No games in the database yet: sync or upload some first.</p>}

        {!done && item && board && (
          <div className="grid md:grid-cols-2 gap-4 items-start">
            <Chessboard
              board={board.getBoard()}
              position={board.getPosition()}
              orientation={item.orientation}
              interactive={false}
              onSquarePick={status === 'asking' && item.question.kind !== 'safe' ? (sq: Square) => setPicked((p) => (p.includes(sq) ? p.filter((x) => x !== sq) : [...p, sq])) : undefined}
              customSquareStyles={questionSquareStyles(item.question, picked, status)}
              highlights={item.question.kind === 'knight' ? [{ square: item.question.focus[0] as Square, color: 'blue' }] : []}
            />
            <div className="space-y-3">
              <BoardQuestion question={item.question} fen={item.fen} picked={picked} status={status} onSubmit={submit} onContinue={advance} />
              <p className="text-xs text-slate-400" data-warmup-score>
                {results.filter((r) => r.correct).length} of {results.length} right so far.
              </p>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3" data-section="warmup-summary">
            <p className="text-sm text-white">
              {results.filter((r) => r.correct).length} of {results.length} right in two minutes.
            </p>
            <ul className="text-sm text-slate-300 space-y-1">
              {[...byKind.entries()].map(([kind, s]) => (
                <li key={kind}>
                  {kindName[kind] ?? kind}: {s.correct} of {s.n} right, {(s.ms / s.n / 1000).toFixed(1)} s on average
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button type="button" data-action="warmup-again" onClick={restart} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium">
                Again
              </button>
              <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
