import { EngineRequest } from '../../types/engine';

/** The longest pause the worker makes before answering. */
export const MAX_THINKING_DELAY_MS = 3000;

/**
 * How long the engine worker pauses before answering. A short pause before a played move feels
 * natural; an evaluation is wanted at once. An explicit `thinkingTimeMs` wins, capped at 3 s.
 */
export function thinkingDelayMs(req: Pick<EngineRequest, 'type' | 'options'>): number {
  const requested = req.options?.thinkingTimeMs ?? (req.type === 'evaluate' ? 0 : 250);
  return Math.max(0, Math.min(requested, MAX_THINKING_DELAY_MS));
}
