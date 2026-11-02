/**
 * The codes of the lessons, exercises, positions from hoot65's games, tactics and worksheets
 * (src/curriculum/itemCodes.ts), and the list of the mastered ones, which the book and the app leave out.
 *
 *   npm run codes                       gives a code to every item that has none yet (a new lesson, new tactics)
 *   npm run codes -- master L12 T40     marks codes as mastered: the next book and the app leave them out
 *   npm run codes -- restore L12        takes a code off the mastered list
 *   npm run codes -- list [L|E|G|T|W]   prints every code with what it names, the mastered ones marked
 *
 * New codes follow on from the highest of their kind. No code is renumbered or given to another item:
 * an item that leaves the curriculum keeps its code in src/data/item_codes.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { allCurriculumLessons } from '../src/curriculum';
import { inPatternOrder } from '../src/curriculum/patternPath';
import { isGameDrill } from '../src/curriculum/gameDrills';
import { MOTIF_LABEL, tacticsDeck } from '../src/services/tacticsDeck';
import { allWorksheets } from '../src/curriculum/worksheetsData';
import { CODE_PREFIX, type CodeKind, type CodeRegistry } from '../src/curriculum/itemCodes';

const CODES_FILE = resolve(process.cwd(), 'src/data/item_codes.json');
const MASTERED_FILE = resolve(process.cwd(), 'src/data/mastered.json');
const KINDS = Object.keys(CODE_PREFIX) as CodeKind[];

interface Item {
  kind: CodeKind;
  id: string;
  name: string;
}

/** Every item, in the book's order: the study path, the lessons off it, the pattern library, then the tactics deck and the worksheets. */
function items(): Item[] {
  const core = allCurriculumLessons.filter((l) => l.relevance !== 'outside-repertoire');
  const lessons = [
    ...inPatternOrder(core.filter((l) => l.category !== 'fundamentals')),
    ...core.filter((l) => l.category === 'fundamentals'),
    ...allCurriculumLessons.filter((l) => l.relevance === 'outside-repertoire'),
  ];
  const side = (color: string) => (color === 'black' ? 'Black' : color === 'both' ? 'both sides' : 'White');
  const out: Item[] = lessons.map((l) =>
    isGameDrill(l.id)
      ? { kind: 'game', id: l.id, name: `${l.title}: ${l.subtitle ?? ''}` }
      : { kind: 'lesson', id: l.id, name: `${l.title} (you play ${side(l.targetColor)})` }
  );
  for (const l of lessons) l.exercises.forEach((ex, k) => out.push({ kind: 'exercise', id: ex.id, name: `${l.title}, exercise ${k + 1}${ex.title ? `: ${ex.title}` : ''}` }));
  for (const t of tacticsDeck) out.push({ kind: 'tactic', id: t.id, name: `${MOTIF_LABEL[t.motif]}, from your game of ${t.date}` });
  for (const w of allWorksheets) if (w.id) out.push({ kind: 'worksheet', id: w.id, name: `${w.title}: ${w.subtitle}` });
  return out;
}

const readJson = <T>(file: string, empty: T): T => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return empty;
  }
};
const order = (a: string, b: string) => KINDS.findIndex((k) => CODE_PREFIX[k] === a[0]) - KINDS.findIndex((k) => CODE_PREFIX[k] === b[0]) || Number(a.slice(1)) - Number(b.slice(1));

const registry = readJson<CodeRegistry>(CODES_FILE, { lesson: {}, exercise: {}, game: {}, tactic: {}, worksheet: {} });
const mastered = readJson<Record<string, string>>(MASTERED_FILE, {});
const all = items();
const nameOf = new Map<string, string>();
for (const item of all) {
  const code = registry[item.kind][item.id];
  if (code) nameOf.set(code, item.name);
}
const known = new Set(KINDS.flatMap((k) => Object.values(registry[k])));

function assign(): void {
  const added: string[] = [];
  for (const item of all) {
    if (registry[item.kind][item.id]) continue;
    const next = 1 + Math.max(0, ...Object.values(registry[item.kind]).map((c) => Number(c.slice(1))));
    const code = `${CODE_PREFIX[item.kind]}${next}`;
    registry[item.kind][item.id] = code;
    added.push(`${code}  ${item.name}`);
  }
  if (!added.length) {
    console.log(`Every item has its code (${known.size} codes).`);
    return;
  }
  writeFileSync(CODES_FILE, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`${added.length} new code${added.length === 1 ? '' : 's'}:\n${added.join('\n')}`);
}

/** The codes named on the command line, upper-cased, commas allowed; stops on one that names nothing. */
function codesOf(args: string[]): string[] {
  const codes = args.flatMap((a) => a.split(',')).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const unknown = codes.filter((c) => !known.has(c));
  if (unknown.length) throw new Error(`No item has the code ${unknown.join(', ')}. \`npm run codes -- list\` prints them all.`);
  if (!codes.length) throw new Error('Name the codes, for example: npm run codes -- master L12 T40');
  return codes;
}

function writeMastered(): void {
  const sorted = Object.fromEntries(Object.keys(mastered).sort(order).map((c) => [c, mastered[c]]));
  writeFileSync(MASTERED_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

const [command = 'assign', ...args] = process.argv.slice(2);
if (command === 'assign') {
  assign();
} else if (command === 'master') {
  const today = new Date().toLocaleDateString('en-CA');
  for (const code of codesOf(args)) {
    console.log(`${code}  ${nameOf.get(code) ?? '(no longer in the curriculum)'}${mastered[code] ? `: already mastered on ${mastered[code]}` : ''}`);
    mastered[code] ??= today;
  }
  writeMastered();
  console.log('Left out of the book from its next build (npm run book, then npm run book:pdf), and of the app once published.');
} else if (command === 'restore') {
  for (const code of codesOf(args)) {
    console.log(`${code}  ${nameOf.get(code) ?? '(no longer in the curriculum)'}${mastered[code] ? '' : ': was not on the mastered list'}`);
    delete mastered[code];
  }
  writeMastered();
} else if (command === 'list') {
  const prefix = (args[0] ?? '').toUpperCase();
  for (const code of [...known].filter((c) => c.startsWith(prefix)).sort(order)) {
    console.log(`${code.padEnd(5)} ${nameOf.get(code) ?? '(no longer in the curriculum)'}${mastered[code] ? `  [mastered ${mastered[code]}]` : ''}`);
  }
} else {
  throw new Error(`Unknown command "${command}": use master, restore or list, or nothing to give new items their codes.`);
}
