import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/database';
import { reviewGame, type ReviewInput } from '../analytics/review';
import { summarizeReviews, type MistakeSummary, type RateRow } from '../analytics/mistakePatterns';
import { summarizeHabits, type HabitRow } from '../analytics/habits';
import type { ReviewProgress } from '../engine/worker/engineClient';
import { useEngineClient } from '../engine/EngineContext';
import type { StoredGame } from '../types/db';
import type { GameReview } from '../types/review';

/** How many unreviewed games one batch takes, newest first. */
export const BATCH_SIZES = [5, 10, 25, 50];
/** Games shorter than this (in plies) are not worth a review. */
const MIN_PLIES = 10;

type Run = { result: Promise<GameReview | null>; cancel: () => void };

interface BatchState {
  running: boolean;
  done: number;
  total: number;
  failed: number;
  progress?: ReviewProgress;
}

/** The games a batch would review: the student's own, not reviewed yet, newest first. */
export function batchQueue(games: StoredGame[], reviewedIds: Set<string>, size: number): StoredGame[] {
  return games
    .filter((g) => g.userColor && g.movesSan.length >= MIN_PLIES && !reviewedIds.has(g.id))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, size);
}

const Bar: React.FC<{ value: number; max: number }> = ({ value, max }) => (
  <div className="h-2 rounded bg-slate-800 w-full" aria-hidden>
    <div className="h-2 rounded bg-rose-500/70" style={{ width: `${max > 0 ? Math.max(2, Math.round((100 * value) / max)) : 0}%` }} />
  </div>
);

function RateTable<K extends string>({ title, rows, attr }: { title: string; rows: RateRow<K>[]; attr: string }) {
  const max = Math.max(...rows.map((r) => r.per100), 0);
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} {...{ [attr]: r.key }} data-rate={r.per100} className="text-sm">
            <div className="flex justify-between gap-2 text-slate-300">
              <span>{r.label}</span>
              <span className="font-mono text-xs text-slate-400">
                {r.moves ? `${r.per100} per 100 moves (${r.mistakes} in ${r.moves})` : 'no moves'}
              </span>
            </div>
            <Bar value={r.per100} max={max} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const pct = (x: number | null) => (x === null ? '-' : `${Math.round(x * 100)}%`);

