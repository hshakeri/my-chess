import { CurriculumLesson } from '../types/curriculum';
import { buildVerifiedLesson } from './builder';

/**
 * Opening Lessons: Scotch Gambit & Italian Attack, Evans Gambit, and Adams Attack
 * Sources: TacticsInJuniorOpenings.pdf (Dave), Chess-Openings.pdf (Schiller), 7500.pdf (Amanov & Kavutskiy)
 */

export const scotchGambitBreakthrough: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-scotch-gambit-breakthrough',
  title: 'The Scotch Gambit: Crushing Early Passivity',
  subtitle: 'Punish Black\'s slow play with a rapid central sacrifice and double attack on f7',
  category: 'opening',
  sourceBook: 'Tactics in Junior Openings',
  author: 'Dave',
  publicationYear: 2009,
  pagesRef: 'Scotch Gambit chapter',
  eco: 'C44',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  // hoot65 plays 3.Bc4 in every Italian game; the 3.d4 move order has never occurred.
  relevance: 'outside-repertoire',
  description:
    'The Scotch Gambit (1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4) is one of the most lethal weapons against 1...e5. White sacrifices a pawn to seize the center, open diagonal lines toward Black’s vulnerable f7 square, and punish greedy pawn snatching.',
  thematicObjective: 'Rip open the center, exploit the weak f7 square, and coordinate Queen and Bishop before Black can castle.',
  keyTacticalMotif: 'f7 weakness, rapid development, double attack with Qd5',
  moves: [
    {
      san: 'e4',
      annotation: 'Seize the center and open diagonals for the Queen and light-squared Bishop.',
      hintPiece: 'King Pawn',
      hintSquare: 'e4',
      hintTheme: 'Occupy the center',
    },
    {
      san: 'e5',
      annotation: 'Black mirrors White, establishing an equal share of the center.',
    },
    {
      san: 'Nf3',
      annotation: 'Develop the knight with tempo, putting immediate pressure on Black\'s e5 pawn.',
      hintPiece: 'King Knight',
      hintSquare: 'f3',
      hintTheme: 'Develop with threat',
    },
    {
      san: 'Nc6',
      annotation: 'Black defends the e5 pawn naturally with knight development.',
    },
    {
      san: 'd4',
      annotation: 'The Scotch strike! White challenges Black\'s central pawn directly on move 3.',
      hintPiece: 'Queen Pawn',
      hintSquare: 'd4',
      hintTheme: 'Open the center',
    },
    {
      san: 'exd4',
      annotation: 'Black captures, relinquishing the central stronghold.',
    },
    {
      san: 'Bc4',
      annotation: 'The Scotch Gambit! Instead of recapturing immediately on d4, White develops the bishop with an eye trained on the tender f7 square.',
      hintPiece: 'Light-squared Bishop',
      hintSquare: 'c4',
      hintTheme: 'Aim at f7',
    },
    {
      san: 'Be7',
      annotation: 'Black plays a passive retreat. Club players more often answer 4...Nf6 or 4...Bc5; this line shows what happens when Black neglects the center.',
    },
    {
      san: 'c3',
      annotation: 'Offer a second pawn to open lines for White’s queen and queen’s knight.',
      hintPiece: 'c-Pawn',
      hintSquare: 'c3',
      hintTheme: 'Gambit for tempo',
    },
    {
      san: 'dxc3',
      annotation: 'Black greedily consumes the c3 pawn, falling right into White’s tactical trap.',
    },
    {
      san: 'Qd5',
      annotation: 'The lethal strike! 6.Qd5 creates an irresistible threat against f7 with mate in one looming.',
      hintPiece: 'White Queen',
      hintSquare: 'd5',
      hintTheme: 'Irresistible mate threat on f7',
      arrows: [{ from: 'd5', to: 'f7', color: 'red' }, { from: 'c4', to: 'f7', color: 'red' }],
    },
    {
      san: 'Nh6',
      annotation: 'Black\'s most stubborn defence of f7. 6...Ne5 and 6...d6 also stop the mate but lose material.',
    },
    {
      san: 'Bxh6',
      annotation: 'Eliminate the defender of f7. Now mate on f7 is threatened again!',
      hintPiece: 'Dark-squared Bishop',
      hintSquare: 'h6',
      hintTheme: 'Remove the guard',
      arrows: [{ from: 'h6', to: 'f7', color: 'red' }],
    },
    {
      san: 'O-O',
      annotation: 'Black scrambles into castling to evade immediate checkmate.',
    },
    {
      san: 'Bxg7',
      annotation: 'Demolish Black’s kingside pawn shield.',
      hintPiece: 'Dark-squared Bishop',
      hintSquare: 'g7',
      hintTheme: 'Destroy king shelter',
    },
    {
      san: 'Kxg7',
      annotation: 'Black is forced to recapture.',
    },
    {
      san: 'Nxc3',
      annotation: 'White restores material balance with a completely shattered Black king and dominating minor pieces.',
      hintPiece: 'Queen Knight',
      hintSquare: 'c3',
      hintTheme: 'Regain material and dominate',
    },
  ],
  exercises: [
    {
      id: 'ex-scotch-1',
      title: 'Find White\'s Knockout Punch on f7',
      fen: 'r1bqk1nr/ppppbppp/2n5/8/2B1P3/2p2N2/PP3PPP/RNBQK2R w KQkq - 0 6',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Black just played 5...dxc3, grabbing a second pawn. Find White\'s devastating move threatening immediate checkmate.',
      solutionSan: ['Qd5', 'Nh6', 'Bxh6'],
      explanation: '6.Qd5! immediately threatens Qxf7# with battery coordination from the c4-bishop. After 6...Nh6, White removes the defender with 7.Bxh6!',
      sourceGame: {
        white: 'Sanchez Jimenez',
        black: 'Tofe Mata',
        year: 2004,
        eco: 'C44',
      },
    },
  ],
  mistakesAndTraps: [
    {
      plyIndex: 10,
      attemptedSan: 'bxc3',
      isTrap: false,
      severity: 'inaccuracy',
      explanatoryFeedback: 'Recapturing quietly with 6.bxc3 is playable, but it misses 6.Qd5!, which threatens Qxf7# and forces Black into an awkward defence.',
      refutationSanList: ['Nf6', 'e5', 'd5'],
      punishmentSummary: 'Allows Black to coordinate defense with ...Nf6.',
    },
  ],
});

