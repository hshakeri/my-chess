import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from '../components/Chessboard';
import { RulesEngine } from '../engine/rules';
import {
  GOOD_MS,
  HARD_MS,
  MOTIF_LABEL,
  RETIRE_STREAK,
  SESSION_SIZE,
  gradeSolve,
  isControl,
  isRetired,
  logTacticSession,
  missedInGame,
  numberLine,
  pickSession,
  readTacticSessions,
  readTacticStates,
  recordSolve,
  tacticsDeck,
  type TacticGrade,
  type TacticPosition,
  type TacticSession,
  type TacticState,
} from '../services/tacticsDeck';
import type { SparRequest } from '../services/sparLog';
import type { Square } from '../types/chess';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const GRADE_LABEL: Record<TacticGrade, string> = { good: 'Good', hard: 'Hard', again: 'Again' };

interface Result {
  correct: boolean;
  ms: number;
  grade: TacticGrade;
  san: string;
}

/** The game the position came from, and what was played there. */
function context(t: TacticPosition): string {
  const found = t.played === t.solution || t.accepted.includes(t.played);
  if (t.ownSide) {
    return `From your game of ${t.date}: your opponent had just played ${t.lastMove.san}. ${found ? 'You found it in the game.' : `In the game you played ${t.played}.`}`;
  }
  return `From your game of ${t.date}, seen from your opponent's side: you had just played ${t.lastMove.san}. ${found ? 'Your opponent found it.' : `Your opponent played ${t.played}.`}`;
}

