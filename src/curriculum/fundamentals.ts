import { CurriculumLesson } from '../types/curriculum';
import { buildVerifiedLesson } from './builder';

/**
 * Beginner Fundamentals & Endgame Mates
 * Source: LearningChess - Lessons for Beginners - Workbook for Students Vol 1
 * by GM Jozsef Pinter (Head Coach) & Shamin de Moraes (2023)
 */

export const queenCageBoxMate: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-queen-cage-box-mate',
  title: 'Checkmate by Queen: The Box / Cage Technique',
  subtitle: 'Herd the enemy King to the rim of the board without delivering useless checks',
  category: 'fundamentals',
  sourceBook: 'LearningChess - Lessons for Beginners Vol 1',
  author: 'GM Jozsef Pinter',
  publicationYear: 2023,
  pagesRef: 'Lesson 6, pp. 64–75',
  eco: 'KQK',
  initialFen: '8/8/8/4k3/8/8/8/4KQ2 w - - 0 1',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  description:
    'Grandmaster Jozsef Pinter teaches the classical "Box" or "Cage" method to deliver checkmate with King and Queen against a lone King. Instead of useless checks that allow the enemy king to wander freely, the queen stands a knight\'s jump away, steadily shrinking the king\'s confinement box until it is trapped on the edge.',
  thematicObjective: 'Shrink the queen’s confinement box, march the friendly king to opposition, and deliver the Kiss of Death checkmate.',
  keyTacticalMotif: 'Confinement box, knight-distance opposition, avoiding stalemate, Kiss of Death',
  moves: [
    {
      san: 'Qf3',
      isUserMove: true,
      annotation: 'Create the first box! The queen cuts off the 3rd rank and f-file, restricting the Black king.',
      hintPiece: 'Queen',
      hintSquare: 'f3',
      hintTheme: 'Shrink the box',
    },
    { san: 'Kd6', isUserMove: false },
    {
      san: 'Qe4',
      isUserMove: true,
      annotation: 'Step the queen closer, remaining a knight\'s jump away. The box shrinks to the 4th rank and e-file.',
      hintPiece: 'Queen',
      hintSquare: 'e4',
    },
    { san: 'Kc5', isUserMove: false },
    {
      san: 'Qd3',
      isUserMove: true,
      annotation: 'Tighten the cage further. The king is driven toward the queenside rim.',
      hintPiece: 'Queen',
      hintSquare: 'd3',
    },
    { san: 'Kb4', isUserMove: false },
    {
      san: 'Qc2',
      isUserMove: true,
      annotation: 'Cut off the c-file completely. The Black king only has squares on the a and b files.',
      hintPiece: 'Queen',
      hintSquare: 'c2',
    },
    { san: 'Ka3', isUserMove: false },
    {
      san: 'Qb1',
      isUserMove: true,
      annotation: 'Lock the king on the rim! Leave the king exactly two squares (a3 and a4) to prevent accidental stalemate.',
      hintPiece: 'Queen',
      hintSquare: 'b1',
      hintTheme: 'Lock on the rim, preserve breathing squares',
    },
    { san: 'Ka4', isUserMove: false },
    {
      san: 'Kd2',
      isUserMove: true,
      annotation: 'Now march the White king! The queen holds the prison guard while the king marches up.',
      hintPiece: 'King',
      hintSquare: 'd2',
      hintTheme: 'March the king',
    },
    { san: 'Ka5', isUserMove: false },
    {
      san: 'Kc3',
      isUserMove: true,
      annotation: 'Continue advancing the king toward the target.',
      hintPiece: 'King',
      hintSquare: 'c3',
    },
    { san: 'Ka6', isUserMove: false },
    {
      san: 'Kc4',
      isUserMove: true,
      annotation: 'King step forward. Black is running out of rim squares.',
      hintPiece: 'King',
      hintSquare: 'c4',
    },
    { san: 'Ka7', isUserMove: false },
    {
      san: 'Kc5',
      isUserMove: true,
      annotation: 'Maintain steady approach.',
      hintPiece: 'King',
      hintSquare: 'c5',
    },
    { san: 'Ka8', isUserMove: false },
    {
      san: 'Kc6',
      isUserMove: true,
      annotation: 'Reach direct opposition on c6! Black king must step to a7.',
      hintPiece: 'King',
      hintSquare: 'c6',
    },
    { san: 'Ka7', isUserMove: false },
    {
      san: 'Qb7#',
      isUserMove: true,
      annotation: 'Checkmate! The "Kiss of Death" right in front of the enemy king, guarded by White’s king.',
      hintPiece: 'Queen',
      hintSquare: 'b7',
      hintTheme: 'Kiss of Death checkmate',
      highlights: [{ square: 'b7', color: 'green' }, { square: 'a7', color: 'red' }],
    },
  ],
  exercises: [
    {
      id: 'ex-queen-cage-1',
      title: 'Initiate the Confinement Box',
      fen: '8/8/8/4k3/8/8/8/4KQ2 w - - 0 1',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. Black king is on e5. Instead of giving a check, place your queen a knight\'s jump away to shrink the cage.',
      solutionSan: ['Qf3'],
      explanation: '1.Qf3! cuts off the f-file and 3rd rank, building the initial cage and confining Black\'s king.',
    },
    {
      id: 'ex-queen-cage-2',
      title: 'The Kiss of Death Mating Move',
      fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. White king has opposition on c6. Deliver the decisive checkmate.',
      solutionSan: ['Qb7#'],
      explanation: '1.Qb7# delivers checkmate directly adjacent to Black\'s king, fully supported by the king on c6.',
    },
  ],
  mistakesAndTraps: [
    {
      triggerFen: 'k7/8/1K1Q4/8/8/8/8/8 w - - 0 1',
      attemptedSan: 'Qc7',
      isTrap: true,
      severity: 'blunder',
      explanatoryFeedback: 'Playing 1.Qc7?? causes an immediate STALEMATE catastrophe! The Black king has no legal moves and is not in check. Instead, 1.Qd8# wins immediately!',
      refutationSanList: [],
      punishmentSummary: 'Draw by stalemate in a 100% winning position.',
    },
  ],
});

