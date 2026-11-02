import { CurriculumLesson } from '../types/curriculum';
import { buildVerifiedLesson } from './builder';

/**
 * Opening Lessons: Scotch Gambit & Italian Attack, Evans Gambit, and Adams Attack
 * Sources: TacticsInJuniorOpenings.pdf (Dave), Chess-Openings.pdf (Schiller & Watson), 7500.pdf (Amanov & Kavutskiy)
 */

export const scotchGambitBreakthrough: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-scotch-gambit-breakthrough',
  title: 'The Scotch Gambit: Punishing Early Passivity',
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
    'The Scotch Gambit (1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4) is a sharp answer to 1...e5. White sacrifices a pawn to seize the center, open diagonal lines toward Black’s vulnerable f7 square, and punish pawn grabbing.',
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
      annotation: 'A passive developing move. Club players more often answer 4...Nf6 or 4...Bc5; this line shows what happens when Black neglects the center.',
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
      annotation: 'Black takes a second pawn.',
    },
    {
      san: 'Qd5',
      annotation: '6.Qd5, backed by the c4 bishop, threatens Qxf7#.',
      hintPiece: 'White Queen',
      hintSquare: 'd5',
      hintTheme: 'Mate threat on f7',
      arrows: [{ from: 'd5', to: 'f7', color: 'red' }, { from: 'c4', to: 'f7', color: 'red' }],
      // Stockfish 19 at depth 22: 6.Nxc3 +1.13, 6.Qd5 +0.41; the lesson drills the mate threat
      wrongMoveFeedback: {
        Nxc3: "6.Nxc3 is Stockfish's choice and a good move: for the pawn, White has three pieces out to Black's two and the better game. This lesson plays 6.Qd5 instead, which threatens mate at once; play it here.",
      },
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
      annotation: 'Black castles; now the f8 rook defends f7 as well.',
    },
    {
      san: 'Bxg7',
      annotation: 'Take the g7 pawn in front of Black’s king.',
      hintPiece: 'Dark-squared Bishop',
      hintSquare: 'g7',
      hintTheme: 'Take a pawn from the king’s cover',
    },
    {
      san: 'Kxg7',
      annotation: 'Black recaptures.',
    },
    {
      san: 'Nxc3',
      annotation: '9.Nxc3 restores material balance, and Black’s king has lost the g7 pawn that sheltered it.',
      hintPiece: 'Queen Knight',
      hintSquare: 'c3',
      hintTheme: 'Win back the second pawn',
    },
  ],
  exercises: [
    {
      id: 'ex-scotch-1',
      title: 'Find White\'s Threat Against f7',
      fen: 'r1bqk1nr/ppppbppp/2n5/8/2B1P3/2p2N2/PP3PPP/RNBQK2R w KQkq - 0 6',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Black just played 5...dxc3, taking a second pawn. Find the queen move into the centre that threatens mate in one.',
      solutionSan: ['Qd5', 'Nh6', 'Bxh6'],
      explanation: '6.Qd5! threatens Qxf7#, the c4 bishop backing the queen (6.Qb3 threatens the same mate). Against the best defence Stockfish prefers 6.Nxc3, but here 6...Nh6 is the only move that holds, and Maia expects about four in ten players at your level to miss it. After 6...Nh6, White removes the defender with 7.Bxh6!',
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
      refutationSanList: [],
      punishmentSummary: 'After 6.bxc3 White is still a pawn down, while 6.Qd5 Nh6 7.Bxh6 O-O 8.Bxg7 Kxg7 9.Nxc3 wins both pawns back.',
    },
  ],
});

