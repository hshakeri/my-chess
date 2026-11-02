// Tactics deck, last step: spread control positions (tactics-quiet.mjs, tactics-lead.mjs) through a
// tier of the deck, so they come up once the earlier tiers are under way and never two in a row, and
// write the deck. The quiet ones go to the middle tier (forks and checks), the keep-the-lead ones to
// the last (longer mates, promotions, combinations). Positions of the same kind already in the deck
// are replaced.
//
//   node tactics-merge.mjs <deck.json> <extra.json> <out.json> [tier motifs=fork,check]
import fs from 'node:fs';

const [deckFile, quietFile, outFile, tierArg = 'fork,check'] = process.argv.slice(2);
const quiet = JSON.parse(fs.readFileSync(quietFile, 'utf8')).map(({ cost, game, ...t }) => ({ ...t, share: null, game }));
const kind = quiet[0]?.motif;
const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8')).filter((t) => t.motif !== kind);
const tierMotifs = tierArg.split(',');
const middle = deck.map((t, i) => tierMotifs.includes(t.motif) ? i : -1).filter((i) => i >= 0);
if (!middle.length) throw new Error('no middle tier');
const first = middle[0];
const span = middle[middle.length - 1] - first + 1;
const out = deck.slice(0, first);
const tier = deck.slice(first, first + span);
const step = Math.max(1, Math.floor(tier.length / Math.max(1, quiet.length)));
let q = 0;
tier.forEach((t, k) => {
  out.push(t);
  if ((k + 1) % step === 0 && q < quiet.length) out.push(quiet[q++]);
});
while (q < quiet.length) out.push(quiet[q++]);
out.push(...deck.slice(first + span));
fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');
console.error(`${out.length} positions: ${deck.length} before and ${quiet.length} ${kind}`);
