# Hand-off prompt for continuing `my-chess` in another coding assistant

Copy everything below the line into a new session (Codex or similar) opened in a clone of
`https://github.com/hshakeri/my-chess` on the `main` branch.

---

You are continuing work on **my-chess**, a 100% client-side chess coach for the Chess.com player
**hoot65** (about 1150 rapid). Read `docs/pedagogy-audit.md` first (Sections 1, 7, 8 and the two
status notes near the top), then `docs/handoff-prompt.md` (this file). The app is deployed by the
GitHub Actions workflow in `.github/workflows/deploy.yml` to https://hshakeri.github.io/my-chess/
on every push to `main`, once the unit and browser suites pass (`.github/workflows/test.yml`, which
also runs on every push to another branch).

## Stack and hard constraints

- React 18 + Vite 6 + TypeScript (strict) + Tailwind; chess.js 1.4; Dexie 4 (IndexedDB); ts-fsrs 5
  for scheduling; maia3-js + onnxruntime-web in a Web Worker for the human-like engine.
- Tests: Vitest (`npm test`, 465 tests: SSR `renderToString` specs, jsdom interaction specs under
  `tests/unit/curriculum/lessons-view-interactions.spec.tsx`, fake-indexeddb for the database) and
  Playwright (`npm run test:e2e`, 102 tests incl. iPhone-viewport tests). Keep both green or update
  tests deliberately and say why. The board question before each lesson move (CL-5) is on by default:
  a test that plays lesson moves either answers it or sets localStorage `my_chess_cct_gate` to `off`
  first (`page.addInitScript` in e2e, the jsdom spec's beforeEach). No `if (await ...isVisible())` guards in specs: a missing control
  must fail, and every Chess.com request in a spec must be mocked.
- `npm run build` must pass (`tsc && vite build`). Base path is `/my-chess/`.
- Never commit a PDF: `.gitignore` excludes `*.pdf` and `book/`; run `git ls-files "*.pdf"` before
  every commit and expect no output. The printable lesson book is generated at deploy time
  (`npm run book` writes `book/lesson-book.html`, `npm run book:pdf` renders it on US Letter, or A4
  with `BOOK_PAPER=a4`) and served at https://hshakeri.github.io/my-chess/book/lesson-book.pdf.
  Branch CI builds it too and keeps the PDF as the `lesson-book` artifact for 7 days.
- Every lesson FEN and move is validated by `buildVerifiedLesson` in `src/curriculum/builder.ts`;
  never claim a chess fact in lesson text that you did not replay with chess.js.
- Lesson titles never print the answer. Opponent branches use `alternatives` on opponent moves with
  `frequency` taken from `src/data/seed_hoot65_games.json` (301 real games).
- Work on a feature branch, commit with clear messages, fast-forward `main` to publish.

## What exists today

- **Play vs Maia** (worker engine with opening book, Maia neural net, heuristic fallback; a
  main-thread fallback answers within 4 s if the worker is slow). Phone layout has an engine strip
  above the board. The opening book is the archive opponents' moves; a practice clock (off by
  default) runs 10+0, 5+0 or 3+2 with a cue after 30 seconds on one move and the pace against the
  opponents; a switch asks the board question (what the engine's last move attacks) before each move.
- **Game Database**: Chess.com sync, PGN upload, replay, JSON export/import (schema v2 with FSRS
  cards and review log).
- **Opening Diagnostics** (`src/analytics/diagnostics.ts`, `repertoire.ts`): measured habit
  detectors (Scandinavian 2.e5, early queen sortie, ...Bg4 aftermath, Blackburne-Shilling
  handling, mated/lost on time while ahead), repertoire trees for both colours with first-divergence
  detection ("Where you leave the repertoire"), "Practice this" (one-decision drill from a deviation
  via `src/curriculum/factories.ts`) and "Adopt Repertoire". The first tab opens with "Where your
  points go" (the archive analysis's six habits, each linked to its drill). Tabs "Your Mistake Patterns" (reviewed
  games counted, batch review, habit scorecard) and "Clock & Endings" (time losses, pace against the
  opponents, how games ended, resignations playable on against Maia).
