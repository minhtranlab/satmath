#!/usr/bin/env python3
"""Made-up fixture library for tests + the live smoke test (batch FX1). Own content, no real SAT question.
   python3 tests/make_fixtures.py   →  tests/fixtures/library/questions/FX1.json + figures/FX1/*.png"""
import json, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, 'fixtures', 'library')
os.makedirs(os.path.join(LIB, 'questions'), exist_ok=True)
os.makedirs(os.path.join(LIB, 'figures', 'FX1'), exist_ok=True)

def fig_line(path):
    W, H = 640, 400
    im = Image.new('L', (W, H), 255); d = ImageDraw.Draw(im)
    ox, oy, u = 80, 340, 50
    for i in range(0, 11): d.line([(ox + i * u, 20), (ox + i * u, oy)], fill=225);
    for j in range(0, 7): d.line([(ox, oy - j * u), (ox + 500, oy - j * u)], fill=225)
    d.line([(ox, 20), (ox, oy)], fill=0, width=2); d.line([(ox, oy), (ox + 520, oy)], fill=0, width=2)
    d.line([(ox, oy - 1 * u), (ox + 10 * u, oy - 6 * u)], fill=0, width=4)   # y = 0.5x + 1
    for x, y in [(0, 1), (4, 3), (8, 5)]: d.ellipse([ox + x * u - 7, oy - y * u - 7, ox + x * u + 7, oy - y * u + 7], fill=0)
    d.text((ox + 515, oy + 6), 'x', fill=0); d.text((ox - 18, 14), 'y', fill=0)
    im.save(path, optimize=True)

def mcq(no, sk, ss, diff, lvl, stem, ch, key, figs=None):
    return {'qid': 'FX1-%03d' % no, 'batch': 'FX1', 'source': {'set': 'FX1', 'page': no}, 'type': 'mcq', 'stem_html': stem, 'passage_html': '',
            'figures': figs or [], 'choices': [{'label': l, 'html': h} for l, h in zip('ABCD', ch)], 'key_source': key, 'key': key, 'accepted': [],
            'tags': {'domain': sk[0], 'skill': sk, 'subskill': ss, 'subskill2': '', 'difficulty': diff, 'level': lvl, 'tag_status': 'est'},
            'twin_group': None, 'flags': [], 'status': 'keep', 'version': 'A', 'version_of': None, 'transcription_notes': 'made-up fixture'}
def spr(no, sk, ss, diff, lvl, stem, key, accepted):
    q = mcq(no, sk, ss, diff, lvl, stem, [], key); q['type'] = 'spr'; q['choices'] = []; q['accepted'] = accepted; return q

FIG = [{'file': 'figures/FX1/FX1-003_f1.png', 'alt': 'A line through the points (0, 1), (4, 3) and (8, 5) in the xy-plane.', 'position': 'before_stem',
        'width': 320, 'caption': '', 'method': 'redraw', 'drive_id': 'DRV:figures/FX1/FX1-003_f1.png'}]
