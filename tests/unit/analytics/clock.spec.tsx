// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { summarizeClock, timeLoser, finalLead } from '../../../src/analytics/clock';
import { ClockSummaryView } from '../../../src/views/ClockPanel';
import seed from '../../../src/data/seed_hoot65_games.json';
import type { StoredGame } from '../../../src/types/db';

const clk = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** A game of hoot65's with a [%clk] after every move: `spend(ply)` is the seconds that ply took. */
function game(id: string, opts: { color: 'white' | 'black'; sans: string[]; spend: (ply: number) => number; termination: string; result: StoredGame['userResult']; tc?: string; day?: number }): StoredGame {
  const [base, inc] = (opts.tc ?? '600').split('+').map(Number);
  const left = [base, base];
  const moves = opts.sans
    .map((san, ply) => {
      left[ply % 2] = left[ply % 2] - opts.spend(ply) + (inc || 0);
      const no = Math.floor(ply / 2) + 1;
      return `${ply % 2 === 0 ? `${no}.` : `${no}...`} ${san} {[%clk ${clk(left[ply % 2])}]}`;
    })
    .join(' ');
  const me = 'hoot65';
  const them = `opp-${id}`;
  return {
    id,
    source: 'chesscom',
    url: `https://www.chess.com/game/live/${id}`,
    pgn: `[TimeControl "${opts.tc ?? '600'}"]\n[Termination "${opts.termination.replace('ME', me).replace('THEM', them)}"]\n\n${moves}`,
    white: { name: opts.color === 'white' ? me : them },
    black: { name: opts.color === 'black' ? me : them },
    result: '*',
    timestamp: Date.UTC(2026, 9, opts.day ?? 1),
    movesSan: opts.sans,
    userColor: opts.color,
    userResult: opts.result,
  };
}

// Twenty moves each of knight shuffles: legal, and level material
const shuffle = Array.from({ length: 40 }, (_, ply) => ['Nf3', 'Nf6', 'Ng1', 'Ng8'][ply % 4]);
// 1.e4 Nf6 2.d3 Ng4 3.Qxg4: White wins a knight
const knightUp = ['e4', 'Nf6', 'd3', 'Ng4', 'Qxg4', 'd5', 'Qd1'];

describe('Your clock (DC-3)', () => {
  afterEach(() => cleanup());

  it('reads who lost on time from the Termination header, Chess.com and Lichess style', () => {
    const g = game('a', { color: 'white', sans: knightUp, spend: () => 5, termination: 'THEM won on time', result: 'loss' });
    expect(timeLoser(g)).toBe('me');
    expect(timeLoser({ ...g, pgn: g.pgn.replace('opp-a won on time', 'hoot65 won on time') })).toBe('them');
    expect(timeLoser({ ...g, pgn: g.pgn.replace('opp-a won on time', 'Time forfeit') })).toBe('me');
    expect(timeLoser({ ...g, pgn: g.pgn.replace('opp-a won on time', 'opp-a won by resignation') })).toBeNull();
    expect(finalLead(g)).toBe(3);
  });

  it('counts the games decided on time, the pace against the opponents and the long thinks', () => {
    const games = [
      // hoot65 White: 10 s a move, 40 s on move 12; the opponent 5 s a move; hoot65 flags
      game('s1', { color: 'white', sans: shuffle, spend: (ply) => (ply % 2 === 0 ? (ply === 22 ? 40 : 10) : 5), termination: 'THEM won on time', result: 'loss', day: 2 }),
      // hoot65 Black, the same pace; the opponent flags
      game('s2', { color: 'black', sans: shuffle, spend: (ply) => (ply % 2 === 1 ? 10 : 5), termination: 'ME won on time', result: 'win', day: 3 }),
      // hoot65 White, a knight up, loses on time
      game('k', { color: 'white', sans: knightUp, spend: () => 10, termination: 'THEM won on time', result: 'loss', day: 4 }),
      // Another time control, and a game with no clock times: left out
      game('blitz', { color: 'white', sans: knightUp, spend: () => 1, termination: 'THEM won on time', result: 'loss', tc: '180+2' }),
      { ...game('noclk', { color: 'white', sans: knightUp, spend: () => 1, termination: 'THEM won on time', result: 'loss' }), pgn: '[TimeControl "600"]\n\n1. e4 Nf6' },
    ];
    const s = summarizeClock(games)!;
    expect([s.label, s.games, s.lostOnTime, s.wonOnTime]).toEqual(['10+0', 3, 2, 1]);
    expect(s.lostAhead.map((g) => [g.gameId, g.lead, g.moves])).toEqual([['k', 3, 4]]);
    // After move 10: hoot65 has spent 100 s, the opponent 50 s (the short game did not get there)
    expect(s.pace[0]).toEqual({ move: 10, games: 2, mine: 500, theirs: 550 });
    // After move 20 hoot65 has also spent the 30 s more of the long think in game s1: the median of 370 and 400
    expect(s.pace[1]).toEqual({ move: 20, games: 2, mine: 385, theirs: 500 });
    expect(s.pace.map((r) => r.move)).toEqual([10, 20]);
    // The opponents' first ten moves: 5 s each in the two long games, 10 s each for Black's three in the short one
    expect(s.perMove.opening).toEqual({ mine: 10, theirs: (20 * 5 + 3 * 10) / 23 });
    expect(s.longThinks.mine).toBeCloseTo(1 / 3, 6);
    expect(s.longThinks.theirs).toBe(0);

    const view = render(<ClockSummaryView summary={s} />);
    const root = view.container.querySelector('[data-section="clock"]')!;
    expect(root.getAttribute('data-lost-on-time')).toBe('2');
    expect(root.querySelector('[data-pace-move="10"]')?.textContent).toContain('8:20');
    expect(root.querySelector('[data-lost-ahead="k"]')?.textContent).toContain('up 3 after 4 moves');
    expect(root.querySelector('[data-clock-row="long-thinks"]')?.textContent).toContain('0.3');
  });

  it('counts the increment from the first move, as Chess.com adds it', () => {
    const s = summarizeClock([game('i', { color: 'white', sans: shuffle, spend: () => 3, termination: 'ME won by resignation', result: 'win', tc: '180+2' })])!;
    expect(s.label).toBe('3+2');
    expect(s.perMove.opening).toEqual({ mine: 3, theirs: 3 });
    // 180 s, then 10 moves of 3 s each with 2 s back: 170 s left
    expect(s.pace[0]).toMatchObject({ move: 10, mine: 170, theirs: 170 });
  });

  it('on the seed games: hoot65 loses on time five times as often as the opponents, a fifth of it while ahead', () => {
    const s = summarizeClock(seed as StoredGame[])!;
    expect([s.label, s.games, s.lostOnTime, s.wonOnTime, s.lostAhead.length]).toEqual(['10+0', 300, 25, 5, 5]);
    // Behind the opponents' clock after every pace move
    for (const row of s.pace) expect(row.mine).toBeLessThan(row.theirs);
    expect(s.longThinks.mine).toBeGreaterThan(s.longThinks.theirs);
  });

  it('says so when no game has clock times', () => {
    const view = render(<ClockSummaryView summary={summarizeClock([])} />);
    expect(view.container.querySelector('[data-section="clock"]')?.getAttribute('data-games')).toBe('0');
  });
});
