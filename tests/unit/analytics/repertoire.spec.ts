import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  getRecommendedWhiteRepertoire,
  getRecommendedBlackRepertoire,
  getAllRecommendedRepertoires,
  getRepertoireById,
  findMatchingLine,
  buildRepertoireTree,
  findChildByFen,
  fenKey,
  RepertoireNode,
} from '../../../src/analytics/repertoire';
import { RepertoirePlan } from '../../../src/types/diagnostics';

/** Follow `sans` down the tree by move label; throws when a move is missing. */
const pathNode = (root: RepertoireNode, sans: string[]): RepertoireNode => {
  let node = root;
  for (const san of sans) {
    const next = node.children.find((c) => c.san === san);
    if (!next) throw new Error(`no child ${san} under ${node.san || 'root'}`);
    node = next;
  }
  return node;
};

const fenAfter = (sans: string[]): string => {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
};

/** Every distinct node reachable from the root (merged nodes counted once). */
const uniqueNodes = (root: RepertoireNode): Set<RepertoireNode> => {
  const seen = new Set<RepertoireNode>();
  const walk = (n: RepertoireNode) => {
    if (seen.has(n)) return;
    seen.add(n);
    n.children.forEach(walk);
  };
  walk(root);
  return seen;
};

describe('Repertoire Engine & Tailored Repertoire Generator', () => {
  describe('White Repertoire Plan', () => {
    it('generates a complete White repertoire containing the Evans Gambit, Giuoco Piano, Scotch Gambit, and Anti-Scandinavian', () => {
      const rep = getRecommendedWhiteRepertoire();

      expect(rep.id).toBe('repertoire-white-italian-scandi');
      expect(rep.color).toBe('white');
      expect(rep.name).toContain('Italian Game');
      expect(rep.name).toContain('Anti-Scandinavian');
      expect(rep.lines.length).toBeGreaterThanOrEqual(4);

      const lineIds = rep.lines.map(l => l.id);
      expect(lineIds).toContain('white-scandi-refutation');
      expect(lineIds).toContain('white-italian-evans-gambit');
      expect(lineIds).toContain('white-italian-giuoco-piano');
      expect(lineIds).toContain('white-scotch-gambit');
    });

    it('proves that 100% of moves in all White lines are verified legal by the chess rules engine', () => {
      const rep = getRecommendedWhiteRepertoire();

      for (const line of rep.lines) {
        const chess = new Chess();
        for (let i = 0; i < line.moves.length; i++) {
          const moveRecord = line.moves[i];
          expect(moveRecord.ply).toBe(i + 1);

          const legalMove = chess.move(moveRecord.san);
          expect(legalMove).not.toBeNull();
          expect(chess.fen()).toBe(moveRecord.fen);
        }
        expect(line.movesSan).toEqual(line.moves.map((m) => m.san));
      }
    });

    it('ensures the Anti-Scandinavian line explicitly executes 2.exd5! and 3.Nc3!', () => {
      const rep = getRecommendedWhiteRepertoire();
      const scandiLine = rep.lines.find(l => l.id === 'white-scandi-refutation');
      expect(scandiLine).toBeDefined();

      const movesSan = scandiLine!.movesSan;
      expect(movesSan[0]).toBe('e4');
      expect(movesSan[1]).toBe('d5');
      expect(movesSan[2]).toBe('exd5'); // 2.exd5!
      expect(movesSan[3]).toBe('Qxd5');
      expect(movesSan[4]).toBe('Nc3'); // 3.Nc3!
      expect(movesSan[5]).toBe('Qa5');
      expect(movesSan[6]).toBe('d4');

      // Verify key move commentary
      const ply3 = scandiLine!.moves.find(m => m.ply === 3);
      expect(ply3?.annotation).toBe('!');
      expect(ply3?.tacticalMotif).toContain('Central Liquidation');
    });

    it('keeps 4.b4 (Evans) as the Italian main line after 3...Bc5, mirroring the Evans lesson, with 4.c3 as the alternative', () => {
      const rep = getRecommendedWhiteRepertoire();
      const evans = rep.lines.find((l) => l.id === 'white-italian-evans-gambit')!;
      expect(evans.movesSan.slice(0, 8)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4']);
      expect(evans.movesSan).toEqual([
        'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Bc5',
        'd4', 'exd4', 'O-O', 'd6', 'cxd4', 'Bb6', 'Nc3',
      ]);
      expect(evans.moves[6].commentary).toContain('6 wins in 7 games');
      // The Evans comes before the Giuoco so the tree's book move after 3...Bc5 is 4.b4
      const giuoco = rep.lines.find((l) => l.id === 'white-italian-giuoco-piano')!;
      expect(giuoco.movesSan[6]).toBe('c3');
      expect(rep.lines.indexOf(evans)).toBeLessThan(rep.lines.indexOf(giuoco));
    });

    it('serializes valid PGN for all White repertoire lines', () => {
      const rep = getRecommendedWhiteRepertoire();
      expect(rep.pgn).toBeDefined();
      expect(rep.pgn.length).toBeGreaterThan(50);
      expect(rep.pgn).toContain('1. e4 d5 2. exd5');
      expect(rep.pgn).toContain('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4');
    });

    it('includes source PDF citations from local reference books', () => {
      const rep = getRecommendedWhiteRepertoire();
      expect(rep.sourceReferences.length).toBeGreaterThan(0);
      const refs = rep.sourceReferences.join(' ');
      expect(refs).toContain('TacticsInJuniorOpenings.pdf');
    });
  });

  describe('Black Repertoire Plan', () => {
    it('generates a complete Black repertoire: the two Caro-Kann lines and the c6-d5 wall against 1.d4, with no King\'s Indian', () => {
      const rep = getRecommendedBlackRepertoire();

      expect(rep.id).toBe('repertoire-black-caro-kann-wall');
      expect(rep.color).toBe('black');
      expect(rep.name).toBe('Caro-Kann & the c6-d5 Wall');
      expect(rep.name).not.toContain("King's Indian");
      expect(rep.lines.length).toBeGreaterThanOrEqual(3);

      const lineIds = rep.lines.map(l => l.id);
      expect(lineIds).toContain('black-caro-kann-advance');
      expect(lineIds).toContain('black-caro-kann-classical');
      expect(lineIds).toContain('black-slav-wall');
      expect(lineIds).toContain('black-wall-vs-london');
      expect(lineIds).toContain('black-wall-vs-nf3-bf4');
      expect(lineIds).toContain('black-wall-vs-nf3-c4');
      expect(lineIds).not.toContain('black-kings-indian-defense');

      // Against 1.d4 every line answers 1...d5 and puts a pawn on c6 by move three
      for (const line of rep.lines.filter((l) => l.movesSan[0] === 'd4')) {
        expect(line.movesSan[1]).toBe('d5');
        expect(line.movesSan.slice(0, 6)).toContain('c6');
      }
      expect(rep.lines.some((l) => l.movesSan[1] === 'Nf6')).toBe(false);
      expect(rep.description).not.toContain("King's Indian");
      expect(rep.keyThemes.join(' ')).not.toContain("King's Indian");
    });

    it('proves that 100% of moves in all Black lines are verified legal by the chess rules engine', () => {
      const rep = getRecommendedBlackRepertoire();

      for (const line of rep.lines) {
        const chess = new Chess();
        for (let i = 0; i < line.moves.length; i++) {
          const moveRecord = line.moves[i];
          expect(moveRecord.ply).toBe(i + 1);

          const legalMove = chess.move(moveRecord.san);
          expect(legalMove).not.toBeNull();
          expect(chess.fen()).toBe(moveRecord.fen);
        }
        expect(line.movesSan).toEqual(line.moves.map((m) => m.san));
      }
    });

    it('ensures the Caro-Kann Advance line strictly plays 3...Bf5! and explains why premature ...Bg4 is avoided', () => {
      const rep = getRecommendedBlackRepertoire();
      const advanceLine = rep.lines.find(l => l.id === 'black-caro-kann-advance');
      expect(advanceLine).toBeDefined();

      const movesSan = advanceLine!.movesSan;
      expect(movesSan[0]).toBe('e4');
      expect(movesSan[1]).toBe('c6');
      expect(movesSan[2]).toBe('d4');
      expect(movesSan[3]).toBe('d5');
      expect(movesSan[4]).toBe('e5');
      expect(movesSan[5]).toBe('Bf5'); // 3...Bf5!

      const ply6 = advanceLine!.moves.find(m => m.ply === 6);
      expect(ply6?.san).toBe('Bf5');
      expect(ply6?.annotation).toBe('!');
      expect(ply6?.commentary).toContain('3...Bf5!');
      expect(ply6?.commentary).toContain('Bg4');
    });

    it('plays the Slav with ...dxc4, 5.a4 Bf5 and ...Bb4 against 2.c4', () => {
      const rep = getRecommendedBlackRepertoire();
      const slav = rep.lines.find((l) => l.id === 'black-slav-wall')!;
      expect(slav.movesSan).toEqual([
        'd4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5',
        'e3', 'e6', 'Bxc4', 'Bb4', 'O-O', 'O-O',
      ]);
      // The ...Bb4 commentary claims a pin on c3 against the king on e1 through an empty d2: check it on the board
      const chess = new Chess(slav.moves[13].fen);
      expect(chess.get('d2')).toBeUndefined();
      expect(chess.get('e1')).toEqual({ type: 'k', color: 'w' });
      expect(chess.get('c3')).toEqual({ type: 'n', color: 'w' });
      expect(chess.get('b4')).toEqual({ type: 'b', color: 'b' });
      expect(slav.moves[13].commentary).toMatch(/pins the c3 knight/);
    });

    it('meets the London with ...Bf5, the bishop trade and ...Qb6 against the loose b2 pawn', () => {
      const rep = getRecommendedBlackRepertoire();
      const london = rep.lines.find((l) => l.id === 'black-wall-vs-london')!;
      expect(london.movesSan.slice(0, 12)).toEqual(['d4', 'd5', 'Bf4', 'c6', 'e3', 'Bf5', 'Nf3', 'e6', 'Bd3', 'Bxd3', 'Qxd3', 'Qb6']);
      // b2 is undefended before ...Qb6 and attacked after it: the commentary's claim, on the board
      const before = new Chess(london.moves[10].fen);
      expect(before.isAttacked('b2', 'w')).toBe(false);
      const after = new Chess(london.moves[11].fen);
      expect(after.isAttacked('b2', 'b')).toBe(true);
      expect(london.moves[11].commentary).toMatch(/b2/);
    });

    it('serializes valid PGN for all Black repertoire lines', () => {
      const rep = getRecommendedBlackRepertoire();
      expect(rep.pgn).toBeDefined();
      expect(rep.pgn).toContain('1. e4 c6 2. d4 d5');
      expect(rep.pgn).toContain('1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5');
      expect(rep.pgn).toContain('1. d4 d5 2. Bf4 c6 3. e3 Bf5');
    });

    it('does not cite page numbers in its attributions', () => {
      const rep = getRecommendedBlackRepertoire();
      for (const ref of rep.sourceReferences) expect(ref).not.toMatch(/\bp(p|ages?)?\.?\s*\d/i);
    });
  });

  describe('Repertoire tree', () => {
    const white = getRecommendedWhiteRepertoire();
    const black = getRecommendedBlackRepertoire();
    const whiteTree = buildRepertoireTree(white);
    const blackTree = buildRepertoireTree(black);

    it('fenKey keeps the first four FEN fields only', () => {
      expect(fenKey('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
      expect(fenKey('  8/8/8/8/8/8/8/K6k w - - 7 40  ')).toBe('8/8/8/8/8/8/8/K6k w - -');
    });

    it('roots at the plan\'s start position and lists every line at the root', () => {
      expect(whiteTree.fen).toBe(white.rootFen);
      expect(whiteTree.san).toBe('');
      expect(whiteTree.isStudentMove).toBe(false);
      expect(whiteTree.lineIds).toEqual(white.lines.map((l) => l.id));
      expect(whiteTree.children.map((c) => c.san)).toEqual(['e4']);
      expect(blackTree.children.map((c) => c.san).sort()).toEqual(['d4', 'e4']);
    });

    it('every node\'s fen is the parent\'s fen plus its san, replayed with chess.js, and isStudentMove follows the side to move', () => {
      for (const [plan, tree] of [[white, whiteTree], [black, blackTree]] as Array<[RepertoirePlan, RepertoireNode]>) {
        const student = plan.color === 'white' ? 'w' : 'b';
        const seen = new Set<RepertoireNode>();
        const walk = (node: RepertoireNode) => {
          if (seen.has(node)) return;
          seen.add(node);
          const chess = new Chess(node.fen);
          for (const child of node.children) {
            const probe = new Chess(node.fen);
            expect(() => probe.move(child.san)).not.toThrow();
            expect(fenKey(probe.fen())).toBe(fenKey(child.fen));
            expect(child.isStudentMove).toBe(chess.turn() === student);
            expect(child.lineIds.length).toBeGreaterThan(0);
            for (const id of child.lineIds) expect(plan.lines.some((l) => l.id === id)).toBe(true);
            walk(child);
          }
        };
        walk(tree);
      }
    });

    it('carries the plan\'s commentary as the node annotation', () => {
      const exd5 = pathNode(whiteTree, ['e4', 'd5', 'exd5']);
      expect(exd5.isStudentMove).toBe(true);
      expect(exd5.annotation).toContain('Take the pawn');
      expect(exd5.lineIds).toEqual(['white-scandi-refutation']);
    });

    it('merges transpositions: 2.Nf3 c6 3.Bf4 Bf5 4.e3 e6 and 2.Bf4 c6 3.e3 Bf5 4.Nf3 e6 are one node with both lines, and the London continuation follows', () => {
      const viaLondon = pathNode(blackTree, ['d4', 'd5', 'Bf4', 'c6', 'e3', 'Bf5', 'Nf3', 'e6']);
      const viaNf3 = pathNode(blackTree, ['d4', 'd5', 'Nf3', 'c6', 'Bf4', 'Bf5', 'e3', 'e6']);
      expect(viaNf3).toBe(viaLondon);
      expect(viaLondon.lineIds).toEqual(expect.arrayContaining(['black-wall-vs-london', 'black-wall-vs-nf3-bf4']));
      expect(viaLondon.children.map((c) => c.san)).toEqual(['Bd3']);
      expect(fenKey(viaLondon.fen)).toBe(fenKey(fenAfter(['d4', 'd5', 'Nf3', 'c6', 'Bf4', 'Bf5', 'e3', 'e6'])));

      const slavViaC4 = pathNode(blackTree, ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6']);
      const slavViaNf3 = pathNode(blackTree, ['d4', 'd5', 'Nf3', 'c6', 'c4', 'Nf6']);
      expect(slavViaNf3).toBe(slavViaC4);
      expect(slavViaC4.lineIds).toEqual(expect.arrayContaining(['black-slav-wall', 'black-wall-vs-nf3-c4']));
      // Past the transposition the 2.c4 line continues to the end
      expect(pathNode(slavViaNf3, ['Nc3', 'dxc4', 'a4', 'Bf5', 'e3', 'e6', 'Bxc4', 'Bb4', 'O-O', 'O-O']).children).toEqual([]);

      const totalPlies = black.lines.reduce((n, l) => n + l.moves.length, 0);
      expect(uniqueNodes(blackTree).size - 1).toBeLessThan(totalPlies);
    });

    it('branches where the lines differ: after 3...Bc5 White has 4.b4 first and 4.c3 second', () => {
      const bc5 = pathNode(whiteTree, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
      expect(bc5.children.map((c) => c.san)).toEqual(['b4', 'c3']);
      expect(bc5.children.every((c) => c.isStudentMove)).toBe(true);
      expect(findChildByFen(bc5, fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3']))?.san).toBe('c3');
      expect(findChildByFen(bc5, fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']))).toBeUndefined();
    });

    it('throws on an illegal line instead of building a broken tree', () => {
      const bad: RepertoirePlan = {
        ...white,
        lines: [{ ...white.lines[0], id: 'bad', moves: [{ ply: 1, san: 'e5', fen: '' }], movesSan: ['e5'] }],
      };
      expect(() => buildRepertoireTree(bad)).toThrow(/Illegal move 'e5'/);
    });
  });

  describe('Repertoire Lookup & Matching Utilities', () => {
    it('returns both repertoires via getAllRecommendedRepertoires', () => {
      const all = getAllRecommendedRepertoires();
      expect(all.length).toBe(2);
      expect(all.some(r => r.color === 'white')).toBe(true);
      expect(all.some(r => r.color === 'black')).toBe(true);
    });

    it('finds repertoires by ID accurately', () => {
      const white = getRepertoireById('repertoire-white-italian-scandi');
      expect(white).toBeDefined();
      expect(white?.color).toBe('white');

      const black = getRepertoireById('repertoire-black-caro-kann-wall');
      expect(black).toBeDefined();
      expect(black?.color).toBe('black');

      const nonExistent = getRepertoireById('does-not-exist');
      expect(nonExistent).toBeUndefined();
    });

    it('matches a game move history to the correct repertoire line and returns matching plies count', () => {
      const whiteRep = getRecommendedWhiteRepertoire();
      const scandiGameMoves = ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4'];

      const match = findMatchingLine(whiteRep, scandiGameMoves);
      expect(match).not.toBeNull();
      expect(match?.line.id).toBe('white-scandi-refutation');
      expect(match?.matchingPlies).toBe(7);

      // Partial match: the Italian prefix now resolves to the Evans main line; 4.c3 still finds the Giuoco
      const italianPartial = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
      const matchItalian = findMatchingLine(whiteRep, italianPartial);
      expect(matchItalian?.line.id).toBe('white-italian-evans-gambit');
      expect(matchItalian?.matchingPlies).toBe(6);
      expect(findMatchingLine(whiteRep, [...italianPartial, 'c3'])?.line.id).toBe('white-italian-giuoco-piano');

      // Unknown opening returns null or lowest match
      const englishOpening = ['c4', 'e5'];
      const matchEnglish = findMatchingLine(whiteRep, englishOpening);
      expect(matchEnglish).toBeNull();
    });
  });
});
