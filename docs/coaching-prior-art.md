# Open-Source Chess Coaching & Repertoire Prior Art Survey

## Executive Summary

To build an effective personalized chess coach and interactive learning environment for `hoot65` (`my-chess`), we conducted a comprehensive technical survey of proven open-source chess training software, interactive study workflows, and cognitive learning systems. 

Traditional chess training tools often suffer from two major flaws:
1. **Robotic Opponents**: Standard alpha-beta minimax engines (e.g. naive Stockfish wrappers) calculate with inhuman precision and then artificially inject blunder moves at low difficulty settings. This creates bizarre, non-human gameplay (playing 15 grandmaster plies followed by hanging a Queen in one move for no reason).
2. **Disconnected Diagnostics**: Generic opening explorers show master win rates across millions of games, but fail to pinpoint *why* a specific player loses rating points in their own games, which specific recurring bad habits they fall into, and how their concrete blunders can be remediated through targeted drills.

This document reviews five key architectural models from the open-source ecosystem and maps their proven patterns directly into `my-chess`:
1. **Listudy** (`ArneVogel/listudy`, AGPL-3.0) — Spaced repetition system (SRS) on directed acyclic graph (DAG) / PGN move trees.
2. **NeuralPGN & Chessdriller** — Automated repertoire deviation analysis comparing a player's real historical games against repertoire trees to detect divergence plies.
3. **Tabia** (`daxaur/tabia`) — 100% client-side, zero-backend, browser-local opening trainer architecture.
4. **Lichess Studies & Interactive Mode** — Interactive study engine driven by PGN annotations (`{ ... }` commentary, `( ... )` branching, NAGs) with immediate visual feedback and auto-replay.
5. **Maia Chess** (`CSSLab/maia-chess`, MIT) — Deep learning human-move prediction trained on millions of Lichess games parameterized by human Elo bands (1100–1900).

---

## 1. Deep Dive: Architectural Models & Prior Art

### 1.1 Listudy: PGN Tree Spaced Repetition (SRS)
*Repository: `ArneVogel/listudy` | License: AGPL-3.0*

**Core Concept:**
Listudy is an open-source web application designed to help chess players memorize opening repertoires and endgame tactics through spaced repetition.

**Key Technical Discoveries:**
- **Repertoire Representation as PGN Forest**:
  Instead of treating each variation as an isolated linear flashcard, Listudy models an opening repertoire as a branching game tree (or DAG of positions). Positions with identical FENs share child nodes, avoiding redundant card scheduling.
- **Node-Level SRS Scheduling**:
  Each node where the student has to make a move acts as a flashcard item governed by a modified SuperMemo-2 (SM-2) algorithm. Attributes include:
  - `interval` (days until next review)
  - `easeFactor` (difficulty multiplier, initialized at 2.5)
  - `repetitions` (consecutive successful recalls)
  - `dueDate` (timestamp for next repetition)
- **Active Recall UX**:
  During a training session, the opponent's moves are played automatically by the engine. The student must play the correct candidate move from memory. If the student plays an unlisted or suboptimal move, the system rejects it, shakes the piece or board, displays an explanation, and resets or penalizes the node's SRS interval.
- **Transposition Handling**:
  Transpositions (reaching the same FEN via different move orders) are indexed by FEN string rather than raw move history, ensuring the player practices the position regardless of move order.

**Application in `my-chess`:**
- `my-chess` adopts the SM-2 flashcard model in `src/services/srs.ts` and `src/db/`, scheduling daily opening flashcards stored in IndexedDB.
- Positions are indexed by normalized FEN (excluding 50-move clock and fullmove number) for flawless transposition handling.

---

### 1.2 NeuralPGN & Chessdriller: Repertoire Deviation & Leak Detection
*Projects: NeuralPGN, Chessdriller, Lichess Game Check*

**Core Concept:**
These tools bridge the gap between a player's theoretical repertoire and their actual game history by running automated deviation checks.

**Key Technical Discoveries:**
- **Tree Traversal & Divergence Detection**:
  For every game played by a student, the analyzer steps ply-by-ply from the starting position:
  1. At ply $N$, check if the current position exists in the reference opening book or personal repertoire.
  2. If the student was on turn and played move $M$, check whether $M$ matches the recommended repertoire move $M_{rec}$.
  3. If $M \neq M_{rec}$, flag ply $N$ as the **First Divergence Point** (Opening Deviation).
