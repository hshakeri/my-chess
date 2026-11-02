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
  pagesRef: 'Checkmate with the queen',
  eco: 'KQK',
  relevance: 'core',
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
      annotation: 'The kings now face each other diagonally (c6 and a8) and the queen seals the rim: Black\'s king must step to a7.',
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
      prompt: 'White to play, with the king on c6. Deliver checkmate.',
      solutionSan: ['Qb7#'],
      explanation: '1.Qb7# delivers checkmate directly adjacent to Black\'s king, fully supported by the king on c6.',
    },
  ],
  mistakesAndTraps: [
    {
      // Reachable: the very first decision of this lesson (queen f1, kings e1 and e5)
      plyIndex: 0,
      attemptedSan: 'Qf5+',
      isTrap: true,
      severity: 'blunder',
      explanatoryFeedback: '1.Qf5+?? puts the queen next to the enemy king with nothing defending it: Black simply takes it. A check is only useful when the queen is safe and the king loses squares; here it loses the game-winning piece.',
      refutationSanList: ['Kxf5'],
      punishmentSummary: 'The queen is lost for nothing, and with only the two kings left the game is drawn.',
    },
  ],
});

export const stalemateCatastrophes: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-stalemate-catastrophes',
  title: 'Avoiding Stalemate',
  subtitle: 'Learn to recognize when the defending king is trapped without legal moves',
  category: 'fundamentals',
  sourceBook: 'LearningChess - Lessons for Beginners Vol 1',
  author: 'GM Jozsef Pinter',
  publicationYear: 2023,
  pagesRef: 'Stalemate',
  eco: 'Draw',
  initialFen: 'k7/8/1K1Q4/8/8/8/8/8 w - - 0 1',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  relevance: 'core',
  description:
    'Stalemate occurs when the player to move has no legal move and is not in check. The game is then drawn, however much material the other side has. Before a quiet queen move near the enemy king, ask: does my opponent still have a legal move after it?',
  thematicObjective: 'Never smother the opponent\'s king without delivering check. Always calculate checks first.',
  keyTacticalMotif: 'Stalemate prevention, back-rank checkmate',
  moves: [
    {
      san: 'Qd8#',
      isUserMove: true,
      annotation: 'Checkmate! 1.Qd8# (or 1.Qf8#) checks along the back rank; the a7 and b7 squares are covered by the White king, so Black has no escape.',
      hintPiece: 'Queen',
      hintSquare: 'd8',
      hintTheme: 'Deliver back-rank mate',
      accept: { predicate: 'checkmate' },
    },
  ],
  mistakesAndTraps: [
    {
      plyIndex: 0,
      attemptedSan: 'Qc7',
      isTrap: true,
      severity: 'blunder',
      explanatoryFeedback: '1.Qc7?? is stalemate: the black king is not in check and has no legal move, so the game is drawn. 1.Qd8# mates instead.',
      refutationSanList: [],
      punishmentSummary: 'A draw by stalemate in a position where White has mate in one.',
    },
  ],
  exercises: [
    {
      id: 'ex-stalemate-1',
      title: 'Mate, Don\'t Stalemate!',
      fen: 'k7/8/1K1Q4/8/8/8/8/8 w - - 0 1',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. Moving the queen to c7 would leave Black no legal move without giving check: stalemate, a draw. Find the move that gives checkmate.',
      solutionSan: ['Qd8#'],
      explanation: '1.Qd8# (1.Qf8# also works) delivers checkmate along the back rank. 1.Qc7?? would be stalemate, a draw.',
    },
  ],
});