- **Interactive Lessons** (`src/views/LessonsView.tsx`): branching lessons, lesson tree beside the
  board (click a node to jump there), hint ladder theme/piece/square, refutation playback on
  mistakes, exercises, per-decision FSRS cards (`src/services/cards.ts`, `sessionQueue.ts`,
  `fenKey.ts`) with inferred ratings, "Due today" review sessions. Phone: lesson picker above the
  board. The default list ("My Lessons") is the study path in `src/curriculum/patternPath.ts`:
  four drill sets from hoot65's own games, then the core lessons in five groups (the last, "Finish
  the game", has the queen and rook mates, king and pawn against king and stalemate), each group
  repeating one pattern and headed by the check that catches it; the phone picker and Part I of the
  lesson book use the same order. The header holds today's routine and the trainers: warm-up,
  tactics deck, speed run, progress (with mastery by group), plan review.
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
Engine pass (2026-11-01): Stockfish 19 and Maia changed five lines (the reasons are in
`docs/pedagogy-audit.md`): the Blackburne-Shilling continuation is now 4...exd4 5.O-O, with 6.Bxf7+
and 7.Qh5+ against a bishop on c5; the Advance trades first, 7...cxd4 8.cxd4 Qb6; the Evans
Compromised Defence plays 9.Bg5; the Konikowski 9.Bf4 and the Elephant 7.Nxf6+ and 8.d4.
`npx tsx scripts/engine-audit.ts` re-checks every answer.
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
  by `scripts/game-analysis/drills.mjs`) into 64 one-decision lessons: 16 positions where the
  opponent's last move attacked a piece that hoot65 left, 16 where an enemy piece could be won and
  was not, 16 where nothing was in danger until hoot65's own move left a piece to take, and 16 where
  hoot65's move let the opponent mate at once (scanned back to January 2024). Every set is vetted
  by Stockfish with `scripts/game-analysis/verify-drills.mjs` (no lost games, a game move that cost
  at least 1.5 pawns, answers within 1.5 pawns of the best or still winning by 3). Each accepts the
  moves that keep (or win) the material and pass that cut, plays out the punishment after the game
  move, and has its own review card.
  They open the study path as four rows of numbered tiles ("From Your Games" course), print as four
  one-page chapters of the newest 12 diagrams in the book, and
  `tests/unit/curriculum/game-drills.spec.ts` works out every fact their text states. Re-run the scan,
  `verify-drills.mjs vet` and `pick` as new games come in (`scripts/game-analysis/README.md`).
- Lesson book print layout (2026-11-01): printed double-sided, every page with questions is the
  front of a sheet whose back holds its answers, so each sheet can be used on its own. The four drill
  pages come first, each with its answers on the back; the lesson chapters are study pages; the
  practice for every lesson (the line and each reply as scoresheet rows with blanks, and the exercises)
  is gathered at the end as blocks that `npm run book:pdf` packs onto practice sheets in the browser,
  moving each sheet's answers to its back. Chromium cannot force a front page, so the PDF step renders
  a draft, reads from its bookmarks where each heading landed, puts a notes page wherever a sheet would
  start on a back (rendering again after each), fills in the page numbers (contents and each chapter's pointer to its
  practice), renders the book, and fails if any sheet is not a front page followed by its answers.
  72 US Letter pages, 21 sheets (the four drill sheets, three tactics sheets at the end of Part I,
  fourteen practice sheets), 413 answers. Diagrams are SVG drawings with the app's
  piece set (`public/pieces`); the fonts are Times New Roman and Arial, whose metric twins Liberation
  Serif and Sans the Linux runner has, so pages break the same way there. All text is black and dark
  squares are a light grey.
Next: the roadmap below.

## Roadmap items not yet built (see `docs/pedagogy-audit.md` Section 7)

