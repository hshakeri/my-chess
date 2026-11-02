import { CurriculumLesson } from '../types/curriculum';
import { buildVerifiedLesson } from './builder';

/**
 * Black repertoire lessons: the c6-d5 wall against 1.d4 (decision 2 of the pedagogy audit)
 * and the Caro-Kann lines hoot65 actually reaches. Each lesson is the interactive form of a
 * line in `src/analytics/repertoire.ts`.
 *
 * Archive weights. Against 1.d4 hoot65 answered 1...Nf6 in 29 of 30 games, so White's second
 * and third moves are counted from those games: the London, 2.c4 and 2.Nc3 players are the same
 * opponents whatever Black's first move is. Counts against 1.e4 c6 are exact (67 games). Against
 * 1.c4 and 1.Nf3 (6 games, 1...Nf6 in 4 of them) White's second move is counted the same way.
 */

const SOURCE = {
  sourceBook: 'Chess.com Live Archive',
  author: 'hoot65 Diagnostic Analysis',
  publicationYear: 2026,
} as const;

/**
 * hoot65's own first moves as Black, answered where a lesson asks for the repertoire's: 1...d6
 * against 1.e4 and 1...Nf6 against 1.d4 are what the seed games show most after the repertoire's
 * moves (counts and points from src/data/seed_hoot65_games.json).
 */
const AGAINST_E4 = {
  d6: '1...d6 is your other answer to 1.e4 (41 of your games, 20 points; the Caro-Kann scored 36 in 67). This course trains the Caro-Kann: 1...c6.',
};
const AGAINST_D4 = {
  Nf6: '1...Nf6 was your move in 29 of your 30 games against 1.d4 (11 points). This course trains the c6-d5 wall: 1...d5, then ...c6.',
};

export const slavWallLesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-slav-wall',
  title: 'The Wall Against 2.c4 (Slav)',
  subtitle: 'Support d5 with the c-pawn, take on c4 when the knights are out, and develop the bishop before ...e6',
  category: 'opening',
  eco: 'D17',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    'Against 2.c4 you scored 2 points in 7 games. The Slav keeps the Caro-Kann structure: pawns on c6 and d5, the light-squared bishop out to f5 before ...e6. After 3.Nc3 Nf6 4.Nf3 Black takes on c4; if White plays 5.a4 to stop ...b5, the bishop comes to f5 and later to b4, a square no white pawn can attack any more.',
  thematicObjective:
    'Pawns on c6 and d5. Take on c4 once the knights are out. Bishop to f5 before ...e6, then ...Bb4 and castle.',
  keyTacticalMotif: 'Bishop outside the pawn chain; pin on the c3 knight from b4',
  moves: [
    { san: 'd4', isUserMove: false },
    {
      san: 'd5',
      isUserMove: true,
      annotation: 'The same pawn as the Caro-Kann\'s ...d5: it claims e4 and c4.',
      hintTheme: 'Claim the centre',
      wrongMoveFeedback: AGAINST_D4,
    },
    {
      san: 'c4',
      isUserMove: false,
      // After 1.d4 Nf6 White's second move was 2.Bf4 11, 2.c4 7, 2.Nc3 6, 2.Bg5 3, 2.e3 1, 2.Nf3 1.
      frequency: 7,
      annotation: 'The Queen\'s Gambit: White attacks d5 with a second pawn.',
      alternatives: {
        Nf3: [
          {
            san: 'c6',
            isUserMove: true,
            frequency: 1,
            annotation: 'Against 2.Nf3 the wall is the same: c6 supports d5 and commits to nothing.',
          },
          { san: 'c4', isUserMove: false, annotation: 'A Slav by another move order.' },
          { san: 'Nf6', isUserMove: true, annotation: 'The same position as 2.c4 c6 3.Nf3 Nf6.' },
          { san: 'Nc3', isUserMove: false },
          { san: 'dxc4', isUserMove: true, annotation: 'Take now that both white knights are out, as in the main line.' },
          { san: 'a4', isUserMove: false },
          { san: 'Bf5', isUserMove: true, annotation: 'Bishop out before ...e6. From here the main line continues.' },
        ],
      },
    },
    {
      san: 'c6',
      isUserMove: true,
      annotation: 'The Slav. c6 supports d5, and unlike ...e6 it leaves the c8 bishop\'s diagonal open.',
      hintTheme: 'Support d5 without shutting in the bishop',
      wrongMoveFeedback: {
        e6: '2...e6 is the Queen\'s Gambit Declined: solid, but the c8 bishop is shut in behind the e6 pawn. The wall uses c6 so the bishop can come out first.',
        dxc4: 'Taking at once is the Queen\'s Gambit Accepted, a different structure. In the wall the pawn on d5 stays supported, and Black takes on c4 later.',
      },
    },
    {
      san: 'Nc3',
      isUserMove: false,
      // After 1.d4 Nf6 2.c4 c6: 3.Nc3 4, 3.Nf3 1.
      frequency: 4,
      alternatives: {
        Nf3: [
          {
            san: 'Nf6',
            isUserMove: true,
            frequency: 1,
            annotation: 'Develop the knight. With the c6 pawn and the queen, d5 now has three defenders.',
          },
          { san: 'Nc3', isUserMove: false, annotation: 'The main-line position by another move order.' },
          { san: 'dxc4', isUserMove: true, annotation: 'Take on c4, as in the main line.' },
        ],
        cxd5: [
          {
            san: 'cxd5',
            isUserMove: true,
            annotation: 'The Exchange Slav. Recapture with the c-pawn: the position is symmetrical and the c8 bishop is still free.',
          },
          { san: 'Nf3', isUserMove: false },
          { san: 'Nf6', isUserMove: true, annotation: 'Develop and guard d5.' },
          { san: 'Nc3', isUserMove: false },
          { san: 'Nc6', isUserMove: true, annotation: 'Develop the second knight; it covers d4 and e5.' },
          { san: 'Bf4', isUserMove: false },
          {
            san: 'Bf5',
            isUserMove: true,
            annotation: 'Copy White\'s bishop: out to f5 before ...e6, exactly as in the Caro-Kann.',
            hintTheme: 'Bishop out before ...e6',
          },
        ],
      },
    },
    {
      san: 'Nf6',
      isUserMove: true,
      annotation:
        'Develop the knight. d5 is attacked twice (the c4 pawn and the c3 knight) and now defended three times (the c6 pawn, the f6 knight and the queen).',
    },
    { san: 'Nf3', isUserMove: false },
    {
      san: 'dxc4',
      isUserMove: true,
      annotation: 'Take the pawn now that both white knights are out. If White does not stop it, ...b5 will defend it.',
      hintTheme: 'Take the gambit pawn at the right moment',
    },
    {
      san: 'a4',
      isUserMove: false,
      annotation: 'White stops ...b5: the a4 pawn attacks b5.',
      alternatives: {
        e3: [
          {
            san: 'b5',
            isUserMove: true,
            annotation: 'Without a4, ...b5 defends the c4 pawn, so White has to work to win it back.',
            hintTheme: 'Defend the extra pawn',
          },
        ],
      },
    },
    {
      san: 'Bf5',
      isUserMove: true,
      annotation:
        'The bishop comes out before ...e6, the Caro-Kann idea in a Slav. White wins the c4 pawn back with e3 and Bxc4, which takes two moves.',
      hintTheme: 'Bishop out before ...e6',
      wrongMoveFeedback: {
        e6: '5...e6 shuts the c8 bishop in behind its own pawns. Bring it to f5 first; ...e6 comes next move.',
      },
    },
    { san: 'e3', isUserMove: false },
    {
      san: 'e6',
      isUserMove: true,
      annotation: 'Now ...e6 shuts nothing in: the bishop is already outside, and the f8 bishop\'s diagonal opens.',
    },
    { san: 'Bxc4', isUserMove: false, annotation: 'White takes the pawn back.' },
    {
      san: 'Bb4',
      isUserMove: true,
      annotation:
        'The bishop takes the b4 square and pins the c3 knight against the king on e1. With the a-pawn on a4 and the c-pawn gone, no white pawn can chase it.',
      hintTheme: 'Pin the c3 knight',
      arrows: [{ from: 'b4', to: 'e1', color: 'red' }],
    },
    { san: 'O-O', isUserMove: false },
    {
      san: 'O-O',
      isUserMove: true,
      annotation: 'Castled, with the wall intact and both bishops outside it. ...Nbd7 comes next.',
    },
  ],
  exercises: [
    {
      id: 'ex-slav-bishop-diagonal',
      title: 'The Bishop Outside the Chain',
      // 1.d4 d5 2.c4 c6 3.Nc3 Nf6 4.Nf3 dxc4 5.a4 Bf5 6.e3 e6 7.Bxc4 Bb4 8.O-O O-O 9.Qc2
      fen: 'rn1q1rk1/pp3ppp/2p1pn2/5b2/PbBP4/2N1PN2/1PQ2PPP/R1B2RK1 b - - 4 9',
      turn: 'b',
      difficultyRating: 1,
      prompt: 'Black to play. White put the queen on c2 to prepare e4. What does Black play?',
      solutionSan: ['Bxc2'],
      explanation:
        '9...Bxc2 wins the queen: c2 lies on the f5 bishop\'s diagonal (e4 and d3 are empty) and nothing defends it. This is why the bishop comes out before ...e6: from f5 it watches c2, d3 and e4.',
    },
  ],
});