Q = [
  mcq(1, 'H.B', 'H.B.1', 'E', 1, '<p>The function \\(f\\) is defined by \\(f(x) = 2x + 3\\). What is the value of \\(f(4)\\)?</p>', ['\\(5\\)', '\\(8\\)', '\\(11\\)', '\\(14\\)'], 'C'),
  mcq(2, 'H.B', 'H.B.2', 'M', 1, '<p>A tank holds \\(40\\) liters of water and loses \\(3\\) liters each hour. Which function gives the liters \\(w\\) left after \\(t\\) hours?</p>',
      ['\\(w = 40 + 3t\\)', '\\(w = 40 - 3t\\)', '\\(w = 3 - 40t\\)', '\\(w = 37t\\)'], 'B'),
  mcq(3, 'H.B', 'H.B.3', 'M', 2, '<p>The graph of the linear function \\(g\\) is shown. What is the slope of the graph of \\(g\\)?</p>', ['\\(\\frac{1}{4}\\)', '\\(\\frac{1}{2}\\)', '\\(2\\)', '\\(4\\)'], 'B', FIG),
  spr(4, 'H.B', 'H.B.4', 'H', 1, '<p>A phone plan costs \\(c = 12m + 25\\) dollars for \\(m\\) months. By how many dollars does the cost go up each month?</p>', '12', ['12']),
  spr(5, 'H.B', 'H.B.3', 'H', 2, '<p>A line passes through \\((1, 2)\\) and \\((5, 5)\\). What is its slope?</p>', '3/4', ['3/4', '.75', '0.75']),
  mcq(6, 'H.B', 'H.B.5', 'H', 3, '<p>The graph of \\(y = h(x)\\) is a line with a negative slope and a positive \\(y\\)-intercept. Which could be \\(h(x)\\)?</p>',
      ['\\(h(x) = 3x + 2\\)', '\\(h(x) = -3x - 2\\)', '\\(h(x) = -3x + 2\\)', '\\(h(x) = 3x - 2\\)'], 'C'),
  mcq(7, 'Q.B', 'Q.B.1', 'E', 1, '<p>What is \\(20\\%\\) of \\(150\\)?</p>', ['\\(15\\)', '\\(20\\)', '\\(30\\)', '\\(75\\)'], 'C'),
  spr(8, 'Q.B', 'Q.B.2', 'M', 1, '<p>A price goes from \\(\\$80\\) to \\(\\$100\\). By what percent did the price go up?</p>', '25', ['25']),
]
for q in Q: q['code'] = '%s%d' % (q['tags']['difficulty'], 9100 + int(q['qid'][-3:]))   # made-up short codes (E9101 …)
# FX2: a bigger made-up batch for the adaptive selection (Linear functions only): every sub-skill × E/M/H, short codes,
# one twin pair and one version-B candidate (never served in practice).
def fx2():
    out, n, codes = [], 0, {'E': 9000, 'M': 9000, 'H': 9000}
    plan = [('E', 1, 2), ('M', 1, 2), ('H', 1, 1), ('H', 2, 1), ('H', 3, 1)]
    for sub in ['H.B.1', 'H.B.2', 'H.B.3', 'H.B.4', 'H.B.5']:
        for diff, lvl, k in plan:
            for _ in range(k):
                n += 1; a, b = 2 + n % 7, 3 + n % 5
                stem = '<p>Made-up item %d. The function \\(f\\) is defined by \\(f(x) = %dx + %d\\). What is \\(f(1)\\)?</p>' % (n, a, b)
                if n % 4 == 0:
                    q = spr(n, 'H.B', sub, diff, lvl, stem, str(a + b), [str(a + b)])
                else:
                    ch = [str(a + b - 1), str(a + b), str(a + b + 1), str(a * b)]
                    q = mcq(n, 'H.B', sub, diff, lvl, stem, ['\\(%s\\)' % c for c in ch], 'B')
                q['qid'] = 'FX2-%03d' % n; q['batch'] = 'FX2'; q['source'] = {'set': 'FX2', 'page': n}
                codes[diff] += 1; q['code'] = '%s%d' % (diff, codes[diff])
                out.append(q)
    out[0]['twin_group'] = 'TW-FX01'; out[1]['twin_group'] = 'TW-FX01'
    vb = json.loads(json.dumps(out[0])); vb.update({'qid': 'FX2-B01', 'version': 'B', 'version_of': out[0]['qid'], 'status': 'candidate', 'code': out[0]['code'] + 'B'})
    out.append(vb)
    return out
json.dump({'batch': 'FX2', 'title': 'Fixture 2 (made-up, adaptive)', 'source_type': 'fixture', 'schema': 1, 'questions': fx2()},
          open(os.path.join(LIB, 'questions', 'FX2.json'), 'w'), indent=1, ensure_ascii=False)
# FX3: a few made-up items in 5 more skills (4 domains) for Mixed Practice
def fx3():
    out, n, codes = [], 0, {'E': 9500, 'M': 9500, 'H': 9500}
    for sk, sub in [('H.A', 'H.A.1'), ('P.A', 'P.A.1'), ('Q.A', 'Q.A.2'), ('S.A', 'S.A.1'), ('S.D', 'S.D.1')]:
        for diff in ['E', 'E', 'M', 'M', 'H', 'H']:
            n += 1; a, b = 3 + n % 6, 2 + n % 4
            q = mcq(n, sk, sub, diff, 1, '<p>Made-up item %d (%s). What is \\(%d + %d\\)?</p>' % (n, sk, a, b),
                    ['\\(%d\\)' % (a + b - 1), '\\(%d\\)' % (a + b), '\\(%d\\)' % (a + b + 2), '\\(%d\\)' % (a * b)], 'B')
            q['qid'] = 'FX3-%03d' % n; q['batch'] = 'FX3'; q['source'] = {'set': 'FX3', 'page': n}
            codes[diff] += 1; q['code'] = '%s%d' % (diff, codes[diff]); out.append(q)
    return out
json.dump({'batch': 'FX3', 'title': 'Fixture 3 (made-up, mixed)', 'source_type': 'fixture', 'schema': 1, 'questions': fx3()},
          open(os.path.join(LIB, 'questions', 'FX3.json'), 'w'), indent=1, ensure_ascii=False)

