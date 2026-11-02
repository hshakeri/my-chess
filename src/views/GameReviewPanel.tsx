import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db/database';
import { CardService } from '../services/cards';
import { cardSpecsFromReview, moveLabel, reviewGame, type ReviewInput } from '../analytics/review';
import { MISTAKE_CHECK, MISTAKE_LABEL } from '../analytics/errorTaxonomy';
import type { ReviewProgress } from '../engine/worker/engineClient';
import { useEngineClient } from '../engine/EngineContext';
import type { StoredGame } from '../types/db';
import type { CriticalMoment, GameReview, StudentMark } from '../types/review';
import type { SparRequest } from '../services/sparLog';
import type { HumanElo } from '../types/engine';

/** At most this many moves can be marked before the engine's review is shown. */
const MAX_MARKS = 3;

interface GameReviewPanelProps {
  game: StoredGame;
  /** The position on the replay board: the number of moves played to reach it. */
  currentPly: number;
  onShowPly: (ply: number) => void;
  /** Play a critical moment's position on against Maia on the Play tab (CL-6). */
  onSpar?: (request: SparRequest) => void;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BANDS: HumanElo[] = [1100, 1300, 1500, 1700, 1900];
/** The Maia band nearest the opponent's rating (the app's bands run from 1100 to 1900). */
export const nearestBand = (rating: number | undefined): HumanElo =>
  BANDS.reduce((best, b) => (Math.abs(b - (rating ?? 1100)) < Math.abs(best - (rating ?? 1100)) ? b : best), BANDS[0]);

type Phase = 'loading' | 'idle' | 'marking' | 'revealed';
type Run = { result: Promise<GameReview | null>; cancel: () => void };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const stageText: Record<ReviewProgress['stage'], string> = {
  loading: 'Loading the Maia model',
  scoring: 'Maia is scoring the positions',
  classifying: 'Naming the mistakes',
};

/**
 * Post-game review (CL-3), engine off first: the student marks up to three moves they think went
 * wrong, with a reason, while the engine reviews the game unseen in the worker; then the engine's
 * critical moments are shown beside the marks, and every mistake with a material answer becomes a
 * review card for Today's session.
 */
export const GameReviewPanel: React.FC<GameReviewPanelProps> = ({ game, currentPly, onShowPly, onSpar }) => {
  // The app's one engine worker, so a review does not load the Maia model a second time
  const engineClient = useEngineClient();
  const userColor: 'white' | 'black' = game.userColor === 'black' ? 'black' : 'white';
  const opponent = userColor === 'white' ? game.black.name : game.white.name;
  const isUserMove = (moveIndex: number) => (moveIndex % 2 === 0) === (userColor === 'white');

  const [phase, setPhase] = useState<Phase>('loading');
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [engineResult, setEngineResult] = useState<GameReview | null>(null);
  const [review, setReview] = useState<GameReview | null>(null);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [revealWanted, setRevealWanted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<Run | null>(null);
  // A batch review of this game, kept hidden until the student has made their marks
  const batchRef = useRef<GameReview | null>(null);
  const marksRef = useRef<StudentMark[]>([]);
  marksRef.current = marks;

  useEffect(() => {
    let alive = true;
    setPhase('loading');
    db.reviews
      .get(game.id)
      .then((saved) => {
        if (!alive) return;
        batchRef.current = null;
        if (saved?.source === 'batch') {
          batchRef.current = saved;
          setPhase('idle');
        } else if (saved) {
          setReview(saved);
          setMarks(saved.marks);
          setPhase('revealed');
        } else {
          setPhase('idle');
        }
      })
      .catch(() => alive && setPhase('idle'));
    return () => {
      alive = false;
      runRef.current?.cancel();
      runRef.current = null;
    };
  }, [game.id]);

  /** Start the engine's review in the background; its result stays hidden until the reveal. */
  const startEngine = useCallback(() => {
    setError(null);
    setEngineResult(null);
    setProgress(null);
    const input: ReviewInput = {
      gameId: game.id,
      movesSan: game.movesSan,
      userColor,
      whiteRating: game.white.rating,
      blackRating: game.black.rating,
      pgn: game.pgn,
    };
    const client = engineClient;
    let run: Run;
    if (client) {
      run = client.reviewGame(input, setProgress);
    } else {
      // No engine worker: material alone, on this thread
      let stopped = false;
      run = {
        result: reviewGame(input, null, { onProgress: (stage, done, total) => setProgress({ stage, done, total }), isCancelled: () => stopped }).catch((err) =>
          stopped ? null : Promise.reject(err)
        ),
        cancel: () => (stopped = true),
      };
    }
    runRef.current = run;
    run.result
      .then((result) => {
        if (runRef.current !== run) return;
        runRef.current = null;
        if (result) setEngineResult(result);
        else setRevealWanted(false);
      })
      .catch((err) => {
        if (runRef.current !== run) return;
        runRef.current = null;
        setRevealWanted(false);
        setError(err?.message || 'The review failed.');
      });
  }, [game, userColor, engineClient]);

  const beginReview = () => {
    setMarks([]);
    setPhase('marking');
    if (batchRef.current) {
      // The batch review already has the engine's moments
      setError(null);
      setEngineResult(batchRef.current);
    } else {
      startEngine();
    }
  };

  /** Save the review with the student's marks and turn its mistakes into review cards. */
  const reveal = useCallback(
    async (result: GameReview) => {
      const { source: _batch, ...engineReview } = result;
      void _batch;
      batchRef.current = null;
      const withMarks: GameReview = { ...engineReview, marks: marksRef.current.map((m) => ({ ...m, reason: m.reason.trim() })) };
      let cardIds: string[] = [];
      try {
        cardIds = (await CardService.ensureCards(cardSpecsFromReview(withMarks, opponent))).map((c) => c.id);
      } catch (err) {
        console.warn('Could not create review cards:', err);
      }
      const saved = { ...withMarks, cardIds };
      try {
        await db.reviews.put(saved);
      } catch (err) {
        console.warn('Could not save the review:', err);
      }
      setReview(saved);
      setRevealWanted(false);
      setPhase('revealed');
    },
    [opponent]
  );

  // The reveal waits for the engine when it was asked for before the engine finished
  useEffect(() => {
    if (revealWanted && engineResult && phase === 'marking') void reveal(engineResult);
  }, [revealWanted, engineResult, phase, reveal]);

  const askReveal = () => {
    setRevealWanted(true);
    if (!runRef.current && !engineResult) startEngine();
  };

  const cancelEngine = () => {
    runRef.current?.cancel();
    runRef.current = null;
    setRevealWanted(false);
    setProgress(null);
  };

  const reviewAgain = async () => {
    try {
      await db.reviews.delete(game.id);
    } catch {
      /* the next reveal overwrites it anyway */
    }
    setReview(null);
    beginReview();
  };

  const setLossCause = async (lossCause: string) => {
    if (!review) return;
    const next = { ...review, lossCause };
    setReview(next);
    try {
      await db.reviews.put(next);
    } catch (err) {
      console.warn('Could not save the loss cause:', err);
    }
  };

  // ---- rendering ------------------------------------------------------------------------------

  const moveIndex = currentPly - 1;
  const canMark =
    phase === 'marking' && moveIndex >= 0 && isUserMove(moveIndex) && marks.length < MAX_MARKS && !marks.some((m) => m.ply === moveIndex);
  const progressText = progress
    ? `${stageText[progress.stage]}${progress.total > 1 ? `: ${Math.round((100 * progress.done) / progress.total)}%` : '…'}`
    : 'Starting the engine…';

  const momentRow = (m: CriticalMoment, mark: StudentMark | undefined) => (
    <li key={m.ply} data-review-moment={m.ply} data-moment-type={m.type} className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
      <button type="button" onClick={() => onShowPly(m.ply)} className="text-left w-full">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono font-bold text-white">{m.label}</span>
          {m.expectedBefore !== undefined && m.expectedAfter !== undefined && (
            <span className="text-xs text-slate-400">
              Expected score {pct(m.expectedBefore)} → <b className="text-rose-300">{pct(m.expectedAfter)}</b>
            </span>
          )}
        </div>
        <div className="text-sm text-amber-200 mt-0.5">{MISTAKE_LABEL[m.type]}</div>
      </button>
      <ul className="mt-1.5 space-y-0.5 text-xs text-slate-300">
        {m.refutation && (
          <li>
            Punished by <b className="font-mono">{moveLabel(m.ply + 1, m.refutation)}</b>.
          </li>
        )}
        {m.loss > 0 && <li>Material lost against the best move: {m.loss / 100} pawn{m.loss === 100 ? '' : 's'}.</li>}
        {m.missed && (
          <li>
            Missed: <b className="font-mono">{moveLabel(m.ply, m.missed)}</b>.
          </li>
        )}
        {m.type !== 'positional' && m.type !== 'missed_mate' && m.keeping.length > 0 && (
          <li>
            Moves that avoid it: <span className="font-mono">{m.keeping.slice(0, 4).join(', ')}</span>
            {m.keeping.length > 4 ? ` and ${m.keeping.length - 4} more` : ''}.
          </li>
        )}
        {m.maiaBest && m.maiaBest !== m.played && <li>Maia's most likely move for your rating: <span className="font-mono">{m.maiaBest}</span>.</li>}
        {m.playedShare !== undefined && <li>A player of your rating plays {m.played} here {pct(m.playedShare)} of the time.</li>}
        {m.clockLeft !== undefined && (
          <li>
            Clock: {clock(m.clockLeft)} left, {m.spent ?? 0} s spent on the move.
          </li>
        )}
        <li className="text-slate-400 italic">{MISTAKE_CHECK[m.type]}</li>
      </ul>
      <div className="mt-1.5 text-xs flex flex-wrap items-center justify-between gap-2" data-review-marked={mark ? 'yes' : 'no'}>
        {mark ? (
          <span className="text-emerald-300">You marked it{mark.reason ? `: "${mark.reason}"` : '.'}</span>
        ) : (
          <span className="text-slate-500">You did not mark this move.</span>
        )}
        {onSpar && (
          <button
            type="button"
            data-action="review-spar"
            onClick={() =>
              onSpar({
                lessonId: `review:${game.id}`,
                title: `Your game vs ${opponent}, move ${Math.floor(m.ply / 2) + 1}`,
                initialFen: START_FEN,
                movesSan: game.movesSan.slice(0, m.ply),
                studentColor: userColor === 'white' ? 'w' : 'b',
                elo: nearestBand(userColor === 'white' ? game.black.rating : game.white.rating),
                milestones: [],
              })
            }
            className="px-2 py-1 rounded bg-sky-800 hover:bg-sky-700 text-white"
            title="Play this position again against Maia, from the move before the mistake"
          >
            Play it again vs Maia
          </button>
        )}
      </div>
    </li>
  );

  return (
    <section data-section="game-review" data-review-phase={phase} className="md:col-span-12 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold text-white">Review this game</h3>
        {phase === 'revealed' && (
          <button type="button" data-action="review-again" onClick={reviewAgain} className="text-xs text-slate-400 hover:text-white underline">
            Review again
          </button>
        )}
      </div>

      {phase === 'loading' && <p className="text-sm text-slate-400">Reading saved reviews…</p>}

      {phase === 'idle' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">
            First mark up to three of your moves you think went wrong, and say why in a line. Then the engine's review is shown beside your marks, and
            each mistake it can check becomes a card in Today's session.
          </p>
          {batchRef.current && (
            <p className="text-xs text-slate-400" data-review-batch>
              The batch review on the Diagnostics tab has already checked this game; what it found stays hidden until you have made your marks.
            </p>
          )}
          <button
            type="button"
            data-action="review-start"
            onClick={beginReview}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
          >
            Start the review
          </button>
        </div>
      )}

      {phase === 'marking' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Step through the game and mark up to {MAX_MARKS} of your moves. The engine is already checking the game, but its findings stay hidden until you
            ask for them.
          </p>
          <button
            type="button"
            data-action="review-mark"
            disabled={!canMark}
            onClick={() => setMarks((ms) => [...ms, { ply: moveIndex, reason: '' }].sort((a, b) => a.ply - b.ply))}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-sm border border-slate-700"
          >
            {moveIndex >= 0 && isUserMove(moveIndex) ? `Mark ${moveLabel(moveIndex, game.movesSan[moveIndex])} as a mistake` : 'Go to one of your moves to mark it'}
          </button>
          {marks.length > 0 && (
            <ul className="space-y-1.5" data-review-marks={marks.length}>
              {marks.map((m) => (
                <li key={m.ply} className="flex items-center gap-2">
                  <button type="button" onClick={() => onShowPly(m.ply + 1)} className="font-mono text-sm text-white w-24 text-left">
                    {moveLabel(m.ply, game.movesSan[m.ply])}
                  </button>
                  <input
                    type="text"
                    data-input="review-reason"
                    value={m.reason}
                    maxLength={120}
                    placeholder="Why? One line."
                    onChange={(e) => setMarks((ms) => ms.map((x) => (x.ply === m.ply ? { ...x, reason: e.target.value } : x)))}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                  />
                  <button
                    type="button"
                    aria-label="Remove this mark"
                    onClick={() => setMarks((ms) => ms.filter((x) => x.ply !== m.ply))}
                    className="text-slate-500 hover:text-white px-1"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-action="review-reveal"
              disabled={revealWanted}
              onClick={askReveal}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium"
            >
              Show the engine's review
            </button>
            {revealWanted && (
              <>
                <span className="text-xs text-slate-400" data-review-progress>
                  {progressText}
                </span>
                <button type="button" data-action="review-cancel" onClick={cancelEngine} className="text-xs text-slate-400 hover:text-white underline">
                  Cancel
                </button>
              </>
            )}
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      )}

      {phase === 'revealed' && review && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300" data-review-summary>
            {review.criticalMoments.length === 0
              ? `No critical moment in your ${review.movesReviewed} moves.`
              : `${review.criticalMoments.length} critical moment${review.criticalMoments.length === 1 ? '' : 's'} in your ${review.movesReviewed} moves.`}{' '}
            {review.engine === 'maia'
              ? 'Maia scored every position for players of your two ratings; a critical moment is a move that lowered your expected score by 15 points or more.'
              : 'The Maia model was not available, so only moves that lost material, or allowed or missed a mate, are listed.'}
          </p>
          {review.criticalMoments.length > 0 && (
            <ol className="space-y-2">{review.criticalMoments.map((m) => momentRow(m, review.marks.find((x) => x.ply === m.ply)))}</ol>
          )}
          {review.marks.some((x) => !review.criticalMoments.some((m) => m.ply === x.ply)) && (
            <div className="text-xs text-slate-400">
              <div className="font-semibold text-slate-300">Your other marks</div>
              <ul>
                {review.marks
                  .filter((x) => !review.criticalMoments.some((m) => m.ply === x.ply))
                  .map((x) => (
                    <li key={x.ply}>
                      {moveLabel(x.ply, game.movesSan[x.ply])}
                      {x.reason ? ` ("${x.reason}")` : ''}: the engine does not count this move as a turning point.
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-emerald-300" data-review-cards={review.cardIds.length}>
            {review.cardIds.length > 0
              ? `${review.cardIds.length} position${review.cardIds.length === 1 ? '' : 's'} from this game ${review.cardIds.length === 1 ? 'is' : 'are'} now in Today's session.`
              : 'No position became a card: a card needs a mistake the material search can check a move against.'}
          </p>
          {game.userResult === 'loss' && (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              What decided this game?
              <select
                data-select="loss-cause"
                value={review.lossCause ?? ''}
                onChange={(e) => setLossCause(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
              >
                <option value="">Choose one</option>
                {[...new Set(review.criticalMoments.map((m) => MISTAKE_LABEL[m.type]))].map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
                <option value="Time trouble">Time trouble</option>
                <option value="The opening">The opening</option>
                <option value="Something else">Something else</option>
              </select>
            </label>
          )}
        </div>
      )}
    </section>
  );
};
