"""Opening tweaks: recurring positions in hoot65's first ten moves, the move usually played,
and the best of Maia's likely human moves there, by expected score."""
import json, os, collections
import numpy as np
from chess_san import uci_to_san
from load import games, A, HALF_LIFE_DAYS, pass1_map, pass2
gs = games(); last = max(g['end'] for g in gs)
c2 = pass2(gs, pass1_map())
W = sum(0.5 ** ((last - g['end']) / 86400 / HALF_LIFE_DAYS) for g in gs if last - g['end'] <= 365 * 86400)
FLOOR = json.load(open(os.path.join(A, 'gains-summary.json')))['floor'][0]  # selection bias in moves 1-10 (gains.py)
nodes = collections.defaultdict(list)
for r in c2:
    g = gs[r['g']]; p = r['p']
    if p >= 20: continue
    key = ' '.join(g['fens'][p].split(' ')[:4])
    w = 0.5 ** ((last - g['end']) / 86400 / HALF_LIFE_DAYS)
    nodes[key].append(dict(w=w, g=r['g'], p=p, played=r['played'], best=r['best'], bestWp=r['bestWp'], playedWp=r['playedWp'], color=g['me'], fen=g['fens'][p], line=g['san'][:p]))
rows = []
for key, occ in nodes.items():
    wsum = sum(o['w'] for o in occ)
    if len(occ) < 6: continue
    gain = sum(o['w'] * (max(0, o['bestWp'] - o['playedWp']) - FLOOR) for o in occ if o['playedWp'] is not None) / W
    played = collections.Counter(); best = collections.Counter()
    for o in occ: played[o['played']] += o['w']; best[o['best']] += o['w']
    o0 = max(occ, key=lambda o: o['w'])
    rows.append((gain, wsum / W, len(occ), key, o0, played, best))
rows.sort(key=lambda r: -r[0])
for gain, reach, n, key, o0, played, best in rows[:15]:
    fen = o0['fen']
    pm = ', '.join(f"{uci_to_san(fen, u)} {c/sum(played.values()):.0%}" for u, c in played.most_common(3))
    bm = uci_to_san(fen, best.most_common(1)[0][0])
    print(f"gain {gain:+.4f} pts/game | reached in {reach:.1%} of weighted games ({n} times) | {o0['color']} | {' '.join(o0['line'])}\n    played: {pm} | best likely move: {bm}")
