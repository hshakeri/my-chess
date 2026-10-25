# Original User Request

## 2026-10-25T00:42:29Z

Build a personalized, 100% client-side 2D chess game and learning coach (deployable on GitHub Pages) that records chess notation, downloads and analyzes `hoot65`'s games from Chess.com alongside uploaded games in a persistent browser database, pinpoints recurring mistakes, automatically selects and teaches a tailored opening repertoire step-by-step using Lichess-inspired interactive drills, spaced repetition, and local chess PDF resources, and generates printable paper lessons for physical-board practice.

Working directory: /Users/hs9hd/Library/CloudStorage/Box-Box/My/chess
Integrity mode: development

Reference material:
- Chess.com Published-Data API spec: https://www.chess.com/news/view/published-data-api (player handle: `hoot65`, archives endpoint: https://api.chess.com/pub/player/hoot65/games/archives)
- Local chess PDF resources in `/Users/hs9hd/Library/CloudStorage/Box-Box/My/chess`: `Chess-Openings.pdf`, `kupdf.net_modern-chess-openings-15th-edition.pdf`, `null-101 Chess Opening Traps (Gambit Chess) ( PDFDrive ).pdf`, `TacticsInJuniorOpenings.pdf`, `LearningChess_Lessons_for_Beginners_-_Workbook_for_Students_Vol_1.pdf`, `7500.pdf`
- Target GitHub repository (for GitHub Pages static deployment): https://github.com/hshakeri/my-chess.git

## Requirements

### R1. 2D Playable Chess Game & Notation Foundation
Begin by building a responsive, Lichess-inspired 2D chess game that enforces complete legal chess rules, supports playing full games against an adjustable built-in opponent/coach with board controls (orientation flip, takeback, move-list navigation, custom FEN/PGN position setup), and records live standard chess notation (SAN move list and PGN export). Every capability across the application must operate 100% client-side in the browser so the entire app works on static GitHub Pages hosting without any backend server.

### R2. Chess.com (`hoot65`) Sync & Persistent Game Database
Download all published game archives for handle `hoot65` from the Chess.com Published-Data API to seed the player's history, and provide an in-browser live sync control for `hoot65` alongside manual PGN/game uploads (files and pasted PGNs, single or multi-game) with automatic deduplication. Store all games, analysis results, and learning progress in a persistent client-side browser database supporting search/filtering, interactive board replay, and full database export/import for backup and portability.

### R3. Open-Source Research, Weakness Diagnostics & Personalized Repertoire Selection
Survey similar open-source chess coaching, repertoire-training, and Lichess study/lesson projects on the web to incorporate proven learning workflows and UX patterns. Analyze `hoot65`'s historical and uploaded games (as both White and Black) to pinpoint concrete recurring issues—early opening deviations, fallen-into traps, missed tactics, and poorly scoring lines—and automatically choose a cohesive, step-by-step opening repertoire tailored to `hoot65`'s game history.

### R4. Step-by-Step Memorable Lessons & Printable Physical-Board Worksheets
Teach the chosen opening repertoire and tactical themes progressively using modern, memorable learning practices (Lichess-style interactive move-by-move lessons, conceptual explanations, mistake feedback with retry loops, and spaced-repetition review scheduling), enriched with structured openings, traps, and exercises distilled from the local PDF books in the working directory. Provide print-ready lesson generation that formats any opening lesson, trap guide, or personalized `hoot65` mistake drill into clean paper worksheets—complete with crisp 2D board diagrams, board coordinates, algebraic notation, guided exercises, and a separate answer key—for offline study on a physical chessboard.

### R5. Controlled Git & GitHub Pages Configuration
Initialize git in `/Users/hs9hd/Library/CloudStorage/Box-Box/My/chess`, set remote `origin` to `https://github.com/hshakeri/my-chess.git`, and configure both the static build base path and a GitHub Pages deployment workflow so the site runs cleanly at `https://hshakeri.github.io/my-chess/` as well as locally. Exclude raw `.pdf` files and build/dependency caches via `.gitignore` (to prevent committing large/copyrighted PDFs while keeping derived structured lesson data tracked), commit all deliverables locally, and **do not execute `git push`** or modify remote GitHub state—the user will push manually.

## Acceptance Criteria

