import { CurriculumLesson, ChessCurriculumCourse } from '../types/curriculum';
import { openingLessons } from './openings';
import { antiGambitLessons } from './antiGambits';
import { trapLessons } from './traps';
import { fundamentalsLessons } from './fundamentals';
import { weaknessDrillLessons } from './drills';
import { antiSicilianLessons } from './antiSicilian';
import { blackRepertoireLessons } from './blackRepertoire';
import { gameDrillLessons, gameDrillData } from './gameDrills';

export * from './builder';
export * from './openings';
export * from './antiGambits';
export * from './traps';
export * from './fundamentals';
export * from './drills';
export * from './antiSicilian';
export * from './blackRepertoire';
export * from './gameDrills';
export * from './worksheetsData';

/**
 * Complete collection of all curriculum lessons
 */
export const allCurriculumLessons: CurriculumLesson[] = [
  ...openingLessons,
  ...antiSicilianLessons,
  ...blackRepertoireLessons,
  ...antiGambitLessons,
  ...trapLessons,
  ...fundamentalsLessons,
  ...weaknessDrillLessons,
  ...gameDrillLessons,
];

/**
 * Structured curriculum courses grouping lessons logically
 */
export const curriculumCourses: ChessCurriculumCourse[] = [
  {
    id: 'course-white-repertoire',
    title: 'White Repertoire: Italian, Evans Gambit & the Alapin',
    subtitle: 'The 3.Bc4 Italian with 4.b4 against 3...Bc5, and one c3-d4 plan against the Sicilian',
    category: 'white_repertoire',
    targetColor: 'white',
    targetRatingBand: 'beginner',
    description:
      'hoot65\'s 1.e4 repertoire: the Italian with the Evans Gambit after 3...Bc5 and branches for 3...h6, 3...Nf6 and 3...Nd4 weighted by his own games, and the c3-d4 centre against the Sicilian. The Scotch Gambit and the Adams Attack stay in the pattern library.',
    sourceAttribution: {
      bookTitle: 'Tactics in Junior Openings & Modernized: The Open Sicilian',
      author: 'Dave / IM Zhanibek Amanov & FM Kostya Kavutskiy',
      publicationYear: 2015,
      pagesRef: 'Scotch Gambit, Evans Gambit and Najdorf 6.h3 chapters',
    },
    lessons: [...openingLessons, ...antiSicilianLessons],
  },
  {
    id: 'course-black-repertoire',
    title: 'Black Repertoire: Caro-Kann & the c6-d5 Wall',
    subtitle: 'One structure against 1.e4, 1.d4, 1.c4 and 1.Nf3: pawns on c6 and d5, the bishop out before ...e6',
    category: 'black_repertoire',
    targetColor: 'black',
    targetRatingBand: 'intermediate',
    description:
      'The lines hoot65 reaches as Black, weighted by his own games: the wall against the London, 2.c4, 2.Nc3 and 2.Bg5, the same wall against 1.c4 and 1.Nf3, and the Caro-Kann against the Advance, the Classical, and 2.Nf3 or 2.Nc3 with the question of when ...Bg4 is safe.',
    sourceAttribution: {
      bookTitle: 'Chess.com Live Archive',
      author: 'hoot65 Diagnostic Analysis',
      publicationYear: 2026,
      pagesRef: 'Repertoire plan: Caro-Kann & the c6-d5 Wall',
    },
    lessons: blackRepertoireLessons,
  },
  {
    id: 'course-anti-gambit',
    title: 'Anti-Gambit Clinic: Refuting Tricky Black Sidelines',
    subtitle: 'Refute the Konikowski, Elephant, and Latvian gambits with precision',
    category: 'anti_gambit',
    targetColor: 'white',
    targetRatingBand: 'intermediate',
    description:
      'Eric Schiller and John Watson’s refutations of Black’s rarer gambits. hoot65 has faced these lines at most once in 150 White games, so they live in the pattern library: maintain composure, secure king safety, and counter-strike in the center.',
    sourceAttribution: {
      bookTitle: 'Survive and Beat Annoying Chess Openings',
      author: 'Eric Schiller & John Watson',
      publicationYear: 2003,
      pagesRef: 'Konikowski, Elephant and Latvian Gambit chapters',
    },
    lessons: antiGambitLessons,
  },
  {
    id: 'course-opening-traps',
    title: 'Opening Traps Hall of Fame',
    subtitle: 'Opening traps to spring as Black and avoid as White',
    category: 'opening_traps',
    targetColor: 'both',
    targetRatingBand: 'intermediate',
    description:
      'Catalog of essential tactical traps every chess player must know: The Siberian Trap, Legal\'s Mate, Noah\'s Ark, and the Elephant Trap.',
    sourceAttribution: {
      bookTitle: '101 Chess Opening Traps',
      author: 'Steve Giddins',
      publicationYear: 1998,
      pagesRef: 'Siberian Trap, Legal\'s Mate, Noah\'s Ark Trap, Elephant Trap',
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
      'Core principles of checkmate delivery: confinement boxing with the queen and avoiding accidental stalemate.',
    sourceAttribution: {
      bookTitle: 'LearningChess - Lessons for Beginners - Workbook for Students Vol 1',
      author: 'GM Jozsef Pinter & Shamin de Moraes',
      publicationYear: 2023,
      pagesRef: 'Checkmate with the queen; Stalemate',
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
      'Targeted drills designed specifically for hoot65’s rating band (~1150 Rapid), fixing the Scandinavian 2.e5?! error from game vs meny_26, the Caro-Kann 3.h3?! passivity from game vs Brandon0015, and the 0-5 record against the Blackburne-Shilling knight on d4.',
    sourceAttribution: {
      bookTitle: 'Chess.com Live Archives & Tactics in Junior Openings',
      author: 'hoot65 Game Diagnostics & Dave',
      publicationYear: 2026,
      pagesRef: 'Chess.com games 185031553576 (vs meny_26), 185135704918 (vs Brandon0015) and 169351731946 (vs Itilogic)',
    },
    lessons: weaknessDrillLessons,
  },
  {
    id: 'course-game-drills',
    title: 'From Your Games: Threats, Free Pieces, Safe Moves and Mates',
    subtitle: 'Positions from your games where an attacked piece was left, a free piece was not taken, a move left a piece hanging, or a move allowed mate',
    category: 'tactical_patterns',
    targetColor: 'both',
    targetRatingBand: 'beginner',
    description: `The board checks that cost you the most points in recent games, drilled on your own positions from ${gameDrillData.from} to ${gameDrillData.to}: answer the threat of the opponent's last move, take a piece that can be won, check that your own move leaves nothing to take, and check that it allows no mate.`,
    sourceAttribution: {
      bookTitle: 'Chess.com Live Archive',
      author: 'hoot65 game analysis',
      publicationYear: 2026,
      pagesRef: 'Archive analysis: the board checks',
    },
    lessons: gameDrillLessons,
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