/** The habit scorecard (DC-8): how often each habit held, lately, and the score with and without it. */
export const HabitScorecard: React.FC<{ rows: HabitRow[] }> = ({ rows }) => (
  <div className="space-y-2" data-section="habits">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Habits in your games</h4>
    <p className="text-xs text-slate-400">How often each habit held, in all your games and in the newest 20, and your score in the games with it and without it.</p>
    <table className="w-full text-sm text-slate-300">
      <thead>
        <tr className="text-xs text-slate-500 text-left">
          <th className="font-normal py-1">Habit</th>
          <th className="font-normal">Kept</th>
          <th className="font-normal">Newest 20</th>
          <th className="font-normal">Score with / without</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-habit={r.key} data-rate={r.rate.toFixed(3)} className="border-t border-slate-800">
            <td className="py-1 pr-2">{r.label}</td>
            {r.games ? (
              <>
                <td className="font-mono text-xs">
                  {pct(r.rate)} <span className="text-slate-500">of {r.games}</span>
                </td>
                <td className="font-mono text-xs">{pct(r.recentRate)}</td>
                <td className="font-mono text-xs">
                  {pct(r.scoreWith)} / {pct(r.scoreWithout)}
                </td>
              </>
            ) : (
              <td colSpan={3} className="text-xs text-slate-500">
                No game yet{r.key === 'nothing_hung' ? ': review some games first' : ''}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** The summary of every reviewed game: mistakes per 100 moves by kind, phase, clock and month. */
export const MistakeSummaryView: React.FC<{ summary: MistakeSummary }> = ({ summary }) => {
  const maxType = Math.max(...summary.byType.map((r) => r.per100), 0);
  const maxMonth = Math.max(...summary.byMonth.map((r) => r.per100), 0);
  return (
    <div className="space-y-5" data-section="mistake-summary" data-games={summary.games} data-per100={summary.per100}>
      <p className="text-sm text-slate-300">
        {summary.games} {summary.games === 1 ? 'game' : 'games'} reviewed ({summary.maiaGames} with Maia), {summary.moves} of your moves:{' '}
        <b className="text-white">{summary.mistakes}</b> mistakes that cost points, <b className="text-white">{summary.per100}</b> per 100 moves.
        {summary.maiaGames < summary.games ? ' Reviews without Maia find only material mistakes.' : ''}
      </p>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">By kind, with the check that catches it</h4>
        {summary.byType.length === 0 ? (
          <p className="text-sm text-slate-400">No mistakes found in the reviewed games.</p>
        ) : (
          <ul className="space-y-2">
            {summary.byType.map((r) => (
              <li key={r.type} data-mistake-type={r.type} data-rate={r.per100} className="text-sm">
                <div className="flex justify-between gap-2 text-slate-200">
                  <span>{r.label}</span>
                  <span className="font-mono text-xs text-slate-400">
                    {r.mistakes} · {r.per100} per 100 moves
                  </span>
                </div>
                <Bar value={r.per100} max={maxType} />
                <p className="text-xs text-slate-400 mt-0.5">{r.check}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <RateTable title="By phase of the game" rows={summary.byPhase} attr="data-phase" />
        {summary.byClock.length > 0 ? (
          <RateTable title={`By time left on your clock (${summary.clockGames} games with clock times)`} rows={summary.byClock} attr="data-clock" />
        ) : (
          <p className="text-sm text-slate-400">No reviewed game has clock times in its PGN.</p>
        )}
      </div>

      {summary.byMonth.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Month by month</h4>
          <ul className="space-y-1.5">
            {summary.byMonth.map((r) => (
              <li key={r.month} data-month={r.month} data-rate={r.per100} className="text-sm">
                <div className="flex justify-between gap-2 text-slate-300">
                  <span className="font-mono">{r.month}</span>
                  <span className="font-mono text-xs text-slate-400">
                    {r.per100} per 100 moves ({r.games} {r.games === 1 ? 'game' : 'games'})
                  </span>
                </div>
                <Bar value={r.per100} max={maxMonth} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * "Your mistake patterns" (CL-3) on the Diagnostics tab: the summary of every reviewed game, and a
 * batch review that runs the game review on the newest unreviewed games one after another in the
 * engine worker. Batch reviews are saved without marks; opening such a game in the database still
 * asks for the student's marks before showing what the engine found.
 */
export const MistakePatternsPanel: React.FC<{ games: StoredGame[] }> = ({ games }) => {
  const engineClient = useEngineClient();
  const [reviews, setReviews] = useState<GameReview[] | null>(null);
  const [size, setSize] = useState(10);
  const [batch, setBatch] = useState<BatchState>({ running: false, done: 0, total: 0, failed: 0 });
  const runRef = useRef<Run | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setReviews(await db.reviews.toArray());
    } catch {
      setReviews([]);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      cancelledRef.current = true;
      runRef.current?.cancel();
    };
  }, [load]);

  const summary = useMemo(() => (reviews ? summarizeReviews(reviews, games) : null), [reviews, games]);
  const habits = useMemo(() => summarizeHabits(games, reviews ?? []), [games, reviews]);
  const reviewedIds = useMemo(() => new Set((reviews ?? []).map((r) => r.gameId)), [reviews]);
  const waiting = useMemo(() => batchQueue(games, reviewedIds, Number.MAX_SAFE_INTEGER).length, [games, reviewedIds]);

  const start = async () => {
    const queue = batchQueue(games, reviewedIds, size);
    if (!queue.length) return;
    cancelledRef.current = false;
    setBatch({ running: true, done: 0, total: queue.length, failed: 0 });
    for (const [k, game] of queue.entries()) {
      if (cancelledRef.current) break;
      const input: ReviewInput = {
        gameId: game.id,
        movesSan: game.movesSan,
        userColor: game.userColor === 'black' ? 'black' : 'white',
        whiteRating: game.white.rating,
        blackRating: game.black.rating,
        pgn: game.pgn,
      };
      const run: Run = engineClient
        ? engineClient.reviewGame(input, (progress) => setBatch((b) => ({ ...b, progress })))
        : { result: reviewGame(input, null, { isCancelled: () => cancelledRef.current }).catch(() => null), cancel: () => undefined };
      runRef.current = run;
      let failed = false;
      try {
        const result = await run.result;
        if (result && !cancelledRef.current) await db.reviews.put({ ...result, source: 'batch' });
        else if (!result && !cancelledRef.current) failed = true;
      } catch {
        failed = true;
      }
      runRef.current = null;
      setBatch((b) => ({ ...b, done: k + 1, failed: b.failed + (failed ? 1 : 0), progress: undefined }));
      await load();
    }
    setBatch((b) => ({ ...b, running: false, progress: undefined }));
  };

  const cancel = () => {
    cancelledRef.current = true;
    runRef.current?.cancel();
    runRef.current = null;
    setBatch((b) => ({ ...b, running: false, progress: undefined }));
  };

  return (
    <section data-section="mistake-patterns" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
      <div>
        <h3 className="text-lg font-bold text-white">Your mistake patterns</h3>
        <p className="text-sm text-slate-400">
          Every game you review, in the database or in a batch here, adds to this count: the moves that cost you points, per 100 of your moves, by
          kind, by phase and by the time on your clock.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" data-section="batch-review" data-batch-running={batch.running} data-batch-done={batch.done}>
        <label className="text-slate-300" htmlFor="batch-size">
          Review my newest
        </label>
        <select
          id="batch-size"
          data-select="batch-size"
          value={size}
          disabled={batch.running}
          onChange={(e) => setSize(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
        >
          {BATCH_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-slate-300">unreviewed games</span>
        {!batch.running ? (
          <button
            type="button"
            data-action="batch-review"
            onClick={() => void start()}
            disabled={!reviews || waiting === 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
          >
            Start
          </button>
        ) : (
          <button type="button" data-action="batch-cancel" onClick={cancel} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">
            Stop
          </button>
        )}
        <span className="text-xs text-slate-400" data-batch-status>
          {batch.running
            ? `Game ${Math.min(batch.done + 1, batch.total)} of ${batch.total}${
                batch.progress && batch.progress.total > 1 ? `: ${batch.progress.stage} ${Math.round((100 * batch.progress.done) / batch.progress.total)}%` : ''
              }`
            : batch.total
            ? `${batch.done - batch.failed} of ${batch.total} reviewed${batch.failed ? `, ${batch.failed} failed` : ''}.`
            : `${waiting} of your games are not reviewed yet.`}
        </span>
      </div>

      <HabitScorecard rows={habits} />

      {!summary && <p className="text-sm text-slate-400">Reading the reviews…</p>}
      {summary && summary.games === 0 && (
        <p className="text-sm text-slate-400" data-section="mistake-summary" data-games={0}>
          No game is reviewed yet. Review one in the Database tab (your marks first, then the engine's), or start a batch above.
        </p>
      )}
      {summary && summary.games > 0 && <MistakeSummaryView summary={summary} />}
    </section>
  );
};
