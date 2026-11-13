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
fig_line(os.path.join(LIB, 'figures', 'FX1', 'FX1-003_f1.png'))
json.dump({'batch': 'FX1', 'title': 'Fixture (made-up)', 'source_type': 'fixture', 'schema': 1, 'questions': Q},
          open(os.path.join(LIB, 'questions', 'FX1.json'), 'w'), indent=1, ensure_ascii=False)
print('FX1: %d made-up questions' % len(Q))
