import { CurriculumLesson } from '../types/curriculum';
import { buildVerifiedLesson } from './builder';

/**
 * Anti-Sicilian core lesson for White: the c3-d4 centre (Alapin, 2.c3).
 * Chosen over 2.Nc3/3.Bb5 because it is one plan against every Black reply and the
 * same c3-d4 idea hoot65 already plays in the Italian and the Evans.
 */

export const alapinSicilianCentre: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-alapin-sicilian-centre',
  title: 'Meeting the Sicilian: One Plan for the Centre',
  subtitle: 'Prepare d4 with the c-pawn so a capture on d4 is answered by a pawn, not a piece',
  category: 'opening',
  sourceBook: 'Chess.com Live Archive',
  author: 'hoot65 Diagnostic Analysis',
  publicationYear: 2026,
  eco: 'B22',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  startPly: 2,
  relevance: 'core',
  description:
    'Fifteen of your White games began 1.e4 c5 and you scored 6.5 points from them. Twelve times you played 2.Nf3, followed in ten of those by 3.Bc4; against 2...d6 you scored 1 point in 5 games. This lesson replaces it with one plan for every Black reply: 2.c3 and 3.d4, so that when Black takes on d4 the c-pawn takes back and White keeps two pawns in the centre.',
  thematicObjective:
    'Play c3 and then d4. Recapture on d4 with the c-pawn. Develop the knights so they guard e4 and d4, and check what the d4 pawn needs before you move a knight.',
  keyTacticalMotif: 'Pawn centre on d4 and e4; counting attackers and defenders of d4',
  // Branch weights are Black's second move in the 14 archived Sicilians that reached it (after 2.Nf3 or 2.Bc4):
  // ...d6 5, ...Nc6 5, ...e6 2, ...a6 2 (not drilled; it is met with the same 3.d4). hoot65 has never
  // played 2.c3, so the Alapin main lines 2...d5 and 2...Nf6 have no count and weigh 1.
  moves: [
    { san: 'e4', isUserMove: true },
    { san: 'c5', isUserMove: false },
    {
      san: 'c3',
      isUserMove: true,
      annotation: 'Prepare d4. When Black takes on d4, the c-pawn takes back and White keeps pawns on d4 and e4.',
      hintTheme: 'Prepare the centre pawn',
      wrongMoveFeedback: {
        Nf3: '2.Nf3 was your usual move (12 of 15 Sicilians, 5 points), and against 2...d6 it scored 1 point in 5 games. This lesson uses one plan instead: c3, then d4.',
        Bc4: '2.Bc4 happened twice in your games. A bishop on c4 is blunted as soon as Black plays ...e6; build the centre with c3 and d4 first.',
      },
    },
    {
      san: 'd6',
      isUserMove: false,
      frequency: 5,
      annotation: 'The reply you met most often (5 of 15).',
      alternatives: {
        Nc6: [
          {
            san: 'd4',
            isUserMove: true,
            frequency: 5,
            annotation: 'Same plan: d4 now, with the c3 pawn ready to recapture.',
            hintTheme: 'Same plan against every reply',
          },
          { san: 'cxd4', isUserMove: false },
          { san: 'cxd4', isUserMove: true, annotation: 'Recapture with the pawn. White has pawns on d4 and e4.' },
          { san: 'd5', isUserMove: false, annotation: 'Black hits e4 straight away.' },
          {
            san: 'exd5',
            isUserMove: true,
            annotation: 'Take the pawn. The queen will take back on d5 and stand in the centre.',
          },
          { san: 'Qxd5', isUserMove: false },
          {
            san: 'Nf3',
            isUserMove: true,
            annotation:
              'The d4 pawn is attacked by the queen and the c6 knight and was defended only by the queen on d1. 6.Nf3 adds the second defender. Nc3, gaining a tempo on the queen, comes next.',
            hintTheme: 'Count the attackers on d4',
            arrows: [{ from: 'f3', to: 'd4', color: 'blue' }],
            wrongMoveFeedback: {
              Nc3: '6.Nc3 hits the queen, but it leaves d4 with one defender against two attackers: 6...Qxd4 wins the pawn. Guard d4 with 6.Nf3 first; Nc3 comes next move.',
            },
          },
        ],
        e6: [
          {
            san: 'd4',
            isUserMove: true,
            frequency: 2,
            annotation: 'Same plan: d4, with the c3 pawn behind it.',
          },
          { san: 'd5', isUserMove: false, annotation: 'A French-style reply: Black challenges e4.' },
          {
            san: 'exd5',
            isUserMove: true,
            annotation: 'Exchange on d5. The position opens and White develops quickly.',
          },
          { san: 'exd5', isUserMove: false },
          { san: 'Nf3', isUserMove: true, annotation: 'Develop the knight; it also guards d4.' },
          { san: 'Nc6', isUserMove: false },
          {
            san: 'Be2',
            isUserMove: true,
            annotation: 'Develop the bishop and castle next move. White has pieces out and no weaknesses.',
          },
        ],
        d5: [
          {
            san: 'exd5',
            isUserMove: true,
            annotation: 'The main Alapin reply. Take the pawn. If the queen recaptures, it stands in the centre where White\'s pieces can gain time on it.',
          },
          { san: 'Qxd5', isUserMove: false },
          {
            san: 'd4',
            isUserMove: true,
            annotation: 'Take the centre. The c3 pawn already defends d4, so the queen on d5 cannot simply take it.',
            hintTheme: 'Centre pawn, already defended',
          },
          { san: 'Nc6', isUserMove: false, annotation: 'Black adds the knight to the pressure on d4.' },
          {
            san: 'Nf3',
            isUserMove: true,
            annotation:
              'Now d4 is attacked three times (c5 pawn, c6 knight, d5 queen) and defended three times (c3 pawn, f3 knight, d1 queen).',
            hintTheme: 'Match the attackers on d4',
          },
        ],
        Nf6: [
          {
            san: 'e5',
            isUserMove: true,
            annotation:
              'The knight hit e4, so push past it: the pawn gains space and the knight must move again. Unlike 2.e5 against the Scandinavian, this push attacks a piece, so it gains a move.',
            hintTheme: 'Gain space with tempo',
          },
          { san: 'Nd5', isUserMove: false },
          { san: 'd4', isUserMove: true, annotation: 'Support e5 and take the centre.' },
          { san: 'cxd4', isUserMove: false },
          { san: 'cxd4', isUserMove: true, annotation: 'Recapture with the pawn: pawns on d4 and e5.' },
          { san: 'd6', isUserMove: false, annotation: 'Black attacks e5.' },
          { san: 'Nf3', isUserMove: true, annotation: 'The knight guards e5 and d4. Bc4, hitting the d5 knight, can follow.' },
        ],
      },
    },
    {
      san: 'd4',
      isUserMove: true,
      annotation: 'Strike in the centre while Black\'s pieces are still at home.',
      hintTheme: 'Take the centre',
    },
    {
      san: 'cxd4',
      isUserMove: false,
      alternatives: {
        Nf6: [
          {
            san: 'dxc5',
            isUserMove: true,
            annotation:
              'Black hits e4 before taking. Take on c5 first: if the knight now takes on e4, 5.Qa4+ checks the king and hits the knight along the fourth rank.',
            hintTheme: 'Set a trap on the fourth rank',
            wrongMoveFeedback: {
              Bd3: '4.Bd3 guards e4 and is sound. 4.dxc5 asks a question first: Maia expects two players in three at your level to answer 4...Nxe4?, and 5.Qa4+ wins the knight.',
            },
          },
          {
            san: 'Nxe4',
            isUserMove: false,
            annotation: 'The knight takes the e4 pawn.',
            alternatives: {
              dxc5: [
                {
                  san: 'Qxd8+',
                  isUserMove: true,
                  annotation: 'Trade queens with check: the black king has to take back and can no longer castle.',
                },
              ],
            },
          },
          {
            san: 'Qa4+',
            isUserMove: true,
            annotation: 'Check, and along the fourth rank the queen also attacks the knight on e4.',
            hintTheme: 'A check that attacks something else',
          },
          { san: 'Nc6', isUserMove: false },
          { san: 'Qxe4', isUserMove: true, annotation: 'The knight falls: White is a piece up.' },
        ],
      },
    },
    {
      san: 'cxd4',
      isUserMove: true,
      annotation: 'Recapture with the c-pawn. White has pawns on d4 and e4; Black\'s d-pawn is still on d6.',
      hintTheme: 'Keep two centre pawns',
      wrongMoveFeedback: {
        Qxd4: '4.Qxd4 brings the queen out early, where ...Nc6 hits it with tempo. The c3 pawn was put there to take back on d4.',
      },
    },
    { san: 'Nf6', isUserMove: false, annotation: 'The knight attacks e4.' },
    {
      san: 'Nc3',
      isUserMove: true,
      annotation: 'Develop the knight and guard e4.',
      hintTheme: 'Defend e4 with development',
      arrows: [{ from: 'c3', to: 'e4', color: 'blue' }],
    },
    { san: 'g6', isUserMove: false, annotation: 'Black prepares ...Bg7, a dragon-style bishop.' },
    { san: 'Nf3', isUserMove: true, annotation: 'Develop the second knight; it guards d4.' },
    { san: 'Bg7', isUserMove: false },
    {
      san: 'Be2',
      isUserMove: true,
      annotation:
        'Develop the bishop and get ready to castle. On e2 it also stands between f3 and d1, so a later ...Bg4 pins the knight to the bishop, not to the queen.',
    },
    { san: 'O-O', isUserMove: false },
    {
      san: 'O-O',
      isUserMove: true,
      annotation: 'Castled, with pawns on d4 and e4 and every minor piece out except the c1 bishop.',
    },
  ],
  exercises: [
    {
      id: 'ex-alapin-e4-guard',
      title: 'Who Guards e4?',
      // 1.e4 c5 2.c3 d6 3.d4 cxd4 4.cxd4 Nf6 5.Nc3 Nxe4
      fen: 'rnbqkb1r/pp2pppp/3p4/8/3Pn3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 6',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. After 5.Nc3 Black took the e4 pawn anyway with the knight. What does White play?',
      solutionSan: ['Nxe4'],
      explanation:
        '6.Nxe4 wins a knight for a pawn: the c3 knight was guarding e4 all along. Before you develop a knight, look at what it defends; before your opponent takes, count the defenders.',
    },
    {
      id: 'ex-alapin-knight-to-g4',
      title: 'The Open Diagonal',
      // 1.e4 c5 2.c3 Nf6 3.e5 Ng4
      fen: 'rnbqkb1r/pp1ppppp/8/2p1P3/6n1/2P5/PP1P1PPP/RNBQKBNR w KQkq - 1 4',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. After 3.e5 the knight jumped forward to g4, eyeing e5. What does White play?',
      solutionSan: ['Qxg4'],
      explanation:
        '4.Qxg4 wins the knight. The e-pawn has left e2, so the d1-h5 diagonal is open, and nothing defends g4. The same diagonal punishes an early ...Bg4 before White has a knight on f3.',
    },
  ],
});

export const antiSicilianLessons: CurriculumLesson[] = [alapinSicilianCentre];
