# Game analysis with the Maia simulator

Finds the simplest changes to hoot65's play that would gain the most points, from the whole
Chess.com archive, weighted toward recent games. It runs offline on a laptop and is not part of the
app build. The results and what they mean are in `docs/game-analysis.md`.

## Method

1. **Download** every monthly archive from the Chess.com public API (`download.mjs`).
2. **Parse** each game into positions, moves and clock times (`parse.mjs`).
3. **Score every position with Maia** (`maia-pass.mjs`), the human-move model the app already uses
   for play. Maia is conditioned on both players' ratings, so its value head gives the expected score
   for players of those ratings. The change in hoot65's expected score across a move is what the move
   cost or gained.
4. **Describe every move** with checks a player can make at the board (`features.mjs`): is a piece
   left where it can be taken, was a threat ignored, was a free piece or a mate in one missed, how
   much time was left and how much was spent.
5. **Learn which situations cost points.** `describe.py` and `endings.py` compare hoot65 with the
   opponents (players of the same rating in the same games) and look at clocks, time losses and
   resignations. `habits.py` fits a context model (game stage, evaluation, material) on both players'
   moves, then a shallow regression tree on what the context cannot explain: its splits are the rules.
6. **Find the better move** (`cands.mjs`, `gains.py`): for every decision of the last year, Maia's six
   likeliest human moves and the expected score after each. A rule's gain is the best of those minus
   the move played, summed where the rule applies, minus the same quantity on quiet moves (taking
   the best of six noisy estimates looks better than the move played even when nothing was wrong).
   `openings.py` does the same for recurring opening positions.
7. **Simulate** (`simlist.py`, `simulate.mjs`, `simsum.py`): from recent positions where a rule
   applied, Maia plays both sides forward at their ratings, once after the move played and once after
   the better move, and the outcomes are compared. The simulated games are independent of the
   estimates that picked the better move, so they also measure the selection bias directly.

8. **Drills** (`drills.mjs`): positions for the app's four drill sets. A threat drill is a position
   where the opponent's last move put a piece (a minor piece or more) in danger and hoot65 left it
   there; a free drill is a position where an enemy piece could be won and was not taken; a hang
   drill is a position where nothing of either side was in danger until hoot65's own move left a
   piece where it could be taken; a mate drill is a position where hoot65's move let the opponent
   give mate at once. The first three sets come from the last 120 days; allowed mates are rarer, so
   their scan reaches back to January 2024. Only positions where the game was still
   open count (Maia between 15% and 85%). Every legal move is scored with a material search (two
   plies, then captures until quiet), and the accepted moves and the move played are checked again
   one ply deeper. A threat drill accepts the moves that keep the material balance and answer the
   threat (the piece is safe afterwards, or the move captures or checks); a free drill accepts the
   moves that win as much as the best one, which must all be captures, one of them of the free
   piece; a hang drill accepts the moves that keep the balance and leave nothing in danger (or
   capture, or check), and the capture that punishes the move played must take the piece it left.
   The move played must come out at least two pawns worse. A mate drill accepts the moves that allow
   no mate in one and keep the balance. `pick` keeps the newest N per set (16 today), one per game, and
   writes `src/data/game_drills.json` (`add` replaces one set and keeps the others);
   `src/curriculum/gameDrills.ts` turns each into a lesson and states only facts it works out from
   the position with chess.js.
9. **Stockfish** (`stockfish.mjs`, `verify-drills.mjs`, `../engine-audit.ts`): Stockfish 19 (the
   `stockfish` npm package, WASM, run with Node; `STOCKFISH_JS` can point at another build) checks
   what the material search and Maia picked. `verify-drills.mjs vet` keeps the scan's candidates
   that make a sound drill by Stockfish's scores: the game still open before hoot65's move (not
   below -2.5 for hoot65), the move played losing at least 1.5 pawns, and at least one accepted move
   within 1.5 pawns of Stockfish's best, or still winning by 3 pawns or more, that does not walk into
   a forced mate (for a free drill, one that takes the free piece). The accepted moves are cut to those, best first, before `pick` or
   `add` chooses. `verify-drills.mjs check` runs the same test on `src/data/game_drills.json`. The engine audit
   (`npx tsx scripts/engine-audit.ts [depth] [out.json] [lesson-id-prefix]` from the repository)
   scores every answer, alternative, warned-against move and exercise of the curriculum against
   Stockfish's best move and lists the ones that give away too much. Before a lesson move is changed,
   `practical.mjs` scores each candidate twice: by Stockfish against the best reply, and against the
   replies Maia expects from players of hoot65's rating (each reply weighted by Maia's share and
   scored by Stockfish, as centipawns and as an expected score on the Lichess curve). A lesson move
   is replaced when another move is clearly better against best play and no worse, within two
   points of expected score, against the likely replies; or, as a second rule, when it scores at
   least five points better against the likely replies and no more than 0.3 pawns worse against best
   play (a sound move that sets a trap most opponents fall into). `practical-audit.mjs` runs both
   tests on every decision of the opening lessons (`npx tsx scripts/export-decisions.ts` writes them
   out) against Stockfish's two best other moves. `sf-lines.mjs` prints Stockfish's best lines for a
   list of positions and `maia-policy.mjs` Maia's move shares.
10. **King and pawn against king** (`kpk-solve.mjs`): an exact retrograde solver of the ending (White
   has the pawn), with Stockfish's bitbase rule for a safe promotion. `solve()` returns, for every
   position and side to move, whether White wins and in how many plies with best play (White
   fastest, Black slowest); everything not proved won is a draw. It runs in under a second and is
   used to check the archive's king-and-pawn endings and any lesson position of that ending.

Weights: a game's weight halves every 180 days (`HALF_LIFE` environment variable).
Ratings: Maia is trained on Lichess games, so Chess.com ratings get +400 before they reach Maia
(`maia-pass.mjs`, `cands.mjs`, `simlist.py`). That is an assumption; it moves the absolute expected
scores more than the comparisons between moves.

## Running

From this folder:

```bash
npm install
uv venv .venv && uv pip install -r requirements.txt
node download.mjs hoot65 data/raw
node parse.mjs data/raw games.jsonl
node maia-pass.mjs games.jsonl 0 2 pass1-0.jsonl 400 & node maia-pass.mjs games.jsonl 1 2 pass1-1.jsonl 400 & wait
./run-features.sh
.venv/bin/python describe.py && .venv/bin/python endings.py && .venv/bin/python habits.py
.venv/bin/python pass2list.py && node cands.mjs games.jsonl pass2-list.json pass2.json 6 400
.venv/bin/python gains.py && .venv/bin/python openings.py
.venv/bin/python simlist.py 'hang3,ignoredThreat,missedFree,allowMate1,!quiet' 80
node simulate.mjs sim-starts.json sim-out.json 12 14 1 && .venv/bin/python simsum.py && .venv/bin/python table.py
for i in 0 1 2 3 4 5 6; do node drills.mjs scan games.jsonl features.csv drills-$i.json 120 $i 7 & done; wait
node drills.mjs pick ../../src/data/game_drills.json 12 drills-*.json
```

On an 8-core laptop the Maia pass over 230,000 positions takes about 20 minutes, the candidate
pass and the simulation about 15 minutes each, and the drill scan about 8 minutes.