- **Leak Categorization & Impact Scoring**:
  Not all deviations are blunders; some are simply alternate sidelines. Modern deviation tools classify divergence into:
  - *Theoretical Inaccuracy*: Deviates from master book into a passive structure (e.g. White playing `2.e5?!` against the Scandinavian instead of `2.exd5!`).
  - *Premature Tactical Mistake*: Developing a piece prematurely to an unprotected or easily harassed square (e.g. Black playing early `...Bg4?!` in Caro-Kann or Pirc before castling, falling victim to `h3`, `g4`, or `Qb3` forks).
  - *Severity Metric*: Calculated by measuring frequency of occurrence across games, player win rate when playing the deviation vs playing the book move, and subsequent centipawn loss ($\Delta \text{cp}$).
- **Actionable Remediation**:
  Rather than giving generic advice ("study openings"), deviation engines generate a targeted drill starting exactly at the divergence FEN, challenging the player to find the correct refutation move.

**Application in `my-chess`:**
- `src/analytics/diagnostics.ts` directly implements this algorithm:
  - Traverses `hoot65`'s historical games (split into White and Black sets).
  - Flags the exact plies of recurring leaks (White: `1.e4 d5 2.e5?!`; Black: early `...Bg4` in Caro-Kann/Pirc).
  - Cites specific game IDs, URLs, opponents, and move numbers.
  - Automatically recommends counter-repertoires that address these exact leaks.

---

### 1.3 Tabia: Client-Side Browser Opening Trainer
*Repository: `daxaur/tabia` | License: MIT*

**Core Concept:**
Tabia is an offline-first, client-side chess opening trainer built with modern web technologies that runs entirely in the browser without any backend server.

**Key Technical Discoveries:**
- **Zero-Backend Architecture**:
  The entire application—from PGN parsing, opening tree indexing, to practice session state—runs inside the client browser. This makes it 100% portable, free to host on static web hosts like GitHub Pages, and resilient against network outages.
- **Browser-Local Storage**:
  Repertoires and study history are stored using browser IndexedDB (or `localStorage` for lightweight states). IndexedDB handles several megabytes of PGN games and tree structures effortlessly.
- **Tree Navigation UX**:
  Tabia uses a split-screen view: an interactive 2D chessboard on the left, and a nested collapsible move tree on the right. Clicking any branch instantly synchronizes the board position to that ply.

**Application in `my-chess`:**
- `my-chess` is architected as a 100% static web application for GitHub Pages (`base: '/my-chess/'`).
- Persistent storage is powered by **Dexie.js (IndexedDB)** for games, repertoires, diagnostics, and SRS cards.
- The UI features instant board synchronization and collapsible move trees.

---

### 1.4 Lichess Studies: Interactive Lesson & Branching Engine
*Repository: `lichess-org/lila` (study module) | License: AGPL-3.0*

**Core Concept:**
Lichess Studies is the gold standard for interactive collaborative chess instruction. It transforms standard PGN files into rich educational experiences.

**Key Technical Discoveries:**
- **PGN Annotations as Lesson Directives**:
  Lichess leverages standard PGN grammar to create rich interactive workflows:
  - *Inline Comments (`{ ... }`)*: Rendered as instructional speech bubbles or coach tips.
  - *Variations (`( ... )`)*: Represent branching side-lines, alternative defenses, and "what if" scenarios.
  - *Numeric Annotation Glyphs (NAGs)*: E.g., `$1` (`!`), `$2` (`?`), `$5` (`!?`), `$6` (`?!`), `$14` (`+=`). Used to visually color-code moves (green for good, red for blunder).
  - *Arrows and Highlights (`[%cal Gc1g5]`, `[%csl Re4]`)*: Visual SVG vectors drawn directly onto the board overlay to indicate threats, plans, and piece guards.
- **Interactive "Study Mode" Execution Loop**:
  1. Board loads initial position.
  2. If it is the student's turn, student inputs a move.
  3. If move matches target line, play animation, display positive feedback commentary `{ ... }`, and immediately trigger opponent reply after ~300ms delay.
  4. If move matches an annotated wrong line, display the specific explanation for why that move fails (e.g., "This allows White to trap your bishop with 5.f3!"), then roll back the piece to allow an immediate second attempt.
  5. If move is unannotated, display generic feedback ("That move isn't part of this study line. Try again!") and roll back.

