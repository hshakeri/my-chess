import type { StoredCard } from '../types/db';

/**
 * Session queue for "Today's session" (CL-1). Pure functions over StoredCard
 * plus a tiny min-heap for in-session resurfacing of learning steps; nothing
 * here touches IndexedDB.
 */

export const DEFAULT_MAX_REVIEWS = 30;
export const DEFAULT_MAX_NEW = 8;
export const SESSION_STATE_KEY = 'my_chess_session_v2';

/** ts-fsrs State.New without importing the enum into a pure module. */
const STATE_NEW = 0;

export interface BuildQueueOptions {
  now: number;
  maxReviews?: number;
  maxNew?: number;
  retrievability: (card: StoredCard) => number;
}

/** The `family:*` tag of a card, or '' when it has none. */
export function familyOf(card: StoredCard): string {
  const tag = (card.tags || []).find((t) => t.startsWith('family:'));
  return tag ? tag.slice('family:'.length) : '';
}

/** Priority of a due card: `(1 - R) × (0.5 + reachProb)`, higher first. */
export function queuePriority(card: StoredCard, retrievability: number): number {
  const r = Number.isFinite(retrievability) ? Math.min(1, Math.max(0, retrievability)) : 0;
  const reach = Number.isFinite(card.reachProb) ? Math.min(1, Math.max(0, card.reachProb)) : 1;
  return (1 - r) * (0.5 + reach);
}

interface Ranked {
  card: StoredCard;
  priority: number;
}

function rank(cards: StoredCard[], opts: BuildQueueOptions): Ranked[] {
  return cards
    .map((card) => ({ card, priority: queuePriority(card, opts.retrievability(card)) }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.card.due !== b.card.due) return a.card.due - b.card.due;
      return a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0;
    });
}

/**
 * Round-robin across families. Families are visited in the order of their
 * most urgent card; each round takes one card from every family that still
 * has cards. Two consecutive cards share a family only once a single family
 * is left, which is the unavoidable tail.
 */
export function interleaveByFamily(ranked: StoredCard[], priorityOf: (c: StoredCard) => number): StoredCard[] {
  const families: string[] = [];
  const buckets = new Map<string, StoredCard[]>();
  const sorted = [...ranked].sort((a, b) => priorityOf(b) - priorityOf(a));
  for (const card of sorted) {
    const fam = familyOf(card);
    if (!buckets.has(fam)) {
      buckets.set(fam, []);
      families.push(fam);
    }
    buckets.get(fam)!.push(card);
  }

  const out: StoredCard[] = [];
  let remaining = sorted.length;
  while (remaining > 0) {
    for (const fam of families) {
      const bucket = buckets.get(fam)!;
      const next = bucket.shift();
      if (next) {
        out.push(next);
        remaining--;
      }
    }
  }
  return out;
}

/**
 * Build today's queue: due cards ranked by `(1 - R) × (0.5 + reachProb)`,
 * capped at `maxReviews` non-New cards and `maxNew` New cards, then
 * interleaved so consecutive cards come from different families.
 */
export function buildQueue(cards: StoredCard[], opts: BuildQueueOptions): StoredCard[] {
  const maxReviews = Math.max(0, opts.maxReviews ?? DEFAULT_MAX_REVIEWS);
  const maxNew = Math.max(0, opts.maxNew ?? DEFAULT_MAX_NEW);

  const due = cards.filter((c) => typeof c.due === 'number' && c.due <= opts.now);
  const fresh = due.filter((c) => c.state === STATE_NEW);
  const seasoned = due.filter((c) => c.state !== STATE_NEW);

  const rankedReviews = rank(seasoned, opts).slice(0, maxReviews);
  const rankedNew = rank(fresh, opts).slice(0, maxNew);

  const priorities = new Map<string, number>();
  for (const r of [...rankedReviews, ...rankedNew]) priorities.set(r.card.id, r.priority);
  const priorityOf = (c: StoredCard) => priorities.get(c.id) ?? 0;

  // Overdue reviews always come before new material: a New card has retrievability 0 and would
  // otherwise outrank every review that is days late.
  return [
    ...interleaveByFamily(rankedReviews.map((r) => r.card), priorityOf),
    ...interleaveByFamily(rankedNew.map((r) => r.card), priorityOf),
  ];
}

export interface LearningStepEntry {
  cardId: string;
  dueAt: number;
}