export const rookBackRankMate: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-rook-back-rank-mate',
  title: 'Checkmate with the Rook: The Back-Rank Cage',
  subtitle: 'The rook keeps the king on the edge while your king walks up the board',
  category: 'fundamentals',
  sourceBook: 'Chess Fundamentals',
  author: 'José Raúl Capablanca',
  publicationYear: 1921,
  pagesRef: 'Some simple mates',
  eco: 'KRK',
  relevance: 'core',
  // Each White move is Stockfish 19's fastest mate (depth 18) and each Black move its longest defence
  initialFen: '4k3/8/8/8/8/8/8/4K2R w - - 0 1',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  description:
    'King and rook against a lone king: the mate that turns a won endgame into a win. The rook on the seventh rank keeps the black king on the back rank, your king walks up to the sixth, and when the two kings stand face to face the rook mates on the back rank. When they stand a knight\'s move apart, a waiting move with the rook makes the black king choose.',
  thematicObjective:
    'Rook to the seventh rank, king up to the sixth; a waiting rook move when the kings are a knight\'s move apart; mate on the back rank when they stand face to face, never a quiet move that leaves the king no move at all.',
  keyTacticalMotif: 'Cut-off on the seventh rank, kings face to face, waiting move, back-rank mate, stalemate check',
  moves: [
    {
      san: 'Rh7',
      isUserMove: true,
      annotation: 'The rook takes the seventh rank, so the black king cannot leave the back rank.',
      hintPiece: 'Rook',
      hintSquare: 'h7',
      hintTheme: 'Cut the king off on the edge',
      wrongMoveFeedback: {
        'Rh8+': 'A check that lets the king off the back rank: after 1.Rh8+ it steps up to the seventh. Put the rook on the seventh rank first.',
      },
    },
    { san: 'Kd8', isUserMove: false },
    {
      san: 'Kd2',
      isUserMove: true,
      annotation: 'The rook holds the seventh rank on its own, so the king can walk up the board toward the black king.',
      hintPiece: 'King',
      hintSquare: 'd2',
      hintTheme: 'Bring the king',
    },
    { san: 'Ke8', isUserMove: false },
    { san: 'Ke3', isUserMove: true, annotation: 'Up again, toward the black king.', hintPiece: 'King', hintSquare: 'e3' },
    { san: 'Kd8', isUserMove: false },
    { san: 'Kd4', isUserMove: true, hintPiece: 'King', hintSquare: 'd4' },
    { san: 'Kc8', isUserMove: false },
    { san: 'Kc5', isUserMove: true, hintPiece: 'King', hintSquare: 'c5' },
    { san: 'Kd8', isUserMove: false },
    {
      san: 'Kd6',
      isUserMove: true,
      annotation: 'Your king reaches the sixth rank. The kings stand face to face with Black to move, so the black king has to step aside.',
      hintPiece: 'King',
      hintSquare: 'd6',
      hintTheme: 'Face the king',
    },
    { san: 'Ke8', isUserMove: false },
    {
      san: 'Ra7',
      isUserMove: true,
      annotation:
        'A waiting move. The kings are a knight\'s move apart, and 7.Ke6 would put them face to face with Black to move again. The rook passes the move instead, along the seventh rank and away from the black king: if the king now steps to d8, in front of yours, Ra8 is mate.',
      hintPiece: 'Rook',
      hintSquare: 'a7',
      hintTheme: 'Pass the move with the rook',
      wrongMoveFeedback: {
        Ke6: '7.Ke6 puts the kings face to face with Black to move, and the black king simply steps aside again. Pass the move with the rook along the seventh rank instead.',
      },
    },
    { san: 'Kf8', isUserMove: false },
    {
      san: 'Ke6',
      isUserMove: true,
      annotation: 'Follow along the sixth rank, a knight\'s move away. If the king steps back to e8, in front of yours, Ra8 is mate.',
      hintPiece: 'King',
      hintSquare: 'e6',
    },
    { san: 'Kg8', isUserMove: false },
    { san: 'Kf6', isUserMove: true, annotation: 'A knight\'s move away again: f8 would be in front of your king.', hintPiece: 'King', hintSquare: 'f6' },
    { san: 'Kh8', isUserMove: false },
    {
      san: 'Kg6',
      isUserMove: true,
      annotation: 'The king in the corner has one move left, to g8, in front of yours.',
      hintPiece: 'King',
      hintSquare: 'g6',
      hintTheme: 'Mate, not stalemate',
      wrongMoveFeedback: {
        Rg7: '10.Rg7?? leaves the black king no legal move while it is not in check: stalemate, a draw.',
      },
    },
    { san: 'Kg8', isUserMove: false },
    {
      san: 'Ra8#',
      isUserMove: true,
      annotation: 'Mate: the rook checks along the back rank, and your king covers f7, g7 and h7.',
      hintPiece: 'Rook',
      hintSquare: 'a8',
      hintTheme: 'Back-rank mate',
      accept: { predicate: 'checkmate' },
    },
  ],
  exercises: [
    {
      id: 'ex-rook-mate-face-to-face',
      title: 'Face to Face',
      fen: '3k4/7R/3K4/8/8/8/8/8 w - - 0 1',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. The kings stand face to face and the rook holds the seventh rank. Give mate.',
      solutionSan: ['Rh8#'],
      explanation: '1.Rh8# checks along the back rank, and the white king covers c7, d7 and e7.',
    },
    {
      id: 'ex-rook-mate-corner',
      title: 'The Corner, Without Stalemate',
      fen: '7k/R7/5K2/8/8/8/8/8 w - - 0 1',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play and mate in two. Careful: one natural rook move leaves Black no legal move at all.',
      solutionSan: ['Kg6', 'Kg8', 'Ra8#'],
      explanation:
        '1.Kg6 leaves the king one move, to g8, and 2.Ra8# follows. 1.Rg7?? would be stalemate: the king on h8 is not in check and every square around it is covered.',
    },
  ],
  mistakesAndTraps: [
    {
      // The position after 9...Kh8 (kings f6 and h8, rook a7)
      plyIndex: 18,
      attemptedSan: 'Rg7',
      isTrap: true,
      severity: 'blunder',
      explanatoryFeedback: '10.Rg7?? is stalemate: the black king is not in check and has no legal move, so the game is drawn. 10.Kg6 Kg8 11.Ra8# mates instead.',
      refutationSanList: [],
      punishmentSummary: 'A draw by stalemate in a position where White has mate in two.',
    },
  ],
});

