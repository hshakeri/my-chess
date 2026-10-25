import React from 'react';
import { PieceColor, PieceSymbol } from '../types/chess';
import { ChessPiece } from './ChessPiece';

interface PromotionModalProps {
  color: PieceColor;
  onSelect: (promotion: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  color,
  onSelect,
  onCancel,
}) => {
  const pieces: Array<{ type: PieceSymbol; name: string; key: 'q' | 'r' | 'b' | 'n' }> = [
    { type: 'q', name: 'Queen', key: 'q' },
    { type: 'r', name: 'Rook', key: 'r' },
    { type: 'b', name: 'Bishop', key: 'b' },
    { type: 'n', name: 'Knight', key: 'n' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-4 text-center">
          Promote Pawn
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {pieces.map((p) => (
            <button
              key={p.key}
              onClick={() => onSelect(p.key)}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-700/60 hover:bg-emerald-600/30 border border-slate-600 hover:border-emerald-500 transition-all hover:scale-105 active:scale-95 group"
            >
              <div className="w-14 h-14 mb-1">
                <ChessPiece type={p.type} color={color} />
              </div>
              <span className="text-xs text-slate-300 group-hover:text-white font-medium">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