# FX4: made-up placement forms (blueprint v2.2 shape): 2 forms × 4 domains × slots E1–E3, M1–M4, H1–H3 (+ H4 Advanced Math) = 82 items.
PL_SKILLS = {'ALG': ('H.B', 'H.D', 'H.C'), 'ADV': ('P.C', 'P.B', 'P.A'), 'PSD': ('Q.C', 'Q.A', 'Q.B'), 'GEO': ('S.B', 'S.A', 'S.C')}
PL_SLOT = {'E1': 0, 'E2': 1, 'E3': 2, 'M1': 1, 'M2': 2, 'M3': 0, 'M4': 1, 'H1': 2, 'H2': 0, 'H3': 1, 'H4': 2}
def fx4():
    out, rows, n, codes = [], [], 0, {'E': 9600, 'M': 9600, 'H': 9600}
    for form in 'AB':
        for dom, sks in PL_SKILLS.items():
            for slot in ['E1', 'E2', 'E3', 'M1', 'M2', 'M3', 'M4', 'H1', 'H2', 'H3'] + (['H4'] if dom == 'ADV' else []):
                n += 1; sk = sks[PL_SLOT[slot]]; diff = slot[0]; a, b = 2 + n % 9, 3 + n % 7
                stem = '<p>Made-up placement item %d (%s %s %s). What is \\(%d + %d\\)?</p>' % (n, form, dom, slot, a, b)
                if n % 5 == 0:
                    q = spr(n, sk, sk + '.1', diff, 1, stem, str(a + b), [str(a + b)])
                else:
                    q = mcq(n, sk, sk + '.1', diff, 1, stem, ['\\(%d\\)' % (a + b - 1), '\\(%d\\)' % (a + b), '\\(%d\\)' % (a + b + 1), '\\(%d\\)' % (a * b)], 'B')
                q['qid'] = 'FX4-%03d' % n; q['batch'] = 'FX4'; q['source'] = {'set': 'FX4', 'page': n}
                codes[diff] += 1; q['code'] = '%s%d' % (diff, codes[diff]); out.append(q)
                rows.append([form, dom, slot, diff, sk, q['code'], q['qid']])
    return out, rows
FX4Q, FX4_FORMS = fx4()
json.dump({'batch': 'FX4', 'title': 'Fixture 4 (made-up, placement)', 'source_type': 'fixture', 'schema': 1, 'questions': FX4Q},
          open(os.path.join(LIB, 'questions', 'FX4.json'), 'w'), indent=1, ensure_ascii=False)
json.dump(FX4_FORMS, open(os.path.join(HERE, 'fixtures', 'placement_forms_fx4.json'), 'w'))

# FX5: made-up items for the Skill_Profile checks (#35): Circles (no Easy on the SAT), Probability (no Hard), Evaluating claims (rare).
def fx5():
    out, n = [], 0
    plan = [('S.D', 'E', 1, 3), ('S.D', 'M', 1, 6), ('S.D', 'M', 2, 4), ('S.D', 'H', 2, 4),
            ('Q.E', 'E', 1, 5), ('Q.E', 'M', 1, 3), ('Q.E', 'M', 2, 5), ('Q.E', 'H', 2, 2),
            ('Q.G', 'E', 1, 3), ('Q.G', 'M', 1, 3), ('Q.G', 'H', 2, 3)]
    for sk, diff, lvl, k in plan:
        for j in range(k):
            n += 1; a, b = 3 + n % 8, 2 + n % 5
            stem = '<p>Made-up profile item %d (%s %s%d). What is \\(%d \\times %d\\)?</p>' % (n, sk, diff, lvl, a, b)
            q = mcq(n, sk, sk + '.%d' % (1 + j % 2), diff, lvl, stem, ['\\(%d\\)' % (a * b), '\\(%d\\)' % (a * b + 1), '\\(%d\\)' % (a + b), '\\(%d\\)' % (a * b - 1)], 'A')
            q['qid'] = 'FX5-%03d' % n; q['batch'] = 'FX5'; q['source'] = {'set': 'FX5', 'page': n}; q['code'] = '%s%d' % (diff, 9700 + n)
            out.append(q)
    return out
json.dump({'batch': 'FX5', 'title': 'Fixture 5 (made-up, skill profiles)', 'source_type': 'fixture', 'schema': 1, 'questions': fx5()},
          open(os.path.join(LIB, 'questions', 'FX5.json'), 'w'), indent=1, ensure_ascii=False)
fig_line(os.path.join(LIB, 'figures', 'FX1', 'FX1-003_f1.png'))
json.dump({'batch': 'FX1', 'title': 'Fixture (made-up)', 'source_type': 'fixture', 'schema': 1, 'questions': Q},
          open(os.path.join(LIB, 'questions', 'FX1.json'), 'w'), indent=1, ensure_ascii=False)
print('FX1: %d made-up questions' % len(Q))