**Application in `my-chess`:**
- `my-chess` Interactive Lesson Engine (`src/curriculum/`, `src/views/`) strictly follows this interactive loop:
  - Move-by-move validation with target lines.
  - Wrong-move feedback dictionary (`wrongMoveFeedback: Record<string, string>`) explaining tactical consequences.
  - Auto-rollback retry loop with progressive hints.

---

### 1.5 Maia Chess: Neural Human Move Prediction
*Repository: `CSSLab/maia-chess` | Research: Klein et al., KDD 2020 / ACM*

**Core Concept:**
Maia Chess is an open-source deep neural network trained on millions of online human games from Lichess. Unlike AlphaZero or Stockfish which optimize for *maximum objective win probability*, Maia is trained with a supervised learning objective to **predict what a human player of a specific rating will actually play in a given position**.

**Key Technical Discoveries:**
- **Model Tiers Parameterized by Elo**:
  Maia models are trained across distinct human rating bins: `maia-1100`, `maia-1300`, `maia-1500`, `maia-1700`, `maia-1900`.
  - A `maia-1100` model reproduces the tactical oversights, premature attacks, and opening choices typical of intermediate players (~1100 Elo).
  - A `maia-1900` model plays with high positional discipline and deep strategic awareness.
- **Softmax Probability Distribution**:
  Maia outputs a probability distribution over all legal moves. This allows sampling candidate moves according to their human likelihood:
  $$P(\text{move}_i) = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}$$
  where temperature $T$ controls exploration.
- **Human Opening Book Pairing**:
  In early plies (plies 1–10), human players exhibit distinct opening frequency distributions (e.g. intermediate White players play `1.e4` ~50% of the time, `1.d4` ~35%, `1.c4` ~8%). Pairing Maia with a human opening frequency book produces instantaneous, realistic opening lines without engine calculation delays.
- **In-Browser Execution via ONNX Web & WASM**:
  Maia model weights (~20MB quantized) can execute 100% client-side inside a browser Web Worker via ONNX Runtime Web (`onnxruntime-web`) using WebAssembly (WASM) and SIMD acceleration.

**Application in `my-chess`:**
- `src/engine/human/` implements a 4-tier hybrid engine:
  - Tier 1: Instant Human Opening Book (`openingBook.json`)
  - Tier 2: Maia Neural Move Prediction (`maia3-js` / `onnxruntime-web` across Elo 1100–1900)
  - Tier 3: Heuristic human engine fallback for instant offline play
  - Tier 4: Objective tactical evaluator for blunder detection

---

## 2. Mapping Prior Art to `my-chess` Views & Workflows

| Surveyed Concept | Prior-Art Source | Implementation in `my-chess` | User Value |
|---|---|---|---|
| **Repertoire Deviation Check** | NeuralPGN, Chessdriller | `src/analytics/diagnostics.ts` & `src/views/DiagnosticsView.tsx` | Automatically flags `hoot65`'s exact recurring mistakes (`2.e5?!` vs Scandinavian, early `...Bg4` in Caro-Kann/Pirc) citing real Chess.com game IDs and plies. |
| **Tailored Repertoire Selection** | Chessable, Lichess Studies | `src/analytics/repertoire.ts` & `src/views/DiagnosticsView.tsx` | Generates cohesive opening repertoires specifically designed to patch detected leaks (Italian & Anti-Scandinavian for White; Caro-Kann & KID for Black). |
| **Interactive Lesson Engine** | Lichess Study Mode | `src/curriculum/`, `src/views/LessonsView.tsx` | Step-by-step interactive board with automatic opponent replies, wrong-move prompt & shake, auto-rollback retry loop, and progressive hints. |
| **Spaced Repetition (SRS)** | Listudy, Anki (SM-2) | `src/services/srs.ts`, Dexie `srs_cards` | Schedules personalized opening and tactical cards for daily practice, tracking ease factors and review intervals. |
| **Human-Like Engine Opponent** | Maia Chess (`CSSLab/maia-chess`) | `src/engine/human/`, `src/types/engine.ts` | Lets the user spar against an engine that moves like a real human at Elo 1100–1900 rather than an inhuman robotic minimax calculator. |
| **100% Client-Side Persistence** | Tabia | Dexie.js (IndexedDB) in `src/db/` | Zero-backend deployment on GitHub Pages; stores games, repertoires, diagnostics, and flashcards locally. |
| **Physical Board Printables** | Chess workbook pedagogy | `src/views/WorksheetView.tsx`, `@media print` CSS | Formats any lesson or personalized leak into printable paper worksheets with 2D diagrams, coordinates, exercises, and separate answer key. |

