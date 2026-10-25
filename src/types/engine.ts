export type HumanElo = 1100 | 1300 | 1500 | 1700 | 1900;

export type EngineStyle = 'balanced' | 'aggressive' | 'solid';

export interface EngineRequest {
  type: 'search' | 'evaluate' | 'init';
  id?: string;
  fen: string;
  elo: HumanElo;
  moveHistorySan?: string[];
  priorMoves?: string[]; // UCI moves history e.g. ["e2e4", "e7e5"]
  options?: {
    thinkingTimeMs?: number;
    style?: EngineStyle;
    enableOpeningBook?: boolean;
    forceFallback?: boolean;
  };
}

export interface MoveCandidate {
  san: string;
  uci: string;
  probability: number;
  wdl?: { win: number; draw: number; loss: number };
  winProbability?: number;
}

export interface EngineResponse {
  type: 'move' | 'evaluation' | 'status' | 'error';
  id?: string;
  bestMoveSan: string;
  bestMoveUci: string;
  candidateMoves: MoveCandidate[];
  tierUsed: 'human_opening_book' | 'maia_neural' | 'heuristic_fallback';
  centipawns?: number;
  isCheckmate?: boolean;
  mateIn?: number;
  blunderWarning?: string;
  elapsedMs?: number;
  modelLoaded?: boolean;
  error?: string;
}

export interface EngineStatusMessage {
  type: 'status';
  modelLoaded: boolean;
  loadingProgress?: number;
  message?: string;
}
