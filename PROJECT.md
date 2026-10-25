# Project: Personalized 2D Chess Game, Human-Like Opponent & Learning Coach (`my-chess`)

## Architecture
A 100% client-side web application deployable statically to GitHub Pages under the `/my-chess/` base path.

### Core Modules & Data Flow:
1. **Presentation & UI (`src/components/`, `src/views/`)**:
   - Responsive Lichess-inspired 2D Chessboard using crisp resolution-independent SVG vector piece assets (Lichess "cburnett" set).
   - Board controls: orientation flip, move list navigation (start, previous, next, current), takeback, custom FEN/PGN position setup dialog, live SAN move list.
   - Interactive Lesson Viewer: step-by-step move navigation with visual arrows, wrong-move prompt & shake, auto-rollback retry loop, and progressive hints.
   - Printable Worksheet Generator: `@media print` formatted paper worksheets (coordinates, diagrams, exercises, fill-in lines, separate answer key with page break).
2. **Rules Engine & Game State (`src/engine/rules.ts`, `src/engine/pgn.ts`)**:
   - Wraps `chess.js` (v1.4.0) to enforce 100% legal chess rules: castling, en passant, pawn promotion, check, checkmate, stalemate, three-fold repetition, 50-move rule, insufficient material.
   - Live SAN generation, FEN export/import, lossless PGN parser and serializer.
3. **In-Browser Human-Like Opponent Engine (`src/engine/human/`, `src/engine/worker/`)**:
   - Web Worker thread running a 4-tier hybrid engine without blocking UI:
     - Tier 1: Instant Human Opening Book (JSON ~50KB) based on Lichess/Chess.com human frequency distributions (0ms latency).
     - Tier 2: Maia-3 Neural Human Move Prediction via `maia3-js` / `onnxruntime-web` (5M parameter model ~20MB, runs 100% client-side via WASM across human Elo bands 1100–1900, predicting genuine human moves).
     - Tier 3: Fast client-side heuristic engine fallback with human blunder profiling for instant offline play.
     - Tier 4: Objective tactical evaluator (Stockfish WASM / cp evaluation) for mistake and blunder detection.
4. **Persistent Client-Side Database & Sync (`src/db/`, `src/services/chesscom.ts`)**:
   - Dexie.js (IndexedDB) tables: `games`, `repertoires`, `srs_cards`, `diagnostics`.
   - Chess.com API sync (`https://api.chess.com/pub/player/hoot65/games/archives`): simple browser GET requests (with `Access-Control-Allow-Origin: *`) fetching all 66 monthly archives.
   - Bundled seed snapshot (`src/data/seed_hoot65_games.json`) for zero-latency initial load + incremental in-browser monthly sync.
   - Multi-game PGN/file upload with deduplication keys (`uuid` or composite move hash). Full JSON/PGN database export and import round-trip.
