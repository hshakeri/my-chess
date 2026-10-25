import React from 'react';
import {
  RotateCcw,
  ChevronFirst,
  ChevronLeft,
  ChevronRight,
  ChevronLast,
  Undo2,
  PlusCircle,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import { PieceColor } from '../types/chess';

export interface BoardControlsProps {
  orientation: PieceColor;
  onFlipOrientation: () => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  onNavigateStart: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onNavigateEnd: () => void;
  onTakeback: () => void;
  canTakeback: boolean;
  onNewGame: () => void;
  onOpenPositionSetup: () => void;
  onExportPgn?: () => void;
  className?: string;
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  orientation,
  onFlipOrientation,
  canNavigatePrev,
  canNavigateNext,
  onNavigateStart,
  onNavigatePrev,
  onNavigateNext,
  onNavigateEnd,
  onTakeback,
  canTakeback,
  onNewGame,
  onOpenPositionSetup,
  onExportPgn,
  className = '',
}) => {
  return (
    <div
      className={`board-controls-bar flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-800/90 border border-slate-700 rounded-lg text-slate-200 select-none shadow-md ${className}`}
    >
      {/* Navigation step buttons */}
      <div className="flex items-center space-x-1">
        <button
          type="button"
          data-action="nav-start"
          title="Go to start (First move)"
          disabled={!canNavigatePrev}
          onClick={onNavigateStart}
          className="p-2 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-300 hover:text-white"
        >
          <ChevronFirst className="w-5 h-5" />
        </button>

        <button
          type="button"
          data-action="nav-prev"
          title="Previous move (Left arrow)"
          disabled={!canNavigatePrev}
          onClick={onNavigatePrev}
          className="p-2 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-300 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          data-action="nav-next"
          title="Next move (Right arrow)"
          disabled={!canNavigateNext}
          onClick={onNavigateNext}
          className="p-2 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-300 hover:text-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          type="button"
          data-action="nav-end"
          title="Go to current / latest move"
          disabled={!canNavigateNext}
          onClick={onNavigateEnd}
          className="p-2 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-300 hover:text-white"
        >
          <ChevronLast className="w-5 h-5" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-1">
        {/* Flip Orientation */}
        <button
          type="button"
          data-action="flip-board"
          title={`Flip board (Currently viewing from ${orientation === 'w' ? 'White' : 'Black'})`}
          onClick={onFlipOrientation}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-600/50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Flip</span>
        </button>

        {/* Takeback / Undo */}
        <button
          type="button"
          data-action="takeback"
          title="Takeback last move"
          disabled={!canTakeback}
          onClick={onTakeback}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-slate-700/60 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-700/60 text-slate-200 hover:text-white transition-colors border border-slate-600/50"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Takeback</span>
        </button>

        {/* Position Setup Dialog */}
        <button
          type="button"
          data-action="setup-position"
          title="Custom FEN / PGN position setup"
          onClick={onOpenPositionSetup}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-600/50"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Setup</span>
        </button>

        {/* Export PGN */}
        {onExportPgn && (
          <button
            type="button"
            data-action="export-pgn"
            title="Download or copy PGN notation"
            onClick={onExportPgn}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        )}

        {/* New Game */}
        <button
          type="button"
          data-action="new-game"
          title="Start fresh game"
          onClick={onNewGame}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm ml-1"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Game</span>
        </button>
      </div>
    </div>
  );
};
