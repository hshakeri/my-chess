import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import {
  Gamepad2,
  Database,
  Activity,
  GraduationCap,
  Printer,
} from 'lucide-react';

import { RulesEngine } from './engine/rules';
import { EngineClient } from './engine/worker/engineClient';
import { Square, PieceColor, ChessPosition, ChessMoveRecord } from './types/chess';
import { HumanElo } from './types/engine';
import { Chessboard } from './components/Chessboard';
import { BoardControls } from './components/BoardControls';
import { PracticeClock, newClockStore, type PaceTargets } from './components/PracticeClock';
import { cannotMate } from './analytics/finalPosition';
import { BoardQuestion, isRight, questionSquareStyles, type QuestionAnswer, type QuestionStatus } from './components/BoardQuestion';
import { isMoveSafe, questionBeforeDecision, type MicroQuestion, type MoveSafety } from './services/microQuestions';
import { withinNodes } from './analytics/errorTaxonomy';
import { logCct } from './services/cctLog';

/** The Play tab's board question before each of the student's moves (CL-5 in real games); off unless switched on. */
const PLAY_GATE_KEY = 'my_chess_play_gate';
const PLAY_SAFETY_KEY = 'my_chess_play_safety';
/** The safety check's search budget: a couple of seconds in the worker, past which the position is called too busy to check. */
const PLAY_SAFE_NODES = 20_000;
import { summarizeClock } from './analytics/clock';
import { MoveList } from './components/MoveList';
import { PositionSetupModal } from './components/PositionSetupModal';
import { EngineControls } from './components/EngineControls';
import { DatabaseView } from './views/DatabaseView';
import { DiagnosticsView } from './views/DiagnosticsView';
import { LessonsView } from './views/LessonsView';
import { WorksheetsView } from './views/WorksheetsView';
import { gamesRepo } from './db/gamesRepo';
import { StoredGame } from './types/db';
import { CurriculumLesson } from './types/curriculum';
import { OpeningDeviation, RepertoirePlan } from './types/diagnostics';
import { getRepertoireById } from './analytics/repertoire';
import { lessonFromDeviation, lessonFromRepertoireLine } from './curriculum/factories';
import { REPERTOIRE_LINE_TO_LESSON } from './curriculum/repertoireLessons';
import seedGamesRaw from './data/seed_hoot65_games.json';
import { EngineContext } from './engine/EngineContext';
import { SparPanel, type SparReview } from './components/SparPanel';
import { DEFAULT_MILESTONES, evaluateMilestones } from './analytics/planMilestones';
import { logSpar, type SparRequest } from './services/sparLog';
import { formatRoute, parseHash, type Route } from './router';
import { allCurriculumLessons } from './curriculum';
import type { ReviewProgress } from './engine/worker/engineClient';

const seedGames = seedGamesRaw as unknown as StoredGame[];

type ActiveTab = 'play' | 'database' | 'diagnostics' | 'lessons' | 'worksheets';

const ADOPTED_REPERTOIRES_KEY = 'my_chess_adopted_repertoires_v1';

