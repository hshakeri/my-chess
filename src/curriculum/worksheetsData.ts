import { PrintableWorksheetData } from '../types/curriculum';

/**
 * Print-Ready Physical-Board Worksheets Data
 * Conforms to PROJECT.md § 5 and Explorer 3 specifications.
 * Supports:
 * 1. Opening Curriculum Lessons (Scotch Gambit, Konikowski Refutation, Siberian Trap)
 * 2. Personalized hoot65 Weakness Drills (Scandinavian 2.exd5! vs meny_26, Caro-Kann vs Brandon0015)
 */

export const scotchGambitWorksheet: PrintableWorksheetData = {
  id: 'ws-scotch-gambit',
  title: 'Chess Curriculum Study Sheet: The Scotch Gambit',
  subtitle: 'Crushing Early Black Passivity with 4.Bc4 & 6.Qd5! Attacks on f7',
  type: 'curriculum_lesson',
  sourceBook: 'Tactics in Junior Openings',
  author: 'Dave',
  eco: 'C44',
  targetColor: 'white',
  diagramFen: 'r1bqk1nr/ppppbppp/2n5/8/2B1P3/2p2N2/PP3PPP/RNBQK2R w KQkq - 0 6',
  coordinates: true,
  movesSan: ['1.e4 e5', '2.Nf3 Nc6', '3.d4 exd4', '4.Bc4 Be7', '5.c3 dxc3', '6.Qd5! Nh6', '7.Bxh6 O-O', '8.Bxg7 Kxg7', '9.Nxc3'],
  lessonSummary:
    'The Scotch Gambit is White’s sharpest weapon against 1...e5. Rather than quietly recapturing on d4, White develops the bishop with 4.Bc4, immediately targeting Black\'s weakest square (f7). When Black greedily takes 5...dxc3, White’s queen strikes with 6.Qd5!, threatening unavoidable checkmate.',
  physicalBoardSteps: [
    'Set up all 32 pieces on your physical chessboard (White on ranks 1-2, Black on ranks 7-8).',
    'Play moves 1 through 5 on your board: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4 Be7 5.c3 dxc3.',
    'Examine the board at the position shown in the diagram. Note the undefended f7 square and the laser diagonal of White\'s light-squared bishop.',
    'Do not look at the answer key yet! Calculate White’s most forcing move and write your answer below.',
  ],
  trapWarning: {
    name: 'Greedy Pawn Snatching (5...dxc3?)',
    blunderSan: '5...dxc3?',
    refutationSan: '6.Qd5! Nh6 7.Bxh6',
    explanation: 'Black prioritizes material over king safety. 6.Qd5 threatens Qxf7# immediately, forcing Black to shed pieces or be mated.',
  },
  exercises: [
    {
      prompt: 'Exercise 1: White to move (from diagram position). Black just played 5...dxc3. Find White\'s devastating queen strike.',
      turn: 'w',
      diagramFen: 'r1bqk1nr/ppppbppp/2n5/8/2B1P3/2p2N2/PP3PPP/RNBQK2R w KQkq - 0 6',
      fillInBlankLines: [
        'Candidate move: _______________________',
        'Direct threat: _______________________',
        'Black\'s only defense: _______________________',
      ],
    },
    {
      prompt: 'Exercise 2: After White plays 6.Qd5, Black responds with 6...Nh6 defending f7. What is White\'s follow-up removal of the guard?',
      turn: 'w',
      diagramFen: 'r1bqk1nr/ppppbppp/2n4N/3Q4/2B1P3/2p2N2/PP3PPP/RNB1K2R w KQkq - 1 7',
      fillInBlankLines: [
        'My move: _______________________',
        'Why Black cannot take back immediately: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '6.Qd5!',
      rationale:
        '6.Qd5 creates an irresistible double-battery threat against f7 with Qxf7#. Black is completely lost and must give up material to prevent mate.',
      fullSequence: ['6.Qd5', 'Nh6', '7.Bxh6', 'O-O', '8.Bxg7', 'Kxg7', '9.Nxc3'],
    },
    {
      exerciseIndex: 2,
      solutionSan: '7.Bxh6!',
      rationale:
        '7.Bxh6 removes the sole defender of f7. If Black plays 7...gxh6??, White delivers 8.Qxf7# checkmate on the spot.',
      fullSequence: ['7.Bxh6', 'O-O', '8.Bxg7', 'Kxg7', '9.Nxc3'],
    },
  ],
};

export const konikowskiWorksheet: PrintableWorksheetData = {
  id: 'ws-konikowski-refutation',
  title: 'Chess Curriculum Study Sheet: Refuting the Konikowski Gambit',
  subtitle: 'Calm Castling & The 7.d4! Central Fork to Overwhelm Black\'s Queen Sortie',
  type: 'curriculum_lesson',
  sourceBook: 'Survive and Beat Annoying Chess Openings',
  author: 'Eric Schiller',
  eco: 'C65',
  targetColor: 'white',
  diagramFen: 'r1b1k1nr/ppp2ppp/2n5/1BbpN1q1/4P3/2P5/PP1P1PPP/RNBQK2R w KQkq - 1 6',
  coordinates: true,
  movesSan: ['1.e4 e5', '2.Nf3 Nc6', '3.Bb5 Bc5', '4.c3 d5', '5.Nxe5 Qg5', '6.O-O! Qxe5', '7.d4! Qe6', '8.dxc5 dxe4', '9.Re1'],
  lessonSummary:
    'The Konikowski Gambit (3.Bb5 Bc5 4.c3 d5!? 5.Nxe5 Qg5) attempts to shock White by simultaneously attacking e5 and g2. Eric Schiller demonstrates the grandmaster antidote: White does not panic or grab pawns. Instead, White calmly castles (6.O-O!), and after 6...Qxe5, White unleashes the devastating central pawn fork 7.d4!, winning the bishop on c5 with a commanding position.',
  physicalBoardSteps: [
    'Place White pieces on ranks 1-2 and Black pieces on ranks 7-8.',
    'Play moves 1 through 5: 1.e4 e5 2.Nf3 Nc6 3.Bb5 Bc5 4.c3 d5 5.Nxe5 Qg5.',
    'Observe Black\'s twin threats against the knight on e5 and the pawn on g2.',
    'Notice that Black\'s king remains uncastled and their c5 bishop is tactically vulnerable.',
    'Calculate White\'s response without looking at the answer key!',
  ],
  trapWarning: {
    name: 'Premature Greed (6.Nxc6? or 6.d4?)',
    blunderSan: '6.Nxc6?',
    refutationSan: '6...Qxg2! 7.Rf1 a6',
    explanation: 'Capturing on c6 allows Black to play 6...Qxg2! attacking White\'s rook with serious tactical complications. Castling first is strictly required.',
  },
  exercises: [
    {
      prompt: 'Exercise 1: White to move (from diagram position). How does White neutralize Black\'s threat on g2 while keeping the initiative?',
      turn: 'w',
      diagramFen: 'r1b1k1nr/ppp2ppp/2n5/1BbpN1q1/4P3/2P5/PP1P1PPP/RNBQK2R w KQkq - 1 6',
      fillInBlankLines: [
        'Move: _______________________',
        'Threat prevented: _______________________',
        'Black\'s likely response: _______________________',
      ],
    },
    {
      prompt: 'Exercise 2: After 6.O-O Qxe5, Black\'s queen sits on e5 opposite White\'s bishop on c5. Find the decisive pawn breakthrough.',
      turn: 'w',
      diagramFen: 'r1b1k1nr/ppp2ppp/2n5/1Bbpq3/4P3/2P5/PP1P1PPP/RNBQ1RK1 w kq - 0 7',
      fillInBlankLines: [
        'Decisive move: _______________________',
        'Tactical motif: _______________________',
        'Pieces forked: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '6.O-O!',
      rationale:
        '6.O-O! brings White’s king to total safety and guards g2 with the king and rook. Black cannot harm White’s position.',
      fullSequence: ['6.O-O', 'Qxe5', '7.d4'],
    },
    {
      exerciseIndex: 2,
      solutionSan: '7.d4!',
      rationale:
        '7.d4! creates a pawn fork attacking both Black\'s queen on e5 and bishop on c5. Black must move the queen, allowing White to take 8.dxc5 with an extra pawn and the bishop pair.',
      fullSequence: ['7.d4', 'Qe6', '8.dxc5', 'dxe4', '9.Re1'],
    },
  ],
};

export const siberianTrapWorksheet: PrintableWorksheetData = {
  id: 'ws-siberian-trap',
  title: 'Opening Traps Study Sheet: The Siberian Trap',
  subtitle: 'The Brutal 9...Nd4!! Queen and King Ambush in the Smith-Morra',
  type: 'curriculum_lesson',
  sourceBook: '101 Chess Opening Traps',
  author: 'Steve Giddins',
  eco: 'B21',
  targetColor: 'black',
  diagramFen: 'r1b1kb1r/ppqp1ppp/2n1p3/8/2B1P1n1/2N2N1P/PP2QPP1/R1B2RK1 b kq - 0 9',
  coordinates: true,
  movesSan: ['1.e4 c5', '2.d4 cxd4', '3.c3 dxc3', '4.Nxc3 Nc6', '5.Nf3 e6', '6.Bc4 Qc7', '7.O-O Nf6', '8.Qe2 Ng4', '9.h3? Nd4!'],
  lessonSummary:
    'In the Smith-Morra Gambit, White frequently falls into a lethal trap on move 9. Thinking Black’s g4 knight is simply annoying, White plays the standard 9.h3?. Black instantly unleashes 9...Nd4!!, attacking the queen on e2 while simultaneously threatening mate on h2.',
  physicalBoardSteps: [
    'Set up your physical board and play the Black pieces from the Black side.',
    'Execute moves 1 through 8: 1.e4 c5 2.d4 cxd4 3.c3 dxc3 4.Nxc3 Nc6 5.Nf3 e6 6.Bc4 Qc7 7.O-O Nf6 8.Qe2 Ng4.',
    'Play White\'s blunder: 9.h3?. Stop and study the board at this exact moment.',
    'Identify why White\'s f3 knight is overworked defending h2.',
  ],
  exercises: [
    {
      prompt: 'Exercise 1: Black to move. Find the knockout knight leap that attacks White\'s queen and creates an unstoppable mate threat.',
      turn: 'b',
      diagramFen: 'r1b1kb1r/ppqp1ppp/2n1p3/8/2B1P1n1/2N2N1P/PP2QPP1/R1B2RK1 b kq - 0 9',
      fillInBlankLines: [
        'My move: _______________________',
        'What happens if White plays 10.Nxd4?: _______________________',
        'What happens if White moves the queen?: _______________________',
      ],
    },
  ],
  answerKey: [
    {
      exerciseIndex: 1,
      solutionSan: '9...Nd4!!',
      rationale:
        '9...Nd4!! attacks the White queen on e2. If 10.Nxd4, White is mated instantly with 10...Qh2#! If White moves the queen (e.g. 10.Qd3), 10...Nxf3+ 11.Qxf3 Qh2# is still mate. White loses the queen or king.',
      fullSequence: ['9...Nd4!!', '10.Nxd4', 'Qh2#'],
    },
  ],
};

export const hoot65ScandiWorksheet: PrintableWorksheetData = {
  id: 'ws-hoot65-scandi-drill',
  title: 'Personalized Diagnostic Worksheet for hoot65',
  subtitle: 'Fixing the Scandinavian Defense Flaw: From 2.e5?! (Loss vs meny_26) to 2.exd5! & 3.Nc3!',
  type: 'hoot65_drill',
  sourceBook: 'Tactics in Junior Openings / Chess.com Live Archive',
  author: 'hoot65 Game Analyzer',
  eco: 'B01',
  targetColor: 'white',
  diagramFen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3',
  coordinates: true,
  movesSan: ['1.e4 d5', '2.exd5! Qxd5', '3.Nc3! Qa5', '4.d4! Nf6', '5.Nf3 c6', '6.Bc4 Bf5', '7.Bd2 e6', '8.Nd5 Qd8', '9.Nxf6+ Qxf6', '10.Qe2'],
  lessonSummary:
    'Diagnostic Review: On 2026/10/22, in a 10-minute Rapid game against meny_26, you faced 1...d5. You responded with 2.e5?!. This pawn push relinquished all central pressure, allowed Black to play 2...d4, and ceded an easy win to Black. Master the correct discipline: always capture 2.exd5! and immediately develop with tempo using 3.Nc3! against Black\'s early queen.',
  physicalBoardSteps: [
    'Place your physical board on the table. Sit on the White side.',
    'Play 1.e4 d5. Pause. Say aloud: "Never push 2.e5?!. Capture with 2.exd5!".',
    'Play 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 on your board. Feel the energy of White’s active knights and open center compared to Black’s lone queen.',
    'Replay this opening sequence twice on your physical board before solving the exercises below.',
  ],
  trapWarning: {
    name: 'Passive Center Push (2.e5?!)',
    blunderSan: '2.e5?!',
    refutationSan: '2...d4! 3.Nf3 Nc6',
    explanation: 'Pushing 2.e5 locks White’s pawns, gives Black a wedge on d4, and forfeits White’s initiative.',
  },
  exercises: [
    {
      prompt: 'Exercise 1: White to move. Black just played 2...Qxd5. How do you develop a minor piece while forcing Black\'s queen to retreat?',
      turn: 'w',
      diagramFen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3',
      fillInBlankLines: [
        'Move: _______________________',
        'Square attacked: _______________________',
        'Next central move: _______________________',
      ],
    },
    {
      prompt: 'Exercise 2: In the position after 7.Bd2 e6, White’s c3 knight has a hidden discovered attack. Find the knight leap.',
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
        '3.Nc3 attacks Black\'s queen on d5, gaining a full tempo. When the queen retreats to a5, White establishes the ideal center with 4.d4!.',
      fullSequence: ['3.Nc3', 'Qa5', '4.d4'],
    },
    {
      exerciseIndex: 2,
      solutionSan: '8.Nd5!',
      rationale:
        '8.Nd5 unmasks the dark-squared bishop on d2 against Black\'s queen on a5, while also threatening Nxf6+ and Nc7+.',
      fullSequence: ['8.Nd5', 'Qd8', '9.Nxf6+', 'Qxf6', '10.Qe2'],
    },
  ],
};

export const hoot65CaroWorksheet: PrintableWorksheetData = {
  id: 'ws-hoot65-caro-drill',
  title: 'Personalized Diagnostic Worksheet for hoot65',
  subtitle: 'Conquering the Caro-Kann Defense: Active Central Dominance (vs Brandon0015 Antidote)',
  type: 'hoot65_drill',
  sourceBook: 'Tactics in Junior Openings / Chess.com Live Archive',
  author: 'hoot65 Game Analyzer',
  eco: 'B18',
  targetColor: 'white',
  diagramFen: 'rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5',
  coordinates: true,
  movesSan: ['1.e4 c6', '2.d4 d5', '3.Nc3 dxe4', '4.Nxe4 Bf5', '5.Ng3! Bg6', '6.h4! h6', '7.Nf3 Nd7', '8.h5 Bh7', '9.Bd3 Bxd3', '10.Qxd3'],
  lessonSummary:
    'Diagnostic Review: On 2026/10/21, in a game against Brandon0015, you played 2.Nc3 d5 3.h3?!. That passive move lost the initiative and allowed Black an easy opening. The correct plan is to establish the full center with 2.d4! d5 3.Nc3 dxe4 4.Nxe4 Bf5, then aggressively chase Black’s bishop with 5.Ng3! and 6.h4! to seize the kingside space.',
  physicalBoardSteps: [
    'Set up your physical board.',
    'Play moves 1 through 4: 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5.',
    'Note how Black\'s light-squared bishop has stepped outside the pawn chain to challenge your knight.',
    'Execute 5.Ng3 Bg6 6.h4 h6 7.Nf3 on your board. Notice how White dominates space on both the center and kingside.',
  ],
  exercises: [
    {
      prompt: 'Exercise 1: White to move. Black played 4...Bf5. How does White attack the bishop while repositioning the knight for a kingside storm?',
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
        '5.Ng3 attacks Black\'s bishop on f5 with tempo. After 5...Bg6, White immediately plays 6.h4!, threatening 7.h5 to trap the bishop.',
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
