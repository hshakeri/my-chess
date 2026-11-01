"""Start positions for the simulator: recent positions where a rule fired, each played twice,
once with the move hoot65 chose and once with the best of Maia's likely moves."""
import json, os, sys, random
import pandas as pd
from load import games, moves, pass1_map, pass2, A
OFFSET = 400
rule_cols = sys.argv[1].split(',')     # feature columns, e.g. hangMoved,ignoredThreat
per_rule = int(sys.argv[2]) if len(sys.argv) > 2 else 120
gs = games(); p1 = pass1_map(); recs = {(r['g'], r['p']): r for r in pass2(gs, p1)}
df = pd.read_pickle(os.path.join(A, 'moves_res.pkl')); H = df[(df.mover == 'H')]
random.seed(7)
starts, meta = [], []
for col in rule_cols:
    if col.startswith('!'):   # baseline: moves where no rule fired
        sub = H[(H[['hang3','ignoredThreat','missedFree','allowMate1','missedMate','checkNoCap']].sum(axis=1) == 0)]
    else:
        sub = H[H[col] == 1]
    keys = [(int(g), int(p)) for g, p in zip(sub.g, sub.ply) if (int(g), int(p)) in recs and recs[(int(g), int(p))]['best'] != recs[(int(g), int(p))]['played']]
    random.shuffle(keys); keys = keys[:per_rule]
    for g, p in keys:
        G = gs[g]; r = recs[(g, p)]
        base = dict(fen=G['fens'][p], priorFens=G['fens'][max(0, p - 8):p], me=G['me'], myElo=G['myElo'] + OFFSET, oppElo=G['oppElo'] + OFFSET)
        for kind, mv in [('played', r['played']), ('best', r['best'])]:
            sid = f"{col}|{g}|{p}|{kind}"
            starts.append(dict(id=sid, move=mv, **base))
        meta.append(dict(rule=col, g=g, p=p, playedWp=r['playedWp'], bestWp=r['bestWp']))
json.dump(starts, open(os.path.join(A, 'sim-starts.json'), 'w'))
json.dump(meta, open(os.path.join(A, 'sim-meta.json'), 'w'))
print(len(starts), 'starts for', len(meta), 'positions')
