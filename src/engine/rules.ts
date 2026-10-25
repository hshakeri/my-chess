import { Chess, Move } from 'chess.js';
import {
  ChessPosition,
  ChessMoveRecord,
  Square,
  PieceInfo,
  PieceSymbol,
  PieceColor,
  GameHeaders,
} from '../types/chess';

export class RulesEngine {
  private chess: Chess;
  private historyRecords: ChessMoveRecord[] = [];
  private initialFen: string;
  private customHeaders: GameHeaders = {};

  constructor(fen?: string) {
    this.chess = new Chess(fen);
    this.initialFen = this.chess.fen();
    this.customHeaders = {
      Event: 'Casual Game',
      Site: 'My Chess Client',
      Date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      Round: '1',
      White: 'Player',
      Black: 'Opponent',
      Result: '*',
    };
  }

  public reset(): void {
    this.chess.reset();
    this.initialFen = this.chess.fen();
    this.historyRecords = [];
    this.customHeaders.Result = '*';
  }

  public getFen(): string {
    return this.chess.fen();
  }

  public getInitialFen(): string {
    return this.initialFen;
  }

  public getTurn(): PieceColor {
    return this.chess.turn();
  }

  public getMoveNumber(): number {
    return this.chess.moveNumber();
  }

  public getPosition(): ChessPosition {
    const isCheck = this.chess.inCheck();
    const isCheckmate = this.chess.isCheckmate();
    const isStalemate = this.chess.isStalemate();
    const isThreefold = this.chess.isThreefoldRepetition();
    const isInsufficient = this.chess.isInsufficientMaterial();
    const is50Moves = this.chess.isDrawByFiftyMoves();
    const isDraw = this.chess.isDraw();

    let drawReason: ChessPosition['drawReason'];
    if (isStalemate) {
      drawReason = 'stalemate';
    } else if (isThreefold) {
      drawReason = 'threefold_repetition';
    } else if (isInsufficient) {
      drawReason = 'insufficient_material';
    } else if (is50Moves) {
      drawReason = '50_move_rule';
    }

    return {
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      isCheck,
      isCheckmate,
      isStalemate,
      isDraw,
      drawReason,
      legalMovesSan: this.chess.moves(),
    };
  }

  public getLegalMovesVerbose(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  public getLegalMovesForSquare(square: Square): Array<{ to: Square; san: string; promotion?: string }> {
    const moves = this.chess.moves({ square: square as any, verbose: true });
    return moves.map((m) => ({
      to: m.to as Square,
      san: m.san,
      promotion: m.promotion,
    }));
  }

  public isLegalMove(from: Square, to: Square, promotion?: string): boolean {
    const legalMoves = this.chess.moves({ square: from as any, verbose: true });
    return legalMoves.some((m) => {
      if (m.to !== to) return false;
      if (m.promotion && promotion) {
        return m.promotion === promotion;
      }
      return true;
    });
  }

  public makeMove(
    move: string | { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }
  ): { success: boolean; moveRecord?: ChessMoveRecord; error?: string } {
    try {
      const result = this.chess.move(move);
      if (!result) {
        return { success: false, error: 'Illegal move' };
      }

      const uci = `${result.from}${result.to}${result.promotion || ''}`;
      const ply = this.historyRecords.length + 1;
      const record: ChessMoveRecord = {
        ply,
        san: result.san,
        uci,
        fenAfter: this.chess.fen(),
      };
      this.historyRecords.push(record);

      const status = this.getGameOverStatus();
      if (status.isOver && status.result) {
        this.customHeaders.Result = status.result;
      }

      return { success: true, moveRecord: record };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Illegal move' };
    }
  }

  public undoMove(): boolean {
    const undone = this.chess.undo();
    if (undone) {
      this.historyRecords.pop();
      return true;
    }
    return false;
  }

  public loadFen(fen: string): { success: boolean; error?: string } {
    try {
      this.chess.load(fen.trim());
      this.initialFen = this.chess.fen();
      this.historyRecords = [];
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Invalid FEN format' };
    }
  }

  public loadPgn(pgn: string): { success: boolean; error?: string } {
    try {
      const tempChess = new Chess();
      tempChess.loadPgn(pgn.trim());
      
      this.chess = tempChess;
      this.initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      this.historyRecords = [];
      
      // Rebuild history records with proper plies and FENs
      const historyMoves = this.chess.history({ verbose: true });
      const replayChess = new Chess();
      historyMoves.forEach((m, idx) => {
        replayChess.move(m);
        const uci = `${m.from}${m.to}${m.promotion || ''}`;
        this.historyRecords.push({
          ply: idx + 1,
          san: m.san,
          uci,
          fenAfter: replayChess.fen(),
        });
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Invalid PGN format' };
    }
  }

  public exportPgn(headers?: GameHeaders): string {
    const allHeaders = { ...this.customHeaders, ...headers };
    Object.entries(allHeaders).forEach(([key, val]) => {
      if (val !== undefined) {
        this.chess.setHeader(key, val);
      }
    });
    return this.chess.pgn();
  }

  public getHistory(): ChessMoveRecord[] {
    return [...this.historyRecords];
  }

  public getBoard(): (PieceInfo | null)[][] {
    const rawBoard = this.chess.board();
    return rawBoard.map((row) =>
      row.map((cell) => {
        if (!cell) return null;
        return {
          square: cell.square as Square,
          type: cell.type as PieceSymbol,
          color: cell.color as PieceColor,
        };
      })
    );
  }

  public isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  public getGameOverStatus(): {
    isOver: boolean;
    result?: '1-0' | '0-1' | '1/2-1/2' | '*';
    reason?: string;
  } {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      const result = this.chess.turn() === 'w' ? '0-1' : '1-0';
      return {
        isOver: true,
        result,
        reason: `Checkmate — ${winner} wins`,
      };
    }

    if (this.chess.isStalemate()) {
      return {
        isOver: true,
        result: '1/2-1/2',
        reason: 'Draw by stalemate',
      };
    }

    if (this.chess.isThreefoldRepetition()) {
      return {
        isOver: true,
        result: '1/2-1/2',
        reason: 'Draw by threefold repetition',
      };
    }

    if (this.chess.isInsufficientMaterial()) {
      return {
        isOver: true,
        result: '1/2-1/2',
        reason: 'Draw by insufficient material',
      };
    }

    if (this.chess.isDrawByFiftyMoves()) {
      return {
        isOver: true,
        result: '1/2-1/2',
        reason: 'Draw by 50-move rule',
      };
    }

    if (this.chess.isDraw()) {
      return {
        isOver: true,
        result: '1/2-1/2',
        reason: 'Draw',
      };
    }

    return { isOver: false, result: '*' };
  }
}
