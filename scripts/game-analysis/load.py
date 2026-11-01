"""Shared loading for the hoot65 analysis: per-move features, Maia values, recency weights."""
import json, os, sys
import numpy as np, pandas as pd
A = os.path.dirname(os.path.abspath(__file__))
HALF_LIFE_DAYS = float(os.environ.get('HALF_LIFE', 180))

def games():
    gs = [json.loads(l) for l in open(os.path.join(A, 'games.jsonl'))]
    return gs

def moves(path='features.csv'):
    df = pd.read_csv(os.path.join(A, path), low_memory=False)
    last = df['end'].max()
    df['ageDays'] = (last - df['end']) / 86400
    df['w'] = 0.5 ** (df['ageDays'] / HALF_LIFE_DAYS)
    df['lowTime'] = (df['clockBefore'] < 60).astype(int)
    df['fast'] = ((df['spent'] < 2) & (df['nLegal'] > 1) & (df['recapture'] == 0)).astype(int)
    df['hangPiece'] = (df['hangAfter'] >= 2).astype(int)
    df['phase'] = np.where(df['moveNo'] <= 10, 'opening', np.where(df['matTotal'] <= 30, 'endgame', 'middlegame'))
    return df

def wmean(x, w):
    x = np.asarray(x, float); w = np.asarray(w, float); m = ~np.isnan(x)
    return float((x[m] * w[m]).sum() / w[m].sum()) if w[m].sum() > 0 else float('nan')

def pass1_map():
    m = {}
    for f in ['pass1-0.jsonl', 'pass1-1.jsonl']:
        for l in open(os.path.join(A, f)):
            r = json.loads(l); m[(r[0], r[1])] = r[2]
    return m

def pass2(gs, p1):
    """Candidate records with the value after the move played and the best likely alternative,
    both from hoot65's point of view. The played move's value comes from the candidate pass when
    it is one of Maia's top moves, otherwise from pass 1 (the next position's value, flipped)."""
    recs = json.load(open(os.path.join(A, 'pass2.json')))
    out = []
    for r in recs:
        cand = {u: wp for u, _, wp in r['cands']}
        if r['played'] in cand: pw = cand[r['played']]; src = 'cand'
        else:
            nxt = p1.get((r['g'], r['p'] + 1))
            if nxt is None: continue
            pw = 1 - nxt; src = 'pass1'
        best = max(cand, key=cand.get)
        out.append(dict(g=r['g'], p=r['p'], played=r['played'], playedWp=pw, src=src, best=best, bestWp=cand[best], wpBefore=r['wp'], cands=r['cands']))
    return out
