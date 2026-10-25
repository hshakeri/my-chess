import React from 'react';
import { PieceSymbol, PieceColor } from '../types/chess';

interface ChessPieceProps {
  type: PieceSymbol;
  color: PieceColor;
  className?: string;
  isDragging?: boolean;
}

export const ChessPiece: React.FC<ChessPieceProps> = ({
  type,
  color,
  className = '',
  isDragging = false,
}) => {
  const pieceKey = `${color}${type.toUpperCase()}`;
  const baseUrl = import.meta.env.BASE_URL || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const src = `${cleanBase}pieces/${pieceKey}.svg`;

  return (
    <img
      src={src}
      alt={`${color === 'w' ? 'White' : 'Black'} ${type}`}
      draggable={false}
      className={`w-full h-full select-none pointer-events-none transition-transform duration-100 ${
        isDragging ? 'opacity-40 scale-110' : ''
      } ${className}`}
    />
  );
};
