import React, { useEffect, useState } from 'react';
import { db } from '../db/database';
import { gamesRepo } from '../db/gamesRepo';
import { MISTAKE_CHECK, MISTAKE_LABEL } from '../analytics/errorTaxonomy';
import { labelAt, replyLabel } from '../analytics/review';
import { WorksheetBoard } from './WorksheetsView';
import type { StoredGame } from '../types/db';
import type { CriticalMoment, GameReview } from '../types/review';

/** Positions on one sheet; the answers fill the back. */
export const SHEET_MISTAKES = 12;

export interface MistakeItem {
  gameId: string;
  opponent: string;
  date: string;
  flipped: boolean;
  moment: CriticalMoment;
}

/**
 * The newest mistakes of the reviewed games that have a move to find (not positional ones), at most
 * `limit`, newest game first.
 */
export function mistakeItems(reviews: GameReview[], games: StoredGame[], limit = SHEET_MISTAKES): MistakeItem[] {
  const byId = new Map(games.map((g) => [g.id, g]));
  const out: MistakeItem[] = [];
  const reviewed = reviews.filter((r) => byId.has(r.gameId)).sort((a, b) => byId.get(b.gameId)!.timestamp - byId.get(a.gameId)!.timestamp);
  for (const review of reviewed) {
    const game = byId.get(review.gameId)!;
    const opponent = review.userColor === 'white' ? game.black.name : game.white.name;
    for (const moment of review.criticalMoments) {
      if (moment.type === 'positional' || moment.keeping.length === 0) continue;
      out.push({ gameId: game.id, opponent, date: new Date(game.timestamp).toISOString().slice(0, 10), flipped: review.userColor === 'black', moment });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * A printable sheet of the student's own mistakes (DC-4): the position before each mistake from the
 * reviewed games, drawn from the student's side, with the move played named and "find a better
 * move"; the back holds the moves that avoid the mistake, the punishing reply and the board check.
 */
export const MistakeSheet: React.FC = () => {
  const [items, setItems] = useState<MistakeItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([db.reviews.toArray(), gamesRepo.getAllGames()])
      .then(([reviews, games]) => alive && setItems(mistakeItems(reviews, games)))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!items) return <p className="text-sm text-slate-400">Reading your reviews…</p>;
  if (!items.length) {
    return (
      <p className="text-sm text-slate-400" data-section="mistake-sheet" data-items={0}>
        No reviewed game has a mistake with a move to find yet. Review some games in the Games tab, or with the batch review on Diagnostics, then come back.
      </p>
    );
  }

  return (
    <div
      className="printable-sheet bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none w-full"
      data-printable="sheet"
      data-section="mistake-sheet"
      data-items={items.length}
    >
      <div className="border-b-2 border-slate-900 pb-3 mb-5">
        <span className="text-xs uppercase font-bold tracking-widest text-slate-500">Your own games</span>
        <h2 className="text-2xl font-extrabold text-slate-950">Mistakes from your reviewed games</h2>
        <p className="text-sm text-slate-700 mt-1">
          Each diagram is the position before a move that cost you, drawn from your side, with the move you played. Find a better move and write it
          down. The answers are on the back.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-printable="mistake-front">
        {items.map((item, k) => (
          <figure key={`${item.gameId}-${item.moment.ply}`} className="break-inside-avoid" data-mistake-item={k + 1}>
            <WorksheetBoard fen={item.moment.fenBefore} flipped={item.flipped} size="sm" printable="exercise-board" label={`Mistake ${k + 1}`} />
            <figcaption className="text-xs text-slate-800 mt-1">
              <b>{k + 1}.</b> vs {item.opponent}, {item.date}. You played {labelAt(item.moment.fenBefore, item.moment.played)}. Better: ________
            </figcaption>
          </figure>
        ))}
      </div>
      <div
        className="worksheet-answer-key break-before-page page-break-always mt-10 pt-8 border-t-4 border-slate-900 print:mt-0 print:pt-6"
        data-printable="answer-key"
        style={{ breakBefore: 'page', pageBreakBefore: 'always' }}
      >
        <h3 className="text-xl font-extrabold text-slate-950 mb-3">Answers</h3>
        <ol className="space-y-2 text-sm text-slate-800">
          {items.map((item, k) => {
            const m = item.moment;
            return (
              <li key={`${item.gameId}-${m.ply}`} data-mistake-answer={k + 1}>
                <b>{k + 1}.</b> {MISTAKE_LABEL[m.type]}. Better: {m.keeping.slice(0, 3).map((san) => labelAt(m.fenBefore, san)).join(', ')}
                {m.keeping.length > 3 ? ` (and ${m.keeping.length - 3} more)` : ''}.
                {m.refutation ? ` After ${labelAt(m.fenBefore, m.played)}, ${replyLabel(m.fenBefore, m.refutation)} punished it.` : ''}{' '}
                <i>{MISTAKE_CHECK[m.type]}</i>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
