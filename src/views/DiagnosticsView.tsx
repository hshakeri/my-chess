import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { StoredGame } from '../types/db';
import {
  DiagnosticReport,
  OpeningDeviation,
  RepertoirePlan,
  RepertoireLine,
} from '../types/diagnostics';
import { analyzeGames } from '../analytics/diagnostics';
import {
  getRecommendedWhiteRepertoire,
  getRecommendedBlackRepertoire,
} from '../analytics/repertoire';
import { ChessPiece } from '../components/ChessPiece';
import seedGamesRaw from '../data/seed_hoot65_games.json';
import { PieceSymbol, PieceColor } from '../types/chess';

const seedGames = seedGamesRaw as unknown as StoredGame[];

interface DiagnosticsViewProps {
  games?: StoredGame[];
  onNavigateToGame?: (gameId: string) => void;
  onNavigateToLesson?: (repertoireId: string, lineId?: string) => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  games: propGames,
  onNavigateToGame,
  onNavigateToLesson,
}) => {
  // Active Tab: 'leaks' | 'repertoires' | 'openings'
  const [activeTab, setActiveTab] = useState<'leaks' | 'repertoires' | 'openings'>('leaks');

  // Leak Color Filter: 'all' | 'white' | 'black'
  const [leakColorFilter, setLeakColorFilter] = useState<'all' | 'white' | 'black'>('all');

  // Active Repertoire Color Tab: 'white' | 'black'
  const [selectedRepColor, setSelectedRepColor] = useState<'white' | 'black'>('white');

  // Selected Repertoire Line ID
  const [selectedLineId, setSelectedLineId] = useState<string>('white-scandi-refutation');

  // Selected Move Index in the Repertoire Line
  const [activeMoveIndex, setActiveMoveIndex] = useState<number>(0);

  // Selected Opening Deviation for Board Inspection
  const [selectedLeak, setSelectedLeak] = useState<OpeningDeviation | null>(null);

  // Interactive Replay Fen
  const [previewFen, setPreviewFen] = useState<string>(
    'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  );

  // Copy PGN state
  const [copiedPgn, setCopiedPgn] = useState<boolean>(false);

  // Compute Diagnostic Report
  const gamesToAnalyze = useMemo(() => {
    if (propGames && propGames.length > 0) return propGames;
    return seedGames;
  }, [propGames]);

  const report: DiagnosticReport = useMemo(() => {
    return analyzeGames(gamesToAnalyze, 'hoot65');
  }, [gamesToAnalyze]);

  // Set initial selected leak once report is ready
  useEffect(() => {
    if (!selectedLeak && report.whiteStats.keyLeaks.length > 0) {
      const initialLeak = report.whiteStats.keyLeaks[0];
      setSelectedLeak(initialLeak);
      setPreviewFen(initialLeak.fen);
    }
  }, [report, selectedLeak]);

  // Active Repertoire Plan
  const activeRepertoire: RepertoirePlan = useMemo(() => {
    return selectedRepColor === 'white'
      ? report.whiteRepertoirePlan || getRecommendedWhiteRepertoire()
      : report.blackRepertoirePlan || getRecommendedBlackRepertoire();
  }, [selectedRepColor, report]);

  // Active Repertoire Line
  const activeLine: RepertoireLine = useMemo(() => {
    const found = activeRepertoire.lines.find(l => l.id === selectedLineId);
    return found || activeRepertoire.lines[0];
  }, [activeRepertoire, selectedLineId]);

  // When changing line, reset active move index and preview fen
  useEffect(() => {
    if (activeLine && activeLine.moves.length > 0) {
      setActiveMoveIndex(0);
      setPreviewFen(activeLine.moves[0].fen);
    }
  }, [activeLine]);

  // Handle clicking a leak
  const handleSelectLeak = useCallback((leak: OpeningDeviation) => {
    setSelectedLeak(leak);
    setPreviewFen(leak.fen);
  }, []);

  // Handle stepping through a repertoire line
  const handleSelectRepertoireMove = useCallback(
    (index: number) => {
      if (!activeLine.moves[index]) return;
      setActiveMoveIndex(index);
      setPreviewFen(activeLine.moves[index].fen);
    },
    [activeLine]
  );

  // Handle copying PGN
  const handleCopyPgn = useCallback((pgnText: string) => {
    navigator.clipboard.writeText(pgnText);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  }, []);

  // Helper to parse FEN pieces for mini-board render
  const boardGrid = useMemo(() => {
    const fenPlacement = previewFen.split(' ')[0] || '8/8/8/8/8/8/8/8';
    const rows = fenPlacement.split('/');
    const grid: Array<Array<{ square: string; piece?: { type: PieceSymbol; color: PieceColor } }>> = [];

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let r = 0; r < 8; r++) {
      const rankNum = 8 - r;
      const rowString = rows[r] || '8';
      const rowArray: Array<{ square: string; piece?: { type: PieceSymbol; color: PieceColor } }> = [];
      let fileIdx = 0;

      for (let c = 0; c < rowString.length; c++) {
        const char = rowString[c];
        const count = parseInt(char, 10);
        if (!isNaN(count)) {
          for (let k = 0; k < count; k++) {
            const sq = `${files[fileIdx]}${rankNum}`;
            rowArray.push({ square: sq });
            fileIdx++;
          }
        } else {
          const sq = `${files[fileIdx]}${rankNum}`;
          const isWhite = char === char.toUpperCase();
          rowArray.push({
            square: sq,
            piece: {
              type: char.toLowerCase() as PieceSymbol,
              color: isWhite ? 'w' : 'b',
            },
          });
          fileIdx++;
        }
      }
      grid.push(rowArray);
    }
    return grid;
  }, [previewFen]);

  // Filtered Leaks list
  const filteredLeaks = useMemo(() => {
    const whiteLeaks = report.whiteStats.keyLeaks;
    const blackLeaks = report.blackStats.keyLeaks;

    if (leakColorFilter === 'white') return whiteLeaks;
    if (leakColorFilter === 'black') return blackLeaks;
    return [...whiteLeaks, ...blackLeaks];
  }, [report, leakColorFilter]);

  return (
    <div className="diagnostics-view max-w-7xl mx-auto px-4 py-8 space-y-8 text-slate-100" data-view="diagnostics">
      {/* 1. Header Profile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Grounded in Real Chess.com Game History
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Personalized Diagnostics: <span className="text-indigo-400">hoot65</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Automatic opening deviation and tactical leak detection analyzing historical games for handle <span className="text-slate-200 font-mono">hoot65</span>. Recommends tailored White and Black repertoires designed to eliminate recurring mistakes.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-2xl font-black text-white">{report.totalGamesAnalyzed}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Games Analyzed</div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-2xl font-black text-emerald-400">
                {(report.whiteStats.winRate <= 1 ? report.whiteStats.winRate * 100 : report.whiteStats.winRate).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">White Win Rate</div>
            </div>
            <div className="text-center px-3">
              <div className="text-2xl font-black text-amber-400">
                {(report.blackStats.winRate <= 1 ? report.blackStats.winRate * 100 : report.blackStats.winRate).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Black Win Rate</div>
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

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('leaks')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'leaks'
              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          Weakness Diagnostics & Key Leaks
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono">
            {report.whiteStats.keyLeaks.length + report.blackStats.keyLeaks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('repertoires')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'openings'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Opening Performance Matrix
        </button>
      </div>

      {/* 3. Tab Content */}
      {activeTab === 'leaks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Leak Cards & Citations (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Filter pills */}
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800 w-fit">
              <button
                onClick={() => setLeakColorFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  leakColorFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Leaks ({report.whiteStats.keyLeaks.length + report.blackStats.keyLeaks.length})
              </button>
              <button
                onClick={() => setLeakColorFilter('white')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  leakColorFilter === 'white' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                White: Scandinavian 2.e5?! ({report.whiteStats.keyLeaks.length})
              </button>
              <button
                onClick={() => setLeakColorFilter('black')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  leakColorFilter === 'black' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Black: Premature ...Bg4 ({report.blackStats.keyLeaks.length})
              </button>
            </div>

            {/* List of Deviations */}
            <div className="space-y-4">
              {filteredLeaks.map((leak, idx) => {
                const isSelected = selectedLeak?.gameId === leak.gameId;
                const isWhite = leak.playedColor === 'white';

                return (
                  <div
                    key={`${leak.gameId}-${idx}`}
                    onClick={() => handleSelectLeak(leak)}
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
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>vs {leak.opponent}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                              Ply {leak.ply}: {leak.playedSan}?!
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Game ID: <span className="font-mono text-slate-300">{leak.gameId}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                          Refutation: <strong className="font-mono">{leak.bookSan}!</strong>
                        </span>
                        {onNavigateToGame && (
                          <button
                            onClick={e => {
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
                            onClick={e => e.stopPropagation()}
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
                          Δ Eval: {leak.evaluationDelta}
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

          {/* Right Column: Mini 2D Chessboard Preview (5 cols) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Flame className="w-4 h-4 text-rose-400" />
                  Decision Point Board
                </div>
                {selectedLeak && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Ply {selectedLeak.ply}
                  </span>
                )}
              </div>

              {/* 2D Chessboard */}
              <div className="relative aspect-square w-full max-w-[360px] mx-auto rounded-lg overflow-hidden border border-slate-700 shadow-inner">
                <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                  {boardGrid.map((row, rIdx) =>
                    row.map((cell, cIdx) => {
                      const isLight = (rIdx + cIdx) % 2 === 0;
                      return (
                        <div
                          key={cell.square}
                          className={`relative flex items-center justify-center ${
                            isLight ? 'bg-[#edeed1]' : 'bg-[#779952]'
                          }`}
                        >
                          {/* Coordinate labels */}
                          {cIdx === 0 && (
                            <span
                              className={`absolute top-0.5 left-1 text-[9px] font-bold select-none ${
                                isLight ? 'text-[#779952]' : 'text-[#edeed1]'
                              }`}
                            >
                              {8 - rIdx}
                            </span>
                          )}
                          {rIdx === 7 && (
                            <span
                              className={`absolute bottom-0.5 right-1 text-[9px] font-bold select-none ${
                                isLight ? 'text-[#779952]' : 'text-[#edeed1]'
                              }`}
                            >
                              {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][cIdx]}
                            </span>
                          )}

                          {cell.piece && (
                            <div className="w-[82%] h-[82%]">
                              <ChessPiece type={cell.piece.type} color={cell.piece.color} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Position Info and Analysis Card */}
              {selectedLeak && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Played Move:</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">
                      {selectedLeak.playedSan}?! (Inaccuracy)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Master Refutation:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      {selectedLeak.bookSan}! (Winning move)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Position Evaluation:</span>
                    <span className="font-mono text-rose-400 font-semibold">{selectedLeak.evaluationDelta} cp</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]" title={previewFen}>
                      {previewFen}
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
      )}

      {/* 4. Tailored Repertoires Tab */}
      {activeTab === 'repertoires' && (
        <div className="space-y-8">
          {/* Color Switcher */}
          <div className="flex items-center gap-4">
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
                <div className="text-xs text-indigo-400 font-normal">Disciplined Caro-Kann & King's Indian</div>
              </div>
            </button>
          </div>

          {/* Repertoire Plan Info Banner */}
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
                {onNavigateToLesson && (
                  <button
                    onClick={() => onNavigateToLesson(activeRepertoire.id, activeLine.id)}
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

            {/* Key Strategic Themes */}
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

          {/* Line Selection and Move Tree View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: Line Details and Move Step-Through */}
            <div className="lg:col-span-7 space-y-6">
              {/* Lines Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {activeRepertoire.lines.map(line => {
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

              {/* Active Line Description Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{activeLine.name}</h3>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono">
                    ECO {activeLine.eco}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{activeLine.description}</p>

                {/* Key ideas */}
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

              {/* Move Sequence Step-by-Step */}
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

                {/* Active Move Commentary */}
                {activeLine.moves[activeMoveIndex] && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <span>
                          Ply {activeLine.moves[activeMoveIndex].ply}:{' '}
                          <strong className="font-mono text-indigo-400">
                            {activeLine.moves[activeMoveIndex].san}
                          </strong>
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

              {/* Source References */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  PDF Curriculum & Master Sources:
                </div>
                {activeRepertoire.sourceReferences.map((ref, idx) => (
                  <div key={idx} className="font-mono text-[11px] text-slate-400">
                    • {ref}
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Columns: Synchronized Board */}
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

                {/* 2D Board */}
                <div className="relative aspect-square w-full max-w-[360px] mx-auto rounded-lg overflow-hidden border border-slate-700 shadow-inner">
                  <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                    {boardGrid.map((row, rIdx) =>
                      row.map((cell, cIdx) => {
                        const isLight = (rIdx + cIdx) % 2 === 0;
                        return (
                          <div
                            key={cell.square}
                            className={`relative flex items-center justify-center ${
                              isLight ? 'bg-[#edeed1]' : 'bg-[#779952]'
                            }`}
                          >
                            {cIdx === 0 && (
                              <span
                                className={`absolute top-0.5 left-1 text-[9px] font-bold select-none ${
                                  isLight ? 'text-[#779952]' : 'text-[#edeed1]'
                                }`}
                              >
                                {8 - rIdx}
                              </span>
                            )}
                            {rIdx === 7 && (
                              <span
                                className={`absolute bottom-0.5 right-1 text-[9px] font-bold select-none ${
                                  isLight ? 'text-[#779952]' : 'text-[#edeed1]'
                                }`}
                              >
                                {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][cIdx]}
                              </span>
                            )}

                            {cell.piece && (
                              <div className="w-[82%] h-[82%]">
                                <ChessPiece type={cell.piece.type} color={cell.piece.color} />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Repertoire Navigation Controls */}
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
            <h2 className="text-lg font-bold text-white mb-2">Opening Win Rates & Performance</h2>
            <p className="text-xs text-slate-400 mb-6">
              Aggregated win rates across historical games separated by opening and ECO classification.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* White Openings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white text-slate-900 font-bold flex items-center justify-center text-xs">
                    W
                  </span>
                  White Openings Performance
                </h3>

                <div className="space-y-2">
                  {report.whiteStats.openings && report.whiteStats.openings.length > 0 ? (
                    report.whiteStats.openings.map((op, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-white truncate max-w-[200px]">{op.openingName}</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {(op.winRate * 100).toFixed(1)}% Win Rate
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, op.winRate * 100))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono text-slate-500">ECO: {op.eco}</span>
                          <span>
                            {op.wins}W / {op.losses}L / {op.draws}D ({op.totalGames} games)
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-4 text-center">No White openings recorded.</div>
                  )}
                </div>
              </div>

              {/* Black Openings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-950 text-white font-bold flex items-center justify-center text-xs border border-slate-700">
                    B
                  </span>
                  Black Openings Performance
                </h3>

                <div className="space-y-2">
                  {report.blackStats.openings && report.blackStats.openings.length > 0 ? (
                    report.blackStats.openings.map((op, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-white truncate max-w-[200px]">{op.openingName}</span>
                          <span className="font-mono text-amber-400 font-bold">
                            {(op.winRate * 100).toFixed(1)}% Win Rate
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, op.winRate * 100))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono text-slate-500">ECO: {op.eco}</span>
                          <span>
                            {op.wins}W / {op.losses}L / {op.draws}D ({op.totalGames} games)
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-4 text-center">No Black openings recorded.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
