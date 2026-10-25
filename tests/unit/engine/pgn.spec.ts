import { describe, it, expect } from 'vitest';
import { PgnHandler } from '@/engine/pgn';
import { RulesEngine } from '@/engine/rules';

describe('F04 Live SAN & Lossless PGN Engine', () => {
  const samplePgn = `[Event "FIDE World Championship"]
[Site "London ENG"]
[Date "2018.11.28"]
[Round "12"]
[White "Carlsen, Magnus"]
[Black "Caruana, Fabiano"]
[Result "1/2-1/2"]
[WhiteElo "2835"]
[BlackElo "2832"]
[ECO "B33"]

1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5 6. Ndb5 d6 7. Nd5 Nxd5 8. exd5 Ne7 9. c4 Ng6 10. Qa4 Bd7 1/2-1/2`;

  it('parses PGN headers accurately', () => {
    const parsed = PgnHandler.parsePgn(samplePgn);
    expect(parsed.headers.Event).toBe('FIDE World Championship');
    expect(parsed.headers.White).toBe('Carlsen, Magnus');
    expect(parsed.headers.Black).toBe('Caruana, Fabiano');
    expect(parsed.headers.Result).toBe('1/2-1/2');
    expect(parsed.headers.ECO).toBe('B33');
    expect(parsed.result).toBe('1/2-1/2');
  });

  it('extracts SAN moves cleanly ignoring move numbers and clock comments', () => {
    const pgnWithComments = `[Event "Live Chess"]
[Result "1-0"]

1. e4 {[%clk 0:10:00]} 1... e5 {[%clk 0:09:58]} 2. Nf3 $1 {Great move} 2... Nc6 3. Bc4 1-0`;

    const parsed = PgnHandler.parsePgn(pgnWithComments);
    expect(parsed.movesSan).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(parsed.result).toBe('1-0');
  });

  it('splits multi-game PGN string into separate game chunks', () => {
    const multiPgn = `[Event "Game 1"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0

[Event "Game 2"]
[White "Player3"]
[Black "Player4"]
[Result "0-1"]

1. d4 d5 2. c4 0-1
`;
    const chunks = PgnHandler.splitMultiGamePgn(multiPgn);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('[Event "Game 1"]');
    expect(chunks[1]).toContain('[Event "Game 2"]');
  });

  it('serializes move history and headers to standard compliant PGN', () => {
    const engine = new RulesEngine();
    engine.makeMove('e4');
    engine.makeMove('e5');
    engine.makeMove('Nf3');
    engine.makeMove('Nc6');

    const headers = {
      Event: 'Test Tournament',
      Site: 'Client App',
      Date: '2026.10.25',
      White: 'Alice',
      Black: 'Bob',
      Result: '*',
    };

    const serialized = PgnHandler.serializePgn(headers, engine.getHistory(), '*');
    expect(serialized).toContain('[Event "Test Tournament"]');
    expect(serialized).toContain('[White "Alice"]');
    expect(serialized).toContain('[Black "Bob"]');
    expect(serialized.replace(/\s+/g, ' ')).toContain('1. e4 e5 2. Nf3 Nc6 *');
  });

  it('performs lossless round-trip import and export', () => {
    const engine = new RulesEngine();
    const loadRes = engine.loadPgn(samplePgn);
    expect(loadRes.success).toBe(true);

    const history = engine.getHistory();
    expect(history.length).toBe(20); // 10 plies for White + 10 plies for Black = 20 plies
    expect(history[0].san).toBe('e4');
    expect(history[1].san).toBe('c5');
    expect(history[19].san).toBe('Bd7');

    const exported = engine.exportPgn({
      Event: 'FIDE World Championship',
      White: 'Carlsen, Magnus',
      Black: 'Caruana, Fabiano',
    });
    expect(exported).toContain('[White "Carlsen, Magnus"]');
    expect(exported).toContain('1. e4 c5 2. Nf3 Nc6');
  });

  it('handles edge cases: empty PGN, single-move PGN, and corrupted formatting', () => {
    const emptyParsed = PgnHandler.parsePgn('');
    expect(emptyParsed.movesSan.length).toBe(0);

    const singleMove = PgnHandler.parsePgn('1. e4 *');
    expect(singleMove.movesSan).toEqual(['e4']);
    expect(singleMove.result).toBe('*');

    const corruptedPgn = 'Invalid non-pgn random text';
    const parsedCorrupt = PgnHandler.parsePgn(corruptedPgn);
    expect(parsedCorrupt.movesSan).toEqual(['Invalid', 'non-pgn', 'random', 'text']);
  });
});
