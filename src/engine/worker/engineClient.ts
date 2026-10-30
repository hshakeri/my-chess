import { EngineRequest, EngineResponse } from '../../types/engine';
import { HybridEngine } from '../human/hybridEngine';

export class EngineClient {
  private worker: Worker | null = null;
  private pendingCallbacks = new Map<string, (res: EngineResponse) => void>();
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
          const data = event.data;
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

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCallbacks.clear();
  }
}
