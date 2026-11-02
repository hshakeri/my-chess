// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { db } from '../../../src/db/database';
import { DatabaseView, ROWS_AT_ONCE } from '../../../src/views/DatabaseView';
import { filterGameList } from '../../../src/db/gamesRepo';
import type { StoredGame } from '../../../src/types/db';

const game = (k: number): StoredGame => ({
  id: `upload:${k}`,
  source: 'upload',
  pgn: '1. e4 e5 2. Nf3 Nc6 1-0',
  white: { name: 'hoot65', rating: 1150 },
  black: { name: k % 10 === 0 ? `Najdorf fan ${k}` : `opponent${k}`, rating: 1150 },
  result: '1-0',
  timestamp: Date.UTC(2026, 0, 1) + k * 60_000,
  movesSan: ['e4', 'e5', 'Nf3', 'Nc6'],
  userColor: 'white',
  userResult: 'win',
  timeClass: 'rapid',
});

describe('Games tab on a big archive', () => {
  beforeEach(async () => {
    await db.games.clear();
    await db.games.bulkPut(Array.from({ length: ROWS_AT_ONCE + 120 }, (_, k) => game(k)));
  });
  afterEach(() => cleanup());

  it('draws the first rows, newest first, and the rest on "Show more"; the filters search the whole archive', async () => {
    const { container } = render(<DatabaseView />);
    await waitFor(() => expect(container.querySelectorAll('tr.game-row').length).toBe(ROWS_AT_ONCE));
    // Newest first, as the archive is read
    expect(container.querySelector('tr.game-row')?.getAttribute('data-game-id')).toBe(`upload:${ROWS_AT_ONCE + 119}`);
    expect(container.querySelector('[data-stat="filtered-games"]')?.textContent).toBe(String(ROWS_AT_ONCE + 120));
    const more = container.querySelector('[data-action="more-games"]') as HTMLButtonElement;
    expect(more.textContent).toBe('Show 120 more (120 not shown)');
    fireEvent.click(more);
    await waitFor(() => expect(container.querySelectorAll('tr.game-row').length).toBe(ROWS_AT_ONCE + 120));
    expect(container.querySelector('[data-action="more-games"]')).toBeNull();

    // A search finds games beyond the drawn rows: one game in ten has "Najdorf" in the opponent's name
    fireEvent.change(container.querySelector('input[placeholder^="Search opponent"]')!, { target: { value: 'najdorf' } });
    await waitFor(() => expect(container.querySelectorAll('tr.game-row').length).toBe(62));
    expect(container.querySelector('[data-stat="filtered-games"]')?.textContent).toBe('62');
  });

  it('filters a list in memory exactly as the stored-games filter does', () => {
    const list = Array.from({ length: 30 }, (_, k) => ({ ...game(k), userColor: k % 2 ? 'black' : 'white', userResult: k % 3 ? 'loss' : 'win' }) as StoredGame);
    expect(filterGameList(list, { color: 'black' }).every((g) => g.userColor === 'black')).toBe(true);
    expect(filterGameList(list, { color: 'white', result: 'win' }).map((g) => g.id)).toEqual(list.filter((_, k) => k % 2 === 0 && k % 3 === 0).map((g) => g.id));
    expect(filterGameList(list, { search: '  NAJDORF ' }).length).toBe(3);
    expect(filterGameList(list, {})).toBe(list);
  });
});
