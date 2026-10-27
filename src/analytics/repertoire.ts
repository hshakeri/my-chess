import { Chess } from 'chess.js';
import { RepertoirePlan, RepertoireLine, RepertoireMove } from '../types/diagnostics';

/**
 * Helper to construct verified legal move sequences with FEN tracking.
 */
function buildMoveChain(
  movesSan: string[],
  initialFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  annotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {}
): RepertoireMove[] {
  const chess = new Chess(initialFen);
  const moves: RepertoireMove[] = [];

  for (let i = 0; i < movesSan.length; i++) {
    const san = movesSan[i];
    const ply = i + 1;
    const moveRes = chess.move(san);
    if (!moveRes) {
      throw new Error(`Illegal move in repertoire specification: ${san} at ply ${ply}`);
    }
    const fen = chess.fen();
    const meta = annotations[ply] || {};

    moves.push({
      ply,
      san,
      fen,
      commentary: meta.commentary,
      annotation: meta.annotation,
      tacticalMotif: meta.tacticalMotif,
      isKeyMove: meta.isKeyMove,
    });
  }

  return moves;
}

/** Standard PGN move text for a verified SAN list, e.g. "1. d4 d5 2. c4 c6". */
function toPgn(movesSan: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < movesSan.length; i++) {
    if (i % 2 === 0) out.push(`${i / 2 + 1}.`);
    out.push(movesSan[i]);
  }
  return out.join(' ');
}

/**
 * White Repertoire: Italian Game, Scotch Gambit & Anti-Scandinavian Refutation (2.exd5!)
 */