export const londonWallLesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-wall-vs-london',
  title: 'The Wall Against the London',
  subtitle: 'Mirror the London bishop, trade it on d3, and hit the b2 pawn that nothing defends',
  category: 'opening',
  eco: 'D02',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    'The London (2.Bf4) was the most common system you met against 1.d4: 11 of 30 games, 5 points. Against it Black plays the Caro-Kann set-up: c6 and d5, the bishop to f5 before ...e6, and a trade of light-squared bishops on d3. Once the f4 bishop has left c1, nothing defends b2, and ...Qb6 makes White spend a move on it.',
  thematicObjective:
    'c6 and d5; ...Bf5 before ...e6; trade on d3; ...Qb6 at the undefended b2 pawn; then ...Nf6, ...Nbd7, ...Be7 and castle.',
  keyTacticalMotif: 'Attack on the undefended b2 pawn after the c1 bishop has left',
  moves: [
    { san: 'd4', isUserMove: false },
    { san: 'd5', isUserMove: true, annotation: 'The wall starts with d5, as against 2.c4.', wrongMoveFeedback: AGAINST_D4 },
    {
      san: 'Bf4',
      isUserMove: false,
      // After 1.d4 Nf6: 2.Bf4 11, 2.Nf3 1.
      frequency: 11,
      annotation: 'The London bishop. It has left c1, so nothing defends b2 any more.',
      alternatives: {
        Nf3: [
          {
            san: 'c6',
            isUserMove: true,
            frequency: 1,
            annotation: 'Against 2.Nf3 the wall is the same: c6 supports d5 and waits to see where White\'s bishop goes.',
          },
          { san: 'Bf4', isUserMove: false, annotation: 'The London by another move order.' },
          { san: 'Bf5', isUserMove: true, annotation: 'Meet the bishop the same way: out to f5 before ...e6.' },
          { san: 'e3', isUserMove: false },
          { san: 'e6', isUserMove: true, annotation: 'The main-line position: ...Bxd3 and ...Qb6 come next.' },
        ],
      },
    },
    {
      san: 'c6',
      isUserMove: true,
      annotation: 'c6 supports d5 and keeps ...Qb6 ready: from b6 the queen will look at b2.',
      hintTheme: 'Build the wall',
    },
    {
      san: 'e3',
      isUserMove: false,
      // After 1.d4 Nf6 2.Bf4 c6: 3.e3 2, 3.Nf3 1.
      frequency: 2,
      alternatives: {
        Nf3: [
          { san: 'Bf5', isUserMove: true, frequency: 1, annotation: 'Bishop out before ...e6.' },
          { san: 'e3', isUserMove: false },
          { san: 'e6', isUserMove: true, annotation: 'The main-line position by another move order.' },
        ],
      },
    },
    {
      san: 'Bf5',
      isUserMove: true,
      annotation: 'Mirror White\'s bishop: out to f5 before ...e6 shuts it in.',
      hintTheme: 'Bishop out before ...e6',
      wrongMoveFeedback: {
        e6: '3...e6 shuts the c8 bishop in. Bring it to f5 first; ...e6 comes next move.',
        Bg4: '3...Bg4?? hangs the bishop: after 3.e3 the e2 square is empty, so the queen on d1 takes on g4. Bring it to f5.',
      },
    },
    {
      san: 'Nf3',
      isUserMove: false,
      alternatives: {
        c4: [
          { san: 'e6', isUserMove: true, annotation: 'White hits d5 with a second pawn; ...e6 keeps it supported, and the bishop is already out.' },
          { san: 'Qb3', isUserMove: false, annotation: 'With the c-pawn gone from c2 the queen can reach b3, and b7 has lost the c8 bishop\'s protection.' },
          {
            san: 'Qb6',
            isUserMove: true,
            annotation: 'Defend b7 and offer the trade of queens.',
            hintTheme: 'Defend b7 and offer the trade',
          },
          { san: 'Qxb6', isUserMove: false },
          {
            san: 'axb6',
            isUserMove: true,
            annotation: 'The a-pawn takes back, and the a8 rook gets the half-open a-file.',
          },
        ],
      },
    },
    { san: 'e6', isUserMove: true, annotation: 'The wall is complete: c6, d5 and e6 with the bishop already outside it.' },
    { san: 'Bd3', isUserMove: false, annotation: 'White offers the bishop trade.' },
    {
      san: 'Bxd3',
      isUserMove: true,
      annotation: 'Take: it removes White\'s attacking bishop, and the queen that recaptures has to leave d1.',
      hintTheme: 'Trade the light-squared bishops',
    },
    { san: 'Qxd3', isUserMove: false },
    {
      san: 'Qb6',
      isUserMove: true,
      annotation: 'The point of the plan: the queen hits b2, which nothing defends, so White has to spend a move on it.',
      hintTheme: 'Attack the undefended pawn',
      arrows: [{ from: 'b6', to: 'b2', color: 'red' }],
    },
    { san: 'b3', isUserMove: false, annotation: 'White removes the pawn from the queen\'s line.' },
    { san: 'Nf6', isUserMove: true, annotation: 'With b2 dealt with, develop.' },
    { san: 'O-O', isUserMove: false },
    { san: 'Nbd7', isUserMove: true, annotation: 'The knight goes to d7, keeping c6 for the pawn; ...Be7 and ...O-O follow.' },
    { san: 'c4', isUserMove: false },
    { san: 'Be7', isUserMove: true, annotation: 'Develop before reacting in the centre: d5 is covered by the c6 and e6 pawns and the f6 knight.' },
    { san: 'Nc3', isUserMove: false },
    {
      san: 'O-O',
      isUserMove: true,
      annotation: 'Castled with the wall intact and every piece developed.',
    },
  ],
  exercises: [
    {
      id: 'ex-london-queen-pin',
      title: 'Guarding b2 the Wrong Way',
      // 1.d4 d5 2.Bf4 c6 3.e3 Bf5 4.Nf3 e6 5.Bd3 Bxd3 6.Qxd3 Qb6 7.Qc3
      fen: 'rn2kbnr/pp3ppp/1qp1p3/3p4/3P1B2/2Q1PN2/PPP2PPP/RN2K2R b KQkq - 2 7',
      turn: 'b',
      difficultyRating: 2,
      prompt: 'Black to play. White answered ...Qb6 by guarding b2 with 7.Qc3. What does Black play?',
      solutionSan: ['Bb4'],
      explanation:
        '7...Bb4 pins the queen to the king on e1 (d2 is empty). The queen can only take on b4, where the b6 queen takes back with check, or step to d2, where the bishop takes it: either way White loses the queen for a bishop. 7.b3 or 7.Qc2 deal with b2 safely.',
    },
  ],
});

