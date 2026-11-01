# Hand-off prompt for continuing `my-chess` in another coding assistant

Copy everything below the line into a new session (Codex or similar) opened in a clone of
`https://github.com/hshakeri/my-chess` on the `main` branch.

---

You are continuing work on **my-chess**, a 100% client-side chess coach for the Chess.com player
**hoot65** (about 1150 rapid). Read `docs/pedagogy-audit.md` first (Sections 1, 7, 8 and the two
status notes near the top), then `docs/handoff-prompt.md` (this file). The app is deployed by the
GitHub Actions workflow in `.github/workflows/deploy.yml` to https://hshakeri.github.io/my-chess/
on every push to `main`.

## Stack and hard constraints

- React 18 + Vite 6 + TypeScript (strict) + Tailwind; chess.js 1.4; Dexie 4 (IndexedDB); ts-fsrs 5
  for scheduling; maia3-js + onnxruntime-web in a Web Worker for the human-like engine.
- Tests: Vitest (`npm test`, 340 tests: SSR `renderToString` specs, jsdom interaction specs under
  `tests/unit/curriculum/lessons-view-interactions.spec.tsx`, fake-indexeddb for the database) and
  Playwright (`npm run test:e2e`, 79 tests incl. iPhone-viewport tests). Keep both green or update
  tests deliberately and say why.
- `npm run build` must pass (`tsc && vite build`). Base path is `/my-chess/`.
- Never commit a PDF: `.gitignore` excludes `*.pdf` and `book/`; run `git ls-files "*.pdf"` before
  every commit and expect no output. The printable lesson book is generated at deploy time
  (`npm run book` writes `book/lesson-book.html`, `npm run book:pdf` renders it) and served at
  https://hshakeri.github.io/my-chess/book/lesson-book.pdf.
- Every lesson FEN and move is validated by `buildVerifiedLesson` in `src/curriculum/builder.ts`;
  never claim a chess fact in lesson text that you did not replay with chess.js.
- Lesson titles never print the answer. Opponent branches use `alternatives` on opponent moves with
  `frequency` taken from `src/data/seed_hoot65_games.json` (301 real games).
- Work on a feature branch, commit with clear messages, fast-forward `main` to publish.

## What exists today

- **Play vs Maia** (worker engine with opening book, Maia neural net, heuristic fallback; a
  main-thread fallback answers within 4 s if the worker is slow). Phone layout has an engine strip
  above the board.
- **Game Database**: Chess.com sync, PGN upload, replay, JSON export/import (schema v2 with FSRS
  cards and review log).
- **Opening Diagnostics** (`src/analytics/diagnostics.ts`, `repertoire.ts`): measured habit
  detectors (Scandinavian 2.e5, early queen sortie, ...Bg4 aftermath, Blackburne-Shilling
  handling, mated/lost on time while ahead), repertoire trees for both colours with first-divergence
  detection ("Where you leave the repertoire"), "Practice this" (one-decision drill from a deviation
  via `src/curriculum/factories.ts`) and "Adopt Repertoire".
- **Interactive Lessons** (`src/views/LessonsView.tsx`): branching lessons, lesson tree beside the
  board (click a node to jump there), hint ladder theme/piece/square, refutation playback on
  mistakes, exercises, per-decision FSRS cards (`src/services/cards.ts`, `sessionQueue.ts`,
  `fenKey.ts`) with inferred ratings, "Due today" review sessions. Phone: lesson picker above the
  board. The default list ("My Lessons") is the study path in `src/curriculum/patternPath.ts`:
  two drill sets from hoot65's own games, then the 15 core lessons in five groups, each group
  repeating one pattern and headed by the check that catches it; the phone picker and Part I of the
  lesson book use the same order.
- **Printable Worksheets** and the generated **lesson book** (`scripts/lesson-book.ts`).

## Maintainer decisions already taken (do not reopen)