export function getRecommendedWhiteRepertoire(): RepertoirePlan {
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Line 1: Anti-Scandinavian Refutation (Directly patches hoot65's 2.e5?! leak)
  const scandiMoves = [
    'e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Nf3', 'c6',
    'Bc4', 'Bf5', 'Bd2', 'e6', 'Nd5', 'Qd8', 'Nxf6+', 'Qxf6', 'Qe2', 'Nd7'
  ];
  const scandiAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    1: { commentary: 'The best first move, controlling d5 and f5 and opening lines for the queen and bishop.', isKeyMove: true },
    3: { commentary: 'CRITICAL REFUTATION: Take the pawn! Never play 2.e5?! against the Scandinavian. Capturing forces Black to expose their Queen.', annotation: '!', tacticalMotif: 'Central Liquidation', isKeyMove: true },
    5: { commentary: 'Develop with tempo! The knight attacks the queen on d5, gaining a development lead for White.', annotation: '!', tacticalMotif: 'Tempo Gain', isKeyMove: true },
    7: { commentary: 'Stake a claim in the center and open diagonals for the dark-squared bishop.', isKeyMove: true },
    11: { commentary: 'Active development eyeing the vulnerable f7 square.', isKeyMove: true },
    13: { commentary: 'Unpinning and preparing discovered attacks against the Black Queen on a5.', tacticalMotif: 'Discovered Attack Threat' },
    15: { commentary: 'Tactical strike in the center, threatening the c7 fork and attacking the Queen.', annotation: '!', tacticalMotif: 'Tactical Fork & Outpost', isKeyMove: true },
  };

  const scandiLine: RepertoireLine = {
    id: 'white-scandi-refutation',
    name: 'Anti-Scandinavian Refutation (2.exd5!)',
    eco: 'B01',
    movesSan: scandiMoves,
    description: 'The master-level refutation of the Scandinavian Defense (1.e4 d5). By playing 2.exd5! followed by 3.Nc3!, White immediately punishes Black\'s premature Queen outing and gains overwhelming developmental advantage.',
    keyIdeas: [
      'Play 2.exd5! strictly — never 2.e5?!',
      'Gain tempo on the black Queen with 3.Nc3',
      'Build a strong pawn center with d4 and develop rapidly with Nf3 and Bc4',
      'Look for Nd5 tactical discoveries exploiting Black\'s exposed Queen'
    ],
    moves: buildMoveChain(scandiMoves, initialFen, scandiAnnotations),
    pgn: '1. e4 d5 2. exd5! Qxd5 3. Nc3! Qa5 4. d4 Nf6 5. Nf3 c6 6. Bc4 Bf5 7. Bd2 e6 8. Nd5 Qd8 9. Nxf6+ Qxf6 10. Qe2 Nd7'
  };

  // Line 2: Italian Game - Evans Gambit, the main line after 3...Bc5 (hoot65: 6 wins in 7 games with 4.b4).
  // Mirrors the moves of lesson-evans-gambit-destruction so the plan and the lesson agree.
  const evansMoves = [
    'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bc5',
    'd4', 'exd4', 'O-O', 'd6', 'cxd4', 'Bb6', 'Nc3'
  ];
  const evansAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    7: { commentary: 'The Evans Gambit, the main line after 3...Bc5 and hoot65\'s best-scoring White line (6 wins in 7 games): the b-pawn is offered to gain time on the bishop for c3 and d4.', annotation: '!?', tacticalMotif: 'Wing pawn sacrifice for tempo', isKeyMove: true },
    9: { commentary: 'Hit the bishop again; every bishop move is a free move for the pawn centre.', isKeyMove: true },
    11: { commentary: 'The centre pawn arrives with tempo on the c5 bishop.', isKeyMove: true },
    13: { commentary: 'Castle before recapturing on d4: the king is safe while Black\'s is still in the centre.', isKeyMove: true },
    15: { commentary: 'Recapture: pawns on d4 and e4 and both bishops on open diagonals.' },
    17: { commentary: 'Develop with the centre intact. White is a pawn down for two centre pawns, a castled king and open lines; Black cannot castle yet.', isKeyMove: true }
  };

  const evansLine: RepertoireLine = {
    id: 'white-italian-evans-gambit',
    name: 'Italian Game: Evans Gambit (4.b4)',
    eco: 'C51',
    movesSan: evansMoves,
    description: 'The main line after 3...Bc5. White offers the b-pawn to drive the bishop around with c3 and d4, castles before recapturing on d4, and gets two centre pawns, a safe king and open lines for the pawn.',
    keyIdeas: [
      '4.b4 after 3...Bc5; 4.c3 is the quiet alternative',
      'c3 and d4 with tempo on the bishop',
      'Castle before recapturing on d4',
      'Develop the queen knight behind the d4-e4 centre'
    ],
    moves: buildMoveChain(evansMoves, initialFen, evansAnnotations),
    pgn: toPgn(evansMoves)
  };

  // Line 3: Italian Game - Giuoco Piano (4.c3), the quiet alternative after 3...Bc5
  const italianMoves = [
    'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4',
    'cxd4', 'Bb4+', 'Bd2', 'Bxd2+', 'Nbxd2', 'd5', 'exd5', 'Nxd5', 'O-O', 'O-O'
  ];
  const italianAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    5: { commentary: 'Italian Game! Developing the bishop to c4 puts direct pressure on Black\'s weakest square: f7.', annotation: '!', isKeyMove: true },
    7: { commentary: 'Preparing the classical central pawn push with d2-d4.', isKeyMove: true },
    9: { commentary: 'Seize the full pawn center with d4!', annotation: '!', tacticalMotif: 'Center Breakthrough', isKeyMove: true },
    19: { commentary: 'Castling ensures king safety while connecting rooks.', isKeyMove: true }
  };

  const italianLine: RepertoireLine = {
    id: 'white-italian-giuoco-piano',
    name: 'Italian Game (Giuoco Piano Classical Center)',
    eco: 'C53',
    movesSan: italianMoves,
    description: 'The cornerstone of White\'s 1.e4 repertoire. White establishes an imposing classical center with c3 and d4, while maintaining active kingside piece pressure.',
    keyIdeas: [
      'Occupy the center with e4 and Nf3',
      'Develop the light-squared bishop actively to c4',
      'Prepare the d4 center strike with c3',
      'Castle quickly and dominate central files'
    ],
    moves: buildMoveChain(italianMoves, initialFen, italianAnnotations),
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5 Nxd5 10. O-O O-O'
  };

  // Line 4: Scotch Gambit
  const scotchMoves = [
    'e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4', 'Nf6', 'e5', 'd5',
    'Bb5', 'Ne4', 'Nxd4', 'Bd7', 'Bxc6', 'bxc6', 'O-O', 'Bc5', 'f3', 'Ng5'
  ];
  const scotchAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    5: { commentary: 'Immediate strike in the center, blowing open the d-file.', annotation: '!', isKeyMove: true },
    7: { commentary: 'Scotch Gambit! Instead of recapturing immediately on d4, White develops Bc4 with rapid attacking threats.', annotation: '!', tacticalMotif: 'Gambit Development', isKeyMove: true },
    9: { commentary: 'Pushing the e-pawn forward to evict Black\'s knight from f6.', isKeyMove: true },
    13: { commentary: 'Recapturing on d4 with knight dominance in the center.', isKeyMove: true }
  };

  const scotchLine: RepertoireLine = {
    id: 'white-scotch-gambit',
    name: 'Scotch Gambit (Dynamic Central Attack)',
    eco: 'C44',
    movesSan: scotchMoves,
    description: 'An explosive gambit line against 1...e5. White sacrifices a pawn tempo to open central lines, accelerate piece development, and launch kingside attacks.',
    keyIdeas: [
      'Open the center with 3.d4',
      'Develop Bc4 rapidly rather than recapturing immediately',
      'Harass the f6 knight with e5',
      'Pin the c6 knight with Bb5 and seize central squares'
    ],
    moves: buildMoveChain(scotchMoves, initialFen, scotchAnnotations),
    pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4 Nf6 5. e5 d5 6. Bb5 Ne4 7. Nxd4 Bd7 8. Bxc6 bxc6 9. O-O Bc5 10. f3 Ng5'
  };

  return {
    id: 'repertoire-white-italian-scandi',
    color: 'white',
    name: 'Italian Game & Anti-Scandinavian Refutation (2.exd5!)',
    description: 'A tailored 1.e4 repertoire engineered specifically for hoot65. Grounded in hoot65\'s natural strength in open Italian/Bc4 structures, combined with an ironclad refutation of the Scandinavian Defense (2.exd5! instead of 2.e5?!) to eradicate hoot65\'s most severe White leak.',
    targetOpponentResponses: ['1...e5 (Open Games)', '1...d5 (Scandinavian Defense)', '1...c5 (Sicilian Defense)'],
    keyThemes: [
      'Eradicate 2.e5?! against Scandinavian — play 2.exd5! strictly for immediate +0.8 advantage',
      'Evans Gambit 4.b4 as the Italian main line after 3...Bc5; 4.c3 as the quiet alternative',
      'Italian Game c3-d4 classical center dominance',
      'Dynamic Scotch Gambit attacking options',
      'Rapid kingside castling and open-file piece activity'
    ],
    rootFen: initialFen,
    lines: [scandiLine, evansLine, italianLine, scotchLine],
    pgn: [scandiLine.pgn, evansLine.pgn, italianLine.pgn, scotchLine.pgn].join('\n\n'),
    sourceReferences: [
      'TacticsInJuniorOpenings.pdf (Italian Game, Scotch Gambit, and Scandinavian Refutation chapters)',
      'Chess-Openings.pdf (King\'s Pawn Openings)',
      'null-101 Chess Opening Traps (Gambit Chess)'
    ]
  };
}

