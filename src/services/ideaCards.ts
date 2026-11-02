import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import { Chess } from 'chess.js';
import { CARD_PARAMETERS } from './cards';
import type { CurriculumLesson } from '../types/curriculum';

/**
 * Idea cards (CL-7): one card per opening lesson that rehearses the plan rather than a move. The card
 * shows the position the lesson's main line reaches; the student says the plan, reveals the lesson's
 * objective, and grades the recall themselves (there is no move to judge it by). Scheduled by FSRS
 * with the same parameters as the move cards, kept in this browser.
 */

export const IDEA_STORAGE_KEY = 'my_chess_idea_cards_v1';

export type IdeaGrade = 'again' | 'hard' | 'good' | 'easy';
const GRADE: Record<IdeaGrade, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };

interface StoredIdea {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
}

const scheduler = fsrs(CARD_PARAMETERS);

/** The lessons with a plan to rehearse: the openings of the study path, not the drills or the mates. */
export function ideaLessons(lessons: CurriculumLesson[]): CurriculumLesson[] {
  return lessons.filter(
    (l) => l.relevance !== 'outside-repertoire' && l.category !== 'fundamentals' && !l.id.startsWith('lesson-game-') && !!l.thematicObjective
  );
}

/**
 * Three plans to choose from (CL-7's multiple choice): the lesson's own and two of other lessons for the
 * same colour, in an order fixed for each lesson, so the right one is not always first.
 */
export function planChoices(lesson: CurriculumLesson, lessons: CurriculumLesson[]): string[] {
  const own = lesson.thematicObjective ?? '';
  const others = [...new Set(ideaLessons(lessons).filter((l) => l.id !== lesson.id && l.targetColor === lesson.targetColor).map((l) => l.thematicObjective!))].filter(
    (o) => o !== own
  );
  const h = [...lesson.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const n = others.length;
  // Two different others: the second is 1 to n - 1 places after the first
  const first = h % n;
  const second = (first + 1 + ((h >>> 4) % Math.max(1, n - 1))) % n;
  const picks = n <= 2 ? others : [others[first], others[second]];
  const options = [own, ...picks];
  const shift = h % options.length;
  return [...options.slice(shift), ...options.slice(0, shift)];
}

/** The position the lesson's main line reaches. */
export function ideaPosition(lesson: CurriculumLesson): string {
  const chess = new Chess(lesson.initialFen);
  for (const m of lesson.moves) chess.move(m.san);
  return chess.fen();
}

function readAll(): Record<string, StoredIdea> {
  try {
    const raw = window.localStorage.getItem(IDEA_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, StoredIdea>) {
  try {
    window.localStorage.setItem(IDEA_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // not kept; the next visit asks again
  }
}

const toCard = (s: StoredIdea): Card => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review === undefined ? undefined : new Date(s.last_review),
} as Card);

const fromCard = (c: Card): StoredIdea => ({
  due: c.due.getTime(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  last_review: c.last_review ? c.last_review.getTime() : undefined,
});

/** The idea cards due now, oldest due first; a lesson never seen counts as due (a new card). */
export function dueIdeas(lessons: CurriculumLesson[], now = Date.now()): CurriculumLesson[] {
  const all = readAll();
  return ideaLessons(lessons)
    .filter((l) => !all[l.id] || all[l.id].due <= now)
    .sort((a, b) => (all[a.id]?.due ?? 0) - (all[b.id]?.due ?? 0));
}

/** Record the student's grade of one recall; returns when the card comes back. */
export function gradeIdea(lessonId: string, grade: IdeaGrade, now = Date.now()): number {
  const all = readAll();
  const card = all[lessonId] ? toCard(all[lessonId]) : createEmptyCard(new Date(now));
  const next = scheduler.next(card, new Date(now), GRADE[grade]).card;
  all[lessonId] = fromCard(next);
  writeAll(all);
  return all[lessonId].due;
}
