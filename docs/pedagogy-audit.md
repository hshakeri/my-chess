# Pedagogical Audit and Improvement Roadmap for `my-chess`

**Scope.** This document audits how the current app teaches (`Interactive Lessons`, spaced repetition, `Opening Diagnostics`, `Printable Worksheets`, and the engine layer they depend on), evaluates it against modern chess pedagogy and learning science, and proposes a ranked roadmap. It is written for the maintainer of `my-chess` and for `hoot65` as the learner.

**Method.** Every claim below was produced by reading the code, replaying all 301 archived games with `chess.js` and the repository's own evaluator, benchmarking the engine in Node, and then adversarially re-verifying every high-severity finding against the cited files and data (counts and line numbers were reproduced independently; corrections are folded in). The copyrighted PDF sources are not present in the cloud checkout (they are gitignored, by design), so book attributions were judged on internal consistency only. Playwright could not launch with the stock config in this environment (browser revision mismatch), so the end-to-end suite was run only for the lessons spec with an executable-path override.

**Baseline.** 118 Vitest tests pass. `npm run build` succeeds (13.8 s). `git ls-files "*.pdf"` is empty.

**Implementation status (2026-10-25).** Batch A of the roadmap (QW-1 to QW-4 in Section 7) is implemented on branch `claude/ecstatic-heisenberg-kazs8b`. Diagnostics now analyse the live Dexie archive with nothing injected, measure each pattern's cost against the player's other games of that colour, cite only legal book moves, and add detectors for the early queen sortie and for a ...Bg4 that was actually punished; the board draws authored arrows and highlights (capped at three) and the Decision Point board shows the played move in red and the book move in green; the lesson player auto-plays leading opponent moves, opens drills at their decision point, accepts authored alternatives and any checkmate where the script says mate, renders the exercises and the mistake-and-refutation records, holds the finished line briefly before the exercise loads, and hides off-repertoire trap lessons behind a Pattern Library toggle; the spaced-repetition grade is gated until the lesson is complete, inferred from the run (downgrade only), keyed to the first real decision, and a due queue is shown. Page references were dropped from attributions and the drill descriptions now cite the archive's own dates and game ids. The decisions recorded in Section 9 were: Batch A first, then Batch C; keep 4.b4 as the Italian main line; Caro-Kann structures against 1.d4 instead of the King's Indian; keep the off-repertoire traps as a hidden pattern library; drop page references. Unit and end-to-end suites were updated deliberately where the old assertions encoded the behaviour this batch removes (constant evaluation deltas, injected games, the answer in a drill title, an ungated grade button).

**Terms.** SRS: spaced repetition system. SM-2: the SuperMemo-2 scheduling algorithm the app uses today. FSRS: Free Spaced Repetition Scheduler, an open-source alternative to SM-2 that models each item's difficulty, stability, and retrievability. SAN: standard algebraic notation for moves. FEN: Forsyth-Edwards Notation for positions. PGN: Portable Game Notation for whole games. ECO: Encyclopaedia of Chess Openings codes. QGD: Queen's Gambit Declined. KQK: king and queen against king. OTB: over the board (a physical set). CCT: checks, captures, threats (Heisman's pre-move safety check). cp: centipawns, hundredths of a pawn of evaluation. WDL: win/draw/loss probabilities. ONNX and ORT: the neural-network model format and the ONNX Runtime that executes it in the browser. E2E: end-to-end browser tests (Playwright). SSR: server-side rendering (the component unit tests render to a string). CI: continuous integration (the GitHub Actions workflow). MCQ: multiple-choice question. TTL: time to live of a cached entry. QR: the scannable square barcode. Tabiya: the standard position an opening line is played to reach.

---

## 1. Executive summary

The app is mechanically sound and well tested at the level of "the moves are legal and the board works", but as a *coach* it is pointed at the wrong targets, and its learning loop does not yet produce retrieval practice.

- **Every lesson, exercise, and repertoire line is legal** (231 lesson plies, 15 exercise solutions, 6 repertoire lines). The trap lessons' tactical claims are correct. The Evans Gambit lesson is on-repertoire and is hoot65's best-scoring White line (7 games, 6 wins). The Scandinavian drill targets a real habit: hoot65 pushed 2.e5?! in 15 of 17 Scandinavians.
- **The curriculum does not serve hoot65's actual repertoire.** 137 of 151 Black games are Caro-Kann, Pirc, or 1.d4 Nf6 systems; zero lessons let the student play Black moves in any of them. The three Black-side lessons are traps in openings hoot65 has reached 0 times (Smith-Morra Sicilian, Ruy Lopez, Queen's Gambit Declined). Six White lessons target lines reached 0 or 1 times in 150 games. Only 9 non-trivial user plies in the whole curriculum continue a line hoot65 has actually played.
- **The real losses are middlegame tactics with time on the clock, not openings.** Of 147 losses, 111 contain a depth-2-confirmed blunder of at least 200 centipawns; 68% occur in the middlegame (median ply 42), 64% are hanging-piece errors, 18% allow mate in one, and 92 of the 111 were played with more than three minutes left. hoot65 was checkmated 30 times, 13 of them with equal or better material. 26 losses were on time, 10 of them with equal or better material. The curriculum has 12 user plies of "fundamentals" and no tactics, mate-pattern, endgame-conversion, or clock content.
- **The one Black "leak" the app diagnoses (...Bg4) is not measurably costly** (48.2% score with it, 48.5% without; the bishop was never lost for free), its "+1.20" evaluation is a hard-coded constant, and 3...Bg4 is main-line theory in the Two Knights Caro-Kann. Meanwhile the 0-5 Blackburne-Shilling disaster (3...Nd4, twice losing to 4.Nxe5? Qg5!), the ...Qa5 habit (53 games, 21W-29L-3D), and the 11-19 record against 1.d4 have no detector and no lesson.
- **The interactive lesson loop is "guess the scripted move" with free retries.** Any of ~32 legal moves can be tried at no cost; hint level 2 reveals the destination square for every hinted move (and the full move for the 29 unhinted ones); the SRS grade is a self-reported button that is enabled before the lesson is complete and can be clicked repeatedly (five "Easy" clicks in five seconds move a card to Box 5 and a 41-day interval); one card represents a whole lesson of 13 to 22 plies (seven to eleven decisions), keyed to the start position with expected move `e4`; failed cards return in exactly 24 hours; nothing in the UI ever shows a due queue. Fifteen authored exercises, five authored mistake-and-refutation records, and seventeen opponent-move annotations are never rendered. Ten moves define arrows that the board cannot draw.
- **Diagnostics have integrity problems that undermine trust.** The view analyzes the bundled seed JSON, never the live database; a hard-coded list of twelve "canonical" games double-counts nine real games (eight of them producing duplicate leak cards) and adds three synthetic ones with fictional opponents, so the report claims 313 games for a 301-game archive; one "real" canonical game is the repertoire's Italian line pasted under a real game id; 40% of the "Master Refutation (Winning move)" labels are illegal moves in the position shown; and the "Practice Line" button discards its arguments, so no detected mistake can become a drill or a card.
- **Worksheets leak every answer onto page one**, print the board from White's side with a hard-coded "White to Move" caption even on the Black-to-move sheet, rely on CSS background colours that browsers omit when print settings exclude background graphics (an inference, to be confirmed by the print-emulation test proposed below), and one stored exercise position is unreachable with an answer-key move that is illegal from it (the position is not currently drawn). None of the over-the-board formats the brief asked about (solitaire scoring, visualization prompts, decision trees, QR deep links, re-attempt logs) exist, and the app has no URL routing to deep-link to.
- **The engine layer can support a coach but is not one yet.** Depth-2 review of a 55-ply game takes 13-28 s and depth 1 is too noisy to coach from; a two-line change to move generation gives a 2.5x speed-up with identical scores; Maia-3 runs (47 ms per position for policy and win-probability) and exposes exactly what a "how human was this blunder" review needs, but the adapter discards both outputs and no test ever loads the model.

The roadmap in Section 8 therefore leads with closing the diagnose-drill-review loop around hoot65's real errors, converting the lesson player into genuine retrieval practice with inferred grading and position-level FSRS scheduling, re-scoping the opening curriculum to the positions he actually reaches, and only then deepening the printable and visual layers.

---

## 2. How the coaching loop works today

| Layer | Files | What it does | What it does not do |
|---|---|---|---|
| Lesson data | `src/curriculum/{openings,antiGambits,traps,fundamentals,drills}.ts`, `builder.ts`, `types/curriculum.ts` | 14 lessons as one linear `moves[]` each, built and legality-checked by `buildVerifiedLesson`; optional `wrongMoveFeedback`, `arrows`, `highlights`, hints, `exercises`, `commonMistakesAndTraps` | No branching on opponent replies; no acceptance predicate beyond exact SAN |
| Lesson player | `src/views/LessonsView.tsx` | Compares the played SAN with the scripted move, shows specific or generic feedback, shakes and rolls back after 450 ms, auto-plays the scripted reply after 400 ms, three hint levels, four SRS grade buttons | Never renders exercises, mistake records, opponent annotations, arrows; no attempt counter; no due queue; no engine |
| Spaced repetition | `src/services/srs.ts`, `types/db.ts`, `db/database.ts` | SM-2 ease + Leitner boxes, one card per lesson, Dexie `srs_cards` plus a localStorage mirror | No per-position cards, no sub-day steps, no consumer of `getDueCards`, history only in localStorage |
| Diagnostics | `src/analytics/diagnostics.ts`, `repertoire.ts`, `views/DiagnosticsView.tsx` | Two literal detectors (1.e4 d5 2.e5; Black ...Bg4 within 12 plies after 1...c6/1...d6), win rates by ECO slug, six 20-ply repertoire lines | No ply-by-ply comparison with the repertoire; no link to lessons or cards; reads seed JSON, not the DB |
| Worksheets | `src/views/WorksheetsView.tsx`, `curriculum/worksheetsData.ts`, `index.css` | Five hand-written sheets: diagram, steps, annotated move list, exercises with fill-in lines, answer key after a page break | Not generated from lessons; no per-exercise diagrams; no orientation; no routing or QR |
| Engine | `src/engine/human/*`, `engine/worker/*` | Opening book (82 positions), then Maia-3 ONNX, then heuristic fallback; static plus quiescence evaluator | No review pipeline; evaluator has no time budget; Maia policy and WDL discarded |

---

## 3. What the app already teaches well

These are verified strengths and should be preserved through any redesign.

1. **Legality and internal consistency.** `buildVerifiedLesson` (`src/curriculum/builder.ts:94-99`) throws on any illegal SAN; all 231 plies replay; all 12 lesson exercise FENs equal the lesson position at the stated ply; all 6 repertoire lines are legal and their PGN strings match their move arrays.
2. **Correct tactics in the trap lessons.** Verified with `chess.js`: in the Siberian Trap every queen retreat after 9...Nd4 allows ...Nxf3+ and Qh2#; Legal's 6.Bxf7+ leaves exactly one legal reply and 7.Nd5# is mate; the Elephant Trap's 7...Bb4+ leaves exactly one legal reply; Noah's Ark traps the b3 bishop; the Elephant Gambit's 4.Qe2 makes ...exf3 illegal (`src/curriculum/traps.ts:69,85,140,147,260,331`, `antiGambits.ts:157`).
3. **Three lessons are on-repertoire and valuable.** Evans Gambit (hoot65 played 4.b4 in 7 games, 6W-1L; 7 of its 9 user plies start from positions he has reached at least 8 times). Legal's pattern (1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 occurred in 3 of his games). The Scandinavian 2.exd5 drill (2.e5 played in 15 of 17; the drill line is a known book line and 8...Nxd5/8...exd5 both lose the queen to 9.Bxa5, verified).
4. **Lesson-player basics.** SAN normalisation strips `!?+#` before matching (`LessonsView.tsx:142-145`); feedback is looked up by clean SAN, raw SAN, and destination square; the shake/rollback loop works; click and drag input both work; promotion has a modal; the `data-square`/`data-piece` DOM contract is stable and overlay-friendly.
5. **SM-2 arithmetic is correct and unit-tested** (`src/services/srs.ts:60-61`; `tests/unit/services/srs.spec.ts:17-96`).
6. **Data quality.** All 301 PGNs replay without error, 0 clock/move mismatches, every game carries `%clk` per move, and every repertoire/leak FEN is a valid position.
7. **Engine building blocks exist.** Checkmate and stalemate scoring are sign-correct from both sides; `classifyMoveDelta` computes the delta from the mover's perspective correctly; Maia-3 loads in Node in 0.56 s and infers at 47 ms per position (policy only) or 232 ms (top-5 candidates); on 25 hoot65 positions at Elo 1150 the move he actually played was Maia's top-1 56% and top-3 84% of the time. The request type already carries `fen`, `priorMoves`, and `elo`, and `App.tsx` auto-fires the engine on its turn, so a "spar from here" hand-off is cheap.
8. **Worksheet print basics.** Pieces are SVG `<img>` with explicit black/white fills (survive grayscale), coordinates print on all four sides, and the answer key has both modern and legacy page-break properties.