export const evansGambitDestruction: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-evans-gambit-destruction',
  title: 'The Evans Gambit: Rapid Wing Sacrifice',
  subtitle: 'A pawn sacrifice for a quick pawn centre and early castling',
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
              'The Two Knights Defence. 4.d3 keeps e4 defended by a pawn and sets up the quiet Italian plan: c3, O-O, Re1 and Nbd2, with d4 later.',
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
          { san: 'O-O', isUserMove: false },
          {
            san: 'Bb3',
            isUserMove: true,
            annotation:
              'Step the bishop back before it is hit by ...d5 or ...Na5. On b3 the a2 pawn guards it and it still aims at f7 through c4, d5 and e6.',
            hintTheme: 'Keep the bishop safe on the same diagonal',
          },
        ],
        Nd4: [
          {
            san: 'Nxd4',
            isUserMove: true,
            frequency: 5,
            annotation:
              'The Blackburne-Shilling knight. Take it: 4.Nxd4 exd4 leaves Black with an isolated pawn on d4 and nothing developed. Castle next; c3 goes after that pawn.',
            hintTheme: 'Remove the knight before it causes trouble',
            wrongMoveFeedback: {
              Nxe5: '4.Nxe5? is what the knight move invites: 4...Qg5 attacks the knight on e5 and the pawn on g2 at once. 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3# is mate, and 5.Bxf7+ Ke7 6.O-O Qxe5 7.Bxg8 Rxg8 leaves Black a piece for two pawns.',
              c3: '4.c3 is also fine (4...Nxf3+ 5.Qxf3), but this lesson keeps the structure simple with 4.Nxd4.',
            },
          },
          { san: 'exd4', isUserMove: false, annotation: 'Black recaptures. The pawn on d4 is isolated and, for the moment, defended by nothing.' },
          {
            san: 'O-O',
            isUserMove: true,
            annotation: 'Castle first. The king is safe before any line opens, and c3 against the d4 pawn, which nothing defends, can come next.',
            hintTheme: 'King safe first, then the d4 pawn',
            wrongMoveFeedback: {
              Qf3: '5.Qf3 was your move in all three games that reached this position, and all three were lost. It threatens Qxf7#, but a single defensive move stops that (...Qe7 and ...f6 were the replies in your games), and then the queen is out early with no target left. Castle instead; c3 against the d4 pawn comes next.',
              c3: '5.c3 is good too: it attacks the d4 pawn at once. Castling first is a little stronger, and c3 can follow.',
            },
          },
          {
            san: 'Bc5',
            isUserMove: false,
            annotation: 'The bishop comes out, but on c5 nothing defends it.',
            alternatives: {
              d6: [
                {
                  san: 'c3',
                  isUserMove: true,
                  annotation: 'Now c3: the king is safe, and the pawn attacks d4, which nothing defends.',
                  hintTheme: 'Attack the undefended pawn',
                },
              ],
              Nf6: [
                {
                  san: 'Re1',
                  isUserMove: true,
                  annotation: 'The knight hits e4, which nothing defends, so the rook guards it; c3 against the d4 pawn comes next.',
                  hintTheme: 'Guard e4 first',
                },
              ],
            },
          },
          {
            san: 'Bxf7+',
            isUserMove: true,
            annotation: 'Give up the bishop for the f7 pawn. The king must take it or step aside, and nothing defends the bishop on c5.',
            hintTheme: 'Check first: the c5 bishop has no defender',
            wrongMoveFeedback: {
              c3: '6.c3 is natural, but look at the c5 bishop first: nothing defends it. 6.Bxf7+ Kxf7 7.Qh5+ checks the king and attacks the bishop at the same time.',
            },
          },
          {
            san: 'Kxf7',
            isUserMove: false,
            annotation: 'The king takes the bishop.',
            alternatives: {
              Kf8: [
                {
                  san: 'Bb3',
                  isUserMove: true,
                  annotation: 'The bishop goes back. White is a pawn up, and the black king can no longer castle.',
                },
              ],
            },
          },
          {
            san: 'Qh5+',
            isUserMove: true,
            annotation: 'Check from h5, and along the fifth rank the queen also attacks the c5 bishop.',
            hintTheme: 'A check that attacks something else',
          },
          {
            san: 'g6',
            isUserMove: false,
            alternatives: {
              Kf8: [
                {
                  san: 'Qxc5+',
                  isUserMove: true,
                  annotation: 'The bishop falls with check. White is a pawn up, and the black king can no longer castle.',
                },
              ],
            },
          },
          {
            san: 'Qxc5',
            isUserMove: true,
            annotation: 'The bishop is back: White is a pawn up, the black king can no longer castle, and the queen attacks the d4 pawn.',
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
          { san: 'd6', isUserMove: false, annotation: 'Black opens the c8 bishop\'s diagonal. Still no black piece is developed.' },
          {
            san: 'O-O',
            isUserMove: true,
            annotation:
              'Castle now. The queen on d4 guards e4, so nothing is loose, and Nc3 and Re1 come next. Black has spent moves on ...h6 and ...d6 and traded the only developed piece.',
            hintTheme: 'King safety first',
          },
        ],
        // Stockfish 19 at depth 20-22: 4.O-O +0.37 (4.d4 +0.39, 4.c3 +0.43); after 4...Bg4, 5.h3 +0.53 and
        // 5.Re1 +0.16, after which 5...Nd4 leaves 6.Be2 (+0.20) as the only move that holds
        d6: [
          {
            san: 'O-O',
            isUserMove: true,
            frequency: 4,
            annotation: '3...d6 blocks the f8 bishop\'s diagonal: it can only come out to e7. Castle, as you did in three of your four games with 3...d6.',
            wrongMoveFeedback: {
              d4: '4.d4 is as good (Stockfish rates it about the same). This lesson castles first, as you do.',
              c3: '4.c3 is as good (Stockfish rates it about the same). This lesson castles first, as you do.',
            },
          },
          {
            san: 'Bg4',
            isUserMove: false,
            // After 4.O-O: ...Bg4 2, ...Be6 1.
            frequency: 2,
            annotation: 'The bishop pins the f3 knight to your queen. Nothing defends it on g4.',
            alternatives: {
              Be6: [
                {
                  san: 'Bxe6',
                  isUserMove: true,
                  frequency: 1,
                  annotation: 'Trade the bishops, as in your game: after ...fxe6 Black has two pawns on the e-file.',
                },
                { san: 'fxe6', isUserMove: false },
                {
                  san: 'd4',
                  isUserMove: true,
                  annotation: 'Open the centre: Black has only the c6 knight out, and the king is still on e8.',
                  accept: { san: ['c3'] },
                },
              ],
            },
          },
          {
            san: 'h3',
            isUserMove: true,
            annotation: 'Ask the bishop at once: it takes on f3, keeps the pin from h5, or goes back.',
            hintTheme: 'Ask the pinning bishop',
            wrongMoveFeedback: {
              Re1: '5.Re1?! was your move in both of these games, and you lost both. After 5...Nd4 the knight and the bishop both hit f3, and only 6.Be2 holds: 6.Re3? Bxf3 7.Rxf3 Nxf3+ loses the exchange, and 6.c3? Nxf3+ 7.gxf3 Bh3 breaks open your king. Ask the bishop first.',
            },
          },
          {
            san: 'Bh5',
            isUserMove: false,
            annotation: 'The bishop keeps the pin.',
            alternatives: {
              Bxf3: [
                {
                  san: 'Qxf3',
                  isUserMove: true,
                  annotation: 'Take back with the queen: with the c4 bishop it threatens Qxf7#, and you keep the two bishops.',
                },
              ],
            },
          },
          {
            san: 'c3',
            isUserMove: true,
            annotation: 'Prepare d4, with the c3 pawn to support it. Stockfish rates 6.Nc3 about the same.',
            accept: { san: ['Nc3'] },
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
      wrongMoveFeedback: {
        'O-O': '4.O-O is sound (Stockfish even rates it a little higher), but this repertoire plays the Evans Gambit: in your games 4.b4 scored 6 points in 7 and 4.O-O none in 3.',
      },
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
    {
      san: 'Bc5',
      isUserMove: false,
      // After 5.c3: ...Bc5 in all 7 games. The book retreat 5...Ba5 has not been seen yet (weight 1).
      frequency: 7,
      alternatives: {
        Ba5: [
          {
            san: 'd4',
            isUserMove: true,
            annotation:
              'The bishop went to a5, out of reach of d4 and still eyeing c3. The plan does not change: strike in the centre.',
            hintTheme: 'Same plan against every retreat',
          },
          { san: 'exd4', isUserMove: false },
          {
            san: 'O-O',
            isUserMove: true,
            annotation: 'As in the main line: castle first and recapture on d4 afterwards.',
          },
          { san: 'Nge7', isUserMove: false, annotation: 'Black develops the knight and prepares ...d5 to free the c8 bishop.' },
          {
            san: 'cxd4',
            isUserMove: true,
            annotation: 'Take back with the c-pawn: White has pawns on d4 and e4, and with b2 empty the c1 bishop can reach a3 in one move.',
          },
          { san: 'd5', isUserMove: false },
          {
            san: 'exd5',
            isUserMove: true,
            annotation: 'Take the pawn. After ...Nxd5 the e-file and the a3-f8 diagonal are both open next to Black\'s king.',
          },
          { san: 'Nxd5', isUserMove: false },
          {
            san: 'Ba3',
            isUserMove: true,
            annotation:
              'Black is a pawn up, but the bishop now covers f8, the square the king crosses to castle short, so Black can no longer castle kingside and the king stays in the centre.',
            hintTheme: 'Keep the king in the centre',
            arrows: [{ from: 'a3', to: 'f8', color: 'red' }],
          },
        ],
      },
    },
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
          {
            san: 'Bg5',
            isUserMove: true,
            annotation: 'Develop with a threat: the bishop attacks the queen.',
            hintTheme: 'Bring a piece out with a threat',
            wrongMoveFeedback: {
              e5: '9.e5 hits the queen too, but with a pawn; 9.Bg5 hits it with a piece that comes into play, and Stockfish rates it more than a pawn better.',
            },
          },
          { san: 'Qg6', isUserMove: false },
          {
            san: 'Nxc3',
            isUserMove: true,
            annotation:
              'Material: Black is two pawns up. Development: White has five pieces out and a castled king; Black has three, and the king is still on e8.',
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
    {
      id: 'ex-italian-h6-bishop',
      title: 'A Familiar Developing Move on the Wrong Square',
      // 1.e4 e5 2.Nf3 Nc6 3.Bc4 h6 4.d4 Bc5
      fen: 'r1bqk1nr/pppp1pp1/2n4p/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
      turn: 'w',
      difficultyRating: 1,
      prompt:
        'White to play. After 3...h6 you met 4.d4 with the bishop developing to its usual Italian square, 4...Bc5. What does White play?',
      solutionSan: ['dxc5'],
      explanation:
        '5.dxc5 wins a whole bishop: the d4 pawn attacks c5 and no black piece can take back on c5. Against 3...h6 the d4 pawn arrives before Black\'s bishop does, so the usual ...Bc5 is no longer available.',
    },
    {
      id: 'ex-italian-d6-two-on-f3',
      title: 'Two Pieces on f3',
      // 1.e4 e5 2.Nf3 Nc6 3.Bc4 d6 4.O-O Bg4 5.Re1 Nd4
      fen: 'r2qkbnr/ppp2ppp/3p4/4p3/2BnP1b1/5N2/PPPP1PPP/RNBQR1K1 w kq - 4 6',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. After 5.Re1 Nd4 the knight and the bishop both hit your f3 knight. Which move holds?',
      solutionSan: ['Be2', 'Nxe2+', 'Qxe2'],
      explanation:
        '6.Be2! lets the bishop take back on f3, so your g-pawn stays home: 6...Nxf3+ 7.Bxf3, or 6...Nxe2+ 7.Qxe2, and the game is level (Stockfish +0.2). 6.Re3? Bxf3 7.Rxf3 Nxf3+ 8.Qxf3 loses the exchange; 6.c3? or 6.h3? Nxf3+ 7.gxf3 breaks open your king (after 6.h3, 7...Bxh3 also takes a pawn); and 6.Nxd4?? Bxd1 loses the queen.',
    },
    {
      id: 'ex-two-knights-e4-guard',
      title: 'Why the d3 Pawn Matters',
      // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d3 Nxe4
      fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. After 3...Nf6 4.d3 Black grabbed the e4 pawn with the knight. What does White play?',
      solutionSan: ['dxe4'],
      explanation:
        '5.dxe4 wins a knight for a pawn. This is the point of 4.d3: the pawn on d3 defends e4. After 4.d4 exd4 nothing defends e4, so there ...Nxe4 wins a pawn instead of losing a piece.',
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
        '4.Nxe5? is the move the Blackburne-Shilling knight is fishing for. 4...Qg5 attacks the knight on e5 and the pawn on g2 at the same time: 5.Nxf7 Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3# is checkmate, and 5.Bxf7+ Ke7 6.O-O Qxe5 7.Bxg8 Rxg8 leaves Black a piece for two pawns. 4.Nxd4 exd4 5.O-O keeps everything under control.',
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

/**
 * The Two Knights with 4.d4, the move hoot65 plays against 3...Nf6 (the Evans lesson's branch
 * teaches 4.d3, so this drill starts after 4.d4 exd4 and the two never share a decision). Every
 * evaluation quoted is Stockfish 19's at depth 20; the counts are the seed games'.
 */
export const twoKnightsD4Lesson: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-two-knights-d4',
  title: 'Two Knights with 4.d4: The Pin on the e-File',
  subtitle: 'The open e-file, with Black\'s king still on e8',
  category: 'opening',
  sourceBook: 'Chess.com Live Archive',
  author: 'hoot65 Diagnostic Analysis',
  publicationYear: 2026,
  eco: 'C55',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  relevance: 'core',
  startPly: 8,
  description:
    'Against 3...Nf6 you played 4.d4 in 10 of your 12 games (5 points). After 4...exd4 5.O-O Black chose 5...Bc5 (3 games), 5...Nxe4 (2) or 5...d6 (2). Against 5...Bc5 your next move cost about a pawn, and against 5...Nxe4 your seventh did (after 6.Re1 d5 you played 7.Nxd4, not 7.Bxd5). Against 5...d6 you lost both games, though your 6.Re1 there was only a little worse than taking the pawn back. With Black\'s king still on e8, the e-file decides: a rook on e1 pins a knight on e4, and a check on e1 comes first.',
  thematicObjective:
    'Against 5...Nxe4: 6.Re1 d5 7.Bxd5! Qxd5 8.Nc3 wins the piece back. Against 5...Bc5: 6.e5 d5 7.exf6 dxc4 8.Re1+. Against 5...d6: take the pawn back with 6.Nxd4.',
  keyTacticalMotif: 'A knight on e4 pinned to the king by the rook on e1, attacked again by Nc3',
  moves: [
    { san: 'e4', isUserMove: true },
    { san: 'e5', isUserMove: false },
    { san: 'Nf3', isUserMove: true },
    { san: 'Nc6', isUserMove: false },
    { san: 'Bc4', isUserMove: true },
    { san: 'Nf6', isUserMove: false },
    { san: 'd4', isUserMove: true },
    // After 4.d4: 4...exd4 7, 4...Bb4+ 1, 4...Bd6 1, 4...d5 1.
    { san: 'exd4', isUserMove: false, frequency: 7 },
    {
      san: 'O-O',
      isUserMove: true,
      annotation: 'Castle before taking back: the rook is ready for the e-file.',
      hintTheme: 'King to safety, rook to the centre',
      wrongMoveFeedback: {
        e5: '5.e5 is just as good by Stockfish. This lesson castles first, so that the rook comes to e1 against the king.',
      },
    },
    {
      san: 'Nxe4',
      isUserMove: false,
      // After 5.O-O: 5...Bc5 3, 5...Nxe4 2, 5...d6 2.
      frequency: 2,
      alternatives: {
        Bc5: [
          {
            san: 'e5',
            isUserMove: true,
            frequency: 3,
            annotation: 'Hit the f6 knight at once.',
            hintTheme: 'Gain time on the knight',
            wrongMoveFeedback: {
              b4: '6.b4 was your move in two of these games; Stockfish rates it about a pawn worse than 6.e5, which hits the f6 knight at once.',
              Re1: '6.Re1 was your move in one of these games; Stockfish rates it about a pawn worse than 6.e5, which hits the f6 knight at once.',
            },
          },
          { san: 'd5', isUserMove: false, annotation: 'Black counterattacks the bishop on c4.' },
          { san: 'exf6', isUserMove: true, annotation: 'Take the knight.' },
          { san: 'dxc4', isUserMove: false },
          {
            san: 'Re1+',
            isUserMove: true,
            annotation: 'Check first, with the king still on e8. 8...Be7?? 9.fxe7 takes the bishop and attacks the queen.',
            hintTheme: 'Check on the open file',
          },
        ],
        d6: [
          {
            san: 'Nxd4',
            isUserMove: true,
            frequency: 2,
            annotation: 'Take the pawn back: White has the centre and the freer game. 6.Re1, your move in both of these games, is nearly as good.',
            hintTheme: 'Win back the pawn',
            accept: { san: ['Re1'] },
          },
        ],
      },
    },
    { san: 'Re1', isUserMove: true, annotation: 'The rook comes to the e-file with the knight on e4 in front of the king.', hintTheme: 'The open e-file' },
    // After 6.Re1: 6...d5 2.
    { san: 'd5', isUserMove: false, frequency: 2, annotation: 'Black defends the knight with the pawn and attacks the bishop.' },
    {
      san: 'Bxd5',
      isUserMove: true,
      annotation: 'Take the defender: after 7...Qxd5 the knight on c3 comes with an attack on the queen and on the pinned knight.',
      hintTheme: 'Remove the defender',
      wrongMoveFeedback: {
        Nxd4: '7.Nxd4 was your move in both of these games; Stockfish rates it about a pawn worse than 7.Bxd5, which gets the piece back.',
      },
    },
    { san: 'Qxd5', isUserMove: false },
    {
      san: 'Nc3',
      isUserMove: true,
      annotation: 'The knight attacks the queen and the knight on e4, which cannot move: it shields the king from the rook.',
      hintTheme: 'Attack the pinned piece',
    },
    { san: 'Qa5', isUserMove: false, annotation: 'The queen steps away and keeps an eye on the c3 knight.' },
    { san: 'Nxe4', isUserMove: true, annotation: 'The piece is back, and the knight stays on the e-file in front of the rook.' },
  ],
  exercises: [
    {
      id: 'ex-two-knights-remove-defender',
      title: 'The Knight on e4',
      // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d4 exd4 5.O-O Nxe4 6.Re1 d5 (your games, where you played 7.Nxd4)
      fen: 'r1bqkb1r/ppp2ppp/2n5/3p4/2Bpn3/5N2/PPP2PPP/RNBQR1K1 w kq - 0 7',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. The knight on e4 is pinned to the king. How does White win it back?',
      solutionSan: ['Bxd5'],
      explanation: '7.Bxd5! takes the pawn that defends the knight. After 7...Qxd5 8.Nc3 the knight on c3 attacks the queen and the pinned knight on e4, and White gets the piece back.',
    },
  ],
});

/**
 * White against the Caro-Kann along hoot65's own games: 2.Nc3 and 3.Nf3, the knights first (the
 * plan in docs/pedagogy-audit.md, DC-1: keep what scores). Evaluations are Stockfish 19's at depth
 * 20; the counts are the seed games' in this move order.
 */
export const caroKannForWhiteLesson: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-white-vs-caro-kann',
  title: 'Against the Caro-Kann as White',
  subtitle: 'When Black pins with the bishop',
  category: 'opening',
  sourceBook: 'Chess.com Live Archive',
  author: 'hoot65 Diagnostic Analysis',
  publicationYear: 2026,
  eco: 'B11',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  relevance: 'core',
  startPly: 2,
  description:
    '1...c6 came up in 19 of your White games. You answered 2.Nc3 in 10 of them, 2.Nf3 in 8 and 2.h3 once. After 2.Nc3 d5 3.Nf3 Black played 3...Bg4 in 3 games and 3...dxe4 in 2, and you scored 4 points of 5. When the bishop pins the knight, ask it with h3; if it retreats to h5, take on d5 first and then chase it with g4.',
  thematicObjective:
    '2.Nc3 d5 3.Nf3 Bg4 4.h3: after 4...Bxf3 5.Qxf3 White has the two bishops; after 4...Bh5 5.exd5 cxd5 6.g4 Bg6 7.Ne5 the knight attacks the bishop on g6.',
  keyTacticalMotif: 'A bishop chased by h3 and g4, with 6...Bxg4?? 7.hxg4 losing it',
  moves: [
    { san: 'e4', isUserMove: true },
    { san: 'c6', isUserMove: false },
    {
      san: 'Nc3',
      isUserMove: true,
      annotation: 'Develop the knight and guard e4.',
      hintTheme: 'Develop and guard e4',
      wrongMoveFeedback: {
        Nf3: '2.Nf3 is good too (you played it 8 times): after 2...d5 3.Nc3 it is the same position. This lesson plays 2.Nc3 first.',
        d4: '2.d4 is good too, and leads to the main lines. This lesson keeps the knights\' plan you play.',
      },
    },
    // After 2.Nc3: 2...d5 9, 2...d6 1.
    { san: 'd5', isUserMove: false, frequency: 9, annotation: 'Black attacks e4.' },
    {
      san: 'Nf3',
      isUserMove: true,
      annotation: 'The second knight.',
      hintTheme: 'The second knight',
      wrongMoveFeedback: {
        h3: '3.h3?! spends a move before Black\'s bishop has come out; 3.Nf3 develops, and Stockfish rates it about a third of a pawn higher. You lost the game with 3.h3.',
        d4: '3.d4 is good too, and leads to the main lines. This lesson keeps the knights\' plan you play.',
      },
    },
    {
      san: 'Bg4',
      isUserMove: false,
      // After 3.Nf3: 3...Bg4 3, 3...dxe4 2.
      frequency: 3,
      annotation: 'The bishop pins the knight to the queen.',
      alternatives: {
        dxe4: [
          { san: 'Nxe4', isUserMove: true, frequency: 2, annotation: 'Take back.' },
          // After 4.Nxe4: 4...Nf6 1, 4...Bg4 1.
          { san: 'Nf6', isUserMove: false, frequency: 1 },
          {
            san: 'Nxf6+',
            isUserMove: true,
            annotation: 'Trade the knights: after 5...exf6 Black\'s f-pawns are doubled.',
            wrongMoveFeedback: {
              Qe2: '5.Qe2 is a good move too (Stockfish even prefers it slightly). This lesson trades on f6.',
            },
          },
          { san: 'exf6', isUserMove: false, frequency: 1 },
          {
            san: 'Bc4',
            isUserMove: true,
            annotation: 'Develop: the bishop on c4 aims at f7.',
            accept: { san: ['d4', 'Be2'] },
          },
        ],
      },
    },
    {
      san: 'h3',
      isUserMove: true,
      annotation: 'Ask the bishop at once: take on f3 or retreat.',
      hintTheme: 'Ask the bishop',
    },
    {
      san: 'Bh5',
      isUserMove: false,
      // After 4.h3: 4...Bh5 2.
      frequency: 2,
      annotation: 'Black keeps the bishop, but on h5 it can be chased.',
      alternatives: {
        Bxf3: [
          { san: 'Qxf3', isUserMove: true, annotation: 'Take back with the queen: White has the two bishops.' },
          { san: 'e6', isUserMove: false },
          {
            san: 'g3',
            isUserMove: true,
            annotation: 'A quiet plan: Bg2 and castling, with the two bishops.',
            accept: { san: ['d4', 'Be2', 'a3'] },
          },
        ],
      },
    },
    {
      san: 'exd5',
      isUserMove: true,
      annotation: 'Take on d5 first.',
      hintTheme: 'Exchange before you chase',
      wrongMoveFeedback: {
        g4: '5.g4 at once, your move in both of these games, is playable; Stockfish rates 5.exd5 cxd5 first stronger by about a third of a pawn.',
      },
    },
    { san: 'cxd5', isUserMove: false },
    {
      san: 'g4',
      isUserMove: true,
      annotation: 'Now chase the bishop: 6...Bxg4?? 7.hxg4 would lose it.',
      hintTheme: 'Chase the bishop',
      wrongMoveFeedback: {
        'Bb5+': '6.Bb5+ is playable, but Stockfish rates 6.g4 first stronger by about half a pawn.',
      },
    },
    { san: 'Bg6', isUserMove: false },
    {
      san: 'Ne5',
      isUserMove: true,
      annotation: 'The knight attacks the bishop on g6: after Nxg6 hxg6 White has the two bishops.',
    },
  ],
  exercises: [
    {
      id: 'ex-white-caro-bxg4',
      title: 'The Bishop on g4',
      // 1.e4 c6 2.Nc3 d5 3.Nf3 Bg4 4.h3 Bh5 5.exd5 cxd5 6.g4 Bxg4??
      fen: 'rn1qkbnr/pp2pppp/8/3p4/6b1/2N2N1P/PPPP1P2/R1BQKB1R w KQkq - 0 7',
      turn: 'w',
      difficultyRating: 1,
      prompt: 'White to play. Black has just taken on g4. What does White play?',
      solutionSan: ['hxg4'],
      explanation: '7.hxg4 takes the bishop: the h3 pawn guards g4, and Black has only a pawn for the piece.',
    },
  ],
});

/**
 * White against 1...Nc6 along hoot65's 2.Nf3: 2...e5 is the Italian, and against 2...d5 the
 * Scandinavian idea (take on d5 and hit the queen with Nc3). Evaluations are Stockfish 19's at depth
 * 20; the counts are the seed games'.
 */
export const nimzowitschForWhiteLesson: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-white-vs-nimzowitsch',
  title: 'Against 1...Nc6 as White',
  subtitle: "When Black's queen comes out early",
  category: 'opening',
  sourceBook: 'Chess.com Live Archive',
  author: 'hoot65 Diagnostic Analysis',
  publicationYear: 2026,
  eco: 'B00',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  relevance: 'core',
  startPly: 2,
  description:
    '1...Nc6 came up in 5 of your White games (2 points), and you answered 2.Nf3 every time. Against 2...e5 that is your Italian (2 games). Against 2...d5 you played 3.e5 both times (1 point), but taking on d5 is stronger: as against the Scandinavian, the queen that takes back is hit by Nc3 and has to move again.',
  thematicObjective:
    '2.Nf3 d5 3.exd5 Qxd5 4.Nc3 and 5.d4. If the queen goes to a5, pin with 5.Bb5; if it goes to h5, 5.Nb5 eyes c7.',
  keyTacticalMotif: 'Developing with an attack on the queen; a knight check on c7 that forks the king and the rook',
  moves: [
    { san: 'e4', isUserMove: true },
    { san: 'Nc6', isUserMove: false },
    {
      san: 'Nf3',
      isUserMove: true,
      annotation: 'Develop: against 2...e5 this is your Italian.',
      hintTheme: 'Develop toward the centre',
      wrongMoveFeedback: {
        d4: '2.d4 is good too (Stockfish even rates it higher). 2.Nf3 lets 2...e5 bring the game into your Italian.',
      },
    },
    {
      san: 'd5',
      isUserMove: false,
      // After 2.Nf3: 2...d5 2, 2...e5 2, 2...a6 1.
      frequency: 2,
      annotation: 'Black attacks e4 at once.',
      alternatives: {
        e5: [
          { san: 'Bc4', isUserMove: true, frequency: 2, annotation: 'The Italian: the lessons on 3.Bc4 take over from here.', accept: { san: ['Bb5', 'd4'] } },
        ],
        a6: [
          { san: 'd4', isUserMove: true, frequency: 1, annotation: 'Take the centre.', accept: { san: ['Nc3'] } },
        ],
      },
    },
    {
      san: 'exd5',
      isUserMove: true,
      annotation: 'Take: the queen that takes back will be hit.',
      hintTheme: 'Take, then hit the queen',
      wrongMoveFeedback: {
        e5: '3.e5 was your move in both of these games (1 point). Stockfish rates 3.exd5 about two thirds of a pawn higher: as against the Scandinavian, the queen that takes back is hit by Nc3.',
      },
    },
    { san: 'Qxd5', isUserMove: false },
    { san: 'Nc3', isUserMove: true, annotation: 'Develop with an attack on the queen.', hintTheme: 'Develop with a gain of time' },
    {
      san: 'Qd6',
      isUserMove: false,
      annotation: 'The queen steps back.',
      alternatives: {
        Qa5: [
          { san: 'Bb5', isUserMove: true, annotation: 'Pin the knight to the king on e8.', accept: { san: ['d4'] } },
        ],
        Qh5: [
          {
            san: 'Nb5',
            isUserMove: true,
            annotation: 'The knight eyes c7: Nxc7+ would fork the king and the rook.',
            hintTheme: 'A knight check on c7',
          },
        ],
        Qd8: [
          { san: 'd4', isUserMove: true, annotation: 'Take the centre.', accept: { san: ['Bb5'] } },
        ],
      },
    },
    { san: 'd4', isUserMove: true, annotation: 'Take the centre with the pawn.' },
  ],
  exercises: [
    {
      id: 'ex-white-nimzowitsch-qh5',
      title: 'The Queen on h5',
      // 1.e4 Nc6 2.Nf3 d5 3.exd5 Qxd5 4.Nc3 Qh5
      fen: 'r1b1kbnr/ppp1pppp/2n5/7q/8/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 2 5',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. The queen went to h5. What does White play?',
      solutionSan: ['Nb5'],
      explanation:
        '5.Nb5 attacks c7, which nothing defends: Nxc7+ would fork the king on e8 and the rook on a8, so Black has to meet the threat.',
    },
  ],
});

