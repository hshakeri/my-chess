// Drill positions from hoot65's recent games, for the app's three drill sets:
//   threat: the opponent's last move attacked a piece (a minor piece or more) and hoot65 left it there;
//   free:   an enemy piece could be won and hoot65 did not take it;
//   hang:   nothing of either side was in danger, and hoot65's move put a piece where it can be taken.
// Every legal move of a candidate is scored with a material search (captures are followed until the
// position is quiet). A threat drill accepts the moves that keep the material balance and answer the
// threat: the piece is safe afterwards, or the move captures or gives check (a quiet move that leaves
// the piece hanging is not accepted even when a deeper trick saves it). A free drill accepts the moves
// that win as much as the best one; all of them must be captures and one must take the free piece,
// otherwise the position is not used. A hang drill accepts the moves that keep the material balance
// and leave nothing of hoot65's where it can be taken (or capture, or give check). The move played
// must come out at least two pawns worse.
// Accepted moves and the move played are checked again one ply deeper, and the drill keeps only the
// moves that pass.
//
//   node drills.mjs scan games.jsonl features.csv drills-0.json 120 0 7   (days, shard, number of shards)
//   node drills.mjs pick game_drills.json 12 drills-*.json                (drills per set, newest first)
import fs from 'node:fs';
import { Chess } from 'chess.js';

const V = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
const MATE = 100000;
const DEPTH = 2; // plies after the candidate move before the capture search
const CONFIRM_DEPTH = 3;
const MIN_LOSS = 200;
const other = (c) => (c === 'w' ? 'b' : 'w');
const dest = (san) => (san.match(/[a-h][1-8]/g) || []).pop();

/**
 * Pieces of `color` (a minor piece or more) the other side could win now: undefended, or attacked by
 * something cheaper. A king can only take a piece that nothing defends.
 */
