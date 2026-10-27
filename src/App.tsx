import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import seedGamesRaw from './data/seed_hoot65_games.json';

const seedGames = seedGamesRaw as unknown as StoredGame[];

type ActiveTab = 'play' | 'database' | 'diagnostics' | 'lessons' | 'worksheets';

/**
 * Repertoire lines that have an interactive lesson today. Lines without an entry
 * open the Lessons tab at its default lesson (the closed loop is completed in the
 * repertoire-divergence work, roadmap CL-4).
 */
const REPERTOIRE_LINE_TO_LESSON: Record<string, string> = {
  'white-scandi-refutation': 'lesson-scandinavian-refutation-drill',
  'white-italian-evans-gambit': 'lesson-evans-gambit-destruction',
  // The Scotch line has no authored lesson on the plan's own move order: it is built from the line
};

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

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');

  // Live game archive from IndexedDB (seeded on first run), shared with Diagnostics
  const [dbGames, setDbGames] = useState<StoredGame[] | null>(null);
  // A lesson handed over from Diagnostics: an authored one by id, or one built on the fly
  const [pendingLesson, setPendingLesson] = useState<{ id?: string; lesson?: CurriculumLesson } | null>(null);
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

  // Board state
  const [position, setPosition] = useState<ChessPosition>(() => rulesRef.current.getPosition());
  const [history, setHistory] = useState<ChessMoveRecord[]>([]);
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [orientation, setOrientation] = useState<PieceColor>('w');

  // Engine state
  const [engineColor, setEngineColor] = useState<'w' | 'b' | 'none'>('b');
  const [elo, setElo] = useState<HumanElo>(1500);
  const [isThinking, setIsThinking] = useState(false);
  const [tierUsed, setTierUsed] = useState<'human_opening_book' | 'maia_neural' | 'heuristic_fallback' | undefined>(undefined);
  const [centipawns, setCentipawns] = useState<number | undefined>(undefined);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  // Setup Modal state
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // Initialize EngineClient once
  useEffect(() => {
    const client = new EngineClient();
    engineClientRef.current = client;

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
    if (!engineClientRef.current || isThinking) return;
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
      });

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
  }, [elo, isThinking]);

  // Trigger engine move when it's engine's turn and at the live position
  useEffect(() => {
    if (activeTab !== 'play') return;
    if (engineColor === 'none') return;
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
  }, [activeTab, engineColor, currentPly, history.length, isThinking, requestEngineMove]);

  // Handle player move from the board
  const handleBoardMove = (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    // If reviewing history, snap to end before moving
    if (currentPly !== history.length) {
      setCurrentPly(history.length);
    }

    const game = rulesRef.current;
    const result = game.makeMove(move);
    if (result.success) {
      const newHist = game.getHistory();
      setHistory(newHist);
      setCurrentPly(newHist.length);
      setPosition(game.getPosition());
    }
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
  };

  // Custom FEN / PGN Setup
  const handleLoadFen = (fen: string) => {
    const res = rulesRef.current.loadFen(fen);
    if (res.success) {
      setHistory([]);
      setCurrentPly(0);
      setPosition(rulesRef.current.getPosition());
      setTierUsed(undefined);
    }
    return res;
  };

  const handleLoadPgn = (pgn: string) => {
    const res = rulesRef.current.loadPgn(pgn);
    if (res.success) {
      const newHist = rulesRef.current.getHistory();
      setHistory(newHist);
      setCurrentPly(newHist.length);
      setPosition(rulesRef.current.getPosition());
      setTierUsed(undefined);
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

  const gameOverStatus = rulesRef.current.getGameOverStatus();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="no-print print:hidden app-navbar border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30 font-bold text-white text-lg">
              ♟
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                My Chess <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Coach</span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Personalized 2D Chess & Human-Like AI Opponent
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              data-tab="play"
              data-tab-nav="play"
              onClick={() => selectTab('play')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'play'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Play vs Maia</span>
            </button>

            <button
              type="button"
              data-tab="database"
              data-tab-nav="database"
              onClick={() => selectTab('database')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'database'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Game Database</span>
            </button>

            <button
              type="button"
              data-tab="diagnostics"
              data-tab-nav="diagnostics"
              onClick={() => selectTab('diagnostics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'diagnostics'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Opening Diagnostics</span>
            </button>

            <button
              type="button"
              data-tab="lessons"
              data-tab-nav="lessons"
              onClick={() => selectTab('lessons')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'lessons'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Interactive Lessons</span>
            </button>

            <button
              type="button"
              data-tab="worksheets"
              data-tab-nav="worksheets"
              onClick={() => selectTab('worksheets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'worksheets'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Printable Worksheets</span>
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
              <Chessboard
                board={displayBoard}
                position={displayPosition}
                orientation={orientation}
                lastMove={lastMove}
                interactive={currentPly === history.length && !isThinking}
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
                  canTakeback={history.length > 0 && !isThinking}
                  onNewGame={handleNewGame}
                  onOpenPositionSetup={() => setIsSetupOpen(true)}
                  onExportPgn={handleExportPgn}
                />
              </div>
            </div>

            {/* Right Column: Engine Controls, Move List & Status */}
            <div className="lg:col-span-5 flex flex-col gap-4">
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
                result={gameOverStatus.result || '*'}
                gameOverReason={gameOverStatus.reason}
                onCopyPgn={handleExportPgn}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Game Database */}
        {activeTab === 'database' && <DatabaseView />}

        {/* Tab 3: Opening Diagnostics */}
        {activeTab === 'diagnostics' && (
          <DiagnosticsView
            games={dbGames ?? undefined}
            isLoadingGames={dbGames === null}
            onNavigateToLesson={handleNavigateToLesson}
            onPracticeDeviation={handlePracticeDeviation}
            onAdoptRepertoire={handleAdoptRepertoire}
            adoptedRepertoireIds={adoptedRepertoireIds}
          />
        )}

        {/* Tab 4: Interactive Lessons */}
        {activeTab === 'lessons' && (
          <LessonsView initialLessonId={pendingLesson?.id} initialLesson={pendingLesson?.lesson} />
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
  );
};

export default App;
