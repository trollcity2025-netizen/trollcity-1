import sys
from pathlib import Path
lines = Path('EDGE_FUNCTIONS_DEPLOYMENT.md').read_text(encoding='utf-8').splitlines()
for i,line in enumerate(lines,1):
    if 1 <= i <= 20 or 140 <= i <= 170:
        print(f"{i}: {line}")