/**
 * Black Repertoire: Disciplined Caro-Kann Defense (3...Bf5!) and the c6-d5 wall vs 1.d4
 * (Slav against 2.c4, Caro-style set-up against the London and 2.Nf3).
 */
export function getRecommendedBlackRepertoire(): RepertoirePlan {
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Line 1: Caro-Kann Advance Variation (Disciplined 3...Bf5!)
  const advanceMoves = [
    'e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5',
    'c3', 'Nc6', 'O-O', 'cxd4', 'cxd4', 'Nge7', 'Nc3', 'Nc8', 'Bg5', 'Be7'
  ];
  const advanceAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    2: { commentary: 'Caro-Kann Defense! A rock-solid defense preparing d5 with a protected pawn structure.', isKeyMove: true },
    4: { commentary: 'Striking in the center to challenge White\'s e4 pawn.', isKeyMove: true },
    6: { commentary: 'DISCIPLINED BISHOP PLACEMENT: Play 3...Bf5! outside the pawn chain BEFORE playing ...e6. Crucially avoid premature ...Bg4?! which allows White to trap the bishop with f3 and g4.', annotation: '!', tacticalMotif: 'Prophylaxis & Piece Placement', isKeyMove: true },
    8: { commentary: 'Now Black securely locks the center with ...e6, with the light-squared bishop safely active outside the pawn chain.', isKeyMove: true },
    10: { commentary: 'The thematic Caro-Kann counter-strike against White\'s pawn base at d4!', annotation: '!', tacticalMotif: 'Pawn Chain Undermining', isKeyMove: true },
    12: { commentary: 'Piling up heavy pressure on the d4 pawn.', isKeyMove: true }
  };

  const advanceLine: RepertoireLine = {
    id: 'black-caro-kann-advance',
    name: 'Caro-Kann Advance (Disciplined 3...Bf5!)',
    eco: 'B12',
    movesSan: advanceMoves,
    description: 'The essential antidote to premature ...Bg4 errors. Against White\'s 3.e5 Advance, Black develops the light-squared bishop cleanly to f5 outside the pawn chain, seals the position with ...e6, and systematically demolishes White\'s pawn chain with ...c5 and ...Nc6.',
    keyIdeas: [
      'Play 3...Bf5! outside the pawn chain strictly — never premature ...Bg4?!',
      'Follow up with ...e6 once the bishop is safely placed',
      'Undermine White\'s center with the thematic ...c5 break',
      'Put relentless pressure on the d4 pawn base'
    ],
    moves: buildMoveChain(advanceMoves, initialFen, advanceAnnotations),
    pgn: '1. e4 c6 2. d4 d5 3. e5 Bf5! 4. Nf3 e6 5. Be2 c5 6. c3 Nc6 7. O-O cxd4 8. cxd4 Nge7 9. Nc3 Nc8 10. Bg5 Be7'
  };

  // Line 2: Caro-Kann Classical Variation (Capablanca 4...Bf5!)
  const classicalMoves = [
    'e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6',
    'h4', 'h6', 'Nf3', 'Nd7', 'h5', 'Bh7', 'Bd3', 'Bxd3', 'Qxd3', 'e6'
  ];
  const classicalAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    8: { commentary: 'Capablanca\'s classical maneuver: develop the bishop with tempo, attacking the e4 knight.', annotation: '!', isKeyMove: true },
    10: { commentary: 'Tucking the bishop to g6 away from the knight.', isKeyMove: true },
    12: { commentary: 'Creating an escape hatch on h7 before White\'s h-pawn can trap the bishop.', annotation: '!', tacticalMotif: 'Prophylactic Luft', isKeyMove: true },
    16: { commentary: 'Bishop safely rests on h7 with zero weaknesses.', isKeyMove: true }
  };

  const classicalLine: RepertoireLine = {
    id: 'black-caro-kann-classical',
    name: 'Caro-Kann Classical (Capablanca 4...Bf5)',
    eco: 'B18',
    movesSan: classicalMoves,
    description: 'The immortal Capablanca variation against 3.Nc3. Black eliminates White\'s e-pawn, develops the light-squared bishop actively to f5, and achieves an impervious defensive structure.',
    keyIdeas: [
      'Liquidate e4 with 3...dxe4 and develop 4...Bf5',
      'Preserve the bishop via ...Bg6 and ...h6 followed by ...Bh7',
      'Trade light-squared bishops cleanly on d3',
      'Achieve a completely safe endgame structure with no pawn weaknesses'
    ],
    moves: buildMoveChain(classicalMoves, initialFen, classicalAnnotations),
    pgn: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5! 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6'
  };

  // Line 3: the c6-d5 wall against 2.c4: the Slav (Dutch variation with 5...Bf5)
  const slavMoves = [
    'd4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5',
    'e3', 'e6', 'Bxc4', 'Bb4', 'O-O', 'O-O'
  ];
  const slavAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    2: { commentary: 'The same pawn as against 1.e4: d5 claims the centre and c6 will support it.', isKeyMove: true },
    4: { commentary: 'The Slav. c6 supports d5 and keeps the c8 bishop\'s diagonal open, which ...e6 would close.', isKeyMove: true },
    6: { commentary: 'Develop the knight first; ...dxc4 waits until White has put the b1 knight on c3.' },
    8: { commentary: 'Take the pawn now that Nc3 is played. White spends a move on 5.a4 to stop ...b5 holding it; otherwise 5...b5 is available.', tacticalMotif: 'Central capture', isKeyMove: true },
    10: { commentary: 'The bishop comes out before ...e6, the Caro-Kann idea in a Slav shape. a4 has given up the b4 square, which the f8 bishop will use.', isKeyMove: true },
    12: { commentary: 'Now ...e6 shuts nothing in: the bishop is already outside the pawn chain.' },
    14: { commentary: 'The bishop comes to the b4 square that a4 gave away and pins the c3 knight against the king on e1 (d2 is empty).', tacticalMotif: 'Pin on the c3 knight', isKeyMove: true },
    16: { commentary: 'Castled with both bishops and the f6 knight developed and no pawn weaknesses; ...Nbd7 and ...Bg6 (if the bishop is hit) come next.', isKeyMove: true }
  };

  const slavLine: RepertoireLine = {
    id: 'black-slav-wall',
    name: 'Slav Defence: the c6-d5 wall vs 2.c4',
    eco: 'D17',
    movesSan: slavMoves,
    description: 'Against 1.d4 Black builds the same c6-d5 wall as in the Caro-Kann. After 2.c4 c6 3.Nf3 Nf6 4.Nc3 Black takes on c4, waits for 5.a4 and develops the light-squared bishop to f5 before playing ...e6, exactly as against 1.e4. The bishop then uses the b4 square that a4 gave up.',
    keyIdeas: [
      'c6 and d5 against 1.d4 as well: one structure for both colours of first move',
      'Take on c4 only after Nc3; 5.a4 costs White a move',
      '...Bf5 before ...e6 so the bishop stays outside the pawn chain',
      '...Bb4 pins the c3 knight on the square a4 gave up, then castle'
    ],
    moves: buildMoveChain(slavMoves, initialFen, slavAnnotations),
    pgn: toPgn(slavMoves)
  };

  // Line 4: the wall against the London (2.Bf4): ...Bf5, trade bishops, ...Qb6
  const londonMoves = [
    'd4', 'd5', 'Bf4', 'c6', 'e3', 'Bf5', 'Nf3', 'e6', 'Bd3', 'Bxd3',
    'Qxd3', 'Qb6', 'b3', 'Nf6', 'O-O', 'Nbd7', 'c4', 'Be7', 'Nc3', 'O-O'
  ];
  const londonAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    2: { commentary: 'Same reply as against 2.c4: the wall starts with d5.' },
    4: { commentary: 'The London has no c4 pawn hitting d5, so c6 simply supports it and keeps ...Qb6 in reserve.', isKeyMove: true },
    6: { commentary: 'Bishop out before ...e6, mirroring White\'s own set-up and preparing to trade the light-squared bishops.', isKeyMove: true },
    8: { commentary: 'The wall is complete: c6, d5 and e6 with the bishop already outside it.' },
    10: { commentary: 'Trade when offered: it removes White\'s attacking bishop, and after the queen recapture no white piece defends b2.', isKeyMove: true },
    12: { commentary: 'The point of the trade: the queen hits b2, which nothing defends, so White must spend a move on it.', tacticalMotif: 'Attack on the loose b2 pawn', isKeyMove: true },
    14: { commentary: 'With b2 covered, develop. A pawn on b3 no longer guards a3 and c3, so the queen on b6 stays well placed.' },
    16: { commentary: 'The knight goes to d7, keeping c6 for the pawn; ...Be7 and ...O-O follow.' },
    18: { commentary: 'Develop before reacting in the centre: d5 is covered by the c6 and e6 pawns and the f6 knight.' },
    20: { commentary: 'Castled with the wall intact and every piece developed; Black has no pawn weaknesses to defend.', isKeyMove: true }
  };

  const londonLine: RepertoireLine = {
    id: 'black-wall-vs-london',
    name: 'The c6-d5 wall vs the London (2.Bf4)',
    eco: 'D02',
    movesSan: londonMoves,
    description: 'Against the London System Black plays the Caro-Kann set-up: c6, d5, ...Bf5 before ...e6, and trades the light-squared bishops on d3. After the queen recapture ...Qb6 hits the b2 pawn that nothing defends, so White has to spend a move on it while Black completes development.',
    keyIdeas: [
      '...Bf5 before ...e6 so the bishop is never shut in',
      'Trade the light-squared bishops on d3 when offered',
      '...Qb6 hits the undefended b2 pawn after Qxd3',
      'Develop ...Nf6, ...Nbd7, ...Be7 and castle; no pawn weaknesses'
    ],
    moves: buildMoveChain(londonMoves, initialFen, londonAnnotations),
    pgn: toPgn(londonMoves)
  };

  // Line 5: 2.Nf3 c6 3.Bf4 Bf5 4.e3 e6, transposing into the London line by another move order
  const nf3LondonMoves = ['d4', 'd5', 'Nf3', 'c6', 'Bf4', 'Bf5', 'e3', 'e6'];
  const nf3LondonAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    4: { commentary: 'Against the quiet 2.Nf3 the wall is the same: c6 supports d5 and waits to see where White\'s bishop goes.', isKeyMove: true },
    6: { commentary: 'The London bishop is met the same way: bishop out before ...e6.', isKeyMove: true },
    8: { commentary: 'This is the London line by another move order; after 5.Bd3 Bxd3 6.Qxd3 Qb6 the same plan follows.', isKeyMove: true }
  };

  const nf3LondonLine: RepertoireLine = {
    id: 'black-wall-vs-nf3-bf4',
    name: 'The c6-d5 wall vs 2.Nf3 and 3.Bf4',
    eco: 'D02',
    movesSan: nf3LondonMoves,
    description: 'After 2.Nf3 Black plays 2...c6 and waits. When the bishop comes to f4, ...Bf5 and ...e6 reach the London line by transposition.',
    keyIdeas: [
      '2...c6 keeps the wall and commits to nothing',
      '...Bf5 before ...e6 whenever the bishop comes to f4',
      'The position after 4...e6 is the London line: ...Bxd3 and ...Qb6 follow'
    ],
    moves: buildMoveChain(nf3LondonMoves, initialFen, nf3LondonAnnotations),
    pgn: toPgn(nf3LondonMoves)
  };

  // Line 6: 2.Nf3 c6 3.c4 Nf6, transposing into the Slav line
  const nf3SlavMoves = ['d4', 'd5', 'Nf3', 'c6', 'c4', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5'];
  const nf3SlavAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    4: { commentary: 'Against 2.Nf3 the wall is the same: c6 supports d5 and commits to nothing.', isKeyMove: true },
    6: { commentary: 'With c4 on the board this is the Slav: the position after 3...Nf6 is the main line by transposition.', isKeyMove: true },
    8: { commentary: 'Take once Nc3 is played, as in the main line.' },
    10: { commentary: 'Bishop out before ...e6; from here the Slav line continues with 6.e3 e6 7.Bxc4 Bb4 8.O-O O-O.', isKeyMove: true }
  };

  const nf3SlavLine: RepertoireLine = {
    id: 'black-wall-vs-nf3-c4',
    name: 'The c6-d5 wall vs 2.Nf3 and 3.c4',
    eco: 'D11',
    movesSan: nf3SlavMoves,
    description: 'After 2.Nf3 c6 3.c4 the game is a Slav by transposition: 3...Nf6 reaches the same position as 2.c4 c6 3.Nf3 Nf6, and the plan with ...dxc4, ...Bf5 and ...Bb4 is unchanged.',
    keyIdeas: [
      '2...c6 against everything; 3.c4 Nf6 is the Slav by transposition',
      'Take on c4 only after Nc3',
      '...Bf5 before ...e6, then ...Bb4 and castle'
    ],
    moves: buildMoveChain(nf3SlavMoves, initialFen, nf3SlavAnnotations),
    pgn: toPgn(nf3SlavMoves)
  };

  const lines = [advanceLine, classicalLine, slavLine, londonLine, nf3LondonLine, nf3SlavLine];

  return {
    id: 'repertoire-black-caro-kann-wall',
    color: 'black',
    name: 'Caro-Kann & the c6-d5 Wall',
    description: 'One structure for Black against everything: the pawns go to c6 and d5, the light-squared bishop comes out to f5 before ...e6, and the queen stays home until the minor pieces are out. Against 1.e4 that is the disciplined Caro-Kann (3...Bf5 and 4...Bf5, never a premature ...Bg4); against 1.d4 the same wall gives the Slav after 2.c4 and a Caro-style set-up against the London and 2.Nf3.',
    targetOpponentResponses: ['1.e4 (Caro-Kann Defence)', '1.d4 2.c4 (Slav Defence)', '1.d4 2.Bf4 or 2.Nf3 (London and quiet systems)'],
    keyThemes: [
      'Pawns on c6 and d5 against every first move; the light-squared bishop goes to f5 before ...e6',
      'Against the Advance 3.e5 play 3...Bf5, not ...Bg4; against 3.Nc3 take on e4 and play 4...Bf5',
      'Slav after 2.c4: ...c6, ...Nf6, ...dxc4 and ...Bf5 once 5.a4 has stopped ...b5',
      'London and 2.Nf3: ...Bf5 to trade the light-squared bishops, then ...Qb6 hits the loose b2 pawn'
    ],
    rootFen: initialFen,
    lines,
    pgn: lines.map((l) => l.pgn).join('\n\n'),
    sourceReferences: [
      'TacticsInJuniorOpenings.pdf (Caro-Kann Defense: Trapping the bishop & Removing the guard)',
      'Chess-Openings.pdf (Semi-Open & Closed Games)',
      'kupdf.net_modern-chess-openings-15th-edition.pdf (Caro-Kann & Slav Defence)',
      'hoot65 Chess.com archive (c6-d5 structures, 2026)'
    ]
  };
}