export const wallVsNc3Bg5Lesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-wall-vs-nc3-bg5',
  title: 'The Wall Against 2.Nc3 and 2.Bg5',
  subtitle: 'The same c6-d5 set-up turns 2.Nc3 and 3.e4 into a Caro-Kann you already know',
  category: 'opening',
  eco: 'D00',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    '2.Nc3 and 2.Bg5 came up in 9 of your 30 games against 1.d4 (4 points). With the wall, 2.Nc3 c6 3.e4 dxe4 4.Nxe4 Bf5 is the Caro-Kann Classical, the same position as 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5. Against 2.Bg5 the bishop has left c1, so ...Qb6 hits b2 as it does against the London.',
  thematicObjective:
    'Against 2.Nc3: ...c6, and if 3.e4 take and play ...Bf5 (the Classical Caro-Kann). Against 2.Bg5: ...c6 and ...Qb6 at b2, then ...Bf5.',
  keyTacticalMotif: 'Transposition into the Caro-Kann; attack on b2 after the c1 bishop leaves',
  moves: [
    { san: 'd4', isUserMove: false },
    { san: 'd5', isUserMove: true, wrongMoveFeedback: AGAINST_D4 },
    {
      san: 'Nc3',
      isUserMove: false,
      // After 1.d4 Nf6: 2.Nc3 6, 2.Bg5 3.
      frequency: 6,
      alternatives: {
        Bg5: [
          { san: 'c6', isUserMove: true, frequency: 3, annotation: 'The wall again. The g5 bishop has left c1, so b2 has lost its defender.' },
          { san: 'e3', isUserMove: false },
          {
            san: 'Qb6',
            isUserMove: true,
            annotation: 'Hit b2, which nothing defends now that the c1 bishop is on g5.',
            hintTheme: 'Attack the undefended pawn',
            arrows: [{ from: 'b6', to: 'b2', color: 'red' }],
          },
          { san: 'Qc1', isUserMove: false, annotation: 'The queen guards b2.' },
          {
            san: 'Bf5',
            isUserMove: true,
            annotation: 'Bishop out before ...e6, and the wall is complete after ...e6 and ...Nd7.',
          },
        ],
      },
    },
    {
      san: 'c6',
      isUserMove: true,
      annotation: 'Keep the wall. If White plays e4, the game becomes a Caro-Kann.',
      hintTheme: 'Same structure against everything',
    },
    {
      san: 'e4',
      isUserMove: false,
      // After 1.d4 Nf6 2.Nc3 c6: 3.e4 4, 3.Bf4 2.
      frequency: 4,
      annotation: 'This is the Caro-Kann: the same position as 1.e4 c6 2.d4 d5 3.Nc3.',
      alternatives: {
        Bf4: [
          { san: 'Bf5', isUserMove: true, frequency: 2, annotation: 'Against the bishop on f4, the London plan: bishop out before ...e6.' },
          { san: 'e3', isUserMove: false },
          { san: 'e6', isUserMove: true },
          { san: 'Nf3', isUserMove: false },
          { san: 'Nf6', isUserMove: true, annotation: 'Develop; ...Nbd7, ...Be7 and castling follow, and ...Qb6 at b2 is an option.' },
        ],
      },
    },
    {
      san: 'dxe4',
      isUserMove: true,
      annotation: 'Take on e4, as in the Caro-Kann Classical.',
    },
    { san: 'Nxe4', isUserMove: false },
    {
      san: 'Bf5',
      isUserMove: true,
      annotation: 'Develop the bishop with a gain of time on the e4 knight.',
      hintTheme: 'Develop with tempo',
    },
    { san: 'Ng3', isUserMove: false },
    {
      san: 'Bg6',
      isUserMove: true,
      annotation: 'The bishop steps back to g6 and stays on the h7-b1 diagonal. The Caro-Kann Classical lesson continues from here.',
    },
  ],
  exercises: [
    {
      id: 'ex-caro-smothered-d6',
      title: 'Why Move Order Matters',
      // 1.d4 d5 2.Nc3 c6 3.e4 dxe4 4.Nxe4 Nd7 5.Qe2 Ngf6
      fen: 'r1bqkb1r/pp1npppp/2p2n2/8/3PN3/8/PPP1QPPP/R1B1KBNR w KQkq - 3 6',
      turn: 'w',
      difficultyRating: 2,
      prompt:
        'White to play. Black chose 4...Nd7 instead of 4...Bf5, and after 5.Qe2 developed the other knight to f6. Find White\'s move.',
      solutionSan: ['Nd6#'],
      explanation:
        '6.Nd6# is checkmate: the e7 pawn is pinned to the king by the queen on e2, so it cannot take the knight, and the king is boxed in by its own pieces. With 4...Bf5 this never happens: the bishop chases the knight off e4 first.',
    },
  ],
});

export const caroKannAdvanceLesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-caro-kann-advance',
  title: 'Caro-Kann: Against the Advance',
  subtitle: 'Bishop out first, then ...e6 and the ...c5 strike at the base of White\'s chain',
  category: 'opening',
  eco: 'B12',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    'The Advance (3.e5) came up in 14 of your games and you scored 8.5 points; you found 3...Bf5 every time. This lesson drills what comes after: ...e6, then ...c5 against d4, with ...Nc6, the trade on d4 and ...Qb6 adding pressure. When c5 itself is attacked, the b8 knight goes to d7, where it also hits e5. Against 4.Bd3 trade the bishops.',
  thematicObjective:
    '3...Bf5, then ...e6, ...c5 and ...Nc6; take on d4 before ...Qb6, which then hits b2 and d4. Against Bd3 trade on d3.',
  keyTacticalMotif: 'Undermining the pawn chain at d4; counting attackers on d4',
  moves: [
    { san: 'e4', isUserMove: false },
    { san: 'c6', isUserMove: true, wrongMoveFeedback: AGAINST_E4 },
    { san: 'd4', isUserMove: false },
    { san: 'd5', isUserMove: true },
    { san: 'e5', isUserMove: false, frequency: 14, annotation: 'The Advance Variation: White gains space and closes the centre.' },
    {
      san: 'Bf5',
      isUserMove: true,
      annotation: 'The bishop comes out before ...e6 locks it in. You played this in all 14 games.',
      hintTheme: 'Bishop outside the chain',
      wrongMoveFeedback: {
        e6: '3...e6 shuts the c8 bishop in behind the e6-d5 chain. Bring it out to f5 first.',
        Bg4: '3...Bg4?? hangs the bishop: the e-pawn has left e2, so the queen on d1 takes on g4. f5 is the square.',
      },
    },
    {
      san: 'Nf3',
      isUserMove: false,
      // After 3...Bf5: 4.Nf3 6, 4.Bd3 3, then 4.c4, 4.Nc3, 4.Bf4, 4.g3 and 4.f4 once each.
      frequency: 6,
      alternatives: {
        Bd3: [
          {
            san: 'Bxd3',
            isUserMove: true,
            frequency: 3,
            annotation: 'Trade the bishops: White\'s bishop was the piece meant to attack along the b1-h7 diagonal.',
            hintTheme: 'Trade the bishop that challenges yours',
            wrongMoveFeedback: {
              g6: '4...g6? lost in your game 172269466994: 5.Bxf5 gxf5 left doubled f-pawns. Take on d3 instead.',
              Bg6: '4...Bg6 is playable too (you won both games with it); if White takes on g6, hxg6 recaptures away from the centre. Taking on d3 keeps the pawns where they are.',
            },
          },
          { san: 'Qxd3', isUserMove: false },
          { san: 'e6', isUserMove: true, annotation: 'Now the wall: c6, d5, e6.' },
          { san: 'Nf3', isUserMove: false },
          {
            san: 'c5',
            isUserMove: true,
            annotation: 'The Caro-Kann break: strike at d4, the base of White\'s pawn chain.',
            hintTheme: 'Hit the base of the chain',
          },
        ],
      },
    },
    {
      san: 'e6',
      isUserMove: true,
      annotation: 'With the bishop outside, ...e6 completes the wall and opens the f8 bishop.',
    },
    {
      san: 'c3',
      isUserMove: false,
      // After 4.Nf3 e6: 5.c3 2, 5.Bd3 2, 5.c4 1, 5.b3 1.
      frequency: 2,
      annotation: 'White supports d4 with a second pawn.',
      alternatives: {
        Bd3: [
          { san: 'Bxd3', isUserMove: true, frequency: 2, annotation: 'Trade the bishops, as against 4.Bd3.' },
          { san: 'Qxd3', isUserMove: false },
          { san: 'c5', isUserMove: true, annotation: 'Strike at d4.' },
          { san: 'c3', isUserMove: false },
          { san: 'Nc6', isUserMove: true, annotation: 'The knight adds a second attacker on d4.' },
        ],
        Be2: [
          { san: 'c5', isUserMove: true, annotation: 'Strike at d4.' },
          { san: 'Be3', isUserMove: false, annotation: 'The bishop guards d4 and backs up dxc5.' },
          {
            san: 'Nd7',
            isUserMove: true,
            annotation: 'The b8 knight comes to d7: it defends c5 and attacks e5. The g8 knight will go to e7.',
            hintTheme: 'Defend c5 and hit e5',
          },
          { san: 'O-O', isUserMove: false },
          { san: 'Ne7', isUserMove: true, annotation: 'The second knight heads for c6, where it hits d4.' },
        ],
      },
    },
    {
      san: 'c5',
      isUserMove: true,
      annotation: 'The Caro-Kann break: c5 hits d4, the base of White\'s pawn chain.',
      hintTheme: 'Hit the base of the chain',
      arrows: [{ from: 'c5', to: 'd4', color: 'red' }],
    },
    { san: 'Be2', isUserMove: false },
    { san: 'Nc6', isUserMove: true, annotation: 'A second attacker on d4.' },
    { san: 'O-O', isUserMove: false },
    {
      san: 'cxd4',
      isUserMove: true,
      annotation: 'Trade on d4 first. With the c-pawns gone White can no longer meet ...Qb6 with dxc5, and the c-file is open.',
      hintTheme: 'Release the tension before the queen comes out',
      wrongMoveFeedback: {
        Qb6: '7...Qb6 at once allows 8.dxc5 Bxc5 9.b4: the pawn hits the bishop, and it can go on to b5 against the c6 knight. Take on d4 first, then ...Qb6.',
      },
    },
    { san: 'cxd4', isUserMove: false },
    {
      san: 'Qb6',
      isUserMove: true,
      accept: { san: ['Nge7'] },
      annotation:
        'Now the queen hits b2 and d4. d4 is attacked by the c6 knight and the queen and defended by the f3 knight and the d1 queen; b2 is guarded only by the c1 bishop, so watch for the moment it leaves.',
      hintTheme: 'Pile up on d4',
    },
  ],
  exercises: [
    {
      id: 'ex-advance-queen-on-b-file',
      title: 'Look Along the b-File',
      // 1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3 e6 5.c3 c5 6.Be2 Nc6 7.O-O cxd4 8.cxd4 Qb6 9.Bb5
      fen: 'r3kbnr/pp3ppp/1qn1p3/1B1pPb2/3P4/5N2/PP3PPP/RNBQ1RK1 b kq - 2 9',
      turn: 'b',
      difficultyRating: 1,
      prompt: 'Black to play. White moved the bishop to b5 to pin the c6 knight. What does Black play?',
      solutionSan: ['Qxb5'],
      explanation:
        '9...Qxb5 wins a bishop: the queen on b6 looks straight down the b-file, and nothing defends b5. Before you worry about a pin, check what your own pieces attack.',
    },
    {
      id: 'ex-advance-b2-after-be3',
      title: 'When the c1 Bishop Leaves',
      // 1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3 e6 5.c3 c5 6.Be2 Nc6 7.O-O cxd4 8.cxd4 Qb6 9.Be3
      fen: 'r3kbnr/pp3ppp/1qn1p3/3pPb2/3P4/4BN2/PP2BPPP/RN1Q1RK1 b kq - 2 9',
      turn: 'b',
      difficultyRating: 1,
      prompt: 'Black to play. White guarded d4 with 9.Be3. What does Black play?',
      solutionSan: ['Qxb2'],
      explanation:
        '9...Qxb2 wins a pawn: the bishop has left c1, so nothing defends b2. Whenever that bishop moves, look at b2.',
    },
  ],
});

