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
- Tests: Vitest (`npm test`, 307 tests: SSR `renderToString` specs, jsdom interaction specs under
  `tests/unit/curriculum/lessons-view-interactions.spec.tsx`, fake-indexeddb for the database) and
  Playwright (`npm run test:e2e`, 76 tests incl. iPhone-viewport tests). Keep both green or update
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
  board.
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

Status (2026-11-01): White 1-5 and Black 1-4 are done.
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
- `tests/unit/curriculum/study-order.spec.ts` replays every archive count used as a branch weight
  and every fact the new exercises state.
Next: Black 6 (a short 1.c4/1.Nf3 wall lesson), then the roadmap below.

## Roadmap items not yet built (see `docs/pedagogy-audit.md` Section 7)

- QW-5 to QW-8 (worksheet answer separation and orientation, engine speed-up, deploy size, CI).
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
