import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  getRecommendedWhiteRepertoire,
  getRecommendedBlackRepertoire,
  getAllRecommendedRepertoires,
  getRepertoireById,
  findMatchingLine,
} from '../../../src/analytics/repertoire';

describe('Repertoire Engine & Tailored Repertoire Generator', () => {
  describe('White Repertoire Plan', () => {
    it('generates a complete White repertoire containing Italian Game, Scotch Gambit, and Anti-Scandinavian', () => {
      const rep = getRecommendedWhiteRepertoire();

      expect(rep.id).toBe('repertoire-white-italian-scandi');
      expect(rep.color).toBe('white');
      expect(rep.name).toContain('Italian Game');
      expect(rep.name).toContain('Anti-Scandinavian');
      expect(rep.lines.length).toBeGreaterThanOrEqual(3);

      const lineIds = rep.lines.map(l => l.id);
      expect(lineIds).toContain('white-scandi-refutation');
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

    it('serializes valid PGN for all White repertoire lines', () => {
      const rep = getRecommendedWhiteRepertoire();
      expect(rep.pgn).toBeDefined();
      expect(rep.pgn.length).toBeGreaterThan(50);
      expect(rep.pgn).toContain('1. e4 d5 2. exd5');
    });

    it('includes source PDF citations from local reference books', () => {
      const rep = getRecommendedWhiteRepertoire();
      expect(rep.sourceReferences.length).toBeGreaterThan(0);
      const refs = rep.sourceReferences.join(' ');
      expect(refs).toContain('TacticsInJuniorOpenings.pdf');
    });
  });

  describe('Black Repertoire Plan', () => {
    it('generates a complete Black repertoire containing Disciplined Caro-Kann and King\'s Indian Defense', () => {
      const rep = getRecommendedBlackRepertoire();

      expect(rep.id).toBe('repertoire-black-caro-kann-kid');
      expect(rep.color).toBe('black');
      expect(rep.name).toContain('Caro-Kann');
      expect(rep.name).toContain("King's Indian");
      expect(rep.lines.length).toBeGreaterThanOrEqual(3);

      const lineIds = rep.lines.map(l => l.id);
      expect(lineIds).toContain('black-caro-kann-advance');
      expect(lineIds).toContain('black-caro-kann-classical');
      expect(lineIds).toContain('black-kings-indian-defense');
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

    it('ensures the King\'s Indian line counters 1.d4 with dynamic ...g6, ...Bg7, and ...f5', () => {
      const rep = getRecommendedBlackRepertoire();
      const kidLine = rep.lines.find(l => l.id === 'black-kings-indian-defense');
      expect(kidLine).toBeDefined();

      const movesSan = kidLine!.movesSan;
      expect(movesSan[0]).toBe('d4');
      expect(movesSan[1]).toBe('Nf6');
      expect(movesSan[2]).toBe('c4');
      expect(movesSan[3]).toBe('g6');
      expect(movesSan[5]).toBe('Bg7');
      expect(movesSan[7]).toBe('d6');
    });

    it('serializes valid PGN for all Black repertoire lines', () => {
      const rep = getRecommendedBlackRepertoire();
      expect(rep.pgn).toBeDefined();
      expect(rep.pgn).toContain('1. e4 c6 2. d4 d5');
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

      const black = getRepertoireById('repertoire-black-caro-kann-kid');
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

      // Partial match
      const italianPartial = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
      const matchItalian = findMatchingLine(whiteRep, italianPartial);
      expect(matchItalian?.line.id).toBe('white-italian-giuoco-piano');
      expect(matchItalian?.matchingPlies).toBe(6);

      // Unknown opening returns null or lowest match
      const englishOpening = ['c4', 'e5'];
      const matchEnglish = findMatchingLine(whiteRep, englishOpening);
      expect(matchEnglish).toBeNull();
    });
  });
});
