import React, { useMemo } from 'react';
import { AHEAD_POINTS, LONG_THINK_S, summarizeClock, type ClockSummary } from '../analytics/clock';
import type { StoredGame } from '../types/db';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : '-');

/** The clock summary itself, without the games (for tests and for the panel). */
export const ClockSummaryView: React.FC<{ summary: ClockSummary | null }> = ({ summary }) => {
  if (!summary) {
    return (
      <p className="text-sm text-slate-400" data-section="clock" data-games={0}>
        No game in the database has clock times. Games synced from Chess.com carry them.
      </p>
    );
  }
  const s = summary;
  return (
    <div
      className="space-y-5 text-sm text-slate-300"
      data-section="clock"
      data-games={s.games}
      data-lost-on-time={s.lostOnTime}
      data-won-on-time={s.wonOnTime}
    >
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30" data-clock-stat="lost">
          You lost on time in <b className="text-white">{s.lostOnTime}</b> of {s.games} games ({pct(s.lostOnTime, s.games)})
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-slate-800" data-clock-stat="won">
          Your opponents lost on time in <b className="text-white">{s.wonOnTime}</b> ({pct(s.wonOnTime, s.games)})
        </span>
      </div>
      <p className="text-xs text-slate-400">
        Your {s.label} games with a clock time for every move. Your opponents are players of your rating in the same games, and they seldom lose on time,
        so their pace is a fair target.
      </p>

      {s.pace.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clock left after each move (median, the same games)</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 text-left">
                <th className="font-normal py-1">After move</th>
                <th className="font-normal">You</th>
                <th className="font-normal">Opponents</th>
                <th className="font-normal">Games</th>
              </tr>
            </thead>
            <tbody>
              {s.pace.map((row) => (
                <tr key={row.move} data-pace-move={row.move} data-mine={Math.round(row.mine)} data-theirs={Math.round(row.theirs)} className="border-t border-slate-800">
                  <td className="py-1">{row.move}</td>
                  <td className={`font-mono text-xs ${row.mine < row.theirs - 30 ? 'text-rose-300' : ''}`}>{mmss(row.mine)}</td>
                  <td className="font-mono text-xs">{mmss(row.theirs)}</td>
                  <td className="font-mono text-xs text-slate-500">{row.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="space-y-1" data-section="clock-habits">
        <li data-clock-row="opening">
          Seconds a move, moves 1-10: <b className="text-white font-mono">{s.perMove.opening.mine.toFixed(1)}</b> (opponents {s.perMove.opening.theirs.toFixed(1)})
        </li>
        <li data-clock-row="middlegame">
          Seconds a move, moves 11-30: <b className="text-white font-mono">{s.perMove.middlegame.mine.toFixed(1)}</b> (opponents{' '}
          {s.perMove.middlegame.theirs.toFixed(1)})
        </li>
        <li data-clock-row="long-thinks">
          Moves longer than {LONG_THINK_S} seconds, per game: <b className="text-white font-mono">{s.longThinks.mine.toFixed(1)}</b> (opponents{' '}
          {s.longThinks.theirs.toFixed(1)})
        </li>
      </ul>

      {s.lostAhead.length > 0 && (
        <div className="space-y-2" data-section="lost-ahead">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lost on time while ahead</h4>
          <p className="text-xs text-slate-400">
            Games you lost on time with {AHEAD_POINTS} points of material or more on the board in your favour (a knight or bishop is 3, a rook 5, a queen 9).
          </p>
          <ul className="space-y-1">
            {s.lostAhead.map((g) => (
              <li key={g.gameId} data-lost-ahead={g.gameId}>
                {g.date}, vs {g.opponent}: up {g.lead} after {g.moves} moves
                {g.url && (
                  <>
                    {' '}
                    <a href={g.url} target="_blank" rel="noreferrer" className="text-emerald-300 hover:text-white underline">
                      open the game
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-300 bg-slate-800/60 rounded-lg p-3" data-section="clock-advice">
        Two habits keep the clock: play the moves you know at once (the opening speed run on the Lessons tab drills it), and cap a think at{' '}
        {LONG_THINK_S} seconds. Glance at both clocks before every move; when you are ahead and short of time, the simple safe move is the right one.
      </p>
    </div>
  );
};

/** Your clock (DC-3), on the Diagnostics tab, from every stored game with clock times. */
export const ClockPanel: React.FC<{ games: StoredGame[] }> = ({ games }) => {
  const summary = useMemo(() => summarizeClock(games), [games]);
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4" data-section="clock-panel">
      <div>
        <h3 className="text-lg font-bold text-white">Your clock</h3>
        <p className="text-sm text-slate-400">How your time goes, from the clock times of your games, set against your opponents in the same games.</p>
      </div>
      <ClockSummaryView summary={summary} />
    </section>
  );
};