/**
 * Returns all recommended repertoires.
 */
export function getAllRecommendedRepertoires(): RepertoirePlan[] {
  return [getRecommendedWhiteRepertoire(), getRecommendedBlackRepertoire()];
}

/**
 * Find repertoire by ID.
 */
export function getRepertoireById(id: string): RepertoirePlan | undefined {
  return getAllRecommendedRepertoires().find(rep => rep.id === id);
}

/**
 * Matches a game move history against lines in a repertoire plan.
 */
export function findMatchingLine(
  repertoire: RepertoirePlan,
  moveHistorySan: string[]
): { line: RepertoireLine; matchingPlies: number } | null {
  if (!moveHistorySan || moveHistorySan.length === 0) return null;

  let bestMatch: { line: RepertoireLine; matchingPlies: number } | null = null;

  for (const line of repertoire.lines) {
    let matchCount = 0;
    const len = Math.min(line.movesSan.length, moveHistorySan.length);
    for (let i = 0; i < len; i++) {
      if (line.movesSan[i] === moveHistorySan[i]) {
        matchCount++;
      } else {
        break;
      }
    }
    if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.matchingPlies)) {
      bestMatch = { line, matchingPlies: matchCount };
    }
  }

  return bestMatch;
}

/**
 * A node of the repertoire tree: the move that led here, the position after it,
 * and the plan's continuations. Transpositions are merged by position: when two
 * move orders reach the same position, both entry nodes share one `children`
 * array and one `lineIds` array (every line through the position), while each
 * keeps the `san` and annotation of its own move order.
 */
