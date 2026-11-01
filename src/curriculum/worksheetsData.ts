import { PrintableWorksheetData } from '../types/curriculum';

/**
 * Print-Ready Physical-Board Worksheets Data
 * Conforms to PROJECT.md § 5 and Explorer 3 specifications.
 * Supports:
 * 1. Opening Curriculum Lessons (Scotch Gambit, Konikowski Refutation, Siberian Trap)
 * 2. Personalized hoot65 Weakness Drills (Scandinavian 2.exd5! vs meny_26, Caro-Kann vs Brandon0015)
 *
 * The sheet (title, subtitle, lessonSummary, physicalBoardSteps, trapWarning name and explanation,
 * exercise prompts and lines) never names an answer; answerSummary, movesSan and the answer key are
 * printed on the separate answer page.
 */

export const scotchGambitWorksheet: PrintableWorksheetData = {
  id: 'ws-scotch-gambit',
  title: 'Chess Curriculum Study Sheet: The Scotch Gambit',
  subtitle: 'Punishing a pawn grab when f7 is guarded only by the king',
  type: 'curriculum_lesson',
  sourceBook: 'Tactics in Junior Openings',
  author: 'Dave',
  eco: 'C44',
  targetColor: 'white',
  diagramFen: 'r1bqk1nr/ppppbppp/2n5/8/2B1P3/2p2N2/PP3PPP/RNBQK2R w KQkq - 0 6',
  coordinates: true,
  movesSan: ['1.e4 e5', '2.Nf3 Nc6', '3.d4 exd4', '4.Bc4 Be7', '5.c3 dxc3', '6.Qd5! Nh6', '7.Bxh6 O-O', '8.Bxg7 Kxg7', '9.Nxc3'],
  lessonSummary:
    'The Scotch Gambit is one of White\'s sharpest answers to 1...e5. Instead of taking back on d4, White develops the bishop to c4, where it aims at f7, the square only Black\'s king defends. In the diagram Black has taken a second pawn with 5...dxc3 and has developed only the c6 knight and the e7 bishop.',
  answerSummary:
    'When Black grabs a second pawn with 5...dxc3, 6.Qd5 threatens mate on f7 with the queen and the c4 bishop together. After 6...Nh6 the knight is the only guard of f7 besides the king, so 7.Bxh6 removes it.',
  physicalBoardSteps: [
    'Set up the pieces with White nearest you.',
    'Play 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4 Be7 5.c3 dxc3 to reach Diagram 1.',
    'Note that only the king guards f7, and that the c4 bishop already aims at it.',
    'Cover the answer page, then write your answers below.',
  ],
  trapWarning: {
    name: 'Taking a Second Pawn (5...dxc3?)',
    blunderSan: '5...dxc3?',
    refutationSan: '6.Qd5! Nh6 7.Bxh6',
    explanation: 'Black has taken two pawns with only two pieces developed, and f7 has a single defender.',
  },
  exercises: [
    {
      prompt: 'Exercise 1: White to move (Diagram 1). Black has just played 5...dxc3. Find White\'s most forcing move.',
      turn: 'w',
      diagramFen: 'r1bqk1nr/ppppbppp/2n5/8/2B1P3/2p2N2/PP3PPP/RNBQK2R w KQkq - 0 6',
      fillInBlankLines: [
        'Candidate move: _______________________',
        'Direct threat: _______________________',
        'How Black can defend f7: _______________________',
      ],
    },
    {
      prompt: 'Exercise 2: White to move (Diagram 2). Black has covered f7 with the g8 knight. Find the move that removes the defender.',
      turn: 'w',
      diagramFen: 'r1bqk2r/ppppbppp/2n4n/3Q4/2B1P3/2p2N2/PP3PPP/RNB1K2R w KQkq - 2 7',
      fillInBlankLines: [
        'My move: _______________________',
        'Why taking back loses for Black: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '6.Qd5!',
      rationale:
        '6.Qd5 puts the queen in front of the c4 bishop and threatens 7.Qxf7#. Black has to defend f7 at once, for example with 6...Nh6.',
      fullSequence: ['6.Qd5', 'Nh6', '7.Bxh6', 'O-O', '8.Bxg7', 'Kxg7', '9.Nxc3'],
    },
    {
      exerciseIndex: 2,
      solutionSan: '7.Bxh6!',
      rationale:
        '7.Bxh6 removes the knight that guards f7: if 7...gxh6, 8.Qxf7# is mate. After 7...O-O 8.Bxg7 Kxg7 9.Nxc3 material is level, and Black\'s king has lost the g7 pawn in front of it.',
      fullSequence: ['7.Bxh6', 'O-O', '8.Bxg7', 'Kxg7', '9.Nxc3'],
    },
  ],
};

export const konikowskiWorksheet: PrintableWorksheetData = {
  id: 'ws-konikowski-refutation',
  title: 'Chess Curriculum Study Sheet: Refuting the Konikowski Gambit',
  subtitle: 'Meeting an early queen attack on e5 and g2',
  type: 'curriculum_lesson',
  sourceBook: 'Survive and Beat Annoying Chess Openings',
  author: 'Eric Schiller & John Watson',
  eco: 'C64',
  targetColor: 'white',
  diagramFen: 'r1b1k1nr/ppp2ppp/2n5/1BbpN1q1/4P3/2P5/PP1P1PPP/RNBQK2R w KQkq - 1 6',
  coordinates: true,
  movesSan: ['1.e4 e5', '2.Nf3 Nc6', '3.Bb5 Bc5', '4.c3 d5', '5.Nxe5 Qg5', '6.O-O! Qxe5', '7.d4! Qe6', '8.dxc5 dxe4', '9.Re1'],
  lessonSummary:
    'In the Konikowski Gambit (1.e4 e5 2.Nf3 Nc6 3.Bb5 Bc5 4.c3 d5 5.Nxe5 Qg5) Black\'s queen attacks the e5 knight and the g2 pawn at once. Black\'s king is still in the centre, and nothing defends the c5 bishop.',
  answerSummary:
    'Black\'s 5...Qg5 attacks e5 and g2. 6.O-O defends g2 with the king; if 6...Qxe5, 7.d4 attacks the queen and the undefended c5 bishop, and White wins the piece back.',
  physicalBoardSteps: [
    'Set up the pieces with White nearest you.',
    'Play 1.e4 e5 2.Nf3 Nc6 3.Bb5 Bc5 4.c3 d5 5.Nxe5 Qg5 to reach Diagram 1.',
    'List everything the g5 queen attacks, and every black piece that has no defender.',
    'Cover the answer page, then write your answers below.',
  ],
  exercises: [
    {
      prompt: 'Exercise 1: White to move (Diagram 1). How does White meet the threat to g2 and keep the initiative?',
      turn: 'w',
      diagramFen: 'r1b1k1nr/ppp2ppp/2n5/1BbpN1q1/4P3/2P5/PP1P1PPP/RNBQK2R w KQkq - 1 6',
      fillInBlankLines: [
        'Move: _______________________',
        'Threat prevented: _______________________',
        'Black\'s likely response: _______________________',
      ],
    },
    {
      prompt: 'Exercise 2: White to move (Diagram 2). Black\'s queen has taken the e5 knight. Find the pawn move that wins the material back.',
      turn: 'w',
      diagramFen: 'r1b1k1nr/ppp2ppp/2n5/1Bbpq3/4P3/2P5/PP1P1PPP/RNBQ1RK1 w kq - 0 7',
      fillInBlankLines: [
        'Move: _______________________',
        'Tactical motif: _______________________',
        'Pieces attacked: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '6.O-O!',
      rationale:
        '6.O-O gets the king out of the centre and puts it next to g2, so 6...Qxg2 would lose the queen to 7.Kxg2. If Black takes the knight instead with 6...Qxe5, Exercise 2 follows.',
      fullSequence: ['6.O-O', 'Qxe5', '7.d4'],
    },
    {
      exerciseIndex: 2,
      solutionSan: '7.d4!',
      rationale:
        '7.d4 attacks the queen on e5 and the bishop on c5 at once. The queen has to move, and 8.dxc5 wins the bishop back: after 7...Qe6 8.dxc5 dxe4 9.Re1 material is level and White has the two bishops.',
      fullSequence: ['7.d4', 'Qe6', '8.dxc5', 'dxe4', '9.Re1'],
    },
  ],
};

export const siberianTrapWorksheet: PrintableWorksheetData = {
  id: 'ws-siberian-trap',
  title: 'Opening Traps Study Sheet: The Siberian Trap',
  subtitle: 'When White chases the g4 knight with h3 in the Smith-Morra',
  type: 'curriculum_lesson',
  sourceBook: '101 Chess Opening Traps',
  author: 'Steve Giddins',
  eco: 'B21',
  targetColor: 'black',
  diagramFen: 'r1b1kb1r/ppqp1ppp/2n1p3/8/2B1P1n1/2N2N1P/PP2QPP1/R1B2RK1 b kq - 0 9',
  coordinates: true,
  movesSan: ['1.e4 c5', '2.d4 cxd4', '3.c3 dxc3', '4.Nxc3 Nc6', '5.Nf3 e6', '6.Bc4 Qc7', '7.O-O Nf6', '8.Qe2 Ng4', '9.h3? Nd4!'],
  lessonSummary:
    'In the Smith-Morra Gambit White often plays 9.h3 here to chase the g4 knight. Look at h2: Black\'s queen on c7 and knight on g4 both aim at it, and only the f3 knight and the king defend it.',
  answerSummary:
    'After 9.h3 the f3 knight is the only piece besides the king that guards h2, which Black\'s queen and g4 knight both attack. 9...Nd4 hits the queen and the f3 knight at once.',
  physicalBoardSteps: [
    'Set up the pieces with Black nearest you.',
    'Play 1.e4 c5 2.d4 cxd4 3.c3 dxc3 4.Nxc3 Nc6 5.Nf3 e6 6.Bc4 Qc7 7.O-O Nf6 8.Qe2 Ng4 9.h3 to reach Diagram 1.',
    'Ask what happens to h2 if the f3 knight is taken or has to move.',
    'Cover the answer page, then write your answers below.',
  ],
  exercises: [
    {
      prompt: 'Exercise 1: Black to move (Diagram 1). Find the move that attacks White\'s queen and threatens mate.',
      turn: 'b',
      diagramFen: 'r1b1kb1r/ppqp1ppp/2n1p3/8/2B1P1n1/2N2N1P/PP2QPP1/R1B2RK1 b kq - 0 9',
      fillInBlankLines: [
        'My move: _______________________',
        'What happens if White takes the piece you moved: _______________________',
        'What happens if White\'s queen moves away: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '9...Nd4!!',
      rationale:
        '9...Nd4 attacks the queen on e2 and the f3 knight. If 10.Nxd4, 10...Qh2# is mate, because nothing but the king guards h2 any more. If the queen moves, for example 10.Qd3, then 10...Nxf3+ 11.Qxf3 Qh2# is mate as well.',
      fullSequence: ['9...Nd4!!', '10.Nxd4', 'Qh2#'],
    },
  ],
};

export const hoot65ScandiWorksheet: PrintableWorksheetData = {
  id: 'ws-hoot65-scandi-drill',
  title: 'Personalized Diagnostic Worksheet for hoot65',
  subtitle: 'Fixing the Scandinavian: capture on d5 and develop with gain of time (the 2.e5?! from the loss to meny_26)',
  type: 'hoot65_drill',
  sourceBook: 'Tactics in Junior Openings / Chess.com Live Archive',
  author: 'hoot65 Game Analyzer',
  eco: 'B01',
  targetColor: 'white',
  diagramFen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3',
  coordinates: true,
  movesSan: ['1.e4 d5', '2.exd5! Qxd5', '3.Nc3! Qa5', '4.d4! Nf6', '5.Nf3 c6', '6.Bc4 Bf5', '7.Bd2 e6', '8.Nd5 Qd8', '9.Nxf6+ Qxf6', '10.Qe2'],
  lessonSummary:
    'Diagnostic review: on 2026-10-08 (Chess.com game 185031553576), in a rapid game against meny_26, you answered 1...d5 with 2.e5?!. The push gave up the pressure on d5, Black replied 2...d4, and you lost. The fix starts with 2.exd5: after 2...Qxd5 Black\'s queen stands in the middle of the board, and White can develop while making it move again.',
  answerSummary:
    'Capture with 2.exd5. After 2...Qxd5, 3.Nc3 develops with an attack on the queen, and 4.d4 follows. Later the c3 knight can jump to d5 to uncover the d2 bishop against a queen on a5.',
  physicalBoardSteps: [
    'Set up the pieces with White nearest you.',
    'Play 1.e4 d5. Pause and say it aloud: "Not 2.e5. Take on d5."',
    'Play 2.exd5 Qxd5 to reach Diagram 1.',
    'Cover the answer page, then write your answers below.',
  ],
  trapWarning: {
    name: 'Passive Center Push (2.e5?!)',
    blunderSan: '2.e5?!',
    refutationSan: '2...d4! 3.Nf3 Nc6',
    explanation: 'Pushing 2.e5 takes the pressure off d5 and lets Black gain space with ...d4, as in your game against meny_26.',
  },
  exercises: [
    {
      prompt: 'Exercise 1: White to move (Diagram 1). Black has just played 2...Qxd5. How do you develop a minor piece and make Black\'s queen move again?',
      turn: 'w',
      diagramFen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3',
      fillInBlankLines: [
        'Move: _______________________',
        'Square attacked: _______________________',
        'Next central move: _______________________',
      ],
    },
    {
      prompt: 'Exercise 2: White to move (Diagram 2, after 7.Bd2 e6). The c3 knight stands between the d2 bishop and Black\'s queen. Find the knight move that uncovers the attack.',
      turn: 'w',
      diagramFen: 'rn2kb1r/pp3ppp/2p1pn2/q4b2/2BP4/2N2N2/PPPB1PPP/R2QK2R w KQkq - 0 8',
      fillInBlankLines: [
        'Discovered attack move: _______________________',
        'Pieces threatened: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '3.Nc3!',
      rationale:
        '3.Nc3 develops and attacks the queen on d5, so Black has to spend another move on it. After 3...Qa5, 4.d4 takes the centre.',
      fullSequence: ['3.Nc3', 'Qa5', '4.d4'],
    },
    {
      exerciseIndex: 2,
      solutionSan: '8.Nd5!',
      rationale:
        '8.Nd5 uncovers the d2 bishop\'s attack on the queen on a5 and threatens 9.Nxf6+ and 9.Nc7+.',
      fullSequence: ['8.Nd5', 'Qd8', '9.Nxf6+', 'Qxf6', '10.Qe2'],
    },
  ],
};

export const hoot65CaroWorksheet: PrintableWorksheetData = {
  id: 'ws-hoot65-caro-drill',
  title: 'Personalized Diagnostic Worksheet for hoot65',
  subtitle: 'Conquering the Caro-Kann: take the full centre, then gain time on the f5 bishop (the fix for 3.h3?! against Brandon0015)',
  type: 'hoot65_drill',
  sourceBook: 'Tactics in Junior Openings / Chess.com Live Archive',
  author: 'hoot65 Game Analyzer',
  eco: 'B18',
  targetColor: 'white',
  diagramFen: 'rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5',
  coordinates: true,
  movesSan: ['1.e4 c6', '2.d4 d5', '3.Nc3 dxe4', '4.Nxe4 Bf5', '5.Ng3! Bg6', '6.h4! h6', '7.Nf3 Nd7', '8.h5 Bh7', '9.Bd3 Bxd3', '10.Qxd3'],
  lessonSummary:
    'Diagnostic review: on 2026-10-11 (Chess.com game 185135704918) against Brandon0015 you played 2.Nc3 d5 3.h3?!. The pawn move did nothing for your development, and the game was lost. The plan here takes the whole centre with 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 and then gains time against Black\'s bishop.',
  answerSummary:
    'Against 4...Bf5, 5.Ng3 gains a move on the bishop. After 5...Bg6, 6.h4 threatens 7.h5, after which the bishop has no safe square; that is why Black plays 6...h6, giving it h7, and White develops with 7.Nf3.',
  physicalBoardSteps: [
    'Set up the pieces with White nearest you.',
    'Play 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 to reach Diagram 1.',
    'Note that the f5 bishop attacks your e4 knight.',
    'Cover the answer page, then write your answers below.',
  ],
  exercises: [
    {
      prompt: 'Exercise 1: White to move (Diagram 1). Black played 4...Bf5. How does White attack the bishop while repositioning the knight for a kingside advance?',
      turn: 'w',
      diagramFen: 'rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5',
      fillInBlankLines: [
        'Move: _______________________',
        'Follow-up threat: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '5.Ng3!',
      rationale:
        '5.Ng3 moves the attacked knight and hits the bishop on f5. After 5...Bg6, 6.h4 threatens 7.h5, after which the bishop has no safe square.',
      fullSequence: ['5.Ng3', 'Bg6', '6.h4', 'h6', '7.Nf3'],
    },
  ],
};

export const allWorksheets: PrintableWorksheetData[] = [
  scotchGambitWorksheet,
  konikowskiWorksheet,
  siberianTrapWorksheet,
  hoot65ScandiWorksheet,
  hoot65CaroWorksheet,
];