export const caroKannBg4TimingLesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-caro-bg4-timing',
  title: 'Caro-Kann vs 2.Nf3 and 2.Nc3: When the Pin Is Safe',
  subtitle: 'A pin on g4 is safe when a pawn on d4 or e4 closes the fourth rank',
  category: 'opening',
  eco: 'B10',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    '2.Nf3 and 2.Nc3 came up in 24 of your Caro-Kann games (14 points). ...Bg4 is a natural move in these lines and one you play often; this lesson shows when it is safe. Once Black has recaptured on d5 with the c-pawn, the a4-e8 diagonal is open, so a queen on a4 gives check. If the fourth rank is open too (no pawn on d4 or e4), that check also attacks a bishop on g4. A pawn on d4 or e4 closes the rank and the pin is safe.',
  thematicObjective:
    'Before ...Bg4 ask: is there a knight on f3 to pin, and is the fourth rank closed by a pawn on d4 or e4? If c3 has opened the way to a4 and the rank is open, develop first.',
  keyTacticalMotif: 'Queen check on a4 that also hits g4 along an open fourth rank',
  moves: [
    { san: 'e4', isUserMove: false },
    { san: 'c6', isUserMove: true, wrongMoveFeedback: AGAINST_E4 },
    {
      san: 'Nf3',
      isUserMove: false,
      // After 1.e4 c6: 2.d4 25, 2.Nf3 20, 2.Bc4 8, 2.Nc3 4.
      frequency: 20,
      alternatives: {
        Nc3: [
          { san: 'd5', isUserMove: true, frequency: 4 },
          {
            san: 'exd5',
            isUserMove: false,
            // After 2.Nc3 d5: 3.exd5 3, 3.Nf3 1.
            frequency: 3,
            alternatives: {
              Nf3: [
                {
                  san: 'Bg4',
                  isUserMove: true,
                  frequency: 1,
                  annotation: 'The Two Knights Caro-Kann. Here ...Bg4 is the book move: the e4 pawn closes the fourth rank.',
                  hintTheme: 'Pin the knight',
                },
                { san: 'h3', isUserMove: false },
                {
                  san: 'Bxf3',
                  isUserMove: true,
                  annotation: 'Take. Retreating to h5 invites g4 and a chase.',
                },
                { san: 'Qxf3', isUserMove: false },
                {
                  san: 'e6',
                  isUserMove: true,
                  annotation: 'The e6 pawn closes the c4-f7 diagonal, so no bishop can join the queen against f7.',
                },
              ],
            },
          },
          { san: 'cxd5', isUserMove: true },
          { san: 'd4', isUserMove: false, frequency: 3 },
          {
            san: 'Nf6',
            isUserMove: true,
            annotation: 'Develop the knight first; the bishop decides once White\'s king knight comes out.',
            wrongMoveFeedback: {
              Bf5: '4...Bf5 is a normal move too (it was your choice in all three of these games). This lesson develops the knight first and keeps the bishop\'s choice open.',
            },
          },
          { san: 'Nf3', isUserMove: false },
          {
            san: 'Bg4',
            isUserMove: true,
            annotation: 'Now the pin is safe: the d4 pawn closes the fourth rank.',
            hintTheme: 'Pin with the rank closed',
          },
        ],
      },
    },
    { san: 'd5', isUserMove: true },
    {
      san: 'exd5',
      isUserMove: false,
      // After 2.Nf3 d5: 3.exd5 8, 3.e5 8, 3.d3 2.
      frequency: 8,
      alternatives: {
        e5: [
          {
            san: 'Bg4',
            isUserMove: true,
            frequency: 8,
            annotation:
              'Safe at once: with the c6 pawn at home, a queen on a4 gives no check. You played this in 7 of 8 games.',
            hintTheme: 'Pin the knight',
          },
          {
            san: 'd4',
            isUserMove: false,
            // After 3.e5 Bg4: 4.d4 4, 4.h3 2, 4.Be2 1.
            frequency: 4,
            alternatives: {
              h3: [
                {
                  san: 'Bxf3',
                  isUserMove: true,
                  frequency: 2,
                  annotation: 'Take when h3 comes: after ...Bh5 g4 the bishop is chased again.',
                },
                { san: 'Qxf3', isUserMove: false },
                {
                  san: 'e6',
                  isUserMove: true,
                  annotation: 'The e6 pawn closes the c4-f7 diagonal before a bishop can join the queen against f7.',
                },
              ],
            },
          },
          { san: 'e6', isUserMove: true, annotation: 'The wall: c6, d5, e6, with the bishop already outside.' },
          { san: 'Be2', isUserMove: false, frequency: 2 },
          { san: 'c5', isUserMove: true, annotation: 'Strike at d4, the base of the chain, as in the Advance.' },
        ],
      },
    },
    {
      san: 'cxd5',
      isUserMove: true,
      annotation: 'Recapture with the c-pawn. c6 is now empty, so the a4-e8 diagonal to the king is open: remember it before every ...Bg4.',
    },
    {
      san: 'd4',
      isUserMove: false,
      // After 3.exd5 cxd5: 4.d4 3, 4.Bb5+ 2, 4.c3 1, 4.d3 1, 4.Nc3 1.
      frequency: 3,
      alternatives: {
        c3: [
          {
            san: 'Nc6',
            isUserMove: true,
            frequency: 1,
            annotation: 'Develop first. The c3 pawn has opened the d1-a4 diagonal, and nothing closes the fourth rank yet.',
            hintTheme: 'Develop before you pin',
            wrongMoveFeedback: {
              Bg4: 'With c3 played the queen can reach a4, and no pawn stands on d4 or e4: 5.Qa4+ checks and attacks g4 at once. Only ...Bd7 or ...Qd7 keep the bishop; blocking with ...Nc6 or ...Nd7 drops it to Qxg4. Develop first and pin once a pawn is on d4.',
            },
          },
          { san: 'd4', isUserMove: false, annotation: 'Now the d4 pawn closes the fourth rank.' },
          { san: 'Bg4', isUserMove: true, annotation: 'With the rank closed, a check on a4 no longer reaches g4.' },
        ],
      },
    },
    {
      san: 'Bg4',
      isUserMove: true,
      annotation: 'The pin is safe: the d4 pawn closes the fourth rank, so a queen on a4 could never reach g4.',
      hintTheme: 'Pin with the rank closed',
      arrows: [{ from: 'g4', to: 'd1', color: 'red' }],
    },
    { san: 'Be2', isUserMove: false, annotation: 'White breaks the pin to the queen with a developing move.' },
    { san: 'Nc6', isUserMove: true, annotation: 'Develop and add pressure on d4.' },
    { san: 'O-O', isUserMove: false },
    {
      san: 'e6',
      isUserMove: true,
      annotation: 'Complete the wall. The c8 bishop is already outside, and the f8 bishop can come out.',
    },
  ],
  exercises: [
    {
      id: 'ex-caro-qa4-check',
      title: 'The Check That Hits g4',
      // 1.e4 c6 2.Nf3 d5 3.exd5 cxd5 4.c3 Bg4 5.Qa4+ Nc6
      fen: 'r2qkbnr/pp2pppp/2n5/3p4/Q5b1/2P2N2/PP1P1PPP/RNB1KB1R w KQkq - 3 6',
      turn: 'w',
      difficultyRating: 2,
      prompt:
        'White to play. After 4.c3 Bg4 5.Qa4+ Black blocked the check with the knight. What does White play?',
      solutionSan: ['Qxg4'],
      explanation:
        '6.Qxg4 wins the bishop: the queen on a4 attacks g4 along the empty fourth rank, and the knight block on c6 defends nothing there. 5...Bd7 or 5...Qd7 would have kept the bishop. With a pawn on d4 the same check would not reach g4.',
    },
  ],
});

