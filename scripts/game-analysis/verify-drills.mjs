// Stockfish (the "high level" engine) checks the drills before the app uses them.
//
// vet: of the candidates from `drills.mjs scan`, keep those that make a sound drill by Stockfish's
// scores: the game was still open before hoot65's move (at least MIN centipawns for hoot65, so no
// drill comes from a game that was lost anyway), the move played lost at least MIN_LOSS, and at least
// one accepted move comes within MARGIN of Stockfish's best, or keeps a winning position (WIN or more),
// without walking into a forced mate: a drill is about its board check, so a move that passes the check
// and still wins is right even when Stockfish finds a stronger one. The accepted moves are cut to
// those, best first (a free drill must still take the free piece). `drills.mjs
// pick` or `add` then chooses from the output.
//
// check: the same test of the accepted moves and the move played, on a drills file; with --write the
// accepted lists are cut and reordered in place.
//
//   node verify-drills.mjs vet <out.json> <min=-250> <depth=16> <candidates.json...>
//   node verify-drills.mjs check <game_drills.json> <kind,kind,...> [depth=18] [--write]
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Stockfish, MATE } from './stockfish.mjs';

const MARGIN = 150;
const WIN = 300;
const MIN_LOSS = 150;

const uci = (fen, san) => {
  const m = new Chess(fen).move(san);
  return `${m.from}${m.to}${m.promotion ?? ''}`;
};
/** The position hoot65 moved in: the drill's position after the opponent's last move. */
const positionOf = (d) => {
  const c = new Chess(d.fenBefore);
  c.move(d.lastSan);
  return c.fen();
};

/** Stockfish's scores for a drill: the best move, the move played, and the accepted moves within MARGIN. */
async function score(sf, d, depth) {
  const fen = positionOf(d);
  const best = await sf.analyse(fen, { depth });
  const scored = [];
  for (const san of d.accepted) {
    const r = await sf.analyse(fen, { depth, searchmoves: [uci(fen, san)] });
    scored.push({ san, score: r.score });
  }
  const played = (await sf.analyse(fen, { depth, searchmoves: [uci(fen, d.played)] })).score;
  const keep = scored.filter((s) => (s.score >= best.score - MARGIN || s.score >= WIN) && s.score > -MATE / 2).sort((a, b) => b.score - a.score);
  // A free drill is about the free piece: one of the answers left must take it
  const takesTarget = (san) => {
    const m = new Chess(fen).move(san);
    return m.to === d.target && !!m.captured;
  };
  const ok = keep.length > 0 && (d.kind !== 'free' || keep.some((s) => takesTarget(s.san)));
  return { fen, best: best.score, played, loss: best.score - played, scored, keep, ok };
}

async function vet([outFile, minArg = '-250', depthArg = '16', ...inFiles]) {
  const min = Number(minArg);
  const depth = Number(depthArg);
  const all = inFiles.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 512 });
  const kept = [];
  for (const d of all) {
    const head = `${d.date} ${d.kind} ${d.opponent} ${d.played}`;
    // A threat or hang drill replays the capture that punishes the move played
    if ((d.kind === 'threat' || d.kind === 'hang') && !d.refutation) {
      console.log(`${head}: no capture to replay, dropped`);
      continue;
    }
    const { score: best } = await sf.analyse(positionOf(d), { depth });
    if (best < min) {
      console.log(`${head}: ${best}, lost already`);
      continue;
    }
    const r = await score(sf, d, depth);
    const why = r.loss < MIN_LOSS ? `the move played lost only ${r.loss}` : !r.ok ? 'no answer survives' : '';
    console.log(`${head}: best ${r.best}, played ${r.played}, keep ${r.keep.length}/${r.scored.length}${why ? `, dropped: ${why}` : ''}`);
    if (!why) kept.push({ ...d, accepted: r.keep.map((s) => s.san), sfBest: r.best, sfPlayed: r.played });
  }
  sf.quit();
  fs.writeFileSync(outFile, JSON.stringify(kept, null, 1) + '\n');
  console.log(`kept ${kept.length} of ${all.length} in ${outFile}`);
}

async function check([file, kindsArg, depthArg = '18', writeFlag]) {
  const depth = Number(depthArg);
  const write = writeFlag === '--write';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sf = await Stockfish.start({ engine: 'full', threads: 6, hash: 512 });
  let changed = 0;
  for (const kind of kindsArg.split(',')) {
    for (const d of data[kind] ?? []) {
      const r = await score(sf, { ...d, kind }, depth);
      const dropped = r.scored.filter((s) => !r.keep.includes(s));
      const flags = [];
      if (!r.ok) flags.push('NO ANSWER SURVIVES');
      if (r.loss < MIN_LOSS) flags.push(`game move loses only ${r.loss}`);
      console.log(
        `${kind} ${d.id}: best ${r.best}, game move ${r.played} (loss ${r.loss}); keep ${r.keep.length}/${r.scored.length}` +
          (dropped.length ? `, drop ${dropped.map((s) => `${s.san} ${s.score}`).join(' ')}` : '') +
          (flags.length ? `  << ${flags.join('; ')}` : '')
      );
      if (write && r.ok) {
        const next = r.keep.map((s) => s.san);
        if (next.join() !== d.accepted.join()) changed++;
        d.accepted = next;
      }
    }
  }
  sf.quit();
  if (write) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`wrote ${file}: ${changed} drills changed`);
  }
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'vet') await vet(args);
else if (mode === 'check') await check(args);
else console.error('usage: verify-drills.mjs vet|check ...');
