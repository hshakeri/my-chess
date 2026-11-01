"""Step 4: the simulator's verdict. For each sampled position, the mean simulated score after the
better move minus after the move played (12 games each, 14 plies, then Maia's value head). The
simulated games are independent of the estimates that chose the better move, so the gain needs no
bias correction; on quiet positions it shows how much of the value head's apparent gain is real."""
import json, numpy as np, pandas as pd
meta = pd.DataFrame(json.load(open('sim-meta.json')))
out = {r['id']: r for r in json.load(open('sim-out.json'))}
meta['simPlayed'] = [out[f"{r.rule}|{r.g}|{r.p}|played"]['mean'] for r in meta.itertuples()]
meta['simBest'] = [out[f"{r.rule}|{r.g}|{r.p}|best"]['mean'] for r in meta.itertuples()]
meta['sim'] = meta.simBest - meta.simPlayed
meta['head'] = meta.bestWp - meta.playedWp
per_game = json.load(open('gains-summary.json'))['perGame']  # weighted instances per game (gains.py)
g = pd.read_pickle('gains.pkl')
cols = {'hang3': g.hang3 == 1, 'ignoredThreat': g.ignoredThreat == 1, 'missedFree': g.missedFree == 1, 'allowMate1': g.allowMate1 == 1}
# The simulator sampled only positions where Maia's best likely move differs from the move played
differs = {k: g[v & (g.best != g.played)].w.sum() / g[v].w.sum() for k, v in cols.items()}
print(f"{'rule':14s} {'n':>4s} {'value head':>10s} {'simulated':>10s} {'se':>6s} {'pts/game':>8s} {'Elo':>5s}")
for rule, s in meta.groupby('rule', sort=False):
    se = s.sim.std(ddof=1) / np.sqrt(len(s))
    pg = s.sim.mean() * differs[rule] * per_game[rule] if rule != '!quiet' else float('nan')
    print(f"{rule:14s} {len(s):4d} {s['head'].mean():10.3f} {s.sim.mean():10.3f} {se:6.3f} {pg:8.3f} {pg * 695:5.0f}")
print('correlation of value-head and simulated gains across positions:', round(np.corrcoef(meta['head'], meta.sim)[0, 1], 2))
meta.to_csv('sim-results.csv', index=False)