function enPrise(chess, color) {
  const out = [];
  for (const row of chess.board()) for (const pc of row) {
    if (!pc || pc.color !== color || pc.type === 'k' || pc.type === 'p') continue;
    const def = chess.attackers(pc.square, color);
    const att = chess.attackers(pc.square, other(color)).filter((s) => !(def.length && chess.get(s).type === 'k'));
    if (!att.length) continue;
    const minAtt = Math.min(...att.map((s) => V[chess.get(s).type]));
    const gain = !def.length ? V[pc.type] : minAtt < V[pc.type] ? V[pc.type] - minAtt : 0;
    if (gain >= 200) out.push({ square: pc.square, type: pc.type, gain, defended: def.length > 0 });
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/** Material from the side to move's point of view. */
function material(chess) {
  let s = 0;
  const me = chess.turn();
  for (const row of chess.board()) for (const pc of row) if (pc) s += (pc.color === me ? 1 : -1) * V[pc.type];
  return s;
}

function victim(chess, san) {
  if (!san.includes('x')) return san.includes('=') ? 1 : 0;
  const pc = chess.get(dest(san));
  return pc ? V[pc.type] : V.p;
}

const order = (chess, moves) => moves.map((m) => [m, victim(chess, m)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);

function quiesce(chess, alpha, beta, qdepth) {
  const moves = chess.moves();
  if (moves.length === 0) return chess.inCheck() ? -MATE : 0;
  const inCheck = chess.inCheck();
  let best = -Infinity;
  if (!inCheck) {
    best = material(chess);
    if (best >= beta || qdepth <= 0) return best;
    if (best > alpha) alpha = best;
  } else if (qdepth <= 0) return material(chess);
  const cand = inCheck ? order(chess, moves) : order(chess, moves.filter((m) => m.includes('x') || m.includes('=')));
  for (const m of cand) {
    chess.move(m);
    const sc = -quiesce(chess, -beta, -alpha, qdepth - 1);
    chess.undo();
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  return best;
}

function search(chess, depth, alpha, beta) {
  const moves = chess.moves();
  if (moves.length === 0) return chess.inCheck() ? -MATE - depth : 0;
  if (depth === 0) return quiesce(chess, alpha, beta, 8);
  let best = -Infinity;
  for (const m of order(chess, moves)) {
    chess.move(m);
    const sc = -search(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  return best;
}

/** Exact score of one move, from the mover's point of view. */
function scoreOf(fen, san, depth = DEPTH) {
  const chess = new Chess(fen);
  chess.move(san);
  return -search(chess, depth, -Infinity, Infinity);
}

/** Whether `san` scores at least `threshold` (a null-window test; scores are whole centipawns). */
function reaches(fen, san, threshold, depth = DEPTH) {
  const chess = new Chess(fen);
  chess.move(san);
  return -search(chess, depth, -threshold, -threshold + 1) >= threshold;
}

/**
 * The capture that punishes `played` and the square of the piece it takes, in order: the game's reply
 * when it took one of the pieces on `squares` (earlier squares first), the best reply that takes one,
 * the game's reply when it captured something else, the best capture.
 */
function punishment(fen, played, squares, reply) {
  const after = new Chess(fen);
  after.move(played);
  const takes = (m, sq) => !!m && m.includes('x') && dest(m) === sq;
  for (const sq of squares) if (takes(reply, sq)) return { refutation: reply, refutationPlayed: true, square: sq };
  const bestReplies = bestMoves(after.fen()).moves;
  for (const sq of squares) {
    const best = bestReplies.find((m) => takes(m, sq));
    if (best) return { refutation: best, refutationPlayed: false, square: sq };
  }
  if (reply && reply.includes('x')) return { refutation: reply, refutationPlayed: true, square: squares[0] };
  return { refutation: bestReplies.find((m) => m.includes('x')) ?? null, refutationPlayed: false, square: squares[0] };
}

/** The best score in `fen` and the moves that reach it (null-window tests against the best so far). */
function bestMoves(fen) {
  const chess = new Chess(fen);
  let best = -Infinity;
  let moves = [];
  for (const m of order(chess, chess.moves())) {
    chess.move(m);
    let sc = best === -Infinity ? -search(chess, DEPTH, -Infinity, Infinity) : -search(chess, DEPTH, -best, -best + 1);
    if (best !== -Infinity && sc >= best) sc = -search(chess, DEPTH, -Infinity, Infinity);
    chess.undo();
    if (sc > best) { best = sc; moves = [m]; }
    else if (sc === best) moves.push(m);
  }
  return { best, moves };
}

function scan([gamesFile, featuresFile, outFile, daysArg = '120', shardArg = '0', nShardsArg = '1']) {
  const DAYS = Number(daysArg), SHARD = Number(shardArg), NSHARDS = Number(nShardsArg);
  // Maia's expected score before each of hoot65's moves (features.csv): drills come from open games
  const wpBefore = new Map();
  const lines = fs.readFileSync(featuresFile, 'utf8').split('\n');
  const cols = lines[0].split(',');
  const ig = cols.indexOf('g'), ip = cols.indexOf('ply'), im = cols.indexOf('mover'), iw = cols.indexOf('wpBefore');
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i].split(',');
    if (r[im] === 'H' && r[iw] !== '') wpBefore.set(Number(r[ig]) * 1000 + Number(r[ip]), Number(r[iw]));
  }
  const games = fs.readFileSync(gamesFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const lastEnd = Math.max(...games.map((g) => g.end));
  const recent = games
    .map((g, gi) => ({ g, gi }))
    .filter(({ g, gi }) => g.end >= lastEnd - DAYS * 86400 && g.tc !== 'daily' && gi % NSHARDS === SHARD);

  const found = [];
  const t0 = Date.now();
  for (const { g, gi } of recent) {
    for (let p = 1; p < g.san.length; p++) {
      const fen = g.fens[p];
      const chess = new Chess(fen);
      if (chess.turn() !== g.me || chess.inCheck()) continue;
      if (chess.moves().some((m) => m.endsWith('#'))) continue; // mate in one is a different drill
      const wp = wpBefore.get(gi * 1000 + p);
      if (wp === undefined || wp < 0.15 || wp > 0.85) continue;
      const last = new Chess(g.fens[p - 1]).move(g.san[p - 1]);
      const wasAttacked = enPrise(new Chess(g.fens[p - 1]), g.me).map((t) => t.square);
      const inDanger = enPrise(chess, g.me);
      const threats = last.captured ? [] : inDanger.filter((t) => !wasAttacked.includes(t.square));
      const frees = enPrise(chess, other(g.me));
      const quiet = inDanger.length === 0 && frees.length === 0;
      if (!threats.length && !frees.length && !quiet) continue;
      const played = g.san[p];
      // Cheap test first (the rules of features.mjs): the move played left the attacked piece where
      // it can be taken, did not take the free piece, or (in a quiet position) put a piece in danger
      const after = new Chess(fen);
      const mv = after.move(played);
      const capVal = mv.captured ? V[mv.captured] : 0;
      const dangerAfter = enPrise(after, g.me);
      const hangAfter = dangerAfter.map((h) => h.square);
      const leftThreat = threats.filter((t) => hangAfter.includes(t.square) && capVal < t.gain);
      const skippedFree = frees.filter((f) => capVal < f.gain && mv.to !== f.square);
      const leftHanging = quiet ? dangerAfter.filter((h) => capVal < h.gain) : [];
      if (!leftThreat.length && !skippedFree.length && !leftHanging.length) continue;

      const base = material(chess);
      const { best, moves: bestSet } = bestMoves(fen);
      if (Math.abs(best) >= MATE / 2) continue; // a forced mate is a different drill
      const playedScore = scoreOf(fen, played);
      const common = {
        gameIndex: gi, url: g.url, end: g.end, date: new Date(g.end * 1000).toISOString().slice(0, 10),
        opponent: g.opp, color: g.me === 'w' ? 'white' : 'black', ply: p, fenBefore: g.fens[p - 1], lastSan: g.san[p - 1],
        played, reply: g.san[p + 1] ?? null, base, best, playedScore, wp: +wp.toFixed(3),
      };

      // Threat: every move that keeps the balance is right; one of them must leave the piece safe
      const t = leftThreat[0];
      if (t && best >= base - 50 && playedScore <= base - MIN_LOSS) {
        const safeAfter = (m) => {
          const c = new Chess(fen);
          const r = c.move(m);
          const sq = r.from === t.square ? r.to : t.square;
          return !enPrise(c, g.me).some((x) => x.square === sq);
        };
        const answers = (m) => safeAfter(m) || m.includes('x') || m.includes('+');
        const accepted = new Chess(fen)
          .moves()
          .filter(answers)
          .filter((m) => reaches(fen, m, base - 50))
          .filter((m) => reaches(fen, m, base - 50, CONFIRM_DEPTH));
        const confirmedLoss = !reaches(fen, played, base - MIN_LOSS + 1, CONFIRM_DEPTH);
        const safe = accepted.filter(safeAfter);
        if (safe.length && confirmedLoss) {
          const { refutation, refutationPlayed } = punishment(fen, played, [mv.from === t.square ? mv.to : t.square], common.reply);
          // Main answer: a move that leaves the piece safe, preferring a move of the piece itself
          const main = safe.find((m) => new Chess(fen).move(m).from === t.square) ?? safe[0];
          found.push({
            ...common, kind: 'threat', target: t.square,
            accepted: [main, ...accepted.filter((m) => m !== main)],
            refutation, refutationPlayed,
          });
        }
      }

      // Free: the best moves win at least two pawns, and one of them takes the free piece
      const f = skippedFree.find((x) => bestSet.some((m) => m.includes('x') && dest(m) === x.square));
      if (f && best >= base + 200 && best - playedScore >= MIN_LOSS) {
        const accepted = bestSet.filter((m) => reaches(fen, m, best - 50, CONFIRM_DEPTH));
        const confirmedLoss = !reaches(fen, played, best - MIN_LOSS + 1, CONFIRM_DEPTH);
        const takes = accepted.filter((m) => m.includes('x') && dest(m) === f.square);
        if (takes.length && confirmedLoss && bestSet.every((m) => m.includes('x'))) {
          found.push({ ...common, kind: 'free', target: f.square, accepted: [takes[0], ...accepted.filter((m) => m !== takes[0])] });
        }
      }

      // Hang: nothing was in danger, and the move played put a piece where it can be taken. Every
      // move that keeps the balance and leaves nothing in danger (or captures, or checks) is right
      if (leftHanging.length && best >= base - 50 && playedScore <= base - MIN_LOSS) {
        const answers = (m) => {
          const c = new Chess(fen);
          c.move(m);
          return enPrise(c, g.me).length === 0 || m.includes('x') || m.includes('+');
        };
        const accepted = new Chess(fen)
          .moves()
          .filter(answers)
          .filter((m) => reaches(fen, m, base - 50))
          .filter((m) => reaches(fen, m, base - 50, CONFIRM_DEPTH));
        const confirmedLoss = !reaches(fen, played, base - MIN_LOSS + 1, CONFIRM_DEPTH);
        // The drill names the piece the punishing capture takes, so that capture must take one of them
        const { refutation, refutationPlayed, square } = punishment(fen, played, leftHanging.map((x) => x.square), common.reply);
        const caught = !!refutation && refutation.includes('x') && dest(refutation) === square;
        if (accepted.length && confirmedLoss && caught) {
          // Main answer: the piece moved in the game, to a square where it is safe, when it can
          const main = accepted.find((m) => new Chess(fen).move(m).from === mv.from) ?? accepted[0];
          found.push({
            ...common, kind: 'hang', target: square,
            accepted: [main, ...accepted.filter((m) => m !== main)],
            refutation, refutationPlayed,
          });
        }
      }
    }
  }
  console.error(`shard ${SHARD}: ${recent.length} games in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${found.length} drills`);
  fs.writeFileSync(outFile, JSON.stringify(found, null, 1));
}

/** Newest first, one drill per game and set, and each position in one set (free, then threat, then hang). */
function pick([outFile, perSetArg = '12', ...inFiles]) {
  const perSet = Number(perSetArg);
  const all = inFiles.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8'))).sort((a, b) => b.end - a.end || b.ply - a.ply);
  const keysOf = (kind) => new Set(all.filter((d) => d.kind === kind).map((d) => `${d.url}#${d.ply}`));
  const freeKeys = keysOf('free');
  const threatKeys = keysOf('threat');
  const out = { threat: [], free: [], hang: [] };
  for (const d of all) {
    const set = out[d.kind];
    const key = `${d.url}#${d.ply}`;
    if (set.length >= perSet || set.some((x) => x.url === d.url)) continue;
    if (d.kind !== 'free' && freeKeys.has(key)) continue;
    if (d.kind === 'hang' && threatKeys.has(key)) continue;
    const drill = {
      id: `${d.kind}-${d.url.split('/').pop()}-${d.ply}`,
      url: d.url, date: d.date, opponent: d.opponent, color: d.color,
      fenBefore: d.fenBefore, lastSan: d.lastSan, played: d.played, accepted: d.accepted, target: d.target,
    };
    if (d.kind === 'free') drill.reply = d.reply;
    else Object.assign(drill, { refutation: d.refutation, refutationPlayed: d.refutationPlayed });
    set.push(drill);
  }
  const dates = [...out.threat, ...out.free, ...out.hang].map((d) => d.date).sort();
  fs.writeFileSync(
    outFile,
    JSON.stringify({ source: 'hoot65 Chess.com archive', from: dates[0], to: dates[dates.length - 1], ...out }, null, 2) + '\n'
  );
  console.error(`threat ${out.threat.length}, free ${out.free.length}, hang ${out.hang.length} (of ${all.length})`);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'scan') scan(args);
else if (mode === 'pick') pick(args);
else throw new Error('usage: node drills.mjs scan|pick ...');
