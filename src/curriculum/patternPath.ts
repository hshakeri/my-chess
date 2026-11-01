import { CurriculumLesson } from '../types/curriculum';

/**
 * The study path: the core lessons grouped by the pattern they repeat, in the order to learn them.
 *
 * Each group holds lessons whose exercises and plans turn on the same idea, so the second and third
 * lessons of a group practise what the first one introduced, from the other colour or in another
 * opening. A group names the one question that catches the pattern at the board.
 *
 * Group order follows docs/game-analysis.md, which measured hoot65's archive with the Maia model:
 * the costliest board checks in recent games are a piece left where it can be taken, a threat not
 * answered and a free piece not taken, so the two loose-piece groups come first; allowing mate in
 * one is rarer but costs the most each time, so the king in the centre comes next; the structure
 * group and finishing technique follow.
 */
export interface PatternGroup {
  id: string;
  title: string;
  /** The idea the lessons in the group repeat. */
  idea: string;
  /** The question to ask at the board before moving. */
  check: string;
  /** Lesson ids in study order. */
  lessonIds: string[];
}

export const patternPath: PatternGroup[] = [
  {
    id: 'pattern-queen-takes-on-g4',
    title: 'The undefended piece on g4',
    idea:
      'Once e2 and f3 are empty, the queen on d1 sees g4; from a4 it sees g4 along an open fourth rank. A bishop or knight on g4 that nothing defends is simply taken: the answer is Qxg4 in all three lessons.',
    check: 'Before a piece goes to g4 (or g5), or when one arrives there: does anything defend it?',
    lessonIds: ['lesson-scandinavian-refutation-drill', 'lesson-alapin-sicilian-centre', 'lesson-black-caro-bg4-timing'],
  },
  {
    id: 'pattern-loose-pieces-long-lines',
    title: 'Loose pieces on the long lines',
    idea:
      'A bishop or queen on an open line takes whatever nothing defends: the b2 pawn once White\'s c1 bishop has left, the queen on c2, the bishop on d3 and the bishop on b5.',
    check: 'What does each enemy bishop and queen line hit, and is everything on it defended?',
    lessonIds: ['lesson-black-wall-vs-london', 'lesson-black-slav-wall', 'lesson-black-wall-vs-flank', 'lesson-black-caro-kann-advance'],
  },
  {
    id: 'pattern-king-in-the-centre',
    title: 'The king in the centre',
    idea:
      'A king that has not castled can be mated by a knight check. In Legal\'s mate nothing can take the knight on d5; against Nd6# and Nf3# the only piece that could take it is pinned. In the Evans, White castles before taking back on d4.',
    check: 'With a king still on e1 or e8: which knight checks are possible, and can each checking knight be taken?',
    lessonIds: [
      'lesson-evans-gambit-destruction',
      'lesson-legals-mate',
      'lesson-black-wall-vs-nc3-bg5',
      'lesson-blackburne-shilling-drill',
    ],
  },
  {
    id: 'pattern-caro-bishop-both-sides',
    title: 'The Caro-Kann bishop from both sides',
    idea:
      'The same Classical line twice: as Black the bishop goes f5, g6 and h7 ahead of the h-pawn, and as White Ng3 and h4 chase it to gain time.',
    check: 'When a piece is chased: where is its next safe square, and does the chasing move also develop?',
    lessonIds: ['lesson-black-caro-kann-classical', 'lesson-caro-kann-discipline-drill'],
  },
  {
    id: 'pattern-finish-the-game',
    title: 'Finish the game',
    idea: 'With a queen against a lone king, shrink the box, bring the king up, and give mate rather than stalemate.',
    check: 'Before a quiet queen move near the enemy king: does the king still have a legal move?',
    lessonIds: ['lesson-queen-cage-box-mate', 'lesson-stalemate-catastrophes'],
  },
];

/** The study-path group a lesson belongs to, if any. */
export function patternGroupOf(lessonId: string): PatternGroup | undefined {
  return patternPath.find((g) => g.lessonIds.includes(lessonId));
}

/** The given lessons in study-path order; lessons outside the path keep their order at the end. */
export function inPatternOrder(lessons: CurriculumLesson[]): CurriculumLesson[] {
  const rank = new Map<string, number>();
  patternPath.flatMap((g) => g.lessonIds).forEach((id, i) => rank.set(id, i));
  return lessons
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (rank.get(a.l.id) ?? 1000 + a.i) - (rank.get(b.l.id) ?? 1000 + b.i))
    .map(({ l }) => l);
}
