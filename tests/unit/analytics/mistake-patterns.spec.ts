import { describe, it, expect } from 'vitest';
import { clockBucket, per100, summarizeReviews } from '../../../src/analytics/mistakePatterns';
import { batchQueue } from '../../../src/views/MistakePatternsPanel';
import type { StoredGame } from '../../../src/types/db';
import type { CriticalMoment, GameReview } from '../../../src/types/review';

/** A game of `plies` moves (knight shuffles, legality does not matter here) with a clock for every move. */
function game(id: string, plies: number, when: string, opts: { color?: 'white' | 'black'; clocks?: number[]; base?: number } = {}): StoredGame {
  const moves = Array.from({ length: plies }, (_, i) => (i % 4 < 2 ? 'Nf3' : 'Ng1'));
  const clocks = opts.clocks ?? [];
  const pgn = [
    opts.base ? `[TimeControl "${opts.base}"]` : '',
    moves.map((m, i) => `${m}${clocks[i] !== undefined ? ` {[%clk 0:${String(Math.floor(clocks[i] / 60)).padStart(2, '0')}:${String(clocks[i] % 60).padStart(2, '0')}]}` : ''}`).join(' '),
  ].join('\n');
  return {
    id,
    source: 'chesscom',
    pgn,
    white: { name: 'a' },
    black: { name: 'b' },
    result: '0-1',
    timestamp: Date.parse(when),
    movesSan: moves,
    userColor: opts.color ?? 'white',
  };
}

const moment = (ply: number, type: CriticalMoment['type']): CriticalMoment => ({
  ply,
  label: '',
  fenBefore: '',
  played: '',
  type,
  loss: 300,
  keeping: [],
  squares: [],
  phase: 'opening',
});

const review = (gameId: string, moments: CriticalMoment[], engine: GameReview['engine'] = 'maia'): GameReview => ({
  gameId,
  reviewedAt: 0,
  engine,
  userColor: 'white',
  movesReviewed: 0,
  criticalMoments: moments,
  marks: [],
  cardIds: [],
});

describe('Mistake patterns (CL-3): mistakes per 100 moves by kind, phase, clock and month', () => {
  it('rounds the rate to one decimal and buckets the clock by the share of the base time', () => {
    expect(per100(3, 40)).toBe(7.5);
    expect(per100(1, 3)).toBe(33.3);
    expect(per100(2, 0)).toBe(0);
    expect(clockBucket(400, 600)).toBe('over_half');
    expect(clockBucket(300, 600)).toBe('quarter_to_half');
    expect(clockBucket(100, 600)).toBe('tenth_to_quarter');
    expect(clockBucket(60, 600)).toBe('under_tenth');
  });

  it('counts the student moves of each game as the denominators, by phase and by clock', () => {
    // Game 1: 70 plies, White; clocks fall 6 seconds a move from 600, so White's later moves are short of time
    const clocks = Array.from({ length: 70 }, (_, i) => 600 - 6 * (Math.floor(i / 2) + 1));
    const g1 = game('g1', 70, '2026-09-10T12:00:00Z', { clocks, base: 600 });
    // Game 2: 30 plies, Black, no clock
    const g2 = game('g2', 30, '2026-10-05T12:00:00Z', { color: 'black' });
    const reviews = [
      review('g1', [moment(4, 'moved_piece_hangs'), moment(40, 'failed_to_save'), moment(66, 'moved_piece_hangs')]),
      { ...review('g2', [moment(21, 'allowed_mate')], 'material'), userColor: 'black' as const },
      review('gone', [moment(2, 'missed_capture')]), // its game was deleted: left out
    ];
    const s = summarizeReviews(reviews, [g1, g2]);
    expect([s.games, s.maiaGames, s.moves, s.mistakes]).toEqual([2, 1, 35 + 15, 4]);
    expect(s.per100).toBe(8);
    expect(s.byType.map((r) => [r.type, r.mistakes])).toEqual([
      ['moved_piece_hangs', 2],
      ['failed_to_save', 1],
      ['allowed_mate', 1],
    ]);
    expect(s.byType[0].per100).toBe(4);
    // Phases: plies 0-19 opening, 20-59 middlegame, 60 on endgame. g1 (White, even plies): 10 / 20 / 5;
    // g2 (Black, odd plies 1-29): 10 / 5 / 0
    expect(s.byPhase.map((r) => [r.key, r.moves, r.mistakes])).toEqual([
      ['opening', 20, 1],
      ['middlegame', 25, 2],
      ['endgame', 5, 1],
    ]);
    // Clock before White's move k (k = 0, 1, ...) is 600 for the first, then 600 - 6k: under a tenth (60 s)
    // from k = 90 on, never here; a quarter (150 s) from k = 75; half (300 s) from k = 50
    expect(s.clockGames).toBe(1);
    const moves = Object.fromEntries(s.byClock.map((r) => [r.key, r.moves]));
    expect(moves).toEqual({ over_half: 35, quarter_to_half: 0, tenth_to_quarter: 0, under_tenth: 0 });
    expect(s.byMonth.map((r) => [r.month, r.games, r.moves, r.mistakes])).toEqual([
      ['2026-09', 1, 35, 3],
      ['2026-10', 1, 15, 1],
    ]);
  });

  it('puts the moves of a long game into the clock buckets it reached', () => {
    // 280 plies, 2 seconds per own move from a 300-second base: White's clock before move k is 300 - 2k
    const clocks = Array.from({ length: 280 }, (_, i) => 300 - 2 * (Math.floor(i / 2) + 1));
    const g = game('long', 280, '2026-08-01T00:00:00Z', { clocks, base: 300 });
    const s = summarizeReviews([review('long', [moment(2 * 137, 'tactical_other')])], [g]);
    const rows = Object.fromEntries(s.byClock.map((r) => [r.key, [r.moves, r.mistakes]]));
    // Over half while 300 - 2k > 150 (k = 0-74), a quarter to half to k = 112, a tenth to a quarter to
    // k = 134, then under a tenth (k = 135-139, where the mistake at k = 137 falls)
    expect(rows).toEqual({ over_half: [75, 0], quarter_to_half: [38, 0], tenth_to_quarter: [22, 0], under_tenth: [5, 1] });
  });

  it('a batch takes the student\'s newest unreviewed games of ten plies or more', () => {
    const games = [
      game('old', 40, '2026-01-01T00:00:00Z'),
      game('new', 40, '2026-10-01T00:00:00Z'),
      game('short', 8, '2026-10-02T00:00:00Z'),
      game('done', 40, '2026-10-03T00:00:00Z'),
      { ...game('other', 40, '2026-10-04T00:00:00Z'), userColor: undefined },
    ];
    expect(batchQueue(games, new Set(['done']), 10).map((g) => g.id)).toEqual(['new', 'old']);
    expect(batchQueue(games, new Set(['done']), 1).map((g) => g.id)).toEqual(['new']);
  });
});
