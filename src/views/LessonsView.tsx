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
  Calendar,
  Layers,
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
import { positionKey } from '../curriculum/builder';
import { CurriculumLesson, CurriculumMove, CurriculumExercise, SRSCardState } from '../types/curriculum';
import { Chessboard, BoardArrow, BoardHighlight } from '../components/Chessboard';
import { RulesEngine } from '../engine/rules';
import { Square, ChessPosition } from '../types/chess';
import { SrsService, suggestGrade } from '../services/srs';

type LessonPhase = 'line' | 'exercises' | 'complete';

interface RunStats {
  mistakes: number;
  hintLevel: number; // highest hint level used in this run
  decisions: number;
}

interface LessonsViewProps {
  /** Lesson to open first (e.g. handed over from Diagnostics). */
  initialLessonId?: string;
}

const OPPONENT_REPLY_MS = 400;
const ROLLBACK_MS = 450;
const REFUTATION_STEP_MS = 350;
const REFUTATION_HOLD_MS = 700;
// How long a finished line stays on the board (with its last annotation and arrows) before the exercise loads
const LINE_COMPLETE_HOLD_MS = 1600;
const GRADE_LABELS: Record<number, string> = { 1: 'Again', 3: 'Hard', 4: 'Good', 5: 'Easy' };

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