export const caroKannBc4Lesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-caro-vs-bc4',
  title: 'Caro-Kann vs 2.Bc4: The Recapture on d5',
  subtitle: 'Against 4.Bb5+ and 4.Bb3, from your own games',
  category: 'opening',
  eco: 'B10',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    '2.Bc4 came up in 8 of your 67 Caro-Kann games (5.5 points). You met it with 2...d5 every time, and after 3.exd5 took back with 3...cxd5. Then the d5 pawn attacks the bishop again; in your games it went to b5 with check (5 games, 4.5 points) or back to b3 (3 games, 1 point). Two things to watch: the queen may not take on d5 while the bishop sees it, and a bishop on b5 that nothing defends can be hit together with the king.',
  thematicObjective:
    'Take back on d5 with the pawn, never the queen. Once d2, c3 and b4 are empty, ...Qa5+ checks and attacks a loose bishop on b5 at once.',
  keyTacticalMotif: 'A queen check from a5 that also attacks an undefended bishop on b5',
  moves: [
    { san: 'e4', isUserMove: false },
    { san: 'c6', isUserMove: true, wrongMoveFeedback: AGAINST_E4 },
    // After 1.e4 c6: 2.d4 25, 2.Nf3 20, 2.Bc4 8, 2.Nc3 4.
    { san: 'Bc4', isUserMove: false, frequency: 8 },
    {
      san: 'd5',
      isUserMove: true,
      annotation: 'Strike at once: the d5 pawn attacks the bishop and the e4 pawn, and it closes the bishop\'s line to f7.',
      hintTheme: 'Hit the centre and the bishop',
    },
    { san: 'exd5', isUserMove: false, frequency: 8 },
    {
      san: 'cxd5',
      isUserMove: true,
      annotation: 'Take back with the pawn, which attacks the bishop on c4 again.',
      hintTheme: "Mind the bishop's diagonal",
      wrongMoveFeedback: {
        Qxd5: '3...Qxd5?? 4.Bxd5: the bishop on c4 looks straight down the diagonal to d5 and takes the queen.',
      },
    },
    {
      san: 'Bb5+',
      isUserMove: false,
      // After 3...cxd5: 4.Bb5+ 5, 4.Bb3 3.
      frequency: 5,
      alternatives: {
        Bb3: [
          {
            san: 'Nf6',
            isUserMove: true,
            frequency: 3,
            annotation: 'Develop. The b3 bishop attacks d5, which the queen and the f6 knight defend.',
            wrongMoveFeedback: {
              Bf5: '4...Bf5 is a good move too (you played it twice here). This lesson develops the knight first: it defends d5 and keeps the bishop\'s choice open.',
              Nc6: '4...Nc6 is a good move too. This lesson develops the king\'s knight first: it defends d5.',
            },
          },
          // After 4.Bb3 Nf6: 5.d4 1.
          { san: 'd4', isUserMove: false, frequency: 1 },
          {
            san: 'Bg4',
            isUserMove: true,
            annotation: 'Develop with an attack on the queen. With e2 and f3 empty the queen sees g4, but the f6 knight defends the bishop: 6.Qxg4 Nxg4.',
            accept: { san: ['Nc6'] },
          },
        ],
      },
    },
    {
      san: 'Nc6',
      isUserMove: true,
      annotation: 'Block with the knight, as you did in all five games; 4...Bd7 is just as good.',
      wrongMoveFeedback: {
        Bd7: '4...Bd7 is just as good. This lesson blocks with the knight, as you did in all five games.',
      },
    },
    {
      san: 'Nf3',
      isUserMove: false,
      // After 4...Nc6: 5.Nf3 2, 5.Bxc6+ 1, 5.d3 1, 5.Nc3 1.
      frequency: 2,
      alternatives: {
        'Bxc6+': [
          { san: 'bxc6', isUserMove: true, frequency: 1, annotation: 'Take toward the centre: the c6 pawn supports d5, and Black has the two bishops.' },
          { san: 'd4', isUserMove: false, frequency: 1 },
          {
            san: 'Nf6',
            isUserMove: true,
            annotation: 'Develop. Not 6...Bg4??: with e2 and f3 empty the queen on d1 takes it, and nothing defends g4.',
            accept: { san: ['Bf5', 'e6'] },
            wrongMoveFeedback: {
              Bg4: '6...Bg4?? 7.Qxg4: the queen on d1 sees g4 through e2 and f3, and nothing of Black\'s defends the bishop.',
            },
          },
        ],
        d3: [
          {
            san: 'Qa5+',
            isUserMove: true,
            frequency: 1,
            annotation: 'Check and attack: 5.d3 opened the a5-e1 diagonal, and nothing defends the bishop on b5. In your game you played 5...a6.',
            hintTheme: 'A check that also attacks the bishop',
          },
          {
            san: 'Nc3',
            isUserMove: false,
            annotation: 'The best block: the knight guards b5.',
          },
          {
            san: 'd4',
            isUserMove: true,
            annotation: 'The knight cannot move: it shields the king from the queen\'s check. 6...d4 attacks it.',
            hintTheme: 'Attack the piece that cannot move',
            wrongMoveFeedback: {
              Qxb5: '6...Qxb5?? 7.Nxb5: the knight on c3 guards b5 and takes the queen.',
            },
          },
        ],
        Nc3: [
          { san: 'Nf6', isUserMove: true, frequency: 1, annotation: 'Develop the king\'s knight.', accept: { san: ['e6', 'a6'] } },
        ],
      },
    },
    {
      san: 'a6',
      isUserMove: true,
      annotation: 'Ask the bishop: take on c6 or retreat. 5...Bg4 is as good.',
      wrongMoveFeedback: {
        Bg4: '5...Bg4 is as good (you played it in one of these games). This lesson asks the bishop first with ...a6.',
      },
    },
    // After 5...a6: 6.Bxc6+ 1.
    { san: 'Bxc6+', isUserMove: false, frequency: 1 },
    { san: 'bxc6', isUserMove: true, annotation: 'Take toward the centre: the c6 pawn supports d5, and Black has the two bishops.' },
    // After 6...bxc6: 7.d4 1.
    { san: 'd4', isUserMove: false, frequency: 1 },
    {
      san: 'e6',
      isUserMove: true,
      annotation: 'The pawns on c6, d5 and e6 hold the centre; the f8 bishop comes out next.',
      accept: { san: ['Bg4'] },
    },
  ],
  exercises: [
    {
      id: 'ex-caro-bc4-qa5-check',
      title: 'The Bishop on b5',
      // 1.e4 c6 2.Bc4 d5 3.exd5 cxd5 4.Bb5+ Nc6 5.d3 (your game of 2026-05-08, where you played 5...a6)
      fen: 'r1bqkbnr/pp2pppp/2n5/1B1p4/8/3P4/PPP2PPP/RNBQK1NR b KQkq - 0 5',
      turn: 'b',
      difficultyRating: 2,
      prompt: 'Black to play. White has just played 5.d3. What does Black play?',
      solutionSan: ['Qa5+'],
      explanation:
        '5...Qa5+ checks along a5-e1, which 5.d3 opened, and attacks the bishop on b5, which nothing defends. After 6.c3, 6.Bd2 or 6.Nd2 the queen takes the bishop. After 6.Nc3 the knight guards b5, so 6...Qxb5?? 7.Nxb5 loses the queen; but the knight cannot move, and 6...d4 attacks it.',
    },
  ],
  mistakesAndTraps: [
    {
      plyIndex: 5,
      attemptedSan: 'Qxd5',
      isTrap: false,
      severity: 'blunder',
      explanatoryFeedback: '3...Qxd5?? puts the queen on the bishop\'s diagonal: 4.Bxd5 takes it.',
      refutationSanList: ['Bxd5'],
      punishmentSummary: 'After 4...cxd5 White has the queen for a bishop.',
    },
  ],
});

