import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../db/database';
import { CardService } from '../services/cards';
import { summarizeProgress, type ProgressSummary } from '../analytics/progress';
import { labelAt } from '../analytics/review';
import { allCurriculumLessons } from '../curriculum';
import type { StoredCard, StoredRevlog } from '../types/db';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A card's name: its own title, else the title of the first lesson it belongs to. */
function cardName(card: StoredCard): string {
  if (card.title) return card.title;
  const lesson = allCurriculumLessons.find((l) => card.lessonIds.includes(l.id));
  return lesson ? lesson.title : card.lessonIds[0] ?? 'Position';
}

/** The summary itself, without loading (for tests and for the panel). */
export const ProgressSummaryView: React.FC<{ summary: ProgressSummary; onOpenLesson?: (lessonId: string) => void }> = ({ summary, onOpenLesson }) => {
  const maxDue = Math.max(...summary.dueByDay, 1);
  return (
    <div className="space-y-5 text-sm text-slate-300" data-section="progress-summary" data-cards={summary.total} data-reviewed={summary.reviewed}>
      <div className="flex flex-wrap gap-2">
        {summary.byState.map((s) => (
          <span key={s.state} data-card-state={s.label} className="px-2 py-1 rounded-lg bg-slate-800 text-xs">
            {s.label}: <b className="text-white">{s.count}</b>
          </span>
        ))}
      </div>
      <p data-mean-recall={summary.meanRecall === null ? '' : summary.meanRecall.toFixed(3)}>
        {summary.meanRecall === null
          ? 'No position has been reviewed yet: play a lesson or start Today\'s session.'
          : `Of the ${summary.reviewed} positions you have reviewed, you would recall ${pct(summary.meanRecall)} today on average (FSRS estimate).`}
      </p>

      <div className="space-y-2" data-section="mastery">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">By pattern, in the order of the study path</h4>
        <p className="text-xs text-slate-400">Mastered: FSRS expects you to keep the position for a week or more.</p>
        <ul className="space-y-1.5">
          {summary.byGroup.map((g) => (
            <li key={g.groupId} data-mastery-group={g.groupId} data-mastered={g.mastered} data-cards={g.cards}>
              <div className="flex justify-between gap-2">
                <span>{g.title}</span>
                <span className="font-mono text-xs text-slate-400">
                  {g.mastered}/{g.cards} mastered{g.recall !== null ? `, recall ${pct(g.recall)}` : ''}
                </span>
              </div>
              <div className="h-2 rounded bg-slate-800 w-full" aria-hidden>
                <div className="h-2 rounded bg-emerald-500/70" style={{ width: `${g.cards ? Math.round((100 * g.mastered) / g.cards) : 0}%` }} />
                <div className="h-2 -mt-2 rounded bg-emerald-500/25" style={{ width: `${g.cards ? Math.round((100 * g.reviewed) / g.cards) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {summary.riskiest.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Most likely to cost you a game</h4>
          <p className="text-xs text-slate-400">How often the position comes up, times the chance you have forgotten it.</p>
          <ul className="space-y-1">
            {summary.riskiest.map((row) => (
              <li key={row.card.id} data-risk-card={row.card.id} className="flex items-center justify-between gap-2">
                <span>
                  {cardName(row.card)}: recall {pct(row.recall)}, on the board in {pct(row.card.reachProb ?? 1)} of the games of its opening
                </span>
                {onOpenLesson && row.card.lessonIds[0] && allCurriculumLessons.some((l) => l.id === row.card.lessonIds[0]) && (
                  <button
                    type="button"
                    data-action="progress-open"
                    onClick={() => onOpenLesson(row.card.lessonIds[0])}
                    className="text-xs text-emerald-300 hover:text-white underline whitespace-nowrap"
                  >
                    Open the lesson
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.confusions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Moves you mix up</h4>
          <ul className="space-y-1">
            {summary.confusions.map((row) => (
              <li key={`${row.card.id}|${row.wrong}`} data-confusion={row.wrong}>
                {cardName(row.card)}: you played <b className="text-rose-300 font-mono">{labelAt(row.card.fen, row.wrong)}</b> instead of{' '}
                <b className="text-emerald-300 font-mono">{labelAt(row.card.fen, row.card.accepted[0])}</b>
                {row.count > 1 ? ` (${row.count} times)` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reviews due, the next two weeks</h4>
        <div className="flex items-end gap-1 h-20" data-section="due-forecast">
          {summary.dueByDay.map((n, day) => (
            <div key={day} className="flex-1 flex flex-col items-center justify-end gap-0.5" data-due-day={day} data-due-count={n} title={`${day === 0 ? 'Today' : `In ${day} days`}: ${n}`}>
              <span className="text-[10px] text-slate-400">{n || ''}</span>
              <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${Math.round((56 * n) / maxDue)}px` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Today</span>
          <span>In two weeks</span>
        </div>
      </div>
    </div>
  );
};

interface ProgressPanelProps {
  onClose: () => void;
  onOpenLesson?: (lessonId: string) => void;
}

/** Progress from the review cards (DC-8), in a modal over the Lessons tab. */
export const ProgressPanel: React.FC<ProgressPanelProps> = ({ onClose, onOpenLesson }) => {
  const [data, setData] = useState<{ cards: StoredCard[]; revlog: StoredRevlog[] } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([CardService.getAllCards(), db.revlog.toArray()])
      .then(([cards, revlog]) => alive && setData({ cards, revlog }))
      .catch(() => alive && setData({ cards: [], revlog: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => (data ? summarizeProgress(data.cards, data.revlog) : null), [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm" data-modal="progress">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Your progress</h2>
            <p className="text-xs text-slate-400">From the review cards: one per position you have to find a move in.</p>
          </div>
          <button type="button" data-action="progress-close" onClick={onClose} className="text-slate-400 hover:text-white text-sm underline">
            Close
          </button>
        </div>
        {!summary ? (
          <p className="text-sm text-slate-400">Reading your cards…</p>
        ) : (
          <ProgressSummaryView
            summary={summary}
            onOpenLesson={
              onOpenLesson
                ? (id) => {
                    onOpenLesson(id);
                    onClose();
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
};