---

## 4. hoot65 in numbers

All figures are computed from `src/data/seed_hoot65_games.json` (301 games, 2026-05-02 to 2026-10-25, 300 rapid 10+0 and one blitz game, rapid rating 1076-1235). Raw scripts and the full statistics JSON are described in Appendix B. Score percentages count a draw as half.

### 4.1 Results and terminations

| | Games | W-L-D |
|---|---|---|
| All | 301 | 147-147-7 |
| As White | 150 | 77-72-1 |
| As Black | 151 | 70-75-6 |
| Games of 60 plies or fewer | 180 | 99-80-1 |
| Games longer than 60 plies | 121 | 48-67-6 |

| hoot65's 147 losses ended by | Count | hoot65's 147 wins ended by | Count |
|---|---|---|---|
| Resignation | 89 | Opponent resignation | 79 |
| Checkmate | 30 | Checkmate | 54 |
| Time | 26 | Time | 5 |
| Abandonment | 2 | Abandonment | 9 |

### 4.2 Opening tree as White (150 games, 1.e4 in all 150)

| Black's reply to 1.e4 | Games | W-L-D | hoot65's habit |
|---|---|---|---|
| 1...e5 | 71 | 34-37 | 2.Nf3 in 71/71; after 2...Nc6, 3.Bc4 in 53/53 |
| 1...c6 | 19 | 13-6 | 2.Nc3 (10), 2.Nf3 (8), 2.h3 (1); 2.d4 never |
| 1...d5 | 17 | 8-9 | 2.e5?! in 15, 2.exd5 in 2 |
| 1...c5 | 15 | 6-8-1 | 2.Nf3 then Bc4; never an Open Sicilian |
| 1...e6 | 10 | 5-5 | mostly 2.Nc3 |
| 1...g6 | 7 | 5-2 | |
| other | 11 | | |

After 1.e4 e5 2.Nf3 Nc6 3.Bc4 (53 games), Black's third move and hoot65's record:

