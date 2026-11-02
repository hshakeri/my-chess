// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { db } from '../../../src/db/database';
import { MistakeSheet, mistakeItems } from '../../../src/views/MistakeSheet';
import type { StoredGame } from '../../../src/types/db';
import type { CriticalMoment, GameReview } from '../../../src/types/review';

const game = (id: string, day: number, color: 'white' | 'black'): StoredGame => ({
  id,
  source: 'upload',
  pgn: '',
  white: { name: color === 'white' ? 'hoot65' : 'Opp' + id },
  black: { name: color === 'black' ? 'hoot65' : 'Opp' + id },
  result: '0-1',
  timestamp: Date.UTC(2026, 9, day),
  movesSan: [],
  userColor: color,
});
const moment = (type: CriticalMoment['type'], keeping: string[]): CriticalMoment => ({
  ply: 6,
  label: '4.Nxe5',
  fenBefore: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  played: 'Nxe5',
  type,
  loss: 300,
  keeping,
  refutation: 'Qg5',
  squares: ['e5'],
  phase: 'opening',
});
const review = (gameId: string, color: 'white' | 'black', moments: CriticalMoment[]): GameReview => ({
  gameId,
  reviewedAt: 0,
  engine: 'maia',
  userColor: color,
  movesReviewed: 20,
  criticalMoments: moments,
  marks: [],
  cardIds: [],
});

describe('The sheet of mistakes from reviewed games (DC-4)', () => {
  beforeEach(async () => {
    await db.reviews.clear();
    await db.games.clear();
  });
  afterEach(() => cleanup());

  it('takes the mistakes with a move to find, newest game first, up to a sheet', () => {
    const games = [game('a', 1, 'white'), game('b', 9, 'black')];
    const reviews = [
      review('a', 'white', [moment('moved_piece_hangs', ['Nxd4']), moment('positional', [])]),
      review('b', 'black', [moment('failed_to_save', ['Nxd4', 'c3'])]),
      review('gone', 'white', [moment('missed_capture', ['Nxd4'])]),
    ];
    const items = mistakeItems(reviews, games);
    expect(items.map((i) => [i.gameId, i.opponent, i.flipped])).toEqual([
      ['b', 'Oppb', true],
      ['a', 'Oppa', false],
    ]);
    expect(mistakeItems(reviews, games, 1)).toHaveLength(1);
  });

  it('prints the positions with the move played and keeps every answer to the back', async () => {
    await db.games.put(game('a', 1, 'white'));
    await db.reviews.put(review('a', 'white', [moment('moved_piece_hangs', ['Nxd4', 'O-O'])]));
    const view = render(<MistakeSheet />);
    await waitFor(() => expect(view.container.querySelector('[data-section="mistake-sheet"]')?.getAttribute('data-items')).toBe('1'));
    const front = view.container.querySelector('[data-printable="mistake-front"]')!.textContent!;
    expect(front).toContain('You played 4.Nxe5');
    expect(front).not.toMatch(/Nxd4|O-O/);
    const back = view.container.querySelector('[data-mistake-answer="1"]')!.textContent!;
    expect(back).toContain('Better: 4.Nxd4, 4.O-O');
    expect(back).toContain('4...Qg5 punished it');
  });
});
