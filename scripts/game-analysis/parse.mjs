// Parse every archived game into a compact record: moves (SAN, UCI), FENs, clocks, ratings, result.
import fs from 'node:fs';
import path from 'node:path';
import { Chess } from 'chess.js';
const [rawDir, outFile] = process.argv.slice(2);
const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
const out = fs.createWriteStream(outFile);
let n = 0, skipped = {};
const files = fs.readdirSync(rawDir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
const all = [];
for (const f of files) for (const g of JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8')).games) all.push(g);
all.sort((a, b) => a.end_time - b.end_time);
for (const g of all) {
  const skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
  if (g.rules !== 'chess') { skip('rules:' + g.rules); continue; }
  if (g.time_class === 'daily') { skip('daily'); continue; }
  const me = g.white.username.toLowerCase() === 'hoot65' ? 'w' : 'b';
  const mine = me === 'w' ? g.white : g.black, theirs = me === 'w' ? g.black : g.white;
  const pgn = g.pgn || '';
  const body = pgn.replace(/^\[.*\]\s*$/gm, '').trim();
  const re = /(\d+)(\.{1,3})\s*([^\s{}]+)\s*(?:\{\s*\[%clk\s+([0-9:.]+)\]\s*\})?/g;
  const chess = new Chess();
  if (g.initial_setup && g.initial_setup !== chess.fen()) { skip('setup'); continue; }
  const san = [], uci = [], fens = [chess.fen()], clk = [];
  let m, bad = false;
  while ((m = re.exec(body))) {
    const s = m[3];
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(s)) break;
    let mv;
    try { mv = chess.move(s); } catch { bad = true; break; }
    san.push(mv.san); uci.push(mv.from + mv.to + (mv.promotion || '')); fens.push(chess.fen());
    if (m[4]) { const parts = m[4].split(':').map(Number); clk.push(parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]); } else clk.push(null);
  }
  if (bad) { skip('illegal'); continue; }
  const res = mine.result;
  const score = res === 'win' ? 1 : DRAWS.has(res) ? 0.5 : 0;
  const tc = String(g.time_control || '');
  const [base, inc] = tc.includes('+') ? tc.split('+').map(Number) : [Number(tc), 0];
  out.write(JSON.stringify({
    id: (g.url || '').split('/').pop(), url: g.url, end: g.end_time, tc: g.time_class, base, inc, rated: g.rated,
    me, myElo: mine.rating, oppElo: theirs.rating, opp: theirs.username, score, myRes: res, oppRes: theirs.result,
    eco: (g.eco || '').split('/').pop(), san, uci, fens, clk,
  }) + '\n');
  n++;
}
out.end();
console.log('games', n, 'skipped', skipped);
