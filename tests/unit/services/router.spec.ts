import { describe, it, expect } from 'vitest';
import { APP_URL, formatRoute, lessonUrl, parseHash } from '../../../src/router';

describe('Deep links (DC-5): the URL hash names the tab, the lesson or a position', () => {
  it('parses the tabs, a lesson and a position for the Play tab', () => {
    expect(parseHash('#/diagnostics')).toEqual({ view: 'diagnostics' });
    expect(parseHash('#/lessons')).toEqual({ view: 'lessons' });
    expect(parseHash('#/lesson/lesson-rook-back-rank-mate')).toEqual({ view: 'lessons', lessonId: 'lesson-rook-back-rank-mate' });
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
    expect(parseHash(formatRoute({ view: 'play', fen, color: 'b' }))).toEqual({ view: 'play', fen, color: 'b' });
    expect(parseHash('#/play?color=x')).toEqual({ view: 'play' });
  });

  it('opens a stored game by its id, encoded', () => {
    const id = 'chesscom:23e807b0-45fc-11f1-80e2-8556be01000f';
    expect(formatRoute({ view: 'database', gameId: id })).toBe('#/game/chesscom%3A23e807b0-45fc-11f1-80e2-8556be01000f');
    expect(parseHash(formatRoute({ view: 'database', gameId: id }))).toEqual({ view: 'database', gameId: id });
    expect(parseHash('#/game')).toBeNull();
    expect(parseHash('#/game/a/b')).toBeNull();
  });

  it('ignores what it does not know', () => {
    for (const bad of ['', '#', '#/', '#/nowhere', '#/lesson', '#/lessons/extra', 'lessons']) expect(parseHash(bad), bad).toBeNull();
  });

  it('round-trips every route and encodes lesson ids for print', () => {
    for (const route of [{ view: 'play' as const }, { view: 'database' as const }, { view: 'worksheets' as const }, { view: 'lessons' as const, lessonId: 'lesson-legals-mate' }]) {
      expect(parseHash(formatRoute(route))).toEqual(route);
    }
    expect(lessonUrl('lesson-game-mate-185129553252-47')).toBe(`${APP_URL}#/lesson/lesson-game-mate-185129553252-47`);
    expect(parseHash(formatRoute({ view: 'lessons', lessonId: 'a b/c' }))).toEqual({ view: 'lessons', lessonId: 'a b/c' });
  });
});