1. 4.b4 (Evans Gambit) is the book move after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5.
2. Against 1.d4 Black plays the c6-d5 wall (Slav vs 2.c4, Caro-style vs the London), not the
   King's Indian.
3. Off-repertoire trap lessons stay as a hidden Pattern Library (`relevance: 'outside-repertoire'`).
4. No page references in book attributions (chapter names only).
5. Scheduler is FSRS, not SM-2.

## The opening study order (from hoot65's 301 games; score = wins + half draws)

Build lesson content and drills in this order. Each item names the line, the evidence and what
"done" means.

As White (1.e4):
1. Italian, Evans Gambit after 3...Bc5 (7 games, 86%): already a full lesson with branches. Done
   when the 4.b4 Bxb4 5.c3 lines are drilled and the Bb6 retreat branch is covered.
2. Italian vs 3...h6 (16 games, 50%) and 3...Nf6 Two Knights (12 games, 50%): branches exist in the
   Evans lesson (4.d4/4.c3 vs ...h6, 4.d3 vs ...Nf6). Done when each has 3-4 student decisions with
   annotations and an exercise.
3. Anti-Scandinavian 2.exd5 (17 games, 47%; 2.e5 played in 15): drill exists. Done when the
   3...Qd8 and 3...Qe6+ branches have exercises.
4. Blackburne-Shilling 3...Nd4 (5 games, 0%): branch exists (4.Nxd4!, never 4.Nxe5? Qg5). Done
   when the 4...exd4 5.c3 continuation is a card.
5. Anti-Sicilian (15 games, 43%, NO lesson yet): write one simple system (e.g. 2.Nc3 / 3.Bb5 or
   the Alapin 2.c3) as a new core lesson with archive-weighted branches.
6. Vs Caro-Kann (19 games, 68%) and French (10 games, 50%): keep; the Caro drill only fixes 3.h3?!.

As Black:
1. Vs 1.d4: the c6-d5 wall (30 games, 37%): repertoire lines exist in `repertoire.ts`
   (`black-slav-wall`, `black-wall-vs-london`, `black-wall-vs-nf3-*`). Write them as full lessons
   with branches (2.c4 7 games 29%; 2.Bf4 London 11 games 45%; 2.Nc3/2.Bg5 9 games 44%).
2. Caro-Kann Advance 3.e5 (14 games, 61%): repertoire line exists; make it a lesson with the 3...Bf5
   decision and the typical ...e6, ...c5, ...Nd7 plan.
3. Caro-Kann vs 2.Nf3 / 2.Nc3 (24 games, 58%): lesson on when ...Bg4 is safe (rank closed by a pawn
   on d4/e4) and when not.
4. Caro-Kann Classical 3.Nc3 dxe4 4.Nxe4 Bf5 (4 games, 25%): short line, drill until automatic.
5. Pirc/Philidor 1...d6 (41 games, 49%): no new content; fold into 1...c6 over time.
6. 1.c4 / 1.Nf3 (13 games, 46%): answer ...c6 and ...d5, same wall; a short lesson later.

Status (2026-11-01): White 1-5 and Black 1-4 and 6 are done (Black 5 needs no new content).
- White 1-3: the Evans lesson has a 5...Ba5 branch (6.d4 exd4 7.O-O Nge7 8.cxd4 d5 9.exd5 Nxd5
  10.Ba3), four decisions each against 3...h6 and 3...Nf6 with an exercise each, and the
  Scandinavian drill has exercises for 3...Qd8 and 3...Qe6+.
- White 4: `lesson-blackburne-shilling-drill` (weakness drill) has 4.Nxd4 exd4 5.c3 as its main
  line, with feedback for the 5.Qf3 played in all three archived games.
- White 5: `lesson-alapin-sicilian-centre` (`src/curriculum/antiSicilian.ts`), 2.c3 and 3.d4,
  branches weighted by Black's second move in the archived Sicilians.
