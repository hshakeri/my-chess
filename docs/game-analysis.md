# Where hoot65's points go: the archive analysed with the Maia simulator

**Question.** Across all of hoot65's Chess.com games, weighted toward recent ones, which simple
changes would gain the most points? And in what order should the lessons be studied?

**Data.** All 4,101 games in the Chess.com archive on 2026-11-01 (2,563 blitz, 1,107 rapid,
427 bullet, 4 daily). The 4 daily games are left out. A game's weight halves every 180 days, so the
436 rapid games of 2026 (10 minutes, no increment, rating 872 to 1151) carry most of the weight and
the 2022-2025 blitz games add evidence about habits.

**Method.** The toolkit is in `scripts/game-analysis/` (its README has the commands).

1. Maia, the human-move model the app already uses for play, scored all 230,051 positions. Maia
   is conditioned on both players' ratings, so its value head gives the expected score for players
   of those ratings. The change in hoot65's expected score across a move is what that move cost or
   gained.
2. Every move was described with checks a player can make at the board: was a piece left where it
   can be taken, was a threat ignored, was a free piece or a mate in one missed, how much time was
   left and how much was spent.
3. A two-stage learning step found the situations that cost points. A context model (gradient
   boosting on game stage, evaluation and material, fitted on both players' moves) predicts what a
   typical move costs in each situation. A shallow regression tree on the checks a player controls
   then explains what the context model cannot; its splits are the rules. Every rule was also
   compared with the opponents, who are players of the same rating in the same games.
4. For every recent decision, Maia's six most likely human moves were scored. A rule's gain is the
   expected score of the best of those moves minus that of the move played, summed over the
   positions where the rule applies and divided by the number of games.
5. The simulator replayed recent positions where each rule applied: Maia played both sides forward
   at their ratings, once after the move played and once after the better move, and the outcomes
   were compared.

Maia was trained on Lichess games, so Chess.com ratings were raised by 400 points before being
passed to it.

## The tweaks, ranked

Points per 100 games if the tweak is applied every time it applies (one point per 100 games is
about 7 rating points near a 50% score). The board checks overlap: together they are worth about
10 points per 100 games, roughly 70 rating points, if applied every time.

| Tweak | How often it applies | Points per 100 games |
|---|---|---:|
| Before every move, check that nothing you leave can be taken for free | 1.2 times a game | 5.7 |
| After every opponent move, ask what it attacks, then move or guard that piece | 1.3 times a game | 4.1 to 4.9 |
| Before every move, look for an enemy piece that nothing defends, and take it | 1.1 times a game | 2.6 to 3.6 |
| Keep pace with the clock: play prepared opening moves at once, cap a think at 30 seconds | 8% of games are lost on time | 3.1 |
| Do not resign unless a rook or more down | 11% of games are resigned that early | 1.7 |
| Before every move, check whether the opponent has a mate in one | once in 7 games | 1.3 to 1.8 |

Two thirds of the pieces left where they can be taken were already attacked before the move, so
the second check catches most of the first. The clock figure assumes hoot65 would lose on time only
as often as the opponents do (1.6% of games instead of 8.1%). The resignation figure is Maia's
expected score in the positions where hoot65 resigned while down less than a rook.

## Results

**hoot65 errs like the opponents, move for move.** Per move, blunders and mistakes come at the
same rate and cost as for the opponents (players of the same rating in the same games). Neither
side loses much in the first ten moves. The points are lost in the middlegame and endgame.

**Two things are specific to hoot65: the clock and resignations.** In the 10-minute games:

| Clock (weighted means) | hoot65 | Opponents |
|---|---:|---:|
| Seconds per move, moves 1-10 | 8.1 | 5.7 |
| Seconds per move, moves 11-30 | 13.9 | 11.4 |
| Thinks over 30 seconds per game | 2.3 | 1.3 |
| Clock left after move 30 | 4:01 | 5:20 |
| Moves played under 60 seconds, per game (90-day half-life) | 1.21 | 0.39 |

In the last year, 8.1% of hoot65's (weighted) games were lost on time and 1.6% were won on time.
Almost half of the time losses (16 of 38 games, 3.8% of all games by weight) came from positions
Maia scores as better for hoot65, at a median of move 45. Separately, hoot65 resigned 28.6% of the
games. In the 5% of games resigned while down at most 3 points of material, Maia still gave hoot65
about 17% expected score.

**The board checks that cost the most.** A gain is what playing the best of Maia's six likeliest
moves would add where the check applies. Taking the best of six noisy estimates looks better than
the move played even when nothing was wrong, so the value-head column subtracts what the same
calculation gives on quiet moves at the same stage of the game (0.02 to 0.03 per move). The
simulator played 12 games from each of 368 recent positions, once after the move played and once
after the better move, for 14 half-moves, and Maia scored where each game stood. Its games are independent of the
estimate that chose the better move, so it needs no such correction: on 80 quiet positions the
better move gained nothing (-0.002 ± 0.012 per move), which confirms the bias. On the positions where
a check applied, the two estimates agree:

| Check | Per game | A better move exists | Value head, points per 100 games | Simulator, points per 100 games (± 1 se) |
|---|---:|---:|---:|---:|
| Leaves a minor piece or more where it can be taken | 1.16 | 63% | 5.7 | 5.7 (± 1.6) |
| Leaves a threatened piece where it is | 1.30 | 64% | 4.9 | 4.1 (± 1.5) |
| Does not take a free piece | 1.10 | 56% | 2.6 | 3.6 (± 1.1) |
| Allows mate in one | 0.14 | 72% | 1.3 | 1.8 (± 0.3) |

The regression tree found the same order on its own: its first split is a minor piece or more left
where it can be taken, its second is allowing mate in one. The opponents make each of these errors
about as often as hoot65 does, so these gains are what anyone at this rating leaves on the board.
Giving checks that capture nothing is the one board habit hoot65 has more than the opponents (2.1
against 1.7 a game), but it costs little (about 2 points per 100 games, within the noise).

**Openings are not where the points are.** After removing the selection bias, no recurring opening
position in the last year is worth even 0.005 points per game: the moves played there are as good
as Maia's likely alternatives for players of this rating. The openings cost time instead (24
seconds more than the opponents by move 10), which is what the lessons can save.

