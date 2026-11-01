import { CurriculumLesson } from '../types/curriculum';
import { buildVerifiedLesson } from './builder';

/**
 * Black repertoire lessons: the c6-d5 wall against 1.d4 (decision 2 of the pedagogy audit)
 * and the Caro-Kann lines hoot65 actually reaches. Each lesson is the interactive form of a
 * line in `src/analytics/repertoire.ts`.
 *
 * Archive weights. Against 1.d4 hoot65 answered 1...Nf6 in 29 of 30 games, so White's second
 * and third moves are counted from those games: the London, 2.c4 and 2.Nc3 players are the same
 * opponents whatever Black's first move is. Counts against 1.e4 c6 are exact (67 games).
 */

const SOURCE = {
  sourceBook: 'Chess.com Live Archive',
  author: 'hoot65 Diagnostic Analysis',
  publicationYear: 2026,
} as const;

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
          { san: 'Nf6', isUserMove: true, frequency: 1, annotation: 'Develop and defend d5 a second time.' },
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
          { san: 'Nc6', isUserMove: true, annotation: 'The second knight also guards d5.' },
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
      annotation: 'Develop the knight; it guards d5 a second time.',
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
    { san: 'd5', isUserMove: true, annotation: 'The wall starts with d5, as against 2.c4.' },
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
    { san: 'd5', isUserMove: true },
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
    'The Advance (3.e5) came up in 14 of your games and you scored 8.5 points; you found 3...Bf5 every time. This lesson drills what comes after: ...e6, then ...c5 against d4, with ...Nc6 and ...Qb6 adding pressure. When c5 itself is attacked, the b8 knight goes to d7, where it also hits e5. Against 4.Bd3 trade the bishops.',
  thematicObjective:
    '3...Bf5, then ...e6, ...c5 and ...Nc6; ...Qb6 lines up on b2 and d4. Against Bd3 trade on d3.',
  keyTacticalMotif: 'Undermining the pawn chain at d4; counting attackers on d4',
  moves: [
    { san: 'e4', isUserMove: false },
    { san: 'c6', isUserMove: true },
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
          { san: 'Ne7', isUserMove: true, annotation: 'The second knight heads for c6 or f5, where it hits d4.' },
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
      san: 'Qb6',
      isUserMove: true,
      annotation:
        'The queen hits b2 and stands behind the c5 pawn: after ...cxd4 cxd4 it attacks d4 directly. Today d4 is attacked by the c5 pawn and the c6 knight and defended by the c3 pawn, the f3 knight and the d1 queen; ...Nge7-f5 adds another attacker.',
      hintTheme: 'Pile up on d4',
    },
  ],
  exercises: [
    {
      id: 'ex-advance-queen-on-b-file',
      title: 'Look Along the b-File',
      // 1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3 e6 5.c3 c5 6.Be2 Nc6 7.O-O Qb6 8.Bb5
      fen: 'r3kbnr/pp3ppp/1qn1p3/1BppPb2/3P4/2P2N2/PP3PPP/RNBQ1RK1 b kq - 5 8',
      turn: 'b',
      difficultyRating: 1,
      prompt: 'Black to play. White moved the bishop to b5 to pin the c6 knight. What does Black play?',
      solutionSan: ['Qxb5'],
      explanation:
        '8...Qxb5 wins a bishop: the queen on b6 looks straight down the b-file, and nothing defends b5. Before you worry about a pin, check what your own pieces attack.',
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
    { san: 'c6', isUserMove: true },
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
    { san: 'c6', isUserMove: true },
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
            san: 'e6',
            isUserMove: true,
            annotation: 'Take e6 away from the g5 knight and open the f8 bishop. The c8 bishop is already outside the chain.',
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

export const blackRepertoireLessons: CurriculumLesson[] = [
  londonWallLesson,
  slavWallLesson,
  wallVsNc3Bg5Lesson,
  caroKannAdvanceLesson,
  caroKannBg4TimingLesson,
  caroKannClassicalLesson,
];
