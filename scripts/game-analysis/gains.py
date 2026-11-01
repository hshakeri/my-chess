"""Step 3: what each rule would gain. For every recent decision, Maia's six likeliest human moves
are scored; following a rule means playing the best of them where the rule fires. Gain per game is
the recency-weighted sum of (best - played) over those positions, per weighted game."""
import json, numpy as np, pandas as pd
from load import games, pass1_map, pass2
gs = games(); p1 = pass1_map()
recs = pd.DataFrame(pass2(gs, p1))
df = pd.read_pickle('moves_res.pkl')
H = df[df.mover == 'H'].rename(columns={'ply': 'p'})
m = recs.merge(H, on=['g', 'p'], how='inner')
m['gain'] = (m.bestWp - m.playedWp).clip(lower=0)
gw = df[df.g.isin(m.g.unique())].groupby('g')['w'].first().sum()
print(f"recent decisions with candidates: {len(m)}  (played move among Maia's top 6: {np.average(m.src == 'cand'):.0%}); weighted games {gw:.1f}")
print(f"upper bound, best of the top 6 at every move: {(m.gain*m.w).sum()/gw:.3f} pts/game")
# Taking the best of six noisy estimates beats the move played even when nothing was wrong. That
# selection bias is measured on quiet moves (no check applies) at the same stage and subtracted.
anyrule = (m.hang3 == 1) | (m.ignoredThreat == 1) | (m.missedFree == 1) | (m.allowMate1 == 1) | (m.missedMate == 1)
m['stage'] = pd.cut(m.moveNo, [0, 10, 20, 30, 40, 300], labels=False)
quiet = m[~anyrule & (m.checkNoCap == 0)]
floor = quiet.groupby('stage').apply(lambda s: np.average(s.gain, weights=s.w))
m['floor'] = m.stage.map(floor)
m['excess'] = m.gain - m.floor
print("noise floor by stage (moves 1-10, 11-20, 21-30, 31-40, 41+):", [round(v, 4) for v in floor.values])
rules = {'hang3': ('leaves a minor piece or more en prise (no capture)', m.hang3 == 1), 'ignoredThreat': ('ignores a threat to a piece', m.ignoredThreat == 1),
         'missedFree': ('misses a free piece (2+)', m.missedFree == 1), 'allowMate1': ('allows mate in 1', m.allowMate1 == 1),
         'missedMate': ('misses mate in 1', m.missedMate == 1), 'any': ('any of the board checks above', anyrule),
         'checkNoCap': ('gives a check that captures nothing', m.checkNoCap == 1), '!quiet': ('quiet moves', ~anyrule & (m.checkNoCap == 0))}
print(f"{'rule':52s} {'per game':>8s} {'gain':>6s} {'floor':>6s} {'excess':>7s} {'pts/game':>8s} {'Elo':>5s}")
rates = {}
for key, (name, mask) in rules.items():
    s = m[mask]
    per = s.w.sum() / gw; g = np.average(s.gain, weights=s.w); f = np.average(s.floor, weights=s.w); pts = (s.excess * s.w).sum() / gw
    rates[key] = per
    print(f"{name:52s} {per:8.2f} {g:6.3f} {f:6.3f} {g-f:7.3f} {pts:8.3f} {pts*695:5.0f}")
json.dump({'floor': [float(v) for v in floor.values], 'perGame': rates}, open('gains-summary.json', 'w'))
m.to_pickle('gains.pkl')
