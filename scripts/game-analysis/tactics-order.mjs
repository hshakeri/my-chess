// Tactics deck: the order new positions come up in. Tiers follow the study path (pieces to take and
// mates in one, then forks and checks, then longer mates, promotions and combinations); within a tier
// the wins hoot65 missed in their own games come first, then the easiest by Maia's share. The control
// positions are taken out and go back with tactics-merge.mjs (quiet to the middle tier, keep-the-lead
// to the last).
//
//   node tactics-order.mjs <deck.json> <quiet out.json> <lead out.json>   (rewrites the deck)
import fs from 'node:fs';
const [deckFile, quietOut, leadOut] = process.argv.slice(2);
const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
const TIER = { 'free-piece': 0, 'mate-in-one': 0, fork: 1, check: 1, mate: 2, promotion: 2, other: 2 };
const missed = (t) => t.ownSide && t.played !== t.solution && !t.accepted.includes(t.played);
const tactics = deck.filter((t) => t.motif in TIER);
tactics.sort((a, b) => TIER[a.motif] - TIER[b.motif] || Number(missed(b)) - Number(missed(a)) || (b.share ?? 0) - (a.share ?? 0));
fs.writeFileSync(deckFile, JSON.stringify(tactics, null, 1) + '\n');
fs.writeFileSync(quietOut, JSON.stringify(deck.filter((t) => t.motif === 'quiet'), null, 1) + '\n');
fs.writeFileSync(leadOut, JSON.stringify(deck.filter((t) => t.motif === 'lead'), null, 1) + '\n');
console.error(`${tactics.length} tactics ordered (${tactics.filter(missed).length} missed in the game first in their tiers)`);
