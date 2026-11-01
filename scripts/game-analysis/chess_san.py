"""Minimal UCI to SAN via node and chess.js (python-chess is not installed)."""
import json, subprocess, os, functools
A = os.path.dirname(os.path.abspath(__file__))
@functools.lru_cache(maxsize=None)
def uci_to_san(fen, uci):
    js = "import { Chess } from 'chess.js'; const [f,u]=process.argv.slice(1); const c=new Chess(f); try { console.log(c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}).san) } catch { console.log(u) }"
    return subprocess.run(['node', '--input-type=module', '-e', js, fen, uci], cwd=A, capture_output=True, text=True).stdout.strip()
