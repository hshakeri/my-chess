import { Chess } from 'chess.js';
import { HumanElo, MoveCandidate } from '../../types/engine';

/**
 * The model's URL: the site's base path (Vite's BASE_URL, '/my-chess/' on GitHub Pages) resolved
 * against the page's or the worker's origin.
 */
export function defaultModelUrl(): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
  return `${origin}${base}models/maia3_5m.onnx`;
}

export class MaiaEngine {
  private maiaInstance: any = null;
  private isModelLoading = false;
  private isModelLoaded = false;
  private loadError: string | null = null;

  public isLoaded(): boolean {
    return this.isModelLoaded;
  }

  public getLoadError(): string | null {
    return this.loadError;
  }

  /**
   * Initialize Maia-3 ONNX session.
   */
  public async init(modelUrl?: string, wasmPath?: string): Promise<boolean> {
    if (this.isModelLoaded) return true;
    if (this.isModelLoading) return false;

    this.isModelLoading = true;
    this.loadError = null;

    try {
      const { Maia3 } = await import('maia3-js/web');

      this.maiaInstance = new Maia3({
        variant: '5m',
        url: modelUrl || defaultModelUrl(),
        // No wasm path by default: onnxruntime-web then runs the loader bundled into its own module and
        // fetches the one .wasm file Vite emits beside it in assets/, so the site ships a single copy.
        wasmPaths: wasmPath,
        numThreads: 1,
      });

      await this.maiaInstance.load();
      this.isModelLoaded = true;
      this.isModelLoading = false;
      return true;
    } catch (err: any) {
      this.isModelLoading = false;
      this.isModelLoaded = false;
      this.loadError = err?.message || 'Failed to load Maia ONNX model';
      return false;
    }
  }

  /**
   * Maia's expected score and policy for many positions (one forward pass each, no candidate
   * re-scoring), in chunks so that progress can be reported and a cancel takes effect between
   * chunks. Null for a position Maia cannot score, such as one with no legal move.
   */
  public async scoreBatch(
    requests: Array<{ fen: string; priorFens: string[]; selfElo: number; oppoElo: number }>,
    onProgress?: (done: number, total: number) => void,
    isCancelled?: () => boolean
  ): Promise<Array<{ winProbability: number; moves: Map<string, number> } | null>> {
    if (!this.isModelLoaded || !this.maiaInstance) return requests.map(() => null);
    const chunkSize = 16;
    const out: Array<{ winProbability: number; moves: Map<string, number> } | null> = [];
    for (let i = 0; i < requests.length; i += chunkSize) {
      if (isCancelled?.()) break;
      const inputs = requests.slice(i, i + chunkSize).map((r) => ({
        fen: r.fen,
        priorFens: r.priorFens.length ? r.priorFens : undefined,
        selfElo: r.selfElo,
        oppoElo: r.oppoElo,
      }));
      const results = await this.maiaInstance.predictBatch(inputs, { topK: 0, onError: 'collect', maxBatchSize: chunkSize });
      for (const r of results) out.push(r instanceof Error ? null : { winProbability: r.winProbability, moves: r.moves });
      onProgress?.(Math.min(i + chunkSize, requests.length), requests.length);
    }
    return out;
  }

  /**
   * Run neural human move prediction.
   */
  public async predict(
    fen: string,
    selfElo: HumanElo = 1500,
    priorMoves?: string[]
  ): Promise<{
    bestMoveSan: string;
    bestMoveUci: string;
    candidateMoves: MoveCandidate[];
    winProbability?: number;
    wdl?: { win: number; draw: number; loss: number };
  } | null> {
    if (!this.isModelLoaded || !this.maiaInstance) {
      return null;
    }

    try {
      const result = await this.maiaInstance.predict({
        fen,
        selfElo,
        priorMoves: priorMoves && priorMoves.length > 0 ? priorMoves : undefined,
        topK: 5,
      });

      const chess = new Chess(fen);
      const legalMoves = chess.moves({ verbose: true });

      // Build legal move lookup: UCI -> SAN
      const uciToSan = new Map<string, string>();
      for (const m of legalMoves) {
        const uci = `${m.from}${m.to}${m.promotion || ''}`;
        uciToSan.set(uci, m.san);
      }

      const bestUci = result.bestMove;
      const bestSan = uciToSan.get(bestUci) || bestUci;

      const candidates: MoveCandidate[] = [];
      if (result.candidates && Array.isArray(result.candidates)) {
        for (const cand of result.candidates) {
          const san = uciToSan.get(cand.uci) || cand.uci;
          candidates.push({
            san,
            uci: cand.uci,
            probability: Math.round(cand.probability * 1000) / 1000,
            wdl: cand.wdl,
            winProbability: cand.winProbability,
          });
        }
      }

      return {
        bestMoveSan: bestSan,
        bestMoveUci: bestUci,
        candidateMoves: candidates,
        winProbability: result.winProbability,
        wdl: result.wdl,
      };
    } catch (err: any) {
      console.warn('Maia prediction error:', err);
      return null;
    }
  }
}
