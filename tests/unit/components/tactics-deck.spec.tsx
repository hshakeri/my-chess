// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Chess } from 'chess.js';
import { TacticsDeckPanel } from '../../../src/views/TacticsDeckPanel';
import { TacticsSheet } from '../../../src/views/TacticsSheet';
import { TacticsProgressLine } from '../../../src/views/ProgressPanel';
import {
  TACTICS_STORAGE_KEY,
  gradeSolve,
  interleave,
  isRetired,
  numberLine,
  pickSession,
  readTacticSessions,
  readTacticStates,
  recordSolve,
  tacticsDeck,
  tacticsProgress,
  toRedo,
  type TacticPosition,
} from '../../../src/services/tacticsDeck';

const V: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const sq = (s: string) => document.querySelector(`[data-square="${s}"]`) as HTMLElement;
function play(fen: string, san: string) {
  const m = new Chess(fen).move(san);
  fireEvent.click(sq(m.from));
  fireEvent.click(sq(m.to));
}

const tactic = (id: string, motif: TacticPosition['motif'], extra: Partial<TacticPosition> = {}): TacticPosition => ({
  id,
  // Black has just played ...Kg8; Rd8 is mate on the back rank
  fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 30',
  lastMove: { from: 'h8', to: 'g8', san: 'Kg8' },
  solution: 'Rd8#',
  accepted: ['Rd8#'],
  line: ['Rd8#'],
  motif,
  mateIn: motif === 'mate-in-one' ? 1 : null,
  date: '2026-10-01',
  ownSide: true,
  played: 'h3',
  ...extra,
});

