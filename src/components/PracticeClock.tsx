import React, { useEffect, useRef, useState } from 'react';

/**
 * A practice clock for the Play tab (DC-3): off by default; 10+0 is hoot65's time control. The clock
 * of the side to move runs, a move adds the increment, a takeback restores the clocks of the
 * position it returns to, and a flag ends the game. On the student's moves a cue shows once a move
 * has taken more than 30 seconds, the think the archive analysis says to cap, and the game's long
 * thinks are counted.
 */

export interface ClockControl {
  /** Seconds. */
  base: number;
  inc: number;
}

export const CLOCK_CONTROLS: Array<{ key: string; label: string; control: ClockControl | null }> = [
  { key: 'off', label: 'Off', control: null },
  { key: '600+0', label: '10+0', control: { base: 600, inc: 0 } },
  { key: '300+0', label: '5+0', control: { base: 300, inc: 0 } },
  { key: '180+2', label: '3+2', control: { base: 180, inc: 2 } },
];

export const THINK_CAP_MS = 30_000;

type Side = 'w' | 'b';
type Clocks = Record<Side, number>;

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The opponents' median clock after given moves, from the student's own games at one time control (the pace to keep). */
export interface PaceTargets {
  /** The control it applies to, as a CLOCK_CONTROLS key ("600+0"). */
  control: string;
  /** Move number to seconds left. */
  targets: Record<number, number>;
}

interface PracticeClockProps {
  /** The side to move in the live position, and the number of plies played. */
  turn: Side;
  ply: number;
  /** Changes on a new game or a loaded position: the clocks start again. */
  resetKey: number | string;
  /** The side the student plays ('both' when no engine plays). */
  student: Side | 'both';
  /** False once the game is over (or a side has flagged): the clocks stop. */
  live: boolean;
  onFlag: (side: Side) => void;
  /** Called when the clocks start again, so a flag is cleared. */
  onReset?: () => void;
  /** The pace of the opponents in the student's games; shown after the student's moves it names. */
  pace?: PaceTargets;
  now?: () => number;
}

export const PracticeClock: React.FC<PracticeClockProps> = ({ turn, ply, resetKey, student, live, onFlag, onReset, pace, now = Date.now }) => {
  const [key, setKey] = useState('off');
  const control = CLOCK_CONTROLS.find((c) => c.key === key)!.control;
  const leftRef = useRef<Clocks>({ w: 0, b: 0 });
  const stackRef = useRef<Clocks[]>([]);
  const basePlyRef = useRef(ply);
  const prevPlyRef = useRef(ply);
  const turnStartRef = useRef(now());
  const flaggedRef = useRef(false);
  const [longThinks, setLongThinks] = useState(0);
  const [paceNote, setPaceNote] = useState<{ move: number; left: number; target: number } | null>(null);
  const [, setTick] = useState(0);
  const mine = (side: Side) => student === 'both' || side === student;

  // A new game, a loaded position or another control: full clocks
  useEffect(() => {
    const full = control ? control.base * 1000 : 0;
    leftRef.current = { w: full, b: full };
    stackRef.current = [{ ...leftRef.current }];
    basePlyRef.current = ply;
    prevPlyRef.current = ply;
    turnStartRef.current = now();
    flaggedRef.current = false;
    setLongThinks(0);
    setPaceNote(null);
    onReset?.();
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, key]);

  // A move: the mover's clock loses the time it took and gains the increment; a takeback goes back
  useEffect(() => {
    if (ply === prevPlyRef.current) return;
    const t = now();
    if (control && !flaggedRef.current) {
      if (ply > prevPlyRef.current) {
        const mover: Side = turn === 'w' ? 'b' : 'w';
        const spent = t - turnStartRef.current;
        if (mine(mover) && spent > THINK_CAP_MS) setLongThinks((n) => n + 1);
        leftRef.current = { ...leftRef.current, [mover]: Math.max(0, leftRef.current[mover] - spent) + control.inc * 1000 };
        stackRef.current[ply - basePlyRef.current] = { ...leftRef.current };
        // After the student's move N (counted from the start), the clock against the opponents' pace
        const moveNo = Math.floor((ply - 1) / 2) + 1;
        const target = pace && pace.control === key && student !== 'both' && mover === student ? pace.targets[moveNo] : undefined;
        if (target !== undefined) setPaceNote({ move: moveNo, left: leftRef.current[mover] / 1000, target });
      } else {
        leftRef.current = { ...(stackRef.current[ply - basePlyRef.current] ?? leftRef.current) };
      }
      stackRef.current.length = Math.max(1, ply - basePlyRef.current + 1);
    }
    turnStartRef.current = t;
    prevPlyRef.current = ply;
    setTick((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply]);

  // The running clock, and the flag
  useEffect(() => {
    if (!control || !live || flaggedRef.current) return;
    const id = setInterval(() => {
      if (leftRef.current[turn] - (now() - turnStartRef.current) <= 0 && !flaggedRef.current) {
        flaggedRef.current = true;
        // The stopped clock shows the zero it ran down to
        leftRef.current = { ...leftRef.current, [turn]: 0 };
        onFlag(turn);
      }
      setTick((k) => k + 1);
    }, 200);
    return () => clearInterval(id);
  }, [control, live, turn, onFlag, now]);

  const running = Boolean(control) && live && !flaggedRef.current;
  const elapsed = running ? now() - turnStartRef.current : 0;
  const shown = (side: Side) => Math.max(0, leftRef.current[side] - (side === turn ? elapsed : 0));
  const cue = running && mine(turn) && elapsed > THINK_CAP_MS;
  const label = (side: Side) => (student === 'both' ? (side === 'w' ? 'White' : 'Black') : mine(side) ? 'You' : 'Maia');

  return (
    <div className="w-full max-w-[560px] flex flex-wrap items-center gap-2 text-xs" data-section="practice-clock" data-clock={key}>
      <label className="flex items-center gap-1.5 text-slate-400">
        Clock
        <select
          data-select="practice-clock"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-md py-1 px-1.5 text-xs text-white"
        >
          {CLOCK_CONTROLS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {control &&
        (['w', 'b'] as Side[]).map((side) => (
          <span
            key={side}
            data-clock-side={side}
            data-ms={Math.round(shown(side))}
            className={`px-2 py-1 rounded-md font-mono border ${
              running && side === turn ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-900 text-slate-400 border-slate-800'
            } ${shown(side) === 0 ? 'text-rose-300 border-rose-500/60' : ''}`}
          >
            {label(side)} {mmss(shown(side))}
          </span>
        ))}
      {control && (
        <span className="text-slate-500" data-long-thinks={longThinks}>
          Moves over 30 s: {longThinks}
        </span>
      )}
      {paceNote && (
        <span
          className={`px-2 py-1 rounded-md border ${paceNote.left >= paceNote.target ? 'border-emerald-500/40 text-emerald-300' : 'border-rose-500/40 text-rose-300'}`}
          data-pace-note={Math.round(paceNote.left - paceNote.target)}
        >
          After move {paceNote.move}: {mmss(paceNote.left * 1000)} left,{' '}
          {Math.abs(Math.round(paceNote.left - paceNote.target))} s {paceNote.left >= paceNote.target ? 'ahead of' : 'behind'} your opponents' {mmss(paceNote.target * 1000)}
        </span>
      )}
      {cue && (
        <span className="px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200" data-think-cue>
          Over 30 seconds on this move: pick the safe move you have.
        </span>
      )}
    </div>
  );
};