export const evansGambitDestruction: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-evans-gambit-destruction',
  title: 'The Evans Gambit: Rapid Wing Sacrifice',
  subtitle: 'Sacrifice the b4 pawn to build an unstoppable classical pawn center and quick castle',
  category: 'opening',
  sourceBook: 'Tactics in Junior Openings',
  author: 'Dave',
  publicationYear: 2009,
  pagesRef: 'Evans Gambit chapter',
  eco: 'C51',
  targetColor: 'white',
  targetRatingBand: 'intermediate',
  // hoot65's best-scoring White line (6 wins in 7 games with 4.b4).
  relevance: 'core',
  description:
    'Captain William Evans introduced 4.b4! in the 1820s. By deflecting Black’s bishop from c5, White gains crucial tempi with c3 and d4, seizing the center and keeping Black’s king trapped in the middle.',
  thematicObjective: 'Build an ideal pawn center (c3+d4), gain development tempi, and pin or open the e-file.',
  keyTacticalMotif: 'Wing pawn sacrifice for rapid central dominance and king hunt',
  // Branch frequencies are reply counts from hoot65's archive (src/data/seed_hoot65_games.json,
  // 150 games as White). A reply without a count was not observed and weighs 1.
  moves: [
    { san: 'e4', isUserMove: true },
    { san: 'e5', isUserMove: false },
    { san: 'Nf3', isUserMove: true },
    { san: 'Nc6', isUserMove: false },
    { san: 'Bc4', isUserMove: true },
    {
      san: 'Bc5',
      isUserMove: false,
      // After 3.Bc4 (53 games): ...h6 16, ...Nf6 12, ...Bc5 11, ...Nd4 5, ...d6 4, ...f5 3.
      frequency: 11,
      annotation: 'The Giuoco Piano move. Black develops the bishop to its most active square, and the Evans Gambit is on.',
      alternatives: {
        Nf6: [
          {
            san: 'd3',
            isUserMove: true,
            frequency: 12,
            annotation:
              'The Two Knights Defence. 4.d3 keeps every pawn defended and sets up the quiet Italian plan: c3, O-O, Re1 and Nbd2, with d4 later.',
            hintTheme: 'Defend e4 and keep the structure',
            wrongMoveFeedback: {
              d4: '4.d4 was your choice in 10 of these 12 games. It is playable, but after 4...exd4 White has given a pawn and must know the gambit lines; 4.d3 keeps the material and the same attacking setup.',
              Ng5: '4.Ng5 hits f7, but 4...d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Be2 gives Black active play for the pawn and is a lot to remember. This lesson keeps it simple with 4.d3.',
            },
          },
          {
            san: 'Bc5',
            isUserMove: false,
            annotation: 'Black develops the bishop; the position is a Giuoco Pianissimo.',
          },
          {
            san: 'c3',
            isUserMove: true,
            annotation: 'Prepares the d4 advance and takes the b4 and d4 squares away from Black\'s pieces.',
          },
          { san: 'd6', isUserMove: false },
          {
            san: 'O-O',
            isUserMove: true,
            annotation: 'The king is safe before the centre opens. From here the plan is Re1, Nbd2, Bb3 and d4 at the right moment.',
          },
        ],
        Nd4: [
          {
            san: 'Nxd4',
            isUserMove: true,
            frequency: 5,
            annotation:
              'The Blackburne-Shilling knight. Take it: 4.Nxd4 exd4 leaves Black with an isolated pawn on d4 and nothing developed, and 5.c3 goes after that pawn.',
            hintTheme: 'Remove the knight before it causes trouble',
            wrongMoveFeedback: {
              Nxe5: '4.Nxe5? is what the knight move invites: 4...Qg5 attacks the knight on e5 and the pawn on g2 at once. 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3# is mate, and 5.Bxf7+ Ke7 6.O-O Qxe5 7.Bxg8 Rxg8 leaves Black a piece for two pawns.',
              c3: '4.c3 is also fine (4...Nxf3+ 5.Qxf3), but this lesson keeps the structure simple with 4.Nxd4.',
            },
          },
          { san: 'exd4', isUserMove: false, annotation: 'Black recaptures. The pawn on d4 is isolated and, for the moment, defended by nothing.' },
          {
            san: 'c3',
            isUserMove: true,
            annotation: 'Attacks the d4 pawn, which nothing defends yet. Whether Black takes on c3 or defends, White gets open lines and the better development.',
          },
          {
            san: 'dxc3',
            isUserMove: false,
            annotation: 'Black takes the pawn and gives it straight back after 6.Nxc3.',
            alternatives: {
              Bc5: [
                {
                  san: 'cxd4',
                  isUserMove: true,
                  annotation: 'Takes the pawn back and attacks the bishop. White now has both centre pawns.',
                },
                { san: 'Bb6', isUserMove: false },
                {
                  san: 'O-O',
                  isUserMove: true,
                  annotation: 'Castle. White has the d4 and e4 pawns and a safe king; Black has only the bishop out.',
                },
              ],
            },
          },
          {
            san: 'Nxc3',
            isUserMove: true,
            annotation: 'Material is level again and White has a bishop and a knight out against nothing.',
          },
        ],
        h6: [
          {
            san: 'd4',
            isUserMove: true,
            frequency: 16,
            annotation: '3...h6 does nothing for development, so open the centre at once.',
            hintTheme: 'Use the tempo: strike in the centre',
            wrongMoveFeedback: {
              'O-O': '4.O-O was your choice in all 16 games with 3...h6. It is sound, but it lets Black catch up; 4.d4 uses the move Black just spent on the h-pawn.',
            },
          },
          { san: 'exd4', isUserMove: false },
          {
            san: 'Nxd4',
            isUserMove: true,
            annotation: 'Recapture with the knight. Material stays level and the knight stands in the centre.',
          },
          { san: 'Nxd4', isUserMove: false, annotation: 'Black trades off the knight that would otherwise have been chased by the queen.' },
          {
            san: 'Qxd4',
            isUserMove: true,
            annotation:
              'The queen takes the centre, and Black has no knight left to chase it with ...Nc6. After five moves Black has no piece developed; White has a bishop and the queen out and can castle next move.',
          },
        ],
      },
    },
    {
      san: 'b4',
      isUserMove: true,
      annotation: 'The Evans Gambit! White gives up the b4 pawn to deflect the bishop and prepare c3 followed by d4.',
      hintPiece: 'b-Pawn',
      hintSquare: 'b4',
      hintTheme: 'Wing sacrifice for central tempo',
    },
    {
      san: 'Bxb4',
      isUserMove: false,
      // After 4.b4: ...Bxb4 in all 7 games.
      frequency: 7,
      annotation: 'Black accepts the pawn, as happened in all seven of your Evans games.',
      alternatives: {
        Bb6: [
          {
            san: 'a4',
            isUserMove: true,
            annotation:
              'The Evans Gambit Declined. 5.a4 threatens 6.a5, when the bishop on b6 has no retreat square: a7 is blocked by its own pawn, and c5 and d4 are covered by the b4 pawn and the f3 knight.',
            hintTheme: 'Threaten to trap the bishop',
          },
          {
            san: 'a6',
            isUserMove: false,
            annotation: 'Black makes room on a7 for the bishop and stops b5 from hitting the c6 knight.',
          },
          { san: 'Nc3', isUserMove: true, annotation: 'Develops and prepares Nd5.' },
          { san: 'Nf6', isUserMove: false },
          {
            san: 'Nd5',
            isUserMove: true,
            annotation: 'The knight attacks the bishop on b6 and the knight on f6. After 7...Nxd5 8.exd5 the c6 knight is attacked too and has to move again.',
          },
        ],
      },
    },
    {
      san: 'c3',
      isUserMove: true,
      annotation: 'Gain a tempo attacking the bishop and establishing support for the d4 advance.',
      hintPiece: 'c-Pawn',
      hintSquare: 'c3',
    },
    // After 5.c3: ...Bc5 in all 7 games.
    { san: 'Bc5', isUserMove: false, frequency: 7 },
    {
      san: 'd4',
      isUserMove: true,
      annotation: 'Strike the center! Black cannot easily maintain the pawn on e5.',
      hintPiece: 'Queen Pawn',
      hintSquare: 'd4',
    },
    // After 6.d4: ...exd4 in all 7 games.
    { san: 'exd4', isUserMove: false, frequency: 7 },
    {
      san: 'O-O',
      isUserMove: true,
      annotation: 'Castle before recapturing! King safety is secured while Black\'s king remains exposed.',
      hintPiece: 'King',
      hintSquare: 'g1',
      hintTheme: 'Rapid king safety',
    },
    {
      san: 'd6',
      isUserMove: false,
      // After 7.O-O every archived game (4 of 4) went 7...dxc3; the book reply 7...d6 has not been seen yet.
      annotation: 'The book reply: Black returns a pawn to free the c8 bishop and keep the king safe.',
      alternatives: {
        dxc3: [
          {
            san: 'Qb3',
            isUserMove: true,
            frequency: 4,
            annotation:
              'The Compromised Defence: Black is three pawns up with nothing out but the bishop and the c6 knight. 8.Qb3 lines the queen up behind the bishop on the a2-g8 diagonal, so Bxf7+ is a threat, and it attacks b7 as well.',
            hintTheme: 'Battery against f7',
          },
          { san: 'Qf6', isUserMove: false, annotation: 'Defends f7 with the queen.' },
          { san: 'e5', isUserMove: true, annotation: 'Attacks the queen and gains another move.' },
          { san: 'Qg6', isUserMove: false },
          {
            san: 'Nxc3',
            isUserMove: true,
            annotation:
              'Material: Black is two pawns up. Development: White has four pieces out and a castled king; Black has three, and the king is still on e8.',
          },
        ],
      },
    },
    {
      san: 'cxd4',
      isUserMove: true,
      annotation: 'Recapture on d4 with a towering pawn center on d4 and e4.',
      hintPiece: 'c-Pawn',
      hintSquare: 'd4',
    },
    { san: 'Bb6', isUserMove: false },
    {
      san: 'Nc3',
      isUserMove: true,
      annotation: 'Develop the queen knight, securing total control over central squares.',
      hintPiece: 'Queen Knight',
      hintSquare: 'c3',
    },
  ],
  exercises: [
    {
      id: 'ex-evans-1',
      title: 'Castling Before Recapture in the Evans',
      fen: 'r1bqk1nr/pppp1ppp/2n5/2b5/2BpP3/2P2N2/P4PPP/RNBQK2R w KQkq - 0 7',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Black just played 6...exd4. How does White prioritize rapid development and king safety over hasty pawn grabbing?',
      solutionSan: ['O-O', 'd6', 'cxd4'],
      explanation: '7.O-O! leaves Black’s king stranded in the center and activates the f1 rook for central operations before recapturing on d4.',
    },
  ],
  mistakesAndTraps: [
    {
      // Reachable in the 3...Nd4 branch: the position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4
      triggerFen: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      attemptedSan: 'Nxe5',
      isTrap: true,
      severity: 'trap_victim',
      explanatoryFeedback:
        '4.Nxe5? is the move the Blackburne-Shilling knight is fishing for. 4...Qg5 attacks the knight on e5 and the pawn on g2 at the same time: 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3# is checkmate, and 5.Bxf7+ Ke7 6.O-O Qxe5 7.Bxg8 Rxg8 leaves Black a piece for two pawns. 4.Nxd4 exd4 5.c3 keeps everything under control.',
      refutationSanList: ['Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'],
      punishmentSummary: 'Checkmate by queen and knight on f3; the knight that took on f7 never comes back.',
    },
  ],
});

