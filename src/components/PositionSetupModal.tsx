import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

export interface PositionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadFen: (fen: string) => { success: boolean; error?: string };
  onLoadPgn: (pgn: string) => { success: boolean; error?: string };
  currentFen: string;
}

const PRESETS = [
  {
    name: 'Standard Start',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
  {
    name: 'Scandinavian Defense',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  },
  {
    name: 'Italian Game (Giuoco Piano)',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  },
  {
    name: 'Tactical Scholar Setup',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
  },
  {
    name: 'Rook Endgame Practice',
    fen: '8/8/8/8/8/3k4/8/R3K3 w - - 0 1',
  },
];

export const PositionSetupModal: React.FC<PositionSetupModalProps> = ({
  isOpen,
  onClose,
  onLoadFen,
  onLoadPgn,
  currentFen,
}) => {
  const [activeTab, setActiveTab] = useState<'fen' | 'pgn'>('fen');
  const [fenInput, setFenInput] = useState(currentFen);
  const [pgnInput, setPgnInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyFen = (fenToLoad?: string) => {
    const fen = fenToLoad || fenInput;
    setErrorMessage(null);
    const result = onLoadFen(fen);
    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || 'Invalid FEN notation');
    }
  };

  const handleApplyPgn = () => {
    setErrorMessage(null);
    if (!pgnInput.trim()) {
      setErrorMessage('Please enter PGN text');
      return;
    }
    const result = onLoadPgn(pgnInput);
    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || 'Invalid PGN notation');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/80">
          <h2 className="text-lg font-bold text-white">Custom Position Setup</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
          <button
            type="button"
            data-tab="fen"
            onClick={() => {
              setActiveTab('fen');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'fen'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Load by FEN
          </button>
          <button
            type="button"
            data-tab="pgn"
            onClick={() => {
              setActiveTab('pgn');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'pgn'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Load by PGN
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/40 border border-red-700/60 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'fen' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Forsyth–Edwards Notation (FEN)
                </label>
                <textarea
                  data-input="fen"
                  rows={3}
                  value={fenInput}
                  onChange={(e) => {
                    setFenInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  placeholder="Paste FEN position here..."
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-400 mb-1.5">
                  Preset Positions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setFenInput(p.fen);
                        setErrorMessage(null);
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-600/40"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Portable Game Notation (PGN)
                </label>
                <textarea
                  data-input="pgn"
                  rows={6}
                  value={pgnInput}
                  onChange={(e) => {
                    setPgnInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  placeholder={'[Event "Casual Game"]\n1. e4 e5 2. Nf3 Nc6 *'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-800/80 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            data-action="apply-position"
            onClick={() => (activeTab === 'fen' ? handleApplyFen() : handleApplyPgn())}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>Load Position</span>
          </button>
        </div>
      </div>
    </div>
  );
};