| Black plays | Games | W-L | Note |
|---|---|---|---|
| 3...h6 | 16 | 8-8 | most common reply; no lesson |
| 3...Nf6 | 12 | 6-6 | hoot65 answers 4.d4 (10) |
| 3...Bc5 | 11 | 7-4 | hoot65 answers 4.b4 (7, 6W-1L), 4.O-O (3), 4.a3 (1); never the plan's 4.c3 |
| 3...Nd4 | 5 | 0-5 | 4.Nxe5?? Qg5 twice (one mated in 14 plies by ...Nf3#), 4.Nxd4 exd4 5.Qf3?! three times |
| 3...d6 | 4 | 2-2 | |
| 3...f5 | 3 | 1-2 | |

### 4.3 Opening tree as Black (151 games)

| White's first move | Games | W-L-D | hoot65's reply |
|---|---|---|---|
| 1.e4 | 108 | 54-50-4 | 1...c6 (67: 35-30-2), 1...d6 (41: 19-20-2); never 1...e5 or 1...c5 |
| 1.d4 | 30 | 11-19 | 1...Nf6 (29), then ...c6 (18) or ...d6 (9); never ...g6 |
| 1.c4 / 1.Nf3 / 1.b4 / other | 13 | 5-6-2 | ...Nf6 then ...c6/...d6 |

Caro-Kann branches faced (67 games): 2.d4 25 (13-11-1), 2.Nf3 20 (13-7), 2.Bc4 8 (5-2-1), 2.Nc3 4 (1-3), 2.e5 3, 2.d3 3, 2.f4 2 (0-2), 2.c3 1, 2.b3 1. After 2.d4 d5: 3.e5 14 (8-5-1, hoot65 played 3...Bf5 in all 14), 3.exd5 4 (2-2), 3.Nc3 3 (1-2), 3.f3 2 (2-0), 3.Nd2 1.

1.d4 systems faced (30 games): London 2.Bf4 11 (5-6), Queen's Gambit 2.c4 8 (2-6), 2.Nc3 3 (1-2), Trompowsky 2.Bg5 3 (1-2), Jobava 2 (2-0), Stonewall 2 (0-2), 1 other.

The "universal" Black set-up (...c6, ...Nf6, and ...d6 or ...d5 within the first eight moves) occurred in 83 games and scored 34-47-2 (42%); the other 68 Black games scored 36-28-4 (56%).

### 4.4 Habits with and without a measurable cost

| Habit | Frequency | Record | Verdict |
|---|---|---|---|
| 2.e5?! vs the Scandinavian | 15 of 17 | 7-8 (47%) vs 52% overall as White | real, theoretically passive, correctly targeted by the existing drill |
| Early ...Bg4 (within 12 plies, as Black) | 83 of 151 | 39-42-2 (48.2%) vs 31-33-4 (48.5%) without | **not** a result leak; bishop lost for free in 0 games; traded for a knight in 14; chased by h3/g4/f3 in 41 |
| ...Qa5 by move 8 (as Black) | 53 of 151 | 21-29-3 (42.5%) vs 49-46-3 (51.5%) without; queen moved again within 8 plies in 39 of 53 | real, undetected |
| Any queen move before ply 10 | 61 of 301 (20%) vs opponents 28 (9%) | 26-33-2 | real, undetected |
| Never castled as Black | 58 of 151 (38%) | 30-26-2 | symptom of the set-up, not an independent leak |
| 3...Nd4 Blackburne-Shilling faced | 5 | 0-5 | real, undetected, one-move fix (4.Nxd4!) |

### 4.5 Where the games are actually lost

Each of the 147 losses was scanned ply by ply with the repository's `TacticalEvaluator` (depth-1 screen, depth-2 confirmation of every candidate drop of at least 200 cp; 452 depth-1 false positives were rejected). 111 losses contain a confirmed blunder; 36 do not (positional or strategic losses the material-plus-piece-square evaluator cannot see). An independent re-run reproduced the totals, the phase split, the median ply, the think times, the clock and material figures, and the mate-in-one count; the other labels in the error-type table come from the first pass's classifier and were not re-derived.

| First confirmed blunder | Count | Share |
|---|---|---|
| Opening (ply 1-20) | 19 | 17% |
| Middlegame (ply 21-60) | 75 | 68% |
| Endgame (ply 61+) | 17 | 15% |
| Median ply | 42 | |

| Primary error type | Count |
|---|---|
| Failed to save a piece already attacked | 27 |
| Moved a piece to a square where it hangs | 25 |
| Allowed mate in one | 20 |
| Left a piece behind that hangs | 19 |
| Missed a free capture | 10 |
| Other / allowed forced mate | 10 |

Think time on the blunder move: median 13 s; only 18 of 111 under 3 s; 30 of 111 at 30 s or more. Clock at the blunder: median 356 s; 92 of 111 with more than 3 minutes left. Material before the blunder: ahead in 34 (14 by three points or more), equal in 28, behind in 49. Blundering piece: queen 24, knight 23, rook 20, king 15, pawn 14, bishop 13, castling 2.

### 4.6 Checkmates received and time

Of the 30 losses by checkmate, 13 came with equal or better material (6 with at least +3), 24 with more than 3 minutes left, and 21 were supported queen-touch mates or queen-plus-piece mates on f7/g7/h7. Only 2 were in the opening.

Of the 26 losses on time, 10 came with equal or better material (7 ahead by two points or more); their median length was 87 plies. hoot65 spends more time per move than his opponents in every phase (plies 1-10: 5.1 s vs 3.7 s; 11-30: 12.6 s vs 9.3 s; 31+: 12.5 s vs 10.5 s) and has 35 s less on the clock at ply 30 (463 s vs 498 s). Fast moves are not the problem: 28% of moves in losses took under 3 s versus 30% in wins. 110 games contain a single think of 60 s or more, and in 23 games the longest think of the game was itself a 200 cp blunder (13 in losses, 8 in wins, 2 in draws).

Premature resignation is not a problem: of 89 resignations, 70 were down a piece or more and only 9 were within one pawn.

---

## 5. Pedagogical blind spots, with evidence

Severity reflects learner impact. File references are to the current `main`.

### 5.1 Repertoire fit (high)

- Zero lessons teach hoot65's Black openings from Black's side. The only `targetColor: 'black'` lessons are the Siberian Trap (`src/curriculum/traps.ts:19`, a Smith-Morra Sicilian), Noah's Ark (`traps.ts:180`, Ruy Lopez), and the Elephant Trap (`traps.ts:291`, QGD): 29 user plies in openings reached 0 times in 151 Black games. The only Caro-Kann lesson (`drills.ts:161-291`) is taught from White's side and drills 2.d4, a move hoot65 played in 0 of 19 games against 1...c6, an opening he already scores 13-6 against.
- Six White lessons target lines that never occur: Scotch Gambit via 3.d4 (0 of 71 after 2.Nf3; hoot65 plays 3.Bc4 in 53 of 53 after 2...Nc6), Konikowski Gambit via 3.Bb5 (0 of 55 games reaching that position, 53 of them by the exact move order), Latvian 2...f5 (0 faced), Elephant 2...d5 (1 faced), Adams Attack against the Najdorf (0 Open Sicilians in 15), and the Caro 2.d4 drill (0 of 19). Of 121 user plies, 34 start from a position hoot65 has had on the board, 16 of those are 1.e4/1.d4/2.Nf3, and only 9 continue a line he has actually played (Evans Bc4/b4/c3/d4/O-O, Legal 3.Bc4, Scandinavian 2.exd5 and 3.Nc3, and one 1...d5).
- The real, uncovered leaks: 3...Nd4 (0-5), 3...h6 (16 games, the most common reply), early ...Qa5 (53 games), the 11-19 record against 1.d4, and the 2-9 record over 11 games in minor Caro-Kann branches (2.Nc3 exchange 0-3, 2.f4 0-2, 2.Nf3 exchange with ...Bg4 1-2, 3.Nc3 1-2).
- The recommended Black repertoire string "Caro-Kann & King's Indian" (`src/analytics/diagnostics.ts:467`, `DiagnosticsView.tsx:552`) has no lesson behind it, and hoot65 has never played ...g6 against 1.d4 in 29 games, so a King's Indian is a new opening, not a repair.
- Both personal drills cite wrong game dates: `drills.ts:18,23` and `worksheetsData.ts:199` say the meny_26 game was 2026/10/22 (archive game 185031553576 is 2026-10-08); `drills.ts:169,174` and `worksheetsData.ts:264` say the Brandon0015 game was 2026/10/21 (archive game 185135704918 is 2026-10-11).

### 5.2 Tactics, mates, and the clock are untaught (high)

The curriculum allocates 109 of 121 user plies to openings and traps and 12 to fundamentals (`fundamentals.ts` exports a queen-box mate of 11 plies and a one-ply stalemate lesson; `index.ts:90` advertises "CPR escapes" that no lesson contains). Nothing covers forks, pins, discovered attacks, back-rank or queen-touch mates, K+P or K+R technique, converting an extra piece, a checks-captures-threats blunder check, or clock use, even though Section 4.5 shows these decide hoot65's games and every PGN carries the clock data needed to teach pace.

### 5.3 The ...Bg4 diagnosis is wrong in kind (high)

`detectBlackPrematureBg4Leak` (`src/analytics/diagnostics.ts:278-319`) flags any Black ...Bg4 in the first 12 plies after 1...c6 or 1...d6 and attaches a constant `evaluationDelta: '+1.20'` (`:308`) and the claim that White "easily gains attacking tempos". The data shows no result cost (Section 4.4), 3...Bg4 is the main line of the Two Knights Caro-Kann, and the recommended antidote 3...Bf5 in the Advance (`repertoire.ts:169-186`) is a move hoot65 already plays 14 times out of 14. What does cost him is the aftermath: retreating ...Bh5 after h3 when g4 can be played for free (15 games ended the tracked window with the bishop on h5; of the 11 games with the immediate sequence ...Bg4 h3 Bh5, White replied g4 in 6), trading on f3 when it builds a Qf3+Bc4 battery on f7, and leaving b7 loose to Qb3/Qa4+. Two of the 65 flags land in games that followed the repertoire's own 3...Bf5. The lesson to write is a two-sided checklist (is there a knight to pin, am I happy to give bishop for knight, does the retreat square have an exit, is b7 or f7 loose), not a ban.

### 5.4 The lesson loop is recognition, not retrieval (high)

- **Free brute force.** A wrong move only sets text, shakes, and undoes after 450 ms (`LessonsView.tsx:169-203`); no attempt count exists anywhere in state (`:48-54`). The mean decision point has 32 legal moves (min 3, max 53).
- **Hints give the answer.** 92 of 121 user moves have `hintPiece`+`hintSquare`, and in 92 of 92 the hint square *is* the destination square; the other 29 fall through to `hintSquare || san` (`:519`) and print the move itself at level 2. Level 3 always prints the move (`:523-528`). `hintTheme` exists on 37 of 121 moves. Hint usage is never recorded.
- **Self-graded, ungated SRS.** The four grade buttons (`:589-620`) have no `disabled` attribute and are not tied to `isLessonComplete` (`:108`); `handleRateSRS` (`:212-222`) passes no `usedHint` or mistake data; `calculateNextReview`/`recordReview` never check `nextReviewTimestamp`. Reproduced: five grade-5 reviews one second apart produce box 5, interval 41 days, ease 3.0. A fresh card graded "Again" and one graded "Good" both come back in exactly one day.
- **Wrong unit of memory.** `createInitialCard` keys the card to `lesson.id` with `fen = lesson.initialFen` and `expectedMoveSan` = the first user move (`srs.ts:95-102`), so the Scandinavian drill's card asks for 1.e4 from the start position while the UI starts the drill at ply 2 asking for 2.exd5. `tests/unit/services/srs.spec.ts:25` locks this in.
- **No due queue, no intraday relearning.** `getDueCards` (`srs.ts:278`) and `getBoxStats` have no consumer outside tests; intervals are `now + intervalDays * MS_PER_DAY` (`:64`); cards are created lazily only for the lesson being viewed (`LessonsView.tsx:61-75`).
- **Dead pedagogy.** `LessonsView.tsx` never accesses `exercises` or `commonMistakesAndTraps` (15 exercises across all 14 lessons; 5 mistake records at `openings.ts:146-156`, `antiGambits.ts:112-122`, `fundamentals.ts:143-153`, `drills.ts:148-158,280-290`); the scripted reply (`:161-167`) never shows the 17 authored opponent annotations; `wrongMoveFeedback` exists on 2 user moves (`drills.ts:46-50,194-196`) and on one opponent move (`openings.ts:69-72`) that can never fire, so 119 of 121 user moves fall to the generic "Mistake: X is not the recommended move" text (`:182`).
- **Solution leakage.** Four lesson titles or subtitles contain the answer (e.g. "Weakness Drill: Scandinavian 2.exd5! Refutation"); the drill's `thematicObjective` is "Play 2.exd5! and 3.Nc3!" (`drills.ts:24`) and is shown in the header.
- **Exact-SAN matching rejects correct moves.** In the stalemate lesson (`fundamentals.ts:166,175`) both Qd8# and Qf8# mate but only Qd8# is accepted; in the queen-box lesson every ply has one accepted SAN and a scripted defender, so the technique is never practised against a different king move.
- **Black-perspective lessons start wrong.** For the three Black lessons `moves[0]` is White's move with `isUserMove: false`, `setupLessonBoard` never auto-plays it (`LessonsView.tsx:82-99`), `handleBoardMove` does not check `isUserMove` (`:139-145`), so the student must play 1.e4 or 1.d4 themselves and is told "Correct! Great move!" while the status line says "Black's turn" (`:561-564`).
- **Course filter bug.** Two courses share `category: 'white_repertoire'` (`src/curriculum/index.ts:35,52`), producing two identical "White Weapons" buttons; the anti-gambit course is unreachable through the filter (`LessonsView.tsx:246-247,315-331`).
- **Feedback timing.** The "why" is appended to praise after a correct move (`:152`); on a wrong move the board reverts before the student sees the consequence; there is no pre-move prompt of any kind.

### 5.5 Visual coaching does not exist (medium)

`ChessboardProps` (`src/components/Chessboard.tsx:11-21`) has no `arrows` or `highlights`; the only renderings are last-move tint, selection, check glow, legal-move dots, and a `customSquareStyles` class pass-through that `LessonsView` never uses. Ten lesson moves define arrows and three define highlights (`types/curriculum.ts:15-16`); `PROJECT.md:10` promises "visual arrows". The Diagnostics decision-point board is hand-rolled twice (`DiagnosticsView.tsx:135-174`, `424-467`, `743-785`), always White-at-bottom, and shows neither the played move nor the book move.

### 5.6 Diagnostics integrity (high)

- `App.tsx:420-424` renders `DiagnosticsView` with no `games` prop; `DiagnosticsView.tsx:73-76` falls back to the bundled seed JSON and never imports the repository or the database. New synced or uploaded games are never analyzed.
- `CANONICAL_HOOT65_GAMES` (`diagnostics.ts:17-217`, 201 of 483 lines) is appended to every analysis after a dedupe on `g.id` (`:329-335`); seed ids are `chesscom:<uuid>` while canonical ids are bare numerics, so the dedupe never matches. On the seed the report shows 313 games (156 White, 157 Black), 19 White leaks instead of 15, 69 Black leaks instead of 65, and eight duplicate leak cards. Three canonical games (ids 185500112233, 185600223344, 185700334455; opponents chessfan2026, tactician_bob, d4_master) do not exist in the archive. Canonical game 185894059676's move list (`:163`) is byte-identical to `repertoire.ts:78-79` and diverges from the real game at ply 6. Seven of nine canonical timestamps disagree with their own PGN date headers. On an empty database the report shows 12 games at 33% win rates. The view header says "Grounded in Real Chess.com Game History" (`DiagnosticsView.tsx:194`).
- `bookSan` is derived by a literal rule (`:298`), so 32 of 80 "Master Refutation ... (Winning move)" labels are illegal in the shown FEN (for example "Nf6" when the knight is already on f6). The evaluation delta is printed as centipawns though written in pawns (`DiagnosticsView.tsx:486`).
- `docs/coaching-prior-art.md:69-73` says `diagnostics.ts` "directly implements" first-divergence detection with a severity metric; no line in the file compares a played move to a repertoire move, and `findMatchingLine` (`repertoire.ts:288-312`) has no consumer in `src/`.
- Repertoire lines are six flat 20-ply arrays with `children` never populated; no archived game follows any line to its end; the longest matches are 6 plies as White (11 games) and 8 as Black (7 games).
- `onNavigateToLesson` is called with real ids (`DiagnosticsView.tsx:571`) and `App.tsx:422` discards them; `LessonsView` takes no props and always opens the Scandinavian drill; `onNavigateToGame` is never passed so the Replay button never renders; nothing creates an SRS card from an `OpeningDeviation`; the opening matrix is 152 unsorted rows of which 100 have one game; diagnostics are recomputed every render and never written to the `diagnostics` table; two E2E tests look for an "Adopt repertoire" button that does not exist and pass vacuously.

### 5.7 Worksheets (high for answer leakage, medium otherwise)

- All 8 answers appear on page 1: in subtitles (`worksheetsData.ts:14,79,146,189`), lesson summaries, the full annotated move list rendered as "Opening Sequence Notation" (`WorksheetsView.tsx:364-376`), the physical-board steps (`:203,269`), and exercise-2 prompts that restate exercise-1 answers; the sheet itself says "Do not look at the answer key yet" (`:401`).
- Scotch exercise 2 (`worksheetsData.ts:51`) has a white knight on h6 with the g8 knight still home; `7.Bxh6` (`:68,71`) is illegal from it. The guard test (`curriculum-legality.spec.ts:120-141`) validates only the sheet-level FEN and never replays an answer. The per-exercise FEN is currently dead data (the view renders only the sheet-level diagram), so the defect is latent rather than visible.
- The board is always rendered from White's side with the caption "White to Move (ranks 1-2)" (`WorksheetsView.tsx:22,291-316,339-341`), including the Siberian sheet whose FEN is Black to move.
- Squares are Tailwind background colours only (`:300-302`) with no `print-color-adjust`; when print settings omit background graphics (the default in common browsers; this was inferred, not rendered here) the pieces would print on an unchequered board.
- Three of eight exercises ask about a position that is never drawn; nine of fourteen lessons have no worksheet; the five that exist are hand-duplicated literals that have already drifted from their lessons (author fields, a trap warning on the opposite side, exercises that exist nowhere in the lesson).
- No solitaire/guess-the-move rows, points, visualization prompts, decision tree, rubric, or date/result log; no `@page`, `break-inside`, or multi-sheet printing; no URL routing (`App.tsx` tab state only), no QR dependency.

### 5.8 Engine readiness (medium)

- On 88 real middlegame positions, `TacticalEvaluator.search` costs 31 ms (depth 1), 442 ms (depth 2), and 2.2 s (depth 3) median; a 55-ply game at depth 2 takes 13-28 s and the 301-game archive about 2.6 hours. Depth 1 flagged 11 of 54 moves in a sample game as blunders; depth 2 flagged 3. Over 90% of the time is `chess.js` verbose move generation (2.29 ms vs 0.16 ms non-verbose); a variant generating SAN once per node returned identical scores on 88 of 88 positions at 2.0-2.5x speed.
- No transposition table, iterative deepening, time budget, or cancel message exists. The heuristic fallback at Elo 1700/1900 (depth 3/4) took 43 s and 207 s per move on a 37-move position (a second run measured 28 s and 133 s), far exceeding the 8 s worker timeout (`engineClient.ts:88-95`), after which the same search is re-run on the main thread and a second Maia load is started.
- `classifyMoveDelta` is not mate-aware (observed "Blunder (20285cp)") and labels any move within 10 cp "Best move" without computing a best move. Quiescence stands pat while in check and is capped at two captures, so quiet-check tactics need depth 2 and mate-in-2 needs depth 3.
- The Maia adapter hard-codes `topK: 5` (six forward passes per call), drops `result.moves` (the per-move policy) and `wdl`/`winProbability`, and reports a static material count as the "evaluation". No unit or E2E test loads the model. The opening book has 82 positions (max 9 plies), covers a mean of 3.76 plies of hoot65's games, lacks 1.e4 c6 2.Nc3 and 1.e4 d6, and offers 2.e5 against the Scandinavian at 5%. The worker sleeps 250 ms per request by default (`engineWorker.ts:36-39`).

### 5.9 Chess accuracy and attribution (medium)

Verified wrong: `drills.ts:98` "along the d-file" (d2-a5 is a diagonal); `drills.ts:108` "the knight attacks the queen on a5" (a knight on d5 cannot reach a5; the attack is the discovered Bd2); `fundamentals.ts:190` "Delivering check on c7 is stalemate" (Qc7 gives no check); `antiGambits.ts:18` ECO C65 for 3.Bb5 Bc5 (C64); `drills.ts:286` recommends 3.Nc3 from a position where the knight is already on c3; `openings.ts:95` "Black's only move to guard f7" (6...Ne5 and 6...d6 also avert mate). Overclaimed: "unavoidable checkmate" and "completely lost" (`worksheetsData.ts:24,63`) in a line whose own final annotation says material is restored; "completely paralyzed" with 31 legal moves and equal material (`antiGambits.ts:95`); "a full minor piece ahead" when it is knight for pawn (`traps.ts:349`). Of 167 text fields, 29 use words like lethal, devastating, crush, irresistible, or hopeless.

Attribution: `fundamentals.ts:18` cites "Lesson 6, pp. 64-75" and `:164` "Lesson 4, p. 73" (Lesson 4's page lies inside Lesson 6's range); the junior-tactics book is credited to an author named only "Dave" with page ranges that tile the book lesson by lesson; `drills.ts:141,273` record `sourceGame.white = 'hoot65 Diagnostic Antidote'` for games that never happened; the Giddins year and the Schiller/Watson co-authorship look wrong but cannot be checked without the PDFs. The legality spec only asserts that these strings exist.

### 5.10 Tests and build (medium)

- The 65 E2E tests contain 43 `if (await ...isVisible())` guards around interactions; two tests are fully vacuous today (the "Adopt" control does not exist), one has a malformed text selector, and the lesson tests assert nothing about state (the "persists across reload" test checks only that the view is visible). No test asserts arrows render, a due queue exists, exercises are shown, Maia is reached, or `wrongMoveFeedback` keys match.
- The three component specs are `renderToString` string checks under Vitest's `node` environment: effects never run, IndexedDB is absent, and the SRS "persistence" tests exercise only the in-memory fallback map.
- `dist/` is 150 MB of which about 99 MB is dead: 24 of 26 files in `public/wasm` are ORT variants the engine never requests (runtime traces fetch only `ort-wasm-simd-threaded.jsep.{mjs,wasm}`), and Vite additionally emits an identical 28 MB wasm into `dist/assets` that is never fetched because `maiaEngine.ts:39-46` overrides `wasmPaths`. No file exceeds 50 MB (largest 27 MB).
- `deploy.yml` runs `npm ci && npm run build` and no tests; `tsconfig.json` includes `tests/`, so a type error in a spec breaks the deploy while a failing test does not.
- `playwright` 1.64.1 expects Chromium 1248; `/opt/pw-browsers` has 1243. `TEST_INFRA.md:214-218` documents Node 24 and a macOS browser path; CI uses Node 22.

---

## 6. What the research says to build against

Full source lists are in Appendix C. The points below are the ones that change design decisions.

**Spacing and retrieval.**
- Key cards on canonical positions (first four FEN fields), not whole lines; recall is cued by the position (chunking/template theory), transpositions should share memory state, and line-level quizzing re-tests undue moves (Chessdriller's own TODO documents the pain).
- Use FSRS instead of SM-2 plus Leitner: `ts-fsrs` 5.4.2 is dependency-free (about 13.5 KB gzipped) and its default FSRS-6 weights, fit on hundreds of millions of reviews, outperform SM-2 for a small deck without any fitting. Set desired retention 0.90 for core positions and 0.85 for deep or rare ones; cap the maximum interval at a year.
- Same-day relearning matters: Anki's defaults are learning steps of 1 and 10 minutes, relearning 10 minutes; Chessdriller uses 0/10/60/480 minutes; successive relearning across sessions beats massed recalls (Rawson and Dunlosky). A failed move should resurface in minutes, not tomorrow.
- Infer the grade from behaviour: wrong move or move-revealing hint = Again; plan hint or slow = Hard; fast correct = Good; Easy only on stable review cards. Self-report misuse is a leading cause of poor scheduling (Anki's health check); every mature chess trainer auto-grades from the board.
- Interleave across openings and motifs within a session (Rohrer and Taylor; Kornell and Bjork; Brunmair and Richter meta-analysis), allowing one blocked walk-through on first exposure.
- Fade scaffolding by card state (expertise reversal, Kalyuga): new = worked example with rationale then immediate reproduction; learning = completion problem with a plan hint; review = bare retrieval. An 1150 player is a novice for each new line but not for basic tactics.
- Order and prune by reach probability: train the replies club players actually make (Chessbook's distinctive feature; the Lichess opening explorer exposes rating-bucketed move counts with open CORS), and order an over-cap queue by probability of reaching the position times probability of forgetting it.

**Coaching practice.**
- At 1000-1400 tactical oversights and clock collapse decide games (Heisman's Real Chess versus Hope Chess; Toth; Bartholomew; community analyses showing blunder rate roughly doubling below 10% clock). Make a blunder taxonomy the headline, not accuracy or centipawn loss.
- Review engine-off first: hide the evaluation, have the student mark two or three critical moments and write a reason, then reveal only at those plies plus any undisclosed decisive swing, and end with one loss-cause tag. Lichess's "Learn from your mistakes" gets the retry right and the "why" wrong; Chess.com's Game Review labels near-equal moves with false precision.
- Report win-probability swings, treat a band of near-equal moves as "fine", and never show the engine line before the student commits (pretesting effect).
- Visual cues: at most about three arrows or highlights per diagram, semantic colours, marking relations (attacker to target, undefended piece, pawn break, key square) rather than pieces; signalling helps low-prior-knowledge learners only when cues are sparse and distinctive.
- Transfer: "play it out" from tabiyas and critical moments against a limited opponent; solitaire chess with Pandolfini-style par scoring (par per move, partial credit, bonus for naming the idea; do not claim a rating estimate).
- Teach openings as one plan per structure with the replies the student actually meets; demote refutations of gambits he never faces to a pattern library.

**For hoot65 specifically.**
- White: one Italian plan (the d3/c3 Pianissimo for survival; the c3-d4 strike as the upgrade; keep the Evans as his best line) with answers to 3...h6, 3...Nf6, 3...Bc5, 3...Nd4, 3...d6, 3...f5; 2.exd5 against the Scandinavian with the 2...Nf6, 3...Qd6, 3...Qd8, 3...Qe5+ branches and the 5...Bg4 6.h3 Bh5 7.g4 chase; keep the Two Knights against the Caro-Kann (it scores 0.70); an Alapin against the Sicilian.
- Black: Caro-Kann plan cards per branch (Advance 3.e5 Bf5, Exchange, Classical, Fantasy, Two Knights 3...Bg4, 2.Nf3, 2.Bc4) and the c6-d5 wall against 1.d4 (Slav against 2.c4, ...Qb6 against the London) so every Black game shares one structure; a two-sided ...Bg4 checklist lesson; a "queen stays home" drill built from his own ...Qa5 positions.
- Data sources that a static site may use: the CC0 `lichess-org/chess-openings` ECO list (bundle it); the Lichess opening explorer (public; cross-origin requests are allowed according to the API specification and the server source, though this was not exercised from this environment; ratings 1000/1200/1400, rapid and blitz; one request at a time, cache for 30 days, bundled snapshot as offline fallback); never scrape Chess.com's explorer.

---

## 7. Ranked roadmap

Items are grouped into the three tiers the brief asked for. Within each tier they are ordered by learner impact per engineering day. Effort is S (one day or less), M (two to four days), L (five days or more). "Areas" lists which of the six investigation areas in the brief an item serves. Every item preserves the hard constraints: static GitHub Pages deployment, IndexedDB persistence, Web Worker engine, no PDFs in git, assets under 50 MB, and the existing tests either kept green or deliberately updated as noted.

### Tier 1: Quick high-impact wins (no schema migration; one to three days each)

**QW-1. Make the diagnostics honest and live.** Areas 4, 5.
- *Problem.* Section 5.6: seed-only analysis, 313 games reported for 301, three synthetic games, one pasted move list, 40% illegal "winning move" labels, constant evaluation deltas, wrong drill dates.
- *Why it matters.* A coach that misstates the student's record loses the trust every later drill depends on; the diagnostics are also the data source for every closed-loop feature below.
- *Design.* In `App.tsx` load games with `gamesRepo.getAllGames()` (DatabaseView already seeds the DB when empty) and pass them as `games`; delete the seed fallback in `DiagnosticsView`. Remove `CANONICAL_HOOT65_GAMES` from `analyze()`; keep only the nine real records as a test fixture (with move lists corrected to the archive) and delete the three synthetic ones. Derive `bookSan` from the repertoire line that matches the game prefix and assert legality with `chess.js` before emitting a deviation; omit the label when no legal book move is known. Replace `evaluationDelta` strings with `{scoreWith, scoreWithout, n}` computed from the archive; keep the "White Win Rate" and "Black Win Rate" headings the SSR spec asserts but add the sub-label "score; draws count half" and rename the matrix column to "Score". Sort the opening matrix by games descending, hide rows with fewer than three games, and group by the first six plies rather than by Chess.com's slug. Correct the two drill dates and read them from the archive game's PGN header at build time.
- *Files.* `src/analytics/diagnostics.ts`, `src/views/DiagnosticsView.tsx`, `src/App.tsx`, `src/types/diagnostics.ts`, `src/curriculum/drills.ts`, `src/curriculum/worksheetsData.ts`.
- *Tests.* Unit: `analyzeGames(seed).totalGamesAnalyzed === 301`; every emitted `bookSan` is legal at its FEN; every fixture id resolves to a seed game by URL suffix with `movesSan` a prefix of the real game. Keep the SSR strings in `tests/unit/analytics/diagnostics-view.spec.tsx` (the four real ids it asserts remain in the fixture). Update the two vacuous E2E "Adopt repertoire" tests to `test.fixme` until CL-4 ships.
- *Effort.* S-M. *Risks.* The diagnostics-view spec feeds the canonical array as input; keep the export name.

**QW-2. Draw the arrows: an SVG overlay for the board.** Areas 2, 4.
- *Problem.* Section 5.5: ten authored arrows and three highlights never render; diagnostics show neither the played nor the book move.
- *Why it matters.* Signalling research (Richter, Scheiter and Eitel 2016) shows sparse, distinctive cues help low-prior-knowledge learners; the arrow is the worked-example scaffold that lets the student *see* "Nc3 hits d5" before being asked to find it.
- *Design.* Add `arrows?` and `highlights?` props to `Chessboard`; render, after the grid `div`, an `<svg viewBox="0 0 8 8" class="absolute inset-0 pointer-events-none">` mapping squares through the existing `displayFiles`/`displayRanks` arrays so orientation is respected, with a `marker-end` arrowhead and four semantic colours (red attacker to target, green plan move, yellow weak square, blue defender). Cap at three cues per position. `pointer-events-none` keeps every `[data-square]` click and drag target hit-testable. In `LessonsView` pass the current move's arrows only after a correct move or from hint level 1, so arrows do not become a free give-away. In `DiagnosticsView` replace the two hand-rolled boards with `Chessboard` oriented to `leak.playedColor`, with a red arrow for the played move and a green one for the book move computed with `chess.js`.
- *Files.* `src/components/Chessboard.tsx`, `src/views/LessonsView.tsx`, `src/views/DiagnosticsView.tsx`, `src/index.css`.
- *Tests.* SSR unit test that a board with one arrow renders an `<svg>` with one `<line>`/`<path>` and that `data-square` attributes are unchanged; E2E 05 addition asserting the overlay appears after the correct 3.Nc3 (the drill's first move that defines an arrow; 2.exd5 defines none).
- *Effort.* S.

**QW-3. Lesson-player correctness pack.** Areas 2, 3.
- *Problem.* Section 5.4: Black lessons start on the wrong side; the course filter hides a course; exercises, mistake records, and opponent annotations never render; correct alternative moves are rejected; the board is live during rollback; titles print the answer.
- *Why it matters.* Specific, timely feedback and seeing the consequence of an error are what make corrective feedback stick (Hays, Kornell and Bjork 2012); a lesson that praises the student for playing the opponent's move teaches nothing.
- *Design.* (a) In `setupLessonBoard`, after seeking to the start ply, auto-play any leading non-user move with the same 400 ms reply path; derive the status label from `targetColor`; ignore moves when `!currentExpectedMove.isUserMove`. (b) Add `'anti_gambit'` to the course category union, set it on the anti-gambit course, key the filter by course id. (c) Add `isRollingBack` state and include it in `interactive`. (d) After the main line completes, render `lesson.exercises` as a quiz (position, prompt, expected `solutionSan[0]`, explanation after); on a wrong move that matches `commonMistakesAndTraps[].attemptedSan`, play the refutation line for about 1.5 s with `punishmentSummary` before rolling back. (e) Show the opponent move's `annotation` as an "Opponent idea" card after each auto-reply. (f) Add an optional `accept` field on `CurriculumMove` (`{ san: string[] }` or `{ predicate: 'checkmate' | 'any-legal-keeping-material' }`) so Qf8# is accepted in the stalemate lesson and KQK accepts any box-keeping move; the builder validates listed alternatives. (g) Add `startPly` to `CurriculumLesson` and remove the drill-specific special cases; derive the restart label from the first move. (h) Rename answer-bearing titles and objectives ("Weakness Drill: Meeting the Scandinavian") and show `thematicObjective` only after completion.
- *Files.* `src/views/LessonsView.tsx`, `src/types/curriculum.ts`, `src/curriculum/builder.ts`, `src/curriculum/index.ts`, `src/curriculum/drills.ts`, `src/curriculum/fundamentals.ts`, `package.json` (new dev dependencies `jsdom` and `@testing-library/react`, neither installed today).
- *Tests.* Unit: builder accepts `accept.san` alternatives and rejects illegal ones; a jsdom interaction test (add `// @vitest-environment jsdom` to the new spec once the dependency is installed) that a Black lesson's first White move is auto-played and that Qf8# is accepted. Deliberate SSR update: `tests/unit/curriculum/lessons-view.spec.tsx` asserts the literal title "Weakness Drill: Scandinavian 2.exd5! Refutation"; change it with the rename. The E2E regex `/Scandinavian|Anti-Scandinavian|Scotch/i` still matches and the drill must remain first in the "All" list.
- *Effort.* M (split into three half-day commits: a-c, d-e, f-h). *Risks.* The exercise quiz reuses the lesson board; keep the `data-feedback` attributes for E2E.

**QW-4. Gate and infer the SRS grade; show what is due.** Areas 1, 3.
- *Problem.* Section 5.4: ungated self-report, hints and mistakes ignored, no due queue, hint ladder collapses to the answer, cards created lazily.
- *Why it matters.* Self-assessment without a performance anchor is miscalibrated; Anki's health check names grade misuse as a leading cause of poor scheduling; every mature chess trainer grades from the board. Retrieval only strengthens memory when the learner generates the answer.
- *Design.* Track `attempts`, `mistakes`, and `maxHintLevel` per decision in `LessonsView` state. Disable the grade bar until `isLessonComplete` and after one rating per completion until the card is due. Compute a suggested grade (5 = no mistakes and no hints; 4 = one mistake or hint level 1; 3 = hint level 2 or two mistakes; 1 = three or more mistakes or hint level 3) shown as the default; let the student only downgrade. Pass `{ usedHint, mistakeCount }` to `recordReview` and persist them in history. Re-order the hint ladder: level 1 = `hintTheme` (fill the 84 missing themes), level 2 = `hintPiece`, level 3 = `hintSquare`; never fall back to the SAN. Seed cards for all lessons on first visit. Add a "Due today (N)" badge and a "Review due" mode that iterates `getDueCards()` and starts each due lesson at its `startPly`. Set the card's `fen`/`expectedMoveSan` to the first real decision (ply `startPly`), not the start position.
- *Files.* `src/views/LessonsView.tsx`, `src/services/srs.ts`.
- *Tests.* Unit: `recordReview` stores `usedHint`/`mistakeCount`; `createInitialCard` uses `startPly`; grade suggestion function table-tested. Update `srs.spec.ts:25` (expects `e4`) deliberately. E2E 05 ("persists across reload") and 09 ("Spaced Repetition Lifecycle") both click "Good" before completing the drill today and would time out on a disabled button; update both in the same change to complete the drill first, then assert the button is enabled and the SRS message "Scheduled next review in" appears once.
- *Effort.* S-M. *Depends on.* QW-3(g) for `startPly`. *Risks.* Day-granular intervals remain until CL-1; this item makes the grades honest, not the schedule.

**QW-5. Worksheet print and integrity fixes.** Area 6.
- *Problem.* Section 5.7: every answer on page one, wrong orientation and caption, unchequered print, corrupt exercise FEN, missing per-exercise diagrams, no date or score row.
- *Why it matters.* Guess-the-move only produces retrieval practice if the answer is not visible; a diagram the learner cannot transcribe to a wooden board defeats the purpose of paper.
- *Design.* Render the move list only up to the exercise ply with glyphs stripped; move solution-bearing prose (subtitle, summary, steps that spell out moves) to the answer page or rewrite it; derive side to move from the FEN and flip `RANKS`/`FILES` when `targetColor === 'black'`; add `@media print { .worksheet-board, .worksheet-board * { print-color-adjust: exact; -webkit-print-color-adjust: exact } }`, `@page { size: auto; margin: 12mm }`, and `break-inside: avoid` on exercise cards; fix the Scotch exercise-2 FEN to `r1bqk2r/ppppbppp/2n4n/3Q4/2B1P3/2p2N2/PP3PPP/RNB1K2R w KQkq - 2 7`; render a smaller diagram for every exercise whose FEN differs from the sheet diagram; add a header row "Date / Attempt / Score / Next review".
- *Files.* `src/views/WorksheetsView.tsx`, `src/curriculum/worksheetsData.ts`, `src/index.css`.
- *Tests.* Extend `curriculum-legality.spec.ts` to validate every exercise FEN and replay every answer-key sequence from its exercise FEN; add a unit test that no stripped answer token appears in any page-one field; E2E 06 with `page.emulateMedia({ media: 'print' })` asserting the dark-square background is non-transparent and a Black sheet shows "Black to move". Keep `data-printable` and `.fill-in-line` contracts.
- *Effort.* S-M.

**QW-6. Engine quick wins.** Areas 3, 4.
- *Problem.* Section 5.8: search 2.5x slower than necessary, heuristic opponent freezes at 1700/1900, mate-unaware classification, 99 MB of dead assets, 250 ms sleep per request.
- *Design.* In `TacticalEvaluator.search`/`quiescence` generate moves once with `chess.moves()` (SAN), derive mate/stalemate from `moves.length === 0 && inCheck()`, order captures by `'x'` in SAN, call `chess.move(san)`; keep verbose generation only at the root. Cap the heuristic profiles so a root move search stays under about 100 ms (1700 to depth 2, 1900 to depth 3 behind a time cap). Default `thinkingTimeMs` to 0 for `type: 'evaluate'`. Clamp evaluations to plus or minus 1000 before deltas, add explicit `missed_mate`/`allowed_mate` classes, and rename `best` to `fine`. A transposition table and iterative deepening are deliberately deferred (see the deferred list below): with Maia as the first pass in CL-3, the fixed-depth search only runs on a handful of flagged plies. Prune `public/wasm` to `ort-wasm-simd-threaded.jsep.{mjs,wasm}` and either drop the `wasmPaths` override (use Vite's emitted asset) or exclude the wasm from the bundle, so the duplicate 28 MB file disappears; derive the base path from `import.meta.env.BASE_URL`.
- *Files.* `src/engine/human/tacticalEvaluator.ts`, `heuristicFallback.ts`, `maiaEngine.ts`, `src/engine/worker/engineWorker.ts`, `public/wasm/`, `vite.config.ts`.
- *Tests.* Regression unit test asserting identical search scores on 30 fixed positions before and after the move-generation change; a timing test that every Elo band answers the spec's middlegame FEN under 2 s; a test that the set of files in `public/wasm` equals the set the ORT bundle references. Keep E2E 02's "no third-party requests" and 07's "no console errors" contracts.
- *Effort.* S-M. *Risks.* Verify in the browser that the ORT loader still resolves after the prune (the runtime trace lists exactly two files).

**QW-7. Test and CI hygiene.** All areas (protects them).
- *Design.* Add a `test` job to `.github/workflows/deploy.yml` (`npx vitest run`, then `npx playwright install --with-deps chromium && npx playwright test`) that `deploy` needs. Read `PLAYWRIGHT_EXECUTABLE_PATH` in `playwright.config.ts`. De-vacuum spec 05 and 09: remove the `if visible` guards around the drill flow and assert the opponent reply (`[data-square="d5"] img[alt="Black q"]` or the move-list text `Qxd5`), the shake class, and the SRS message; route the mocked 2026/09 archive in specs 03 and 09; fix the malformed `text=` selector in 04. Update `TEST_INFRA.md` to Node 22 and the Linux browser path.
- *Effort.* S.

**QW-8. Fix the chess-accuracy and attribution strings.** Area 5.
- *Design.* Correct the verified-wrong annotations listed in Section 5.9; strip superlatives; replace unverifiable `pagesRef` values with chapter or trap names until the PDFs on the maintainer's machine are checked; drop the fictional `sourceGame` players and cite the real archive game ids (185031553576, 185135704918) instead; add the Schiller co-author and check the Giddins year against the title page. Make `builder.ts` throw when a refutation move is illegal, have the legality spec replay the full `refutationSanList`, and require each list to end in a material or mate gain measurable with `chess.js` (which replaces the two lists that are legal continuations but not refutations, at `openings.ts:153` and `antiGambits.ts:119`).
- *Files.* `src/curriculum/*.ts`, `src/curriculum/builder.ts`, `tests/unit/curriculum/curriculum-legality.spec.ts`.
- *Effort.* S. *Risks.* The SSR spec asserts the author string "Dave"; keep it until the title page is checked.

### Tier 2: Core learning-loop upgrades

**CL-1. Position-level FSRS scheduling with a real daily session.** Areas 1, 3.
- *Problem.* Section 5.4: one card per lesson keyed to the start position; day-granular SM-2 with no relearning steps; no queue; history split across two stores.
- *Why it matters.* Recall is cued by the position (chunking and template theory), so the unit of memory must be the position; FSRS predicts retrievability, so the queue can surface what is about to be forgotten; successive relearning within minutes beats a 24-hour return (Rawson and Dunlosky; Anki defaults 1 m / 10 m); interleaving across openings and motifs improves discrimination and transfer (Rohrer and Taylor; Brunmair and Richter).
- *Design.* Add `ts-fsrs@5.4.2` (dependency-free, about 13.5 KB gzipped). Dexie `version(2)` declares all four new tables at once (`cards` and `revlog` for this item, `reviews` for CL-3, `explorer_cache` for DC-6) so later items need no further bump; `cards` (`&id` = canonical FEN key: first four fields with the en-passant field normalised to `-` unless a capture is legal, plus side; `accepted: string[]`; `lessonIds: string[]`; `tags: string[]` such as `opening:italian`, `color:w`, `blunder:hung-piece`; `ply`; `reachProb`; flattened FSRS fields `due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review`; `responseStats {n, meanMs}`; indexes on `due`, `state`, `*tags`, `*lessonIds`) and `revlog` (`++id, cardId, review, rating, state, stability, difficulty, elapsed_days, scheduled_days, responseMs, hintLevel, wrongSan, lessonId, sessionId`). Parameters: `generatorParameters({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: true, enable_short_term: true, learning_steps: ['1m','10m'], relearning_steps: ['10m'] })`, with a second instance at 0.85 for cards flagged deep or rare. Card generation: one card per user decision per lesson (and per branch after CL-2), shared when the FEN key already exists. Grade inference: wrong first try or move-revealing hint = Again; plan hint or response slower than `max(12 s, 2.5 × meanMs)` = Hard; fast correct = Good; Easy only for Review-state cards with retrievability above 0.95, response under 3 s, and at least three reps. Queue builder: due cards ordered by `(1 - R) × (0.5 + reachProb)`, round-robin across family tags so consecutive cards come from different openings or motifs, cap 30 reviews and 5-10 new cards per day, an in-memory min-heap of learning-step due times so a failed move resurfaces after about one and ten minutes, queue state in `sessionStorage`. Presentation by state: New = worked example (animate the move with its rationale and arrow, then require reproduction, graded at most Good); Learning/Relearning = completion problem with one plan hint; Review = bare position; after three lapses drop back to the worked example and enqueue an idea card. Line reinstatement: animate the four plies before a due card so the OTB context cue is present. "Today's session" view mixes due opening cards, blunder cards (CL-3), and tactic cards (DC-2) without showing lesson or motif names until after the answer. Migration: for each legacy `srs_cards` row, create the lesson's decision cards and replay its localStorage history through `f.reschedule` with the grade map 0-2 Again, 3 Hard, 4 Good, 5 Easy; then drop the localStorage mirror; export/import carry `cards` and `revlog`.
- *Files.* `src/services/srs.ts` (rewrite around `ts-fsrs`), `src/services/sessionQueue.ts` (new), `src/db/database.ts`, `src/types/db.ts`, `src/db/gamesRepo.ts` (export/import), `src/views/LessonsView.tsx`, `src/views/SessionView.tsx` (new), `package.json`.
- *Tests.* Unit: FEN canonicalisation (transpositions share a key; en-passant normalisation); grade inference table; queue interleaving (no two consecutive cards from the same family when more than one family is due); learning-step resurfacing; migration from fixture `srs_cards` rows; export/import round trip including `revlog`. Run `srs.spec.ts` under `fake-indexeddb` instead of the in-memory fallback. E2E: a new "Today's session" spec that fails a card, sees it return within the session, and reloads to find it still due. Deliberate SSR update: the label "Spaced Repetition Review (SM-2 / Leitner Box)" asserted in `lessons-view.spec.tsx` becomes an FSRS label.
- *Effort.* L (5-7 days). *Depends on.* QW-3, QW-4. *Risks.* Dexie upgrade must be idempotent; keep `srs_cards` read-only until a later `version(3)` drops it.

**CL-2. Branching lesson trees with realistic opponent replies.** Areas 1, 2, 5.
- *Problem.* Section 5.1 and 5.4: every lesson is one line; at 1150 the opponent leaves the script by move four to six almost every game (3...h6 16 times, 3...Nf6 12, 3...Bc5 11 after 3.Bc4; every real Evans reached 7...dxc3 while the lesson needs 7...d6).
- *Why it matters.* Transfer requires practising the decision the student will actually face; training against the replies club players make, weighted by frequency, is the one feature every serious opening trainer converges on.
- *Design.* Extend `CurriculumMove` with `alternatives?: Record<string, CurriculumMove[]>` on opponent moves (sub-lines keyed by SAN, each validated by the builder from the branch FEN) and a `frequency?` weight per alternative (from the archive now, from the explorer snapshot after DC-6). In `LessonsView` pick the opponent's branch by weight on each walk-through so the student meets variety; show the remaining branches as a collapsible tree (Tabia-style) beside the board. Every user decision in every branch becomes a CL-1 card. Lessons start at `startPly` (QW-3g). The existing `wrongMoveFeedback` on opponent moves (`openings.ts:69-72`) becomes real branches.
- *Files.* `src/types/curriculum.ts`, `src/curriculum/builder.ts`, `src/views/LessonsView.tsx`, `src/components/MoveTree.tsx` (new), lesson data files.
- *Tests.* Legality spec walks every branch; a test that branch selection respects weights (seeded RNG); a test that cards are created for branch decisions and shared across transpositions.
- *Effort.* M-L. *Depends on.* CL-1 for cards. Ships with branches seeded from the archive's observed replies for the existing lessons; DC-1 later supplies the re-scoped content on top of this data model.

**CL-3. Post-game coach review and the blunder-to-drill generator.** Areas 2, 4.
- *Problem.* Section 4.5 and 5.2: 111 decisive middlegame blunders with time on the clock and no mechanism to turn any of them into practice; the brief's "My mistakes become tomorrow's lesson" loop does not exist.
- *Why it matters.* Serious solitary study of one's own games is the strongest predictor of rating (Charness et al. 2005); engine-off-first review with forced commitment exploits the pretesting effect; errors are patterned and therefore learnable targets (Maia predicts the exact move of an 1100 player more than half the time).
- *Design.* Worker protocol: add `type: 'review'` with `{ gameId, movesSan, elo }`, `type: 'cancel'`, and `progress` messages. Pipeline per game: (1) Maia `predict(topK: 0)` at every position for `winProbability` and the policy probability of the move actually played ("a 1150 plays this X% of the time"); (2) flag plies whose win-probability swing exceeds about 15 points; (3) run `TacticalEvaluator.search` at depth 2 only on flagged plies to name the refutation and classify the error with rules over the position: *moved piece hangs* (destination attacked with attackers exceeding defenders), *left piece hangs*, *failed to save an attacked piece*, *missed free capture*, *allowed mate in one* (opponent has a mating move after), *missed forcing reply* (refutation is a check, capture, or threat); (4) attach the clock bucket from `%clk` and the phase; (5) store in a Dexie `reviews` table (`&gameId, reviewedAt, criticalMoments[]`). Review UI (engine-off first): replay with the evaluation hidden; the student marks two or three critical moments and types a one-line reason; then reveal the engine findings at those plies plus any undisclosed decisive swing; end with one loss-cause tag from the fixed taxonomy. Every confirmed blunder becomes a CL-1 card at the position before the error (`accepted` = engine refutation or any move that avoids the loss, tags `blunder:<type>`, `game:<id>`). Batch review of the archive runs in the worker with progress and cancel; results are cached per game and surfaced as a "Your patterns" dashboard (errors per 100 moves by type, by phase, by clock bucket, with a rolling 50-game trend) that replaces the opening matrix as the headline of the Diagnostics tab. Budget: Maia at 47 ms per position in Node (expect two to five times slower in WASM) gives roughly 5-13 s per game in the browser; depth-2 confirmation on three to five flagged plies adds one to three seconds.
- *Files.* `src/engine/worker/engineWorker.ts`, `engineClient.ts`, `src/engine/human/maiaEngine.ts` (expose `moves` and `wdl`, configurable `topK`), `src/analytics/review.ts` (new), `src/analytics/errorTaxonomy.ts` (new), `src/db/database.ts`, `src/views/ReviewView.tsx` (new), `src/views/DiagnosticsView.tsx`.
- *Tests.* Unit: taxonomy rules on constructed positions (hung queen, back-rank mate, missed fork); review of one fixture game produces the plies the Section 4.5 scan found; Maia loads in Vitest via `modelBytes` from `public/models` and returns a policy map whose size equals the legal-move count. E2E: open a game from the database, run review, see at least one critical moment and a created card.
- *Effort.* L (6-10 days). *Depends on.* QW-6, CL-1. *Risks.* First-load model download (about 22 MB) is already the case for play; show progress; the material-only evaluator cannot classify the 36 positional losses, so say so in the UI rather than inventing a label.

**CL-4. Repertoire divergence detection and the closed loop.** Areas 4, 5.
- *Problem.* Section 5.6: two literal detectors; no comparison with the repertoire; "Practice Line" discards its ids; nothing creates a card from a deviation; the opening report ignores the real leaks in Section 4.4.
- *Design.* Convert the repertoire plans in `repertoire.ts` into the same branching tree shape as CL-2 (populate `children`). For every game, walk the tree with `findMatchingLine`; when the first divergent ply is the student's, emit an `OpeningDeviation` with the tree's move as `bookSan` (legal by construction); aggregate by `(fenKey, playedSan)` with frequency and score-with versus score-without, and show the top leaks ranked by frequency times score deficit. Add data-driven detectors with explicit rules: *early queen sortie* (queen move before ply 10 with fewer than two minor pieces developed), *bishop-chase tax* (…Bg4 followed within three plies by h3 …Bh5 g4, or by Qb3/Qa4+ hitting b7), *mated while ahead*, *lost on time while ahead*, *3…Nd4 handling*, *universal set-up score*, *castle ply by colour*. Plumbing: `App` holds `pendingDrill: { lessonId?, fen, expectedSan, color, title } | null`; `DiagnosticsView` calls `onPracticeDeviation(leak)`; `lessonFromDeviation()` and `lessonFromRepertoireLine()` factories build a `CurriculumLesson` on the fly; `LessonsView` accepts `initialLesson`/`startPly`; `SrsService.createCardFromDeviation()` keys the card by FEN; `WorksheetsView` accepts the same card list (DC-4). Persist each `DiagnosticReport` in the `diagnostics` table and keep the latest few for trend display. Derive the recommendation strings from the computed leaks and the user's Decision 2 instead of the constants at `diagnostics.ts:466-467`.
- *Files.* `src/analytics/diagnostics.ts`, `repertoire.ts`, `src/views/DiagnosticsView.tsx`, `LessonsView.tsx`, `src/App.tsx`, `src/services/srs.ts`, `src/curriculum/factories.ts` (new).
- *Tests.* Unit: first-divergence on fixture games (including a transposition); each detector on constructed games; the "Adopt/Practice" E2E tests become real (`button[data-action="adopt-repertoire"]` exists and navigates to a lesson whose board shows the deviation FEN).
- *Effort.* M-L. *Depends on.* QW-1, CL-1.

**CL-5. Plan-first and Real Chess gates.** Areas 2, 3.
- *Problem.* Section 5.4: no pre-move prompt; brute force; the dominant error class (Section 4.5) is exactly the one a checks-captures-threats habit prevents.
- *Why it matters.* Asking the learner to state the threat before moving forces generation and exposes misconceptions (self-explanation; Heisman's Real Chess versus Hope Chess); comparing the stated plan with the outcome builds the calibration the grading now lacks.
- *Design.* Before gated decisions (any card in Review state, or any move with `hintTheme`/`wrongMoveFeedback`), the board is non-interactive until the student answers a one-click micro-question generated with `chess.js`: "What does the opponent's last move attack?" (click the squares), "Which of your pieces is undefended?", or "How many checks does the opponent have?" After the student's move, show the opponent's most frequent reply and ask whether it creates a check, capture, or threat that must be answered; ground truth from `chess.js` (in check, capture of an undefended or higher-value piece, mate-in-one threat via one-ply search). A miss logs a `cct` event and enqueues a tactic card at that position. Add a two-minute untimed board-vision warm-up ("click every square this knight attacks", "click your attacked and undefended pieces", "is this move safe?") generated from the student's own positions, scheduled by solve time outside FSRS.
- *Files.* `src/views/LessonsView.tsx`, `src/services/microQuestions.ts` (new), `src/views/WarmupView.tsx` (new).
- *Tests.* Unit: question generators produce correct answer sets on fixture positions; a gated decision blocks input until answered (jsdom).
- *Effort.* M. *Depends on.* QW-3, CL-1.

**CL-6. Spar the tabiya against Maia, with plan feedback.** Area 3.
- *Problem.* Lessons end at the tabiya with no way to test the plan; `LessonsView` has no engine access.
- *Why it matters.* Playing a studied position out against a human-like opponent is the standard transfer step (Lichess study practice mode, ChessBase "play out positions"); at 1100-1300 Maia produces the sidelines the student will meet.
- *Design.* Lift `EngineClient` into a React context so one worker and one model load serve all tabs. Add "Play 10 moves from here vs Maia (1100/1300)" at lesson end and on any card: `App` replays the lesson SAN onto a fresh `RulesEngine` (keeping `priorMoves` for Maia's history conditioning), sets orientation and `engineColor`, switches to the Play tab, and sends spar requests with `enableOpeningBook: false` and a short `thinkingTimeMs`. Each lesson declares `planMilestones` (castle by ply N, play the pawn break, occupy the key square, keep the bishop pair); after ten moves or on demand the coach panel reports which milestones were met and runs the CL-3 review on the sparred plies. Store spar results on the card for the insight panel.
- *Files.* `src/App.tsx`, `src/engine/EngineContext.tsx` (new), `src/views/LessonsView.tsx`, `src/types/curriculum.ts`, `src/analytics/planMilestones.ts` (new).
- *Tests.* Unit: milestone evaluation on fixture move lists; E2E: finish the Scandinavian drill, click spar, assert the Play tab shows the lesson's final position and the engine replies.
- *Effort.* M. *Depends on.* QW-6, CL-3 for post-spar review.

**CL-7. Visual coaching grammar and idea cards.** Area 2.
- *Design.* Extend QW-2 with automatically computed relation cues (attacker to undefended target, pawn break, key square) capped at three per position, semantic colours, and a one-sentence "why this square matters" caption per cue; author `[%cal]`/`[%csl]`-style data on the lesson moves so it exports to Lichess studies; add an `idea` card type ("What is White's main plan after 5.d3 in the Giuoco Pianissimo?", free recall or three-option MCQ) scheduled by the same FSRS instance so plans, not only moves, are rehearsed.
- *Files.* `src/components/Chessboard.tsx`, `src/analytics/cues.ts` (new), `src/types/curriculum.ts`, `src/services/srs.ts`.
- *Effort.* M. *Depends on.* QW-2, CL-1.

### Tier 3: Deep curriculum and over-the-board printable enhancements

**DC-1. Re-scope the curriculum around hoot65's real tree and publish a mastery skill tree.** Area 5.
- *Problem.* Section 5.1.
- *Design.* Skill tree with four rings per colour, unlocked by mastery (parent cards with stability above seven days, and the position reached in at least one archived game): *Core survival* (one plan card per structure, three plies deep), *Mainline plans*, *Common human sidelines* (branches weighted by archive and explorer frequency), *Gambits and traps*. White: Italian core after 3.Bc4 with one Pianissimo plan (d3, c3, O-O, Re1, h3, Bb3, Nbd2-f1-g3, then d4) and answers to 3...h6 ("a free move: strike d4"), 3...Nf6 (4.d3 survival; 4.d4 as the upgrade), 3...Bc5 (keep his 4.b4 Evans with the missing 5...Ba5 and 4...Bb6 branches; 4.c3 as the alternative), 3...Nd4 ("4.Nxd4!, never 4.Nxe5? Qg5!"), 3...d6 (Legal's conditions and the Qf3/Qb3 battery after ...Bxf3), 3...f5 (4.d3); 2...f6? Damiano; Scandinavian 2.exd5 with 2...Nf6, 3...Qd6, 3...Qd8, 3...Qe5+ and the 5...Bg4 6.h3 Bh5 7.g4 chase; Two Knights plan against the Caro-Kann (keep what scores 0.70; 3.h3?! is the error, 2.Nc3 is not); French Exchange or King's Indian Attack; Alapin against the Sicilian. Black: seven Caro-Kann branch cards with one-sentence plans (Advance 3.e5 Bf5 then ...e6, ...c5, ...Nc6/...Qb6, ...h5 against storms; Exchange with ...Qc7 or ...Bg4 then ...Qd7, never ...a6 against Bb5 pins; Panov with ...e6 before ...Bg4; Classical 6...h6!; Fantasy 3...e6; Two Knights 3...Bg4 4.h3 Bxf3; 2.Nf3 and 2.Bc4 lines) and the two traps he has lost to (Ng5/Qxd4?? and Bb5+/Ne5/...a6); the c6-d5 wall against 1.d4 (Slav against 2.c4; ...Qb6 against the London; ...c6/...Bf5 against Veresov and Trompowsky); a "queen stays home" drill built from his own ...Qa5 positions; a two-sided ...Bg4 checklist lesson using his own games for exercises; Blackburne-Shilling and anti-h6 lessons. Keep Konikowski, Siberian, Noah's Ark, Elephant Trap, Latvian, Elephant Gambit, and Adams Attack as a "pattern library" with `relevance: 'outside-repertoire'`, hidden from the default path. Add `scripts/validate-curriculum.ts` (run in CI) that checks legality of every branch, replays every exercise and refutation, lints mechanisable claims ("mate", "only move", "pawn up" against `chess.js`), checks attribution consistency, and checks that no answer token appears on a worksheet's first page.
- *Files.* New `src/curriculum/italianCore.ts`, `caroKannBlack.ts`, `queensPawnBlack.ts`, `bg4Checklist.ts`, `tactics/*.ts`; edits to existing lesson files; `src/curriculum/skillTree.ts` (new); `scripts/validate-curriculum.ts` (new).
- *Tests.* The validation script is itself a Vitest suite; a test that every skill-tree node has a lesson and that unlock rules are acyclic.
- *Effort.* L (content plus code; 8-12 days). *Depends on.* CL-2 for branching.

**DC-2. Tactics, mate-pattern, and endgame tracks from his own games.** Areas 1, 4, 5.
- *Design.* Generate a "spot the mate threat" set from the 30 mate losses one or two plies earlier; a hanging-piece and free-capture set from the 111 decisive errors and the missed-capture positions; include quiet "nothing to win, develop" control positions so the learner trains judgment, not only pattern spotting. Add K+R versus K, K+P versus K (opposition, square rule), and "up a piece: trade down" technique lessons with predicate acceptance and the heuristic engine (Elo 1100) as the defender. Curate 200-300 easy one- and two-move tactics tagged by motif as a Woodpecker-lite deck graded by solve time (under 5 s Good, 5-20 s Hard, wrong or over 20 s Again), interleaved by motif, retired after three consecutive fast solves.
- *Files.* `src/curriculum/tactics/*.ts`, `src/analytics/puzzleGen.ts` (new), `src/views/SessionView.tsx`.
- *Effort.* L. *Depends on.* CL-1, CL-3.

**DC-3. Time-management module.** Area 4.
- *Design.* Per-move clock profile from `%clk`; blunders bucketed by clock remaining (more than 50%, 25-50%, 10-25%, under 10%) beside hoot65's own curve; flags for thinks over 60 s and for fast moves at critical moments; a target pace for 10+0; the "won but lost on time" list (10 games); endgame-conversion sparring against the heuristic engine with a 600 s clock and a target of under 10 s per move after ply 40. Suggest an in-game cue (glance at the opponent's clock before clicking).
- *Files.* `src/analytics/clock.ts` (new), `src/views/DiagnosticsView.tsx`, `src/views/ReviewView.tsx`.
- *Effort.* M. *Depends on.* CL-3.

**DC-4. Worksheet generator and over-the-board formats.** Area 6.
- *Design.* `lessonToWorksheet(lesson)` derives moves (truncated at the exercise ply, glyphs stripped), diagrams, exercises, answer key, and trap warning from the lesson object, so every lesson and every card set has a sheet and screen and paper cannot drift; `cardsToWorksheet(cards)` prints Blunder-to-Drill sheets from CL-3 ("In your game vs {opponent} on {date} you played {move}. Find the better move.", six to eight diagrams per page, answers overleaf with the game URL). Solitaire/guess-the-move format: numbered rows "Move __: ______ (par __)" with a right-margin cover strip, par per move scaled by the gap between the game move and the second-best, partial credit for engine-approved alternatives, a bonus point for naming the idea from a short list, a totals box, and no rating claim. Visualization sheets: the position N plies before a tactic from his own game plus the move list, solve in the imagined position. Pocket one-page opening decision trees per colour generated from the repertoire tree with branch frequencies. A re-attempt log row (date, item, result, next date at 1/3/7/21 days). Multi-sheet print packet with `@page` and `break-inside: avoid`.
- *Files.* `src/curriculum/worksheetGen.ts` (new), `src/views/WorksheetsView.tsx`, `src/views/LessonsView.tsx` ("Print this lesson").
- *Tests.* Generated sheets pass the legality and answer-leak tests; E2E print emulation asserts page count per sheet.
- *Effort.* L. *Depends on.* QW-5, CL-3, CL-4.

**DC-5. Hash routing and QR deep links.** Area 6.
- *Design.* Library-free hash router in `App.tsx` (`#/lesson/<id>?ply=n`, `#/play?fen=...&color=...`, `#/worksheet/<id>`, `#/review/<gameId>`), lifting selected ids into App state and writing the hash with `history.replaceState`; GitHub Pages serves `index.html` for `/my-chess/`, so hash URLs need no 404 fallback. Add the `qrcode` package (SVG output) and render one QR per sheet and per exercise encoding `https://hshakeri.github.io/my-chess/#/lesson/<id>?ply=<n>`; a "record on-screen" step maps a paper attempt to an FSRS rating.
- *Files.* `src/App.tsx`, `src/router.ts` (new), `src/views/WorksheetsView.tsx`, `package.json`.
- *Tests.* Unit: route parser; E2E: open `/#/lesson/lesson-scandinavian-refutation-drill?ply=2` and assert the board.
- *Effort.* M.

**DC-6. Club-level opponent statistics and opening names.** Areas 1, 3, 5.
- *Design.* `src/services/explorer.ts` fetches the Lichess opening explorer (`variant=standard&speeds=rapid,blitz&ratings=1000,1200,1400`), maps moves to probabilities, caches in a Dexie `explorer_cache` table with a 30-day TTL, serialises requests, backs off 60 s on HTTP 429, and falls back to a bundled snapshot. `scripts/snapshot-explorer.ts` snapshots the roughly 200 FENs of the skill tree at build time so the static site ships realistic club probabilities; regenerate `openingBook.json` from the archive plus the snapshot so sparring reproduces what hoot65 actually faces (and no longer offers 2.e5). Compute `reachProb` per card from root to node. Bundle the CC0 `lichess-org/chess-openings` ECO list for opening names. Attribution footer. Explorer use is opt-in and the app works fully offline without it.
- *Files.* `src/services/explorer.ts` (new), `scripts/snapshot-explorer.ts` (new), `src/data/openingBook.json`, `src/data/eco.json` (new), `src/db/database.ts`.
- *Tests.* Unit with a mocked fetch (cache hit, TTL, 429 backoff); update E2E 02's third-party-request assertion to allow `explorer.lichess.org` or route-mock it.
- *Effort.* M.

**DC-7. Maia exposure, Elo fidelity, and tests.** Areas 3, 4.
- *Design.* Return `moves` (policy) and `wdl`/`winProbability` from `MaiaEngine.predict`; make `topK` per request; widen `elo` to a number for Maia requests (the `select[data-select="elo"]` control keeps its five options 1100-1900 for the E2E contract and the heuristic profiles) and pass `oppoElo` from PGN headers; add a Vitest spec that loads the ONNX via `modelBytes` and asserts a legal best move and a full policy map; add one E2E that waits for the Maia status and asserts `maia_neural`. Show "a 1150 plays this X% of the time" on blunder cards.
- *Files.* `src/engine/human/maiaEngine.ts`, `hybridEngine.ts`, `src/types/engine.ts`, `tests/unit/engine/maia.spec.ts` (new).
- *Effort.* M. (Most of this is a dependency of CL-3 and can be built with it.)

**DC-8. Progress and insight panel with habit scorecard.** Areas 1, 4.
- *Design.* Cards by state; mean retrievability of core cards; the ten cards with the highest `reachProb × (1 - R)` ("most likely to cost you a game"); confusion pairs (wrong SAN to correct SAN); projected reviews per day for two weeks so the retention slider can be tuned; a per-game habit scorecard computed from the PGN (castled by move 10, no piece hung, traded when ahead, king active in the endgame, CCT misses) with Hambleton-style level gating.
- *Files.* `src/views/InsightsView.tsx` (new), `src/analytics/habits.ts` (new).
- *Effort.* M. *Depends on.* CL-1, CL-3.

### What not to build, and why

- **A King's Indian course.** hoot65 has never played ...g6 against 1.d4 in 29 games; a brand-new opening is a large unevidenced ask when the c6-d5 wall reuses every Caro-Kann idea. Offer it only as an alternative card set.
- **More gambit refutations (Latvian, Elephant, Konikowski, Adams Attack).** Faced 0-1 times in 150 games; keep what exists as a pattern library, write nothing new.
- **Deep opening lines beyond about ply 8-10 in sidelines.** Reach probability is tiny at 1150; every MoveTrainer critique converges on "too many lines, too deep". Gate depth behind mastery.
- **Stockfish WASM.** Maia's win-probability plus depth-2 confirmation covers the blunder classes hoot65 actually makes; a full engine adds 7+ MB, thread/COOP complexity on GitHub Pages, and the temptation to coach from centipawns. Revisit only if the 36 unclassified positional losses need explanation.
- **FSRS parameter optimisation in the browser.** The deck will stay far below the few hundred reviews needed; default weights are the right choice.
- **Accuracy or average centipawn loss as the headline metric.** Noisy, opponent-dependent, and criticised by users of both big sites; use the error taxonomy and win-probability swings.
- **Timed coordinate or speed-first drills; full Woodpecker cycles; more than three arrows per diagram; engine lines shown before the student commits a move.** Each conflicts with the research consensus in Section 6.
- **Scraping Chess.com's explorer or shipping PDF-derived text verbatim.** Licence and terms of service; use the CC0 ECO list and the Lichess explorer API.

Deferred rather than rejected: a transposition table and iterative deepening for `TacticalEvaluator`. CL-3 confines the fixed-depth search to the few plies Maia flags, so the engine finding about missing search infrastructure is not on the critical path; revisit if review latency proves unacceptable.

### Coverage of the six investigation areas

| Area | Items |
|---|---|
| 1. Position-level, branching, FSRS scheduling | QW-4, CL-1, CL-2, CL-7, DC-2, DC-6, DC-8 |
| 2. Visual and conceptual teaching, plan-first gates | QW-2, QW-3, CL-3 (review cues), CL-5, CL-7 |
| 3. Desirable difficulties, interleaving, spar vs Maia | QW-4, CL-1, CL-5, CL-6, DC-6, DC-7 |
| 4. Closed coaching loop over all games | QW-1, CL-3, CL-4, DC-3, DC-7, DC-8 |
| 5. Curriculum depth, skill tree, validation script | QW-1, QW-8, CL-2, CL-4, DC-1, DC-6 |
| 6. Printable OTB pedagogy and QR deep links | QW-5, DC-4, DC-5 |

---

## 8. Sequencing and migrations

### 8.1 Suggested order

1. **Batch A, about one to two weeks: QW-1 through QW-4.** Honest diagnostics reading the live database, arrows on the board, a lesson player that no longer praises the wrong side and finally shows its exercises and refutations, and an SRS whose grade reflects what happened. These are visible to the learner on day one and need no schema change.
2. **Batch B, about one week: QW-5 through QW-8.** Printable sheets that hide their answers and print correctly, a 2.5x faster engine that never freezes, 99 MB less to deploy, CI that runs the tests, and chess annotations that are literally correct.
3. **Batch C, two to three weeks: CL-1, then CL-4, then CL-2.** Position-level FSRS with a daily session is the foundation every later feature writes into; divergence detection closes the diagnose-to-drill hand-off; branching trees make the opening lessons survive the opponent's first deviation. Curriculum authoring for DC-1 can start in parallel because it is data.
4. **Batch D, two to three weeks: DC-7, CL-3, CL-6.** Expose Maia, build the review pipeline and the blunder-to-drill generator, then sparring from the tabiya with post-spar review.
5. **Batch E: CL-5, CL-7, DC-1.** Gates and cues on top of the new loop; the re-scoped curriculum lands as content.
6. **Batch F: DC-2, DC-3, DC-4, DC-5, DC-6, DC-8** in whatever order the learner finds most useful; DC-4 and DC-5 together deliver the over-the-board story.

### 8.2 Migrations

- **Dexie.** `version(2)` adds `cards`, `revlog`, `reviews`, and `explorer_cache`; the legacy `srs_cards` table stays readable for the one-shot migration in CL-1 and is dropped in a later `version(3)`. Export schema version becomes 2 and carries the new tables; import must accept version 1 files. The localStorage SRS mirror is read once during migration and then removed.
- **SSR-tested component strings.** Three specs assert literal first-render strings. Deliberate changes: the Scandinavian drill title (QW-3h), the "Spaced Repetition Review (SM-2 / Leitner Box)" label (CL-1), and the recommendation string "Caro-Kann & King's Indian" if the user adopts the c6-d5 wall (Decision 2, implemented in CL-4). Kept unchanged: "White Win Rate" and "Black Win Rate" (QW-1 adds a sub-label instead). Migrating the three specs to jsdom and `@testing-library/react` (neither installed today) during Batch A would let effects and interactions be tested at all.
- **E2E contracts.** Keep every `data-*` attribute listed in the tests-and-build digest; the drill must remain the first match of `/Scandinavian|Anti-Scandinavian|Scotch/i`; specs 05 and 09 click "Good" before completing the drill and are updated together in QW-4; the "Adopt repertoire" tests become real in CL-4; the no-third-party-request assertion in spec 02 needs a route mock once DC-6 ships; the Elo select keeps its five options (DC-7).
- **Engine assets.** After QW-6 the deploy carries two ORT files and the model (about 49 MB total download on first engine use, unchanged for the learner, 99 MB less in the artifact).

---

## 9. Decisions only the user can make

1. **Italian upgrade: keep 4.b4 (Evans, 6W-1L) as the main line after 3...Bc5, or adopt the repertoire plan's 4.c3?** The data says keep the Evans and complete its branches; the plan file says 4.c3.
2. **Against 1.d4: the c6-d5 wall (Slav against 2.c4, Caro-style against the London) that reuses hoot65's structures, or a King's Indian he has never played?** The audit recommends the wall and would change the recommendation string in the diagnostics.
3. **Keep 1...d6 (Pirc, 41 games, 19-20-2) as a second Black defence, or fold it into 1...c6?** The Czech ...c6 systems he plays transpose easily; one structure lowers the learning load.
4. **Off-repertoire lessons (Konikowski, Siberian, Noah's Ark, Elephant Trap, Latvian, Elephant Gambit, Adams Attack): keep as a hidden pattern library, or delete?** Keeping costs nothing once they are flagged; deleting shortens the lesson list.
5. **Switch the scheduler label and semantics from SM-2/Leitner to FSRS (CL-1)?** This is the recommended path and changes one asserted string.
6. **Allow optional network calls to the Lichess opening explorer (DC-6)?** Fully offline operation remains the default; the explorer improves branch weights and sparring realism.
7. **Attributions.** The PDFs are only on your machine: please check the title pages for the junior-tactics author's full name, the Giddins publication year, the Schiller/Watson co-authorship, and the Pinter lesson page numbers, or approve dropping `pagesRef` in favour of chapter names.
8. **Which batch to build first.** The audit recommends Batch A (QW-1 to QW-4), then Batch C (CL-1, CL-4, CL-2).

---

## Appendix A. Corrections to existing project documents

- `PROJECT.md:10` says the lesson viewer has "visual arrows"; the board has no arrow renderer (QW-2 adds one).
- `docs/coaching-prior-art.md:69-73` says `diagnostics.ts` "directly implements" first-divergence detection with a severity metric; it does not (CL-4 adds it). `docs/coaching-prior-art.md:165` cites `src/views/WorksheetView.tsx`; the file is `WorksheetsView.tsx`.
- `TEST_INFRA.md:214-218` documents Node 24 and a macOS Playwright path; CI uses Node 22 and this environment needs a Linux executable path. `TEST_INFRA.md:47` lists a `worksheet-data.spec.ts` that does not exist.
- `src/curriculum/index.ts:90` advertises "CPR escapes" that no lesson contains.

## Appendix B. Reproducibility

All statistics in Sections 4 and 5 were computed by TypeScript scripts run with `npx tsx` against `src/data/seed_hoot65_games.json` using `chess.js` and `src/engine/human/tacticalEvaluator.ts`, and independently re-run by a second pass. The decisive-error scan used a depth-1 screen of every hoot65 move in the 147 losses followed by depth-2 confirmation of each candidate drop of at least 200 cp (847 s total in Node on this container). Engine benchmarks used 88 middlegame positions (plies 20-39) sampled deterministically from every third game. Maia timings used `maia3-js/web` with `modelBytes` from `public/models/maia3_5m.onnx` under Node 22. The scripts are not part of the repository; DC-1's `scripts/validate-curriculum.ts` and CL-3's review pipeline are the productised versions of these one-off scans.

## Appendix C. Sources consulted

Learning science: Chase and Simon 1973 and Gobet and Simon 1996 (chunking and templates); Rohrer and Taylor 2007, Kornell and Bjork 2008, Brunmair and Richter 2019 (interleaving); Roediger and Karpicke 2006, Karpicke and Roediger 2007, Rawson and Dunlosky 2011 (retrieval and successive relearning); Cepeda et al. 2008 (spacing ridgeline); Bjork and Bjork 2011 (desirable difficulties); Kornell, Hays and Bjork 2009 and Richland, Kornell and Kao 2009 (pretesting); Kalyuga 2007 (expertise reversal and faded examples); Richter, Scheiter and Eitel 2016 (signalling); Charness et al. 2005 and Burgoyne et al. 2019 (serious study and chess skill); Dunlosky et al. 2013 (learning techniques). Scheduling: FSRS algorithm and benchmark (open-spaced-repetition), `ts-fsrs` 5.4.2, Anki deck-option defaults and source. Chess training tools: Chessable MoveTrainer and its critiques (Kabadayi, Matuschak, Zwischenzug, Juntai Keda), Chessbook, Chessdriller (source and TODO), Listudy (source), Chess Position Trainer, Lichess "Learn from your mistakes", Lichess and Chess.com Insights, Aimchess, Chessiverse, ChessDojo. Coaching practice: Heisman (Real Chess, counting, Novice Nook), Toth, Bartholomew, Hambleton, Studer, Silman and Hendriks, Pandolfini's Solitaire Chess columns, Shlyakhtenko and Kuljasevic on tabiyas, Rios *Chess Structures*, the Steps Method manuals, Smith and Tikkanen *The Woodpecker Method*. Opening theory for the specific lines: Wikipedia and Wikibooks opening pages, ChessPublishing, thechessworld, Exeter Chess Club, Nunn on the Evans Gambit, Kornev's d5-c6 repertoire, the Lichess opening explorer API specification, `lichess-org/chess-openings` (CC0). Full URL lists are retained in the audit working files.
