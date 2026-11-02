/**
 * What the app keeps in this browser's localStorage rather than in IndexedDB, carried in the JSON
 * backup so a restore on another browser brings it along: the adopted plans, the board-question
 * setting and answers (CL-5) and the Play tab's two switches, the spar log (CL-6), the idea cards (CL-7) and the speed runs. The
 * in-progress session and the migration flags are left out. Only these keys are ever written back.
 */
export const BACKED_UP_KEYS = [
  'my_chess_adopted_repertoires_v1',
  'my_chess_cct_gate',
  'my_chess_cct_log_v1',
  'my_chess_idea_cards_v1',
  'my_chess_play_gate',
  'my_chess_play_safety',
  'my_chess_spar_log_v1',
  'my_chess_speedrun_v1',
  'my_chess_tactics_v1',
  'my_chess_tactics_log_v1',
] as const;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The backed-up keys this browser has, as stored. */
export function readLocalData(): Record<string, string> {
  const ls = storage();
  const out: Record<string, string> = {};
  if (!ls) return out;
  for (const key of BACKED_UP_KEYS) {
    const value = ls.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

/** Restore the backed-up keys this browser does not have yet (what is here is newer); returns the keys restored. */
export function restoreLocalData(data: Record<string, unknown> | undefined): string[] {
  const ls = storage();
  if (!ls || !data || typeof data !== 'object') return [];
  const restored: string[] = [];
  for (const key of BACKED_UP_KEYS) {
    const value = data[key];
    if (typeof value !== 'string' || ls.getItem(key) !== null) continue;
    try {
      ls.setItem(key, value);
      restored.push(key);
    } catch {
      // storage full or blocked: skip
    }
  }
  return restored;
}