## The lesson order

The default lesson list ("My Lessons"), the phone picker and Part I of the lesson book follow
`src/curriculum/patternPath.ts`: five groups whose lessons repeat one pattern, so the second and
third lesson of a group practise what the first introduced, often from the other colour. Each group
heading shows the check that catches the pattern at the board.

1. **The undefended piece on g4.** The Scandinavian drill, Meeting the Sicilian, and the Caro-Kann
   lesson on when ...Bg4 is safe. The answer is Qxg4 in all three.
2. **Loose pieces on the long lines.** The wall against the London, 2.c4, and 1.c4 or 1.Nf3, and the
   Caro-Kann Advance: the b2 pawn, the queen on c2, the bishops on d3 and b5.
3. **The king in the centre.** The Evans Gambit, Legal's mate, the wall against 2.Nc3 and 2.Bg5,
   and the Blackburne-Shilling drill: knight mates against a king that has not castled.
4. **The Caro-Kann bishop from both sides.** The Classical as Black, then the same line as White.
5. **Finish the game.** Mate with the queen, mate with the rook (rook on the seventh, king to the
   sixth, a waiting move, mate on the back rank), and mate rather than stalemate.

The first two groups train the most expensive checks in the games: a piece left where it can be
taken, a threat not answered, a free piece not taken. The third trains the costliest single error,
allowing mate in one.

## Drills from the games

The study path now opens with four drill sets made from hoot65's own positions
(`src/data/game_drills.json`, picked by `scripts/game-analysis/drills.mjs` and vetted by Stockfish 19
with `scripts/game-analysis/verify-drills.mjs`), in the order the checks are made at the board. The
first three come from a scan of the last year (144 candidates; 92 sound by Stockfish, see below):

1. **What does the last move attack?** Sixteen positions (March to October 2026) where the
   opponent's move put a piece in danger (a minor piece or more, undefended or attacked by something
   cheaper) and hoot65 left it there: five queens, four rooks, four knights and three bishops. In
   fourteen of the games the opponent took it on the next move.
2. **Take what is free.** Sixteen positions (May to October 2026) where an enemy piece could be won
   and hoot65 did not take it: nine knights, three queens (one on d1, attacked by a bishop on g4),
   three bishops and a rook. Seven came right after the opponent had taken a piece, so the free
   piece was a recapture.
3. **Is your move safe?** Sixteen positions (August to October 2026) where nothing of either side
   was in danger until hoot65's own move left a piece where it could be taken: seven bishops, six
   knights, two rooks and a queen. Seven of those moves took a pawn and gave up the piece for it:
   three bishop captures on f7, knights on a6 and d4, and rooks on g3 and e5. In ten of the games
   the opponent took the piece on the next move.
4. **Does your move allow mate?** Sixteen positions where hoot65's own move let the opponent give mate
   at once, while the game was still open: Maia's expected score between 15% and 85%, and Stockfish
   19 no worse than -2.5 for hoot65 before the move. Allowed mates are rarer than loose pieces, so
   this scan reaches back to January 2024 (54 positions, 22 of them in open games; the sixteen newest
   are used, from 2024-06-08 to 2026-10-10). Twelve of the mates were by the queen and four by a
   rook; the opponent found the mate in fifteen of the sixteen games. In ten of the positions hoot65
   stood five pawns or more ahead by Stockfish's count (once with a forced mate of their own) before
   the move that allowed it.

Each position is a one-decision lesson with its own review card. The opponent's last move is
replayed first, then every move that keeps the material (threats, safe moves, moves that allow no
mate) or wins it (free pieces) is accepted, measured by a material search over every legal move and
checked again one ply deeper. Stockfish 19 then vetted every candidate (depth 16, the picks again at
18, `scripts/game-analysis/verify-drills.mjs`): it dropped the positions from games that were already
lost (below -2.5 for hoot65; 39 of the 144 threat, free and hang candidates), those where the move
played cost less than 1.5 pawns (7), those left with no sound answer or no capture to replay (4), and
two whose facts the app's own tests reject (a capture that is taken straight back, an answer that no
longer saves the attacked piece); and it cut the accepted moves to those within 1.5 pawns of its best
move or still winning by 3 pawns, best first. Of the 36 drills on the path before, 27 survived: seven
came from games that were already lost (in one of them the move played was even Stockfish's first
choice), one cost less than 1.5 pawns at depth 18, and one gave way to a later position of the same
game. In the mate set the cut removed 44 of the moves the material search had accepted: each stops
the mate in one but scores at least 1.5 pawns below Stockfish's best and below +3 (in one position
four of them let a lead of 8.8 pawns fall to about 0). A wrong move that passes the drill's check
(it saves the piece, leaves nothing to take, or stops the mate) is told so, and that a stronger move
exists; the others get the drill's question again.
Playing the move from the game shows what it cost: the capture that followed (or the mate) is
played out on the board. The sixteen newest positions of each kind are kept, one per game (the
threat set has no more sound positions than that); the book prints the newest twelve of each on one
sheet. Re-run the scan, the vetting and `pick` as more games are played.
