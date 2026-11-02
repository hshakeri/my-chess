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
  /** Where the clock keeps its state; give one that outlives the component to keep the clock across tabs. */
  store?: ClockStore;
  now?: () => number;
}

/**
 * The clock's state, kept by the caller so it survives the component leaving the screen (another tab
 * and back): without it the clock would start again and a flagged game would be playable again.
 */
export interface ClockStore {
  key: string;
  /** The resetKey and the control the clocks were last set for (null before the first). */
  resetKey: number | string | null;
  setFor: string | null;
  left: Clocks;
  stack: Clocks[];
  basePly: number;
  prevPly: number;
  turnStart: number;
  flagged: boolean;
  longThinks: number;
  paceNote: { move: number; left: number; target: number } | null;
}

export const newClockStore = (): ClockStore => ({
  key: 'off',
  resetKey: null,
  setFor: null,
  left: { w: 0, b: 0 },
  stack: [],
  basePly: 0,
  prevPly: 0,
  turnStart: 0,
  flagged: false,
  longThinks: 0,
  paceNote: null,
});

export const PracticeClock: React.FC<PracticeClockProps> = ({ turn, ply, resetKey, student, live, onFlag, onReset, pace, store: given, now = Date.now }) => {
  const own = useRef<ClockStore>(newClockStore());
  const st = given ?? own.current;
  const [key, setKeyState] = useState(st.key);
  const setKey = (k: string) => {
    st.key = k;
    setKeyState(k);
  };
  const control = CLOCK_CONTROLS.find((c) => c.key === key)!.control;
  const [, setTick] = useState(0);
  const mine = (side: Side) => student === 'both' || side === student;
  const longThinks = st.longThinks;
  const paceNote = st.paceNote;

  // A new game, a loaded position or another control: full clocks. Coming back to the same game keeps them.
  useEffect(() => {
    if (st.resetKey === resetKey && st.setFor === key) {
      setTick((t) => t + 1);
      return;
    }
    const full = control ? control.base * 1000 : 0;
    st.resetKey = resetKey;
    st.setFor = key;
    st.left = { w: full, b: full };
    st.stack = [{ ...st.left }];
    st.basePly = ply;
    st.prevPly = ply;
    st.turnStart = now();
    st.flagged = false;
    st.longThinks = 0;
    st.paceNote = null;
    onReset?.();
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, key]);

  // A move: the mover's clock loses the time it took and gains the increment; a takeback goes back
  useEffect(() => {
    if (ply === st.prevPly) return;
    const t = now();
    if (control && !st.flagged) {
      if (ply > st.prevPly) {
        const mover: Side = turn === 'w' ? 'b' : 'w';
        const spent = t - st.turnStart;
        if (mine(mover) && spent > THINK_CAP_MS) st.longThinks += 1;
        const remaining = st.left[mover] - spent;
        if (remaining <= 0) {
          // The move came after the clock had run out: the flag stands, and there is no increment
          st.flagged = true;
          st.left = { ...st.left, [mover]: 0 };
          onFlag(mover);
        } else {
          st.left = { ...st.left, [mover]: remaining + control.inc * 1000 };
          st.stack[ply - st.basePly] = { ...st.left };
          // After the student's move N (counted from the start), the clock against the opponents' pace
          const moveNo = Math.floor((ply - 1) / 2) + 1;
          const target = pace && pace.control === key && student !== 'both' && mover === student ? pace.targets[moveNo] : undefined;
          if (target !== undefined) st.paceNote = { move: moveNo, left: st.left[mover] / 1000, target };
        }
      } else {
        st.left = { ...(st.stack[ply - st.basePly] ?? st.left) };
      }
      if (!st.flagged) st.stack.length = Math.max(1, ply - st.basePly + 1);
    }
    st.turnStart = t;
    st.prevPly = ply;
    setTick((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply]);

  // The running clock, and the flag
  useEffect(() => {
    if (!control || !live || st.flagged) return;
    const id = setInterval(() => {
      if (st.left[turn] - (now() - st.turnStart) <= 0 && !st.flagged) {
        st.flagged = true;
        // The stopped clock shows the zero it ran down to
        st.left = { ...st.left, [turn]: 0 };
        onFlag(turn);
      }
      setTick((k) => k + 1);
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control, live, turn, onFlag, now]);

  const running = Boolean(control) && live && !st.flagged;
  const elapsed = running ? now() - st.turnStart : 0;
  const shown = (side: Side) => Math.max(0, st.left[side] - (side === turn ? elapsed : 0));
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