- Black 1-4: six lessons in `src/curriculum/blackRepertoire.ts` (course `course-black-repertoire`):
  the wall vs the London, 2.c4 (Slav) and 2.Nc3/2.Bg5, and the Caro-Kann Advance, ...Bg4 timing vs
  2.Nf3/2.Nc3, and Classical. The repertoire lines open these lessons through
  `src/curriculum/repertoireLessons.ts`; the Advance plan line now mirrors the lesson.
- Black 6: `lesson-black-wall-vs-flank` answers 1.c4 and 1.Nf3 with ...c6 and ...d5. The main line
  (2.b3) keeps the plan without d4; 2.Nc3 d5 3.d4 reaches the Slav, 1.Nf3 c6 2.d4 d5 the 1.d4 wall
  lines and 2.e4 d5 the Caro-Kann. The Black plan has matching lines `black-wall-vs-english` and
  `black-wall-vs-reti`, so Diagnostics flags the 1.c4/1.Nf3 games that leave the wall.
- `tests/unit/curriculum/study-order.spec.ts` replays every archive count used as a branch weight
  and every fact the new exercises state.
- The lesson book's over-the-board practice now has blanks for every branch reply as well as the
  main line ("The other replies", answers in the key), and Black chapters say White moves first.
- Study path (2026-11-01): `src/curriculum/patternPath.ts` orders the core lessons in five groups
  that each repeat one pattern; `tests/unit/curriculum/pattern-path.spec.tsx` replays every fact a
  group states. Keep every core lesson in exactly one group when adding lessons.
- Archive analysis (2026-11-01): `docs/game-analysis.md` scores all 4,101 Chess.com games with Maia
  (toolkit in `scripts/game-analysis/`, its own `package.json`, not part of the build). It found no
  measurable cost in opening choices; the points go to loose pieces, unanswered threats, missed free
  pieces and the clock. Re-run it as more games are played.
- Game drills (2026-11-01): `src/curriculum/gameDrills.ts` turns `src/data/game_drills.json` (picked
  by `scripts/game-analysis/drills.mjs`) into 24 one-decision lessons: 12 positions where the
  opponent's last move attacked a piece that hoot65 left, and 12 where an enemy piece could be won
  and was not. Each accepts every move that keeps (or wins) the material, plays out the capture after
  the game move, and has its own review card. They open the study path as two rows of numbered tiles
  ("From Your Games" course), print as two chapters of diagrams in the book, and
  `tests/unit/curriculum/game-drills.spec.ts` works out every fact their text states. Re-run the scan
  and `pick` as new games come in.
Next: the roadmap below.

## Roadmap items not yet built (see `docs/pedagogy-audit.md` Section 7)

- QW-7 and QW-8 (CI, chess-accuracy strings). QW-6 is done (2026-11-01): the tactical search
  generates each node's moves once as SAN and returns the same scores 2.5-4x faster (a fixture of 30
  game positions and 8 rule cases recorded before the change guards this), every Elo band of the
  heuristic opponent answers in about a second (1700 took 14 s and 1900 took 70 s), evaluations skip
  the 250 ms worker pause, move classes are mate-aware with evaluations clamped to 1000 cp, and
  `public/wasm` is gone: the runtime loads the one wasm Vite emits, so the site is 51 MB, not 150 MB.
  QW-5 is done (2026-11-01):
  the worksheet sheet names no answer (the full line, the narrative and the trap refutation are on
  the answer page), Black sheets are drawn from Black's side, squares print with
  `print-color-adjust: exact`, every exercise with its own position has a diagram, the Scotch
  exercise-2 FEN is fixed, and each sheet has a Date / Attempt / Score / Next review row.
- CL-3 post-game review with Maia (blunder-to-drill), CL-5 plan-first gates, CL-6 sparring from a
  tabiya, CL-7 visual coaching grammar.
- DC-1 re-scoped curriculum content for the lines above (this is where the opening order applies).

## How to verify before pushing

```bash
npm ci
npm test
npx playwright install --with-deps chromium && npm run test:e2e
npm run build
git ls-files "*.pdf"   # must print nothing
```