### Playable 2D Game & Chess Notation
- [ ] Automated tests verify complete legal chess rules (castling, en passant, promotion, check, checkmate, stalemate, and draw rules), standard algebraic notation (SAN) recording, and lossless PGN import/export.
- [ ] Headless browser E2E test loads the app, plays a multi-move legal game on the 2D board against the built-in opponent, verifies the SAN notation list updates after each ply, navigates backward and forward through moves, and exports a valid PGN.

### Chess.com (`hoot65`) Sync & Client-Side Database
- [ ] All published monthly game archives for `hoot65` from `https://api.chess.com/pub/player/hoot65/games/archives` are fetched and verified against the live archive list, with `hoot65`'s games searchable and replayable in the app alongside working in-browser sync for new games.
- [ ] Headless browser E2E test uploads a multi-game PGN into the browser database, verifies duplicate detection, reloads the page to confirm client-side persistence, and completes a full database export, clear, and re-import round-trip with identical game counts.

### Personalized Weakness Diagnosis & Repertoire Selection
- [ ] Prior-art research notes (summarizing relevant open-source chess coaching/repertoire projects and Lichess lesson/study patterns) are committed in project documentation.
- [ ] Automated tests verify the diagnostic analyzer processes `hoot65`'s real games separately for White and Black, cites specific `hoot65` game identifiers and ply numbers for recurring opening deviations/mistakes (no hardcoded placeholder diagnostics), and automatically recommends concrete White and Black opening repertoire lines grounded in `hoot65`'s game history.

### Interactive Lessons, PDF Curriculum & Printable Worksheets
- [ ] Structured curriculum data distilled from the workspace PDF books contains valid FEN positions and move trees, with 100% of lesson moves programmatically verified as legal by a chess rules engine and tagged with source attribution.
- [ ] Headless browser E2E test completes a step-by-step interactive opening lesson, verifies distinct explanatory feedback on an incorrect move attempt followed by progression on the correct move, and confirms spaced-repetition scheduling state updates and persists across page reload.
- [ ] Automated headless browser print-to-PDF / print-mode verification renders printable worksheets for both a curriculum opening lesson and a personalized `hoot65` weakness drill, confirming interactive app navigation/chrome is hidden in print output, 2D board diagrams with coordinates and SAN notation render without horizontal overflow, and exercise solutions appear in a separate answer-key section.

### Static GitHub Pages Readiness & Git Safety
- [ ] Production static build succeeds cleanly and passes headless browser E2E smoke tests when served under the `/my-chess/` base path with zero console errors and zero failed asset requests.
- [ ] Programmatic git check confirms `origin` is `https://github.com/hshakeri/my-chess.git`, a GitHub Pages deployment workflow exists, `git ls-files '*.pdf'` is empty, the working tree is cleanly committed locally, and no `git push` was executed.


## Follow-up — 2026-10-25T00:45:04Z

IMPORTANT USER ADDENDUM:
The user specifically requested: **"can you include a chess engine that is closest to human play?"**

Please incorporate these updated requirements and acceptance criteria immediately:

1. **Updated R1 (Human-Like Chess Engine Opponent, 100% Client-Side for GitHub Pages)**:
   - The built-in playing/sparring opponent must include a **chess engine closest to real human play** (for example, client-side **Maia Chess** / `maia-chess` / `maia2` neural human-move-prediction models running directly in the browser via ONNX Runtime Web / WASM across selectable human Elo bands such as 1100–1900, combined with human game-frequency opening moves — see `https://maiachess.com` and `https://github.com/CSSLab/maia-chess`), rather than a robotic alpha-beta/minimax engine that plays inhumanly and injects random blunders.
   - You may also keep/pair Stockfish WASM or tactical search for objective mistake/centipawn evaluation in the coach, while ensuring playable games and repertoire sparring let the user play against the human-like engine at selectable human rating levels.
   - Everything (including model weights / WASM assets, sized cleanly for GitHub Pages without Git LFS issues) must run 100% client-side in the static GitHub Pages build (`/my-chess/` base path compatible, zero backend server calls).

2. **Additional Acceptance Criterion (Enforce in Build & Victory Audit)**:
   - `[ ] Automated engine and headless browser E2E tests verify the built-in opponent uses a genuinely human-like client-side chess engine across selectable human Elo tiers (e.g., in-browser Maia ONNX/WASM human-move-prediction models + human opening-frequency play, rather than naive random-blunder minimax), executing 100% locally in the browser (including under the /my-chess/ static subpath) with zero backend server calls and zero failed asset requests.`
