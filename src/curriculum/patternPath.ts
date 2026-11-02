import { CurriculumLesson } from '../types/curriculum';
import { missedThreatLessons, freePieceLessons, hangingMoveLessons, allowedMateLessons } from './gameDrills';

/**
 * The study path: the core lessons grouped by the pattern they repeat, in the order to learn them.
 *
 * Each group holds lessons whose exercises and plans turn on the same idea, so the second and third
 * lessons of a group practise what the first one introduced, from the other colour or in another
 * opening. A group names the one question that catches the pattern at the board.
 *
 * Group order follows docs/game-analysis.md, which measured hoot65's archive with the Maia model:
 * the costliest board checks in recent games are a piece left where it can be taken, a threat not
 * answered and a free piece not taken, then allowing mate in one (rarer, but the costliest single
 * error). The path opens with those checks drilled on positions from hoot65's own games
 * (src/curriculum/gameDrills.ts), in the order they are made at the board: what the opponent's move
 * attacks, what can be taken, whether the move about to be played leaves anything to take, and
 * whether it allows mate. The two loose-piece groups of the opening lessons follow, then the king in
 * the centre (knight mates against a king that has not castled), the structure group and finishing
 * technique.
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
    id: 'pattern-what-does-it-attack',
    title: 'What does the last move attack?',
    idea:
      'Positions from your own recent games: the opponent\'s move attacked one of your pieces, and it stayed where it was. Move it, guard it, or take the attacker.',
    check: 'After every opponent move: what does it attack, and is that piece defended?',
    lessonIds: missedThreatLessons.map((l) => l.id),
  },
  {
    id: 'pattern-take-what-is-free',
    title: 'Take what is free',
    idea:
      'Positions from your own recent games: a piece of the opponent\'s could be won, because nothing defended it or something cheaper of yours attacked it, and it was not taken.',
    check: 'Before every move: is a piece of theirs undefended, or attacked by something cheaper?',
    lessonIds: freePieceLessons.map((l) => l.id),
  },
  {
    id: 'pattern-is-your-move-safe',
    title: 'Is your move safe?',
    idea:
      'Positions from your own recent games: nothing was in danger, and your move left a piece where it could be taken, because nothing defended it or something cheaper attacked it.',
    check: 'Before every move: after it, what could your opponent take?',
    lessonIds: hangingMoveLessons.map((l) => l.id),
  },
  {
    id: 'pattern-does-your-move-allow-mate',
    title: 'Does your move allow mate?',
    idea:
      'Positions from your own games: the game was still open, and your move let your opponent give mate on the next move.',
    check: 'Before every move: after it, which checks would your opponent have, and is one of them mate?',
    lessonIds: allowedMateLessons.map((l) => l.id),
  },
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
      'A bishop or queen on an open line takes whatever nothing defends: the b2 pawn once White\'s c1 bishop has left, the queen on c2, the bishop on d3 and the bishop on b5, and a queen that recaptures on d5 in front of a bishop on c4.',
    check: 'What does each enemy bishop and queen line hit, and is everything on it defended?',
    lessonIds: ['lesson-black-wall-vs-london', 'lesson-black-slav-wall', 'lesson-black-wall-vs-flank', 'lesson-black-caro-kann-advance', 'lesson-black-caro-vs-bc4'],
  },
  {
    id: 'pattern-king-in-the-centre',
    title: 'The king in the centre',
    idea:
      'A king that has not castled can be mated by a knight check. In Legal\'s mate nothing can take the knight on d5; against Nd6# and Nf3# the only piece that could take it is pinned. In the Evans, White castles before taking back on d4, in the Two Knights with 4.d4 the rook on e1 pins a knight on e4 to the king, against 1...Nc6 a knight on b5 eyes a check on c7 that forks king and rook, and against 2...f6 the queen checks on h5 along the diagonal the f-pawn opened, which is why, as Black against 2.e5 in the Caro-Kann, the f-pawn stays home; there the queen checks on a5 instead and takes the loose e5 pawn.',
    check: 'With a king still on e1 or e8: which knight checks are possible, and can each checking knight be taken?',
    lessonIds: [
      'lesson-evans-gambit-destruction',
      'lesson-two-knights-d4',
      'lesson-white-vs-nimzowitsch',
      'lesson-white-vs-damiano',
      'lesson-black-caro-vs-e5-d3',
      'lesson-legals-mate',
      'lesson-black-wall-vs-nc3-bg5',
      'lesson-blackburne-shilling-drill',
    ],
  },
  {
    id: 'pattern-caro-bishop-both-sides',
    title: 'The Caro-Kann bishop from both sides',
    idea:
      'The same Classical line twice: as Black the bishop goes f5, g6 and h7 ahead of the h-pawn, and as White Ng3 and h4 chase it to gain time. In the Exchange the bishop on f5 meets Bd3 by trading or going back to g6, and as White against 3...Bg4, h3 and g4 chase it.',
    check: 'When a piece is chased: where is its next safe square, and does the chasing move also develop?',
    lessonIds: ['lesson-black-caro-kann-classical', 'lesson-caro-kann-discipline-drill', 'lesson-black-caro-exchange', 'lesson-black-caro-vs-f4', 'lesson-white-vs-caro-kann'],
  },
  {
    id: 'pattern-finish-the-game',
    title: 'Finish the game',
    idea: 'With a queen or a rook against a lone king, keep it in a box on the edge, bring your king up, and give mate rather than stalemate. With a lone pawn, your king goes first and takes the opposition, and the pawn advances when your king guards its path.',
    check: 'Before a quiet move near the enemy king: does the king still have a legal move?',
    lessonIds: ['lesson-queen-cage-box-mate', 'lesson-rook-back-rank-mate', 'lesson-king-pawn-opposition', 'lesson-stalemate-catastrophes'],
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
