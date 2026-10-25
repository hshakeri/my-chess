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

  // Line 2: Italian Game - Giuoco Piano Mainline
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

  // Line 3: Scotch Gambit
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
      'Italian Game c3-d4 classical center dominance',
      'Dynamic Scotch Gambit attacking options',
      'Rapid kingside castling and open-file piece activity'
    ],
    rootFen: initialFen,
    lines: [scandiLine, italianLine, scotchLine],
    pgn: [scandiLine.pgn, italianLine.pgn, scotchLine.pgn].join('\n\n'),
    sourceReferences: [
      'TacticsInJuniorOpenings.pdf (Italian Game, Scotch Gambit, and Scandinavian Refutation chapters)',
      'Chess-Openings.pdf (King\'s Pawn Openings)',
      'null-101 Chess Opening Traps (Gambit Chess)'
    ]
  };
}

/**
 * Black Repertoire: Disciplined Caro-Kann Defense (3...Bf5!) & King's Indian Defense vs 1.d4
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

  // Line 3: King's Indian Defense vs 1.d4
  const kidMoves = [
    'd4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O',
    'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'Ne1', 'Nd7', 'Nd3', 'f5'
  ];
  const kidAnnotations: Record<number, { commentary?: string; annotation?: string; tacticalMotif?: string; isKeyMove?: boolean }> = {
    2: { commentary: 'Flexible reply preventing White from playing an uncontested e4.', isKeyMove: true },
    4: { commentary: 'King\'s Indian setup: preparing to fianchetto the bishop on the long diagonal.', isKeyMove: true },
    10: { commentary: 'Castling early guarantees king safety before opening the center.', isKeyMove: true },
    12: { commentary: 'Thematic King\'s Indian central counter-strike: Black stakes a claim on e5.', annotation: '!', tacticalMotif: 'Central Counter-Strike', isKeyMove: true },
    20: { commentary: 'The iconic ...f5 kingside pawn storm begins!', annotation: '!', tacticalMotif: 'Kingside Attack', isKeyMove: true }
  };

  const kidLine: RepertoireLine = {
    id: 'black-kings-indian-defense',
    name: 'King\'s Indian Defense (Mar del Plata Setup)',
    eco: 'E97',
    movesSan: kidMoves,
    description: 'A dynamic, high-scoring weapon against 1.d4. Black cedes the classical center initially, builds an impregnable fortress with ...g6 and ...Bg7, and launches an unstoppable kingside attack with ...e5 and ...f5.',
    keyIdeas: [
      'Fianchetto the king\'s bishop to g7',
      'Castle kingside rapidly before opening lines',
      'Strike back in the center with ...e5',
      'Launch a direct kingside mating attack with ...f7-f5'
    ],
    moves: buildMoveChain(kidMoves, initialFen, kidAnnotations),
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. Ne1 Nd7 10. Nd3 f5'
  };

  return {
    id: 'repertoire-black-caro-kann-kid',
    color: 'black',
    name: 'Disciplined Caro-Kann & King\'s Indian Defense',
    description: 'A cohesive repertoire for Black designed for hoot65. Features the disciplined Caro-Kann (preventing premature ...Bg4 blunders through systematic 3...Bf5! and 4...Bf5 lines) against 1.e4, and the sharp King\'s Indian Defense against 1.d4.',
    targetOpponentResponses: ['1.e4 (King\'s Pawn Openings)', '1.d4 (Queen\'s Pawn Openings)', '1.c4 (English Opening / Reti)'],
    keyThemes: [
      'Discipline with the light-squared bishop: ALWAYS 3...Bf5! in Advance Caro-Kann — NEVER premature ...Bg4?!',
      'Solid pawn chains and zero structural weaknesses',
      'Prophylactic ...h6 to avoid bishop-trapping maneuvers',
      'King\'s Indian counter-strikes (...e5, ...f5) against 1.d4'
    ],
    rootFen: initialFen,
    lines: [advanceLine, classicalLine, kidLine],
    pgn: [advanceLine.pgn, classicalLine.pgn, kidLine.pgn].join('\n\n'),
    sourceReferences: [
      'TacticsInJuniorOpenings.pdf (Caro-Kann Defense: Trapping the bishop & Removing the guard)',
      'Chess-Openings.pdf (Semi-Open & Closed Games)',
      'kupdf.net_modern-chess-openings-15th-edition.pdf (Caro-Kann & King\'s Indian)'
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
