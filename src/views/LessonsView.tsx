import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import {
  BookOpen,
  Award,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Compass,
  MessageSquare,
  Library,
  ListChecks,
  Target,
} from 'lucide-react';
import {
  allCurriculumLessons,
  curriculumCourses,
  scandinavianRefutationDrill,
  weaknessDrillLessons,
} from '../curriculum';
import { positionKey, enumerateDecisions, chooseOpponentReply, DecisionSpec } from '../curriculum/builder';
import { lessonFromDecision } from '../curriculum/factories';
import { CurriculumLesson, CurriculumMove, CurriculumExercise } from '../types/curriculum';
import { Chessboard, BoardArrow, BoardHighlight } from '../components/Chessboard';
import { MoveTree } from '../components/MoveTree';
import { RulesEngine } from '../engine/rules';
import { Square, ChessPosition } from '../types/chess';
import { StoredCard } from '../types/db';
import { CardService, CardRating } from '../services/cards';
import { canonicalFenKey } from '../services/fenKey';
import { buildQueue, LearningSteps } from '../services/sessionQueue';

type LessonPhase = 'line' | 'exercises' | 'complete';

interface RunStats {
  mistakes: number;
  hintLevel: number; // highest hint level used in this run
  decisions: number;
}

interface LessonsViewProps {
  /** Lesson to open first (e.g. handed over from Diagnostics). */
  initialLessonId?: string;
  /** A lesson built on the fly (a repertoire line or a deviation drill) to open first. */
  initialLesson?: CurriculumLesson;
}

/** One scheduled decision of the current run, for the review log under the board. */
interface ReviewLogEntry {
  key: string;
  rating: CardRating;
  responseMs: number;
  dueIn: string;
}

/** Today's session: due cards presented one position at a time, failed ones resurfacing within minutes. */
interface ReviewSession {
  id: string;
  cards: StoredCard[];
  index: number;
  completed: number;
  ratings: Record<CardRating, number>;
  current: StoredCard | null;
  sourceTitle: string | null;
  sourceLessonId: string | null;
}

const RATING_LABELS: Record<CardRating, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const SESSION_LESSON_PREFIX = 'card-lesson-';
const LEARNING_STEP_WINDOW_MS = 15 * 60 * 1000;