- QW-8 is done (2026-11-01): every refutation line must show what the mistake costs (a legality test
  checks mate, a lasting material gain or stalemate), superlatives are gone with every fact replayed,
  and the Schiller/Watson and Giddins attributions are corrected. QW-7 is done (2026-11-01): CI runs Vitest and Playwright on every
  branch push and before every deploy, `playwright.config.ts` reads `PLAYWRIGHT_EXECUTABLE_PATH`, the
  33 `isVisible` guards left in the specs are gone, and specs 03 and 09 mock every Chess.com request.
  QW-6 is done (2026-11-01): the tactical search
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
- CL-3 done (2026-11-01). First slice: a game opened in the database can be reviewed (marks first,
  then Maia's critical moments named by `src/analytics/errorTaxonomy.ts`, in the engine worker), and
  each mistake with a material answer becomes a card that comes first among a session's new cards.
  Second slice: Diagnostics has a "Your Mistake Patterns" tab (`src/views/MistakePatternsPanel.tsx`,
  `src/analytics/mistakePatterns.ts`): every reviewed game counted per 100 of hoot65's moves by kind
  (with the check that catches it), by phase, by the time left on the clock and by month, and a batch
  review of the newest unreviewed games in the worker. Batch reviews are saved with `source: 'batch'`
  and no marks; opening such a game still asks for the marks first, then shows the batch result
  without running the engine. Reviews are in the JSON backup (a newer local review is kept). Not
  built: the Maia-in-Vitest spec (DC-7).
- CL-5 done (2026-11-01): a board question before every lesson and review decision (what the last
  move attacks, what is undefended, how many checks), a wrong answer rates the decision Hard, and a
  two-minute warm-up on positions from hoot65's games. The Play tab has the two archive habits as
  switches (2026-11-02): the board question before each of the student's moves against Maia, and a
  safety check before each move is played ("is it safe?", judged by the review's material search,
  `losesMaterial` in `src/analytics/errorTaxonomy.ts`, in the engine worker within 20,000 nodes);
  both belong to one position of one game. The warm-up's "Was it safe?" uses the same search within
  2,000 nodes and takes half its questions from 32 unsafe drill moves. Not built: the question about
  the opponent's likeliest reply after the student's move.
- CL-6 done (2026-11-01): play a finished lesson line on against Maia 1100/1300 from the Play tab,
  with plan goals (castle, develop, keep material, plus any `planMilestones`) and a review of the
  spar's moves; the engine worker is shared through `src/engine/EngineContext.tsx`. A game review's
  critical moments offer the same ("Play it again vs Maia", from the move before the mistake).
- Opening speed run done (2026-11-01): the Lessons header plays the current lesson's main line
  against the clock (`src/views/SpeedRunPanel.tsx`), the opponent's replies at once, three seconds a
  move as the target, the runs kept in localStorage.
- DC-5 done (2026-11-01): hash routes (`src/router.ts`: `#/lesson/<id>`, `#/play?fen=...`, one per
  tab, `#/game/<id>` for a stored game's replay and review) that the address bar follows, and a QR code to the lesson beside every chapter and drill sheet
  of the lesson book.
- DC-8 first slice done (2026-11-01): a Progress panel in the Lessons header (cards by state, recall
  today, the riskiest positions by `reachProb x (1 - recall)`, the moves mixed up, reviews due over
  two weeks), and a habit scorecard on the Diagnostics "Your Mistake Patterns" tab (castled by move
  10, minor pieces out by move 10, queen kept home, nothing left hanging in reviewed games).
- DC-4 first slice done (2026-11-01): the Worksheets tab prints the newest twelve mistakes of the
  reviewed games (`src/views/MistakeSheet.tsx`), the answers on a page of their own.
- CL-7 first slice done (2026-11-01): plan review, one FSRS idea card per opening lesson (the
  position the line reaches, the plan on demand, a self-grade), in localStorage. Not built: the
  automatic relation cues and idea cards in Today's session; multiple-choice plans were added on
  2026-11-02. The JSON backup
  carries the localStorage data too (`src/services/localData.ts`).
- DC-1 slice done (2026-11-02): the Progress panel shows mastery by study-path group (cards,
  reviewed, mastered = FSRS stability of a week or more, recall). Nothing is locked by it.
- DC-3 first slice done (2026-11-02): Diagnostics "Clock & Endings" tab (`src/analytics/clock.ts`,
  `src/analytics/endings.ts`, `src/views/ClockPanel.tsx`): time losses, games lost on time while
  ahead, the clock against the opponents after moves 10-40, long thinks; how every game ended, the
  games resigned with less than a rook down (no mate in one coming), each playable on against Maia,
  and stalemates given while ahead. A practice clock on the Play tab (`src/components/PracticeClock.tsx`,
  off by default; 10+0, 5+0, 3+2) with a cue after 30 seconds on one move. Every view fits a
  375-pixel phone (`tests/e2e/12-phone-width.spec.ts`).
- DC-2 slice done (2026-11-02): King and Pawn against King in "Finish the game"
  (`lesson-king-pawn-opposition`), checked by an exact retrograde solver
  (`scripts/game-analysis/kpk-solve.mjs`, its twin `tests/unit/curriculum/kpk-solver.ts`).
- DC-2 tactics deck done (2026-11-02): 234 tactics from the archive, right after a mistake by
  either player, one clearly winning move by Stockfish 19, plus 23 quiet control positions (nothing
  to win, several solid moves) and 23 keep-the-lead positions (ahead, several safe moves) (`scripts/game-analysis/tactics.mjs`,
  `tactics-pick.mjs`, `src/data/tactics_deck.json`), Woodpecker-lite in the Lessons header
  (`src/views/TacticsDeckPanel.tsx`): graded by solve time, Again first, retired after three Good
  solves in a row; a Worksheets sheet (also as "two moves ahead", a visualization format) and three
  lesson-book sheets. The Lessons header shows the
  day's routine (warm-up, due cards, ten tactics, plans, and a game with the Play tab's two checks,
  ticked after ten answers in games) with each step ticked when done.
- A full archive stays responsive (2026-11-02, checked on all 4,097 of hoot65's games): Diagnostics
  reads the openings in 1.6 s instead of 10.7 (each position and move parsed once for the archive),
  in slices between frames beyond 800 games; the Games tab filters in memory and draws 500 rows at a
  time. The lesson book's "How to use" page carries a card of the checks in the order they come up
  at the board, with their points.
- DC-6 archive half done (2026-11-02): Maia's opening book is the archive opponents' moves
  (`scripts/game-analysis/opening-book.mjs`, 253 positions).
- DC-8 habit done (2026-11-02): "Kept a lead of 3 points for the next 10 moves" replaces "traded
  when ahead", which the archive does not support; king activity in the endgame was measured too and
  is not kept (see `docs/pedagogy-audit.md`).
- DC-1 re-scoped curriculum content for the lines above (this is where the opening order applies).

## How to verify before pushing

```bash
npm ci
npm test
npx playwright install --with-deps chromium && npm run test:e2e
npm run build
git ls-files "*.pdf"   # must print nothing
```

Pushing the branch runs the same unit and browser suites in CI (`.github/workflows/test.yml`);
fast-forward `main` only once that run is green. The push to `main` runs them again before the deploy.