interface HeapNode extends LearningStepEntry {
  seq: number;
}

/**
 * Min-heap of in-session learning-step due times. A failed card is pushed
 * with its next step time and resurfaces through `popDue(now)` once that time
 * has passed. Pushing a card that is already queued replaces its entry.
 */
export class LearningSteps {
  private heap: HeapNode[] = [];
  private seq = 0;

  constructor(entries?: LearningStepEntry[]) {
    if (entries) {
      for (const e of entries) this.push(e.cardId, e.dueAt);
    }
  }

  get size(): number {
    return this.heap.length;
  }

  has(cardId: string): boolean {
    return this.heap.some((n) => n.cardId === cardId);
  }

  push(cardId: string, dueAt: number): void {
    if (this.has(cardId)) this.remove(cardId);
    this.heap.push({ cardId, dueAt, seq: this.seq++ });
    this.siftUp(this.heap.length - 1);
  }

  /** Earliest entry without removing it, or null when empty. */
  peek(): LearningStepEntry | null {
    const top = this.heap[0];
    return top ? { cardId: top.cardId, dueAt: top.dueAt } : null;
  }

  /** The earliest card whose step time has passed, removed from the heap. */
  popDue(now: number): string | null {
    const top = this.heap[0];
    if (!top || top.dueAt > now) return null;
    this.popTop();
    return top.cardId;
  }

  remove(cardId: string): boolean {
    const idx = this.heap.findIndex((n) => n.cardId === cardId);
    if (idx === -1) return false;
    const last = this.heap.pop()!;
    if (idx < this.heap.length) {
      this.heap[idx] = last;
      this.siftDown(idx);
      this.siftUp(idx);
    }
    return true;
  }

  clear(): void {
    this.heap = [];
  }

  /** Entries in due order (for persistence). */
  toJSON(): LearningStepEntry[] {
    return [...this.heap]
      .sort((a, b) => a.dueAt - b.dueAt || a.seq - b.seq)
      .map((n) => ({ cardId: n.cardId, dueAt: n.dueAt }));
  }

  private less(a: HeapNode, b: HeapNode): boolean {
    return a.dueAt < b.dueAt || (a.dueAt === b.dueAt && a.seq < b.seq);
  }

  private popTop(): void {
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.heap[i], this.heap[parent])) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n && this.less(this.heap[l], this.heap[m])) m = l;
      if (r < n && this.less(this.heap[r], this.heap[m])) m = r;
      if (m === i) break;
      [this.heap[i], this.heap[m]] = [this.heap[m], this.heap[i]];
      i = m;
    }
  }
}

/** Resumable state of one "Today's session" run. */
export interface SessionState {
  sessionId: string;
  startedAt: number;
  queueIds: string[];
  cursor: number;
  learning: LearningStepEntry[];
  completed: string[];
}

function sessionStorageOrNull(): Storage | null {
  try {
    const candidate = (globalThis as Record<string, unknown>).sessionStorage as Storage | undefined;
    if (candidate && typeof candidate.getItem === 'function') return candidate;
  } catch {
    // sessionStorage can throw in sandboxed frames or private mode.
  }
  return null;
}

/** Persist the session to sessionStorage; a no-op where it is unavailable. */
export function saveSessionState(state: SessionState): boolean {
  const storage = sessionStorageOrNull();
  if (!storage) return false;
  try {
    storage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Read the saved session; null when absent, unavailable or malformed. */
export function loadSessionState(): SessionState | null {
  const storage = sessionStorageOrNull();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (
      !parsed ||
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.startedAt !== 'number' ||
      !Array.isArray(parsed.queueIds) ||
      typeof parsed.cursor !== 'number'
    ) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      startedAt: parsed.startedAt,
      queueIds: parsed.queueIds.filter((id): id is string => typeof id === 'string'),
      cursor: parsed.cursor,
      learning: Array.isArray(parsed.learning)
        ? parsed.learning.filter(
            (e): e is LearningStepEntry =>
              !!e && typeof e.cardId === 'string' && typeof e.dueAt === 'number'
          )
        : [],
      completed: Array.isArray(parsed.completed)
        ? parsed.completed.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

/** Remove the saved session; a no-op where sessionStorage is unavailable. */
export function clearSessionState(): void {
  const storage = sessionStorageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(SESSION_STATE_KEY);
  } catch {
    // Ignore
  }
}
