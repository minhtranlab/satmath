#!/usr/bin/env python3
"""Check a library batch before it goes to Drive (nothing is written into the repo).
   python3 tools/build_library.py "<project folder>/data/library" HM1 [HM2 …]
Checks every question of questions/<BATCH>.json against the App's needs (spec v1.1 §6, Intake's SCHEMA.md):
qid unique + "<batch>-…" (CB items "CB-…"), type mcq (4 choices A–D, key one of them) / spr (key + accepted list), skill = a
College Board skill code, sub-skill (when set) in the taxonomy (src/Skills.gs), difficulty E/M/H, level 1–3, figure files
exist (and are not huge), no source names / watermarks in any text. Exit code 1 when an error is found."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SK = json.loads(re.search(r'var SKILLS_ = (\[.*\]);', open(os.path.join(HERE, '..', 'src', 'Skills.gs'), encoding='utf-8').read(), re.S).group(1))
SKILLS = {r['skill'] for r in SK}
SUBS = {r['subskill'] for r in SK if r['subskill']}
BANNED = re.compile(r'dsatuz|@DSAT|stewiesat|flashsat|www\.|\.com\b', re.I)

def check_batch(lib, batch):
    errs, warns = [], []
    p = os.path.join(lib, 'questions', batch + '.json')
    data = json.load(open(p, encoding='utf-8'))
    if data.get('batch') != batch: errs.append('file holds batch %r' % data.get('batch'))
    seen, figs, n_fig_bytes = set(), 0, 0
    counts = {'mcq': 0, 'spr': 0, 'E': 0, 'M': 0, 'H': 0, 'no_sub': 0, 'B': 0}
    for q in data.get('questions', []):
        qid = q.get('qid', '?'); e = lambda m: errs.append('%s: %s' % (qid, m))
        if qid in seen: e('qid twice')
        seen.add(qid)
        if not (qid.startswith(batch + '-') or qid.startswith('CB-')): e('qid does not start with the batch code')
        t = q.get('type')
        if t == 'mcq':
            counts['mcq'] += 1
            labels = [c.get('label') for c in q.get('choices', [])]
            if labels != ['A', 'B', 'C', 'D']: e('choices are not A–D: %s' % labels)
            if str(q.get('key', '')).upper() not in labels: e('key %r not a choice' % q.get('key'))
        elif t == 'spr':
            counts['spr'] += 1
            if q.get('choices'): e('spr with choices')
            if not str(q.get('key', '')).strip(): e('spr without key')
            if not q.get('accepted'): warns.append('%s: spr without accepted list (only the key is graded)' % qid)
        else: e('type %r' % t)
        tg = q.get('tags', {})
        if tg.get('skill') not in SKILLS: e('skill %r is not a College Board skill code' % tg.get('skill'))
        if tg.get('subskill') and tg['subskill'] not in SUBS: e('sub-skill %r not in the taxonomy' % tg['subskill'])
        if not tg.get('subskill'): counts['no_sub'] += 1
        d = tg.get('difficulty')
        if d not in ('E', 'M', 'H'): e('difficulty %r' % d)
        else: counts[d] += 1
        if tg.get('level') not in (1, 2, 3, '1', '2', '3', None, ''): e('level %r' % tg.get('level'))
        if q.get('version') == 'B': counts['B'] += 1
        for f in q.get('figures', []):
            figs += 1
            fp = os.path.join(lib, f.get('file', ''))
            if not os.path.isfile(fp): e('figure file missing: %s' % f.get('file'))
            else:
                n_fig_bytes += os.path.getsize(fp)
                if os.path.getsize(fp) > 300 * 1024: warns.append('%s: figure %s is %d KB (keep ≤ ~150 KB)' % (qid, f['file'], os.path.getsize(fp) // 1024))
        text = ' '.join([q.get('stem_html', ''), q.get('passage_html', '')] + [c.get('html', '') for c in q.get('choices', [])] + [f.get('alt', '') + f.get('caption', '') for f in q.get('figures', [])])
        if BANNED.search(text): e('source / watermark text: %r' % BANNED.search(text).group(0))
    size = os.path.getsize(p)
    print('%s: %d questions (%d mcq, %d grid-in · E %d · M %d · H %d · %d without sub-skill · %d version B), %d figures (%d KB), JSON %d KB'
          % (batch, len(seen), counts['mcq'], counts['spr'], counts['E'], counts['M'], counts['H'], counts['no_sub'], counts['B'], figs, n_fig_bytes // 1024, size // 1024))
    for w in warns[:20]: print('  warn  ' + w)
    for x in errs[:50]: print('  ERROR ' + x)
    return len(errs)

if __name__ == '__main__':
    lib = sys.argv[1]
    bad = sum(check_batch(lib, b) for b in sys.argv[2:])
    print('OK' if not bad else '%d error(s)' % bad)
    sys.exit(1 if bad else 0)