describe('Tactics deck (DC-2)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('grades by the time to the right move, and retires a position after three Good solves in a row', () => {
    expect([gradeSolve(true, 4_999), gradeSolve(true, 5_000), gradeSolve(true, 20_000), gradeSolve(true, 20_001), gradeSolve(false, 1_000)]).toEqual([
      'good',
      'hard',
      'hard',
      'again',
      'again',
    ]);
    let s = recordSolve({}, 'a', true, 3_000, 1);
    s = recordSolve(s, 'a', true, 2_000, 2);
    expect([s.a.streak, s.a.bestMs, isRetired(s.a)]).toEqual([2, 2_000, false]);
    s = recordSolve(s, 'a', true, 9_000, 3);
    expect([s.a.streak, s.a.grade]).toEqual([0, 'hard']);
    for (let k = 0; k < 3; k++) s = recordSolve(s, 'a', true, 1_000, 4 + k);
    expect([s.a.tries, isRetired(s.a)]).toEqual([6, true]);
    expect(readTacticStates()).toEqual(s);
    expect(JSON.parse(window.localStorage.getItem(TACTICS_STORAGE_KEY)!).a.streak).toBe(3);
  });

  it('takes Again first, then Hard, then new ones, then Good, never a retired one, and mixes the motifs', () => {
    const deck = [tactic('n1', 'fork'), tactic('n2', 'fork'), tactic('g', 'mate'), tactic('h', 'fork'), tactic('a', 'free-piece'), tactic('r', 'mate')];
    const states = {
      g: { tries: 1, streak: 1, grade: 'good' as const, at: 5 },
      h: { tries: 1, streak: 0, grade: 'hard' as const, at: 4 },
      a: { tries: 2, streak: 0, grade: 'again' as const, at: 9 },
      r: { tries: 3, streak: 3, grade: 'good' as const, at: 1 },
    };
    expect(pickSession(deck, states, 10).map((t) => t.id)).toEqual(['a', 'h', 'g', 'n1', 'n2']);
    expect(pickSession(deck, states, 2).map((t) => t.id)).toEqual(['a', 'h']);
    // The button counts the Again and Hard ones
    expect(toRedo(deck, states)).toBe(2);
    expect(interleave([tactic('1', 'fork'), tactic('2', 'fork'), tactic('3', 'mate')]).map((t) => t.id)).toEqual(['1', '3', '2']);
    expect(numberLine('8/8/8/8/8/8/8/8 b - - 0 27', ['Rxd8', 'Bc2', 'Qb6'])).toBe('27...Rxd8 28.Bc2 Qb6');
    expect(numberLine('8/8/8/8/8/8/8/8 w - - 0 30', ['Rd8#'])).toBe('30.Rd8#');
  });

  it('runs a session: the right move graded, a wrong one shown the answer, and the summary at the end', () => {
    const deck = [tactic('one', 'mate-in-one'), tactic('two', 'mate-in-one', { ownSide: false, played: 'Rd8#' })];
    const view = render(<TacticsDeckPanel deck={deck} onClose={() => undefined} />);
    const modal = () => view.container.querySelector('[data-modal="tactics"]')!;
    fireEvent.click(view.container.querySelector('[data-action="tactics-start"]')!);
    expect(modal().getAttribute('data-tactics-phase')).toBe('solving');
    expect(view.container.textContent).toContain('White to play, after Kg8: find the winning move.');
    play(deck[0].fen, 'Rd8#');
    const first = view.container.querySelector('[data-tactic-result]')!;
    expect(first.getAttribute('data-correct')).toBe('true');
    expect(first.textContent).toContain('Mate in one. Stockfish\'s line: 30.Rd8#');
    expect(first.textContent).toContain('In the game you played h3.');
    fireEvent.click(view.container.querySelector('[data-action="tactics-next"]')!);
    // A wrong move: Again, and the answer on the board
    play(deck[1].fen, 'h3');
    const second = view.container.querySelector('[data-tactic-result]')!;
    expect(second.getAttribute('data-tactic-result')).toBe('again');
    expect(second.textContent).toContain('h3 does not win. The move is Rd8#.');
    expect(second.textContent).toContain('Your opponent found it.');
    expect(sq('d8').querySelector('img[alt="White r"]')).toBeTruthy();
    fireEvent.click(view.container.querySelector('[data-action="tactics-next"]')!);
    expect(modal().getAttribute('data-tactics-phase')).toBe('done');
    expect(view.container.querySelector('[data-section="tactics-summary"]')?.textContent).toMatch(/1 Again/);
    expect(Object.keys(readTacticStates()).sort()).toEqual(['one', 'two']);
    // The session is logged, and the last sessions show
    expect(readTacticSessions()).toMatchObject([{ good: 1, hard: 0, again: 1 }]);
    expect(view.container.querySelector('[data-section="tactics-sessions"]')?.textContent).toContain('1 Good, 0 Hard, 1 Again');
  });

  it('sums up the deck for the Progress panel: seen, retired, to redo, and the solve time then and now', () => {
    const deck = [tactic('a', 'fork'), tactic('b', 'fork'), tactic('c', 'mate')];
    const states = { a: { tries: 3, streak: 3, grade: 'good' as const, at: 3 }, b: { tries: 1, streak: 0, grade: 'again' as const, at: 2 } };
    const sessions = [
      { at: 1, good: 1, hard: 1, again: 0, ms: 20_000 },
      { at: 2, good: 2, hard: 0, again: 0, ms: 8_000 },
    ];
    const p = tacticsProgress(deck, states, sessions);
    expect(p).toEqual({ deck: 3, seen: 2, retired: 1, redo: 1, sessions: 2, firstSeconds: 10, lastSeconds: 4 });
    const view = render(<TacticsProgressLine progress={p} />);
    expect(view.container.textContent).toBe('Tactics deck: 2 of 3 positions seen, 1 retired, 1 to redo. 2 sessions: 4.0 s a position in the last, 10.0 s in the first.');
  });

  it('prints the next positions of a session on a sheet, the answers on the back', () => {
    const black = tactic('b', 'free-piece', { fen: '6k1/5ppp/8/8/8/8/5PPP/3r2K1 b - - 0 30', solution: 'Rd8', accepted: ['Rd8'], line: ['Rd8'], lastMove: { from: 'h1', to: 'g1', san: 'Kg1' } });
    const view = render(<TacticsSheet deck={[tactic('w', 'mate-in-one'), black]} />);
    const sheet = view.container.querySelector('[data-section="tactics-sheet"]')!;
    expect(sheet.getAttribute('data-items')).toBe('2');
    expect(sheet.querySelector('[data-tactics-item="1"]')?.textContent).toContain('White to play, after Kg8.');
    expect(sheet.querySelector('[data-tactics-item="2"]')?.textContent).toContain('Black to play, after Kg1.');
    expect(sheet.querySelector('[data-tactics-answer="1"]')?.textContent).toContain('Rd8#: mate in one. Stockfish\'s line: 30.Rd8#. From your game of 2026-10-01.');
    expect(sheet.querySelector('[data-printable="answer-key"]')).not.toBeNull();
  });

  it('every deck position replays with chess.js: the answer, the line, the last move and the motif', () => {
    expect(tacticsDeck.length).toBeGreaterThanOrEqual(150);
    const ids = new Set<string>();
    for (const t of tacticsDeck) {
      expect(ids.has(t.id), t.id).toBe(false);
      ids.add(t.id);
      const c = new Chess(t.fen);
      expect(c.isGameOver(), t.id).toBe(false);
      expect(c.moves().length, t.id).toBeGreaterThan(2);
      // The piece that just moved stands on its square, and it is the other side's
      expect(c.get(t.lastMove.to as never)?.color, t.id).toBe(c.turn() === 'w' ? 'b' : 'w');
      expect(t.accepted, t.id).toContain(t.solution);
      for (const san of [...t.accepted, t.played]) expect(() => new Chess(t.fen).move(san), `${t.id} ${san}`).not.toThrow();
      const line = new Chess(t.fen);
      for (const san of t.line) line.move(san);
      expect(t.line[0], t.id).toBe(t.solution);
      const after = new Chess(t.fen);
      const m = after.move(t.solution);
      if (t.motif === 'mate-in-one') expect(after.isCheckmate(), t.id).toBe(true);
      if (t.motif === 'mate') expect(t.mateIn, t.id).toBeGreaterThan(1);
      if (t.motif === 'promotion') expect(m.promotion, t.id).toBeTruthy();
      if (t.motif === 'free-piece') {
        // A capture of a piece nothing defended, or of one worth more than the capturer
        expect(m.captured, t.id).toBeTruthy();
        const defended = new Chess(t.fen).attackers(m.to, m.color === 'w' ? 'b' : 'w').length > 0;
        expect(!defended || V[m.captured!] > V[m.piece], t.id).toBe(true);
      }
      if (t.motif === 'fork') {
        const them = m.color === 'w' ? 'b' : 'w';
        const hit = after
          .board()
          .flat()
          .filter((p) => p && p.color === them && after.attackers(p.square, m.color).includes(m.to));
        expect(hit.length, t.id).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
