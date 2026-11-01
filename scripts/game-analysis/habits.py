"""Step 2b: two-stage learning. A context model (game stage, evaluation, material) is fitted on
both players' moves; what it cannot explain (the residual) is what the move itself cost. A shallow
tree on the checks a player controls then finds the rules with the largest residual cost."""
import numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.tree import DecisionTreeRegressor, export_text
from load import moves
df = moves()
df = df[df.delta.notna() & df.wpBefore.notna()].copy()
df['isCapture'] = df['cap'].notna().astype(int)
df['clockFrac'] = (df['clockBefore'] / df['base']).fillna(1)
df['hang3'] = ((df.hangAfter >= 3) & (df.isCapture == 0)).astype(int)          # a minor piece or more can be taken, and the move was no capture
df['hangNew'] = ((df.hangAfter >= 2) & (df.threatBefore < 2)).astype(int)        # the move itself created the loose piece
df['checkNoCap'] = ((df.check == 1) & (df.isCapture == 0)).astype(int)
CTX = ['moveNo', 'wpBefore', 'matTotal', 'matDiff', 'nLegal', 'inCheck', 'threatBefore', 'freeBefore', 'mate1Avail']
ctx = HistGradientBoostingRegressor(max_depth=5, max_iter=400, learning_rate=0.05, random_state=0)
# Cross-fitted context predictions so no move predicts itself
df['ctxPred'] = np.nan
folds = np.random.RandomState(1).randint(0, 5, len(df))
for k in range(5):
    tr, te = folds != k, folds == k
    ctx.fit(df.loc[tr, CTX].fillna(-1), df.loc[tr, 'delta'], sample_weight=df.loc[tr, 'w'])
    df.loc[te, 'ctxPred'] = ctx.predict(df.loc[te, CTX].fillna(-1))
df['res'] = df.delta - df.ctxPred
df.to_pickle('moves_res.pkl')
games_w = df.groupby('g')['w'].first().sum()
H, O = df[df.mover == 'H'], df[df.mover == 'O']
ACT = ['hang3', 'hangNew', 'hangMoved', 'ignoredThreat', 'missedFree', 'missedMate', 'allowMate1', 'checkNoCap', 'isCapture', 'castle',
       'pawnShield', 'earlyQueen', 'spent', 'clockFrac']
tree = DecisionTreeRegressor(max_depth=3, min_weight_fraction_leaf=0.003, random_state=0)
tree.fit(H[ACT].fillna(-1), H.res, sample_weight=H.w)
print(export_text(tree, feature_names=ACT, decimals=3))
leaf = tree.apply(H[ACT].fillna(-1))
print("tree leaves (hoot65): per game, mean residual, residual points per game")
for lf in np.unique(leaf):
    m = leaf == lf
    print(f"  leaf {lf:3d}: {H.w[m].sum()/games_w:6.2f}/game  mean {np.average(H.res[m], weights=H.w[m]):+.4f}  pts/game {(H.res[m]*H.w[m]).sum()/games_w:+.4f}")
def row(name, mh, mo):
    h, o = H[mh], O[mo]
    print(f"  {name:52s} H {h.w.sum()/games_w:5.2f}/g {np.average(h.res, weights=h.w):+.4f} -> {(h.res*h.w).sum()/games_w:+.4f} | O {o.w.sum()/games_w:5.2f}/g {np.average(o.res, weights=o.w):+.4f} -> {(o.res*o.w).sum()/games_w:+.4f}")
print("\nrules: how often per game, residual cost per instance, residual points per game (hoot65 | opponents)")
for name, col in [('leaves a minor piece or more en prise (no capture)', 'hang3'), ('creates a new loose piece', 'hangNew'),
                  ('ignores a threat to a piece', 'ignoredThreat'), ('misses a free piece (2+)', 'missedFree'), ('misses mate in 1', 'missedMate'),
                  ('allows mate in 1', 'allowMate1'), ('gives a check that captures nothing', 'checkNoCap'), ('early queen move', 'earlyQueen'),
                  ('pawn push in front of the castled king', 'pawnShield')]:
    row(name, H[col] == 1, O[col] == 1)
for lo, hi in [(0, 30), (30, 60), (60, 120), (120, 300)]:
    row(f'rapid: clock {lo}-{hi} s', (H.base == 600) & (H.clockBefore >= lo) & (H.clockBefore < hi), (O.base == 600) & (O.clockBefore >= lo) & (O.clockBefore < hi))
