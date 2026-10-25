# Test Infrastructure & 4-Tier Quality Architecture (`my-chess`)

## 1. Test Philosophy & Architecture

### 1.1 Philosophy: Opaque-Box, Requirement-Driven, Zero-Backend
The test infrastructure for `my-chess` is architected around four core testing principles:

1. **Opaque-Box User-Perspective Verification**:
   Tests interact with the application strictly through standard user interfaces (clicking squares, dragging SVG pieces, opening modals, uploading PGN files, navigating move histories, invoking print dialogs) or public interface contracts defined in `PROJECT.md`. Tests never depend on private internal component state or unexported helper variables.
2. **Strict Requirement Traceability**:
   Every test directly validates a requirement from `ORIGINAL_REQUEST.md` (R1–R5), an Acceptance Criterion, or one of the 25 features specified in `PROJECT.md` (F01 through F25).
3. **Zero Backend Server Dependencies (100% Client-Side)**:
   Because `my-chess` is statically hosted on GitHub Pages under the `/my-chess/` base path, the application has no backend server or API proxy. All testing operates either completely offline (IndexedDB, Web Worker, client-side Maia ONNX / heuristic engine, PDF-derived curriculum) or with transparent browser-level network intercepts simulating Chess.com Published-Data API responses where network isolation is needed.
