import codeFile from '../data/item_codes.json';
import masteredFile from '../data/mastered.json';
import type { CurriculumExercise, CurriculumLesson } from '../types/curriculum';

/**
 * Codes for taking out what has been mastered. Every lesson, exercise, position from hoot65's games,
 * tactic and worksheet has a short code, printed beside it in the book and shown in the app: L for a
 * lesson, E for an exercise, G for a position from the games, T for a tactic, W for a worksheet. A code
 * is given once, by `npm run codes`, and never changes or goes to another item, so the code on an old
 * printout still names the same thing.
 *
 * The codes in src/data/mastered.json (`npm run codes -- master L12 T40`) are left out of the book and
 * of the app: a mastered lesson goes with its practice and its exercises, a drill sheet takes the set's
 * next position instead, and the tactics sheets the deck's next tactics.
 */

export type CodeKind = 'lesson' | 'exercise' | 'game' | 'tactic' | 'worksheet';

export const CODE_PREFIX: Record<CodeKind, string> = { lesson: 'L', exercise: 'E', game: 'G', tactic: 'T', worksheet: 'W' };

/** Each kind's codes by item id: a lesson's or a game position's lesson id, an exercise's, a tactic's or a worksheet's id. */
export type CodeRegistry = Record<CodeKind, Record<string, string>>;

export const codeRegistry = codeFile as CodeRegistry;

/** Each mastered code with the day it was marked (YYYY-MM-DD). */
export const masteredOn = masteredFile as Record<string, string>;

/** A lesson's code: L for a lesson, G for a position from hoot65's games. */
export const lessonCode = (lessonId: string): string | undefined => codeRegistry.lesson[lessonId] ?? codeRegistry.game[lessonId];
export const exerciseCode = (exerciseId: string): string | undefined => codeRegistry.exercise[exerciseId];
export const tacticCode = (tacticId: string): string | undefined => codeRegistry.tactic[tacticId];
/** A worksheet's code (a worksheet's id is optional). */
export const worksheetCode = (worksheetId: string | undefined): string | undefined => (worksheetId === undefined ? undefined : codeRegistry.worksheet[worksheetId]);

export const isMastered = (code: string | undefined): boolean => code !== undefined && Object.prototype.hasOwnProperty.call(masteredOn, code);
export const isLessonMastered = (lessonId: string): boolean => isMastered(lessonCode(lessonId));
export const isExerciseMastered = (exerciseId: string): boolean => isMastered(exerciseCode(exerciseId));
export const isTacticMastered = (tacticId: string): boolean => isMastered(tacticCode(tacticId));
export const isWorksheetMastered = (worksheetId: string | undefined): boolean => isMastered(worksheetCode(worksheetId));

/** The lessons a card still belongs to once the mastered ones are left out. */
export const liveLessonIds = (lessonIds: string[]): string[] => lessonIds.filter((id) => !isLessonMastered(id));

/** A card every lesson of which is mastered: it leaves the sessions (a card of no lesson, from a game review, stays). */
export const isCardMastered = (card: { lessonIds: string[] }): boolean => card.lessonIds.length > 0 && card.lessonIds.every(isLessonMastered);

/** A lesson's exercises less the mastered ones (the same array when none is). */
export function exercisesToPractise(lesson: CurriculumLesson): CurriculumExercise[] {
  const left = lesson.exercises.filter((ex) => !isExerciseMastered(ex.id));
  return left.length === lesson.exercises.length ? lesson.exercises : left;
}

/** The mastered codes in order: by kind (L, E, G, T, W), then by number. */
export function masteredCodes(): string[] {
  const order = Object.values(CODE_PREFIX);
  return Object.keys(masteredOn).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]) || Number(a.slice(1)) - Number(b.slice(1)));
}
