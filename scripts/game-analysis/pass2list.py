"""Positions for the candidate pass: every hoot65 decision in the last 365 days."""
import json, os
from load import games, A
gs = games(); last = max(g['end'] for g in gs)
lst = []
for i, g in enumerate(gs):
    if last - g['end'] > 365 * 86400: continue
    for p in range(len(g['san'])):
        if (p % 2 == 0) == (g['me'] == 'w'): lst.append([i, p])
json.dump(lst, open(os.path.join(A, 'pass2-list.json'), 'w'))
print(len(lst), 'positions')