export const LessonsView: React.FC<LessonsViewProps> = ({ initialLessonId }) => {
  const resolveInitialLesson = (): CurriculumLesson => {
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

  // Exercise quiz state
  const [exerciseIndex, setExerciseIndex] = useState<number>(0);
  const [exerciseStep, setExerciseStep] = useState<number>(0); // index into solutionSan
  const [exerciseSolved, setExerciseSolved] = useState<boolean>(false);

  const rulesRef = useRef<RulesEngine>(new RulesEngine());
  const timersRef = useRef<number[]>([]);
  const ratingInFlightRef = useRef<boolean>(false); // one review per run, even on a double click
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
  const [ratedThisRun, setRatedThisRun] = useState<boolean>(false);

  // Spaced repetition
  const [srsCard, setSrsCard] = useState<SRSCardState | null>(null);
  const [srsMessage, setSrsMessage] = useState<string | null>(null);
  const [dueCards, setDueCards] = useState<SRSCardState[]>([]);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);

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

  const refreshDue = useCallback(async () => {
    try {
      const due = await SrsService.getDueCards();
      setDueCards(due.filter((c) => allCurriculumLessons.some((l) => l.id === c.cardId)));
    } catch (err) {
      console.warn('Error reading due cards:', err);
    }
  }, []);

  // Seed a card for every lesson once, then compute what is due
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await SrsService.initializeCardsForLessons(allCurriculumLessons);
      } catch (err) {
        console.warn('Error seeding SRS cards:', err);
      }
      if (!cancelled) refreshDue();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDue]);

  const loadSrsCard = useCallback(async (lessonId: string) => {
    try {
      let card = await SrsService.getCard(lessonId);
      if (!card) {
        const lesson = allCurriculumLessons.find((l) => l.id === lessonId);
        if (lesson) {
          await SrsService.initializeCardsForLessons([lesson]);
          card = await SrsService.getCard(lessonId);
        }
      }
      setSrsCard(card || null);
    } catch (err) {
      console.warn('Error loading SRS card:', err);
    }
  }, []);

  useEffect(() => {
    loadSrsCard(currentLesson.id);
  }, [currentLesson.id, loadSrsCard]);

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

  const playOpponentMoveIfNeeded = useCallback(
    (lesson: CurriculumLesson, game: RulesEngine, plyIndex: number) => {
      const next = lesson.moves[plyIndex];
      if (!next || next.isUserMove) return;
      setIsOpponentThinking(true);
      schedule(() => {
        game.makeMove(next.san);
        setPosition(game.getPosition());
        setCurrentPlyIndex(plyIndex + 1);
        setOpponentIdea(next.annotation || null);
        setIsOpponentThinking(false);
        if (plyIndex + 1 >= lesson.moves.length) {
          finishLine(lesson);
        }
      }, OPPONENT_REPLY_MS);
    },
    [schedule, finishLine]
  );

  const setupLessonBoard = useCallback(
    (lesson: CurriculumLesson, targetPly?: number) => {
      clearTimers();
      const rules = new RulesEngine(lesson.initialFen);
      const startPly = targetPly !== undefined ? targetPly : lesson.startPly ?? 0;
      for (let i = 0; i < startPly && i < lesson.moves.length; i++) {
        rules.makeMove(lesson.moves[i].san);
      }
      rulesRef.current = rules;
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
      setRatedThisRun(false);
      setIsOpponentThinking(false);
      setIsRollingBack(false);
      setIsShaking(false);
      setIsLineHold(false);
      setSrsMessage(null);
      ratingInFlightRef.current = false;
      if (startPly >= lesson.moves.length) {
        // Nothing left to play on the line: straight to the exercises (or complete)
        if (lesson.exercises.length > 0) loadExercise(lesson, 0);
        else setPhase('complete');
        return;
      }
      // Black-perspective lessons: the opponent's first move is played for the student
      playOpponentMoveIfNeeded(lesson, rules, startPly);
    },
    [clearTimers, playOpponentMoveIfNeeded, loadExercise]
  );

  useEffect(() => {
    setupLessonBoard(currentLesson);
  }, [currentLesson, setupLessonBoard]);

  // ---- Derived values ----------------------------------------------------------------

  const currentExpectedMove: CurriculumMove | undefined =
    phase === 'line' ? currentLesson.moves[currentPlyIndex] : undefined;
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

  const suggestedGrade = suggestGrade(runStats);
  const canRate = isLessonComplete && !ratedThisRun;

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

    const probe = new Chess(game.getFen());
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
      setHintLevel(0);
      setAttemptsThisDecision(0);
      setRunStats((s) => ({ ...s, decisions: s.decisions + 1 }));

      const nextPly = currentPlyIndex + 1;
      setCurrentPlyIndex(nextPly);

      if (nextPly >= currentLesson.moves.length) {
        finishLine(currentLesson);
        return;
      }
      playOpponentMoveIfNeeded(currentLesson, game, nextPly);
      return;
    }

    // Wrong move: specific feedback when authored, refutation playback when a trap matches
    registerMistake();
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

  // ---- SRS rating ----------------------------------------------------------------------

  const handleRateSRS = async (grade: number) => {
    if (!canRate || grade > suggestedGrade || ratingInFlightRef.current) return;
    // Lock synchronously: a second click before the write resolves must not count as a second review
    ratingInFlightRef.current = true;
    setRatedThisRun(true);
    try {
      const updated = await SrsService.recordReview(currentLesson.id, grade, {
        usedHint: runStats.hintLevel > 0,
        hintLevel: runStats.hintLevel,
        mistakeCount: runStats.mistakes,
      });
      setSrsCard(updated);
      setSrsMessage(
        `Rated ${GRADE_LABELS[grade] || grade}: Scheduled next review in ${updated.intervalDays} day(s) (Leitner Box ${updated.box})`
      );
      schedule(() => setSrsMessage(null), 4000);
      await refreshDue();

      // Continue the review queue when one is active
      if (reviewQueue.length > 0) {
        const [, ...rest] = reviewQueue;
        setReviewQueue(rest);
        const nextLesson = rest.length > 0 ? allCurriculumLessons.find((l) => l.id === rest[0]) : undefined;
        if (nextLesson) {
          schedule(() => setCurrentLesson(nextLesson), 1200);
        }
      }
    } catch (err) {
      ratingInFlightRef.current = false;
      setRatedThisRun(false);
      console.warn('Error rating SRS:', err);
    }
  };

  const handleStartReviewQueue = () => {
    const ids = dueCards.map((c) => c.cardId).filter((id) => allCurriculumLessons.some((l) => l.id === id));
    if (ids.length === 0) return;
    setReviewQueue(ids);
    const first = allCurriculumLessons.find((l) => l.id === ids[0]);
    if (first) setCurrentLesson(first);
  };

  // ---- Lesson list -------------------------------------------------------------------

  const handleSelectLesson = (lesson: CurriculumLesson) => {
    setReviewQueue([]);
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
  const isDueNow = srsCard ? srsCard.nextReviewTimestamp <= Date.now() : false;

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
              Spaced Repetition (SM-2)
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
            onClick={handleStartReviewQueue}
            disabled={dueCount === 0}
            className="bg-slate-950/80 border border-amber-500/40 rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-semibold text-amber-300 hover:bg-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Review every lesson whose card is due"
          >
            <ListChecks className="w-4 h-4" />
            <span data-due-count={dueCount}>Due today: {dueCount}</span>
            {reviewQueue.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[10px]">
                queue {reviewQueue.length}
              </span>
            )}
          </button>

          {srsCard && (
            <div className="bg-slate-950/80 border border-slate-700/60 rounded-lg p-3 flex items-center gap-4 text-xs">
              <div>
                <div className="text-slate-400 font-medium">Review Box</div>
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Box {srsCard.box} / 5
                </div>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <div className="text-slate-400 font-medium">Interval</div>
                <div className="text-slate-200 font-bold text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {srsCard.intervalDays} day(s)
                </div>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <div className="text-slate-400 font-medium">Ease Factor</div>
                <div className="text-amber-400 font-bold text-sm">{srsCard.easeFactor.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Course Filter & Lesson Cards */}
        <div className="lg:col-span-5 flex flex-col gap-4">
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
              const isDue = dueCards.some((c) => c.cardId === lesson.id);
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

        {/* Right Column: Board, feedback and review */}
        <div className="lg:col-span-7 flex flex-col gap-4">
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
                  onClick={() => setupLessonBoard(currentLesson, 0)}
                  title="Play the whole line from the first move"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart from move 1</span>
                </button>
                {(currentLesson.startPly ?? 0) > 0 && (
                  <button
                    type="button"
                    data-action="drill-point"
                    onClick={() => setupLessonBoard(currentLesson)}
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
                interactive={!isLessonComplete && !isOpponentThinking && !isRollingBack && (phase !== 'line' || isStudentTurn)}
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

          {/* Feedback */}
          <div className="flex flex-col gap-3">
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

            {/* Toolbar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-action="hint"
                  onClick={handleRevealHint}
                  disabled={isLessonComplete || !hintTarget}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Hint {hintLevel > 0 ? `(${hintLevel}/3)` : ''}</span>
                </button>

                <div className="text-xs text-slate-400 pl-2 border-l border-slate-800">
                  Move <strong className="text-white">{Math.min(currentPlyIndex, currentLesson.moves.length)}</strong> of {currentLesson.moves.length}
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
                  <span>Lesson Completed! Rate your recall below:</span>
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

            {/* Spaced repetition rating: enabled only after completion, one rating per run,
                pre-filled from what actually happened (downgrade only). */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md" data-section="srs">
              <div>
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Spaced Repetition Review (SM-2 / Leitner Box)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {canRate
                    ? `Suggested from this run: ${GRADE_LABELS[suggestedGrade]} (${runStats.mistakes} slip${runStats.mistakes === 1 ? '' : 's'}, hint level ${runStats.hintLevel}). You may only grade lower.`
                    : ratedThisRun
                    ? 'Rated. Restart the lesson to practise it again.'
                    : isDueNow
                    ? 'This lesson is due. Complete it to record a review.'
                    : 'Complete the lesson to record a review.'}
                </div>
                {srsMessage && (
                  <div className="text-xs font-semibold text-emerald-400 mt-1 animate-fadeIn" data-srs-message>
                    ✓ {srsMessage}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  data-grade="1"
                  onClick={() => handleRateSRS(1)}
                  disabled={!canRate}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/70 text-red-300 border border-red-500/40 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Again
                </button>
                <button
                  type="button"
                  data-grade="3"
                  onClick={() => handleRateSRS(3)}
                  disabled={!canRate || suggestedGrade < 3}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Hard
                </button>
                <button
                  type="button"
                  data-grade="4"
                  onClick={() => handleRateSRS(4)}
                  disabled={!canRate || suggestedGrade < 4}
                  className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm shadow-emerald-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Good
                </button>
                <button
                  type="button"
                  data-grade="5"
                  onClick={() => handleRateSRS(5)}
                  disabled={!canRate || suggestedGrade < 5}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/70 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Easy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
