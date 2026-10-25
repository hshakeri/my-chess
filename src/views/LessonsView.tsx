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
} from 'lucide-react';
import {
  allCurriculumLessons,
  curriculumCourses,
  scandinavianRefutationDrill,
  weaknessDrillLessons,
} from '../curriculum';
import { CurriculumLesson, CurriculumMove, SRSCardState } from '../types/curriculum';
import { Chessboard } from '../components/Chessboard';
import { RulesEngine } from '../engine/rules';
import { Square, ChessPosition } from '../types/chess';
import { SrsService } from '../services/srs';

export const LessonsView: React.FC = () => {
  // Course category selection filter: 'all' | 'white_repertoire' | 'anti_gambit' | 'opening_traps' | 'beginner_fundamentals' | 'hoot65_drills'
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Currently active lesson (defaulting to the Scandinavian Refutation Drill)
  const [currentLesson, setCurrentLesson] = useState<CurriculumLesson>(() => {
    return scandinavianRefutationDrill || allCurriculumLessons[0];
  });

  // Current ply index within the lesson's main moves array
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(() => {
    // For Scandinavian drill, set up position after 1.e4 d5 (ply index 2)
    return currentLesson.id === 'lesson-scandinavian-refutation-drill' ? 2 : 0;
  });

  // Internal RulesEngine for the active lesson board
  const rulesRef = useRef<RulesEngine>(new RulesEngine());
  const [position, setPosition] = useState<ChessPosition>(() => rulesRef.current.getPosition());

  // Instructional feedback state
  const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
  const [correctFeedback, setCorrectFeedback] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isOpponentThinking, setIsOpponentThinking] = useState<boolean>(false);

  // Progressive hints state (0: none, 1: piece, 2: square/theme, 3: full move)
  const [hintLevel, setHintLevel] = useState<number>(0);

  // Spaced Repetition (SRS) card state
  const [srsCard, setSrsCard] = useState<SRSCardState | null>(null);
  const [srsMessage, setSrsMessage] = useState<string | null>(null);

  // Load or create SRS card whenever current lesson changes
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

  // Reset or setup board for a lesson
  const setupLessonBoard = useCallback((lesson: CurriculumLesson, targetPly?: number) => {
    const rules = new RulesEngine(lesson.initialFen);
    const startPly = targetPly !== undefined
      ? targetPly
      : (lesson.id === 'lesson-scandinavian-refutation-drill' ? 2 : 0);

    for (let i = 0; i < startPly && i < lesson.moves.length; i++) {
      rules.makeMove(lesson.moves[i].san);
    }

    rulesRef.current = rules;
    setPosition(rules.getPosition());
    setCurrentPlyIndex(startPly);
    setWrongFeedback(null);
    setCorrectFeedback(null);
    setHintLevel(0);
    setIsOpponentThinking(false);
  }, []);

  // Initialize board on mount or when currentLesson changes
  useEffect(() => {
    setupLessonBoard(currentLesson);
  }, [currentLesson, setupLessonBoard]);

  // Current expected move from lesson definition
  const currentExpectedMove: CurriculumMove | undefined = currentLesson.moves[currentPlyIndex];
  const isLessonComplete = currentPlyIndex >= currentLesson.moves.length;

  // Last move for board highlight
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

  // Handle board move by user
  const handleBoardMove = async (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    if (isLessonComplete || isOpponentThinking) return;

    const game = rulesRef.current;
    const testChess = new Chess(game.getFen());
    const attemptedMove = testChess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || 'q',
    });

    if (!attemptedMove) {
      return; // Illegal chess move
    }

    const playedSan = attemptedMove.san;
    const expectedSan = currentExpectedMove?.san;

    // Normalize SAN for matching (e.g. strip annotations ! or ?)
    const cleanPlayed = playedSan.replace(/[!?+#]/g, '');
    const cleanExpected = expectedSan ? expectedSan.replace(/[!?+#]/g, '') : '';

    if (cleanPlayed === cleanExpected) {
      // Correct Move!
      const moveRes = game.makeMove(move);
      if (!moveRes.success) return;

      setPosition(game.getPosition());
      setWrongFeedback(null);
      setCorrectFeedback(`Correct! Great move! ${currentExpectedMove?.annotation || ''}`);
      setHintLevel(0);

      const nextPly = currentPlyIndex + 1;
      setCurrentPlyIndex(nextPly);

      // Check if next move is opponent reply (isUserMove === false)
      if (nextPly < currentLesson.moves.length && !currentLesson.moves[nextPly].isUserMove) {
        setIsOpponentThinking(true);
        setTimeout(() => {
          const opponentMove = currentLesson.moves[nextPly];
          game.makeMove(opponentMove.san);
          setPosition(game.getPosition());
          setCurrentPlyIndex(nextPly + 1);
          setIsOpponentThinking(false);
        }, 400);
      }
    } else {
      // Deliberate or incorrect move!
      // Check if known wrong move feedback exists
      let feedbackMsg = '';
      if (currentExpectedMove?.wrongMoveFeedback) {
        feedbackMsg =
          currentExpectedMove.wrongMoveFeedback[cleanPlayed] ||
          currentExpectedMove.wrongMoveFeedback[playedSan] ||
          currentExpectedMove.wrongMoveFeedback[move.to] ||
          '';
      }

      if (!feedbackMsg) {
        feedbackMsg = `Mistake: ${playedSan} is not the recommended move in this position. Keep studying the line and try again!`;
      }

      // Display wrong move feedback
      setWrongFeedback(feedbackMsg);
      setCorrectFeedback(null);
      setIsShaking(true);

      // Temporarily apply move to show user what they played, then auto-rollback
      game.makeMove(move);
      setPosition(game.getPosition());

      setTimeout(() => {
        setIsShaking(false);
      }, 400);

      // Auto-rollback board state after short delay (approx 450ms)
      setTimeout(() => {
        game.undoMove();
        setPosition(game.getPosition());
      }, 450);
    }
  };

  // Progressive Hint Handler
  const handleRevealHint = () => {
    setHintLevel((prev) => Math.min(3, prev + 1));
  };

  // Spaced Repetition (SM-2) Rating Handler
  const handleRateSRS = async (grade: number) => {
    try {
      const updated = await SrsService.recordReview(currentLesson.id, grade);
      setSrsCard(updated);
      const gradeLabels = ['Again', 'Again', 'Again', 'Hard', 'Good', 'Easy'];
      setSrsMessage(`Rated ${gradeLabels[grade]}: Scheduled next review in ${updated.intervalDays} day(s) (Leitner Box ${updated.box})`);
      setTimeout(() => setSrsMessage(null), 4000);
    } catch (err) {
      console.warn('Error rating SRS:', err);
    }
  };

  // Switch Active Lesson
  const handleSelectLesson = (lesson: CurriculumLesson) => {
    setCurrentLesson(lesson);
    setupLessonBoard(lesson);
  };

  // Restart Active Lesson from Beginning
  const handleRestartLesson = () => {
    setupLessonBoard(currentLesson, 0);
  };

  // Reset back to initial critical drill position
  const handleResetToDrillStart = () => {
    setupLessonBoard(currentLesson);
  };

  // Filter lessons based on category
  const filteredLessons = useMemo(() => {
    if (selectedCategory === 'all') {
      const rest = allCurriculumLessons.filter((l) => l.category !== 'weakness_drill');
      return [...weaknessDrillLessons, ...rest];
    }
    const course = curriculumCourses.find((c) => c.category === selectedCategory);
    if (course) return course.lessons;
    return allCurriculumLessons.filter((l) => l.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="lessons-view w-full max-w-7xl mx-auto flex flex-col gap-6" data-view="lessons">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
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
            Step-by-step master lessons distilled from classical local chess books, featuring immediate mistake rollback and SuperMemo-2 review scheduling.
          </p>
        </div>

        {/* Global Spaced Repetition Status Badge */}
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
              <div className="text-amber-400 font-bold text-sm">
                {srsCard.easeFactor.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Layout: Left = Lesson Explorer & Course Cards, Right = Interactive Board & Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Course Filter & Lesson Cards */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Course Category Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              All Lessons ({allCurriculumLessons.length})
            </button>
            {curriculumCourses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === c.category
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {c.category === 'white_repertoire' && 'White Weapons'}
                {c.category === 'opening_traps' && 'Opening Traps'}
                {c.category === 'beginner_fundamentals' && 'Fundamentals'}
                {c.category === 'hoot65_drills' && 'Weakness Drills'}
              </button>
            ))}
          </div>

          {/* Lessons List */}
          <div className="flex flex-col gap-2.5 max-h-[720px] overflow-y-auto custom-scrollbar pr-1">
            {filteredLessons.map((lesson) => {
              const isSelected = lesson.id === currentLesson.id;
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
                        <span className="text-[10px] text-slate-400 capitalize">
                          {lesson.targetRatingBand}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="lesson-item text-left font-bold text-sm text-white hover:text-emerald-300 line-clamp-1"
                      >
                        {lesson.title}
                      </button>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {lesson.subtitle || lesson.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 mt-1 flex-shrink-0 transition-transform ${
                        isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'
                      }`}
                    />
                  </div>

                  {/* Book Source Attribution Text */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">
                      <strong className="text-slate-300">Source:</strong> {lesson.sourceBook}
                    </span>
                    <span className="text-slate-500 whitespace-nowrap ml-2">
                      {lesson.author}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Drill Chessboard, Move Navigation, Feedback & SRS */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Active Lesson Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Active Lesson
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {currentLesson.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentLesson.subtitle || currentLesson.thematicObjective}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestartLesson}
                  title="Play from move 1"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart (1.e4)</span>
                </button>
                {currentLesson.id === 'lesson-scandinavian-refutation-drill' && (
                  <button
                    type="button"
                    onClick={handleResetToDrillStart}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors"
                  >
                    Drill Point (1...d5)
                  </button>
                )}
              </div>
            </div>

            {/* Book Source Reference Banner */}
            <div className="mt-2.5 text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Distilled from <strong className="text-slate-200">{currentLesson.sourceBook}</strong> by {currentLesson.author}
                {currentLesson.pagesRef ? ` (${currentLesson.pagesRef})` : ''}
              </span>
            </div>
          </div>

          {/* Chessboard Container with shake animation on wrong move */}
          <div className="flex flex-col items-center">
            <div className={`relative transition-transform duration-200 ${isShaking ? 'animate-shake' : ''}`}>
              <Chessboard
                board={rulesRef.current.getBoard()}
                position={position}
                orientation={currentLesson.targetColor === 'black' ? 'b' : 'w'}
                lastMove={lastMove}
                interactive={!isLessonComplete && !isOpponentThinking}
                onMove={handleBoardMove}
                getLegalMovesForSquare={(sq) => rulesRef.current.getLegalMovesForSquare(sq)}
              />

              {/* Opponent Thinking Overlay */}
              {isOpponentThinking && (
                <div className="absolute top-3 right-3 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Opponent replying...
                </div>
              )}
            </div>
          </div>

          {/* Instructional Prompt & Feedback Area */}
          <div className="flex flex-col gap-3">
            {/* Wrong Move Feedback Card */}
            {wrongFeedback && (
              <div
                className="wrong-move-feedback p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm font-medium flex items-start gap-2.5 shadow-lg animate-fadeIn"
                data-feedback="wrong"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-red-300 text-xs uppercase tracking-wider mb-0.5">
                    Instructional Mistake Feedback
                  </div>
                  <p className="text-sm leading-relaxed">{wrongFeedback}</p>
                </div>
              </div>
            )}

            {/* Correct Move Feedback Card */}
            {correctFeedback && (
              <div
                className="correct-feedback p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-sm font-medium flex items-start gap-2.5 shadow-lg animate-fadeIn"
                data-feedback="correct"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-emerald-300 text-xs uppercase tracking-wider mb-0.5">
                    Well Done!
                  </div>
                  <p className="text-sm leading-relaxed">{correctFeedback}</p>
                </div>
              </div>
            )}

            {/* Progressive Hint Card */}
            {hintLevel > 0 && currentExpectedMove && (
              <div
                className="hint-content p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-sm shadow-md"
                data-hint="active"
              >
                <div className="flex items-center gap-2 font-bold text-amber-300 text-xs uppercase tracking-wider mb-1">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  Progressive Hint (Level {hintLevel} of 3)
                </div>
                {hintLevel === 1 && (
                  <p className="text-sm">
                    Focus on your <strong className="text-amber-100">{currentExpectedMove.hintPiece || 'key piece'}</strong>.
                  </p>
                )}
                {hintLevel === 2 && (
                  <p className="text-sm">
                    Move your <strong className="text-amber-100">{currentExpectedMove.hintPiece || 'piece'}</strong> toward square <strong className="text-white font-mono bg-amber-900/60 px-1.5 py-0.5 rounded">{currentExpectedMove.hintSquare || currentExpectedMove.san}</strong>.
                    {currentExpectedMove.hintTheme && ` Motif: ${currentExpectedMove.hintTheme}.`}
                  </p>
                )}
                {hintLevel >= 3 && (
                  <p className="text-sm">
                    Play <strong className="text-emerald-300 font-mono text-base bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">{currentExpectedMove.san}</strong>!
                    {currentExpectedMove.annotation ? ` ${currentExpectedMove.annotation}` : ''}
                  </p>
                )}
              </div>
            )}

            {/* Interactive Control Toolbar: Hint, Restart & Moves List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-action="hint"
                  onClick={handleRevealHint}
                  disabled={isLessonComplete}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Hint {hintLevel > 0 ? `(${hintLevel}/3)` : ''}</span>
                </button>

                <div className="text-xs text-slate-400 pl-2 border-l border-slate-800">
                  Ply <strong className="text-white">{currentPlyIndex}</strong> of {currentLesson.moves.length}
                </div>
              </div>

              {/* Lesson Completion Status */}
              {isLessonComplete ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                  <span>Lesson Completed! Rate your recall below:</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  {currentExpectedMove?.isUserMove ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      Your Turn: Find White&apos;s move
                    </span>
                  ) : (
                    <span className="text-slate-400">Black&apos;s turn</span>
                  )}
                </div>
              )}
            </div>

            {/* SuperMemo-2 (SM-2) Spaced Repetition Review Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
              <div>
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Spaced Repetition Review (SM-2 / Leitner Box)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  How well did you recall this line without mistakes or hints?
                </div>
                {srsMessage && (
                  <div className="text-xs font-semibold text-emerald-400 mt-1 animate-fadeIn">
                    ✓ {srsMessage}
                  </div>
                )}
              </div>

              {/* SM-2 Rating Buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  data-grade="1"
                  onClick={() => handleRateSRS(1)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/70 text-red-300 border border-red-500/40 text-xs font-semibold transition-colors"
                >
                  Again (1d)
                </button>
                <button
                  type="button"
                  data-grade="3"
                  onClick={() => handleRateSRS(3)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors"
                >
                  Hard
                </button>
                <button
                  type="button"
                  data-grade="4"
                  onClick={() => handleRateSRS(4)}
                  className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm shadow-emerald-700/50"
                >
                  Good
                </button>
                <button
                  type="button"
                  data-grade="5"
                  onClick={() => handleRateSRS(5)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/70 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-colors"
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
