import { CurriculumLesson, ChessCurriculumCourse } from '../types/curriculum';
import { openingLessons } from './openings';
import { antiGambitLessons } from './antiGambits';
import { trapLessons } from './traps';
import { fundamentalsLessons } from './fundamentals';
import { weaknessDrillLessons } from './drills';

export * from './builder';
export * from './openings';
export * from './antiGambits';
export * from './traps';
export * from './fundamentals';
export * from './drills';
export * from './worksheetsData';

/**
 * Complete collection of all curriculum lessons
 */
export const allCurriculumLessons: CurriculumLesson[] = [
  ...openingLessons,
  ...antiGambitLessons,
  ...trapLessons,
  ...fundamentalsLessons,
  ...weaknessDrillLessons,
];

/**
 * Structured curriculum courses grouping lessons logically
 */
export const curriculumCourses: ChessCurriculumCourse[] = [
  {
    id: 'course-white-repertoire',
    title: 'White Repertoire: Scotch Gambit & Aggressive Classical Weapons',
    subtitle: 'Lethal weapons against 1...e5 and the Open Sicilian',
    category: 'white_repertoire',
    targetColor: 'white',
    targetRatingBand: 'beginner',
    description:
      'Master an aggressive, tactical 1.e4 opening repertoire that punishes passivity, seizes the center, and attacks the f7 square with the Scotch and Evans Gambits, plus the modern Adams Attack vs the Sicilian.',
    sourceAttribution: {
      bookTitle: 'Tactics in Junior Openings & Modernized: The Open Sicilian',
      author: 'Dave / IM Zhanibek Amanov & FM Kostya Kavutskiy',
      publicationYear: 2015,
      pagesRef: 'Tactics pp. 3–28; 7500.pdf pp. 1–26',
    },
    lessons: openingLessons,
  },
  {
    id: 'course-anti-gambit',
    title: 'Anti-Gambit Clinic: Refuting Tricky Black Sidelines',
    subtitle: 'Crush the Konikowski, Elephant, and Latvian gambits with precision',
    category: 'white_repertoire',
    targetColor: 'white',
    targetRatingBand: 'intermediate',
    description:
      'Learn Eric Schiller’s proven refutations to Black’s annoying opening gambits. Maintain composure, secure king safety, and counter-strike in the center.',
    sourceAttribution: {
      bookTitle: 'Survive and Beat Annoying Chess Openings',
      author: 'Eric Schiller',
      publicationYear: 2003,
      pagesRef: 'pp. 11–29',
    },
    lessons: antiGambitLessons,
  },
  {
    id: 'course-opening-traps',
    title: 'Opening Traps Hall of Fame',
    subtitle: 'Lethal traps to spring as Black and avoid as White',
    category: 'opening_traps',
    targetColor: 'both',
    targetRatingBand: 'intermediate',
    description:
      'Catalog of essential tactical traps every chess player must know: The Siberian Trap, Legal\'s Mate, Noah\'s Ark, and the Elephant Trap.',
    sourceAttribution: {
      bookTitle: '101 Chess Opening Traps',
      author: 'Steve Giddins',
      publicationYear: 2001,
      pagesRef: 'Traps 35, 58, 77, 101',
    },
    lessons: trapLessons,
  },
  {
    id: 'course-beginner-fundamentals',
    title: 'Chess Fundamentals & Endgame Mastery',
    subtitle: 'GM Jozsef Pinter\'s step-by-step workbook lessons',
    category: 'beginner_fundamentals',
    targetColor: 'white',
    targetRatingBand: 'beginner',
    description:
      'Core principles of checkmate delivery, confinement boxing with the queen, avoiding accidental stalemate catastrophes, and CPR escapes.',
    sourceAttribution: {
      bookTitle: 'LearningChess - Lessons for Beginners - Workbook for Students Vol 1',
      author: 'GM Jozsef Pinter & Shamin de Moraes',
      publicationYear: 2023,
      pagesRef: 'Lessons 4 & 6, pp. 45–75',
    },
    lessons: fundamentalsLessons,
  },
  {
    id: 'course-hoot65-drills',
    title: 'Personalized Weakness Drills for hoot65',
    subtitle: 'Diagnostic antidotes derived from real Chess.com game history',
    category: 'hoot65_drills',
    targetColor: 'white',
    targetRatingBand: 'beginner',
    description:
      'Targeted drills designed specifically for hoot65’s rating band (~1150 Rapid), fixing the Scandinavian 2.e5?! error from game vs meny_26 and the Caro-Kann 3.h3?! passivity from game vs Brandon0015.',
    sourceAttribution: {
      bookTitle: 'Chess.com Live Archives & Tactics in Junior Openings',
      author: 'hoot65 Game Diagnostics & Dave',
      publicationYear: 2026,
      pagesRef: 'Games vs meny_26, Brandon0015; Tactics pp. 30–42',
    },
    lessons: weaknessDrillLessons,
  },
];

/**
 * Find lesson by ID
 */
export function getCurriculumLessonById(id: string): CurriculumLesson | undefined {
  return allCurriculumLessons.find((l) => l.id === id);
}

/**
 * Filter lessons by category
 */
export function getCurriculumLessonsByCategory(
  category: CurriculumLesson['category']
): CurriculumLesson[] {
  return allCurriculumLessons.filter((l) => l.category === category);
}
