import { describe, it, expect } from 'vitest';
import { habitsOfGame, summarizeHabits } from '../../../src/analytics/habits';
import type { StoredGame } from '../../../src/types/db';
import type { GameReview } from '../../../src/types/review';

const game = (id: string, moves: string, result: 'win' | 'loss' | 'draw', when: number, color: 'white' | 'black' = 'white'): StoredGame => ({
  id,
  source: 'upload',
  pgn: '',
  white: { name: color === 'white' ? 'hoot65' : 'x' },
  black: { name: color === 'black' ? 'hoot65' : 'x' },
  result: '*',
  timestamp: when,
  movesSan: moves.split(' '),
  userColor: color,
  userResult: result,
});

// Castles on move 4, all four minor pieces out by move 8, the queen never moves
const SOLID = game('solid', 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 Nc3 d6 d3 O-O Bg5 h6 Bh4 a6 a3 b5 Ba2 Be6', 'win', 2);
// 2.Qh5 before any minor piece; never castles
const QUEEN = game('queen', 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Ne2 Bg7 Nbc3 O-O d3 d6 Bg5 h6 Bh4 Be6 Bb3 a6', 'loss', 1);
// hoot65 with Black: castles on move 4; the b8 knight is still at home after ten moves
const BLACK = game('black', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7 f3 h6 Bh4 d6 e3 c5', 'draw', 3, 'black');

// 3.Qxg4 wins a knight; then the knights shuffle. In LOST the queen stays on g4 after 9...d6 and 10...Bxg4 takes it
const shuffle = (n: number) => Array.from({ length: n }, (_, k) => ['Nc3', 'Nb8', 'Nb1', 'Nc6'][k % 4]).join(' ');
const KEPT = game('kept', `e4 Nf6 d3 Ng4 Qxg4 Nc6 ${shuffle(36)}`, 'win', 4);
const LOST = game('lost', `e4 Nf6 d3 Ng4 Qxg4 Nc6 Nc3 Nb8 Nb1 Nc6 Nc3 Nb8 Nb1 Nc6 Nc3 Nb8 Nb1 d6 Nc3 Bxg4 ${'Nb1 Nd7 Nc3 Nb8 '.repeat(5).trim()}`, 'loss', 5);

describe('The habit scorecard (DC-8)', () => {
  it('reads the opening habits from the moves of each game', () => {
    expect(habitsOfGame(SOLID)?.habits).toEqual({ castled: true, developed: true, queen_home: true });
    expect(habitsOfGame(QUEEN)?.habits).toEqual({ castled: false, developed: true, queen_home: false });
    expect(habitsOfGame(BLACK)?.habits).toEqual({ castled: true, developed: false, queen_home: true });
    // Too short to judge
    expect(habitsOfGame(game('short', 'e4 e5 Nf3 Nc6', 'win', 0))).toBeNull();
  });

  it('counts each habit, the newest games, and the score with and without it; nothing-hung only for reviewed games', () => {
    const review: GameReview = {
      gameId: 'queen',
      reviewedAt: 0,
      engine: 'maia',
      userColor: 'white',
      movesReviewed: 10,
      criticalMoments: [{ ply: 12, label: '', fenBefore: '', played: '', type: 'moved_piece_hangs', loss: 300, keeping: [], squares: [], phase: 'opening' }],
      marks: [],
      cardIds: [],
    };
    const rows = Object.fromEntries(summarizeHabits([SOLID, QUEEN, BLACK], [review], 2).map((r) => [r.key, r]));
    expect([rows.castled.kept, rows.castled.games]).toEqual([2, 3]);
    expect(rows.castled.scoreWith).toBeCloseTo(0.75); // the win and the draw
    expect(rows.castled.scoreWithout).toBe(0);
    // The newest two games are BLACK (castled) and SOLID (castled)
    expect(rows.castled.recentRate).toBe(1);
    expect([rows.queen_home.kept, rows.queen_home.scoreWithout]).toEqual([2, 0]);
    expect([rows.developed.kept, rows.developed.games]).toEqual([2, 3]);
    expect([rows.nothing_hung.kept, rows.nothing_hung.games, rows.nothing_hung.scoreWith]).toEqual([0, 1, null]);
    // No game here had a lead of three points
    expect(rows.kept_lead.games).toBe(0);
  });

  it('judges the lead kept ten moves after hoot65 is three points up, only in games with such a lead', () => {
    expect(habitsOfGame(KEPT)?.habits.kept_lead).toBe(true);
    expect(habitsOfGame(LOST)?.habits.kept_lead).toBe(false);
    const rows = Object.fromEntries(summarizeHabits([SOLID, KEPT, LOST]).map((r) => [r.key, r]));
    expect([rows.kept_lead.games, rows.kept_lead.kept, rows.kept_lead.scoreWith, rows.kept_lead.scoreWithout]).toEqual([2, 1, 1, 0]);
  });
});