export const caroKannExchangeLesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-caro-exchange',
  title: 'Caro-Kann Exchange: The Light-Squared Bishop',
  subtitle: 'When White\'s bishop comes to d3 or b5',
  category: 'opening',
  eco: 'B13',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    'After 2.d4 d5, 3.exd5 came up in 4 of your Caro-Kann games (2 points). The position is level, and the c8 bishop comes out to f5 at once. Two moments decide whether it stays comfortable: when a white bishop comes to d3 to meet yours, and when one gives check on b5.',
  thematicObjective:
    'Meet Bd3 by trading or by retreating to g6, never by leaving the bishop to be taken. Against Bb5+, block with the c-knight: a knight on d7 is pinned there and Ne5 piles up on it.',
  keyTacticalMotif: 'A pinned knight on d7 attacked twice, by the b5 bishop and a knight on e5',
  moves: [
    { san: 'e4', isUserMove: false },
    { san: 'c6', isUserMove: true, wrongMoveFeedback: AGAINST_E4 },
    { san: 'd4', isUserMove: false },
    { san: 'd5', isUserMove: true },
    // After 2...d5: 3.e5 14, 3.exd5 4, 3.Nc3 3, 3.f3 2, 3.Nd2 1.
    { san: 'exd5', isUserMove: false, frequency: 4 },
    { san: 'cxd5', isUserMove: true, annotation: 'Take back with the pawn: Black keeps a pawn in the centre.' },
    {
      san: 'Nc3',
      isUserMove: false,
      // After 3...cxd5: 4.Nc3 3, 4.Nf3 1.
      frequency: 3,
      alternatives: {
        Nf3: [
          {
            san: 'Bg4',
            isUserMove: true,
            frequency: 1,
            annotation: 'Pin the knight; the d4 pawn closes the fourth rank, so a check on a4 could not reach g4.',
            hintTheme: 'Pin the knight',
          },
          // After 4...Bg4: 5.Be2 1.
          { san: 'Be2', isUserMove: false, frequency: 1 },
          { san: 'e6', isUserMove: true, annotation: 'Close the wall behind the bishop.', accept: { san: ['Nc6', 'Nf6'] } },
        ],
      },
    },
    { san: 'Bf5', isUserMove: true, annotation: 'The bishop comes out before ...e6 shuts it in.', hintTheme: 'Develop the light-squared bishop' },
    {
      san: 'Nf3',
      isUserMove: false,
      // After 4...Bf5: 5.Nf3 2, 5.Bd3 1.
      frequency: 2,
      alternatives: {
        Bd3: [
          {
            san: 'Bxd3',
            isUserMove: true,
            frequency: 1,
            annotation: 'Trade the bishops, or retreat with 5...Bg6 as you did. Left on f5 without a defender, it is taken.',
            hintTheme: 'Trade or retreat',
            accept: { san: ['Bg6'] },
            wrongMoveFeedback: {
              e6: '5...e6 lets 6.Bxf5 exf5 7.Qe2+: after 7...Be7 8.Qb5+ Nc6 9.Nxd5 White has won the d5 pawn.',
            },
          },
        ],
      },
    },
    {
      san: 'Nc6',
      isUserMove: true,
      annotation: 'Develop the knight first. Then a bishop on b5 only pins it, without check.',
      hintTheme: 'Knight before pawn',
      wrongMoveFeedback: {
        e6: '5...e6 is playable (you chose it in both games), but it lets 6.Bb5+ come with check. Then block with 6...Nc6; after 6...Nd7?? 7.Ne5 the pinned knight is attacked twice.',
      },
    },
    { san: 'Bb5', isUserMove: false, annotation: 'The pin on c6.' },
    { san: 'a6', isUserMove: true, annotation: 'Ask the bishop at once: take on c6 or go back.' },
    { san: 'Bxc6+', isUserMove: false },
    {
      san: 'bxc6',
      isUserMove: true,
      annotation: 'Take toward the centre: the c6 pawn supports d5, and Black keeps the f5 bishop.',
    },
  ],
  exercises: [
    {
      id: 'ex-caro-exchange-bb5-check',
      title: 'The Check on b5',
      // 1.e4 c6 2.d4 d5 3.exd5 cxd5 4.Nc3 Bf5 5.Nf3 e6 6.Bb5+ (your games of 2026)
      fen: 'rn1qkbnr/pp3ppp/4p3/1B1p1b2/3P4/2N2N2/PPP2PPP/R1BQK2R b KQkq - 1 6',
      turn: 'b',
      difficultyRating: 2,
      prompt: 'Black to play. White has just given check with 6.Bb5+. How does Black block it?',
      solutionSan: ['Nc6'],
      explanation:
        '6...Nc6 blocks with the knight that belongs on c6. 6...Nd7?? leaves the d7 knight pinned to the king, and 7.Ne5 attacks it a second time; after 7...Nf6 8.Bg5 Be7 9.Bxf6 gxf6 10.Nxd7 White has won it (10...Qxd7 11.Bxd7+).',
    },
  ],
});