export interface RepertoireNode {
  san: string;
  fen: string;
  children: RepertoireNode[];
  lineIds: string[];
  annotation?: string;
  isStudentMove: boolean;
}

/**
 * Position key: the first four FEN fields (placement, side to move, castling,
 * en passant), so the same position reached by different move orders shares a
 * key. Module A's `canonicalFenKey` additionally normalises the en-passant
 * field; the lead unifies the two after integration.
 */
export function fenKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

/** The child of `node` whose position matches `fen` (by position key), if any. */
export function findChildByFen(node: RepertoireNode, fen: string): RepertoireNode | undefined {
  const key = fenKey(fen);
  return node.children.find((c) => fenKey(c.fen) === key);
}

/**
 * Build the plan's lines into one tree rooted at `rootFen`, replaying every move
 * with chess.js (an illegal move throws) and merging transpositions by position
 * key. `isStudentMove` is true on moves played by the plan's colour.
 */
export function buildRepertoireTree(plan: RepertoirePlan): RepertoireNode {
  const root: RepertoireNode = { san: '', fen: plan.rootFen, children: [], lineIds: [], isStudentMove: false };
  // One record per position: the continuations and the lines through it are shared by every entry node
  const positions = new Map<string, { children: RepertoireNode[]; lineIds: string[] }>([
    [fenKey(plan.rootFen), { children: root.children, lineIds: root.lineIds }],
  ]);
  const student: 'w' | 'b' = plan.color === 'white' ? 'w' : 'b';

  for (const line of plan.lines) {
    const chess = new Chess(plan.rootFen);
    let node = root;
    if (!root.lineIds.includes(line.id)) root.lineIds.push(line.id);

    for (const move of line.moves) {
      const mover = chess.turn();
      let played;
      try {
        played = chess.move(move.san);
      } catch {
        played = null;
      }
      if (!played) {
        throw new Error(`Illegal move '${move.san}' at ply ${move.ply} in repertoire line '${line.id}'. FEN: ${chess.fen()}`);
      }
      const fen = chess.fen();
      const key = fenKey(fen);

      let child = node.children.find((c) => fenKey(c.fen) === key);
      if (!child) {
        let position = positions.get(key);
        if (!position) {
          position = { children: [], lineIds: [] };
          positions.set(key, position);
        }
        child = {
          san: played.san,
          fen,
          children: position.children,
          lineIds: position.lineIds,
          annotation: move.commentary,
          isStudentMove: mover === student,
        };
        node.children.push(child);
      }
      if (!child.lineIds.includes(line.id)) child.lineIds.push(line.id);
      if (!child.annotation && move.commentary) child.annotation = move.commentary;
      node = child;
    }
  }

  return root;
}