function readAdoptedRepertoires(): string[] {
  try {
    const raw = window.localStorage.getItem(ADOPTED_REPERTOIRES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** The route the page was opened with (DC-5), read once before the first render. */
const initialRoute: Route | null = typeof window === 'undefined' ? null : parseHash(window.location.hash);
const isAuthoredLesson = (id: string) => allCurriculumLessons.some((l) => l.id === id);

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => initialRoute?.view ?? 'play');

  // Live game archive from IndexedDB (seeded on first run), shared with Diagnostics
  const [dbGames, setDbGames] = useState<StoredGame[] | null>(null);
  // A lesson handed over from Diagnostics: an authored one by id, or one built on the fly
  // `seq` tells two hand-offs of the same lesson apart, so a second link to it reopens it
  const [pendingLesson, setPendingLesson] = useState<{ id?: string; lesson?: CurriculumLesson; seq?: number } | null>(() =>
    initialRoute?.lessonId && isAuthoredLesson(initialRoute.lessonId) ? { id: initialRoute.lessonId } : null
  );
  // The lesson on screen in the Lessons tab, for the URL hash
  const [shownLessonId, setShownLessonId] = useState<string | null>(null);
  // A game opened by a link (#/game/<id>): the Games tab opens its replay and review
  const [pendingGame, setPendingGame] = useState<{ id: string; seq: number } | null>(() =>
    initialRoute?.gameId ? { id: initialRoute.gameId, seq: 0 } : null
  );
  const [adoptedRepertoireIds, setAdoptedRepertoireIds] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readAdoptedRepertoires()
  );

  const loadGames = useCallback(async () => {
    try {
      await gamesRepo.seedIfEmpty(seedGames);
      const all = await gamesRepo.getAllGames();
      // Keep the same array when nothing changed so the diagnostics report is not recomputed on every tab switch
      setDbGames((prev) =>
        prev &&
        prev.length === all.length &&
        prev[0]?.id === all[0]?.id &&
        prev[prev.length - 1]?.id === all[all.length - 1]?.id
          ? prev
          : all
      );
    } catch (err) {
      console.warn('Could not load the game archive from IndexedDB:', err);
      setDbGames((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Re-read the archive whenever the Diagnostics tab opens so synced or uploaded games are included
  useEffect(() => {
    if (activeTab === 'diagnostics') loadGames();
  }, [activeTab, loadGames]);

  // A manual tab click clears any lesson hand-off so the Lessons tab opens on its default again
  const selectTab = useCallback((tab: ActiveTab) => {
    setPendingLesson(null);
    setActiveTab(tab);
  }, []);

  // A repertoire line opens its authored lesson when one exists, otherwise a lesson built from the line itself
  const handleNavigateToLesson = useCallback((repertoireId: string, lineId?: string) => {
    const authored = lineId ? REPERTOIRE_LINE_TO_LESSON[lineId] : undefined;
    if (authored) {
      setPendingLesson({ id: authored });
    } else {
      const plan = getRepertoireById(repertoireId);
      const line = plan?.lines.find((l) => l.id === lineId);
      let lesson: CurriculumLesson | undefined;
      if (plan && line) {
        try {
          lesson = lessonFromRepertoireLine(line, plan.color);
        } catch (err) {
          console.warn('Could not build a lesson from the repertoire line:', err);
        }
      }
      setPendingLesson(lesson ? { lesson } : null);
    }
    setActiveTab('lessons');
  }, []);

  // A deviation from the plan becomes a one-decision drill at that very position
  const handlePracticeDeviation = useCallback((deviation: OpeningDeviation) => {
    try {
      setPendingLesson({ lesson: lessonFromDeviation(deviation) });
    } catch (err) {
      console.warn('Could not build a drill from the deviation:', err);
      setPendingLesson(null);
    }
    setActiveTab('lessons');
  }, []);

  // Adopting a plan remembers it and opens its first line as a lesson
  const handleAdoptRepertoire = useCallback(
    (plan: RepertoirePlan) => {
      setAdoptedRepertoireIds((prev) => {
        const next = prev.includes(plan.id) ? prev : [...prev.filter((id) => getRepertoireById(id)?.color !== plan.color), plan.id];
        try {
          window.localStorage.setItem(ADOPTED_REPERTOIRES_KEY, JSON.stringify(next));
        } catch {
          // Private mode or quota: the choice still applies for this session
        }
        return next;
      });
      const first = plan.lines[0];
      if (first) handleNavigateToLesson(plan.id, first.id);
    },
    [handleNavigateToLesson]
  );

  // Rules Engine instance (ref preserved across re-renders)
  const rulesRef = useRef<RulesEngine>(new RulesEngine());
  const engineClientRef = useRef<EngineClient | null>(null);
  // The same client for every tab through the engine context (state, so consumers see it once started)
  const [engineClient, setEngineClient] = useState<EngineClient | null>(null);

  // A spar: a lesson's position played on against Maia, with plan goals and a review (CL-6)
  const [spar, setSpar] = useState<{ request: SparRequest; startFen: string; startPly: number } | null>(null);
  const [sparReview, setSparReview] = useState<SparReview | null>(null);
  const [sparProgress, setSparProgress] = useState<string | null>(null);

  // Board state
  const [position, setPosition] = useState<ChessPosition>(() => rulesRef.current.getPosition());
  const [history, setHistory] = useState<ChessMoveRecord[]>([]);
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [orientation, setOrientation] = useState<PieceColor>('w');

  // Engine state
  const [engineColor, setEngineColorState] = useState<'w' | 'b' | 'none'>('b');
  // Choosing the engine's colour also turns the board so the student's pieces are at the bottom
  const setEngineColor = useCallback((color: 'w' | 'b' | 'none') => {
    setEngineColorState(color);
    if (color === 'w') setOrientation('b');
    else if (color === 'b') setOrientation('w');
  }, []);
  const [elo, setElo] = useState<HumanElo>(1500);
  const [isThinking, setIsThinking] = useState(false);
  // The practice clock (DC-3): restarted with each game, and the side that ran out of time
  const [clockKey, setClockKey] = useState(0);
  const [flagged, setFlagged] = useState<'w' | 'b' | null>(null);
  const onFlag = useCallback((side: 'w' | 'b') => setFlagged(side), []);
  const onClockReset = useCallback(() => setFlagged(null), []);
  // The clock's state outlives the Play tab, so another tab and back neither restarts it nor revives a flagged game
  const clockStore = useRef(newClockStore());
  // CL-5 in games: before each of the student's moves, what does the engine's last move attack?
  const [playGateOn, setPlayGateOn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(PLAY_GATE_KEY) === 'on';
    } catch {
      return false;
    }
  });
  // Kept for one position of one game: a new game, a loaded position or a takeback that Maia answers differently asks again
  const [playGate, setPlayGate] = useState<{ question: MicroQuestion; fen: string; picked: string[]; status: QuestionStatus; askedAt: number; ply: number; game: number } | null>(null);
  // Habit 1 in games: before each of the student's moves is played, is it safe? (Nothing left to take, no mate in one)
  const [safetyOn, setSafetyOn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(PLAY_SAFETY_KEY) === 'on';
    } catch {
      return false;
    }
  });
  const [safety, setSafety] = useState<{
    move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' };
    san: string;
    fen: string;
    ply: number;
    game: number;
    token: string;
    askedAt: number;
    /** The student's answer and how long it took, once given. */
    answer?: boolean;
    answerMs?: number;
    /** The search's verdict once it arrives (it runs while the student answers); null when the position was too busy. */
    verdict?: MoveSafety | null;
    /** Graded and logged; the answer stays up until the next move. */
    settled?: boolean;
  } | null>(null);
  const [tierUsed, setTierUsed] = useState<'human_opening_book' | 'maia_neural' | 'heuristic_fallback' | undefined>(undefined);
  const [centipawns, setCentipawns] = useState<number | undefined>(undefined);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  // Setup Modal state
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // Initialize EngineClient once
  useEffect(() => {
    const client = new EngineClient();
    engineClientRef.current = client;
    setEngineClient(client);

    const unsubscribe = client.onStatusChange((loaded) => {
      setModelLoaded(loaded);
    });

    return () => {
      unsubscribe();
      client.terminate();
    };
  }, []);

  // Update position snapshot from current game or historical ply
  const isBrowsingHistory = currentPly !== history.length;

  const historicalEngine = useMemo(() => {
    if (!isBrowsingHistory) return null;
    if (currentPly === 0) {
      return new RulesEngine(rulesRef.current.getInitialFen());
    }
    const targetFen = history[currentPly - 1]?.fenAfter;
    return new RulesEngine(targetFen || rulesRef.current.getFen());
  }, [isBrowsingHistory, currentPly, history]);

  const displayEngine = isBrowsingHistory && historicalEngine ? historicalEngine : rulesRef.current;

  const displayBoard = useMemo(() => {
    return displayEngine.getBoard();
  }, [displayEngine, position, currentPly]);

  const displayPosition = useMemo(() => {
    return isBrowsingHistory && historicalEngine ? historicalEngine.getPosition() : position;
  }, [isBrowsingHistory, historicalEngine, position]);

  // Last move coordinates for highlighting
  const lastMove = useMemo<{ from: Square; to: Square } | null>(() => {
    if (currentPly === 0 || history.length === 0) return null;
    const targetRec = history[currentPly - 1];
    if (!targetRec || !targetRec.uci || targetRec.uci.length < 4) return null;
    return {
      from: targetRec.uci.substring(0, 2) as Square,
      to: targetRec.uci.substring(2, 4) as Square,
    };
  }, [currentPly, history]);

  // Request engine move callback
  const requestEngineMove = useCallback(async () => {
    if (!engineClientRef.current || isThinking || flagged) return;
    const game = rulesRef.current;
    if (game.isGameOver()) return;

    setIsThinking(true);
    try {
      const fen = game.getFen();
      const moveHistorySan = game.getHistory().map((m) => m.san);
      const priorMoves = game.getHistory().map((m) => m.uci);

      const response = await engineClientRef.current.requestMove({
        type: 'search',
        fen,
        elo,
        moveHistorySan,
        priorMoves,
        // A spar meets the lesson's sidelines as Maia plays them, not the book's main line
        ...(spar ? { options: { enableOpeningBook: false, thinkingTimeMs: 300 } } : {}),
      });

      // A takeback, a new game or a loaded position while the engine thought: its move is for a position
      // that is gone, so it is dropped
      if (rulesRef.current !== game || game.getFen() !== fen) return;
      if (response && response.bestMoveSan) {
        const moveRes = game.makeMove(response.bestMoveSan);
        if (moveRes.success) {
          const newHist = game.getHistory();
          setHistory(newHist);
          setCurrentPly(newHist.length);
          setPosition(game.getPosition());
          setTierUsed(response.tierUsed);
          if (response.centipawns !== undefined) {
            setCentipawns(response.centipawns);
          }
        }
      }
    } catch (err) {
      console.warn('Engine move request error:', err);
    } finally {
      setIsThinking(false);
    }
  }, [elo, isThinking, spar, flagged]);

  // The opponents' pace in the student's own games, for the practice clock at the same time control
  const pace = useMemo<PaceTargets | undefined>(() => {
    const summary = dbGames ? summarizeClock(dbGames) : null;
    if (!summary) return undefined;
    return { control: `${summary.base}+${summary.increment}`, targets: Object.fromEntries(summary.pace.map((p) => [p.move, p.theirs])) };
  }, [dbGames]);

  // The Play tab's board question: asked once per position where the student is to move after the engine's move
  useEffect(() => {
    if (!playGateOn || activeTab !== 'play' || engineColor === 'none' || flagged) return;
    if (currentPly !== history.length || history.length === 0) return;
    const game = rulesRef.current;
    if (game.isGameOver() || game.getTurn() === engineColor) return;
    if (playGate && playGate.ply === history.length && playGate.game === clockKey && playGate.fen === game.getFen()) return;
    const last = history[history.length - 1];
    const fenBefore = history.length >= 2 ? history[history.length - 2].fenAfter : game.getInitialFen();
    try {
      setPlayGate({ question: questionBeforeDecision(game.getFen(), { fenBefore, san: last.san }), fen: game.getFen(), picked: [], status: 'asking', askedAt: Date.now(), ply: history.length, game: clockKey });
    } catch (err) {
      console.warn('No board question for this position:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playGateOn, activeTab, engineColor, flagged, currentPly, history.length, clockKey]);

  const playGateHere =
    playGate && playGate.ply === history.length && playGate.game === clockKey && playGate.fen === rulesRef.current.getFen() ? playGate : null;
  const playGateAsking = !!playGateHere && playGateHere.status === 'asking';
  const pickPlayGateSquare = useCallback((square: Square) => {
    setPlayGate((g) => (g && g.status === 'asking' ? { ...g, picked: g.picked.includes(square) ? g.picked.filter((x) => x !== square) : [...g.picked, square] } : g));
  }, []);
  const submitPlayGate = (answer: QuestionAnswer) => {
    if (!playGate || playGate.status !== 'asking') return;
    const right = isRight(playGate.question, answer);
    const now = Date.now();
    logCct({ at: now, kind: playGate.question.kind, correct: right, ms: now - playGate.askedAt, source: 'play', fen: playGate.fen });
    setPlayGate({ ...playGate, picked: Array.isArray(answer) ? answer : playGate.picked, status: right ? 'right' : 'wrong' });
  };
  const togglePlayGate = (on: boolean) => {
    setPlayGateOn(on);
    try {
      window.localStorage.setItem(PLAY_GATE_KEY, on ? 'on' : 'off');
    } catch {
      // the switch still works for this visit
    }
    if (!on) setPlayGate(null);
  };

  // Trigger engine move when it's engine's turn and at the live position
  useEffect(() => {
    if (activeTab !== 'play') return;
    if (engineColor === 'none' || flagged) return;
    if (currentPly !== history.length) return; // don't move while browsing history

    const currentTurn = rulesRef.current.getTurn();
    const isEngineTurn = currentTurn === engineColor;
    const isGameOver = rulesRef.current.isGameOver();

    if (isEngineTurn && !isGameOver && !isThinking) {
      const timer = setTimeout(() => {
        requestEngineMove();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab, engineColor, currentPly, history.length, isThinking, requestEngineMove, flagged]);

  // Handle player move from the board
  const playMove = (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    const game = rulesRef.current;
    const result = game.makeMove(move);
    if (result.success) {
      const newHist = game.getHistory();
      setHistory(newHist);
      setCurrentPly(newHist.length);
      setPosition(game.getPosition());
    }
  };

  const handleBoardMove = (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    if (flagged) return;
    // If reviewing history, snap to end before moving
    if (currentPly !== history.length) {
      setCurrentPly(history.length);
    }

    const game = rulesRef.current;
    // The safety check: in a game against the engine, the student's move waits for the answer
    if (safetyOn && engineColor !== 'none' && game.getTurn() !== engineColor && !game.isGameOver()) {
      const fen = game.getFen();
      let san: string | null = null;
      try {
        san = new Chess(fen).move(move).san;
      } catch {
        san = null;
      }
      if (san) {
        const token = `${clockKey}:${history.length}:${san}:${Date.now()}`;
        setSafety({ move, san, fen, ply: history.length, game: clockKey, token, askedAt: Date.now() });
        const verdict = engineClient
          ? engineClient.checkMoveSafety(fen, san, PLAY_SAFE_NODES)
          : Promise.resolve().then(() => withinNodes(PLAY_SAFE_NODES, () => isMoveSafe(fen, san!)) ?? null);
        verdict.then((v) => setSafety((s) => (s && s.token === token ? { ...s, verdict: v } : s)));
        return;
      }
    }
    playMove(move);
  };

  const safetyHere =
    safety && safety.ply === history.length && safety.game === clockKey && safety.fen === rulesRef.current.getFen() && !flagged ? safety : null;
  // A takeback, a move or a new game ends the check: its question and verdict were for the position before
  useEffect(() => setSafety(null), [history.length, clockKey]);
  const safetyWaiting = !!safetyHere && !safetyHere.settled;
  const submitSafety = (answer: QuestionAnswer) => {
    if (!safetyHere || safetyHere.answer !== undefined || typeof answer !== 'boolean') return;
    setSafety({ ...safetyHere, answer, answerMs: Date.now() - safetyHere.askedAt });
  };
  // Once both the answer and the verdict are in: log it, and play a safe move the student called safe
  useEffect(() => {
    if (!safetyHere || safetyHere.settled || safetyHere.answer === undefined || safetyHere.verdict === undefined) return;
    const { verdict, answer } = safetyHere;
    if (verdict) logCct({ at: Date.now(), kind: 'safe', correct: answer === verdict.safe, ms: safetyHere.answerMs ?? 0, source: 'play', fen: safetyHere.fen });
    if (verdict && verdict.safe && answer) {
      setSafety(null);
      playMove(safetyHere.move);
      return;
    }
    setSafety({ ...safetyHere, settled: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safetyHere?.token, safetyHere?.answer, safetyHere?.verdict, safetyHere?.settled]);
  const safetyRefutation = useMemo(() => {
    const v = safetyHere?.verdict;
    if (!safetyHere || !v?.refutation) return undefined;
    try {
      const after = new Chess(safetyHere.fen);
      after.move(safetyHere.san);
      const reply = after.move(v.refutation);
      return { from: reply.from, to: reply.to };
    } catch {
      return undefined;
    }
  }, [safetyHere?.token, safetyHere?.verdict]);
  const toggleSafety = (on: boolean) => {
    setSafetyOn(on);
    try {
      window.localStorage.setItem(PLAY_SAFETY_KEY, on ? 'on' : 'off');
    } catch {
      // the switch still works for this visit
    }
    if (!on) setSafety(null);
  };

  // Flip board orientation
  const handleFlipOrientation = () => {
    setOrientation((prev) => (prev === 'w' ? 'b' : 'w'));
  };

  // Move navigation
  const handleNavigateStart = () => setCurrentPly(0);
  const handleNavigatePrev = () => setCurrentPly((p) => Math.max(0, p - 1));
  const handleNavigateNext = () => setCurrentPly((p) => Math.min(history.length, p + 1));
  const handleNavigateEnd = () => setCurrentPly(history.length);

  // Takeback move
  const handleTakeback = () => {
    const game = rulesRef.current;
    if (game.getHistory().length === 0) return;

    // In engine play, roll back 2 plies if engine just moved, so it returns to human's turn
    if (engineColor !== 'none' && game.getTurn() !== engineColor && game.getHistory().length >= 2) {
      game.undoMove();
      game.undoMove();
    } else {
      game.undoMove();
    }

    const newHist = game.getHistory();
    setHistory(newHist);
    setCurrentPly(newHist.length);
    setPosition(game.getPosition());
  };

  // Reset / New Game
  const handleNewGame = () => {
    rulesRef.current.reset();
    setHistory([]);
    setCurrentPly(0);
    setPosition(rulesRef.current.getPosition());
    setTierUsed(undefined);
    setCentipawns(undefined);
    setClockKey((k) => k + 1);
  };

  /** Today's game: the Play tab against Maia with both checks on (a finished game makes way for a new one). */
  const playWithChecks = () => {
    togglePlayGate(true);
    toggleSafety(true);
    if (engineColor === 'none') setEngineColor(orientation === 'w' ? 'b' : 'w');
    if (rulesRef.current.isGameOver() || flagged) handleNewGame();
    setActiveTab('play');
  };

  // Custom FEN / PGN Setup
  const handleLoadFen = (fen: string) => {
    const res = rulesRef.current.loadFen(fen);
    if (res.success) {
      setHistory([]);
      setCurrentPly(0);
      setPosition(rulesRef.current.getPosition());
      setTierUsed(undefined);
      setClockKey((k) => k + 1);
    }
    return res;
  };

  // Deep links (DC-5): a route opened while the app runs moves to its tab and lesson; a position for
  // the Play tab is set up with the engine on the other side
  const loadFenRef = useRef(handleLoadFen);
  loadFenRef.current = handleLoadFen;
  const applyRoute = useCallback(
    (route: Route | null) => {
      if (!route) return;
      if (route.view === 'lessons') {
        setPendingLesson(route.lessonId && isAuthoredLesson(route.lessonId) ? { id: route.lessonId, seq: Date.now() } : null);
      }
      if (route.view === 'database' && route.gameId) setPendingGame({ id: route.gameId, seq: Date.now() });
      if (route.view === 'play' && route.fen && loadFenRef.current(route.fen).success && route.color) {
        setEngineColor(route.color === 'w' ? 'b' : 'w');
      }
      setActiveTab(route.view);
    },
    [setEngineColor]
  );
  useEffect(() => {
    // The tab and lesson of the opening route are already in the initial state; its position needs the board
    if (initialRoute?.view === 'play' && initialRoute.fen) applyRoute(initialRoute);
    const onHashChange = () => applyRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyRoute]);

  // The hash follows the screen (replaceState: a tab or lesson change adds no history entry)
  useEffect(() => {
    const route: Route =
      activeTab === 'lessons' && shownLessonId && isAuthoredLesson(shownLessonId) ? { view: 'lessons', lessonId: shownLessonId } : { view: activeTab };
    const next = formatRoute(route);
    const current = parseHash(window.location.hash);
    // A position link stays as it was opened while the Play tab shows it
    if (current?.view === 'play' && current.fen && activeTab === 'play') return;
    if (window.location.hash !== next) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  }, [activeTab, shownLessonId]);

  const handleLoadPgn = (pgn: string) => {
    const res = rulesRef.current.loadPgn(pgn);
    if (res.success) {
      const newHist = rulesRef.current.getHistory();
      setHistory(newHist);
      setCurrentPly(newHist.length);
      setPosition(rulesRef.current.getPosition());
      setTierUsed(undefined);
      setClockKey((k) => k + 1);
    }
    return res;
  };

  // Export PGN
  const handleExportPgn = () => {
    const pgn = rulesRef.current.exportPgn();
    navigator.clipboard?.writeText(pgn);
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${Date.now()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Spar from a lesson (CL-6) -----------------------------------------------------------------

  const START_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  /** Set the Play tab to the lesson's position and let Maia take the other side. */
  const startSpar = useCallback(
    (request: SparRequest) => {
      // From the standard start the moves are replayed, so Maia sees the game so far; from any other
      // start it gets the position alone (its move history is read from the standard start)
      let rules: RulesEngine;
      if (request.initialFen === START_POSITION) {
        rules = new RulesEngine();
        for (const san of request.movesSan) rules.makeMove(san);
      } else {
        const reached = new RulesEngine(request.initialFen);
        for (const san of request.movesSan) reached.makeMove(san);
        rules = new RulesEngine(reached.getFen());
      }
      rulesRef.current = rules;
      const hist = rules.getHistory();
      setHistory(hist);
      setCurrentPly(hist.length);
      setPosition(rules.getPosition());
      setTierUsed(undefined);
      setCentipawns(undefined);
      setElo(request.elo);
      setEngineColor(request.studentColor === 'w' ? 'b' : 'w');
      setSpar({ request, startFen: rules.getFen(), startPly: hist.length });
      setSparReview(null);
      setSparProgress(null);
      setClockKey((k) => k + 1);
      setActiveTab('play');
    },
    [setEngineColor]
  );

  const sparMoves = spar ? history.slice(spar.startPly).map((m) => m.san) : [];

  /** The plan goals reached, and the CL-3 review of the spar's moves. */
  const reviewSpar = useCallback(async () => {
    if (!spar) return;
    const { request, startFen } = spar;
    const moves = history.slice(spar.startPly).map((m) => m.san);
    const milestones = evaluateMilestones(startFen, moves, request.studentColor, [...DEFAULT_MILESTONES, ...request.milestones]);
    setSparProgress('Reviewing your moves…');
    let moments: SparReview['moments'] = [];
    let engine: SparReview['engine'] = 'material';
    const client = engineClientRef.current;
    if (client) {
      // The student's Chess.com rating, and Maia's own Elo (the review adds 400 to Chess.com ratings)
      const student = 1150;
      const maia = request.elo - 400;
      const run = client.reviewGame(
        {
          gameId: `spar:${request.lessonId}:${Date.now()}`,
          movesSan: moves,
          initialFen: startFen,
          userColor: request.studentColor === 'w' ? 'white' : 'black',
          whiteRating: request.studentColor === 'w' ? student : maia,
          blackRating: request.studentColor === 'w' ? maia : student,
        },
        (p: ReviewProgress) => setSparProgress(p.total > 1 ? `Reviewing: ${Math.round((100 * p.done) / p.total)}%` : 'Reviewing…')
      );
      try {
        const review = await run.result;
        if (review) {
          moments = review.criticalMoments;
          engine = review.engine;
        }
      } catch (err) {
        console.warn('Spar review failed:', err);
      }
    }
    const result: SparReview = { milestones, moments, engine };
    setSparReview(result);
    setSparProgress(null);
    logSpar({
      at: Date.now(),
      lessonId: request.lessonId,
      title: request.title,
      elo: request.elo,
      studentColor: request.studentColor,
      startFen,
      moves,
      milestones,
      moments: moments.map((m) => ({ label: m.label, type: m.type })),
      engine,
    });
  }, [spar, history]);

  const gameOverStatus = rulesRef.current.getGameOverStatus();
  // A flag loses, unless the other side cannot mate (a lone king, or a king and one minor piece): a draw
  const flagResult = (() => {
    if (!flagged) return null;
    const name = (c: 'w' | 'b') => (c === 'w' ? 'White' : 'Black');
    const other = flagged === 'w' ? 'b' : 'w';
    return cannotMate(position.fen, other)
      ? { result: '1/2-1/2', reason: `${name(flagged)} ran out of time, but ${name(other)} cannot mate: a draw` }
      : { result: flagged === 'w' ? '0-1' : '1-0', reason: `${name(flagged)} lost on time` };
  })();

  return (
    <EngineContext.Provider value={engineClient}>
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="no-print print:hidden app-navbar border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-3 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30 font-bold text-white text-lg">
              ♟
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                My Chess <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Coach</span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Personalized 2D Chess & Human-Like AI Opponent
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center flex-nowrap gap-1 overflow-x-auto custom-scrollbar min-w-0" aria-label="Sections">
            <button
              type="button"
              data-tab="play"
              data-tab-nav="play"
              onClick={() => selectTab('play')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'play'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">Play vs Maia</span>
              <span className="sm:hidden">Play</span>
            </button>

            <button
              type="button"
              data-tab="database"
              data-tab-nav="database"
              onClick={() => selectTab('database')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'database'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Game Database</span>
              <span className="sm:hidden">Games</span>
            </button>

            <button
              type="button"
              data-tab="diagnostics"
              data-tab-nav="diagnostics"
              onClick={() => selectTab('diagnostics')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'diagnostics'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Opening Diagnostics</span>
              <span className="sm:hidden">Diagnostics</span>
            </button>

            <button
              type="button"
              data-tab="lessons"
              data-tab-nav="lessons"
              onClick={() => selectTab('lessons')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'lessons'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Interactive Lessons</span>
              <span className="sm:hidden">Lessons</span>
            </button>

            <button
              type="button"
              data-tab="worksheets"
              data-tab-nav="worksheets"
              onClick={() => selectTab('worksheets')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'worksheets'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Printable Worksheets</span>
              <span className="sm:hidden">Worksheets</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {activeTab === 'play' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: 2D Chessboard & Board Controls */}
            <div className="lg:col-span-7 flex flex-col items-center gap-3">
              {/* On a phone the engine panel sits below the board, so the essentials ride above it */}
              <div
                className="lg:hidden w-full max-w-[560px] bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                data-section="mobile-engine-strip"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-slate-400 shrink-0">You play</span>
                  <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-700">
                    {(
                      [
                        { c: 'b', label: 'White' },
                        { c: 'w', label: 'Black' },
                        { c: 'none', label: 'Both' },
                      ] as Array<{ c: 'w' | 'b' | 'none'; label: string }>
                    ).map((o) => (
                      <button
                        key={o.c}
                        type="button"
                        data-mobile-engine-color={o.c}
                        onClick={() => setEngineColor(o.c)}
                        className={`px-2 py-1 rounded font-medium ${
                          engineColor === o.c ? 'bg-slate-700 text-white' : 'text-slate-400'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <select
                  data-select="elo-mobile"
                  value={elo}
                  onChange={(e) => setElo(Number(e.target.value) as HumanElo)}
                  className="bg-slate-900 border border-slate-700 rounded-md py-1 px-1.5 text-xs text-white"
                  aria-label="Engine rating"
                >
                  {[1100, 1300, 1500, 1700, 1900].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] shrink-0" data-mobile-status>
                  {isThinking ? (
                    <span className="text-emerald-300">Thinking…</span>
                  ) : engineColor === 'none' ? (
                    <span className="text-slate-400">Free play</span>
                  ) : displayPosition.turn === engineColor ? (
                    <span className="text-amber-300">Maia to move</span>
                  ) : (
                    <span className="text-emerald-300">Your move</span>
                  )}
                </span>
              </div>
              <PracticeClock
                turn={position.turn}
                ply={history.length}
                resetKey={clockKey}
                student={engineColor === 'none' ? 'both' : engineColor === 'w' ? 'b' : 'w'}
                live={!rulesRef.current.isGameOver() && !flagged}
                onFlag={onFlag}
                onReset={onClockReset}
                store={clockStore.current}
                pace={rulesRef.current.getInitialFen() === START_POSITION ? pace : undefined}
              />
              <label className="w-full max-w-[560px] flex items-center gap-1.5 text-xs text-slate-300" title="Before each of your moves: which of your pieces does the engine's last move attack?">
                <input type="checkbox" data-toggle="play-gate" checked={playGateOn} onChange={(e) => togglePlayGate(e.target.checked)} className="accent-sky-500" />
                Board question before each of your moves
              </label>
              <label className="w-full max-w-[560px] flex items-center gap-1.5 text-xs text-slate-300" title="Before each of your moves is played: can your opponent then take something for free, or mate?">
                <input type="checkbox" data-toggle="play-safety" checked={safetyOn} onChange={(e) => toggleSafety(e.target.checked)} className="accent-sky-500" />
                Safety check before each of your moves is played
              </label>
              {playGateHere && (
                <div className="w-full max-w-[560px]">
                  <BoardQuestion question={playGateHere.question} fen={playGateHere.fen} picked={playGateHere.picked} status={playGateHere.status} onSubmit={submitPlayGate} />
                </div>
              )}
              {safetyHere && (
                <div className="w-full max-w-[560px] space-y-2" data-section="play-safety">
                  {!safetyHere.settled ? (
                    <BoardQuestion
                      question={{ kind: 'safe', prompt: `Before ${safetyHere.san} is played: is it safe? Nothing of yours left to take, and no mate in one.`, answer: true, move: safetyHere.san, reason: '' }}
                      fen={safetyHere.fen}
                      picked={[]}
                      status="asking"
                      onSubmit={submitSafety}
                    />
                  ) : safetyHere.verdict ? (
                    <BoardQuestion
                      question={{ kind: 'safe', prompt: `Before ${safetyHere.san} is played: is it safe? Nothing of yours left to take, and no mate in one.`, answer: safetyHere.verdict.safe, move: safetyHere.san, reason: safetyHere.verdict.reason }}
                      fen={safetyHere.fen}
                      picked={[]}
                      status={safetyHere.answer === safetyHere.verdict.safe ? 'right' : 'wrong'}
                      onSubmit={submitSafety}
                    />
                  ) : (
                    <p className="p-3 rounded-xl border text-sm bg-slate-900 border-slate-700 text-slate-200" data-section="board-question" data-question-status="unchecked">
                      Too many captures and checks here for the quick check: look again yourself before you play {safetyHere.san}.
                    </p>
                  )}
                  {!safetyHere.settled && safetyHere.answer !== undefined && (
                    <p className="text-xs text-slate-400" data-safety-checking>
                      Checking {safetyHere.san}…
                    </p>
                  )}
                  {safetyHere.settled && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {safetyHere.verdict?.safe === false ? (
                        <span className="text-slate-300">Make another move on the board, or</span>
                      ) : (
                        <button type="button" data-action="safety-play" onClick={() => { setSafety(null); playMove(safetyHere.move); }} className="px-2.5 py-1 rounded-md font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">
                          Play {safetyHere.san}
                        </button>
                      )}
                      <button
                        type="button"
                        data-action={safetyHere.verdict?.safe === false ? 'safety-play' : 'safety-other'}
                        onClick={() => {
                          setSafety(null);
                          if (safetyHere.verdict?.safe === false) playMove(safetyHere.move);
                        }}
                        className="px-2.5 py-1 rounded-md font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800"
                      >
                        {safetyHere.verdict?.safe === false ? `play ${safetyHere.san} anyway` : 'Choose another move'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <Chessboard
                board={displayBoard}
                position={displayPosition}
                orientation={orientation}
                lastMove={lastMove}
                interactive={currentPly === history.length && !isThinking && !flagged && !playGateAsking && !safetyWaiting}
                onSquarePick={playGateAsking && playGateHere && playGateHere.question.kind !== 'checks' && playGateHere.question.kind !== 'safe' ? pickPlayGateSquare : undefined}
                customSquareStyles={playGateHere ? questionSquareStyles(playGateHere.question, playGateHere.picked, playGateHere.status) : undefined}
                arrows={
                  safetyHere
                    ? [
                        { from: safetyHere.move.from, to: safetyHere.move.to, color: 'blue' as const },
                        ...(safetyHere.settled && safetyRefutation ? [{ ...safetyRefutation, color: 'red' as const }] : []),
                      ]
                    : undefined
                }
                onMove={handleBoardMove}
                getLegalMovesForSquare={(sq) => displayEngine.getLegalMovesForSquare(sq)}
              />

              <div className="w-full max-w-[560px]">
                <BoardControls
                  orientation={orientation}
                  onFlipOrientation={handleFlipOrientation}
                  canNavigatePrev={currentPly > 0}
                  canNavigateNext={currentPly < history.length}
                  onNavigateStart={handleNavigateStart}
                  onNavigatePrev={handleNavigatePrev}
                  onNavigateNext={handleNavigateNext}
                  onNavigateEnd={handleNavigateEnd}
                  onTakeback={handleTakeback}
                  canTakeback={history.length > 0 && !flagged}
                  onNewGame={handleNewGame}
                  onOpenPositionSetup={() => setIsSetupOpen(true)}
                  onExportPgn={handleExportPgn}
                />
              </div>
            </div>

            {/* Right Column: Engine Controls, Move List & Status */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {spar && (
                <SparPanel
                  request={spar.request}
                  startFen={spar.startFen}
                  moves={sparMoves}
                  review={sparReview}
                  reviewing={sparProgress !== null}
                  progressText={sparProgress ?? undefined}
                  onReview={reviewSpar}
                  onRestart={() => startSpar(spar.request)}
                  onLeave={() => {
                    setSpar(null);
                    setSparReview(null);
                  }}
                />
              )}

              {/* Engine Opponent Controls */}
              <EngineControls
                elo={elo}
                onChangeElo={setElo}
                engineColor={engineColor}
                onChangeEngineColor={setEngineColor}
                isThinking={isThinking}
                tierUsed={tierUsed}
                centipawns={centipawns}
                modelLoaded={modelLoaded}
                onRequestEngineMove={requestEngineMove}
                canRequestEngineMove={!rulesRef.current.isGameOver() && currentPly === history.length}
              />

              {/* Move Notation List */}
              <MoveList
                history={history}
                currentPly={currentPly}
                onSelectPly={setCurrentPly}
                result={flagResult ? flagResult.result : gameOverStatus.result || '*'}
                gameOverReason={flagResult ? flagResult.reason : gameOverStatus.reason}
                onCopyPgn={handleExportPgn}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Game Database */}
        {activeTab === 'database' && <DatabaseView onSpar={startSpar} openGame={pendingGame ?? undefined} />}

        {/* Tab 3: Opening Diagnostics */}
        {activeTab === 'diagnostics' && (
          <DiagnosticsView
            games={dbGames ?? undefined}
            isLoadingGames={dbGames === null}
            onNavigateToLesson={handleNavigateToLesson}
            onPracticeDeviation={handlePracticeDeviation}
            onAdoptRepertoire={handleAdoptRepertoire}
            adoptedRepertoireIds={adoptedRepertoireIds}
            onSpar={startSpar}
            onPlayWithChecks={playWithChecks}
          />
        )}

        {/* Tab 4: Interactive Lessons */}
        {activeTab === 'lessons' && (
          <LessonsView
            key={`${pendingLesson?.id ?? (pendingLesson?.lesson ? 'built' : 'default')}:${pendingLesson?.seq ?? 0}`}
            initialLessonId={pendingLesson?.id}
            initialLesson={pendingLesson?.lesson}
            onSpar={startSpar}
            onLessonChange={setShownLessonId}
            onPlayWithChecks={playWithChecks}
          />
        )}

        {/* Tab 5: Printable Worksheets */}
        {activeTab === 'worksheets' && <WorksheetsView />}
      </main>

      {/* Custom FEN/PGN Setup Modal */}
      <PositionSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onLoadFen={handleLoadFen}
        onLoadPgn={handleLoadPgn}
        currentFen={position.fen}
      />
    </div>
    </EngineContext.Provider>
  );
};

export default App;
