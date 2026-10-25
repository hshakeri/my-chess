import React, { useState, useMemo, useId } from 'react';
import {
  Square,
  PieceInfo,
  PieceColor,
  ChessPosition,
} from '../types/chess';
import { ChessPiece } from './ChessPiece';
import { PromotionModal } from './PromotionModal';

/**
 * Semantic cue colours for coaching overlays:
 * red = attacker to target / the move that went wrong, green = the plan move,
 * yellow = a weak or key square, blue = a defender or supporting piece.
 */
export type BoardCueColor = 'green' | 'red' | 'yellow' | 'blue';

export interface BoardArrow {
  from: string;
  to: string;
  color?: BoardCueColor | string;
}

export interface BoardHighlight {
  square: string;
  color?: BoardCueColor | string;
}

/** At most this many arrows and this many highlights are drawn (sparse cues). */
export const MAX_BOARD_CUES = 3;

const CUE_FILL: Record<string, string> = {
  green: '#15803d',
  red: '#dc2626',
  yellow: '#ca8a04',
  blue: '#2563eb',
};

export interface ChessboardProps {
  board: (PieceInfo | null)[][];
  position: ChessPosition;
  orientation?: PieceColor;
  lastMove?: { from: Square; to: Square } | null;
  onMove?: (move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }) => void;
  interactive?: boolean;
  getLegalMovesForSquare?: (square: Square) => Array<{ to: Square; san: string; promotion?: string }>;
  customSquareStyles?: Record<string, string>;
  /** Coaching arrows drawn as an SVG overlay (first three are used). */
  arrows?: BoardArrow[];
  /** Coaching square highlights drawn as an SVG overlay (first three are used). */
  highlights?: BoardHighlight[];
  className?: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export const Chessboard: React.FC<ChessboardProps> = ({
  board,
  position,
  orientation = 'w',
  lastMove = null,
  onMove,
  interactive = true,
  getLegalMovesForSquare,
  customSquareStyles = {},
  arrows = [],
  highlights = [],
  className = '',
}) => {
  const overlayId = useId().replace(/:/g, '');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
    color: PieceColor;
  } | null>(null);

  // Map 8x8 board matrix into a quick Square -> PieceInfo dictionary
  const pieceMap = useMemo(() => {
    const map = new Map<Square, PieceInfo>();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const item = board[r]?.[c];
        if (item) {
          map.set(item.square, item);
        }
      }
    }
    return map;
  }, [board]);

  // Compute legal destination squares for the currently selected square
  const legalTargets = useMemo(() => {
    if (!selectedSquare || !getLegalMovesForSquare) return new Map<Square, { isPromotion: boolean }>();
    const moves = getLegalMovesForSquare(selectedSquare);
    const map = new Map<Square, { isPromotion: boolean }>();
    for (const m of moves) {
      map.set(m.to, { isPromotion: !!m.promotion });
    }
    return map;
  }, [selectedSquare, getLegalMovesForSquare]);

  const displayRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();
  const displayFiles = orientation === 'w' ? FILES : [...FILES].reverse();

  // Square -> SVG centre in an 8x8 viewBox, respecting the board orientation.
  const squareCentre = (square: string): { x: number; y: number } | null => {
    const file = square[0];
    const rank = square[1];
    const fx = (displayFiles as readonly string[]).indexOf(file);
    const ry = (displayRanks as readonly string[]).indexOf(rank);
    if (fx < 0 || ry < 0) return null;
    return { x: fx + 0.5, y: ry + 0.5 };
  };

  const visibleArrows = arrows.slice(0, MAX_BOARD_CUES);
  const visibleHighlights = highlights.slice(0, MAX_BOARD_CUES);
  const hasOverlay = visibleArrows.length > 0 || visibleHighlights.length > 0;
  const cueColors = Array.from(
    new Set([...visibleArrows, ...visibleHighlights].map((c) => c.color || 'green'))
  );

  const handleSquareClick = (square: Square) => {
    if (!interactive) return;

    const clickedPiece = pieceMap.get(square);

    // If already selected a piece
    if (selectedSquare) {
      if (selectedSquare === square) {
        // Deselect on clicking the same square
        setSelectedSquare(null);
        return;
      }

      // Check if clicked square is a legal target
      if (legalTargets.has(square)) {
        triggerMove(selectedSquare, square);
        return;
      }

      // If clicked another friendly piece, switch selection
      if (clickedPiece && clickedPiece.color === position.turn) {
        setSelectedSquare(square);
        return;
      }

      // Otherwise deselect
      setSelectedSquare(null);
      return;
    }

    // No piece currently selected: select if piece belongs to side to move
    if (clickedPiece && clickedPiece.color === position.turn) {
      setSelectedSquare(square);
    }
  };

  const triggerMove = (from: Square, to: Square) => {
    const movingPiece = pieceMap.get(from);
    if (!movingPiece) return;

    const isPawn = movingPiece.type === 'p';
    const toRank = to[1];
    const isPromotion =
      isPawn &&
      ((movingPiece.color === 'w' && toRank === '8') ||
        (movingPiece.color === 'b' && toRank === '1'));

    if (isPromotion) {
      setPendingPromotion({ from, to, color: movingPiece.color });
      setSelectedSquare(null);
    } else {
      setSelectedSquare(null);
      if (onMove) {
        onMove({ from, to });
      }
    }
  };

  const handlePromotionSelect = (promotion: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    if (onMove) {
      onMove({ from, to, promotion });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, square: Square) => {
    if (!interactive) return;
    const piece = pieceMap.get(square);
    if (!piece || piece.color !== position.turn) {
      e.preventDefault();
      return;
    }
    setDraggedSquare(square);
    setSelectedSquare(square);
    e.dataTransfer.setData('text/plain', square);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!interactive || !draggedSquare) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toSquare: Square) => {
    if (!interactive || !draggedSquare) return;
    e.preventDefault();
    const fromSquare = (e.dataTransfer.getData('text/plain') as Square) || draggedSquare;
    setDraggedSquare(null);

    if (fromSquare === toSquare) return;

    if (getLegalMovesForSquare) {
      const moves = getLegalMovesForSquare(fromSquare);
      const isLegal = moves.some((m) => m.to === toSquare);
      if (isLegal) {
        triggerMove(fromSquare, toSquare);
      }
    } else {
      triggerMove(fromSquare, toSquare);
    }
  };

  const handleDragEnd = () => {
    setDraggedSquare(null);
  };

  return (
    <div className={`relative aspect-square max-w-[560px] w-full select-none ${className}`}>
      {/* 8x8 Grid */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-md overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-slate-800">
        {displayRanks.map((rank, rankIdx) =>
          displayFiles.map((file, fileIdx) => {
            const square = `${file}${rank}` as Square;
            const piece = pieceMap.get(square);

            const fileNumber = 'abcdefgh'.indexOf(file);
            const rankNumber = parseInt(rank) - 1;
            const isDark = (fileNumber + rankNumber) % 2 === 0;

            const isSelected = selectedSquare === square;
            const isLastMoveFrom = lastMove?.from === square;
            const isLastMoveTo = lastMove?.to === square;
            const isLastMove = isLastMoveFrom || isLastMoveTo;

            const isKingInCheck =
              position.isCheck &&
              piece?.type === 'k' &&
              piece.color === position.turn;

            const isLegalTarget = legalTargets.has(square);
            const isCaptureTarget = isLegalTarget && (!!piece || (selectedSquare && pieceMap.get(selectedSquare)?.type === 'p' && selectedSquare[0] !== square[0]));

            const showRankCoord = fileIdx === 0;
            const showFileCoord = rankIdx === 7;

            // Base square color
            let squareBg = isDark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]';
            if (isLastMove) {
              squareBg = isDark ? 'bg-[#cdd26a]' : 'bg-[#f7f784]';
            }
            if (isSelected) {
              squareBg = 'bg-[#7fa650]';
            }

            return (
              <div
                key={square}
                data-square={square}
                data-piece={piece ? `${piece.color}${piece.type}` : undefined}
                className={`relative flex items-center justify-center chess-square transition-colors duration-75 cursor-pointer ${squareBg} ${
                  customSquareStyles[square] || ''
                }`}
                onClick={() => handleSquareClick(square)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, square)}
              >
                {/* Check radial highlight */}
                {isKingInCheck && (
                  <div className="absolute inset-0 king-check-glow pointer-events-none" />
                )}

                {/* Rank coordinate (top-left of left-most squares) */}
                {showRankCoord && (
                  <span
                    className={`absolute top-0.5 left-1 text-[11px] font-bold leading-none select-none pointer-events-none ${
                      isDark ? 'text-[#f0d9b5]' : 'text-[#b58863]'
                    }`}
                  >
                    {rank}
                  </span>
                )}

                {/* File coordinate (bottom-right of bottom-most squares) */}
                {showFileCoord && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[11px] font-bold leading-none select-none pointer-events-none ${
                      isDark ? 'text-[#f0d9b5]' : 'text-[#b58863]'
                    }`}
                  >
                    {file}
                  </span>
                )}

                {/* Piece Image */}
                {piece && (
                  <div
                    draggable={interactive && piece.color === position.turn}
                    onDragStart={(e) => handleDragStart(e, square)}
                    onDragEnd={handleDragEnd}
                    className={`w-full h-full p-0.5 flex items-center justify-center transition-transform ${
                      interactive && piece.color === position.turn
                        ? 'cursor-grab active:cursor-grabbing hover:scale-[1.03]'
                        : 'cursor-default'
                    } ${draggedSquare === square ? 'opacity-30' : ''}`}
                  >
                    <ChessPiece type={piece.type} color={piece.color} />
                  </div>
                )}

                {/* Legal Move Target Marker */}
                {isLegalTarget && !isCaptureTarget && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="legal-move-dot" />
                  </div>
                )}

                {/* Legal Capture Target Ring */}
                {isCaptureTarget && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="legal-capture-ring" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Coaching overlay: arrows and square highlights. pointer-events-none keeps
          every data-square click and drag target hit-testable underneath. */}
      {hasOverlay && (
        <svg
          className="board-overlay absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 8 8"
          data-overlay="cues"
          aria-hidden="true"
        >
          <defs>
            {cueColors.map((color) => (
              <marker
                key={color}
                id={`arrowhead-${overlayId}-${color}`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="2.2"
                markerHeight="2.2"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={CUE_FILL[color] || color} />
              </marker>
            ))}
          </defs>
          {visibleHighlights.map((h, idx) => {
            const c = squareCentre(h.square);
            if (!c) return null;
            const color = h.color || 'yellow';
            return (
              <rect
                key={`hl-${idx}`}
                data-cue="highlight"
                data-square-cue={h.square}
                x={c.x - 0.5}
                y={c.y - 0.5}
                width={1}
                height={1}
                fill={CUE_FILL[color] || color}
                opacity={0.45}
              />
            );
          })}
          {visibleArrows.map((a, idx) => {
            const from = squareCentre(a.from);
            const to = squareCentre(a.to);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy) || 1;
            // Leave room for the arrowhead so its tip lands on the square centre.
            const headRoom = 0.32;
            const x2 = to.x - (dx / len) * headRoom;
            const y2 = to.y - (dy / len) * headRoom;
            const color = a.color || 'green';
            return (
              <line
                key={`ar-${idx}`}
                data-cue="arrow"
                data-arrow={`${a.from}${a.to}`}
                x1={from.x}
                y1={from.y}
                x2={x2}
                y2={y2}
                stroke={CUE_FILL[color] || color}
                strokeWidth={0.17}
                strokeLinecap="round"
                opacity={0.85}
                markerEnd={`url(#arrowhead-${overlayId}-${color})`}
              />
            );
          })}
        </svg>
      )}

      {/* Promotion Dialog Modal */}
      {pendingPromotion && (
        <PromotionModal
          color={pendingPromotion.color}
          onSelect={handlePromotionSelect}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </div>
  );
};
