import json
from collections import Counter
import pathlib

p = pathlib.Path('eslint-report.json')
data = json.loads(p.read_text(encoding='utf-8'))

items = [(e.get('filePath'), e.get('messages', [])) for e in data if e.get('messages')]
counts = Counter()
for fp, errs in items:
    counts[fp] += len(errs)

print('Total files with errors:', len(items))
print('Top 15 files by error count:')
for fp, cnt in counts.most_common(15):
    print(cnt, fp)

print('\nSample first 30 errors:')
printed = 0
for fp, errs in items:
    for m in errs:
        print(f"{fp}:{m.get('line')}:{m.get('column')} {m.get('ruleId')} {m.get('message')}")
        printed += 1
        if printed >= 30:
            raise SystemExit
