"""Markdown table for docs/game-analysis.md: per-rule frequency, value-head gain (bias removed) and
the simulator's gain. Simulated games are independent of the estimates that chose the better move,
so their gain needs no bias correction; the quiet positions are reported as a check."""
import json, numpy as np, pandas as pd
m = pd.read_pickle('gains.pkl'); gw = m.groupby('g')['w'].first().sum()
summ = json.load(open('gains-summary.json'))
sim = pd.read_csv('sim-results.csv')
q = sim[sim.rule == '!quiet'].sim.mean()
names = {'hang3': 'Leaves a minor piece or more where it can be taken', 'ignoredThreat': 'Leaves a threatened piece where it is',
         'missedFree': 'Does not take a free piece', 'allowMate1': 'Allows mate in one'}
masks = {'hang3': m.hang3 == 1, 'ignoredThreat': m.ignoredThreat == 1, 'missedFree': m.missedFree == 1, 'allowMate1': m.allowMate1 == 1}
print('| Check | Per game | Better move exists | Value head, pts/100 games | Simulator, pts/100 games (±1 se) |')
print('|---|---:|---:|---:|---:|')
for k, name in names.items():
    s = m[masks[k]]; per = s.w.sum() / gw
    differs = s[s.best != s.played].w.sum() / s.w.sum()  # the simulator sampled only these
    head = (s.excess * s.w).sum() / gw
    ss = sim[sim.rule == k]; d = ss.sim; se = ss.sim.std(ddof=1) / np.sqrt(len(ss))
    print(f"| {name} | {per:.2f} | {differs:.0%} | {head*100:.1f} | {d.mean()*differs*per*100:.1f} (±{se*differs*per*100:.1f}) |")
qs = sim[sim.rule == '!quiet'].sim
print(f"\nquiet positions: simulated gain of the value head's choice {qs.mean():+.4f} per move (se {qs.std(ddof=1)/np.sqrt(len(qs)):.4f})")
