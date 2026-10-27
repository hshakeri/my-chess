import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Shield,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  Flame,
  BookOpen,
  GraduationCap,
  Play,
  Info,
} from 'lucide-react';
import { StoredGame } from '../types/db';
import {
  DiagnosticReport,
  OpeningDeviation,
  PatternSummary,
  RepertoirePlan,
  RepertoireLine,
  RepertoireLeak,
} from '../types/diagnostics';
import { analyzeGames } from '../analytics/diagnostics';
import {
  getRecommendedWhiteRepertoire,
  getRecommendedBlackRepertoire,
} from '../analytics/repertoire';
import { Chessboard, BoardArrow } from '../components/Chessboard';
import { RulesEngine } from '../engine/rules';

interface DiagnosticsViewProps {
  /** The games to analyze (the live IndexedDB archive in the app). */
  games?: StoredGame[];
  isLoadingGames?: boolean;
  onNavigateToGame?: (gameId: string) => void;
  onNavigateToLesson?: (repertoireId: string, lineId?: string) => void;
  /** Turn a deviation from the repertoire into a one-decision drill in the Lessons tab. */
  onPracticeDeviation?: (deviation: OpeningDeviation) => void;
  /** Adopt a repertoire plan as the active study plan. */
  onAdoptRepertoire?: (plan: RepertoirePlan) => void;
  adoptedRepertoireIds?: string[];
}

const EMPTY_GAMES: StoredGame[] = [];

function pct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

/** Build the board matrix and position snapshot for a FEN (non-interactive display). */
function boardForFen(fen: string): { board: ReturnType<RulesEngine['getBoard']>; position: ReturnType<RulesEngine['getPosition']> } {
  const engine = new RulesEngine(fen);
  return { board: engine.getBoard(), position: engine.getPosition() };
}

