import React, { useEffect, useRef } from 'react';
import { ChessMoveRecord } from '../types/chess';
import { Copy, Check, FileText } from 'lucide-react';

export interface MoveListProps {
  history: ChessMoveRecord[];
  currentPly: number; // 0 for starting position, 1..N for moves
  onSelectPly: (ply: number) => void;
  result?: string;
  gameOverReason?: string;
  onCopyPgn?: () => void;
  className?: string;
}

export const MoveList: React.FC<MoveListProps> = ({
  history,
  currentPly,
  onSelectPly,
  result = '*',
  gameOverReason,
  onCopyPgn,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  // Group into pairs [White, Black]
  const movePairs: Array<{
    moveNumber: number;
    white?: ChessMoveRecord;
    black?: ChessMoveRecord;
  }> = [];

  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  // Auto-scroll to active ply
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [currentPly, history.length]);

  const handleCopy = () => {
    if (onCopyPgn) {
      onCopyPgn();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`move-list-panel flex flex-col bg-slate-800/90 border border-slate-700 rounded-lg overflow-hidden shadow-lg ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 text-xs font-semibold text-slate-300">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Move Notation (SAN)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            {history.length} {history.length === 1 ? 'ply' : 'plies'}
          </span>
          {onCopyPgn && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy PGN to clipboard"
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Starting position row */}
      <div className="px-3 py-1.5 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between text-xs">
        <button
          type="button"
          data-ply={0}
          data-active={currentPly === 0}
          onClick={() => onSelectPly(0)}
          className={`px-2 py-0.5 rounded text-left transition-colors font-medium ${
            currentPly === 0
              ? 'bg-emerald-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          0. Initial Position
        </button>
      </div>

      {/* Scrollable Move Rows */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto max-h-[320px] p-2 space-y-0.5 custom-scrollbar text-sm"
      >
        {movePairs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            Make a move on the board to begin recording SAN.
          </div>
        ) : (
          movePairs.map(({ moveNumber, white, black }) => (
            <div
              key={moveNumber}
              className="flex items-center text-xs py-0.5 px-1 rounded hover:bg-slate-700/30 transition-colors"
            >
              {/* Move Number */}
              <span className="w-9 font-mono text-slate-500 text-right pr-2 select-none">
                {moveNumber}.
              </span>

              {/* White Move */}
              <button
                type="button"
                data-ply={white?.ply}
                data-active={currentPly === white?.ply}
                onClick={() => white && onSelectPly(white.ply)}
                className={`flex-1 text-left px-2 py-1 rounded font-mono transition-colors ${
                  currentPly === white?.ply
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {white?.san}
              </button>

              {/* Black Move */}
              {black ? (
                <button
                  type="button"
                  data-ply={black.ply}
                  data-active={currentPly === black.ply}
                  onClick={() => onSelectPly(black.ply)}
                  className={`flex-1 text-left px-2 py-1 rounded font-mono transition-colors ${
                    currentPly === black.ply
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {black.san}
                </button>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          ))
        )}

        {/* Game termination status bar */}
        {result !== '*' && (
          <div className="mt-3 p-2 rounded bg-slate-900/60 border border-slate-700 text-center">
            <div className="text-sm font-bold text-amber-300 font-mono tracking-wider">
              {result}
            </div>
            {gameOverReason && (
              <div className="text-xs text-slate-300 mt-0.5">{gameOverReason}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
