// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Chess } from 'chess.js';

// Mastered: the Alapin (L2, which shares one position only with the pattern-library Adams Attack, L26), the
// Evans (L9, which shares positions with the Blackburne-Shilling drill, L15), and two positions of the first
// drill set (G1, G4)
vi.mock('../../../src/data/mastered.json', () => ({
  default: { L2: '2026-11-02', L9: '2026-11-02', G1: '2026-11-02', G4: '2026-11-02' },
}));

import { allCurriculumLessons } from '../../../src/curriculum';
import { enumerateDecisions } from '../../../src/curriculum/builder';
import { missedThreatLessons } from '../../../src/curriculum/gameDrills';
import { isCardMastered, lessonCode } from '../../../src/curriculum/itemCodes';
import { CardService } from '../../../src/services/cards';
import { db } from '../../../src/db/database';
import { LessonsView } from '../../../src/views/LessonsView';
import { PointsCard } from '../../../src/views/PointsCard';
import { UNSAFE_DRILLS } from '../../../src/views/WarmupPanel';

const L2 = 'lesson-alapin-sicilian-centre';
const L26 = 'lesson-adams-attack-sicilian';
const L9 = 'lesson-evans-gambit-destruction';
const L15 = 'lesson-blackburne-shilling-drill';
const byId = new Map(allCurriculumLessons.map((l) => [l.id, l]));

async function makeCards() {
  const specs: Record<string, ReturnType<typeof enumerateDecisions>> = {};
  for (const l of allCurriculumLessons) specs[l.id] = enumerateDecisions(l);
  await CardService.migrateLegacy(specs);
  await CardService.ensureCards(Object.values(specs).flat());
}

/** Leaves one card due, as a new card or a review, and puts every other card ten days out. */
async function onlyDue(pick: (ids: string[]) => boolean, review: boolean) {
  const now = Date.now();
  const target = (await CardService.getAllCards()).find((c) => pick(c.lessonIds));
  expect(target, 'target card').toBeDefined();
  await db.cards.toCollection().modify((c) => {
    if (c.id === target!.id) {
      if (review) {
        c.reps = 1;
        c.state = 2;
        c.due = now - 60_000;
        c.stability = 5;
        c.last_review = now - 5 * 86_400_000;
      }
    } else {
      c.due = now + 10 * 86_400_000;
    }
  });
  return target!;
}

describe('Mastered lessons own no cards, and mastered positions leave the drill counts, links and warm-up', () => {
  beforeEach(async () => {
    await CardService.resetAll();
    localStorage.clear();
    localStorage.setItem('my_chess_cct_gate', 'off');
  });
  afterEach(() => cleanup());

  it('a new card shared by a mastered core lesson and a pattern-library lesson is not due', async () => {
    await makeCards();
    const card = await onlyDue((ids) => ids.length === 2 && ids.includes(L2) && ids.includes(L26), false);
    expect(isCardMastered(card)).toBe(false);
    const { container: c } = render(<LessonsView />);
    await waitFor(() => expect(c.querySelector('[data-due-count]')).not.toBeNull());
    await new Promise((r) => setTimeout(r, 800));
    expect(c.querySelector('[data-due-count]')!.getAttribute('data-due-count')).toBe('0');
    // Building every lesson's cards and the view takes a few seconds, more on a busy machine
  }, 30_000);

  it('a due card shared by a mastered lesson and another is reviewed from the lesson not mastered', async () => {
    await makeCards();
    const card = await onlyDue((ids) => ids.length === 2 && ids.includes(L9) && ids.includes(L15), true);
    const { container: c } = render(<LessonsView />);
    await waitFor(() => expect(c.querySelector('[data-due-count="1"]')).not.toBeNull(), { timeout: 5000 });
    fireEvent.click(c.querySelector('[data-action="review-due"]')!);
    await waitFor(() => expect(c.querySelector('[data-session]')).not.toBeNull());
    await new Promise((r) => setTimeout(r, 2500));
    const square = (s: string) => c.querySelector(`[data-square="${s}"]`) as HTMLElement;
    const m = new Chess(card.fen).move(card.accepted[0]);
    fireEvent.click(square(m.from));
    fireEvent.click(square(m.to));
    await waitFor(() => expect(c.querySelector('[data-section="session-card"]')).not.toBeNull(), { timeout: 5000 });
    const text = c.querySelector('[data-section="session-card"]')!.textContent ?? '';
    expect(text).toContain(byId.get(L15)!.title);
    expect(text).not.toContain(byId.get(L9)!.title);
  }, 30_000);

  it('a finished drill position counts only the positions not mastered', async () => {
    const G5 = missedThreatLessons[4];
    expect(lessonCode(G5.id)).toBe('G5');
    const { container: c } = render(<LessonsView initialLessonId={G5.id} />);
    await waitFor(() => expect(c.querySelector(`[data-lesson-id="${G5.id}"]`)?.textContent).toBe('3'));
    await new Promise((r) => setTimeout(r, 1200));
    const chess = new Chess(G5.initialFen);
    chess.move(G5.moves[0].san);
    const m = chess.move(G5.moves[1].san);
    const square = (s: string) => c.querySelector(`[data-square="${s}"]`) as HTMLElement;
    fireEvent.click(square(m.from));
    fireEvent.click(square(m.to));
    await waitFor(() => expect(c.querySelector('[data-section="drill-next"]')).not.toBeNull(), { timeout: 5000 });
    expect(c.querySelector('[data-section="drill-next"]')!.textContent).toContain(`Position 3 of ${missedThreatLessons.length - 2}`);
  }, 30_000);

  it('the points card drills the first position not mastered, and the warm-up leaves mastered positions out', () => {
    const { container: c } = render(<PointsCard />);
    const href = (c.querySelector('[data-points-train="threat"]') as HTMLAnchorElement).getAttribute('href')!;
    expect(lessonCode(href.replace('#/lesson/', ''))).toBe('G2');
    const ids = UNSAFE_DRILLS.map((d) => `lesson-game-${d.id}`);
    expect(ids).not.toContain(missedThreatLessons[0].id);
    expect(ids).not.toContain(missedThreatLessons[3].id);
    expect(ids).toContain(missedThreatLessons[1].id);
  });
});
