import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import {
  Upload,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  X,
  ExternalLink,
  Copy,
  Check,
  Play,
  FileUp,
  FileDown,
  Database,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { gamesRepo } from '../db/gamesRepo';
import { syncPlayerGames, type SyncProgress } from '../services/chesscom';
import type { StoredGame, GameFilter } from '../types/db';
import { ChessPiece } from '../components/ChessPiece';
import seedGamesRaw from '../data/seed_hoot65_games.json';

const seedGames = seedGamesRaw as unknown as StoredGame[];

export const DatabaseView: React.FC = () => {
  const [games, setGames] = useState<StoredGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDbCount, setTotalDbCount] = useState(0);

  // Filter state
  const [filterColor, setFilterColor] = useState<'all' | 'white' | 'black'>('all');
  const [filterResult, setFilterResult] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [filterTimeClass, setFilterTimeClass] = useState<'all' | 'rapid' | 'blitz' | 'bullet'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Panels
  const [selectedGame, setSelectedGame] = useState<StoredGame | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pastedPgn, setPastedPgn] = useState('');
  const [feedbackModal, setFeedbackModal] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Load games from IndexedDB with current filters
  const loadFilteredGames = useCallback(async () => {
    setLoading(true);
    try {
      const activeFilter: GameFilter = {
        color: filterColor,
        result: filterResult,
        timeClass: filterTimeClass,
        search: searchQuery,
      };
      const filtered = await gamesRepo.filterGames(activeFilter);
      setGames(filtered);
      const total = await gamesRepo.getGamesCount();
      setTotalDbCount(total);
    } catch (err) {
      console.error('Failed to load games:', err);
    } finally {
      setLoading(false);
    }
  }, [filterColor, filterResult, filterTimeClass, searchQuery]);

  // Initial load and seed if empty
  useEffect(() => {
    async function initialize() {
      try {
        const count = await gamesRepo.getGamesCount();
        if (count === 0 && seedGames && seedGames.length > 0) {
          await gamesRepo.seedIfEmpty(seedGames);
        }
      } catch (err) {
        console.error('Error during initial DB seed check:', err);
      } finally {
        loadFilteredGames();
      }
    }
    initialize();
  }, [loadFilteredGames]);

  // Re-fetch whenever filters change
  useEffect(() => {
    loadFilteredGames();
  }, [loadFilteredGames]);

  // Summary statistics
  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const g of games) {
      if (g.userResult === 'win') wins++;
      else if (g.userResult === 'loss') losses++;
      else if (g.userResult === 'draw') draws++;
    }
    const dec = wins + losses + draws;
    const winRate = dec > 0 ? Math.round((wins / dec) * 100) : 0;
    return { wins, losses, draws, winRate, count: games.length };
  }, [games]);

  // Sync handler
  const handleSyncChessCom = async () => {
    setIsSyncing(true);
    try {
      const res = await syncPlayerGames({
        username: 'hoot65',
        onProgress: (p) => setSyncProgress(p),
      });
      await loadFilteredGames();
      setFeedbackModal({
        type: 'success',
        title: 'Chess.com Sync Complete',
        message: `Successfully synchronized ${res.syncedArchives} monthly archives for hoot65.`,
        details: `Added: ${res.gamesAdded} new games\nDuplicates Skipped: ${res.duplicatesSkipped}\nLatest Game Date: ${res.latestGameDate || 'Up to date'}`,
      });
    } catch (err: any) {
      setFeedbackModal({
        type: 'error',
        title: 'Sync Error',
        message: err?.message || 'Failed to sync archives from Chess.com.',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncProgress(null), 4000);
    }
  };

  // PGN File or Text Upload handler
  const handlePgnImport = async (pgnContent: string) => {
    if (!pgnContent.trim()) return;
    try {
      const res = await gamesRepo.importPgnText(pgnContent, 'hoot65');
      await loadFilteredGames();
      setShowUploadModal(false);
      setPastedPgn('');
      setFeedbackModal({
        type: 'success',
        title: 'PGN Upload Result',
        message: `Processed games with automatic deduplication.`,
        details: `Games Added: ${res.added}\nDuplicates Skipped: ${res.duplicatesSkipped}`,
      });
    } catch (err: any) {
      setFeedbackModal({
        type: 'error',
        title: 'PGN Import Failed',
        message: err?.message || 'Error parsing uploaded PGN data.',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handlePgnImport(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Full Database JSON Export
  const handleExportJson = async () => {
    try {
      const data = await gamesRepo.exportDatabaseJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-chess-database-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedbackModal({
        type: 'error',
        title: 'Export Failed',
        message: err?.message || 'Failed to export database to JSON.',
      });
    }
  };

  // PGN Database Export
  const handleExportPgn = async () => {
    try {
      const pgnText = await gamesRepo.exportGamesPgn(games);
      const blob = new Blob([pgnText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-chess-games-${new Date().toISOString().split('T')[0]}.pgn`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedbackModal({
        type: 'error',
        title: 'Export Failed',
        message: err?.message || 'Failed to export games to PGN.',
      });
    }
  };

  // Full Database JSON Import
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await gamesRepo.importDatabaseJson(text);
        await loadFilteredGames();
        setFeedbackModal({
          type: 'success',
          title: 'Database Import Complete',
          message: `Restored database backup (Version ${res.version}).`,
          details: `Games Added: ${res.gamesAdded}\nDuplicates Skipped: ${res.gamesSkipped}`,
        });
      } catch (err: any) {
        setFeedbackModal({
          type: 'error',
          title: 'Database Import Failed',
          message: err?.message || 'Invalid database backup JSON file.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilterColor('all');
    setFilterResult('all');
    setFilterTimeClass('all');
    setSearchQuery('');
  };

  return (
    <div className="database-view flex flex-col h-full bg-slate-900 text-slate-100 p-4 md:p-6 overflow-y-auto" data-view="database">
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Game Archive & Database</h1>
              <p className="text-sm text-slate-400">
                Persistent client-side storage for <span className="font-semibold text-emerald-400">hoot65</span> and custom PGNs
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncChessCom}
            disabled={isSyncing}
            data-action="sync-chesscom"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-sm transition shadow-sm hover:shadow-emerald-500/20"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Chess.com'}</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            data-action="upload-pgn"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-sm transition"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Upload PGN</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5">
            <button
              onClick={handleExportJson}
              data-action="export-json"
              title="Export complete database backup as JSON"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export JSON</span>
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <button
              onClick={handleExportPgn}
              data-action="export-pgn"
              title="Export filtered games as multi-game PGN"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Export PGN</span>
            </button>
          </div>

          {/* Import JSON button */}
          <button
            onClick={() => jsonImportRef.current?.click()}
            data-action="import-json"
            title="Import database from JSON backup file"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium text-sm transition"
          >
            <FileUp className="w-4 h-4 text-purple-400" />
            <span>Import DB</span>
          </button>
          <input
            ref={jsonImportRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />
        </div>
      </div>

      {/* Sync Live Progress Bar */}
      {syncProgress && (
        <div className="mt-4 p-4 rounded-xl bg-slate-800/80 border border-emerald-500/30 shadow-lg">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-emerald-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {syncProgress.message}
            </span>
            <span className="text-slate-400">
              {syncProgress.totalArchives > 0
                ? `${syncProgress.currentArchiveIndex} / ${syncProgress.totalArchives} Archives`
                : ''}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 transition-all duration-300"
              style={{
                width: `${
                  syncProgress.totalArchives > 0
                    ? Math.round((syncProgress.currentArchiveIndex / syncProgress.totalArchives) * 100)
                    : 100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Stats and Filter Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-medium">Filtered Games</div>
          <div className="text-xl font-bold text-white mt-1">
            {stats.count}{' '}
            <span className="text-xs font-normal text-slate-500">/ {totalDbCount} in DB</span>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-medium">Win Rate</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{stats.winRate}%</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-medium">Wins / Losses</div>
          <div className="text-xl font-bold text-white mt-1">
            <span className="text-emerald-400">{stats.wins}</span>
            <span className="text-slate-500 mx-1.5">/</span>
            <span className="text-rose-400">{stats.losses}</span>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-medium">Draws</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{stats.draws}</div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 mb-5 flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search opponent, ECO, or opening..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Color Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-medium">
          <span className="text-slate-400 px-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Color:
          </span>
          {(['all', 'white', 'black'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilterColor(c)}
              className={`px-2.5 py-1 rounded capitalize transition ${
                filterColor === c ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Result Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-medium">
          <span className="text-slate-400 px-2">Result:</span>
          {(['all', 'win', 'loss', 'draw'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterResult(r)}
              className={`px-2.5 py-1 rounded capitalize transition ${
                filterResult === r ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Time Control Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-medium">
          <span className="text-slate-400 px-2">Speed:</span>
          {(['all', 'rapid', 'blitz', 'bullet'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterTimeClass(t)}
              className={`px-2.5 py-1 rounded capitalize transition ${
                filterTimeClass === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Reset button */}
        {(filterColor !== 'all' || filterResult !== 'all' || filterTimeClass !== 'all' || searchQuery) && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Games List Table */}
      <div className="flex-1 bg-slate-800/30 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Loading games from IndexedDB...</span>
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-6 text-center">
            <Database className="w-12 h-12 text-slate-600 mb-3" />
            <div className="text-base font-semibold text-slate-300">No games match your criteria</div>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Try adjusting your filters, syncing archives from Chess.com, or uploading a PGN file.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs text-slate-400 uppercase font-semibold border-b border-slate-800 sticky top-0 backdrop-blur z-10">
                <tr>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Opponent</th>
                  <th className="py-3 px-4">Color</th>
                  <th className="py-3 px-4">Opening / ECO</th>
                  <th className="py-3 px-4">Time Control</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Moves</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {games.map((game) => {
                  const isUserWhite = game.userColor === 'white';
                  const opponentName = isUserWhite ? game.black.name : game.white.name;
                  const opponentRating = isUserWhite ? game.black.rating : game.white.rating;
                  const userRating = isUserWhite ? game.white.rating : game.black.rating;
                  const dateStr = game.timestamp
                    ? new Date(game.timestamp).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Unknown';

                  return (
                    <tr
                      key={game.id}
                      data-game-id={game.id}
                      onClick={() => setSelectedGame(game)}
                      className="game-row hover:bg-slate-800/60 cursor-pointer transition group"
                    >
                      {/* Result Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {game.userResult === 'win' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Win
                          </span>
                        ) : game.userResult === 'loss' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Loss
                          </span>
                        ) : game.userResult === 'draw' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Draw
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-300">
                            {game.result}
                          </span>
                        )}
                      </td>

                      {/* Opponent */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-200 group-hover:text-emerald-400 transition">
                          {opponentName}
                        </div>
                        <div className="text-xs text-slate-500">
                          Opp: {opponentRating || '?'} | You: {userRating || '?'}
                        </div>
                      </td>

                      {/* Color */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <span
                            className={`w-3 h-3 rounded-full border ${
                              isUserWhite
                                ? 'bg-white border-slate-300'
                                : 'bg-slate-900 border-slate-600'
                            }`}
                          />
                          <span className="capitalize">{game.userColor || 'Custom'}</span>
                        </div>
                      </td>

                      {/* Opening & ECO */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {game.eco && (
                            <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                              {game.eco}
                            </span>
                          )}
                          <span className="text-xs text-slate-300 truncate max-w-[220px]" title={game.openingName || ''}>
                            {game.openingName || 'Standard Opening'}
                          </span>
                        </div>
                      </td>

                      {/* Time Class */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-medium capitalize text-slate-400 px-2 py-0.5 rounded bg-slate-900/50 border border-slate-800">
                          {game.timeClass || 'Rapid'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-400">
                        {dateStr}
                      </td>

                      {/* Moves */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-400">
                        {game.movesSan.length} ply
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGame(game);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-medium transition inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Replay</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Upload className="w-5 h-5 text-emerald-400" />
                <span>Upload PGN Games</span>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Drag and drop / file input box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-6 text-center cursor-pointer transition bg-slate-800/30 hover:bg-slate-800/60"
              >
                <FileUp className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-200">
                  Click to browse or drop PGN file here
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Supports single or multi-game .pgn archives
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pgn,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-xs text-slate-500 uppercase font-semibold">Or paste PGN text</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              {/* Paste textarea */}
              <textarea
                value={pastedPgn}
                onChange={(e) => setPastedPgn(e.target.value)}
                data-input="pgn-upload"
                rows={6}
                placeholder="[Event &quot;Casual Game&quot;]&#10;1. e4 e5 2. Nf3 Nc6..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePgnImport(pastedPgn)}
                  disabled={!pastedPgn.trim()}
                  data-action="confirm-upload"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium transition"
                >
                  Import PGN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replay Modal */}
      {selectedGame && (
        <GameReplayModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}

      {/* Feedback Alert Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              {feedbackModal.type === 'success' ? (
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">{feedbackModal.title}</h3>
                <p className="text-sm text-slate-300 mt-1">{feedbackModal.message}</p>
                {feedbackModal.details && (
                  <pre className="mt-3 p-3 bg-slate-950 rounded-lg text-xs font-mono text-slate-400 whitespace-pre-wrap border border-slate-800">
                    {feedbackModal.details}
                  </pre>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setFeedbackModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface GameReplayModalProps {
  game: StoredGame;
  onClose: () => void;
}

const GameReplayModal: React.FC<GameReplayModalProps> = ({ game, onClose }) => {
  const [currentPly, setCurrentPly] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>(
    game.userColor === 'black' ? 'black' : 'white'
  );
  const [copiedPgn, setCopiedPgn] = useState(false);

  // Compute positions across all plies
  const positions = useMemo(() => {
    const history: Array<{
      fen: string;
      lastMove?: { from: string; to: string; san: string };
    }> = [];

    const chess = new Chess();
    history.push({ fen: chess.fen() });

    for (const san of game.movesSan) {
      try {
        const moveRes = chess.move(san);
        if (moveRes) {
          history.push({
            fen: chess.fen(),
            lastMove: {
              from: moveRes.from,
              to: moveRes.to,
              san: moveRes.san,
            },
          });
        }
      } catch (err) {
        console.warn('Failed move in replay:', san, err);
        break;
      }
    }
    return history;
  }, [game]);

  const maxPly = positions.length - 1;

  // Key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPly((p) => Math.min(maxPly, p + 1));
      } else if (e.key === 'Home') {
        setCurrentPly(0);
      } else if (e.key === 'End') {
        setCurrentPly(maxPly);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maxPly, onClose]);

  // Current board grid
  const currentFen = positions[currentPly]?.fen || positions[0].fen;
  const currentBoard = useMemo(() => {
    const chess = new Chess(currentFen);
    return chess.board();
  }, [currentFen]);

  const lastMove = positions[currentPly]?.lastMove;

  // Board square rendering
  const ranks = orientation === 'white' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(game.pgn);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  return (
    <div className="replay-modal fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm" data-modal="replay">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {game.eco || 'ECO'}
            </span>
            <div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                <span>{game.white.name}</span>
                <span className="text-xs text-slate-500">({game.white.rating || '?'})</span>
                <span className="text-slate-600 font-normal">vs</span>
                <span>{game.black.name}</span>
                <span className="text-xs text-slate-500">({game.black.rating || '?'})</span>
              </div>
              <div className="text-xs text-slate-400">
                {game.openingName || 'Standard Game'} • Result: <span className="font-bold text-slate-200">{game.result}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {game.url && (
              <a
                href={game.url}
                target="_blank"
                rel="noreferrer"
                title="View live game on Chess.com"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={handleCopyPgn}
              title="Copy PGN text"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              {copiedPgn ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body: Board + Move List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Board Column */}
          <div className="md:col-span-7 flex flex-col items-center">
            {/* Top Player Badge */}
            <div className="w-full max-w-[360px] md:max-w-[420px] flex items-center justify-between pb-1.5 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    orientation === 'white' ? 'bg-slate-900 border border-slate-600' : 'bg-white'
                  }`}
                />
                {orientation === 'white' ? game.black.name : game.white.name}
              </span>
              <span className="text-slate-500">
                {orientation === 'white' ? game.black.rating : game.white.rating}
              </span>
            </div>

            {/* 2D Board */}
            <div className="w-full max-w-[360px] md:max-w-[420px] aspect-square rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700 bg-slate-800 select-none">
              <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                {ranks.map((r) =>
                  files.map((f) => {
                    const isLight = (r + f) % 2 !== 0;
                    const squareName = `${String.fromCharCode(97 + f)}${r + 1}`;
                    const piece = currentBoard[7 - r][f];
                    const isLastFrom = lastMove?.from === squareName;
                    const isLastTo = lastMove?.to === squareName;

                    return (
                      <div
                        key={squareName}
                        className={`relative flex items-center justify-center ${
                          isLight ? 'bg-[#eeeed2]' : 'bg-[#769656]'
                        } ${isLastFrom || isLastTo ? '!bg-[#baca44]/90' : ''}`}
                      >
                        {/* Coordinates */}
                        {f === (orientation === 'white' ? 0 : 7) && (
                          <span
                            className={`absolute top-0.5 left-1 text-[10px] font-bold ${
                              isLight ? 'text-[#769656]' : 'text-[#eeeed2]'
                            }`}
                          >
                            {r + 1}
                          </span>
                        )}
                        {r === (orientation === 'white' ? 0 : 7) && (
                          <span
                            className={`absolute bottom-0.5 right-1 text-[10px] font-bold ${
                              isLight ? 'text-[#769656]' : 'text-[#eeeed2]'
                            }`}
                          >
                            {String.fromCharCode(97 + f)}
                          </span>
                        )}

                        {/* Chess Piece */}
                        {piece && (
                          <div className="w-[85%] h-[85%]">
                            <ChessPiece type={piece.type as any} color={piece.color as any} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Player Badge */}
            <div className="w-full max-w-[360px] md:max-w-[420px] flex items-center justify-between pt-1.5 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    orientation === 'white' ? 'bg-white' : 'bg-slate-900 border border-slate-600'
                  }`}
                />
                {orientation === 'white' ? game.white.name : game.black.name}
              </span>
              <span className="text-slate-500">
                {orientation === 'white' ? game.white.rating : game.black.rating}
              </span>
            </div>

            {/* Board Navigation Controls */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPly(0)}
                disabled={currentPly === 0}
                title="Start (Home)"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
                disabled={currentPly === 0}
                data-action="replay-prev"
                title="Previous Ply (Left Arrow)"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-mono font-semibold text-slate-400">
                Ply {currentPly} / {maxPly}
              </span>
              <button
                onClick={() => setCurrentPly((p) => Math.min(maxPly, p + 1))}
                disabled={currentPly === maxPly}
                data-action="replay-next"
                title="Next Ply (Right Arrow)"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPly(maxPly)}
                disabled={currentPly === maxPly}
                title="End (End)"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <div className="h-5 w-px bg-slate-800 mx-1" />
              <button
                onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
                title="Flip Board"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Move List Column */}
          <div className="md:col-span-5 h-[360px] md:h-[460px] bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col">
            <div className="text-xs uppercase font-semibold text-slate-400 pb-2 border-b border-slate-800">
              Notation ({game.movesSan.length} plies)
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pt-2">
              <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-xs">
                {Array.from({ length: Math.ceil(game.movesSan.length / 2) }).map((_, moveIndex) => {
                  const whitePly = moveIndex * 2 + 1;
                  const blackPly = moveIndex * 2 + 2;
                  const whiteSan = game.movesSan[whitePly - 1];
                  const blackSan = game.movesSan[blackPly - 1];

                  return (
                    <React.Fragment key={moveIndex}>
                      {/* White Move */}
                      <button
                        onClick={() => setCurrentPly(whitePly)}
                        className={`text-left px-2 py-1 rounded flex items-center justify-between font-mono transition ${
                          currentPly === whitePly
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="text-slate-500 mr-1.5">{moveIndex + 1}.</span>
                        <span className="flex-1">{whiteSan}</span>
                      </button>

                      {/* Black Move */}
                      {blackSan ? (
                        <button
                          onClick={() => setCurrentPly(blackPly)}
                          className={`text-left px-2 py-1 rounded font-mono transition ${
                            currentPly === blackPly
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          {blackSan}
                        </button>
                      ) : (
                        <div />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Game Result Footer */}
            <div className="pt-2 border-t border-slate-800 text-center font-bold text-sm text-emerald-400">
              {game.result}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini helper component for icon
const FileTextIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

export default DatabaseView;
