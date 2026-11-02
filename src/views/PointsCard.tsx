import React from 'react';
import { patternPath } from '../curriculum/patternPath';

/**
 * Where hoot65's points go, from the archive analysis (`docs/game-analysis.md`: all 4,101 Chess.com
 * games scored with Maia on 2026-11-01), each habit with the trainer that drills it. The figures are
 * that analysis's, not computed here: points per 100 games if the habit were kept every time.
 */
export interface PointsRow {
  key: string;
  habit: string;
  points: string;
  /** A study-path group whose first lesson the row links to, or the Clock & Endings tab. */
  group?: string;
  clock?: boolean;
  also?: string;
}

export const POINTS_ROWS: PointsRow[] = [
  { key: 'hang', habit: 'Before every move, check that nothing you leave can be taken for free', points: '5.7', group: 'pattern-is-your-move-safe' },
  { key: 'threat', habit: 'After every opponent move, ask what it attacks, then move or guard that piece', points: '4.1 to 4.9', group: 'pattern-what-does-it-attack' },
  {
    key: 'free',
    habit: 'Before every move, look for an enemy piece that nothing defends, and take it',
    points: '2.6 to 3.6',
    group: 'pattern-take-what-is-free',
    also: 'and the Tactics deck on the Lessons tab',
  },
  { key: 'clock', habit: 'Keep pace with the clock: play prepared opening moves at once, cap a think at 30 seconds', points: '3.1', clock: true, also: 'the practice clock on the Play tab, the speed run on the Lessons tab' },
  { key: 'resign', habit: 'Do not resign unless a rook or more down', points: '1.7', clock: true },
  { key: 'mate', habit: 'Before every move, check whether the opponent has a mate in one', points: '1.3 to 1.8', group: 'pattern-does-your-move-allow-mate' },
];

export const PointsCard: React.FC<{ onOpenClock?: () => void }> = ({ onOpenClock }) => (
  <section className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 space-y-3" data-section="points">
    <div>
      <h3 className="text-base font-bold text-white">Where your points go</h3>
      <p className="text-xs text-slate-400 mt-0.5">
        From all 4,101 of your Chess.com games, scored with Maia on 2026-11-01: points per 100 games if the habit were kept every time (near a 50%
        score, one point per 100 games is about 7 rating points). The openings below cost little; no recurring opening position of the last year is worth even half a point
        per 100 games. The board checks and the clock are where the points are.
      </p>
    </div>
    <ol className="space-y-1.5 text-sm">
      {POINTS_ROWS.map((row, k) => {
        const lesson = row.group ? patternPath.find((g) => g.id === row.group)?.lessonIds[0] : undefined;
        return (
          <li key={row.key} data-points-row={row.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-emerald-300 w-24 shrink-0 whitespace-nowrap">{row.points}</span>
            <span className="text-slate-200 flex-1 min-w-[12rem]">
              {k + 1}. {row.habit}
            </span>
            {lesson && (
              <a href={`#/lesson/${lesson}`} data-points-train={row.key} className="text-xs text-emerald-300 hover:text-white underline">
                Drill it
              </a>
            )}
            {row.clock && onOpenClock && (
              <button type="button" data-points-clock={row.key} onClick={onOpenClock} className="text-xs text-sky-300 hover:text-white underline">
                Clock &amp; Endings
              </button>
            )}
            {row.also && <span className="text-xs text-slate-500">({row.also})</span>}
          </li>
        );
      })}
    </ol>
  </section>
);
