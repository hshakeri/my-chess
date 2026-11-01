// Pass 2: for selected positions (hoot65 to move), Maia's top-K human moves with the
// expected score after each (hoot65's point of view), plus the value after the move played.
import fs from 'node:fs';
import { Maia3 } from 'maia3-js';
const [gamesFile, listFile, outFile, kArg, offsetArg] = process.argv.slice(2);
const K = Number(kArg ?? 6), OFFSET = Number(offsetArg ?? 400);
const games = fs.readFileSync(gamesFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const list = JSON.parse(fs.readFileSync(listFile, 'utf8')); // [[g, p], ...]
const maia = new Maia3({ variant: '5m', modelPath: new URL('./node_modules/maia3-js/models/maia3_5m.onnx', import.meta.url).pathname, intraOpNumThreads: 8 });
await maia.load();
const t0 = Date.now(), out = [];
for (let i = 0; i < list.length; i += 256) {
  const chunk = list.slice(i, i + 256);
  const inputs = chunk.map(([g, p]) => {
    const G = games[g]; const stmIsMe = (p % 2 === 0) === (G.me === 'w');
    const a = G.myElo + OFFSET, b = G.oppElo + OFFSET;
    return { fen: G.fens[p], priorFens: G.fens.slice(Math.max(0, p - 8), p), selfElo: stmIsMe ? a : b, oppoElo: stmIsMe ? b : a };
  });
  const res = await maia.predictBatch(inputs, { onError: 'collect', topK: K, maxBatchSize: 64 });
  chunk.forEach(([g, p], j) => {
    const r = res[j]; if (r instanceof Error) return;
    out.push({ g, p, played: games[g].uci[p], wp: r.winProbability, cands: r.candidates.map((c) => [c.uci, +c.probability.toFixed(3), +c.winProbability.toFixed(4)]) });
  });
}
fs.writeFileSync(outFile, JSON.stringify(out));
console.error(`candidates for ${out.length} positions in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
