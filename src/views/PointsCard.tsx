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
  /** Practised in games by one of the Play tab's two checks. */
  inGames?: boolean;
  also?: string;
}

export const POINTS_ROWS: PointsRow[] = [
  {
    key: 'hang',
    habit: 'Before every move, check that nothing you leave can be taken for free',
    points: '5.7',
    group: 'pattern-is-your-move-safe',
    inGames: true,
    also: 'and the safety check in games on the Play tab',
  },
  {
    key: 'threat',
    habit: 'After every opponent move, ask what it attacks, then move or guard that piece',
    points: '4.1 to 4.9',
    group: 'pattern-what-does-it-attack',
    inGames: true,
    also: 'and the board question in games on the Play tab',
  },
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

/**
 * The same habits in the order a player meets them at the board: the opponent's move, then one's own,
 * then the clock and the result. The card to keep by the board (the Worksheets tab and the book).
 */
export const BOARD_ORDER = ['threat', 'hang', 'mate', 'free', 'clock', 'resign'] as const;
export const boardCardRows = (): PointsRow[] => BOARD_ORDER.map((key) => POINTS_ROWS.find((r) => r.key === key)!);

/** The card itself, as a printable sheet. */
export const BoardCardSheet: React.FC = () => (
  <div
    className="printable-sheet bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none w-full"
    data-printable="sheet"
    data-section="board-card"
  >
    <div className="border-2 border-dashed border-slate-900 p-4 max-w-xl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th colSpan={2} className="text-left font-bold pb-1 border-b border-slate-900">
              At the board, every move: the checks in order
            </th>
            <th className="text-right font-bold pb-1 border-b border-slate-900">Points</th>
          </tr>
        </thead>
        <tbody>
          {boardCardRows().map((row, k) => (
            <tr key={row.key} data-card-row={row.key} className="border-b border-slate-300 align-top">
              <td className="py-1.5 pr-2 w-6">{k + 1}.</td>
              <td className="py-1.5">{row.habit}</td>
              <td className="py-1.5 pl-3 text-right whitespace-nowrap">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-slate-600 mt-2">
        From your 4,101 Chess.com games: the points per 100 games each habit would have won if kept every time (near a 50% score, one point per 100 games is about 7 rating
        points). Cut along the dashed line and keep it by the board.
      </p>
    </div>
  </div>
);

export const PointsCard: React.FC<{ onOpenClock?: () => void; onPlayWithChecks?: () => void }> = ({ onOpenClock, onPlayWithChecks }) => (
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
            {row.inGames && onPlayWithChecks && (
              <button type="button" data-points-play={row.key} onClick={onPlayWithChecks} className="text-xs text-sky-300 hover:text-white underline">
                Practise in a game
              </button>
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
