/**
 * Every decision of the core opening lessons (main lines and branches), with the moves that lead to
 * it, as JSON for `scripts/game-analysis/practical-audit.mjs`.
 *
 *   npx tsx scripts/export-decisions.ts decisions.json
 */
import { writeFileSync } from 'node:fs';
import { allCurriculumLessons } from '../src/curriculum';
import { enumerateDecisions } from '../src/curriculum/builder';
import { isGameDrill } from '../src/curriculum/gameDrills';

const out: Array<{ lessonId: string; history: string[]; initialFen: string; answer: string; reach: number }> = [];
for (const l of allCurriculumLessons) {
  if (isGameDrill(l.id) || l.relevance === 'outside-repertoire' || l.category === 'fundamentals') continue;
  for (const d of enumerateDecisions(l)) {
    out.push({ lessonId: l.id, history: d.path, initialFen: l.initialFen, answer: d.acceptedSan[0], reach: d.reachProb });
  }
}
writeFileSync(process.argv[2] ?? 'decisions.json', JSON.stringify(out, null, 1));
console.log(`${out.length} decisions`);
