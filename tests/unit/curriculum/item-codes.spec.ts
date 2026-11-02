import { describe, it, expect } from 'vitest';
import { allCurriculumLessons } from '../../../src/curriculum';
import { isGameDrill } from '../../../src/curriculum/gameDrills';
import { tacticsDeck } from '../../../src/services/tacticsDeck';
import { allWorksheets } from '../../../src/curriculum/worksheetsData';
import { CODE_PREFIX, codeRegistry, exerciseCode, lessonCode, masteredOn, tacticCode, worksheetCode, type CodeKind } from '../../../src/curriculum/itemCodes';

describe('Every lesson, exercise, position, tactic and worksheet has a code of its own', () => {
  it('a code of its kind for every item (a new item gets one from `npm run codes`), and no code twice', () => {
    const without: string[] = [];
    const check = (code: string | undefined, prefix: string, item: string) => {
      if (!code || !new RegExp(`^${prefix}[1-9]\\d*$`).test(code)) without.push(item);
    };
    for (const l of allCurriculumLessons) {
      check(lessonCode(l.id), isGameDrill(l.id) ? 'G' : 'L', l.id);
      for (const ex of l.exercises) check(exerciseCode(ex.id), 'E', ex.id);
    }
    for (const t of tacticsDeck) check(tacticCode(t.id), 'T', t.id);
    for (const w of allWorksheets) check(worksheetCode(w.id), 'W', w.id ?? w.title);
    expect(without, 'items without a code: run npm run codes').toEqual([]);

    const codes = (Object.keys(codeRegistry) as CodeKind[]).flatMap((kind) => Object.values(codeRegistry[kind]).map((code) => ({ kind, code })));
    for (const { kind, code } of codes) expect(code[0], code).toBe(CODE_PREFIX[kind]);
    expect(new Set(codes.map((c) => c.code)).size).toBe(codes.length);
  });

  it('a code stays with its item: the first ones given are still where they were', () => {
    expect(lessonCode('lesson-scandinavian-refutation-drill')).toBe('L1');
    expect(lessonCode('lesson-evans-gambit-destruction')).toBe('L9');
    expect(lessonCode('lesson-stalemate-catastrophes')).toBe('L24');
    expect(lessonCode('lesson-game-threat-186294577658-12')).toBe('G1');
    expect(tacticCode(tacticsDeck[0].id)).toBe('T1');
    expect(worksheetCode('ws-scotch-gambit')).toBe('W1');
  });

  it('the mastered list holds known codes, each with the day it was marked', () => {
    const known = new Set((Object.keys(codeRegistry) as CodeKind[]).flatMap((kind) => Object.values(codeRegistry[kind])));
    for (const [code, day] of Object.entries(masteredOn)) {
      expect(known.has(code), code).toBe(true);
      expect(day, code).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
