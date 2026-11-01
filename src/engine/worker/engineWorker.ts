import { EngineRequest, EngineResponse } from '../../types/engine';
import { HybridEngine } from '../human/hybridEngine';
import { thinkingDelayMs } from './thinkingDelay';

const engine = new HybridEngine();

// Auto-initialize Maia in background
engine.initMaia().then((loaded) => {
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

self.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const req = event.data;
  if (!req) return;

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