export const kingPawnOpposition: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-king-pawn-opposition',
  title: 'King and Pawn: Lead with the King',
  subtitle: 'Take the opposition, then let the pawn go while your king guards its path',
  category: 'fundamentals',
  sourceBook: 'Chess Fundamentals',
  author: 'José Raúl Capablanca',
  publicationYear: 1921,
  pagesRef: 'Pawn promotion',
  eco: 'KPK',
  relevance: 'core',
  // Every White move is the only one that wins, by an exact solution of the ending (scripts/game-analysis/kpk-solve.mjs);
  // each Black move is the longest defence
  initialFen: '3k4/8/4P3/3K4/8/8/8/8 w - - 0 1',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  description:
    'King and pawn against a lone king: a won ending that is easy to draw. The king goes first. When the two kings stand face to face with one square between them, the side that has to move must give way; with your king beside or in front of your pawn and the other king to move, your king gets through, and only then does the pawn advance, with your king guarding the squares in front of it.',
  thematicObjective:
    'King first: take the opposition, push the pawn when the defending king has had to step aside, guard the queening square with your king, and promote without stalemate.',
  keyTacticalMotif: 'Opposition, king in front of the pawn, the square of the pawn, stalemate check',
  moves: [
    {
      san: 'Kd6',
      isUserMove: true,
      annotation:
        'The kings stand face to face on the d-file with one square between them, and Black is to move: the black king has to give way. 1.Ke5? Ke7 lets the black king stand in front of the pawn with you to move, and 1.e7+? Kxe7 loses the pawn: both are draws.',
      hintPiece: 'King',
      hintSquare: 'd6',
      hintTheme: 'Take the opposition',
      wrongMoveFeedback: {
        Ke5: '1.Ke5? Ke7: the black king stands in front of the pawn, face to face with yours, and you are to move. It is a draw.',
        'e7+': '1.e7+? Kxe7: nothing defends the pawn, and king against king is a draw. The king goes first.',
      },
    },
    {
      san: 'Ke8',
      isUserMove: false,
      alternatives: {
        Kc8: [
          {
            san: 'e7',
            isUserMove: true,
            annotation: 'The black king has gone to the side your king covers: d7 is yours, so nothing stops the pawn, and 3.e8=Q comes next.',
            hintPiece: 'Pawn',
            hintSquare: 'e7',
            hintTheme: 'Now the pawn runs',
            accept: { san: ['Kc5', 'Kc6', 'Kd5', 'Ke5', 'Ke7'] },
          },
        ],
      },
    },
    {
      san: 'e7',
      isUserMove: true,
      annotation: 'Now the pawn goes, guarded by your king: the black king cannot take it, and its only move is to f7.',
      hintPiece: 'Pawn',
      hintSquare: 'e7',
      hintTheme: 'Push the pawn your king guards',
      wrongMoveFeedback: {
        Kc7: '2.Kc7? Ke7: the black king reaches the pawn first. It is a draw.',
        Ke5: '2.Ke5? Ke7: the black king stands in front of the pawn again. It is a draw.',
      },
    },
    { san: 'Kf7', isUserMove: false },
    {
      san: 'Kd7',
      isUserMove: true,
      annotation: 'Your king guards the queening square e8 and keeps guarding the pawn on e7: the pawn promotes next move.',
      hintPiece: 'King',
      hintSquare: 'd7',
      hintTheme: 'Guard the queening square',
      wrongMoveFeedback: {
        'e8=Q+': '3.e8=Q+?? Kxe8: nothing defends the new queen, and king against king is a draw. Guard e8 with your king first.',
      },
    },
    { san: 'Kf6', isUserMove: false },
    {
      san: 'e8=Q',
      isUserMove: true,
      annotation: 'The pawn promotes, and the queen mate from the first lesson of this group finishes the game.',
      hintPiece: 'Pawn',
      hintSquare: 'e8',
      hintTheme: 'Promote',
      accept: { san: ['e8=R', 'Kd6', 'Kd8', 'Ke8'] },
    },
  ],
  exercises: [
    {
      id: 'ex-king-pawn-opposition',
      title: 'Step in Front',
      fen: '8/8/4k3/8/5K2/4P3/8/8 w - - 0 1',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Only one move wins: where does your king go?',
      solutionSan: ['Ke4'],
      explanation:
        '1.Ke4: your king stands in front of its pawn, face to face with the black king, and Black is to move. Every other move draws; 1.e4? Kf6 lets the black king take the opposition.',
    },
    {
      id: 'ex-king-pawn-square',
      title: 'The Square of the Pawn',
      fen: '1K6/8/8/8/8/8/4P2k/8 w - - 0 1',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Your king is far away. Can the pawn win the race on its own?',
      solutionSan: ['e4'],
      explanation:
        '1.e4: draw the square from e4 to e8 and across to the h-file; after the double step the black king on h2 cannot step into it, so the pawn promotes. 1.e3? Kg3 brings the king into the square of the pawn on e3 in time, and it is a draw.',
    },
    {
      id: 'ex-king-pawn-stalemate',
      title: 'Promote, Not Stalemate',
      fen: '4k3/4P3/8/3K4/8/8/8/8 w - - 0 1',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play and win. Careful: one natural king move leaves Black no legal move at all.',
      solutionSan: ['Kd6', 'Kf7', 'Kd7'],
      explanation:
        '1.Kd6 Kf7 2.Kd7 guards e8 and the pawn promotes. 1.Ke6?? is stalemate: the black king on e8 is not in check, d7 and f7 are covered by your king, and d8 and f8 by the pawn.',
    },
  ],
  mistakesAndTraps: [
    {
      // The position after 2...Kf7 (kings d6 and f7, pawn e7)
      plyIndex: 4,
      attemptedSan: 'e8=Q+',
      isTrap: true,
      severity: 'blunder',
      explanatoryFeedback: '3.e8=Q+?? Kxe8: the new queen stands where nothing defends it, and the black king takes it. 3.Kd7 guards e8 first, and the pawn promotes next move.',
      refutationSanList: ['Kxe8'],
      punishmentSummary: 'A won ending drawn: king against king.',
    },
  ],
});

export const fundamentalsLessons: CurriculumLesson[] = [
  queenCageBoxMate,
  rookBackRankMate,
  kingPawnOpposition,
  stalemateCatastrophes,
];
