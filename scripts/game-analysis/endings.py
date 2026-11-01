"""How recent games end: losses on time and resignations, scored by Maia's expected score at the end."""
import json, os, numpy as np, pandas as pd
from load import games, moves, wmean, HALF_LIFE_DAYS, A
gs = games()
p1 = {}
for f in ['pass1-0.jsonl', 'pass1-1.jsonl']:
    for l in open(os.path.join(A, f)):
        r = json.loads(l); p1[(r[0], r[1])] = r[2]
last = max(g['end'] for g in gs)
rows = []
for i, g in enumerate(gs):
    n = len(g['san'])
    wp_end = p1.get((i, n))
    me_to_move = (n % 2 == 0) == (g['me'] == 'w')
    wp_me = None if wp_end is None else (wp_end if me_to_move else 1 - wp_end)
    # Clock left for hoot65 at the end and at moves 10/20/30
    mine = [g['clk'][k] for k in range(len(g['clk'])) if (k % 2 == 0) == (g['me'] == 'w')]
    theirs = [g['clk'][k] for k in range(len(g['clk'])) if (k % 2 == 0) != (g['me'] == 'w')]
    at = lambda xs, m: xs[m - 1] if len(xs) >= m and xs[m - 1] is not None else np.nan
    rows.append(dict(g=i, tc=g['tc'], base=g['base'], score=g['score'], myRes=g['myRes'], oppRes=g['oppRes'], n=n, wpMe=wp_me,
                     w=0.5 ** ((last - g['end']) / 86400 / HALF_LIFE_DAYS), my10=at(mine, 10), my20=at(mine, 20), my30=at(mine, 30),
                     op10=at(theirs, 10), op20=at(theirs, 20), op30=at(theirs, 30)))
G = pd.DataFrame(rows)
W = G.w.sum()
print(f"weighted games {W:.1f}; weighted score {wmean(G.score, G.w):.3f}")
for res in ['timeout', 'resigned', 'checkmated', 'abandoned']:
    L = G[G.myRes == res]
    print(f"lost by {res:10s}: {L.w.sum()/W*100:5.1f}% of weighted games; expected score at the end (Maia) mean {wmean(L.wpMe, L.w):.3f}; "
          f"points per game left on the board if play had gone on: {(L.wpMe.fillna(0)*L.w).sum()/W:.3f}")
T = G[G.myRes == 'timeout']
print("timeouts: share where hoot65 was better (end score > 0.5):", f"{(T[T.wpMe > 0.5].w.sum() / max(T.w.sum(),1e-9)):.2f}")
Rz = G[G.myRes == 'resigned']
print("resignations with end score > 0.25:", f"{Rz[Rz.wpMe > 0.25].w.sum()/W*100:.1f}% of games", "> 0.15:", f"{Rz[Rz.wpMe > 0.15].w.sum()/W*100:.1f}%")
WON = G[G.oppRes == 'timeout']
print(f"wins on time: {WON.w.sum()/W*100:.1f}% of games, hoot65's expected score at the end {wmean(WON.wpMe, WON.w):.3f}")
R = G[G.base == 600]
print("\nrapid 10+0, clock left (weighted mean seconds):")
for m in [10, 20, 30]:
    print(f"  after move {m}: hoot65 {wmean(R[f'my{m}'], R.w):6.1f}  opponents {wmean(R[f'op{m}'], R.w):6.1f}")
G.to_csv(os.path.join(A, 'games_summary.csv'), index=False)