4. **Deterministic Authoritative Oracles**:
   Expected test outputs are derived from authoritative ground-truth oracles:
   - *Chess Rules & Move Notation*: Official FIDE Laws of Chess as verified by `chess.js` and standard SAN/FEN/PGN grammar specifications.
   - *Chess.com Data Schema*: Live published schema from `https://api.chess.com/pub/player/hoot65/games/archives` and verified game JSONs.
   - *Human Engine Behavior*: Documented Maia Chess model characteristics (predicting human move distributions parameterized by Elo 1100–1900) and human opening frequency distributions.
   - *Spaced Repetition*: SuperMemo-2 (SM-2) algorithm formulas ($EF' = EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))$).
   - *Print Presentation*: CSS `@media print` layout specifications, hiding UI controls, ensuring crisp 2D boards with rank/file coordinates, and enforcing `page-break-before: always` for answer keys.

---

## 2. Directory Layout & Test Suites

The test architecture separates fast in-memory unit/contract verification from realistic headless browser end-to-end user journeys:

```
tests/
├── unit/                                 # Fast Vitest Unit & Contract Tests
│   ├── engine/
│   │   ├── rules.spec.ts                 # F02: Full legal rules, check, mate, draws
│   │   ├── pgn.spec.ts                   # F04: Lossless PGN parsing & SAN serialization
│   │   ├── human-engine.spec.ts          # F05, F06: Maia ONNX & Heuristic engine contracts
│   │   └── opening-book.spec.ts          # F05: Human opening frequency book
│   ├── db/
│   │   ├── dexie-db.spec.ts              # F09: IndexedDB tables & CRUD
│   │   └── deduplication.spec.ts         # F10, F12: UUID/hash deduplication & round-trip export
│   ├── services/
│   │   ├── chesscom-sync.spec.ts         # F07, F08: Chess.com archives parser & incremental sync
│   │   └── srs.spec.ts                   # F18: SM-2 spaced repetition algorithm & persistence
│   ├── analytics/
│   │   ├── diagnostics.spec.ts           # F14: hoot65 White/Black game analyzer & leak detection
│   │   └── repertoire.spec.ts            # F15: Tailored opening repertoire generator
│   └── curriculum/
│       ├── distillation.spec.ts          # F16: PDF curriculum legal move verification
│       └── worksheet-data.spec.ts        # F19, F20: Printable worksheet model & answer keys
│
└── e2e/                                  # Playwright Headless Browser E2E Suites
    ├── 01-board-and-rules.spec.ts        # F01-F04: 2D Board UI, SVG pieces, moves, navigation
    ├── 02-human-engine.spec.ts           # F05-F06: In-browser Maia engine opponent, Elo slider
    ├── 03-chesscom-sync-and-db.spec.ts   # F07-F12: Sync hoot65, upload PGN, filter, DB export/import
    ├── 04-diagnostics-repertoire.spec.ts # F13-F15: Prior-art notes, diagnostic report, recommendations
    ├── 05-interactive-lessons.spec.ts    # F16-F18: Step-by-step drills, wrong-move shake, hints, SRS
    ├── 06-printable-worksheets.spec.ts   # F19-F20: Print preview, CSS @media print validation
    ├── 07-git-and-deployment.spec.ts     # F21-F23: Git origin, PDF non-tracking, /my-chess/ base path
    ├── 08-cross-feature-tiers.spec.ts    # Tier 3: Pairwise & multi-feature integration combinations
    └── 09-real-world-scenarios.spec.ts   # Tier 4: Complete real-world user workflows & journeys
```

---

## 3. The 4-Tier Test Methodology & Coverage Matrix

### 3.1 Tier 1: Feature Coverage (>=5 Tests per Feature across F01–F25; Total >= 125 Tests)

Every feature in `PROJECT.md` is covered by at least 5 distinct test cases:

| Feature ID | Feature Name | Minimum 5 Test Cases |
| :--- | :--- | :--- |
| **F01** | 2D Chessboard & SVG Pieces | 1. Renders 64 squares with contrasting light/dark styles.<br>2. Renders all 12 SVG piece types (cburnett set) with clean SVG elements.<br>3. Displays rank (1–8) and file (a–h) board coordinates.<br>4. Supports click-square-to-select and click-square-to-move.<br>5. Highlights last move start/destination squares and king in check. |
| **F02** | Legal Chess Rules Engine | 1. Validates standard piece moves (pawn, knight, bishop, rook, queen, king).<br>2. Enforces castling (kingside & queenside, blocks through check).<br>3. Enforces en passant pawn captures only on immediate subsequent ply.<br>4. Handles pawn promotion to Queen, Rook, Bishop, Knight.<br>5. Detects terminal states: checkmate, stalemate, 50-move rule, threefold repetition, insufficient material. |
| **F03** | Board Controls & Navigation | 1. Board orientation flip rotates board from White to Black perspective.<br>2. Move history navigation: Step Previous, Step Next.<br>3. Move history navigation: Step to Start, Step to Current.<br>4. Takeback button undoes user move and engine response.<br>5. Custom FEN/PGN position setup dialog parses and loads position onto board. |
| **F04** | Live SAN & Lossless PGN | 1. Live SAN move list renders moves in standard algebraic notation with ply numbers.<br>2. Generates disambiguation notation (e.g. `Rad1`, `N5f3`) when multiple pieces can move to target.<br>3. Annotates check (`+`) and checkmate (`#`) symbols accurately.<br>4. Lossless PGN export serializes full headers (Event, Site, Date, White, Black, Result) and move text.<br>5. Lossless PGN import loads multi-ply game and restores full move history. |
| **F05** | Human-Like Chess Engine (Maia) | 1. Engine loads and initializes Maia model or human move prediction tables without UI hang.<br>2. Supports selectable human Elo bands: 1100, 1300, 1500, 1700, 1900.<br>3. Engine plays realistic human opening moves from opening frequency book for plies 1–6.<br>4. Engine generates legal moves in middlegames without hanging pieces to immediate 1-ply capture at higher ratings.<br>5. Returns candidate moves with human choice probabilities. |
| **F06** | Engine Worker & Fallback | 1. Engine computation executes in a dedicated Web Worker without blocking UI 60fps responsiveness.<br>2. Provides zero-latency heuristic engine fallback if neural weights are not yet loaded.<br>3. Simulates human blunder frequency scaled by chosen Elo slider.<br>4. Tactical evaluator calculates centipawn advantage and classifies blunders ($\Delta \text{cp} > 200$).<br>5. Gracefully handles Web Worker termination and restart. |
| **F07** | Chess.com Archive Sync | 1. Fetches archive list from `https://api.chess.com/pub/player/hoot65/games/archives`.<br>2. Uses simple GET request compatible with CORS `access-control-allow-origin: *`.<br>3. Parses monthly archive JSON into structured game objects.<br>4. Handles HTTP 429 rate limit with exponential backoff.<br>5. Gracefully displays offline notification when network is unreachable. |
| **F08** | Bundled Seed & Incremental Sync | 1. Loads pre-bundled `seed_hoot65_games.json` snapshot immediately on cold start.<br>2. Displays current total games count from seed without waiting for network.<br>3. Incremental sync button identifies which monthly archives are missing.<br>4. Fetches only new/missing archives and appends games.<br>5. Updates sync timestamp in storage. |
| **F09** | Persistent DB (IndexedDB) | 1. Initializes Dexie database with tables: `games`, `repertoires`, `srs_cards`, `diagnostics`.<br>2. Persists stored games across browser reloads.<br>3. Supports query by ID, color, result, and date range.<br>4. Supports database clearing and transactional bulk additions.<br>5. Handles IndexedDB quota and upgrade migrations cleanly. |
| **F10** | Manual PGN Upload & Dedup | 1. Accepts single-game PGN file upload.<br>2. Accepts multi-game PGN file upload (batch processing).<br>3. Accepts pasted PGN text from clipboard.<br>4. Automatically deduplicates games using Chess.com `uuid` or canonical move hash.<br>5. Displays upload summary toast (e.g. "5 games added, 2 duplicates skipped"). |
| **F11** | Game Filtering & Replay | 1. Filter games by player color (White, Black, All).<br>2. Filter games by outcome (Win, Loss, Draw).<br>3. Filter games by opening ECO code / name.<br>4. Click any game in list loads game onto 2D board for interactive replay.<br>5. Replay controls allow scrubbing through historical game plies with SAN highlights. |
| **F12** | Full DB Export & Import | 1. Full database export downloads complete JSON backup of all tables.<br>2. PGN export option exports all games as single standard multi-game PGN file.<br>3. Full database import restores all games, repertoires, and SRS states.<br>4. Round-trip export -> clear -> re-import preserves 100% of games with zero data loss.<br>5. Corrupted import file triggers user-friendly validation error without crashing DB. |
| **F13** | Prior-Art Research Notes | 1. Research documentation file exists in project tree.<br>2. Documents study and repertoire UX patterns from Lichess Study and Listudy.<br>3. Documents spaced-repetition opening training methodologies (Chessable / Tabia).<br>4. Documents human-move prediction architecture (Maia Chess papers & models).<br>5. Maps surveyed UX patterns to `my-chess` views and workflows. |
| **F14** | Diagnostic Game Analyzer | 1. Analyzes `hoot65` White and Black games separately.<br>2. Detects White Scandinavian deviation `2.e5?!` citing real game IDs (e.g. 185031553576, 185035281692).<br>3. Detects Black premature `...Bg4` Caro-Kann deviation citing real game IDs (e.g. 185282462950, 173676860416).<br>4. Computes win rates and performance metrics by opening line.<br>5. Renders interactive report with direct links to replay problematic plies. |
| **F15** | Tailored Repertoire Selection | 1. Recommends tailored White repertoire (Italian Game & Anti-Scandinavian `2.exd5!`).<br>2. Recommends tailored Black repertoire (Caro-Kann Defense vs 1.e4, King's Indian vs 1.d4).<br>3. Repertoire selection is dynamically grounded in `hoot65`'s historical weaknesses.<br>4. Allows user to preview recommended repertoire tree.<br>5. Allows user to adopt recommended repertoire into interactive training. |
| **F16** | PDF Curriculum Distillation | 1. Curriculum data loaded from structured JSON distilled from the 6 workspace PDFs.<br>2. 100% of moves in curriculum trees are validated as legal by rules engine.<br>3. Every lesson includes source book attribution (e.g. *Tactics in Junior Openings*, *Schiller*, *101 Traps*).<br>4. Includes tactical puzzles with FEN, solution moves, and tactical motif tags.<br>5. Includes opening trap guides (e.g. Siberian Trap, Noah's Ark, Legal's Mate). |
| **F17** | Interactive Lesson Engine | 1. Renders lesson board at initial position and awaits user's first move.<br>2. Playing correct move displays positive feedback and auto-plays opponent reply.<br>3. Playing wrong move triggers visual shake and explanatory feedback prompt.<br>4. Wrong move automatically rolls back board position to allow retry.<br>5. Hint button provides progressive assistance (Piece -> Target square -> Explanation). |
| **F18** | Spaced Repetition Scheduling | 1. Adapts SM-2 algorithm tracking interval, ease factor, and review count.<br>2. Grading user recall (Again, Hard, Good, Easy) computes new interval.<br>3. Persists SRS flashcard state in IndexedDB across page reloads.<br>4. Calculates due cards for current date.<br>5. Review queue presents due items and updates intervals upon completion. |
| **F19** | Printable Opening Worksheets | 1. Renders print preview for any curriculum opening lesson.<br>2. Hides all navigation chrome, buttons, and app headers in `@media print`.<br>3. Renders high-contrast 2D board diagram with clear coordinates.<br>4. Formats move notation and guided fill-in-the-blank exercise lines.<br>5. Generates separate answer key with CSS `break-before: page;`. |
| **F20** | Printable Weakness Worksheets | 1. Formats personalized `hoot65` weakness drill for physical board practice.<br>2. Cites exact Chess.com game ID and opponent where mistake occurred.<br>3. Displays board diagram at critical decision ply.<br>4. Provides physical-board exercise prompts ("Set up this position...", "Find the winning move...").<br>5. Includes answer key and conceptual explanation on dedicated answer page. |
| **F21** | Git Repo & Remote Origin | 1. Git repository initialized at workspace root.<br>2. Remote origin configured to `https://github.com/hshakeri/my-chess.git`.<br>3. Verifies no `git push` command is executed.<br>4. Verifies commit history has clean messages.<br>5. Git user configured to `hshakeri`. |
| **F22** | PDF Non-Tracking (.gitignore) | 1. `.gitignore` exists at repository root.<br>2. `.gitignore` contains `*.pdf` rule.<br>3. `git ls-files '*.pdf'` executes and returns zero files.<br>4. Distilled structured data (`.json`, `.ts`) remains tracked.<br>5. Large dependencies and caches (`node_modules`, `dist`) are ignored. |
| **F23** | GitHub Pages Static Build | 1. Vite configured with `base: '/my-chess/'`.<br>2. Static production build (`npm run build`) generates clean HTML/JS/CSS in `dist/`.<br>3. All asset URLs in built `index.html` use relative or `/my-chess/` paths.<br>4. GitHub Actions workflow `.github/workflows/deploy.yml` exists.<br>5. Zero runtime console errors when previewing static production build. |
| **F24** | E2E Testing Suite (Tiers 1-4) | 1. Playwright test suite executes in headless browser using cached Chromium.<br>2. Comprehensive coverage spanning all 25 features.<br>3. Zero flakiness with explicit DOM locator and state assertions.<br>4. Automated test runner produces clear CLI pass/fail reporting.<br>5. Publishes `TEST_READY.md` summarizing suite execution. |
| **F25** | Adversarial Coverage Hardening | 1. Stress tests rapid move clicks and illegal drag attempts.<br>2. Stress tests extreme FEN strings and corrupted PGN inputs.<br>3. Tests simultaneous Web Worker engine search requests.<br>4. Tests browser storage quota and export with large game volumes.<br>5. Tests print styling across varying viewport dimensions. |

---

## 4. Tier 2: Boundary & Corner Cases (>=5 Tests per Domain; Total >= 125 Tests)

Boundary tests stress extreme values, edge cases, and failure modes across all 25 feature areas:

1. **Board & Rules Boundaries**:
   - Castling rights lost permanently when King moves, even if King returns to e1/e8.
   - Castling rights lost for specific rook when that rook moves or is captured on a1/h1/a8/h8.
   - En passant capture expiration: valid strictly on the immediate next half-move; invalid two half-moves later.
   - Pawn promotion on capture: pawn advances diagonally into enemy piece on 8th rank and promotes.
   - 50-move rule exact boundary: draw claimable at 100 plies without pawn move or capture, but not at 99 plies.
   - Threefold repetition with non-consecutive occurrences: same board position and castling/en-passant rights repeating 3 times separated by intermediate moves.
   - Insufficient material edge cases: King + Knight vs King, King + Bishop vs King, King + 2 Knights vs King.
2. **Move Input & Navigation Boundaries**:
   - Rapid clicking: clicking multiple squares in sub-10ms intervals does not trigger illegal moves or state corruption.
   - Drag-and-drop outside board boundary: releasing piece outside chessboard cancels move and snaps piece back.
   - Navigation at limits: clicking "Step Previous" at move 0 does nothing; clicking "Step Next" at latest move does nothing.
   - Custom FEN with side-to-move Black: sets board up with Black's turn and validates legal moves for Black only.
   - Malformed FEN string: setup dialog displays descriptive validation error without breaking current board.
3. **Engine & Worker Boundaries**:
   - Engine search in terminal position (Checkmate): worker returns immediately indicating game over.
   - Engine search in Stalemate position: worker returns draw evaluation without hanging.
   - Rapid takebacks during engine calculation: user takes back move while engine worker is thinking; engine cancels obsolete calculation cleanly.
   - Engine difficulty boundaries: minimum slider (1100 Elo) vs maximum slider (1900 Elo) produce valid responses.
   - Offline mode: engine works without internet connection using cached neural weights or instant heuristic fallback.
4. **Database & Sync Boundaries**:
   - Zero-game archive: handles month where player played 0 games without crashing.
   - Maximum-length PGN (e.g. 150+ move game): parses and stores without truncation or stack overflow.
   - Unicode player names and special characters in PGN comments: stored and reloaded losslessly.
   - Duplicate game with identical moves but different date/event: deduplication correctly identifies unique games.
   - Network failure during multi-archive sync: sync halts safely, reports exact number of games saved, and can be resumed without duplicates.
5. **Analytics & Curriculum Boundaries**:
   - Player with 0 games as Black in selected month: diagnostic report handles zero-count gracefully.
   - All-win or all-loss game set: win-rate calculations (100% or 0%) do not produce division by zero or NaN.
   - Lesson move retry loop: repeating wrong move 5 times continues to show helpful feedback and allows infinite retries without locking.
   - Spaced repetition edge dates: reviewing card due today, card due 30 days ago (overdue), and card due in the future.
   - Worksheet print with long title and 10+ exercises: prints across multiple pages with answer key strictly on the final separate page.

---

## 5. Tier 3: Cross-Feature Combinations (>= 25 Pairwise & Multi-Feature Integration Tests)

Tier 3 verifies interactions between independent modules:

1. **Board Navigation + Live SAN + Engine Opponent**: User plays moves against Maia, navigates back 4 plies to inspect position, returns to latest ply, and makes a legal move; engine responds correctly.
2. **Takeback + Engine Worker**: User takes back move while engine is calculating; engine cancels previous request and resets state.
3. **Custom FEN Setup + Play vs Engine**: User sets custom endgame FEN, activates engine, and plays out endgame.
4. **Orientation Flip + Drag-and-Drop**: Board flipped to Black perspective; drag-and-drop coordinates map accurately to inverted squares.
5. **Chess.com Sync + Dexie DB + Replay**: Sync downloads games, stores in Dexie; selecting synced game loads onto 2D board with full navigation.
6. **Manual PGN Upload + Deduplication + Game List**: User uploads PGN containing existing Chess.com games; deduplication skips duplicates, updates UI count.
7. **Game Filter + Interactive Replay**: Filter games by "Losses as Black"; click filtered game; replay to final blunder.
8. **Diagnostic Analyzer + Replay**: Click cited mistake in Diagnostic Report (e.g. game 185031553576, ply 3 `2.e5?!`); app navigates directly to that position on the board.
9. **Diagnostic Weakness + Tailored Repertoire**: Diagnostic report detects Scandinavian mistake; automatically unlocks and highlights Anti-Scandinavian `2.exd5!` in Repertoire view.
10. **Curriculum Selection + Interactive Lesson**: Select *Tactics in Junior Openings* lesson; lesson engine loads FEN, begins interactive move prompt.
11. **Interactive Lesson Wrong Move + Hint System**: Make incorrect move; verify shake and prompt; request Hint 1 (piece), then Hint 2 (target square); play correct move.
12. **Lesson Completion + Spaced Repetition**: Complete interactive drill; grade performance as "Good"; verify new card added to `srs_cards` table in IndexedDB.
13. **Spaced Repetition Review Queue + Due Date**: Set system time forward; due card appears in "Review Due" badge; reviewing updates due date.
14. **Curriculum Lesson + Printable Worksheet**: View Scotch Gambit lesson; click "Print Worksheet"; verify printable view populated with lesson data.
15. **Personalized Weakness + Printable Worksheet**: Click "Print Physical Worksheet" on `hoot65` Scandinavian error; generates worksheet with real game citation and answer key.
16. **Full DB Export + Clear + Re-import**: Export DB to JSON; clear DB; import JSON; verify all games, repertoires, and SRS cards match original state.
17. **PGN Export of Live Game**: Play 10 moves against engine; export PGN; upload exported PGN into Database; verifies game parses identically.
18. **Elo Slider Change during Active Game**: Change engine Elo from 1100 to 1700 mid-game; verify next move reflects updated Elo setting.
19. **Board Promotion Modal + SAN Recording**: Pawn reaches 8th rank; promotion dialog appears; selecting Knight records `exd8=N` in live SAN list.
20. **Threefold Repetition Claim + Game Over Modal**: Player repeats moves 3 times; "Claim Draw" button enables; clicking finishes game with draw status.
21. **Chess.com API Rate Limit + Exponential Backoff**: Mock 429 response; sync service waits and retries automatically.
22. **Corrupted PGN File Upload + Toast Notification**: Upload invalid text file; app displays warning toast without corrupting existing database.
23. **Worksheet Print CSS + Viewport Scaling**: Switch between mobile and desktop viewport; verify print layout remains formatted for 8.5"x11" / A4 paper.
24. **Static Base Path `/my-chess/` + Asset Resolution**: Verify SVG pieces, icons, and worker scripts load from `/my-chess/` prefix.
25. **Multi-Tab Sync / Storage Event**: Opening app in two browser tabs and syncing in Tab 1 updates game count in Tab 2.

---

## 6. Tier 4: Real-World Application Scenarios (>= 15 End-to-End User Journeys)

Tier 4 tests complete real-world user workflows from start to finish:

1. **Scenario 1 — Full Game vs Maia 1100 as White**:
   User opens app, selects Maia 1100 Elo, plays 1.e4. Engine responds 1...e5 from opening book. User plays 2.Nf3, engine responds 2...Nc6. User plays 3.Bc4 (Italian Game), engine plays 3...Bc5. Game continues 12 plies, user makes takeback on move 7, plays alternate move, finishes game, exports PGN.
2. **Scenario 2 — Full Game vs Maia 1500 as Black**:
   User flips board to Black, starts game. Engine as White plays 1.e4. User responds 1...c6 (Caro-Kann). Engine plays 2.d4 d5 3.Nc3 dxe4 4.Nxe4. User navigates move list backward and forward, verifies correct perspective and move numbers.
3. **Scenario 3 — Zero-Latency Seed Load & Incremental Sync**:
   User opens app on cold start. Seed database of `hoot65` games loads instantly. User clicks "Sync Recent Archives", sync requests latest month from Chess.com API, appends new games, and updates status toast.
4. **Scenario 4 — Weakness Detection on `hoot65` Archives**:
   User navigates to "Weakness Diagnostics" tab. Analyzer processes `hoot65` games. Accurately flags White Scandinavian `2.e5?!` (citing game 185031553576, ply 3) and Black Caro-Kann premature `...Bg4` (citing game 185282462950).
5. **Scenario 5 — Adopting Recommended Repertoire**:
   From Diagnostic report, user reviews recommended White Repertoire (Italian & Anti-Scandinavian `2.exd5!`). User clicks "Adopt Repertoire", adding all lines to the user's active opening study plan.
6. **Scenario 6 — Interactive Step-by-Step Opening Drill**:
   User starts the Anti-Scandinavian drill:
   - System prompts: "Black plays 1...d5. What should White play?"
   - User tries 2.e5?!: board shakes, explanation states "2.e5 allows Black to equalize with 2...Bf5 or 2...c5. Capture the pawn with 2.exd5!". Board rolls back.
   - User plays 2.exd5!: green highlight, "Correct! White wins central space."
   - Opponent replies 2...Qxd5. System prompts White's reply 3.Nc3. User plays 3.Nc3, drill completes successfully.
7. **Scenario 7 — Spaced Repetition Lifecycle (SM-2)**:
   User completes drill and rates difficulty as "Good". System calculates next review in 1 day. Simulating next day, badge shows "1 Review Due". User completes review, intervals expand to 6 days.
8. **Scenario 8 — Printable Worksheet Generation for Physical Board Practice**:
   User opens Scotch Gambit lesson, clicks "Generate Printable Worksheet". Worksheet renders with clean 2D board diagram, rank/file coordinates, algebraic notation, and 3 exercises. Page 2 contains the complete answer key with explanations.
9. **Scenario 9 — Personalized Weakness Drill Worksheet**:
   User generates a printable worksheet from their real Chess.com mistake vs `meny_26`. Worksheet shows position after 1.e4 d5, displays physical-board instructions, exercises to refute Scandinavian lines, and answer key.
10. **Scenario 10 — Manual PGN Upload with Deduplication**:
    User uploads a PGN file containing 10 games (6 new, 4 duplicates already in database). Database adds exactly 6 games, skips 4, displays summary notification, and updates the searchable games table.
11. **Scenario 11 — Full Database Backup & Restore Round-Trip**:
    User exports database to `my-chess-backup.json`. User clicks "Clear Database" (confirming 0 games). User clicks "Restore from Backup" and uploads JSON. App restores 100% of games, repertoires, and SRS flashcards.
12. **Scenario 12 — Custom Position Setup & Endgame Practice**:
    User clicks "Setup Position", enters Lucena Position FEN (`1K1k4/1P6/8/8/8/8/1r6/R7 w - - 0 1`), clicks "Load". Board sets up position, user plays 1.Ra4 (Bridge building) against Maia engine.
13. **Scenario 13 — Offline & Worker Fallback Resilience**:
    Simulate Web Worker error / offline environment. Engine seamlessly falls back to fast heuristic search, allowing uninterrupted gameplay without crashing.
14. **Scenario 14 — Move History Scrubbing during Live Game**:
    During an active game, user scrubs back to move 3, examines board, attempts to make a move on historical ply (which is disallowed or offers branch variation), returns to ply 10, and continues playing main line.
15. **Scenario 15 — Static GitHub Pages Deployment Smoke Test**:
    Serve production build from `/my-chess/` base path. Verify all SVG piece assets, fonts, worker scripts, and JSON models load with HTTP 200 and zero console errors.

---

## 7. Test Execution Commands & Environment

### 7.1 Environment Prerequisites
All test scripts require Node.js v24:
```bash
export PATH="$HOME/.nvm/versions/node/v24.17.0/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"
```

### 7.2 Running Unit Tests (Vitest)
```bash
# Run all unit and contract tests once
npm run test:unit
# or direct:
npx vitest run tests/unit

# Run unit tests with coverage
npm run test:unit -- --coverage
```

### 7.3 Running Headless E2E Tests (Playwright)
```bash
# Run all E2E browser tests in headless Chromium
npm run test:e2e
# or direct:
npx playwright test

# Run a specific E2E test file
npx playwright test tests/e2e/01-board-and-rules.spec.ts
```

### 7.4 Running the Complete Test Suite
```bash
# Run both unit and E2E suites
npm test
```

### 7.5 Pass / Fail Semantics
- **Zero Tolerance for Failures**: A single test failure exits with code `1` and fails the test runner.
- **Zero Console Errors**: E2E browser runs listen to `page.on('console', msg => ...)` and fail if any uncaught error or 404 asset request occurs.
- **Strict Timeouts**: Unit tests timeout at 5,000ms; E2E steps timeout at 15,000ms. Hanging workers or unhandled promises fail automatically.
