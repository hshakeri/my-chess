import { EngineRequest, EngineResponse } from '../../types/engine';
import { HumanOpeningBook } from './openingBook';
import { HeuristicFallbackEngine } from './heuristicFallback';
import { MaiaEngine } from './maiaEngine';
import { TacticalEvaluator } from './tacticalEvaluator';
import { Chess } from 'chess.js';

export class HybridEngine {
  private maia = new MaiaEngine();

  public getMaiaEngine(): MaiaEngine {
    return this.maia;
  }

  public async initMaia(modelUrl?: string, wasmPath?: string): Promise<boolean> {
    return this.maia.init(modelUrl, wasmPath);
  }

  public isMaiaLoaded(): boolean {
    return this.maia.isLoaded();
  }

  /**
   * Process a chess engine request through the 4-tier hybrid architecture.
   */
  public async processRequest(req: EngineRequest): Promise<EngineResponse> {
    const startTime = Date.now();
    const chess = new Chess(req.fen);

    if (chess.isGameOver()) {
      return {
        type: 'evaluation',
        id: req.id,
        bestMoveSan: '',
        bestMoveUci: '',
        candidateMoves: [],
        tierUsed: 'heuristic_fallback',
        isCheckmate: chess.isCheckmate(),
        centipawns: chess.isCheckmate() ? (chess.turn() === 'w' ? -20000 : 20000) : 0,
        elapsedMs: Date.now() - startTime,
        modelLoaded: this.maia.isLoaded(),
      };
    }

    const enableBook = req.options?.enableOpeningBook !== false;
    const forceFallback = req.options?.forceFallback === true;

    // --- Tier 1: Instant Human Opening Book ---
    if (enableBook) {
      const bookMove = HumanOpeningBook.selectMove(req.fen);
      if (bookMove) {
        const staticCp = TacticalEvaluator.evaluateStatic(chess);
        return {
          type: 'move',
          id: req.id,
          bestMoveSan: bookMove.bestMoveSan,
          bestMoveUci: bookMove.bestMoveUci,
          candidateMoves: bookMove.candidateMoves,
          tierUsed: 'human_opening_book',
          centipawns: staticCp,
          elapsedMs: Date.now() - startTime,
          modelLoaded: this.maia.isLoaded(),
        };
      }
    }

    // --- Tier 2: Maia-3 Neural Human Move Prediction ---
    if (!forceFallback && this.maia.isLoaded()) {
      try {
        const maiaResult = await this.maia.predict(
          req.fen,
          req.elo,
          req.priorMoves
        );

        if (maiaResult && maiaResult.bestMoveSan) {
          const staticCp = TacticalEvaluator.evaluateStatic(chess);
          return {
            type: 'move',
            id: req.id,
            bestMoveSan: maiaResult.bestMoveSan,
            bestMoveUci: maiaResult.bestMoveUci,
            candidateMoves: maiaResult.candidateMoves,
            tierUsed: 'maia_neural',
            centipawns: staticCp,
            elapsedMs: Date.now() - startTime,
            modelLoaded: true,
          };
        }
      } catch (err) {
        console.warn('Maia inference failed, falling back to heuristic engine:', err);
      }
    }

    // --- Tier 3: Client-side Heuristic Fallback with Human Blunder Profiling ---
    const heuristicResult = HeuristicFallbackEngine.search(
      req.fen,
      req.elo,
      req.options?.style || 'balanced'
    );

    // --- Tier 4: Objective Tactical Evaluation Check ---
    const staticEval = TacticalEvaluator.evaluateStatic(chess);

    return {
      type: 'move',
      id: req.id,
      bestMoveSan: heuristicResult.bestMoveSan,
      bestMoveUci: heuristicResult.bestMoveUci,
      candidateMoves: heuristicResult.candidateMoves,
      tierUsed: 'heuristic_fallback',
      centipawns: staticEval,
      elapsedMs: Date.now() - startTime,
      modelLoaded: this.maia.isLoaded(),
    };
  }
}
