import { EngineRequest, EngineResponse } from '../../types/engine';
import { HybridEngine } from '../human/hybridEngine';
import { reviewGame, type ReviewInput } from '../../analytics/review';
import type { GameReview } from '../../types/review';
import type { ReviewProgressMessage, ReviewResultMessage, ReviewStage } from './reviewProtocol';

export interface ReviewProgress {
  stage: ReviewStage;
  done: number;
  total: number;
}

interface PendingReview {
  resolve: (review: GameReview | null) => void;
  reject: (err: Error) => void;
  onProgress?: (p: ReviewProgress) => void;
}

export class EngineClient {
  private worker: Worker | null = null;
  private pendingCallbacks = new Map<string, (res: EngineResponse) => void>();
  private pendingReviews = new Map<string, PendingReview>();
  private directEngine: HybridEngine | null = null;
  private modelLoaded = false;
  private statusListeners: Array<(loaded: boolean, msg?: string) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('./engineWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent<EngineResponse | { type: 'status'; modelLoaded: boolean; message?: string }>) => {
          const data = event.data as EngineResponse | ReviewProgressMessage | ReviewResultMessage | { type: 'status'; modelLoaded: boolean; message?: string };
          if (data.type === 'review-progress' || data.type === 'review-result') {
            this.handleReviewMessage(data);
            return;
          }
          if (data.type === 'status') {
            this.modelLoaded = (data as any).modelLoaded ?? false;
            this.notifyStatus(this.modelLoaded, (data as any).message);
            return;
          }

          if (data.id && this.pendingCallbacks.has(data.id)) {
            const cb = this.pendingCallbacks.get(data.id)!;
            this.pendingCallbacks.delete(data.id);
            cb(data as EngineResponse);
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Engine worker error, falling back to direct engine:', err);
          this.initDirectEngine();
        };
      } catch (err) {
        console.warn('Failed to start worker, using direct engine:', err);
        this.initDirectEngine();
      }
    } else {
      this.initDirectEngine();
    }
  }

  private initDirectEngine(loadModel = true): void {
    if (!this.directEngine) {
      this.directEngine = new HybridEngine();
      // The main-thread engine answers from the opening book and the heuristic search at once;
      // the neural model is only loaded here when the worker is gone for good, never as a
      // side effect of one slow reply (on a phone that download would freeze the page).
      if (loadModel) {
        this.directEngine.initMaia().then((loaded) => {
          this.modelLoaded = loaded;
          this.notifyStatus(loaded);
        }).catch(() => {
          this.modelLoaded = false;
          this.notifyStatus(false);
        });
      }
    }
  }

  public onStatusChange(listener: (loaded: boolean, msg?: string) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.modelLoaded);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(loaded: boolean, msg?: string): void {
    this.statusListeners.forEach((l) => l(loaded, msg));
  }

  public isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  /**
   * Request a move calculation from the engine.
   */
  public async requestMove(
    req: Omit<EngineRequest, 'id'>
  ): Promise<EngineResponse> {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullReq: EngineRequest = { ...req, id };

    if (this.worker) {
      return new Promise<EngineResponse>((resolve) => {
        // Fallback timeout in case the worker is slow (a phone compiling the neural runtime) or hung:
        // answer from the book or the heuristic search on the main thread instead of leaving the
        // player waiting, without pulling the model onto the main thread.
        const timeout = setTimeout(() => {
          if (this.pendingCallbacks.has(id)) {
            this.pendingCallbacks.delete(id);
            this.initDirectEngine(false);
            this.directEngine!.processRequest({ ...fullReq, options: { ...fullReq.options, forceFallback: true } })
              .then(resolve)
              .catch(() => resolve({ type: 'error', id, bestMoveSan: '', bestMoveUci: '', candidateMoves: [], tierUsed: 'heuristic_fallback', error: 'Engine unavailable' } as EngineResponse));
          }
        }, 4000);

        this.pendingCallbacks.set(id, (res) => {
          clearTimeout(timeout);
          resolve(res);
        });

        this.worker!.postMessage(fullReq);
      });
    }

    this.initDirectEngine();
    return this.directEngine!.processRequest(fullReq);
  }

  private handleReviewMessage(data: ReviewProgressMessage | ReviewResultMessage): void {
    const pending = this.pendingReviews.get(data.id);
    if (!pending) return;
    if (data.type === 'review-progress') {
      pending.onProgress?.({ stage: data.stage, done: data.done, total: data.total });
      return;
    }
    this.pendingReviews.delete(data.id);
    if (data.review) pending.resolve(data.review);
    else if (data.cancelled) pending.resolve(null);
    else pending.reject(new Error(data.error || 'Review failed'));
  }

  /**
   * Review one game in the worker (CL-3): Maia scores every position, then the moves that cost
   * hoot65 at least 15 points of expected score are classified. Resolves to null when cancelled.
   * Without a worker the review runs here on material alone.
   */
  public reviewGame(input: ReviewInput, onProgress?: (p: ReviewProgress) => void): { result: Promise<GameReview | null>; cancel: () => void } {
    const id = `review_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    if (!this.worker) {
      let stopped = false;
      const result = reviewGame(input, null, {
        onProgress: (stage, done, total) => onProgress?.({ stage, done, total }),
        isCancelled: () => stopped,
      }).catch((err) => (stopped ? null : Promise.reject(err)));
      return { result, cancel: () => (stopped = true) };
    }
    const result = new Promise<GameReview | null>((resolve, reject) => this.pendingReviews.set(id, { resolve, reject, onProgress }));
    this.worker.postMessage({ type: 'review', id, input });
    return { result, cancel: () => this.worker?.postMessage({ type: 'cancel', id }) };
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCallbacks.clear();
    for (const pending of this.pendingReviews.values()) pending.resolve(null);
    this.pendingReviews.clear();
  }
}