export const TacticsDeckPanel: React.FC<{ onClose: () => void; deck?: TacticPosition[]; onSpar?: (request: SparRequest) => void }> = ({
  onClose,
  deck = tacticsDeck,
  onSpar,
}) => {
  const [states, setStates] = useState<Record<string, TacticState>>(() => readTacticStates());
  const [session, setSession] = useState<TacticPosition[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'solving' | 'answered' | 'done'>('ready');
  const [result, setResult] = useState<Result | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [sessions, setSessions] = useState<TacticSession[]>(() => readTacticSessions());
  const [now, setNow] = useState(Date.now());
  const rulesRef = useRef(new RulesEngine());
  // The session is kept once, when it is finished, left for a spar, closed or the panel goes away
  const resultsRef = useRef<Result[]>([]);
  const loggedRef = useRef(true);
  const logSession = () => {
    const all = resultsRef.current;
    if (loggedRef.current || !all.length) return;
    loggedRef.current = true;
    const count = (g: TacticGrade) => all.filter((r) => r.grade === g).length;
    setSessions(logTacticSession({ at: Date.now(), good: count('good'), hard: count('hard'), again: count('again'), ms: all.reduce((a, r) => a + r.ms, 0) }));
  };
  useEffect(() => () => logSession(), []);
  const startRef = useRef(0);
  const [, setTick] = useState(0);

  const retired = useMemo(() => deck.filter((t) => isRetired(states[t.id])).length, [deck, states]);
  const yours = useMemo(() => deck.filter((t) => t.ownSide && !isControl(t)), [deck]);
  const missed = useMemo(() => yours.filter(missedInGame).length, [yours]);
  const current = session[index];

  const show = (t: TacticPosition) => {
    rulesRef.current = new RulesEngine(t.fen);
    setResult(null);
    setPhase('solving');
    startRef.current = Date.now();
    setTick((k) => k + 1);
  };

  const start = () => {
    const next = pickSession(deck, states, SESSION_SIZE);
    if (!next.length) return;
    setSession(next);
    setIndex(0);
    setResults([]);
    resultsRef.current = [];
    loggedRef.current = false;
    show(next[0]);
  };

  useEffect(() => {
    if (phase !== 'solving') return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [phase]);

  const onMove = (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    if (phase !== 'solving' || !current) return;
    const probe = new RulesEngine(current.fen);
    const made = probe.makeMove(move);
    if (!made.success) return;
    const san = made.moveRecord!.san;
    const ms = Date.now() - startRef.current;
    const correct = san === current.solution || current.accepted.includes(san);
    const r: Result = { correct, ms, san, grade: gradeSolve(correct, ms) };
    // Written once, outside a state updater (StrictMode may run an updater twice)
    setStates(recordSolve(states, current.id, correct, ms));
    setResult(r);
    setResults((all) => [...all, r]);
    resultsRef.current = [...resultsRef.current, r];
    // The board shows the right move either way
    rulesRef.current.makeMove(correct ? san : current.solution);
    setPhase('answered');
  };

  const next = () => {
    if (index + 1 >= session.length) {
      logSession();
      setPhase('done');
      return;
    }
    setIndex(index + 1);
    show(session[index + 1]);
  };

  const position = rulesRef.current.getPosition();
  const history = rulesRef.current.getHistory();
  const shownLast =
    phase === 'answered' && history.length
      ? { from: history[history.length - 1].uci.slice(0, 2) as Square, to: history[history.length - 1].uci.slice(2, 4) as Square }
      : current
      ? { from: current.lastMove.from as Square, to: current.lastMove.to as Square }
      : null;
  const elapsed = phase === 'solving' ? Math.max(0, now - startRef.current) : 0;
  const toMove = current?.fen.split(' ')[1] === 'b' ? 'Black' : 'White';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm" data-modal="tactics" data-tactics-phase={phase}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Tactics from your games</h2>
            <p className="text-xs text-slate-400" data-tactics-deck={deck.length} data-tactics-retired={retired}>
              {deck.length} positions, each right after a mistake in one of your games, yours or your opponent's. In most of them one move wins clearly; in a few nothing
              does, and any solid move is right. Under{' '}
              {GOOD_MS / 1000} seconds is Good, up to {HARD_MS / 1000} Hard, slower or wrong Again. A position retires after {RETIRE_STREAK} Good solves in
              a row: {retired} retired so far.
            </p>
          </div>
          <button
            type="button"
            data-action="tactics-close"
            onClick={() => {
              logSession();
              onClose();
            }}
            className="text-slate-400 hover:text-white text-sm underline"
          >
            Close
          </button>
        </div>

        {phase === 'ready' || phase === 'done' ? (
          <div className="space-y-3 text-sm text-slate-300">
            {yours.length > 0 && (
              <p className="text-xs text-slate-400" data-tactics-missed={missed}>
                In {yours.length} of the positions you were the one to move: you found the win in your game {yours.length - missed} times and missed it{' '}
                {missed} times. The ones you missed come first.
              </p>
            )}
            {phase === 'done' && (
              <div className="space-y-1" data-section="tactics-summary">
                <p className="text-white">
                  {results.filter((r) => r.grade === 'good').length} Good, {results.filter((r) => r.grade === 'hard').length} Hard,{' '}
                  {results.filter((r) => r.grade === 'again').length} Again, in {seconds(results.reduce((a, r) => a + r.ms, 0))}.
                </p>
                <p className="text-xs text-slate-400">The Again ones come first next time.</p>
              </div>
            )}
            {sessions.length > 0 && (
              <div className="space-y-1" data-section="tactics-sessions" data-sessions={sessions.length}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your last sessions</h4>
                <ul className="space-y-0.5 text-xs font-mono">
                  {sessions
                    .slice(-5)
                    .reverse()
                    .map((x) => {
                      const n = x.good + x.hard + x.again;
                      return (
                        <li key={x.at}>
                          {new Date(x.at).toISOString().slice(0, 10)}: {x.good} Good, {x.hard} Hard, {x.again} Again, {seconds(n ? x.ms / n : 0)} a position
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
            <button
              type="button"
              data-action="tactics-start"
              onClick={start}
              disabled={retired === deck.length}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
            >
              {phase === 'done' ? 'Another session' : `Start a session of ${Math.min(SESSION_SIZE, deck.length - retired)}`}
            </button>
          </div>
        ) : (
          current && (
            <div className="grid md:grid-cols-2 gap-4 items-start" data-tactic={current.id} data-motif={current.motif}>
              <Chessboard
                board={rulesRef.current.getBoard()}
                position={position}
                orientation={current.fen.split(' ')[1] === 'b' ? 'b' : 'w'}
                lastMove={shownLast}
                interactive={phase === 'solving'}
                onMove={onMove}
                getLegalMovesForSquare={(sq) => rulesRef.current.getLegalMovesForSquare(sq)}
              />
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>
                    Position {index + 1} of {session.length}
                  </span>
                  {phase === 'solving' && <span className={`font-mono ${elapsed > GOOD_MS ? 'text-amber-300' : 'text-emerald-300'}`}>{seconds(elapsed)}</span>}
                </div>
                <p className="text-white font-semibold">
                  {toMove} to play, after {current.lastMove.san}: find the best move.
                </p>
                {phase === 'answered' && result && (
                  <div className="space-y-2" data-tactic-result={result.grade} data-correct={result.correct}>
                    <p className={result.correct ? 'text-emerald-300' : 'text-rose-300'}>
                      {result.correct
                        ? `${GRADE_LABEL[result.grade]}: ${result.san} in ${seconds(result.ms)}.`
                        : current.motif === 'quiet'
                        ? `Again: ${result.san} gives something away. Solid moves here: ${current.accepted.slice(0, 4).join(', ')}.`
                        : current.motif === 'lead'
                        ? `Again: ${result.san} gives material back. Safe moves here: ${current.accepted.slice(0, 4).join(', ')}.`
                        : `Again: ${result.san} does not win. The move is ${current.solution}.`}
                    </p>
                    <p>
                      {MOTIF_LABEL[current.motif]}. Stockfish's line: <span className="font-mono">{numberLine(current.fen, current.line)}</span>
                    </p>
                    <p className="text-xs text-slate-400">{context(current)}</p>
                    {current.share != null && (
                      <p className="text-xs text-slate-400" data-tactic-share={current.share}>
                        Players of your rating find {current.solution} about {Math.max(1, Math.round(current.share * 100))}% of the time (Maia).
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-action="tactics-next"
                        onClick={next}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium"
                      >
                        {index + 1 >= session.length ? 'Finish' : 'Next'}
                      </button>
                      {/* After a mate in one there is nothing left to play */}
                      {onSpar && current.motif !== 'mate-in-one' && current.motif !== 'quiet' && (
                        <button
                          type="button"
                          data-action="tactics-spar"
                          onClick={() => {
                            logSession();
                            onSpar({
                              lessonId: `review:tactic-${current.id}`,
                              title: `Your game of ${current.date}: win it from here`,
                              initialFen: current.fen,
                              movesSan: [current.solution],
                              studentColor: current.fen.split(' ')[1] === 'b' ? 'b' : 'w',
                              elo: 1100,
                              milestones: [],
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
                          title="Play the won position on against Maia: keep the lead and finish the game"
                        >
                          Play it out vs Maia
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