---

## 3. Detailed Leak Analysis for `hoot65`

Grounded in Explorer 2's empirical analysis of `hoot65`'s 4,000+ games on Chess.com, two critical recurring opening weaknesses were identified:

### 3.1 White Leak: Scandinavian Defense 2.e5?!
- **Context**: `hoot65` opens `1.e4` in 100% of White games. When Black responds with the Scandinavian Defense `1...d5`, `hoot65` frequently plays `2.e5?!` instead of capturing `2.exd5!`.
- **Game Evidence**:
  - `https://www.chess.com/game/live/185031553576` (plies 3-4: `2.e5 d4 3.Nf3 f6`) -> Checkmated.
  - `https://www.chess.com/game/live/185035281692` (plies 3-4: `2.e5 e6 3.d4 a6`) -> Loss on time in cramped structure.
  - `https://www.chess.com/game/live/184582182704` (ply 3: `2.e5...`) -> Resigned.
  - `https://www.chess.com/game/live/171000270176` (ply 3: `2.e5...`) -> Checkmated.
- **Diagnosis**: 
  - `2.e5?!` releases all central tension and surrenders the initiative. Black can play `2...c5` or `2...Bf5` freely developing their light-squared bishop outside the pawn chain before playing `...e6`, achieving a favorable French-style structure with no bad bishop.
  - Furthermore, Black's advanced `...d4` push often cramps White's queenside pieces. In `hoot65`'s games, this line scored only a 33% win rate.
- **Repertoire Refutation**:
  - The correct, master-level refutation is **`2.exd5!`**.
  - After `2...Qxd5 3.Nc3!`, White gains a free tempo attacking the Black queen (`3...Qa5 4.d4 Nf6 5.Nf3 c6 6.Bc4 Bf5 7.Bd2`). White achieves superior rapid development, central control, and a +0.8 advantage.

### 3.2 Black Leak: Premature ...Bg4 in Caro-Kann & Pirc Defenses
- **Context**: As Black, `hoot65` relies on the Caro-Kann Defense (`1.e4 c6`) and Pirc/Czech setups (`1.e4 d6`). Across multiple games, `hoot65` plays a premature `...Bg4` pinning White's knight or pawn before securing king safety or minor piece development.
- **Game Evidence**:
  - `https://www.chess.com/game/live/185282462950` (ply 10: `...Bg4?!`) -> Resigned after bishop harassed.
  - `https://www.chess.com/game/live/173676860416` (ply 6: `...Bg4?!`) -> Resigned after tactical pin collapse.
  - `https://www.chess.com/game/live/171894388406` (ply 8: `...Bg4?!`) -> Checkmated.
  - `https://www.chess.com/game/live/184720164178` (Pirc Czech: plies 7-10: `4.Bd3 Bg4?! 5.f3 Bh5 6.g4 Bg6`) -> Resigned after pieces pushed back and trapped.
- **Diagnosis**:
  - In Caro-Kann and Pirc structures, developing the bishop to `g4` before White has committed their queen or pieces allows White to gain easy tempos with `f3` or `h3`, followed by `g4` or `Qb3` attacking the weakened `b7` square (which is left unguarded once the bishop leaves the c8-h3 diagonal).
  - In several games, White traps the bishop or forces unfavorable trades, leaving Black with severe light-square weaknesses.
- **Repertoire Refutation**:
  - In the Caro-Kann Advance Variation (`1.e4 c6 2.d4 d5 3.e5`), Black must play **`3...Bf5!`** (not `...Bg4`), preserving the bishop's mobility and preventing `g4` traps.
  - Black then follows with `4...e6`, `5...c5`, `6...Nc6`, and `7...Nge7`, systematically undermining White's pawn chain.
  - Against `1.d4`, adopting the **King's Indian Defense (`1...Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6`)** keeps Black's pieces coordinated behind a secure pawn fortress before executing thematic breaks (`...e5` or `...c5`).

---

## 4. Conclusion

By synthesizing the proven UX and algorithmic paradigms of Listudy (PGN tree SRS), NeuralPGN/Chessdriller (game deviation analysis), Tabia (client-side architecture), Lichess Studies (branching annotations), and Maia Chess (neural human move prediction), `my-chess` delivers a coaching platform specifically personalized to `hoot65`'s rating, playing style, and concrete tactical weaknesses.
