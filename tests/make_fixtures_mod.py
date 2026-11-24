#!/usr/bin/env python3
"""#101 made-up bank for the real-test module tests (batch FX6): every College Board skill (19) × level E1…H3 × 2 multiple
   choice + 1 grid-in, 3 sub-skills per skill, 13 ways of asking, some tables. Own content, no real SAT question.
   python3 tests/make_fixtures_mod.py  →  tests/fixtures/library_mod/questions/FX6.json (the module tests add it to a copy
   of tests/fixtures/library, so the other suites never see it)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'fixtures', 'library_mod', 'questions')
os.makedirs(OUT, exist_ok=True)
SKILLS = ['H.A', 'H.B', 'H.C', 'H.D', 'H.E', 'P.A', 'P.B', 'P.C', 'Q.A', 'Q.B', 'Q.C', 'Q.D', 'Q.E', 'Q.F', 'Q.G', 'S.A', 'S.B', 'S.C', 'S.D']
LEVELS = [('E', 1), ('E', 2), ('E', 3), ('M', 1), ('M', 2), ('M', 3), ('H', 1), ('H', 2), ('H', 3)]
FORMS = [
  ('equivalent', 'Made-up item {n}. Which expression is equivalent to \\({a}(x + {b})\\)?'),
  ('interpret', 'Made-up item {n}. A model says \\(y = {a}x + {b}\\). What is the best interpretation of the number \\({b}\\)?'),
  ('n_solutions', 'Made-up item {n}. How many solutions does the equation \\({a}x + {b} = {a}x + {c}\\) have?'),
  ('model', 'Made-up item {n}. A club has \\({b}\\) members and adds \\({a}\\) each week. Which equation represents the members \\(m\\) after \\(w\\) weeks?'),
  ('could_be', 'Made-up item {n}. If \\(x > {a}\\), which of the following could be \\(x\\)?'),
  ('constant', 'Made-up item {n}. In \\({a}x + k = {c}\\), \\(k\\) is a constant and \\(x = 1\\). What is \\(k\\)?'),
  ('solve', 'Made-up item {n}. What is the solution to \\({a}x + {b} = {c}\\)?'),
  ('feature', 'Made-up item {n}. What is the \\(y\\)-intercept of the graph of \\(y = {a}x + {b}\\)?'),
  ('geo_measure', 'Made-up item {n}. A rectangle is \\({a}\\) by \\({b}\\). What is its area?'),
  ('percent', 'Made-up item {n}. What is \\({a}0\\%\\) of \\({b}0\\)?'),
  ('prob', 'Made-up item {n}. A card is picked at random from \\({c}\\) cards, \\({a}\\) of them red. What is the probability of red?'),
  ('data', 'Made-up item {n}. The table shows four numbers.</p><table class="data"><tr><th>A</th><th>B</th><th>C</th><th>D</th></tr><tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{a}</td></tr></table><p>What is their median?'),
  ('value', 'Made-up item {n}. If \\(x = {a}\\), what is the value of \\(x + {b}\\)?'),
]
out, n, codes = [], 0, {'E': 8000, 'M': 8000, 'H': 8000}
for si, sk in enumerate(SKILLS):
    for li, (d, l) in enumerate(LEVELS):
        for k in range(3):
            n += 1; a, b, c = 2 + n % 7, 3 + n % 5, 20 + n % 9
            form = FORMS[(n * 5 + si) % len(FORMS)][1].format(n=n, a=a, b=b, c=c)
            key = str(a + b)
            q = {'qid': 'FX6-%03d' % n, 'batch': 'FX6', 'source': {'set': 'FX6', 'page': n}, 'stem_html': '<p>' + form + '</p>', 'passage_html': '', 'figures': [],
                 'key_source': key, 'tags': {'domain': sk[0], 'skill': sk, 'subskill': '%s.%d' % (sk, 1 + (li + k) % 3), 'subskill2': '', 'difficulty': d, 'level': l, 'tag_status': 'est'},
                 'twin_group': None, 'flags': [], 'status': 'keep', 'version': 'A', 'version_of': None, 'transcription_notes': 'made-up fixture'}
            if k == 2:
                q.update({'type': 'spr', 'choices': [], 'key': key, 'accepted': [key]})
            else:
                q.update({'type': 'mcq', 'choices': [{'label': L, 'html': '\\(%s\\)' % v} for L, v in zip('ABCD', [a + b - 1, a + b, a + b + 1, a * b])], 'key': 'B', 'accepted': []})
            codes[d] += 1; q['code'] = '%s%d' % (d, codes[d])
            out.append(q)
vb = json.loads(json.dumps(out[0])); vb.update({'qid': 'FX6-B01', 'version': 'B', 'version_of': out[0]['qid'], 'status': 'candidate', 'code': out[0]['code'] + 'B'})
out.append(vb)
json.dump({'batch': 'FX6', 'title': 'Fixture 6 (made-up, real-test modules)', 'source_type': 'fixture', 'schema': 1, 'questions': out},
          open(os.path.join(OUT, 'FX6.json'), 'w'), indent=1, ensure_ascii=False)
print('FX6: %d made-up questions' % len(out))