export const stalemateCatastrophes: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-stalemate-catastrophes',
  title: 'Avoiding Stalemate Catastrophes',
  subtitle: 'Learn to recognize when the defending king is trapped without legal moves',
  category: 'fundamentals',
  sourceBook: 'LearningChess - Lessons for Beginners Vol 1',
  author: 'GM Jozsef Pinter',
  publicationYear: 2023,
  pagesRef: 'Lesson 4, p. 73',
  eco: 'Draw',
  initialFen: 'k7/8/1K1Q4/8/8/8/8/8 w - - 0 1',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  description:
    'Stalemate occurs when the player whose turn it is to move has no legal moves and is NOT in check. In this tragic situation, a completely winning game ends in an immediate draw! GM Pinter emphasizes always asking: "Does my opponent have a legal move after I play this?"',
  thematicObjective: 'Never smother the opponent\'s king without delivering check. Always calculate checks first.',
  keyTacticalMotif: 'Stalemate prevention, back-rank checkmate',
  moves: [
    {
      san: 'Qd8#',
      isUserMove: true,
      annotation: 'Checkmate! 1.Qd8# delivers check while attacking the king directly. Black cannot escape.',
      hintPiece: 'Queen',
      hintSquare: 'd8',
      hintTheme: 'Deliver back-rank mate',
    },
  ],
  exercises: [
    {
      id: 'ex-stalemate-1',
      title: 'Mate, Don\'t Stalemate!',
      fen: 'k7/8/1K1Q4/8/8/8/8/8 w - - 0 1',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. Delivering check on c7 is stalemate (draw!). Find the move that delivers instant checkmate.',
      solutionSan: ['Qd8#'],
      explanation: '1.Qd8# delivers checkmate directly on the back rank. Playing 1.Qc7?? is a horrific blunder resulting in an instant draw by stalemate.',
    },
  ],
});

export const fundamentalsLessons: CurriculumLesson[] = [
  queenCageBoxMate,
  stalemateCatastrophes,
];
