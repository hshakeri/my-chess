"""Step 1: where hoot65's expected score goes, recency-weighted, against peers (the opponents)."""
import numpy as np, pandas as pd
from load import moves, wmean
df = moves()
df = df[df['delta'].notna() & df['wpBefore'].notna()].copy()
H, O = df[df.mover == 'H'], df[df.mover == 'O']
games_w = df.groupby('g')['w'].first().sum()
print(f"moves: hoot65 {len(H)}, opponents {len(O)}; weighted games {games_w:.1f} (half-life 180 days)")
print(f"mean delta per move: hoot65 {wmean(H.delta, H.w):+.4f}, opponents {wmean(O.delta, O.w):+.4f}")
def per_game(sub):  # weighted expected points lost per game in this subset
    return float((sub.delta.clip(upper=0) * sub.w).sum() / games_w)
def per_game_signed(sub):
    return float((sub.delta * sub.w).sum() / games_w)
print("\nloss per game by size of drop (hoot65 vs opponents, points per game):")
for lo, hi, name in [(-1, -0.3, 'huge  < -0.30'), (-0.3, -0.15, 'big  -0.30..-0.15'), (-0.15, -0.05, 'medium -0.15..-0.05'), (-0.05, 0, 'small  -0.05..0')]:
    h = H[(H.delta > lo) & (H.delta <= hi)]; o = O[(O.delta > lo) & (O.delta <= hi)]
    print(f"  {name:22s} hoot65 {per_game_signed(h):+.3f} ({h.w.sum()/games_w:.2f}/game)  opp {per_game_signed(o):+.3f} ({o.w.sum()/games_w:.2f}/game)")
print("\nby phase (signed delta per game):")
for ph in ['opening', 'middlegame', 'endgame']:
    print(f"  {ph:10s} hoot65 {per_game_signed(H[H.phase==ph]):+.3f}  opp {per_game_signed(O[O.phase==ph]):+.3f}")
print("\nby clock before the move (rapid 600 s games only):")
R = df[df.base == 600]
for lo, hi in [(300, 1e9), (120, 300), (60, 120), (30, 60), (0, 30)]:
    h = R[(R.mover=='H') & (R.clockBefore >= lo) & (R.clockBefore < hi)]; o = R[(R.mover=='O') & (R.clockBefore >= lo) & (R.clockBefore < hi)]
    print(f"  {lo:4.0f}-{hi if hi<1e9 else 600:4.0f}s  hoot65 moves {h.w.sum():7.1f} mean {wmean(h.delta,h.w):+.4f} | opp moves {o.w.sum():7.1f} mean {wmean(o.delta,o.w):+.4f}")
print("\nby time spent on the move (rapid, not forced, not recapture):")
RR = R[(R.nLegal > 1) & (R.recapture == 0)]
for lo, hi in [(0, 2), (2, 5), (5, 10), (10, 20), (20, 40), (40, 1e9)]:
    h = RR[(RR.mover=='H') & (RR.spent >= lo) & (RR.spent < hi)]; o = RR[(RR.mover=='O') & (RR.spent >= lo) & (RR.spent < hi)]
    print(f"  {lo:3.0f}-{hi if hi<1e9 else 999:3.0f}s  hoot65 share {h.w.sum()/RR[RR.mover=='H'].w.sum():.2f} mean {wmean(h.delta,h.w):+.4f} | opp share {o.w.sum()/RR[RR.mover=='O'].w.sum():.2f} mean {wmean(o.delta,o.w):+.4f}")
rules = {
  'leaves the moved piece en prise': 'hangMoved', 'leaves a piece (2+) en prise': 'hangPiece', 'ignores a threat to a piece': 'ignoredThreat',
  'misses a free piece': 'missedFree', 'misses mate in 1': 'missedMate', 'allows mate in 1': 'allowMate1', 'moves in under 2 s': 'fast',
  'moves under 60 s on the clock': 'lowTime', 'early queen move (moves 1-8)': 'earlyQueen', 'pushes a pawn in front of the castled king': 'pawnShield',
  'king moved without castling': 'kingMovedNoCastle', 'gives check': 'check'}
print("\nhabits: how often (per game) and how much each costs, hoot65 vs opponents")
print(f"  {'habit':45s} {'H/game':>7s} {'H mean':>8s} {'H pts/g':>8s} | {'O/game':>7s} {'O mean':>8s} {'O pts/g':>8s}")
for name, col in rules.items():
    h = H[H[col] == 1]; o = O[O[col] == 1]
    print(f"  {name:45s} {h.w.sum()/games_w:7.2f} {wmean(h.delta,h.w):+8.4f} {per_game_signed(h):+8.3f} | {o.w.sum()/games_w:7.2f} {wmean(o.delta,o.w):+8.4f} {per_game_signed(o):+8.3f}")