5. **Diagnostics & Repertoire Recommendation (`src/analytics/diagnostics.ts`, `src/analytics/repertoire.ts`)**:
   - Game analysis engine separating White and Black games for `hoot65`.
   - Detects recurring opening deviations, citing specific game IDs and ply numbers (e.g. White Scandinavian 2.e5?! in games 185031553576, 185035281692; Black premature ...Bg4 in games 185282462950, 173676860416).
   - Recommends tailored White (Italian Game / Scotch Gambit + Scandinavian refutation 2.exd5!) and Black (Caro-Kann Defense + King's Indian vs 1.d4) repertoires.
6. **Curriculum & Spaced Repetition (`src/curriculum/`, `src/services/srs.ts`)**:
   - Distilled lessons from the 6 local chess PDFs (`TacticsInJuniorOpenings.pdf`, `Chess-Openings.pdf`, `LearningChess...`, `7500.pdf`, `MCO-15`, `101 Chess Opening Traps`).
   - 100% of lesson moves programmatically verified as legal by rules engine.
   - SuperMemo-2 (SM-2) / Leitner 5-box spaced repetition scheduling persisting in IndexedDB.

---

## Feature Inventory
Every feature required by R1–R5, the user addendum, and survey findings is enumerated and assigned below. No feature is left unassigned.

| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F01 | 2D Chessboard & SVG Pieces | Responsive, scalable 2D board with Lichess "cburnett" SVG vector pieces, coordinates, and styling | M1 | R1 |
| F02 | Legal Chess Rules Engine | Full rules validation: castling, en passant, promotion, check, mate, stalemate, draws | M1 | R1 |
| F03 | Board Controls & Navigation | Flip orientation, move list step (start/prev/next/end), takeback, custom FEN/PGN position setup | M1 | R1 |
| F04 | Live SAN & Lossless PGN | Live standard algebraic notation move list and lossless PGN export/import | M1 | R1 |
| F05 | Human-Like Chess Engine (Maia) | Client-side neural move prediction (Maia ONNX Web / WASM, 1100–1900 Elo) + human opening frequencies | M1 | User Addendum / R1 |
| F06 | Engine Worker & Fallback | Dedicated Web Worker for engine, plus instant heuristic fallback and tactical coach evaluator | M1 | User Addendum / R1 |
| F07 | Chess.com Archive Sync | Live client-side fetch from `https://api.chess.com/pub/player/hoot65/games/archives` (66 archives) | M2 | R2 |
| F08 | Bundled Seed & Incremental Sync | Seed JSON snapshot for instant load + in-browser incremental monthly sync button | M2 | R2 |
| F09 | Persistent DB (IndexedDB) | Dexie.js storage for games, repertoires, SRS cards, and diagnostics | M2 | R2 |
| F10 | Manual PGN Upload & Dedup | Single/multi-game PGN upload with automatic deduplication by UUID or composite hash | M2 | R2 |
| F11 | Game Filtering & Replay | Search and filter by color, result, ECO, date; interactive replay on 2D board | M2 | R2 |
| F12 | Full DB Export & Import | Lossless JSON & PGN export and import with round-trip verification | M2 | R2 |
| F13 | Prior-Art Research Notes | Documented survey of open-source chess coaching, Listudy, Tabia, and Lichess studies | M3 | R3 |
| F14 | Diagnostic Game Analyzer | Analyze `hoot65` White and Black games separately, citing game IDs and plies for recurring errors | M3 | R3 |
| F15 | Tailored Repertoire Selection | Recommend concrete White (Italian/Scotch + Anti-Scandi) & Black (Caro-Kann + KID) repertoires | M3 | R3 |
| F16 | PDF Curriculum Distillation | Structured curriculum distilled from local PDFs with 100% legal moves verified | M4 | R4 |
| F17 | Interactive Lesson Engine | Move-by-move lessons with explanatory feedback on wrong moves, retry loop, and hints | M4 | R4 |
| F18 | Spaced Repetition Scheduling | SM-2 / Leitner 5-box algorithm persisting across reloads in browser DB | M4 | R4 |
| F19 | Printable Opening Worksheets | Print-ready worksheets for curriculum opening lessons with coordinates, SAN, and separate answer key | M4 | R4 |
| F20 | Printable Weakness Worksheets | Print-ready personalized `hoot65` weakness drill worksheets with physical-board instructions | M4 | R4 |
| F21 | Git Repo & Remote Origin | Git initialized, remote origin `https://github.com/hshakeri/my-chess.git`, no `git push` | M5 | R5 |
| F22 | PDF Non-Tracking (.gitignore) | `.gitignore` configured so `git ls-files '*.pdf'` is strictly empty | M5 | R5 |
| F23 | GitHub Pages Static Build | Production static build under `/my-chess/` base path with GitHub Actions deploy workflow | M5 | R5 |
| F24 | E2E Testing Suite (Tiers 1-4) | Comprehensive opaque-box automated test suite covering all features with headless Playwright | M-E2E & Final | AC / R1-R5 |
| F25 | Adversarial Coverage Hardening | White-box stress testing and gap coverage (Tier 5) | Final (Phase 2) | Dual Track |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M-E2E | E2E Testing Track | Independent opaque-box test suite (Tiers 1-4, `TEST_INFRA.md`, publish `TEST_READY.md`) | none | IN_PROGRESS |
| M1 | 2D Playable Chess Game & Human Engine | F01, F02, F03, F04, F05, F06 (Rules, board UI, Maia ONNX engine, worker, PGN export) | none | PLANNED |
| M2 | Chess.com Sync & Persistent Database | F07, F08, F09, F10, F11, F12 (Archives sync, Dexie DB, upload, dedup, replay, export/import) | M1 | PLANNED |
| M3 | Diagnostics & Repertoire Recommendation | F13, F14, F15 (Prior art docs, `hoot65` game analyzer, tailored repertoire generator) | M2 | PLANNED |
| M4 | Interactive Lessons & Printable Worksheets | F16, F17, F18, F19, F20 (PDF curriculum, move-by-move feedback, SRS persistence, print CSS) | M1, M3 | PLANNED |
| M5 | Git, Deployment & Static Packaging | F21, F22, F23 (Git repo, remote origin, `.gitignore` for PDFs, `/my-chess/` Vite build, CI/CD) | M1, M2, M3, M4 | PLANNED |
| M-FINAL | Final Verification & Hardening | Phase 1: 100% E2E test pass (Tiers 1-4); Phase 2: Adversarial coverage hardening (Tier 5) | M-E2E, M5 | PLANNED |

---

## Interface Contracts

### 1. Game State & Rules Contract (`src/types/chess.ts`)
```typescript
export interface ChessPosition {
  fen: string;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  drawReason?: 'stalemate' | 'threefold_repetition' | 'insufficient_material' | '50_move_rule';
  legalMovesSan: string[];
}

export interface ChessMoveRecord {
  ply: number;
  san: string;
  uci: string;
  fenAfter: string;
  comment?: string;
}
```

### 2. Human-Like Engine Contract (`src/types/engine.ts`)
```typescript
export interface EngineRequest {
  type: 'search' | 'evaluate';
  fen: string;
  elo: 1100 | 1300 | 1500 | 1700 | 1900;
  moveHistorySan?: string[];
}

export interface EngineResponse {
  type: 'move' | 'evaluation';
  bestMoveSan: string;
  bestMoveUci: string;
  candidateMoves: Array<{ san: string; uci: string; probability: number }>;
  tierUsed: 'human_opening_book' | 'maia_neural' | 'heuristic_fallback';
  centipawns?: number;
}
```

### 3. Database & Sync Contract (`src/types/db.ts`)
```typescript
export interface StoredGame {
  id: string; // dedupKey
  source: 'chesscom' | 'upload' | 'local_play';
  url?: string;
  pgn: string;
  white: { name: string; rating?: number };
  black: { name: string; rating?: number };
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  eco?: string;
  openingName?: string;
  timestamp: number;
  timeClass?: string;
  movesSan: string[];
}

export interface SyncResult {
  totalArchives: number;
  syncedArchives: number;
  gamesAdded: number;
  duplicatesSkipped: number;
  latestGameDate?: string;
}
```

### 4. Diagnostics & Repertoire Contract (`src/types/diagnostics.ts`)
```typescript
export interface OpeningDeviation {
  gameId: string;
  gameUrl: string;
  opponent: string;
  playedColor: 'white' | 'black';
  ply: number;
  fen: string;
  playedSan: string;
  bookSan: string;
  evaluationDelta: string;
  description: string;
}

export interface DiagnosticReport {
  playerHandle: 'hoot65';
  totalGamesAnalyzed: number;
  whiteStats: { winRate: number; keyLeaks: OpeningDeviation[] };
  blackStats: { winRate: number; keyLeaks: OpeningDeviation[] };
  recommendedWhiteRepertoire: string; // e.g. "Italian Game & Anti-Scandinavian (2.exd5!)"
  recommendedBlackRepertoire: string; // e.g. "Caro-Kann & King's Indian"
}
```

### 5. Curriculum & Printable Worksheets Contract (`src/types/curriculum.ts`)
```typescript
export interface CurriculumLesson {
  id: string;
  title: string;
  category: 'opening' | 'trap' | 'weakness_drill';
  sourceBook: string;
  author: string;
  initialFen: string;
  moves: Array<{
    ply: number;
    san: string;
    annotation?: string;
    isUserMove: boolean;
    wrongMoveFeedback?: Record<string, string>; // SAN -> explanation
  }>;
  exercises: Array<{
    prompt: string;
    fen: string;
    solutionSan: string[];
    explanation: string;
  }>;
}

export interface PrintableWorksheetData {
  title: string;
  subtitle: string;
  type: 'curriculum_lesson' | 'hoot65_drill';
  diagramFen: string;
  coordinates: boolean;
  movesSan: string[];
  exercises: Array<{ prompt: string; diagramFen?: string; answer: string }>;
  answerKey: Array<{ exerciseIndex: number; solutionSan: string; rationale: string }>;
}
```

---

## Code Layout
```
/Users/hs9hd/Library/CloudStorage/Box-Box/My/chess/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages deployment workflow
├── public/
│   ├── favicon.svg
│   ├── pieces/                     # Lichess cburnett SVG pieces (wP.svg, bK.svg...)
│   └── models/                     # Maia ONNX model weights (~20MB)
├── src/
│   ├── analytics/                  # Diagnostics, weakness detector, repertoire selector
│   ├── components/                 # Chessboard, controls, navigation, modals, worksheets
│   ├── curriculum/                 # Distilled lessons from PDFs, legal move verified
│   ├── data/                       # Seed hoot65 games, opening frequency book
│   ├── db/                         # Dexie.js database schema & helpers
│   ├── engine/                     # Rules engine, Maia ONNX wrapper, Web Worker
│   ├── services/                   # Chess.com API sync, SM-2 SRS engine
│   ├── types/                      # TypeScript definitions (contracts above)
│   ├── views/                      # Main views: Play, Archive/DB, Diagnostics, Lessons, Worksheet
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                   # Tailwind + @media print styles
├── tests/
│   ├── unit/                       # Vitest unit tests for rules, DB, diagnostics, SRS
│   └── e2e/                        # Playwright headless browser E2E test suites (Tiers 1-4)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts                  # base: '/my-chess/'
└── .gitignore                      # MUST contain '*.pdf', node_modules, dist
```
