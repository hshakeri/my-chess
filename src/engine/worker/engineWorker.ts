import { EngineRequest, EngineResponse } from '../../types/engine';
import { HybridEngine } from '../human/hybridEngine';
import { reviewGame, ReviewCancelled, type PositionScorer } from '../../analytics/review';
import { thinkingDelayMs } from './thinkingDelay';
import type { CancelMessage, ReviewProgressMessage, ReviewRequestMessage, ReviewResultMessage, SafetyRequestMessage, SafetyResultMessage } from './reviewProtocol';
import { moveVerdict } from '../../services/microQuestions';
import { withinNodes } from '../../analytics/errorTaxonomy';

const engine = new HybridEngine();

// Auto-initialize Maia in background; a review waits for this load rather than starting a second one
const maiaReady = engine.initMaia();
maiaReady.then((loaded) => {
  self.postMessage({
    type: 'status',
    modelLoaded: loaded,
    message: loaded ? 'Maia ONNX model loaded successfully' : 'Running in fast heuristic fallback mode',
  });
}).catch((err) => {
  self.postMessage({
    type: 'status',
    modelLoaded: false,
    message: `Maia init notice: ${err?.message || 'Using heuristic fallback'}`,
  });
});

/** Reviews asked to stop; checked between Maia's batches and between classified moves. */
const cancelled = new Set<string>();

/** A post-game review: Maia scores the game in batches, then the flagged moves are classified (CL-3). */
async function runReview(req: ReviewRequestMessage): Promise<void> {
  const progress = (stage: ReviewProgressMessage['stage'], done: number, total: number) =>
    self.postMessage({ type: 'review-progress', id: req.id, stage, done, total } satisfies ReviewProgressMessage);
  const isCancelled = () => cancelled.has(req.id);
  let result: ReviewResultMessage;
  try {
    progress('loading', 0, 1);
    const loaded = await maiaReady.catch(() => false);
    const maia = engine.getMaiaEngine();
    const scorer: PositionScorer | null = loaded ? (requests, onProgress) => maia.scoreBatch(requests, onProgress, isCancelled) : null;
    const review = await reviewGame(req.input, scorer, { onProgress: progress, isCancelled });
    result = { type: 'review-result', id: req.id, review };
  } catch (err: any) {
    result = err instanceof ReviewCancelled ? { type: 'review-result', id: req.id, cancelled: true } : { type: 'review-result', id: req.id, error: err?.message || 'Review failed' };
  } finally {
    cancelled.delete(req.id);
  }
  self.postMessage(result);
}

self.onmessage = async (event: MessageEvent<EngineRequest | ReviewRequestMessage | CancelMessage | SafetyRequestMessage>) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'cancel') {
    cancelled.add(data.id);
    return;
  }
  if (data.type === 'review') {
    await runReview(data);
    return;
  }
  if (data.type === 'safety') {
    let verdict: SafetyResultMessage['verdict'] = null;
    try {
      verdict = withinNodes(data.maxNodes, () => moveVerdict(data.fen, data.san)) ?? null;
    } catch {
      verdict = null;
    }
    self.postMessage({ type: 'safety-result', id: data.id, verdict } satisfies SafetyResultMessage);
    return;
  }
  const req = data;

  if (req.type === 'init') {
    const loaded = await engine.initMaia();
    self.postMessage({
      type: 'status',
      id: req.id,
      modelLoaded: loaded,
    });
    return;
  }

  // A short pause before a played move feels natural; an evaluation is wanted at once
  const thinkingTime = thinkingDelayMs(req);
  if (thinkingTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, thinkingTime));
  }

  try {
    const response: EngineResponse = await engine.processRequest(req);
    self.postMessage(response);
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      id: req.id,
      bestMoveSan: '',
      bestMoveUci: '',
      candidateMoves: [],
      tierUsed: 'heuristic_fallback',
      error: err?.message || 'Engine computation error',
    });
  }
};
