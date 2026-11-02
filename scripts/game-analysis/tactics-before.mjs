// Tactics deck: the position two plies before each one and the two moves played, for the
// "two moves ahead" visualization sheet.
//
//   node tactics-before.mjs <deck.json>   (rewrites it in place)
import fs from 'node:fs';
import { Chess } from 'chess.js';
const [deckFile] = process.argv.slice(2);
const games = new Map(fs.readFileSync('games.jsonl', 'utf8').trim().split('\n').map((l) => { const g = JSON.parse(l); return [g.url.split('/').pop(), g]; }));
const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
const out = deck.map((t) => {
  const [gid, plyStr] = t.id.split('-');
  const g = games.get(gid);
  const ply = Number(plyStr);
  if (!g || ply < 2) return t;
  const fen = g.fens[ply - 2];
  const c = new Chess(fen);
  const moves = [c.move(g.san[ply - 2]).san, c.move(g.san[ply - 1]).san];
  if (c.fen().split(' ').slice(0, 4).join(' ') !== t.fen.split(' ').slice(0, 4).join(' ')) throw new Error(`replay mismatch for ${t.id}`);
  const { game, ...rest } = t;
  return { ...rest, before: { fen, moves }, game };
});
fs.writeFileSync(deckFile, JSON.stringify(out, null, 1) + '\n');
console.error(`${out.filter((t) => t.before).length} of ${out.length} positions with the two moves before`);
