// Download every monthly archive of a Chess.com player into <outDir>/YYYY-MM.json.
// Months already on disk are kept, except the latest one, which is fetched again.
import fs from 'node:fs';
import path from 'node:path';
const [user = 'hoot65', outDir = 'data/raw'] = process.argv.slice(2);
const UA = { 'User-Agent': 'my-chess game analysis (personal use)' };
fs.mkdirSync(outDir, { recursive: true });
const list = await (await fetch(`https://api.chess.com/pub/player/${user}/games/archives`, { headers: UA })).json();
const archives = list.archives ?? [];
for (const [i, url] of archives.entries()) {
  const [y, m] = url.split('/').slice(-2);
  const file = path.join(outDir, `${y}-${m}.json`);
  if (fs.existsSync(file) && i < archives.length - 1) continue;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(file, await res.text());
  await new Promise((r) => setTimeout(r, 300));
}
const total = fs.readdirSync(outDir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).reduce((n, f) => n + JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')).games.length, 0);
console.log(`${archives.length} months, ${total} games in ${outDir}`);
