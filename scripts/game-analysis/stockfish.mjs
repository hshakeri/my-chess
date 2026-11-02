// A small UCI client for Stockfish (the `stockfish` npm package, WASM) in Node: one engine process,
// one search at a time. Used by the engine audit (scripts/engine-audit.ts) and the analysis scripts.
//
//   const sf = await Stockfish.start({ engine: 'full', threads: 6 });
//   const { score, pv } = await sf.analyse(fen, { depth: 18 });            // best line
//   const { score } = await sf.analyse(fen, { depth: 18, searchmoves: ['e2e4'] });  // one move
//   sf.quit();
//
// Scores are centipawns from the side to move; a mate in n is ±(MATE - n).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

export const MATE = 100000;

export class Stockfish {
  /** `engine`: a keyword of the stockfish package ('full', 'lite', 'single', 'lite-single') or a path. */
  static async start({ engine = 'full', threads = 6, hash = 256, enginePath } = {}) {
    const require = createRequire(import.meta.url);
    const path = enginePath ?? process.env.STOCKFISH_JS ?? require('stockfish').findEngine(engine);
    const sf = new Stockfish(spawn(process.execPath, [path], { stdio: 'pipe' }));
    await sf.command('uci', (l) => l === 'uciok');
    sf.send(`setoption name Threads value ${threads}`);
    sf.send(`setoption name Hash value ${hash}`);
    await sf.command('isready', (l) => l === 'readyok');
    return sf;
  }

  constructor(child) {
    this.child = child;
    this.buffer = '';
    this.listener = null;
    child.stdout.on('data', (data) => {
      this.buffer += data.toString();
      let i;
      while ((i = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, i).trim();
        this.buffer = this.buffer.slice(i + 1);
        this.listener?.(line);
      }
    });
  }

  send(cmd) {
    this.child.stdin.write(`${cmd}\n`);
  }

  /** Send `cmd` and resolve with the lines read until `done(line)` is true. */
  command(cmd, done) {
    return new Promise((resolve) => {
      const lines = [];
      this.listener = (line) => {
        lines.push(line);
        if (done(line)) {
          this.listener = null;
          resolve(lines);
        }
      };
      this.send(cmd);
    });
  }

  /**
   * Search `fen` to `depth` (or for `movetime` ms) and return the deepest score and principal
   * variation of the first line, or of every line with `multipv` > 1. `searchmoves` restricts the
   * root to those UCI moves, which scores one move at the same depth as the best.
   */
  async analyse(fen, { depth = 18, movetime, multipv = 1, searchmoves } = {}) {
    if (multipv > 1) this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    const go = `go ${movetime ? `movetime ${movetime}` : `depth ${depth}`}${searchmoves?.length ? ` searchmoves ${searchmoves.join(' ')}` : ''}`;
    const lines = await this.command(go, (l) => l.startsWith('bestmove'));
    if (multipv > 1) this.send('setoption name MultiPV value 1');
    const byPv = new Map();
    for (const line of lines) {
      if (!line.startsWith('info') || !line.includes(' pv ')) continue;
      const pvIndex = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1);
      const mate = / score mate (-?\d+)/.exec(line);
      const cp = / score cp (-?\d+)/.exec(line);
      const lowerOrUpper = / (lowerbound|upperbound)/.test(line);
      if (lowerOrUpper) continue;
      const score = mate ? (Number(mate[1]) > 0 ? MATE - Number(mate[1]) : -MATE - Number(mate[1])) : Number(cp[1]);
      byPv.set(pvIndex, { score, depth: Number(/ depth (\d+)/.exec(line)[1]), pv: line.split(' pv ')[1].split(' ') });
    }
    const results = [...byPv.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    const bestmove = lines[lines.length - 1].split(' ')[1];
    return multipv > 1 ? { lines: results, bestmove } : { ...results[0], bestmove };
  }

  quit() {
    this.send('quit');
    setTimeout(() => this.child.kill(), 500).unref();
  }
}