/**
 * White against 2...f6, the Damiano: the pawn leaves e5 with one defender and opens the e8-h5
 * diagonal. Evaluations are Stockfish 19's at depth 20; the counts are the seed games'.
 */
export const damianoForWhiteLesson: CurriculumLesson = buildVerifiedLesson({
  id: 'lesson-white-vs-damiano',
  title: 'Against 2...f6 as White',
  subtitle: 'From your two games against it',
  category: 'opening',
  sourceBook: 'Chess.com Live Archive',
  author: 'hoot65 Diagnostic Analysis',
  publicationYear: 2026,
  eco: 'C40',
  targetColor: 'white',
  targetRatingBand: 'beginner',
  relevance: 'core',
  startPly: 4,
  description:
    '2...f6 came up in 2 of your White games, and you lost both after 3.Bc4. The move defends e5 with the f-pawn alone and opens the diagonal from h5 to the king on e8, so the knight can take on e5 at once: if the pawn takes back, the queen checks on h5 and comes to e5 with another check.',
  thematicObjective: '3.Nxe5! Against 3...fxe5?? 4.Qh5+ and 5.Qxe5+; against 3...Qe7, retreat with 4.Nf3, and after 4...Qxe4+ block with 5.Be2.',
  keyTacticalMotif: 'The queen check on h5 along the diagonal the f-pawn opened',
  moves: [
    { san: 'e4', isUserMove: true },
    { san: 'e5', isUserMove: false },
    { san: 'Nf3', isUserMove: true },
    // After 2.Nf3: 2...Nc6 53, 2...d6 12, 2...f6 2, and one game each of 2...Nf6, 2...d5, 2...Qf6, 2...Bc5.
    { san: 'f6', isUserMove: false, frequency: 2, annotation: 'The f-pawn defends e5 and opens the diagonal from h5 to e8.' },
    {
      san: 'Nxe5',
      isUserMove: true,
      annotation: 'Take: if the f-pawn takes back, 4.Qh5+ wins the pawn back with check, along the diagonal to the king that 2...f6 opened.',
      hintTheme: 'Take the pawn',
      wrongMoveFeedback: {
        Bc4: '3.Bc4 was your move in both of these games, and you lost both. It is a good move (Stockfish +1.9), but 3.Nxe5! is stronger (+2.3).',
      },
    },
    {
      san: 'Qe7',
      isUserMove: false,
      annotation: 'The best defence: the queen attacks the knight, and behind it the e4 pawn.',
      alternatives: {
        fxe5: [
          { san: 'Qh5+', isUserMove: true, annotation: 'Check along the diagonal the f-pawn opened.', hintTheme: 'Check on the open diagonal' },
          {
            san: 'Ke7',
            isUserMove: false,
            alternatives: {
              g6: [
                { san: 'Qxe5+', isUserMove: true, annotation: 'Check, and the queen attacks the rook on h8.' },
              ],
            },
          },
          { san: 'Qxe5+', isUserMove: true, annotation: 'Check again: the king is driven up the board.' },
          { san: 'Kf7', isUserMove: false },
          { san: 'Bc4+', isUserMove: true, annotation: 'The bishop joins with check; Stockfish rates White about five pawns ahead.' },
        ],
      },
    },
    {
      san: 'Nf3',
      isUserMove: true,
      annotation: 'Retreat: the knight is safe on f3.',
      hintTheme: 'Save the knight',
      wrongMoveFeedback: {
        'Qh5+': '4.Qh5+?? g6 5.Nxg6 Qxe4+! 6.Be2 Qxg6: the check on e4 frees the queen to take the knight on g6.',
      },
    },
    {
      san: 'Qxe4+',
      isUserMove: false,
      annotation: 'The queen takes the pawn with check.',
      alternatives: {
        d5: [
          {
            san: 'd3',
            isUserMove: true,
            annotation: 'The queen on e7 pins the e4 pawn to your king, so it cannot take on d5: hold it with a pawn, which also opens the c1 bishop\'s diagonal.',
            hintTheme: 'Hold the pinned pawn',
            // Stockfish 19 at depth 22: 5.d3 +2.44, 5.Be2 +0.47, 5.Nc3 +0.06, 5.Qe2 -0.04
            wrongMoveFeedback: {
              Nc3: '5.Nc3? dxe4: the pinned pawn falls, and the pawn that takes it hits the f3 knight. Only 5.d3 keeps the extra pawn (Stockfish +2.4 against +0.1).',
              Be2: '5.Be2? dxe4: the pinned pawn falls, and the pawn that takes it hits the f3 knight. Only 5.d3 keeps the extra pawn (Stockfish +2.4 against +0.5).',
              Qe2: '5.Qe2? dxe4: the pawn falls anyway, and the pawn that takes it hits the f3 knight. Only 5.d3 keeps the extra pawn (Stockfish +2.4 against 0.0).',
            },
          },
        ],
      },
    },
    {
      san: 'Be2',
      isUserMove: true,
      annotation: 'Block with a developing move: Black\'s queen has moved twice, and the king is still on e8.',
    },
  ],
  exercises: [
    {
      id: 'ex-white-damiano-qh5',
      title: 'The Pawn Takes Back',
      // 1.e4 e5 2.Nf3 f6 3.Nxe5 fxe5??
      fen: 'rnbqkbnr/pppp2pp/8/4p3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4',
      turn: 'w',
      difficultyRating: 2,
      prompt: 'White to play. Black has taken the knight on e5. What does White play?',
      solutionSan: ['Qh5+', 'Ke7', 'Qxe5+'],
      explanation:
        '4.Qh5+ Ke7 5.Qxe5+: the queen checks along the diagonal the f-pawn opened and takes e5 with another check, and the king is driven up the board (5...Kf7 6.Bc4+). After 4...g6 instead, 5.Qxe5+ checks and attacks the rook on h8.',
    },
  ],
});

export const openingLessons: CurriculumLesson[] = [
  scotchGambitBreakthrough,
  evansGambitDestruction,
  twoKnightsD4Lesson,
  caroKannForWhiteLesson,
  nimzowitschForWhiteLesson,
  damianoForWhiteLesson,
  adamsAttackSicilian,
];
