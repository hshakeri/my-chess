// Tactics deck, last step: spread the quiet control positions (tactics-quiet.mjs) through the deck's
// middle tier (forks and checks), so they come up once the first tier is under way and never two in
// a row, and write the deck.
//
//   node tactics-merge.mjs <deck.json> <quiet.json> <out.json>
import fs from 'node:fs';

const [deckFile, quietFile, outFile] = process.argv.slice(2);
const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8')).filter((t) => t.motif !== 'quiet');
const quiet = JSON.parse(fs.readFileSync(quietFile, 'utf8')).map(({ cost, ...t }) => t);
const middle = deck.map((t, i) => ['fork', 'check'].includes(t.motif) ? i : -1).filter((i) => i >= 0);
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
console.error(`${out.length} positions: ${deck.length} tactics and ${quiet.length} quiet`);