export const adamsAttackSicilian: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-adams-attack-sicilian',
  title: 'Open Sicilian: Adams Attack (6.h3)',
  subtitle: 'Conquer the Najdorf and Open Sicilian with the aggressive 6.h3 kingside expansion',
  category: 'opening',
  sourceBook: 'Modernized: The Open Sicilian',
  author: 'IM Zhanibek Amanov & FM Kostya Kavutskiy',
  publicationYear: 2015,
  pagesRef: 'Najdorf 6.h3 chapter',
  eco: 'B90',
  targetColor: 'white',
  targetRatingBand: 'intermediate',
  // Requires an Open Sicilian with 5...a6; hoot65 has never reached this move order.
  relevance: 'outside-repertoire',
  description:
    'Against Black’s popular Najdorf Sicilian (5...a6), the Adams Attack (6.h3) prepares g4, creating an immediate kingside pawn storm while avoiding heavily analyzed theoretical main lines.',
  thematicObjective: 'Push g4, control the d5 square, and overwhelm Black’s kingside before queenside counterplay manifests.',
  keyTacticalMotif: 'Kingside flank expansion (h3/g4), central outpost on d5',
  moves: [
    { san: 'e4', isUserMove: true },
    { san: 'c5', isUserMove: false },
    { san: 'Nf3', isUserMove: true },
    { san: 'd6', isUserMove: false },
    { san: 'd4', isUserMove: true },
    { san: 'cxd4', isUserMove: false },
    { san: 'Nxd4', isUserMove: true },
    { san: 'Nf6', isUserMove: false },
    { san: 'Nc3', isUserMove: true },
    { san: 'a6', isUserMove: false },
    {
      san: 'h3',
      isUserMove: true,
      annotation: 'The Adams Attack! White readies 7.g4, intending to kick the f6 knight and roll forward.',
      hintPiece: 'h-Pawn',
      hintSquare: 'h3',
      hintTheme: 'Prepare kingside storm with g4',
    },
    { san: 'e5', isUserMove: false },
    {
      san: 'Nde2',
      isUserMove: true,
      annotation: 'Retreat the knight to e2: it keeps the f-pawn free and lets White follow with g3 and Bg2 on the long diagonal.',
      hintPiece: 'Knight on d4',
      hintSquare: 'e2',
    },
    { san: 'h5', isUserMove: false },
    {
      san: 'g3',
      isUserMove: true,
      annotation: 'Fianchetto preparation. White controls the light squares on the kingside.',
      hintPiece: 'g-Pawn',
      hintSquare: 'g3',
    },
    { san: 'Be6', isUserMove: false },
    {
      san: 'Bg2',
      isUserMove: true,
      annotation: 'The bishop exerts immense pressure down the long diagonal toward b7 and d5.',
      hintPiece: 'Bishop on f1',
      hintSquare: 'g2',
    },
    { san: 'Nbd7', isUserMove: false },
    {
      san: 'a4',
      isUserMove: true,
      annotation: 'Clamp down on Black\'s queenside expansion (...b5), cementing White\'s strategic advantage.',
      hintPiece: 'a-Pawn',
      hintSquare: 'a4',
    },
  ],
  exercises: [
    {
      id: 'ex-adams-1',
      title: 'Initiate the Adams Attack against the Najdorf',
      fen: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Black chose the Najdorf with 5...a6. How does White launch the Adams Attack?',
      solutionSan: ['h3', 'e5', 'Nde2'],
      explanation: '6.h3 prepares the immediate g4 expansion. When Black pushes 6...e5, White repositions the knight to e2, maintaining flexibility for f4.',
    },
  ],
});

export const openingLessons: CurriculumLesson[] = [
  scotchGambitBreakthrough,
  evansGambitDestruction,
  adamsAttackSicilian,
];