export const caroKannF4Lesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-caro-vs-f4',
  title: 'Caro-Kann vs 2.f4',
  subtitle: 'The usual Caro-Kann ideas against an early f-pawn',
  category: 'opening',
  eco: 'B10',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    '2.f4 came up in 2 of your Caro-Kann games, and you lost both. Meet it as you meet the other second moves: strike with ...d5, bring the bishop out to f5 before ...e6, and hit d4 with ...c5. If White develops the knight to f3 before anything else, take on e4, and when the knight jumps to e5, never open the e8-h5 diagonal with ...f6.',
  thematicObjective: '2...d5. Against 3.e5: Bf5, ...e6, ...c5 and ...Nc6. Against 3.Nf3: dxe4 and, after 4.Ne5, 4...Nd7.',
  keyTacticalMotif: 'After ...f6 the queen checks on h5 and the knight on e5 takes on g6',
  moves: [
    { san: 'e4', isUserMove: false },
    { san: 'c6', isUserMove: true, wrongMoveFeedback: AGAINST_E4 },
    // After 1.e4 c6: 2.d4 25, 2.Nf3 20, 2.Bc4 8, 2.Nc3 4, 2.e5 3, 2.d3 3, 2.f4 2.
    { san: 'f4', isUserMove: false, frequency: 2 },
    {
      san: 'd5',
      isUserMove: true,
      annotation: 'Strike at the centre, as against every second move.',
      hintTheme: 'Strike at the centre',
      wrongMoveFeedback: {
        d6: '2...d6 was your move in one of your two games against 2.f4, and you lost it; Stockfish rates it about a quarter of a pawn below 2...d5.',
      },
    },
    {
      san: 'e5',
      isUserMove: false,
      // After 2...d5: 3.e5 1.
      frequency: 1,
      annotation: 'The pawn chain e5-f4, as in the Advance.',
      alternatives: {
        exd5: [
          { san: 'cxd5', isUserMove: true, annotation: 'Take back with the pawn: Black has the centre pawn.' },
          { san: 'Nf3', isUserMove: false },
          { san: 'Nc6', isUserMove: true, annotation: 'Develop: Black has the freer game.' },
        ],
        Nf3: [
          { san: 'dxe4', isUserMove: true, annotation: 'Take: the pawn on e4 now attacks the f3 knight.', hintTheme: 'Take the pawn' },
          { san: 'Ne5', isUserMove: false },
          {
            san: 'Nd7',
            isUserMove: true,
            annotation: 'Challenge the knight.',
            hintTheme: 'Challenge the knight',
            wrongMoveFeedback: {
              f6: '4...f6?? opens the e8-h5 diagonal: 5.Qh5+ g6 6.Nxg6, and 6...hxg6 7.Qxh8 takes the rook.',
            },
          },
        ],
        Nc3: [
          { san: 'dxe4', isUserMove: true, annotation: 'Take on e4.' },
          { san: 'Nxe4', isUserMove: false },
          {
            san: 'Nf6',
            isUserMove: true,
            annotation: 'Challenge the knight on e4.',
            wrongMoveFeedback: {
              Bf5: '4...Bf5 is playable, but Stockfish rates 4...Nf6 a quarter of a pawn higher. This lesson challenges the knight first.',
            },
          },
        ],
        d3: [
          { san: 'dxe4', isUserMove: true, annotation: 'Take: after 4.dxe4 Qxd1+ 5.Kxd1 White can no longer castle.' },
        ],
      },
    },
    { san: 'Bf5', isUserMove: true, annotation: 'The bishop comes out before ...e6, as against the Advance.', hintTheme: 'The bishop before the pawn' },
    { san: 'd4', isUserMove: false, frequency: 1 },
    { san: 'e6', isUserMove: true, annotation: 'Close the wall behind the bishop.' },
    { san: 'Nf3', isUserMove: false, frequency: 1 },
    { san: 'c5', isUserMove: true, annotation: 'Strike at d4, the base of the chain, as in the Advance.', hintTheme: 'Hit the base of the chain' },
    { san: 'c3', isUserMove: false, frequency: 1 },
    {
      san: 'Nc6',
      isUserMove: true,
      annotation: 'Develop with a second attacker on d4. In your game 6...Nh6 came here.',
      wrongMoveFeedback: {
        Nh6: '6...Nh6 was your move in this game; Stockfish rates 6...Nc6, which adds a second attacker on d4, a third of a pawn higher.',
      },
    },
  ],
  exercises: [
    {
      id: 'ex-caro-f4-qh5',
      title: 'The Diagonal to e8',
      // 1.e4 c6 2.f4 d5 3.Nf3 dxe4 4.Ne5 f6??
      fen: 'rnbqkbnr/pp2p1pp/2p2p2/4N3/4pP2/8/PPPP2PP/RNBQKB1R w KQkq - 0 5',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Black has just played 4...f6, attacking the knight. What does White play?',
      solutionSan: ['Qh5+', 'g6', 'Nxg6'],
      explanation:
        '5.Qh5+ g6 6.Nxg6: the knight takes on g6 and attacks the rook on h8, and 6...hxg6 7.Qxh8 wins it. That is why Black challenges the knight with 4...Nd7 instead.',
    },
  ],
});

export const caroKannClassicalLesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-caro-kann-classical',
  title: 'Caro-Kann Classical: The Bishop\'s Route',
  subtitle: 'Bishop to f5, back to g6, an escape square on h7, and the trade on d3',
  category: 'opening',
  eco: 'B18',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    'Against 3.Nc3 you scored 1 point in 3 games; the line is short, so drill it until it is automatic. Take on e4, develop the bishop to f5 with a gain of time, retreat it to g6 when the knight hits it, play ...h6 before h4-h5 can trap it, and trade it on d3.',
  thematicObjective: '3...dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3 e6.',
  keyTacticalMotif: 'Escape square for the bishop before the h-pawn arrives',
  moves: [
    { san: 'e4', isUserMove: false },
    { san: 'c6', isUserMove: true, wrongMoveFeedback: AGAINST_E4 },
    { san: 'd4', isUserMove: false },
    { san: 'd5', isUserMove: true },
    { san: 'Nc3', isUserMove: false, annotation: 'The knight defends e4.' },
    { san: 'dxe4', isUserMove: true, annotation: 'Take on e4: the knight recaptures and becomes a target for the bishop.' },
    { san: 'Nxe4', isUserMove: false },
    {
      san: 'Bf5',
      isUserMove: true,
      annotation: 'Develop with a gain of time: the bishop attacks the e4 knight.',
      hintTheme: 'Develop with tempo',
      wrongMoveFeedback: {
        Bg4: '4...Bg4?? hangs the bishop: the e-pawn has left e2, so the queen on d1 takes on g4. From f5 the bishop is safe and hits the e4 knight.',
      },
    },
    {
      san: 'Ng3',
      isUserMove: false,
      annotation: 'The knight attacks the bishop.',
      alternatives: {
        Ng5: [
          {
            san: 'h6',
            isUserMove: true,
            annotation: 'Ask the g5 knight where it is going. If it takes on f7, the king takes it back and Black is a piece for a pawn up.',
            hintTheme: 'Kick the knight',
            wrongMoveFeedback: {
              e6: '5...e6 is sound too. 5...h6 asks the knight a question at once, and Maia expects two players in three at your level to answer 6.Nxf7?, which loses a piece for a pawn.',
            },
          },
          {
            san: 'N5f3',
            isUserMove: false,
            annotation: 'The knight goes back.',
            alternatives: {
              Nxf7: [{ san: 'Kxf7', isUserMove: true, annotation: 'Take the knight: Black is a piece for a pawn up.' }],
            },
          },
          {
            san: 'e6',
            isUserMove: true,
            annotation: 'Now the wall: ...e6 opens the f8 bishop, and the c8 bishop is already outside the chain.',
          },
        ],
      },
    },
    { san: 'Bg6', isUserMove: true, annotation: 'Step back to g6 and stay on the b1-h7 diagonal.' },
    { san: 'h4', isUserMove: false, annotation: 'White threatens h5, hitting the bishop.' },
    {
      san: 'h6',
      isUserMove: true,
      annotation: 'Make room on h7 now. Then h5 can be answered by ...Bh7 and the bishop stays on its diagonal.',
      hintTheme: 'Make an escape square',
    },
    { san: 'Nf3', isUserMove: false },
    { san: 'Nd7', isUserMove: true, annotation: 'Develop; the knight keeps e5 and f6 under control.' },
    { san: 'h5', isUserMove: false },
    { san: 'Bh7', isUserMove: true, annotation: 'The square ...h6 prepared.' },
    { san: 'Bd3', isUserMove: false, annotation: 'White offers the bishop trade.' },
    { san: 'Bxd3', isUserMove: true, annotation: 'Trade: Black\'s bishop has done its job, and the queen recaptures.' },
    { san: 'Qxd3', isUserMove: false },
    {
      san: 'e6',
      isUserMove: true,
      annotation: 'The wall is complete and the f8 bishop can come out.',
    },
  ],
  exercises: [
    {
      id: 'ex-classical-open-diagonal',
      title: 'The Wrong Square for the Bishop',
      // 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bg4
      fen: 'rn1qkbnr/pp2pppp/2p5/8/3PN1b1/8/PPP2PPP/R1BQKBNR w KQkq - 1 5',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. Black developed the bishop to g4 instead of f5. What does White play?',
      solutionSan: ['Qxg4'],
      explanation:
        '5.Qxg4 wins the bishop: the e-pawn has left e2, so the d1-g4 diagonal is open, and nothing defends g4. On f5 the bishop is safe and attacks the e4 knight.',
    },
  ],
});

