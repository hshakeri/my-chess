// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { endOf, mateInOneComing, summarizeEndings } from '../../../src/analytics/endings';
import { EndingsView } from '../../../src/views/ClockPanel';
import seed from '../../../src/data/seed_hoot65_games.json';
import type { SparRequest } from '../../../src/services/sparLog';
import type { StoredGame } from '../../../src/types/db';

function game(id: string, opts: { color: 'white' | 'black'; sans: string[]; termination?: string; result: StoredGame['userResult']; day?: number }): StoredGame {
  const them = `opp-${id}`;
  return {
    id,
    source: 'chesscom',
    url: `https://www.chess.com/game/live/${id}`,
    pgn: opts.termination === undefined ? '' : `[Termination "${opts.termination.replace('ME', 'hoot65').replace('THEM', them)}"]\n\n`,
    white: { name: opts.color === 'white' ? 'hoot65' : them, rating: 1150 },
    black: { name: opts.color === 'black' ? 'hoot65' : them, rating: 1150 },
    result: '*',
    timestamp: Date.UTC(2026, 9, opts.day ?? 1),
    movesSan: opts.sans,
    userColor: opts.color,
    userResult: opts.result,
  };
}

// 1.e4 Nf6 2.d3 Ng4 3.Qxg4: Black is a knight down
const knightDown = ['e4', 'Nf6', 'd3', 'Ng4', 'Qxg4'];
// 1.a4 e5 2.Ra3 Bxa3: White is a rook down
const rookDown = ['a4', 'e5', 'Ra3', 'Bxa3'];
// Sam Loyd's ten-move stalemate: White, far ahead, leaves Black no legal move
const loyd = ['e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 'Qxc7', 'f6', 'Qxd7+', 'Kf7', 'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 'Qxc8', 'Kg6', 'Qe6'];

describe('How the games end (DC-3, DC-8)', () => {
  afterEach(() => cleanup());

  it('reads the way a game ended from the Termination header, else from the final position', () => {
    const g = (termination: string | undefined, result: StoredGame['userResult'], sans = knightDown) => endOf(game('x', { color: 'black', sans, termination, result }));
    expect(g('THEM won by resignation', 'loss')).toEqual({ result: 'loss', kind: 'resignation' });
    expect(g('ME won by checkmate', 'win')).toEqual({ result: 'win', kind: 'checkmate' });
    expect(g('THEM won on time', 'loss')).toEqual({ result: 'loss', kind: 'time' });
    expect(g('ME won - game abandoned', 'win')).toEqual({ result: 'win', kind: 'abandoned' });
    expect(g('Game drawn by timeout vs insufficient material', 'draw')).toEqual({ result: 'draw', kind: 'insufficient' });
    expect(g('Game drawn by repetition', 'draw')).toEqual({ result: 'draw', kind: 'repetition' });
    expect(g('Game drawn by agreement', 'draw')).toEqual({ result: 'draw', kind: 'agreement' });
    // Lichess writes "Normal" for a resignation and a mate alike
    expect(g('Normal', 'loss')).toEqual({ result: 'loss', kind: 'resignation' });
    expect(g('Normal', 'loss', ['f3', 'e5', 'g4', 'Qh4#'])).toEqual({ result: 'loss', kind: 'checkmate' });
    expect(g(undefined, 'draw', loyd)).toEqual({ result: 'draw', kind: 'stalemate' });
    expect(endOf({ ...game('y', { color: 'white', sans: [], result: '*' }) })).toBeNull();
  });

  it('lists the games resigned with less than a rook down and the stalemates given while ahead', () => {
    const games = [
      game('kn', { color: 'black', sans: knightDown, termination: 'THEM won by resignation', result: 'loss', day: 3 }),
      game('rk', { color: 'white', sans: rookDown, termination: 'THEM won by resignation', result: 'loss', day: 2 }),
      game('sm', { color: 'white', sans: loyd, termination: 'Game drawn by stalemate', result: 'draw', day: 1 }),
      game('w', { color: 'white', sans: ['f3', 'e5', 'g4', 'Qh4#'], termination: 'THEM won by checkmate', result: 'loss' }),
    ];
    const s = summarizeEndings(games);
    expect([s.games, s.resigned]).toEqual([4, 2]);
    expect(s.resignedEarly.map((e) => [e.game.id, e.lead, e.moves])).toEqual([['kn', -3, 2]]);
    expect(s.stalematedAhead.map((e) => e.game.id)).toEqual(['sm']);
    // Four pawns, a knight and a bishop up
    expect(s.stalematedAhead[0].lead).toBe(10);
    expect(s.rows.map((r) => `${r.result}-${r.kind}-${r.count}`)).toEqual(['loss-resignation-2', 'loss-checkmate-1', 'draw-stalemate-1']);

    const requests: SparRequest[] = [];
    const view = render(<EndingsView summary={s} onSpar={(r) => requests.push(r)} />);
    expect(view.container.querySelector('[data-resigned-early="kn"]')?.textContent).toContain('down 3 after 2 moves');
    fireEvent.click(view.container.querySelector('[data-resigned-early="kn"] [data-action="ending-spar"]')!);
    expect(requests[0]).toMatchObject({ lessonId: 'review:kn', movesSan: knightDown, studentColor: 'b', elo: 1100 });
    expect(view.container.querySelector('[data-stalemated-ahead="sm"]')).not.toBeNull();
  });

  it('leaves out a resignation with mate in one coming', () => {
    // 1.f3 e5 2.g4, and White resigns: Black, to move, mates with 2...Qh4#
    const whiteResigns = game('fm', { color: 'white', sans: ['f3', 'e5', 'g4'], termination: 'THEM won by resignation', result: 'loss' });
    expect(mateInOneComing(whiteResigns)).toBe(true);
    expect(summarizeEndings([whiteResigns]).resignedEarly).toHaveLength(0);
    // After 1.f3 e5, White to move has plenty of moves that allow no mate in one (only 2.g4?? does)
    expect(mateInOneComing(game('f', { color: 'white', sans: ['f3', 'e5'], result: 'loss' }))).toBe(false);
  });

  it('on the seed games: 89 resignations, 38 of them with less than a rook down and no mate in one coming', () => {
    const s = summarizeEndings(seed as StoredGame[]);
    // 42 with less than a rook down; Stockfish 19 finds mate in one in exactly four of them, and those are left out
    expect([s.games, s.resigned, s.resignedEarly.length]).toEqual([301, 89, 38]);
    expect(s.resignedEarly.filter((e) => e.lead >= 0)).toHaveLength(3);
    const count = (key: string) => s.rows.find((r) => `${r.result}-${r.kind}` === key)?.count;
    expect([count('win-checkmate'), count('win-resignation'), count('win-time'), count('loss-checkmate'), count('loss-time')]).toEqual([54, 79, 5, 30, 26]);
    expect(s.stalematedAhead).toHaveLength(0);
  });
});
