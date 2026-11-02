import React, { useMemo } from 'react';
import { WorksheetBoard } from './WorksheetsView';
import { MOTIF_LABEL, numberLine, pickSession, readTacticStates, tacticsDeck, type TacticPosition } from '../services/tacticsDeck';

/** Positions on one sheet; the answers fill the back. */
export const SHEET_TACTICS = 12;

const toMove = (t: TacticPosition) => (t.fen.split(' ')[1] === 'b' ? 'Black' : 'White');

/**
 * A printable sheet of the tactics deck (DC-2, DC-4): the next twelve positions a session would
 * take (the ones to redo first, then new ones), each drawn from the side to move with the move that
 * had just been played; the back holds the answer, the motif and Stockfish's line.
 */
/**
 * `ahead`: the visualization format (DC-4): each diagram is the position two plies earlier, with the
 * two moves that were played, and the win is to be found in the position after them (tactics only).
 */
export const TacticsSheet: React.FC<{ deck?: TacticPosition[]; ahead?: boolean }> = ({ deck = tacticsDeck, ahead = false }) => {
  const items = useMemo(
    () => pickSession(ahead ? deck.filter((t) => t.before && t.motif !== 'quiet') : deck, readTacticStates(), SHEET_TACTICS),
    [deck, ahead]
  );
  if (!items.length) {
    return (
      <p className="text-sm text-slate-400" data-section="tactics-sheet" data-items={0}>
        Every position of the tactics deck is retired. Well done.
      </p>
    );
  }
  return (
    <div
      className="printable-sheet bg-white text-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none w-full"
      data-printable="sheet"
      data-section="tactics-sheet"
      data-ahead={ahead}
      data-items={items.length}
    >
      <div className="border-b-2 border-slate-900 pb-3 mb-5">
        <span className="text-xs uppercase font-bold tracking-widest text-slate-500">Your own games</span>
        <h2 className="text-2xl font-extrabold text-slate-950">{ahead ? 'Two moves ahead' : 'Tactics from your games'}</h2>
        {ahead ? (
          <p className="text-sm text-slate-700 mt-1">
            Each diagram is a position from one of your games two moves before a tactic, with the two moves that were played. Play them in your head,
            without moving anything, and find the winning move in the position they reach. The answers are on the back.
          </p>
        ) : (
        <p className="text-sm text-slate-700 mt-1">
          Each diagram is the position just after a mistake in one of your games, yours or your opponent's, drawn from the side to move. In most of
          them one move wins clearly; in a few nothing does and a solid move is right. Find the best move and write it down, in under a minute each. The
          answers are on the back.
        </p>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-printable="tactics-front">
        {items.map((t, k) => (
          <figure key={t.id} className="break-inside-avoid" data-tactics-item={k + 1}>
            <WorksheetBoard fen={ahead && t.before ? t.before.fen : t.fen} flipped={toMove(t) === 'Black'} size="sm" printable="exercise-board" label={`Tactic ${k + 1}`} />
            <figcaption className="text-xs text-slate-800 mt-1">
              {ahead && t.before ? (
                <>
                  <b>{k + 1}.</b> After {numberLine(t.before.fen, t.before.moves)}, {toMove(t)} to play and win. ________
                </>
              ) : (
                <>
                  <b>{k + 1}.</b> {toMove(t)} to play, after {t.lastMove.san}. ________
                </>
              )}
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
          {items.map((t, k) => (
            <li key={t.id} data-tactics-answer={k + 1}>
              <b>{k + 1}.</b> {t.solution}: {MOTIF_LABEL[t.motif].toLowerCase()}
              {t.motif === 'quiet' ? ` (as good: ${t.accepted.filter((m) => m !== t.solution).slice(0, 3).join(', ')}; in the game, ${t.played} gave something away)` : ''}.
              Stockfish's line: {numberLine(t.fen, t.line)}. From your game of {t.date}.
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
