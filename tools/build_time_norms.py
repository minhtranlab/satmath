#!/usr/bin/env python3
"""Time per question by type + difficulty (SC FINAL 2026-11-10) → src/TimeNorms.gs = the default content of the Sheet tab
Time_Norms (Math rows only).   python3 tools/build_time_norms.py "<project folder>/reuse/taxonomy"
Reads sat_time_norms.csv (public pacing sources, no question data), so it may be committed.
At runtime the Time_Norms tab (Minh can edit it) wins; this file is the fallback and the content written when the tab is created."""
import csv, json, os, sys
src = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
rows = list(csv.reader(open(os.path.join(src, 'sat_time_norms.csv'), encoding='utf-8')))
assert rows[0] == ['section', 'skill', 'difficulty', 'qtype', 'target_sec', 'fast_below_sec', 'slow_above_sec'], rows[0]
rows = [rows[0]] + [r for r in rows[1:] if r[0] == 'Math']
out = ('// GENERATED from reuse/taxonomy/sat_time_norms.csv (Math rows; SC, FINAL 2026-11-10) by tools/build_time_norms.py.\n'
       '// Default content of the Sheet tab Time_Norms; the tab (editable by Minh) is what the app reads.\n'
       'var TIME_NORMS_DEFAULT_ = ' + json.dumps(rows) + ';\n')
open(os.path.join(HERE, '..', 'src', 'TimeNorms.gs'), 'w', encoding='utf-8').write(out)
print('TimeNorms.gs: %d rows' % (len(rows) - 1))