export const wallVsFlankLesson: CurriculumLesson = buildVerifiedLesson({
  ...SOURCE,
  id: 'lesson-black-wall-vs-flank',
  title: 'The Wall Against 1.c4 and 1.Nf3',
  subtitle: '...c6 first, then ...d5: most lines turn into a Slav, a London or a Caro-Kann, and the rest keep the same plan',
  category: 'opening',
  eco: 'A11',
  targetColor: 'black',
  targetRatingBand: 'intermediate',
  relevance: 'core',
  description:
    '1.c4 and 1.Nf3 came up in 6 of your 151 Black games: 2.5 points from the 4 against 1.c4, none from the 2 against 1.Nf3. Answer both with the wall, c-pawn first: ...c6, then ...d5. In this lesson d4 leads into the Slav and London lessons, 1.Nf3 c6 2.e4 d5 is the Caro-Kann, and without d4 the plan stays the same: bishop to f5 before ...e6, then ...Nbd7, ...Bd6 and castle. Twice you met 1.c4 Nf6 2.Nc3 c6 3.d4 and played 3...Qa5; 3...d5 there is the Slav.',
  thematicObjective:
    '...c6, then ...d5. Against d4 or e4 follow the Slav, London or Caro-Kann lesson. Otherwise ...Nf6, ...Bf5 before ...e6, ...Nbd7, ...Bd6 and castle.',
  keyTacticalMotif: 'Transposition into known lines; the f5 bishop\'s diagonal to c2, d3 and e4',
  moves: [
    {
      san: 'c4',
      isUserMove: false,
      // White's first move in hoot65's Black games: 1.e4 108, 1.d4 30, 1.c4 4, 1.Nf3 2, 1.b4 2, five others once each.
      frequency: 4,
      annotation: 'The English Opening: the c-pawn controls d5 from the side.',
      alternatives: {
        Nf3: [
          {
            san: 'c6',
            isUserMove: true,
            frequency: 2,
            annotation:
              'The same first move. ...d5 comes next, and White\'s second move decides which wall lesson the game turns into.',
            hintTheme: 'Same structure against everything',
          },
          {
            san: 'd4',
            isUserMove: false,
            // After 1.Nf3 (1...c6 once, 1...Nf6 once) White played 2.d4 both times.
            frequency: 2,
            alternatives: {
              e4: [
                {
                  san: 'd5',
                  isUserMove: true,
                  annotation:
                    'This is the Caro-Kann against 2.Nf3, the same position as 1.e4 c6 2.Nf3 d5; the ...Bg4 lesson continues from here.',
                },
              ],
            },
          },
          {
            san: 'd5',
            isUserMove: true,
            annotation:
              'The same position as 1.d4 d5 2.Nf3 c6. If the bishop comes to f4, the London lesson takes over; if the c-pawn comes to c4, the Slav lesson.',
            hintTheme: 'Claim the centre',
          },
        ],
      },
    },
    {
      san: 'c6',
      isUserMove: true,
      annotation: 'Prepare ...d5. If White then takes on d5, the c-pawn takes back and a pawn stays on d5.',
      hintTheme: 'Build the wall from the c-pawn',
      wrongMoveFeedback: {
        Nf6: '1...Nf6 was your move in 3 of these 4 games. It is playable, but the wall starts with the c-pawn: with c6 in place, cxd5 is answered by ...cxd5 and a pawn stays on d5. Against herbimbim, 1...Nf6 2.b3 d5 3.cxd5 Nxd5 left no black pawn in the centre.',
        d5: '1...d5 lets White take at once: 2.cxd5 Qxd5 3.Nc3 hits the queen and gains a move. Play ...c6 first, so cxd5 is answered by ...cxd5.',
        d6: '1...d6 stops one square short. The wall needs pawns on c6 and d5.',
      },
    },
    {
      san: 'b3',
      isUserMove: false,
      // White's second move after 1.c4: 2.Nc3 2 and 2.b3 2 (after 1...Nf6 and 1...d6).
      frequency: 2,
      annotation: 'White prepares Bb2, aiming the bishop down the long diagonal.',
      alternatives: {
        Nc3: [
          { san: 'd5', isUserMove: true, frequency: 2, annotation: 'The same move: c6 supports d5.' },
          {
            san: 'd4',
            isUserMove: false,
            // After 1.c4 Nf6 2.Nc3 c6 White played 3.d4 both times.
            frequency: 2,
            annotation: 'White plays d4 after all.',
            alternatives: {
              cxd5: [
                {
                  san: 'cxd5',
                  isUserMove: true,
                  annotation: 'Take back with the c-pawn: a pawn stays on d5, and the c8 bishop\'s diagonal is open.',
                  hintTheme: 'Keep a pawn on d5',
                  wrongMoveFeedback: {
                    Qxd5: '3...Qxd5 puts the queen on a square the c3 knight attacks: 4.Nxd5 wins it for a knight. Take with the c-pawn.',
                  },
                },
                { san: 'd4', isUserMove: false },
                { san: 'Nf6', isUserMove: true, annotation: 'Develop and guard d5.' },
                { san: 'Nf3', isUserMove: false },
                { san: 'Nc6', isUserMove: true, annotation: 'Develop the second knight; it covers d4 and e5.' },
                { san: 'Bf4', isUserMove: false },
                {
                  san: 'Bf5',
                  isUserMove: true,
                  annotation:
                    'Bishop out before ...e6. This is the Exchange Slav, the same position as 1.d4 d5 2.c4 c6 3.cxd5 cxd5 4.Nf3 Nf6 5.Nc3 Nc6 6.Bf4 Bf5.',
                  hintTheme: 'Bishop out before ...e6',
                },
              ],
            },
          },
          {
            san: 'Nf6',
            isUserMove: true,
            annotation:
              'This is the Slav, the same position as 1.d4 d5 2.c4 c6 3.Nc3 Nf6, and the Slav lesson continues from here. Twice you were one move from it, after 1.c4 Nf6 2.Nc3 c6 3.d4, and played 3...Qa5; 3...d5 would have reached it.',
          },
        ],
      },
    },
    {
      san: 'd5',
      isUserMove: true,
      annotation: 'Now ...d5. The c6 pawn supports it, so if White takes, ...cxd5 keeps a pawn there.',
      hintTheme: 'Claim the centre',
    },
    { san: 'Bb2', isUserMove: false },
    {
      san: 'Nf6',
      isUserMove: true,
      annotation:
        'Develop the knight. d5 is attacked once, by the c4 pawn, and defended three times: by the c6 pawn, the f6 knight and the queen.',
    },
    { san: 'Nf3', isUserMove: false },
    {
      san: 'Bf5',
      isUserMove: true,
      annotation:
        'Bishop out before ...e6, the same move as against the London and the Slav. From f5 it watches c2, d3 and e4.',
      hintTheme: 'Bishop out before ...e6',
      arrows: [{ from: 'f5', to: 'c2', color: 'blue' }],
      wrongMoveFeedback: {
        e6: '4...e6 shuts the c8 bishop in behind its own pawns. Bring it to f5 first; ...e6 comes next move.',
        Bg4: '4...Bg4 is playable too. The course puts the bishop on f5 in every wall line, so one plan covers them all.',
      },
    },
    { san: 'e3', isUserMove: false },
    {
      san: 'e6',
      isUserMove: true,
      annotation: 'Now ...e6 shuts nothing in: the bishop is already outside, and the f8 bishop\'s diagonal opens.',
    },
    { san: 'Be2', isUserMove: false },
    {
      san: 'Nbd7',
      isUserMove: true,
      annotation: 'The knight goes to d7, keeping c6 for the pawn.',
    },
    { san: 'O-O', isUserMove: false },
    {
      san: 'Bd6',
      isUserMove: true,
      annotation:
        'Develop the bishop to d6, where it aims at h2 next to the castled king. ...Be7, the London square, is fine too; there the f4 bishop covers d6, here nothing does. Castle next: the wall is intact, and White never played d4.',
      hintTheme: 'Develop the last minor piece',
      arrows: [{ from: 'd6', to: 'h2', color: 'red' }],
      accept: { san: ['Be7'] },
    },
  ],
  exercises: [
    {
      id: 'ex-flank-wall-loose-bishop',
      title: 'Opposing the Bishop',
      // 1.c4 c6 2.b3 d5 3.Bb2 Nf6 4.Nf3 Bf5 5.e3 e6 6.Bd3
      fen: 'rn1qkb1r/pp3ppp/2p1pn2/3p1b2/2P5/1P1BPN2/PB1P1PPP/RN1QK2R b KQkq - 1 6',
      turn: 'b',
      difficultyRating: 1,
      prompt: 'Black to play. White wants to trade bishops, as in the London, and played 6.Bd3. What does Black play?',
      solutionSan: ['Bxd3'],
      explanation:
        '6...Bxd3 wins a bishop. In the London the c2 pawn and the queen guard d3; here the c-pawn has gone to c4 and the pawn on d2 blocks the queen, so nothing defends it. When a bishop offers a trade, count its defenders first: sometimes it is simply loose.',
    },
  ],
});

export const blackRepertoireLessons: CurriculumLesson[] = [
  londonWallLesson,
  slavWallLesson,
  wallVsNc3Bg5Lesson,
  wallVsFlankLesson,
  caroKannAdvanceLesson,
  caroKannBg4TimingLesson,
  caroKannBc4Lesson,
  caroKannExchangeLesson,
  caroKannF4Lesson,
  caroKannClassicalLesson,
];
