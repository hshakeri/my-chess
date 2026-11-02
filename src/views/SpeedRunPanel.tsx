import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from '../components/Chessboard';
import { RulesEngine } from '../engine/rules';
import type { CurriculumLesson } from '../types/curriculum';
import type { Square } from '../types/chess';

/**
 * Opening speed run: the lesson's main line played against the clock, the opponent's moves made at
 * once. The archive analysis found the openings cost hoot65 time rather than points (24 seconds more
 * than the opponents by move 10, and 8% of games lost on time), so a known line should be played
 * without thinking: the target is a few seconds a move. Runs are kept in this browser.
 */

/** A move of a known line should take no longer than this. */
export const SPEED_TARGET_MS = 3000;
export const SPEED_LOG_KEY = 'my_chess_speedrun_v1';
/** A lesson needs this many of the student's moves in its main line for a speed run. */
export const SPEED_MIN_MOVES = 3;

export interface SpeedRecord {
  lessonId: string;
  at: number;
  /** Time on the student's moves, in ms. */
  totalMs: number;
  moves: number;
  errors: number;
  /** Moves slower than the target. */
  slow: number;
}

export function readSpeedRecords(): SpeedRecord[] {
  try {
    const raw = window.localStorage.getItem(SPEED_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function logSpeedRun(record: SpeedRecord) {
  try {
    window.localStorage.setItem(SPEED_LOG_KEY, JSON.stringify([...readSpeedRecords(), record].slice(-500)));
  } catch {
    // the run still shows; it is just not kept
  }
}

/** The best earlier run of a lesson: the fastest without a wrong move, else the fastest. */
export function bestSpeedRun(lessonId: string, records = readSpeedRecords()): SpeedRecord | undefined {
  const runs = records.filter((r) => r.lessonId === lessonId);
  const clean = runs.filter((r) => r.errors === 0);
  return (clean.length ? clean : runs).sort((a, b) => a.totalMs - b.totalMs)[0];
}

/** How many of the student's moves the main line asks for after the auto-played start. */
export function speedMoves(lesson: CurriculumLesson): number {
  return lesson.moves.slice(lesson.startPly ?? 0).filter((m) => m.isUserMove).length;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

interface SpeedRunPanelProps {
  lesson: CurriculumLesson;
  onClose: () => void;
}

export const SpeedRunPanel: React.FC<SpeedRunPanelProps> = ({ lesson, onClose }) => {
  const student: 'w' | 'b' = lesson.targetColor === 'black' ? 'b' : 'w';
  const rulesRef = useRef(new RulesEngine(lesson.initialFen));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready');
  const [times, setTimes] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState<SpeedRecord | undefined>(() => bestSpeedRun(lesson.id));
  const moveStartRef = useRef(0);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  /** Play the opponent's moves (and anything before the start ply) until the student is to move. */
  const advance = useCallback(
    (from: number): number => {
      let i = from;
      while (i < lesson.moves.length && (!lesson.moves[i].isUserMove || i < (lesson.startPly ?? 0))) {
        rulesRef.current.makeMove(lesson.moves[i].san);
        i++;
      }
      return i;
    },
    [lesson]
  );

  const start = () => {
    rulesRef.current = new RulesEngine(lesson.initialFen);
    const i = advance(0);
    setIndex(i);
    setTimes([]);
    setErrors(0);
    setPhase('running');
    moveStartRef.current = Date.now();
    refresh();
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [phase]);

  const finish = (allTimes: number[], allErrors: number) => {
    const record: SpeedRecord = {
      lessonId: lesson.id,
      at: Date.now(),
      totalMs: allTimes.reduce((a, b) => a + b, 0),
      moves: allTimes.length,
      errors: allErrors,
      slow: allTimes.filter((t) => t > SPEED_TARGET_MS).length,
    };
    logSpeedRun(record);
    setBest(bestSpeedRun(lesson.id));
    setPhase('done');
  };

  const onMove = (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    if (phase !== 'running') return;
    const expected = lesson.moves[index];
    if (!expected) return;
    const probe = new RulesEngine(rulesRef.current.getFen());
    const made = probe.makeMove(move);
    if (!made.success) return;
    const accepted = [expected.san, ...(expected.accept?.san ?? [])];
    if (!accepted.includes(made.moveRecord!.san)) {
      setErrors((e) => e + 1);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const spent = Date.now() - moveStartRef.current;
    const nextTimes = [...times, spent];
    setTimes(nextTimes);
    rulesRef.current.makeMove(move);
    const next = advance(index + 1);
    setIndex(next);
    refresh();
    if (next >= lesson.moves.length) finish(nextTimes, errors);
    else moveStartRef.current = Date.now();
  };

  const position = rulesRef.current.getPosition();
  const total = times.reduce((a, b) => a + b, 0);
  const slow = times.filter((t) => t > SPEED_TARGET_MS).length;
  const current = phase === 'running' ? Math.max(0, now - moveStartRef.current) : 0;
  const movesInLine = useMemo(() => speedMoves(lesson), [lesson]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm" data-modal="speed-run" data-speed-phase={phase}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Speed run: {lesson.title}</h2>
            <p className="text-xs text-slate-400">
              Play your {movesInLine} moves of the main line as fast as you can; your opponent's replies come at once. Aim for under{' '}
              {SPEED_TARGET_MS / 1000} seconds a move: a line you know should cost you no clock.
            </p>
          </div>
          <button type="button" data-action="speed-close" onClick={onClose} className="text-slate-400 hover:text-white text-sm underline">
            Close
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 items-start">
          <div className={shake ? 'animate-shake' : ''}>
            <Chessboard
              board={rulesRef.current.getBoard()}
              position={position}
              orientation={student}
              interactive={phase === 'running'}
              onMove={onMove}
              getLegalMovesForSquare={(sq) => rulesRef.current.getLegalMovesForSquare(sq)}
            />
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            {phase === 'ready' && (
              <>
                <p>The clock starts when you press Start and runs on each of your moves until you play the right one.</p>
                {best && (
                  <p className="text-xs text-slate-400" data-speed-best={best.totalMs}>
                    Your best: {seconds(best.totalMs)} for {best.moves} moves{best.errors ? `, ${best.errors} wrong` : ''}.
                  </p>
                )}
                <button type="button" data-action="speed-start" onClick={start} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                  Start
                </button>
              </>
            )}
            {phase !== 'ready' && (
              <>
                <div className="flex gap-4 font-mono">
                  <span data-speed-total={total}>Total {seconds(total + current)}</span>
                  <span data-speed-errors={errors}>Wrong {errors}</span>
                  {phase === 'running' && <span className={current > SPEED_TARGET_MS ? 'text-amber-300' : 'text-emerald-300'}>This move {seconds(current)}</span>}
                </div>
                <ol className="flex flex-wrap gap-1.5" data-speed-times>
                  {times.map((t, k) => (
                    <li
                      key={k}
                      data-speed-move={k}
                      data-slow={t > SPEED_TARGET_MS}
                      className={`px-1.5 py-0.5 rounded text-xs font-mono ${t > SPEED_TARGET_MS ? 'bg-amber-900/60 text-amber-200' : 'bg-emerald-900/50 text-emerald-200'}`}
                    >
                      {seconds(t)}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {phase === 'done' && (
              <div className="space-y-2" data-section="speed-summary">
                <p className="text-white">
                  {times.length} moves in {seconds(total)} ({seconds(total / Math.max(1, times.length))} a move), {slow} slower than{' '}
                  {SPEED_TARGET_MS / 1000} s, {errors} wrong.
                </p>
                {best && <p className="text-xs text-slate-400">Your best so far: {seconds(best.totalMs)}.</p>}
                <button type="button" data-action="speed-again" onClick={start} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium">
                  Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
