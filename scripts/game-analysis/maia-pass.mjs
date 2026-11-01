// Pass 1: Maia value and policy for every position of every game (topK 0).
// Output per position: [gameIdx, ply, winProb(side to move), probPlayed, rankPlayed, top3]
import fs from 'node:fs';
import readline from 'node:readline';
import { Maia3 } from 'maia3-js';
const [gamesFile, shard, nShards, outFile, offsetArg] = process.argv.slice(2);
const OFFSET = Number(offsetArg ?? 400);
const maia = new Maia3({ variant: '5m', modelPath: new URL('./node_modules/maia3-js/models/maia3_5m.onnx', import.meta.url).pathname, intraOpNumThreads: 4 });
await maia.load();
const out = fs.createWriteStream(outFile);
const rl = readline.createInterface({ input: fs.createReadStream(gamesFile) });
let gi = -1, pending = [], done = 0, t0 = Date.now();
async function flush() {
  if (!pending.length) return;
  const res = await maia.predictBatch(pending.map((p) => p.input), { onError: 'collect', maxBatchSize: 128 });
  for (let i = 0; i < pending.length; i++) {
    const { g, p, played } = pending[i]; const r = res[i];
    if (r instanceof Error) { out.write(JSON.stringify([g, p, null]) + '\n'); continue; }
    const entries = [...r.moves.entries()].sort((a, b) => b[1] - a[1]);
    let pp = null, rk = null;
    if (played) { const k = entries.findIndex(([u]) => u === played); rk = k; pp = k >= 0 ? +entries[k][1].toFixed(4) : 0; }
    out.write(JSON.stringify([g, p, +r.winProbability.toFixed(4), pp, rk, entries.slice(0, 3).map(([u, q]) => [u, +q.toFixed(3)]), [+r.wdl.win.toFixed(3), +r.wdl.draw.toFixed(3)]]) + '\n');
  }
  done += pending.length; pending = [];
  if (done % 5120 < 1024) console.error(`shard ${shard}: ${done} positions, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
for await (const line of rl) {
  gi++;
  if (gi % Number(nShards) !== Number(shard)) continue;
  const g = JSON.parse(line);
  const myElo = g.myElo + OFFSET, oppElo = g.oppElo + OFFSET;
  for (let p = 0; p < g.fens.length; p++) {
    const stmIsMe = (p % 2 === 0) === (g.me === 'w');
    pending.push({ g: gi, p, played: g.uci[p] ?? null, input: { fen: g.fens[p], priorFens: g.fens.slice(Math.max(0, p - 8), p), selfElo: stmIsMe ? myElo : oppElo, oppoElo: stmIsMe ? oppElo : myElo } });
    if (pending.length >= 1024) await flush();
  }
}
await flush();
out.end();
console.error(`shard ${shard} finished: ${done} positions in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
