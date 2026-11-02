import React, { useMemo } from 'react';
import { DEFAULT_MILESTONES, evaluateMilestones, type MilestoneResult } from '../analytics/planMilestones';
import { MISTAKE_LABEL } from '../analytics/errorTaxonomy';
import { replyLabel } from '../analytics/review';
import type { SparRequest } from '../services/sparLog';
import type { CriticalMoment } from '../types/review';

/** A spar is ten of the student's moves; the review is offered from then on (and on demand before). */
export const SPAR_MOVES = 10;

export interface SparReview {
  milestones: MilestoneResult[];
  moments: CriticalMoment[];
  engine: 'maia' | 'material';
}

interface SparPanelProps {
  request: SparRequest;
  /** The position the spar began from. */
  startFen: string;
  /** The spar's moves so far, both sides, from `startFen`. */
  moves: string[];
  review: SparReview | null;
  reviewing: boolean;
  progressText?: string;
  onReview: () => void;
  onRestart: () => void;
  onLeave: () => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The plan goals of a spar so far: each one reached, done before the spar began, or not yet. */
export function liveMilestones(request: SparRequest, startFen: string, moves: string[]): MilestoneResult[] {
  return evaluateMilestones(startFen, moves, request.studentColor, [...DEFAULT_MILESTONES, ...request.milestones]);
}

/**
 * The coach panel of a spar (CL-6) on the Play tab: the lesson it came from, the student's moves
 * against Maia, the plan goals as they are reached, and after the review the goals met and the
 * moments that cost expected score.
 */
export const SparPanel: React.FC<SparPanelProps> = ({ request, startFen, moves, review, reviewing, progressText, onReview, onRestart, onLeave }) => {
  const ownMoves = useMemo(() => {
    let turn = startFen.split(' ')[1];
    let n = 0;
    for (let i = 0; i < moves.length; i++) {
      if (turn === request.studentColor) n++;
      turn = turn === 'w' ? 'b' : 'w';
    }
    return n;
  }, [moves, startFen, request.studentColor]);
  const goals = review ? review.milestones : liveMilestones(request, startFen, moves);
  const side = request.studentColor === 'w' ? 'White' : 'Black';

  const goalText = (g: MilestoneResult) => {
    if (g.status === 'already') return 'done before the spar';
    if (g.status === 'met') return g.ply !== undefined ? `reached on your move ${Math.floor(g.ply / 2) + 1}${g.detail ? ` (${g.detail})` : ''}` : g.detail ?? 'reached';
    return review ? `missed${g.detail ? `: ${g.detail}` : ''}` : 'not yet';
  };

  return (
    <section data-section="spar" data-spar-moves={ownMoves} className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-4 text-sm text-slate-200 space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-300">
          {request.lessonId.startsWith('review:') ? 'Play on from your game' : 'Spar from a lesson'}
        </div>
        <div className="font-bold text-white">{request.title}</div>
        <div className="text-xs text-slate-400">
          You have {side} against Maia {request.elo}, without the opening book. Your moves: {Math.min(ownMoves, SPAR_MOVES)} of {SPAR_MOVES}
          {ownMoves > SPAR_MOVES ? ` (and ${ownMoves - SPAR_MOVES} more)` : ''}.
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-300 mb-1">The plan</div>
        <ul className="space-y-0.5">
          {goals.map((g) => (
            <li key={g.label} data-milestone={g.label} data-status={g.status} className="flex justify-between gap-2">
              <span>
                <span className={g.status === 'missed' ? (review ? 'text-rose-300' : 'text-slate-400') : 'text-emerald-300'}>{g.status === 'missed' ? (review ? '✗' : '·') : '✓'}</span> {g.label}
              </span>
              <span className="text-xs text-slate-400 text-right">{goalText(g)}</span>
            </li>
          ))}
        </ul>
      </div>

      {review && (
        <div data-section="spar-review">
          <div className="text-xs font-semibold text-slate-300 mb-1">The moves that cost you</div>
          {review.moments.length === 0 ? (
            <p className="text-xs text-slate-400">
              {review.engine === 'maia' ? 'No move lowered your expected score by 15 points or more.' : 'No move lost material or allowed a mate.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {review.moments.map((m) => (
                <li key={m.ply} data-spar-moment={m.type} className="text-xs">
                  <b className="font-mono text-white">{m.label}</b> {MISTAKE_LABEL[m.type]}
                  {m.expectedBefore !== undefined && m.expectedAfter !== undefined ? ` (expected score ${pct(m.expectedBefore)} → ${pct(m.expectedAfter)})` : ''}
                  {m.refutation ? `; punished by ${replyLabel(m.fenBefore, m.refutation)}` : ''}
                  {m.type !== 'positional' && m.keeping.length ? `; better: ${m.keeping.slice(0, 3).join(', ')}` : ''}.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-action="spar-review"
          onClick={onReview}
          disabled={reviewing || ownMoves === 0}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 ${ownMoves >= SPAR_MOVES ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
          {review ? 'Review again' : ownMoves >= SPAR_MOVES ? 'Ten moves played: review the spar' : 'Review the spar now'}
        </button>
        <button type="button" data-action="spar-restart" onClick={onRestart} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white">
          Start again
        </button>
        <button type="button" data-action="spar-leave" onClick={onLeave} className="text-xs text-slate-400 hover:text-white underline">
          Leave the spar
        </button>
        {reviewing && (
          <span className="text-xs text-slate-400" data-spar-progress>
            {progressText ?? 'Reviewing…'}
          </span>
        )}
      </div>
    </section>
  );
};
