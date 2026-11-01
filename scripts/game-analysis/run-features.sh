#!/bin/bash
# Per-move features in 4 parallel shards, then one CSV.
set -e
cd "$(dirname "$0")"
for s in 0 1 2 3; do node features.mjs games.jsonl features-$s.csv $s 4 pass1-0.jsonl pass1-1.jsonl 2> features-$s.log & done
wait
cat features-0.csv features-1.csv features-2.csv features-3.csv > features.csv
wc -l features.csv
