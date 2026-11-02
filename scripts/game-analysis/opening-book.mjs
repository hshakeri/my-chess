// The opening book Maia plays from on the Play tab (DC-6), rebuilt from what hoot65's opponents play:
// every position of the first `plies` plies of the archive where the opponent was to move, with the
// opponent's replies as shares. A game's weight halves every year, so the book follows the recent
// opponents; a position needs `min` opponent decisions and a reply needs two games and a 2% share.
//
//   node opening-book.mjs <games.jsonl> <src/data/openingBook.json> [min=10] [plies=16]
import fs from 'node:fs';
import { Chess } from 'chess.js';

const [gamesFile, outFile, minArg = '10', pliesArg = '16'] = process.argv.slice(2);
const MIN = Number(minArg);
const PLIES = Number(pliesArg);
const HALF_LIFE_DAYS = 365;

const games = fs.readFileSync(gamesFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((g) => g.tc !== 'daily');
const newest = Math.max(...games.map((g) => g.end));
const norm = (fen) => fen.split(' ').slice(0, 4).join(' ');
const positions = new Map();
for (const g of games) {
  const weight = 0.5 ** ((newest - g.end) / 86400 / HALF_LIFE_DAYS);
  for (let p = 0; p < Math.min(PLIES, g.san.length); p++) {
    const opponentToMove = (p % 2 === 0) !== (g.me === 'w');
    if (!opponentToMove) continue;
    const key = norm(g.fens[p]);
    const entry = positions.get(key) ?? { fen: g.fens[p], n: 0, moves: new Map() };
    entry.n++;
    const m = entry.moves.get(g.san[p]) ?? { n: 0, w: 0 };
    m.n++;
    m.w += weight;
    entry.moves.set(g.san[p], m);
    positions.set(key, entry);
  }
}

const book = {};
for (const { fen, n, moves } of positions.values()) {
  if (n < MIN) continue;
  const total = [...moves.values()].reduce((a, m) => a + m.w, 0);
  const kept = [...moves.entries()].filter(([, m]) => m.n >= 2 && m.w / total >= 0.02).sort((a, b) => b[1].w - a[1].w);
  if (!kept.length) continue;
  const keptTotal = kept.reduce((a, [, m]) => a + m.w, 0);
  const candidates = kept.map(([san, m]) => {
    const move = new Chess(fen).move(san);
    return { san, uci: move.from + move.to + (move.promotion ?? ''), probability: Math.round((1000 * m.w) / keptTotal) / 1000 };
  });
  // The shares add up to exactly 1: the rounding goes to the most frequent reply
  const drift = Math.round(1000 * (1 - candidates.reduce((a, c) => a + c.probability, 0))) / 1000;
  candidates[0].probability = Math.round(1000 * (candidates[0].probability + drift)) / 1000;
  book[fen] = candidates;
}
fs.writeFileSync(outFile, JSON.stringify(book, null, 2) + '\n');
console.error(`${Object.keys(book).length} positions from ${games.length} games`);