function formatDueIn(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The line for this walk-through. The first run of a lesson follows the scripted main line (its
 * annotations tell the story); every later run (Restart, Drill point) picks the opponent's replies
 * by their observed frequency so the student meets the replies club players actually give. The
 * prefix before the drill point stays on the main line; after the first chosen alternative the
 * branch continuation is the rest of the line.
 */
function resolveLine(
  lesson: CurriculumLesson,
  startPly: number,
  vary: boolean,
  rng: () => number = Math.random
): CurriculumMove[] {
  if (!vary) return lesson.moves;
  const line: CurriculumMove[] = [];
  // Walk a sequence; when an alternative is chosen, continue walking its continuation (branches can nest)
  const walk = (sequence: CurriculumMove[], firstVariableIndex: number) => {
    for (let i = 0; i < sequence.length; i++) {
      const move = sequence[i];
      if (i >= firstVariableIndex && !move.isUserMove && move.alternatives) {
        const choice = chooseOpponentReply(move, rng);
        if (choice.continuation) {
          line.push({ ply: move.ply, san: choice.san, isUserMove: false, frequency: move.alternatives[choice.san]?.[0]?.frequency });
          walk(choice.continuation, 0);
          return;
        }
      }
      line.push(move);
    }
  };
  walk(lesson.moves, startPly);
  return line;
}

/**
 * The line that runs through `path` (main line, descending into an opponent alternative wherever the
 * path takes one) followed by the rest of that branch; null when the path leaves the lesson tree.
 */
function lineForPath(lesson: CurriculumLesson, path: string[]): CurriculumMove[] | null {
  const line: CurriculumMove[] = [];
  let sequence: CurriculumMove[] = lesson.moves;
  let index = 0;
  for (const san of path) {
    const move = sequence[index];
    if (!move) return null;
    if (move.san === san) {
      line.push(move);
      index += 1;
      continue;
    }
    const branch = !move.isUserMove && move.alternatives ? move.alternatives[san] : undefined;
    if (!branch) return null;
    line.push({ ply: move.ply, san, isUserMove: false, frequency: branch[0]?.frequency });
    sequence = branch;
    index = 0;
  }
  line.push(...sequence.slice(index));
  return line;
}

// Concurrent mounts (React StrictMode mounts twice in development) share one in-flight preparation,
// so the legacy history can never be replayed twice; once it has settled a later mount may run the
// idempotent preparation again.
let prepareCardsPromise: Promise<void> | null = null;
function prepareCardsOnce(specsByLesson: Record<string, DecisionSpec[]>): Promise<void> {
  if (!prepareCardsPromise) {
    prepareCardsPromise = (async () => {
      await CardService.migrateLegacy(specsByLesson);
      await CardService.ensureCards(Object.values(specsByLesson).flat());
    })().finally(() => {
      prepareCardsPromise = null;
    });
  }
  return prepareCardsPromise;
}

const OPPONENT_REPLY_MS = 400;
const ROLLBACK_MS = 450;
const REFUTATION_STEP_MS = 350;
const REFUTATION_HOLD_MS = 700;
// How long a finished line stays on the board (with its last annotation and arrows) before the exercise loads
const LINE_COMPLETE_HOLD_MS = 1600;

const PATTERN_LIBRARY_ID = 'pattern-library';

function cleanSan(san: string): string {
  return san.replace(/[!?+#]/g, '');
}

/** A generic, answer-free theme when the author did not write one. */
function autoTheme(move: CurriculumMove): string {
  const san = move.san;
  if (san === 'O-O' || san === 'O-O-O') return 'King safety: get the king out of the centre before the fight starts.';
  if (san.includes('#')) return 'There is a checkmate available. Look at every check.';
  if (san.includes('+')) return 'Look for a check that gains time or material.';
  if (san.includes('x')) return 'A capture is available. Count attackers and defenders first.';
  if (/^[a-h]/.test(san)) return 'A pawn move: fight for the centre or kick an enemy piece.';
  return 'Develop a piece toward the centre or create a direct threat.';
}

function sideName(turn: 'w' | 'b'): string {
  return turn === 'w' ? 'White' : 'Black';
}

export const LessonsView: React.FC<LessonsViewProps> = ({ initialLessonId, initialLesson }) => {
  const resolveInitialLesson = (): CurriculumLesson => {
    if (initialLesson) return initialLesson;
    const requested = initialLessonId ? allCurriculumLessons.find((l) => l.id === initialLessonId) : undefined;
    return requested || scandinavianRefutationDrill || allCurriculumLessons[0];
  };

  const [currentLesson, setCurrentLesson] = useState<CurriculumLesson>(resolveInitialLesson);

  // Lesson list filter: 'all' (core lessons), a course id, or the pattern library.
  // A hand-off straight into a pattern-library lesson opens that list so the active card is visible.
  const [selectedFilter, setSelectedFilter] = useState<string>(() =>
    resolveInitialLesson().relevance === 'outside-repertoire' ? PATTERN_LIBRARY_ID : 'all'
  );

  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(() => currentLesson.startPly ?? 0);
  const [phase, setPhase] = useState<LessonPhase>('line');
  // The line being played this run: the main line with the opponent's replies chosen by frequency
  const [activeLine, setActiveLine] = useState<CurriculumMove[]>(() => currentLesson.moves);

  // Exercise quiz state
  const [exerciseIndex, setExerciseIndex] = useState<number>(0);
  const [exerciseStep, setExerciseStep] = useState<number>(0); // index into solutionSan
  const [exerciseSolved, setExerciseSolved] = useState<boolean>(false);

  const rulesRef = useRef<RulesEngine>(new RulesEngine());
  const timersRef = useRef<number[]>([]);
  const runIdRef = useRef<number>(0); // bumped on every board setup so async continuations can tell they are stale
  const decisionStartedAtRef = useRef<number>(Date.now()); // when the current decision became the student's
  const firstWrongSanRef = useRef<string | null>(null); // the first wrong try at the current decision
  const sessionStepsRef = useRef<LearningSteps>(new LearningSteps());
  const [position, setPosition] = useState<ChessPosition>(() => rulesRef.current.getPosition());

  // Feedback state
  const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
  const [correctFeedback, setCorrectFeedback] = useState<string | null>(null);
  const [opponentIdea, setOpponentIdea] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isLineHold, setIsLineHold] = useState<boolean>(false);
  const [isOpponentThinking, setIsOpponentThinking] = useState<boolean>(false);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);

  // Coaching cues shown on the board
  const [coachArrows, setCoachArrows] = useState<BoardArrow[]>([]);
  const [coachHighlights, setCoachHighlights] = useState<BoardHighlight[]>([]);

  // Hints and per-run performance
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [attemptsThisDecision, setAttemptsThisDecision] = useState<number>(0);
  const [runStats, setRunStats] = useState<RunStats>({ mistakes: 0, hintLevel: 0, decisions: 0 });

  // Spaced repetition: one FSRS card per decision position, reviewed as the student plays it
  const [lessonCards, setLessonCards] = useState<Map<string, StoredCard>>(() => new Map());
  const [dueCards, setDueCards] = useState<StoredCard[]>([]);
  const [reviewLog, setReviewLog] = useState<ReviewLogEntry[]>([]);
  const [srsMessage, setSrsMessage] = useState<string | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // ---- Spaced repetition plumbing -------------------------------------------------

  const isAdHocLesson = !allCurriculumLessons.some((l) => l.id === currentLesson.id);
  const isSessionLesson = currentLesson.id.startsWith(SESSION_LESSON_PREFIX);

  // Every decision of every shipped lesson (main line and branches): the card universe
  const allSpecs = useMemo(() => {
    const byLesson: Record<string, DecisionSpec[]> = {};
    for (const lesson of allCurriculumLessons) byLesson[lesson.id] = enumerateDecisions(lesson);
    return byLesson;
  }, []);

  // Pattern-library positions stay out of the daily queue until the student has actually studied them:
  // a card is active once it belongs to a core lesson or has been reviewed at least once.
  const coreLessonIds = useMemo(
    () => new Set(allCurriculumLessons.filter((l) => l.relevance !== 'outside-repertoire').map((l) => l.id)),
    []
  );
  const isActiveCard = useCallback(
    (card: StoredCard) => card.reps > 0 || card.lessonIds.some((id) => coreLessonIds.has(id)),
    [coreLessonIds]
  );

  const refreshDue = useCallback(async () => {
    try {
      setDueCards((await CardService.getDueCards()).filter(isActiveCard));
    } catch (err) {
      console.warn('Error reading due cards:', err);
    }
  }, [isActiveCard]);

  // Migrate the legacy per-lesson cards once, make sure every decision has a card, then count what is due
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await prepareCardsOnce(allSpecs);
      } catch (err) {
        console.warn('Error preparing review cards:', err);
      }
      if (!cancelled) refreshDue();
    })();
    return () => {
      cancelled = true;
    };
  }, [allSpecs, refreshDue]);

  const loadLessonCards = useCallback(async (lesson: CurriculumLesson) => {
    try {
      const map = new Map<string, StoredCard>();
      if (lesson.id.startsWith(SESSION_LESSON_PREFIX)) {
        // A session card reviews an existing card; never create one under the ad-hoc lesson id
        for (const spec of enumerateDecisions(lesson)) {
          const card = await CardService.getCard(canonicalFenKey(spec.fen));
          if (card) map.set(card.id, card);
        }
      } else {
        for (const card of await CardService.ensureCards(enumerateDecisions(lesson))) map.set(card.id, card);
      }
      setLessonCards(map);
    } catch (err) {
      console.warn('Error loading review cards:', err);
    }
  }, []);

  useEffect(() => {
    loadLessonCards(currentLesson);
  }, [currentLesson, loadLessonCards]);

  const dueLessonIds = useMemo(() => new Set(dueCards.flatMap((c) => c.lessonIds)), [dueCards]);

  // ---- Board setup -----------------------------------------------------------------

  // Load one exercise position. This is the single owner of the exercise phase: it is called from
  // the line-complete hold, from "Next exercise" and from setupLessonBoard, never from an effect,
  // so switching lessons can never re-enter it with stale phase state.
  const loadExercise = useCallback((lesson: CurriculumLesson, index: number) => {
    const ex = lesson.exercises[index];
    if (!ex) {
      setPhase('complete');
      setCorrectFeedback(null);
      return;
    }
    const rules = new RulesEngine(ex.fen);
    rulesRef.current = rules;
    setPosition(rules.getPosition());
    setPhase('exercises');
    setExerciseIndex(index);
    setExerciseStep(0);
    setExerciseSolved(false);
    setWrongFeedback(null);
    setCorrectFeedback(null);
    setOpponentIdea(null);
    setCoachArrows([]);
    setCoachHighlights([]);
    setHintLevel(0);
    setAttemptsThisDecision(0);
  }, []);

  // After the final line move (by either side) the finished line stays on the board briefly so the
  // last annotation and arrows can be read, then the exercise quiz loads (or the lesson completes).
  const finishLine = useCallback(
    (lesson: CurriculumLesson) => {
      if (lesson.exercises.length === 0) {
        setPhase('complete');
        return;
      }
      setIsLineHold(true);
      schedule(() => {
        setIsLineHold(false);
        loadExercise(lesson, 0);
      }, LINE_COMPLETE_HOLD_MS);
    },
    [schedule, loadExercise]
  );

  const markDecisionStart = useCallback(() => {
    decisionStartedAtRef.current = Date.now();
    firstWrongSanRef.current = null;
    setHintLevel(0); // a hint opened during the opponent's reply must not count against the next decision
  }, []);

  const playOpponentMoveIfNeeded = useCallback(
    function play(lesson: CurriculumLesson, line: CurriculumMove[], game: RulesEngine, plyIndex: number) {
      const next = line[plyIndex];
      if (!next || next.isUserMove) {
        markDecisionStart();
        return;
      }
      setIsOpponentThinking(true);
      schedule(() => {
        game.makeMove(next.san);
        setPosition(game.getPosition());
        setCurrentPlyIndex(plyIndex + 1);
        setOpponentIdea(next.annotation || null);
        setIsOpponentThinking(false);
        if (plyIndex + 1 >= line.length) {
          finishLine(lesson);
          return;
        }
        // Consecutive scripted moves (a review card replaying its context) chain on
        play(lesson, line, game, plyIndex + 1);
      }, OPPONENT_REPLY_MS);
    },
    [schedule, finishLine, markDecisionStart]
  );

  const setupLessonBoard = useCallback(
    (lesson: CurriculumLesson, targetPly?: number, opts: { vary?: boolean; path?: string[] } = {}) => {
      clearTimers();
      const rules = new RulesEngine(lesson.initialFen);
      // A click on the tree jumps to that node: the line is the branch the path runs through
      const jumped = opts.path ? lineForPath(lesson, opts.path) : null;
      const startPly = jumped ? opts.path!.length : targetPly !== undefined ? targetPly : lesson.startPly ?? 0;
      const line = jumped ?? resolveLine(lesson, startPly, opts.vary ?? false);
      for (let i = 0; i < startPly && i < line.length; i++) {
        rules.makeMove(line[i].san);
      }
      rulesRef.current = rules;
      setActiveLine(line);
      setPosition(rules.getPosition());
      setCurrentPlyIndex(startPly);
      setPhase('line');
      setExerciseIndex(0);
      setExerciseStep(0);
      setExerciseSolved(false);
      setWrongFeedback(null);
      setCorrectFeedback(null);
      setOpponentIdea(null);
      setCoachArrows([]);
      setCoachHighlights([]);
      setHintLevel(0);
      setAttemptsThisDecision(0);
      setRunStats({ mistakes: 0, hintLevel: 0, decisions: 0 });
      setReviewLog([]);
      setIsOpponentThinking(false);
      setIsRollingBack(false);
      setIsShaking(false);
      setIsLineHold(false);
      setSrsMessage(null);
      runIdRef.current += 1;
      if (startPly >= line.length) {
        // Nothing left to play on the line: straight to the exercises (or complete)
        if (lesson.exercises.length > 0) loadExercise(lesson, 0);
        else setPhase('complete');
        return;
      }
      // Black-perspective lessons: the opponent's first move is played for the student
      playOpponentMoveIfNeeded(lesson, line, rules, startPly);
    },
    [clearTimers, playOpponentMoveIfNeeded, loadExercise]
  );

  useEffect(() => {
    setupLessonBoard(currentLesson);
  }, [currentLesson, setupLessonBoard]);

  // ---- Derived values ----------------------------------------------------------------

  const currentExpectedMove: CurriculumMove | undefined = phase === 'line' ? activeLine[currentPlyIndex] : undefined;
  const treePath = useMemo(
    () => (phase === 'line' ? activeLine.slice(0, currentPlyIndex) : activeLine).map((m) => m.san),
    [phase, activeLine, currentPlyIndex]
  );
  const currentExercise: CurriculumExercise | undefined =
    phase === 'exercises' ? currentLesson.exercises[exerciseIndex] : undefined;
  const isLessonComplete = phase === 'complete';
  const studentColor: 'w' | 'b' = currentLesson.targetColor === 'black' ? 'b' : 'w';
  const isStudentTurn = position.turn === studentColor || currentLesson.targetColor === 'both';

  const lastMove = useMemo<{ from: Square; to: Square } | null>(() => {
    const history = rulesRef.current.getHistory();
    if (history.length === 0) return null;
    const lastRec = history[history.length - 1];
    if (!lastRec || !lastRec.uci || lastRec.uci.length < 4) return null;
    return {
      from: lastRec.uci.substring(0, 2) as Square,
      to: lastRec.uci.substring(2, 4) as Square,
    };
  }, [currentPlyIndex, position]);

  // Arrows for the expected move are only revealed at the final hint level
  const boardArrows = useMemo<BoardArrow[]>(() => {
    if (hintLevel >= 3 && currentExpectedMove?.arrows) return currentExpectedMove.arrows;
    return coachArrows;
  }, [hintLevel, currentExpectedMove, coachArrows]);

  const boardHighlights = useMemo<BoardHighlight[]>(() => {
    if (hintLevel >= 3 && currentExpectedMove?.highlights) return currentExpectedMove.highlights;
    return coachHighlights;
  }, [hintLevel, currentExpectedMove, coachHighlights]);

  // ---- FSRS review of one decision ------------------------------------------------------

  const recordDecisionReview = useCallback(
    async (fenBefore: string, hintLevelUsed: number) => {
      const runId = runIdRef.current;
      const sessionAtReview = session;
      const now = Date.now();
      const responseMs = Math.max(0, now - decisionStartedAtRef.current);
      const wrongSan = firstWrongSanRef.current;
      let key: string;
      try {
        key = canonicalFenKey(fenBefore);
      } catch {
        return;
      }
      try {
        const card = lessonCards.get(key) ?? (await CardService.getCard(key));
        if (!card) return;
        const rating = CardService.inferRating({
          wrongFirstTry: wrongSan !== null,
          hintLevel: hintLevelUsed,
          responseMs,
          meanMs: card.responseStats?.meanMs ?? 0,
          state: card.state,
          retrievability: CardService.retrievability(card, now),
          reps: card.reps,
        });
        const updated = await CardService.review(key, rating, {
          now,
          responseMs,
          hintLevel: hintLevelUsed,
          wrongSan: wrongSan ?? undefined,
          lessonId: sessionAtReview?.sourceLessonId ?? currentLesson.id,
          sessionId: sessionAtReview?.id,
        });
        await refreshDue();

        // Session bookkeeping belongs to the session, not to the board run: it must not be lost when
        // the next card opened before this write resolved
        if (sessionAtReview) {
          if (rating === 'again' && updated.due - now <= LEARNING_STEP_WINDOW_MS) {
            sessionStepsRef.current.push(key, updated.due);
          }
          setSession((prev) =>
            prev && prev.id === sessionAtReview.id ? { ...prev, ratings: { ...prev.ratings, [rating]: prev.ratings[rating] + 1 } } : prev
          );
        }
        if (runIdRef.current !== runId) return;

        setLessonCards((prev) => {
          const next = new Map(prev);
          next.set(key, updated);
          return next;
        });
        const dueIn = formatDueIn(updated.due - now);
        setReviewLog((log) => [...log, { key, rating, responseMs, dueIn }]);
        setSrsMessage(`${RATING_LABELS[rating]}: next review in ${dueIn}`);
        schedule(() => setSrsMessage(null), 4000);
      } catch (err) {
        console.warn('Error recording the review:', err);
      }
    },
    [lessonCards, currentLesson.id, session, refreshDue, schedule]
  );

  // ---- Move handling -----------------------------------------------------------------

  const registerMistake = useCallback(() => {
    setRunStats((s) => ({ ...s, mistakes: s.mistakes + 1 }));
    setAttemptsThisDecision((a) => {
      const next = a + 1;
      // After two wrong tries the hint ladder opens on its own (theme only)
      if (next >= 2) {
        setHintLevel((h) => {
          const raised = Math.max(h, 1);
          setRunStats((s) => ({ ...s, hintLevel: Math.max(s.hintLevel, raised) }));
          return raised;
        });
      }
      return next;
    });
  }, []);

  const rollbackWrongMove = useCallback(
    (game: RulesEngine, pliesToUndo: number, delayMs: number) => {
      setIsRollingBack(true);
      schedule(() => {
        for (let i = 0; i < pliesToUndo; i++) game.undoMove();
        setPosition(game.getPosition());
        setIsRollingBack(false);
      }, delayMs);
    },
    [schedule]
  );

  const handleLineMove = (
    move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' },
    expected: CurriculumMove
  ) => {
    const game = rulesRef.current;
    if (!expected.isUserMove) return; // never grade the opponent's scripted move

    const fenBefore = game.getFen();
    const probe = new Chess(fenBefore);
    let attempted;
    try {
      attempted = probe.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    } catch {
      return;
    }
    if (!attempted) return;

    const playedSan = attempted.san;
    const cleanPlayed = cleanSan(playedSan);
    const cleanExpected = cleanSan(expected.san);
    const acceptedBySan = cleanPlayed === cleanExpected || (expected.accept?.san || []).some((s) => cleanSan(s) === cleanPlayed);
    const acceptedByPredicate = expected.accept?.predicate === 'checkmate' && probe.isCheckmate();

    if (acceptedBySan || acceptedByPredicate) {
      const moveRes = game.makeMove(move);
      if (!moveRes.success) return;

      setPosition(game.getPosition());
      setWrongFeedback(null);
      setCorrectFeedback(`Correct! Great move! ${expected.annotation || ''}`.trim());
      setCoachArrows(expected.arrows || []);
      setCoachHighlights(expected.highlights || []);
      const hintUsed = hintLevel;
      setHintLevel(0);
      setAttemptsThisDecision(0);
      setRunStats((s) => ({ ...s, decisions: s.decisions + 1 }));
      void recordDecisionReview(fenBefore, hintUsed);

      const nextPly = currentPlyIndex + 1;
      setCurrentPlyIndex(nextPly);

      if (nextPly >= activeLine.length) {
        finishLine(currentLesson);
        return;
      }
      playOpponentMoveIfNeeded(currentLesson, activeLine, game, nextPly);
      return;
    }

    // Wrong move: specific feedback when authored, refutation playback when a trap matches
    registerMistake();
    if (firstWrongSanRef.current === null) firstWrongSanRef.current = playedSan;
    const fenKeyNow = positionKey(game.getFen());
    const trap = (currentLesson.commonMistakesAndTraps || []).find(
      (t) => positionKey(t.triggerFen) === fenKeyNow && cleanSan(t.attemptedSan) === cleanPlayed
    );

    let feedbackMsg = '';
    if (expected.wrongMoveFeedback) {
      feedbackMsg =
        expected.wrongMoveFeedback[cleanPlayed] ||
        expected.wrongMoveFeedback[playedSan] ||
        expected.wrongMoveFeedback[move.to] ||
        '';
    }
    if (!feedbackMsg && trap) {
      feedbackMsg = `${trap.explanatoryFeedback} ${trap.punishmentSummary}`.trim();
    }
    if (!feedbackMsg) {
      feedbackMsg = `Mistake: ${playedSan} is not the move this line needs. Think about what the opponent's last move threatens, then try again.`;
    }

    setWrongFeedback(feedbackMsg);
    setCorrectFeedback(null);
    setCoachArrows([]);
    setCoachHighlights([]);
    setIsShaking(true);
    schedule(() => setIsShaking(false), 400);

    // Show the wrong move, then its consequence, then roll everything back
    game.makeMove(move);
    setPosition(game.getPosition());

    if (trap && trap.refutationSanList.length > 0) {
      let played = 0;
      trap.refutationSanList.forEach((san, idx) => {
        schedule(() => {
          const res = game.makeMove(san);
          if (res.success) {
            played++;
            setPosition(game.getPosition());
          }
        }, REFUTATION_STEP_MS * (idx + 1));
      });
      const total = REFUTATION_STEP_MS * trap.refutationSanList.length + REFUTATION_HOLD_MS;
      setIsRollingBack(true);
      schedule(() => {
        for (let i = 0; i < played + 1; i++) game.undoMove();
        setPosition(game.getPosition());
        setIsRollingBack(false);
      }, total);
    } else {
      rollbackWrongMove(game, 1, ROLLBACK_MS);
    }
  };

  const handleExerciseMove = (
    move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' },
    exercise: CurriculumExercise
  ) => {
    const game = rulesRef.current;
    if (exerciseSolved) return;
    const probe = new Chess(game.getFen());
    let attempted;
    try {
      attempted = probe.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    } catch {
      return;
    }
    if (!attempted) return;

    const expectedSan = exercise.solutionSan[exerciseStep];
    if (!expectedSan) return;
    const accepted =
      cleanSan(attempted.san) === cleanSan(expectedSan) || (expectedSan.endsWith('#') && probe.isCheckmate());

    if (!accepted) {
      registerMistake();
      setWrongFeedback(`Mistake: ${attempted.san} is not the solution. Look again at the prompt and try another move.`);
      setCorrectFeedback(null);
      setIsShaking(true);
      schedule(() => setIsShaking(false), 400);
      game.makeMove(move);
      setPosition(game.getPosition());
      rollbackWrongMove(game, 1, ROLLBACK_MS);
      return;
    }

    game.makeMove(move);
    setPosition(game.getPosition());
    setWrongFeedback(null);
    setHintLevel(0);
    setAttemptsThisDecision(0);
    setRunStats((s) => ({ ...s, decisions: s.decisions + 1 }));

    const nextStep = exerciseStep + 1;
    if (nextStep >= exercise.solutionSan.length) {
      setExerciseStep(nextStep);
      setExerciseSolved(true);
      setCorrectFeedback(`Correct! Great move! ${exercise.explanation}`);
      return;
    }

    // Auto-play the opponent's reply in the solution, then wait for the next student move
    setCorrectFeedback('Correct! Great move!');
    const reply = exercise.solutionSan[nextStep];
    setIsOpponentThinking(true);
    schedule(() => {
      game.makeMove(reply);
      setPosition(game.getPosition());
      setIsOpponentThinking(false);
      const afterReply = nextStep + 1;
      setExerciseStep(afterReply);
      if (afterReply >= exercise.solutionSan.length) {
        setExerciseSolved(true);
        setCorrectFeedback(`Correct! Great move! ${exercise.explanation}`);
      }
    }, OPPONENT_REPLY_MS);
  };

  const handleBoardMove = (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    if (isLessonComplete || isOpponentThinking || isRollingBack || isLineHold) return;
    if (phase === 'line' && currentExpectedMove) {
      handleLineMove(move, currentExpectedMove);
    } else if (phase === 'exercises' && currentExercise) {
      handleExerciseMove(move, currentExercise);
    }
  };

  const handleNextExercise = () => {
    loadExercise(currentLesson, exerciseIndex + 1);
  };

  // ---- Hints -----------------------------------------------------------------------

  const handleRevealHint = () => {
    setHintLevel((prev) => {
      const next = Math.min(3, prev + 1);
      setRunStats((s) => ({ ...s, hintLevel: Math.max(s.hintLevel, next) }));
      return next;
    });
  };

  const hintTarget: CurriculumMove | undefined = useMemo(() => {
    if (phase === 'line') return currentExpectedMove;
    if (phase === 'exercises' && currentExercise && !exerciseSolved) {
      // Build a pseudo-move for the current exercise step so the same ladder applies
      const san = currentExercise.solutionSan[exerciseStep];
      if (!san) return undefined;
      try {
        const probe = new Chess(rulesRef.current.getFen());
        const m = probe.move(san);
        if (!m) return undefined;
        const pieceNames: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
        return {
          ply: 0,
          san: m.san,
          isUserMove: true,
          hintPiece: `${pieceNames[m.piece]} on ${m.from}`,
          hintSquare: m.to,
          hintTheme: currentExercise.title,
        };
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [phase, currentExpectedMove, currentExercise, exerciseStep, exerciseSolved, position]);

  // ---- Today's session: due cards one position at a time ----------------------------------

  const lessonForCard = useCallback(
    (card: StoredCard): { lesson: CurriculumLesson; sourceTitle: string | null; sourceLessonId: string | null } => {
      // Prefer a core lesson as the source of context and teaching; the card keeps every accepted answer
      const candidates = allCurriculumLessons.filter((l) => card.lessonIds.includes(l.id));
      const source = candidates.find((l) => l.relevance !== 'outside-repertoire') ?? candidates[0];
      const spec = source ? allSpecs[source.id]?.find((d) => canonicalFenKey(d.fen) === card.id) : undefined;
      const main = spec?.acceptedSan[0] ?? card.accepted[0];
      const acceptedSan = [main, ...card.accepted.filter((san) => san !== main)];
      const lesson = lessonFromDecision(source, {
        fen: spec?.fen ?? card.fen,
        acceptedSan,
        path: spec?.path ?? [],
        title: spec?.title ?? card.title,
        lessonId: source?.id ?? card.lessonIds[0] ?? 'card',
      });
      return { lesson, sourceTitle: source?.title ?? null, sourceLessonId: source?.id ?? null };
    },
    [allSpecs]
  );

  const openSessionCard = useCallback(
    (card: StoredCard, next: ReviewSession) => {
      try {
        const { lesson, sourceTitle, sourceLessonId } = lessonForCard(card);
        setSession({ ...next, current: card, sourceTitle, sourceLessonId });
        setCurrentLesson(lesson);
      } catch (err) {
        console.warn('Could not build a review card lesson:', err);
        setSession({ ...next, current: null, sourceTitle: null, sourceLessonId: null });
      }
    },
    [lessonForCard]
  );

  const handleStartSession = async () => {
    const now = Date.now();
    try {
      const due = (await CardService.getDueCards(now)).filter(isActiveCard);
      const queue = buildQueue(due, { now, retrievability: (c) => CardService.retrievability(c, now) });
      if (queue.length === 0) return;
      sessionStepsRef.current = new LearningSteps();
      openSessionCard(queue[0], {
        id: `session-${now}`,
        cards: queue,
        index: 0,
        completed: 0,
        ratings: { again: 0, hard: 0, good: 0, easy: 0 },
        current: null,
        sourceTitle: null,
        sourceLessonId: null,
      });
    } catch (err) {
      console.warn('Could not start the review session:', err);
    }
  };

  const handleNextCard = async () => {
    if (!session || !session.current) return;
    const now = Date.now();
    const steps = sessionStepsRef.current;
    const completed = session.completed + 1;
    try {
      // A failed card whose learning step has elapsed comes back first
      const resurfaced = steps.popDue(now);
      if (resurfaced) {
        const card = await CardService.getCard(resurfaced);
        if (card) {
          openSessionCard(card, { ...session, completed });
          return;
        }
      }
      const nextIndex = session.index + 1;
      if (nextIndex < session.cards.length) {
        openSessionCard(session.cards[nextIndex], { ...session, index: nextIndex, completed });
        return;
      }
      // The queue is done: finish the remaining learning steps now rather than waiting out the minute
      const pending = steps.peek();
      if (pending) {
        steps.popDue(Number.POSITIVE_INFINITY);
        const card = await CardService.getCard(pending.cardId);
        if (card) {
          openSessionCard(card, { ...session, index: nextIndex, completed });
          return;
        }
      }
      setSession({ ...session, index: nextIndex, completed, current: null, sourceTitle: null, sourceLessonId: null });
    } catch (err) {
      console.warn('Could not advance the review session:', err);
    }
  };

  const handleEndSession = () => {
    setSession(null);
    sessionStepsRef.current = new LearningSteps();
    setCurrentLesson(resolveInitialLesson());
  };

  // ---- Lesson list -------------------------------------------------------------------

  const handleSelectLesson = (lesson: CurriculumLesson) => {
    setSession(null);
    setCurrentLesson(lesson);
  };

  const patternLibrary = useMemo(
    () => allCurriculumLessons.filter((l) => l.relevance === 'outside-repertoire'),
    []
  );

  const filteredLessons = useMemo(() => {
    if (selectedFilter === 'all') {
      const core = allCurriculumLessons.filter((l) => l.relevance !== 'outside-repertoire');
      const drills = core.filter((l) => l.category === 'weakness_drill');
      const rest = core.filter((l) => l.category !== 'weakness_drill');
      return [...weaknessDrillLessons.filter((d) => drills.includes(d)), ...rest];
    }
    if (selectedFilter === PATTERN_LIBRARY_ID) return patternLibrary;
    const course = curriculumCourses.find((c) => c.id === selectedFilter);
    return course ? course.lessons : [];
  }, [selectedFilter, patternLibrary]);

  // Keep the active lesson visible: a review-queue or hand-off lesson that lives outside the
  // current list switches the filter to where it is listed.
  useEffect(() => {
    if (isAdHocLesson) return; // a review card or a drill built on the fly has no card in the list
    if (!filteredLessons.some((l) => l.id === currentLesson.id)) {
      setSelectedFilter(currentLesson.relevance === 'outside-repertoire' ? PATTERN_LIBRARY_ID : 'all');
    }
    // Only when the lesson changes; browsing other courses while a lesson is open is allowed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson.id]);

  const courseLabel = (category: string): string => {
    switch (category) {
      case 'white_repertoire':
        return 'White Weapons';
      case 'anti_gambit':
        return 'Anti-Gambit Clinic';
      case 'opening_traps':
        return 'Opening Traps';
      case 'beginner_fundamentals':
        return 'Fundamentals';
      case 'hoot65_drills':
        return 'Weakness Drills';
      default:
        return category.replace(/_/g, ' ');
    }
  };

  const coreCount = allCurriculumLessons.length - patternLibrary.length;
  const dueCount = dueCards.length;
  const lessonDueCount = Array.from(lessonCards.values()).filter((c) => c.due <= Date.now()).length;
  const sessionFinished = !!session && session.current === null && session.index >= session.cards.length;
  const ratingSummary = (['again', 'hard', 'good', 'easy'] as CardRating[])
    .map((r) => ({ r, n: reviewLog.filter((e) => e.rating === r).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} ${RATING_LABELS[x.r].toLowerCase()}`)
    .join(', ');

  return (
    <div className="lessons-view w-full max-w-7xl mx-auto flex flex-col gap-6" data-view="lessons">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              Lichess-Inspired Interactive Drills
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Spaced Repetition (FSRS)
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Interactive Repertoire & Curriculum Lessons
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Step-by-step lessons distilled from the local chess books, with specific feedback on mistakes, the refutation
            played out on the board, and review scheduling driven by how the drill actually went.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Due queue */}
          <button
            type="button"
            data-action="review-due"
            onClick={handleStartSession}
            disabled={dueCount === 0 || !!session}
            className="bg-slate-950/80 border border-amber-500/40 rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-semibold text-amber-300 hover:bg-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Start today's session: every due position, one at a time"
          >
            <ListChecks className="w-4 h-4" />
            <span data-due-count={dueCount}>Due today: {dueCount}</span>
          </button>

          {session && (
            <div
              className="bg-slate-950/80 border border-amber-500/40 rounded-lg px-3 py-2 flex items-center gap-3 text-xs"
              data-session={session.id}
            >
              <span className="text-amber-300 font-semibold" data-session-progress>
                Session: card {Math.min(session.completed + 1, session.cards.length)} of {session.cards.length}
              </span>
              <button
                type="button"
                data-action="end-session"
                onClick={handleEndSession}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium"
              >
                End session
              </button>
            </div>
          )}

          {!session && lessonCards.size > 0 && (
            <div className="bg-slate-950/80 border border-slate-700/60 rounded-lg px-3 py-2 text-xs" data-lesson-cards={lessonCards.size}>
              <div className="text-slate-400 font-medium">This lesson</div>
              <div className="text-slate-200 font-bold text-sm">
                {lessonCards.size} decision card{lessonCards.size === 1 ? '' : 's'}
                {lessonDueCount > 0 ? `, ${lessonDueCount} due` : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Course Filter & Lesson Cards */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              My Lessons ({coreCount})
            </button>
            {curriculumCourses.map((c) => (
              <button
                key={c.id}
                type="button"
                data-course={c.id}
                onClick={() => setSelectedFilter(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedFilter === c.id ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {courseLabel(c.category)}
              </button>
            ))}
            <button
              type="button"
              data-course={PATTERN_LIBRARY_ID}
              onClick={() => setSelectedFilter(PATTERN_LIBRARY_ID)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                selectedFilter === PATTERN_LIBRARY_ID
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
              title="Patterns from openings you do not play; kept for reference"
            >
              <Library className="w-3.5 h-3.5" />
              Pattern Library ({patternLibrary.length})
            </button>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[720px] overflow-y-auto custom-scrollbar pr-1">
            {filteredLessons.map((lesson) => {
              const isSelected = lesson.id === currentLesson.id;
              const isDue = dueLessonIds.has(lesson.id);
              return (
                <div
                  key={lesson.id}
                  data-lesson-id={lesson.id}
                  className={`lesson-card rounded-xl border p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                      : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                  onClick={() => handleSelectLesson(lesson)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {lesson.eco && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {lesson.eco}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                          {lesson.category.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize">{lesson.targetRatingBand}</span>
                        <span className="text-[10px] text-slate-500">
                          plays {lesson.targetColor === 'black' ? 'Black' : lesson.targetColor === 'both' ? 'both sides' : 'White'}
                        </span>
                        {lesson.relevance === 'outside-repertoire' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            pattern library
                          </span>
                        )}
                        {isDue && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            due
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="lesson-item text-left font-bold text-sm text-white hover:text-emerald-300 line-clamp-1"
                      >
                        {lesson.title}
                      </button>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{lesson.subtitle || lesson.description}</p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 mt-1 flex-shrink-0 transition-transform ${
                        isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'
                      }`}
                    />
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">
                      <strong className="text-slate-300">Source:</strong> {lesson.sourceBook}
                    </span>
                    <span className="text-slate-500 whitespace-nowrap ml-2">{lesson.author}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: board with its controls, and beside it the tree, feedback and review */}
        <div className="lg:col-span-9">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            <div className="xl:col-span-7 flex flex-col gap-4" data-section="board-column">
          {/* Active Lesson Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active Lesson</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">{currentLesson.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{currentLesson.subtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-action="restart"
                  onClick={() => setupLessonBoard(currentLesson, 0, { vary: true })}
                  title="Play the whole line from the first move; the opponent may now choose another known reply"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart from move 1</span>
                </button>
                {(currentLesson.startPly ?? 0) > 0 && (
                  <button
                    type="button"
                    data-action="drill-point"
                    onClick={() => setupLessonBoard(currentLesson, undefined, { vary: true })}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <Target className="w-3.5 h-3.5" />
                    Drill point
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2.5 text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Distilled from <strong className="text-slate-200">{currentLesson.sourceBook}</strong> by {currentLesson.author}
                {currentLesson.pagesRef ? ` (${currentLesson.pagesRef})` : ''}
              </span>
            </div>
          </div>

          {/* Board */}
          <div className="flex flex-col items-center">
            <div className={`relative transition-transform duration-200 ${isShaking ? 'animate-shake' : ''}`}>
              <Chessboard
                board={rulesRef.current.getBoard()}
                position={position}
                orientation={studentColor}
                lastMove={lastMove}
                interactive={!isLessonComplete && !isOpponentThinking && !isRollingBack && !isLineHold && (phase !== 'line' || isStudentTurn)}
                onMove={handleBoardMove}
                getLegalMovesForSquare={(sq) => rulesRef.current.getLegalMovesForSquare(sq)}
                arrows={boardArrows}
                highlights={boardHighlights}
              />

              {isOpponentThinking && (
                <div className="absolute top-3 right-3 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Opponent replying...
                </div>
              )}
            </div>
          </div>

            {/* Toolbar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-action="hint"
                  onClick={handleRevealHint}
                  disabled={isLessonComplete || !hintTarget || isOpponentThinking}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Hint {hintLevel > 0 ? `(${hintLevel}/3)` : ''}</span>
                </button>

                <div className="text-xs text-slate-400 pl-2 border-l border-slate-800">
                  Move <strong className="text-white">{Math.min(currentPlyIndex, activeLine.length)}</strong> of {activeLine.length}
                </div>
                {(runStats.mistakes > 0 || runStats.hintLevel > 0) && (
                  <div className="text-[11px] text-slate-500 pl-2 border-l border-slate-800" data-run-stats>
                    {runStats.mistakes} slip{runStats.mistakes === 1 ? '' : 's'}, hint level {runStats.hintLevel}
                    {attemptsThisDecision > 0 && !isLessonComplete ? ` · attempt ${attemptsThisDecision + 1} here` : ''}
                  </div>
                )}
              </div>

              {isLessonComplete ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                  <span>Lesson Completed! Every decision has been scheduled.</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  {phase === 'exercises' ? (
                    <span className="text-indigo-300 font-semibold">Exercise: {sideName(position.turn)} to move</span>
                  ) : isLineHold ? (
                    <span className="text-emerald-400 font-semibold" data-state="line-complete">
                      Line complete! Loading the exercise…
                    </span>
                  ) : currentExpectedMove?.isUserMove ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      Your turn: find {sideName(position.turn)}&apos;s move
                    </span>
                  ) : (
                    <span className="text-slate-400">{sideName(position.turn)}&apos;s turn</span>
                  )}
                </div>
              )}
            </div>
            </div>

            <div className="xl:col-span-5 flex flex-col gap-3" data-section="side-panel">
          {/* The lesson tree: main line and the opponent's alternatives, with the current path marked */}
          {!isSessionLesson && (
            <MoveTree
              lesson={currentLesson}
              currentPath={treePath}
              onSelectPath={(path) => setupLessonBoard(currentLesson, undefined, { path })}
            />
          )}

          {/* Exercise prompt */}
          {phase === 'exercises' && currentExercise && (
            <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-100 text-sm shadow-md" data-exercise={currentExercise.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4" />
                  Exercise {exerciseIndex + 1} of {currentLesson.exercises.length}
                  {currentExercise.title ? `: ${currentExercise.title}` : ''}
                </div>
                <span className="text-[11px] text-indigo-300/80">{sideName(position.turn)} to move</span>
              </div>
              <p className="text-sm leading-relaxed">{currentExercise.prompt}</p>
              {exerciseSolved && (
                <button
                  type="button"
                  data-action="next-exercise"
                  onClick={handleNextExercise}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  {exerciseIndex + 1 < currentLesson.exercises.length ? 'Next exercise' : 'Finish lesson'}
                </button>
              )}
            </div>
          )}

            {wrongFeedback && (
              <div
                className="wrong-move-feedback p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm font-medium flex items-start gap-2.5 shadow-lg animate-fadeIn"
                data-feedback="wrong"
                role="status"
                aria-live="polite"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-red-300 text-xs uppercase tracking-wider mb-0.5">Instructional Mistake Feedback</div>
                  <p className="text-sm leading-relaxed">{wrongFeedback}</p>
                </div>
              </div>
            )}

            {correctFeedback && (
              <div
                className="correct-feedback p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-sm font-medium flex items-start gap-2.5 shadow-lg animate-fadeIn"
                data-feedback="correct"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-emerald-300 text-xs uppercase tracking-wider mb-0.5">Well Done!</div>
                  <p className="text-sm leading-relaxed">{correctFeedback}</p>
                </div>
              </div>
            )}

            {opponentIdea && phase === 'line' && (
              <div
                className="opponent-idea p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm flex items-start gap-2.5"
                data-feedback="opponent-idea"
              >
                <MessageSquare className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-sky-300 text-xs uppercase tracking-wider mb-0.5">Opponent&apos;s idea</div>
                  <p className="text-sm leading-relaxed">{opponentIdea}</p>
                </div>
              </div>
            )}

            {/* Progressive Hint: theme, then piece, then square. Never the move itself. */}
            {hintLevel > 0 && hintTarget && (
              <div
                className="hint-content p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-sm shadow-md"
                data-hint="active"
                data-hint-level={hintLevel}
              >
                <div className="flex items-center gap-2 font-bold text-amber-300 text-xs uppercase tracking-wider mb-1">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  Progressive Hint (Level {hintLevel} of 3)
                </div>
                {hintLevel === 1 && <p className="text-sm">{hintTarget.hintTheme || autoTheme(hintTarget)}</p>}
                {hintLevel === 2 && (
                  <p className="text-sm">
                    {hintTarget.hintTheme || autoTheme(hintTarget)} Look at your{' '}
                    <strong className="text-amber-100">{hintTarget.hintPiece || 'key piece'}</strong>.
                  </p>
                )}
                {hintLevel >= 3 && (
                  <p className="text-sm">
                    Move your <strong className="text-amber-100">{hintTarget.hintPiece || 'piece'}</strong> toward{' '}
                    <strong className="text-white font-mono bg-amber-900/60 px-1.5 py-0.5 rounded">{hintTarget.hintSquare}</strong>.
                    {hintTarget.arrows && hintTarget.arrows.length > 0 ? ' The arrows on the board show the idea.' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Lesson takeaway, revealed on completion so titles never spoil the answer */}
            {isLessonComplete && currentLesson.thematicObjective && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-sm text-slate-200" data-section="takeaway">
                <div className="font-bold text-emerald-300 text-xs uppercase tracking-wider mb-1">Takeaway</div>
                <p>{currentLesson.thematicObjective}</p>
                {currentLesson.keyTacticalMotif && (
                  <p className="text-xs text-slate-400 mt-1">Motifs: {currentLesson.keyTacticalMotif}</p>
                )}
              </div>
            )}

            {/* Session controls once a review card is answered */}
            {isLessonComplete && session?.current && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-sm text-amber-100" data-section="session-card">
                {session.sourceTitle && (
                  <p className="text-xs text-amber-200/90 mb-2">
                    From the lesson <strong className="text-amber-100">{session.sourceTitle}</strong>
                  </p>
                )}
                <button
                  type="button"
                  data-action="next-card"
                  onClick={handleNextCard}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  Next card
                </button>
              </div>
            )}

            {sessionFinished && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-sm text-emerald-100" data-section="session-summary">
                <div className="font-bold text-emerald-300 text-xs uppercase tracking-wider mb-1">Session complete</div>
                <p>
                  {session!.completed} card{session!.completed === 1 ? '' : 's'} reviewed: {session!.ratings.again} again, {session!.ratings.hard} hard,{' '}
                  {session!.ratings.good} good, {session!.ratings.easy} easy.
                </p>
                <button
                  type="button"
                  data-action="end-session"
                  onClick={handleEndSession}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Back to the lessons
                </button>
              </div>
            )}

            {/* Spaced repetition: each decision is scheduled on its own card as it is played */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md" data-section="srs">
              <div>
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Spaced Repetition Review (FSRS)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {reviewLog.length === 0
                    ? 'Each decision you play is scheduled on its own card: a quick, clean answer pushes its next review further out; a slip or a hint brings it back sooner.'
                    : `${reviewLog.length} decision${reviewLog.length === 1 ? '' : 's'} scheduled this run: ${ratingSummary}.`}
                </div>
                {srsMessage && (
                  <div className="text-xs font-semibold text-emerald-400 mt-1 animate-fadeIn" data-srs-message>
                    ✓ {srsMessage}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap" data-review-log>
                {reviewLog.map((entry, i) => (
                  <span
                    key={`${entry.key}-${i}`}
                    data-rating={entry.rating}
                    title={`${(entry.responseMs / 1000).toFixed(1)} s, next review in ${entry.dueIn}`}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      entry.rating === 'again'
                        ? 'bg-red-950/70 text-red-300 border-red-500/40'
                        : entry.rating === 'hard'
                          ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                          : entry.rating === 'easy'
                            ? 'bg-blue-950/70 text-blue-300 border-blue-500/40'
                            : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {RATING_LABELS[entry.rating]}
                  </span>
                ))}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
