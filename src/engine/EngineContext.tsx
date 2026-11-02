import { createContext, useContext } from 'react';
import type { EngineClient } from './worker/engineClient';

/**
 * The app's one engine worker, shared by every tab (CL-6), so the Maia model is loaded once: the Play
 * tab and its spars, and the game review in the database. Null until the app has started it.
 */
export const EngineContext = createContext<EngineClient | null>(null);

export function useEngineClient(): EngineClient | null {
  return useContext(EngineContext);
}