/** Compute from/to squares of a SAN move in a FEN, or null when illegal. */
function moveSquares(fen: string, san?: string): { from: string; to: string } | null {
  if (!san) return null;
  try {
    const chess = new Chess(fen);
    const m = chess.move(san.replace(/[!?]/g, ''));
    return m ? { from: m.from, to: m.to } : null;
  } catch {
    return null;
  }
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  games: propGames,
  isLoadingGames = false,
  onNavigateToGame,
  onNavigateToLesson,
  onPracticeDeviation,
  onAdoptRepertoire,
  adoptedRepertoireIds = [],
}) => {
  const [activeTab, setActiveTab] = useState<'leaks' | 'repertoires' | 'openings'>('leaks');
  const [leakFilter, setLeakFilter] = useState<'all' | 'white' | 'black' | string>('all');
  const [selectedRepColor, setSelectedRepColor] = useState<'white' | 'black'>('white');
  const [selectedLineId, setSelectedLineId] = useState<string>('white-scandi-refutation');
  const [activeMoveIndex, setActiveMoveIndex] = useState<number>(0);
  const [pickedLeak, setSelectedLeak] = useState<OpeningDeviation | null>(null);
  const [copiedPgn, setCopiedPgn] = useState<boolean>(false);
  const [minGames, setMinGames] = useState<number>(3);

  const games = propGames ?? EMPTY_GAMES;

  const report: DiagnosticReport = useMemo(() => analyzeGames(games, 'hoot65'), [games]);

  const patterns: PatternSummary[] = report.patterns || [];
  const leakPatterns = patterns.filter((p) => p.isLeak);

  // The decision point shows the picked leak, falling back to the first leak of the report.
  // Derived rather than effect-driven so the very first render already carries the board and arrows.
  const repertoireLeaks: RepertoireLeak[] = report.repertoireLeaks || [];
  const allLeaks = useMemo(
    () => [
      ...report.whiteStats.keyLeaks,
      ...report.blackStats.keyLeaks,
      ...repertoireLeaks.flatMap((l) => l.deviations),
    ],
    [report, repertoireLeaks]
  );
  const selectedLeak: OpeningDeviation | null =
    (pickedLeak && allLeaks.find((l) => l.gameId === pickedLeak.gameId && l.ply === pickedLeak.ply)) ||
    allLeaks[0] ||
    null;

  const blackRepertoire: RepertoirePlan = report.blackRepertoirePlan || getRecommendedBlackRepertoire();
  const activeRepertoire: RepertoirePlan = useMemo(() => {
    return selectedRepColor === 'white' ? report.whiteRepertoirePlan || getRecommendedWhiteRepertoire() : blackRepertoire;
  }, [selectedRepColor, report, blackRepertoire]);

  const activeLine: RepertoireLine = useMemo(() => {
    const found = activeRepertoire.lines.find((l) => l.id === selectedLineId);
    return found || activeRepertoire.lines[0];
  }, [activeRepertoire, selectedLineId]);

  useEffect(() => {
    setActiveMoveIndex(0);
  }, [activeLine]);

  const handleSelectLeak = useCallback((leak: OpeningDeviation) => {
    setSelectedLeak(leak);
  }, []);

  const handleSelectRepertoireMove = useCallback(
    (index: number) => {
      if (!activeLine.moves[index]) return;
      setActiveMoveIndex(index);
    },
    [activeLine]
  );

  const handleCopyPgn = useCallback((pgnText: string) => {
    navigator.clipboard?.writeText(pgnText);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  }, []);

  // Leak list with filters
  const filteredLeaks = useMemo(() => {
    const all = [...report.whiteStats.keyLeaks, ...report.blackStats.keyLeaks].sort(
      (a, b) => (b.gameDate || '').localeCompare(a.gameDate || '') || a.ply - b.ply
    );
    if (leakFilter === 'all') return all;
    if (leakFilter === 'white' || leakFilter === 'black') return all.filter((l) => l.playedColor === leakFilter);
    return all.filter((l) => l.patternId === leakFilter);
  }, [report, leakFilter]);

  // Decision-point board data
  const leakBoard = useMemo(() => {
    const fen = selectedLeak?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const { board, position } = boardForFen(fen);
    const arrows: BoardArrow[] = [];
    if (selectedLeak) {
      const played = moveSquares(fen, selectedLeak.playedSan);
      if (played) arrows.push({ ...played, color: 'red' });
      const book = moveSquares(fen, selectedLeak.bookSan);
      if (book) arrows.push({ ...book, color: 'green' });
    }
    return { board, position, arrows };
  }, [selectedLeak]);

  // Repertoire board data
  const repertoireBoard = useMemo(() => {
    const move = activeLine.moves[activeMoveIndex];
    const fen = move?.fen || activeRepertoire.rootFen;
    const { board, position } = boardForFen(fen);
    const arrows: BoardArrow[] = [];
    if (move) {
      const prevFen = activeMoveIndex > 0 ? activeLine.moves[activeMoveIndex - 1].fen : activeRepertoire.rootFen;
      const sq = moveSquares(prevFen, move.san);
      if (sq) arrows.push({ ...sq, color: move.isKeyMove ? 'green' : 'blue' });
    }
    return { board, position, arrows };
  }, [activeLine, activeMoveIndex, activeRepertoire]);

  const whiteOpenings = (report.whiteStats.openings || []).filter((o) => o.totalGames >= minGames);
  const blackOpenings = (report.blackStats.openings || []).filter((o) => o.totalGames >= minGames);

  const totalLeaks = report.whiteStats.keyLeaks.length + report.blackStats.keyLeaks.length;

  return (
    <div className="diagnostics-view max-w-7xl mx-auto px-4 py-8 space-y-8 text-slate-100" data-view="diagnostics">
      {/* 1. Header Profile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Computed from your Chess.com game archive
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Personalized Diagnostics: <span className="text-indigo-400">hoot65</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Recurring opening habits in <span className="text-slate-200 font-mono">hoot65</span>&apos;s games, each
              measured against your own results (score with the habit vs your other games of that colour), with the
              exact games and plies where they happened.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-2xl font-black text-white" data-stat="games-analyzed">{report.totalGamesAnalyzed}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Games Analyzed</div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-2xl font-black text-emerald-400">{pct(report.whiteStats.winRate)}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">White Win Rate</div>
              <div className="text-[10px] text-slate-500">score; draws count half</div>
            </div>
            <div className="text-center px-3">
              <div className="text-2xl font-black text-amber-400">{pct(report.blackStats.winRate)}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Black Win Rate</div>
              <div className="text-[10px] text-slate-500">score; draws count half</div>
            </div>
          </div>
        </div>

        {/* Repertoire Recommendation Badges */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-white text-slate-900 font-bold flex items-center justify-center text-xs shadow">
              W
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Recommended White Repertoire</div>
              <div className="text-sm font-semibold text-white">{report.recommendedWhiteRepertoire}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-950 text-white font-bold flex items-center justify-center text-xs border border-slate-700 shadow">
              B
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Recommended Black Repertoire</div>
              <div className="text-sm font-semibold text-white">{report.recommendedBlackRepertoire}</div>
            </div>
          </div>
        </div>
      </div>

      {isLoadingGames && games.length === 0 && (
        <div className="text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl p-4" data-state="loading">
          Loading your game archive from the local database...
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('leaks')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'leaks'
              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          Weakness Diagnostics & Key Leaks
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono">{totalLeaks}</span>
        </button>

        <button
          onClick={() => setActiveTab('repertoires')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'repertoires'
              ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-400" />
          Tailored Opening Repertoires
        </button>

        <button
          onClick={() => setActiveTab('openings')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'openings'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Opening Performance Matrix
        </button>
      </div>

      {/* 3. Leaks Tab */}
      {activeTab === 'leaks' && (
        <div className="space-y-6">
          {/* Measured patterns strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-section="patterns">
            {patterns.map((p) => {
              const costing = p.impact.gamesWith > 0 && p.impact.scoreWith < p.impact.scoreWithout;
              const seen = p.impact.gamesWith > 0;
              const tone = !seen
                ? 'border-slate-800 bg-slate-900/60'
                : p.isLeak
                ? 'border-rose-500/40 bg-rose-950/30'
                : 'border-slate-700 bg-slate-900/80';
              return (
                <div key={p.id} className={`rounded-xl border p-4 space-y-2 ${tone}`} data-pattern={p.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-white leading-snug">{p.label}</div>
                    <span
                      className={`shrink-0 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        !seen
                          ? 'bg-slate-800 text-slate-400'
                          : p.isLeak
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {!seen ? 'not seen' : p.isLeak ? 'leak' : 'info'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {seen ? (
                      <>
                        <span className="font-mono text-white">{p.impact.gamesWith}</span> games, score{' '}
                        <span className="font-mono text-white">{pct(p.impact.scoreWith)}</span>
                        {p.impact.gamesWithout > 0 && (
                          <>
                            {' '}vs <span className="font-mono text-white">{pct(p.impact.scoreWithout)}</span> in your other{' '}
                            {p.color === 'both' ? '' : `${p.color} `}games
                          </>
                        )}
                        {p.impact.gamesWithout === 0 ? (
                          <span className="text-slate-400"> (no other {p.color === 'both' ? '' : `${p.color} `}games to compare against yet)</span>
                        ) : costing ? (
                          <span className="text-rose-300 font-semibold"> ({p.deviations[0]?.evaluationDelta})</span>
                        ) : (
                          <span className="text-emerald-300 font-semibold"> ({p.deviations[0]?.evaluationDelta}, not costing points so far)</span>
                        )}
                      </>
                    ) : (
                      'No occurrences in the analyzed games.'
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>
                </div>
              );
            })}
          </div>

          {/* Where the games left the repertoire: the first student move off the plan, grouped by position */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3" data-section="repertoire-leaks">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Where you leave the repertoire
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  The first move of yours that leaves the plan, grouped by position and ranked by how often it happens and
                  what it costs. The opponent leaving the plan first is not counted against you.
                </p>
              </div>
              <span className="text-xs text-slate-500" data-stat="repertoire-leaks">
                {repertoireLeaks.length} position{repertoireLeaks.length === 1 ? '' : 's'}
              </span>
            </div>
            {repertoireLeaks.length === 0 ? (
              <p className="text-sm text-slate-400">No game of yours has left the plan at a move of yours yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {repertoireLeaks.slice(0, 8).map((leak) => {
                  const first = leak.deviations[0];
                  const isSelected = !!selectedLeak && leak.deviations.some((d) => d.gameId === selectedLeak.gameId && d.ply === selectedLeak.ply);
                  return (
                    <li
                      key={`${leak.fenKey}|${leak.playedSan}`}
                      data-repertoire-leak={leak.playedSan}
                      data-leak-color={leak.color}
                      className={`py-2.5 flex items-center justify-between gap-3 flex-wrap ${isSelected ? 'bg-indigo-950/20' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => first && setSelectedLeak(first)}
                        className="text-left flex-1 min-w-[240px]"
                        title="Show this position on the decision board"
                      >
                        <div className="text-sm text-white">
                          <span className="font-mono text-rose-300 font-semibold">
                            Ply {first?.ply}: {leak.playedSan}?!
                          </span>{' '}
                          <span className="text-slate-400">instead of</span>{' '}
                          <span className="font-mono text-emerald-300 font-semibold">{leak.bookSan}!</span>
                          <span className="text-slate-500"> · {leak.lineName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {leak.games} game{leak.games === 1 ? '' : 's'} as {leak.color}, score {pct(leak.score)} vs {pct(leak.scoreOther)} when you stayed on plan
                        </div>
                      </button>
                      {onPracticeDeviation && first && (
                        <button
                          type="button"
                          data-action="practice-deviation"
                          onClick={() => onPracticeDeviation(first)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          Practice this
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Leak Cards */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800 w-fit flex-wrap">
                <button
                  onClick={() => setLeakFilter('all')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    leakFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({totalLeaks})
                </button>
                <button
                  onClick={() => setLeakFilter('white')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    leakFilter === 'white' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  As White ({report.whiteStats.keyLeaks.length})
                </button>
                <button
                  onClick={() => setLeakFilter('black')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    leakFilter === 'black' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  As Black ({report.blackStats.keyLeaks.length})
                </button>
                {leakPatterns.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setLeakFilter(p.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      leakFilter === p.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.label} ({p.deviations.length})
                  </button>
                ))}
              </div>

              {filteredLeaks.length === 0 && (
                <div className="text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl p-5">
                  No leaks of this kind in the analyzed games.
                </div>
              )}

              <div className="space-y-4">
                {filteredLeaks.map((leak, idx) => {
                  const isSelected = selectedLeak?.gameId === leak.gameId && selectedLeak?.ply === leak.ply;
                  const isWhite = leak.playedColor === 'white';
                  return (
                    <div
                      key={`${leak.gameId}-${leak.ply}-${idx}`}
                      onClick={() => handleSelectLeak(leak)}
                      data-leak-game={leak.gameId}
                      className={`cursor-pointer rounded-xl p-5 border transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-indigo-500 shadow-lg ring-1 ring-indigo-500/50'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isWhite ? 'bg-white text-slate-900' : 'bg-slate-950 text-white border border-slate-700'
                            }`}
                          >
                            {isWhite ? 'W' : 'B'}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                              <span>vs {leak.opponent}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                                Ply {leak.ply}: {leak.playedSan}?!
                              </span>
                              {leak.gameDate && <span className="text-xs text-slate-500">{leak.gameDate}</span>}
                            </div>
                            <div className="text-xs text-slate-400">
                              Game ID: <span className="font-mono text-slate-300">{leak.gameId}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {leak.bookSan ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                              Better: <strong className="font-mono">{leak.bookSan}!</strong>
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                              Habit, not a single-move fix
                            </span>
                          )}
                          {onNavigateToGame && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToGame(leak.gameId);
                              }}
                              className="p-1.5 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                              title="Replay in App"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {leak.gameUrl && (
                            <a
                              href={leak.gameUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-indigo-300 transition-colors"
                              title="Open on Chess.com"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed mb-3">{leak.description}</p>

                      <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 font-mono text-rose-400">
                            Score impact: {leak.evaluationDelta}
                            {leak.impact && (
                              <span className="text-slate-500">
                                {' '}({leak.impact.gamesWith} games)
                              </span>
                            )}
                          </span>
                          <span>•</span>
                          <span className="text-indigo-400 font-medium">Click to inspect on board</span>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isSelected ? 'rotate-90 text-indigo-400' : ''}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Decision Point Board */}
            <div className="lg:col-span-5 sticky top-6 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Flame className="w-4 h-4 text-rose-400" />
                    Decision Point Board
                  </div>
                  {selectedLeak && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Ply {selectedLeak.ply} · {selectedLeak.playedColor === 'white' ? 'White' : 'Black'} to move
                    </span>
                  )}
                </div>

                <div className="max-w-[360px] mx-auto" data-board="decision-point">
                  <Chessboard
                    board={leakBoard.board}
                    position={leakBoard.position}
                    orientation={selectedLeak?.playedColor === 'black' ? 'b' : 'w'}
                    interactive={false}
                    arrows={leakBoard.arrows}
                  />
                </div>

                {selectedLeak && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Played (red arrow):</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">
                        {selectedLeak.playedSan}?!
                      </span>
                    </div>
                    {selectedLeak.bookSan ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Better (green arrow):</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                          {selectedLeak.bookSan}!
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-xs text-slate-300">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>No single move to memorise here: the fix is the habit described on the card.</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Score impact of this habit:</span>
                      <span className="font-mono text-rose-400 font-semibold">{selectedLeak.evaluationDelta}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]" title={selectedLeak.fen}>
                        {selectedLeak.fen}
                      </span>
                      {selectedLeak.gameUrl && (
                        <a
                          href={selectedLeak.gameUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Replay Game <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tailored Repertoires Tab */}
      {activeTab === 'repertoires' && (
        <div className="space-y-8">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => {
                setSelectedRepColor('white');
                setSelectedLineId('white-scandi-refutation');
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl border text-sm font-semibold transition-all ${
                selectedRepColor === 'white'
                  ? 'bg-slate-800 border-indigo-500 text-white shadow-lg'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-white text-slate-900 font-bold flex items-center justify-center text-xs">
                W
              </span>
              <div>
                <div className="text-left">White Repertoire</div>
                <div className="text-xs text-indigo-400 font-normal">Italian & Anti-Scandinavian (2.exd5!)</div>
              </div>
            </button>

            <button
              onClick={() => {
                setSelectedRepColor('black');
                setSelectedLineId('black-caro-kann-advance');
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl border text-sm font-semibold transition-all ${
                selectedRepColor === 'black'
                  ? 'bg-slate-800 border-indigo-500 text-white shadow-lg'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-950 text-white font-bold flex items-center justify-center text-xs border border-slate-700">
                B
              </span>
              <div>
                <div className="text-left">Black Repertoire</div>
                <div className="text-xs text-indigo-400 font-normal">{blackRepertoire.name}</div>
              </div>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-400" />
                  {activeRepertoire.name}
                </h2>
                <p className="text-sm text-slate-400 mt-1">{activeRepertoire.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {onAdoptRepertoire && (
                  <button
                    onClick={() => onAdoptRepertoire(activeRepertoire)}
                    data-action="adopt-repertoire"
                    data-adopted={adoptedRepertoireIds.includes(activeRepertoire.id) ? 'true' : 'false'}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                      adoptedRepertoireIds.includes(activeRepertoire.id)
                        ? 'bg-emerald-700/60 text-emerald-200 border border-emerald-500/50'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                    title="Make this plan your active study plan and open its first lesson"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {adoptedRepertoireIds.includes(activeRepertoire.id) ? 'Adopted' : 'Adopt Repertoire'}
                  </button>
                )}
                {onNavigateToLesson && (
                  <button
                    onClick={() => onNavigateToLesson(activeRepertoire.id, activeLine.id)}
                    data-action="practice-line"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-sm"
                  >
                    <GraduationCap className="w-4 h-4" />
                    Practice Line
                  </button>
                )}
                <button
                  onClick={() => handleCopyPgn(activeRepertoire.pgn)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors border border-slate-700"
                >
                  {copiedPgn ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPgn ? 'PGN Copied!' : 'Copy Repertoire PGN'}
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Strategic Priorities & Core Habits
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeRepertoire.keyThemes.map((theme, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{theme}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {activeRepertoire.lines.map((line) => {
                  const isSelected = line.id === selectedLineId;
                  return (
                    <button
                      key={line.id}
                      onClick={() => setSelectedLineId(line.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-mono mr-1.5 opacity-75">{line.eco}</span>
                      {line.name}
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{activeLine.name}</h3>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono">
                    ECO {activeLine.eco}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{activeLine.description}</p>

                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Opening Objectives
                  </div>
                  <ul className="space-y-1">
                    {activeLine.keyIdeas.map((idea, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Step-by-Step Move Progression (Click any move to inspect FEN)
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activeLine.moves.map((m, idx) => {
                    const isSelected = idx === activeMoveIndex;
                    const isWhiteMove = m.ply % 2 === 1;
                    const moveNumber = Math.floor((m.ply - 1) / 2) + 1;
                    return (
                      <button
                        key={m.ply}
                        onClick={() => handleSelectRepertoireMove(idx)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1 border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white font-bold ring-1 ring-indigo-400'
                            : m.isKeyMove
                            ? 'bg-slate-800 border-slate-700 text-indigo-300 hover:bg-slate-700'
                            : 'bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {isWhiteMove && <span className="text-slate-500">{moveNumber}.</span>}
                        <span>{m.san}</span>
                        {m.annotation && <span className="text-emerald-400 font-bold">{m.annotation}</span>}
                      </button>
                    );
                  })}
                </div>

                {activeLine.moves[activeMoveIndex] && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <span>
                          Ply {activeLine.moves[activeMoveIndex].ply}:{' '}
                          <strong className="font-mono text-indigo-400">{activeLine.moves[activeMoveIndex].san}</strong>
                        </span>
                        {activeLine.moves[activeMoveIndex].tacticalMotif && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                            {activeLine.moves[activeMoveIndex].tacticalMotif}
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {activeLine.moves[activeMoveIndex].commentary ||
                        'Maintain rapid piece development, king safety, and active central pressure.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  Sources:
                </div>
                {activeRepertoire.sourceReferences.map((ref, idx) => (
                  <div key={idx} className="font-mono text-[11px] text-slate-400">
                    • {ref}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 sticky top-6 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    Repertoire Board Position
                  </div>
                  {activeLine.moves[activeMoveIndex] && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Ply {activeLine.moves[activeMoveIndex].ply}
                    </span>
                  )}
                </div>

                <div className="max-w-[360px] mx-auto" data-board="repertoire">
                  <Chessboard
                    board={repertoireBoard.board}
                    position={repertoireBoard.position}
                    orientation={activeRepertoire.color === 'black' ? 'b' : 'w'}
                    interactive={false}
                    arrows={repertoireBoard.arrows}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    disabled={activeMoveIndex <= 0}
                    onClick={() => handleSelectRepertoireMove(activeMoveIndex - 1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Previous Ply
                  </button>
                  <span className="text-xs font-mono text-slate-400">
                    {activeMoveIndex + 1} of {activeLine.moves.length}
                  </span>
                  <button
                    disabled={activeMoveIndex >= activeLine.moves.length - 1}
                    onClick={() => handleSelectRepertoireMove(activeMoveIndex + 1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next Ply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Opening Performance Matrix Tab */}
      {activeTab === 'openings' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Opening Score by Line</h2>
                <p className="text-xs text-slate-400">
                  Games grouped by their first six plies and sorted by frequency. Score counts a draw as half a point.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <span>Show lines with at least</span>
                <select
                  value={minGames}
                  onChange={(e) => setMinGames(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  data-select="min-games"
                >
                  <option value={1}>1 game</option>
                  <option value={3}>3 games</option>
                  <option value={5}>5 games</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: 'White Openings Performance', rows: whiteOpenings, tone: 'emerald', badge: 'W', badgeClass: 'bg-white text-slate-900' },
                { title: 'Black Openings Performance', rows: blackOpenings, tone: 'amber', badge: 'B', badgeClass: 'bg-slate-950 text-white border border-slate-700' },
              ].map((col) => (
                <div key={col.title} className="space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-xs ${col.badgeClass}`}>
                      {col.badge}
                    </span>
                    {col.title}
                  </h3>
                  <div className="space-y-2">
                    {col.rows.length > 0 ? (
                      col.rows.map((op, i) => (
                        <div key={`${op.lineSan}-${i}`} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="font-medium text-white truncate" title={op.openingName}>
                              {op.openingName}
                            </span>
                            <span className={`font-mono font-bold whitespace-nowrap ${col.tone === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {pct(op.winRate)} score
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`${col.tone === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'} h-full rounded-full`}
                              style={{ width: `${Math.min(100, Math.max(0, op.winRate * 100))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 gap-2">
                            <span className="font-mono text-slate-500 truncate" title={op.lineSan}>
                              {op.lineSan} · {op.eco}
                            </span>
                            <span className="whitespace-nowrap">
                              {op.wins}W / {op.losses}L / {op.draws}D ({op.totalGames} games)
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-4 text-center">No lines with that many games.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
