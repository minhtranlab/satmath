// Harness server: serves the Apps Script HTML (template includes resolved) + /rpc → mocked google.script.run.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createGas } = require('./gas');

const APP = process.env.APP_DIR || require('./paths').APP;
const LIB = process.env.LIB_DIR || path.join(__dirname, 'fixtures', 'library');
const LIB_ID = /LIBRARY_FOLDER_ID = '([^']+)'/.exec(fs.readFileSync(path.join(APP, 'Code.gs'), 'utf8'))[1];

/** Fresh Sheet with fixture students; the app's own update creates every other tab + syncs the fixture library. */
function initialTabs() {
  return {
    'Sheet1': [],
    Students: [['student_code', 'name', 'active', 'classes', 'created_in', 'created_at', 'note'],
      ['FX-T01', 'Test Student (test)', 'Yes', '', 'sheet', '', 'fixture'], ['FX-T02', 'Locked (test)', 'No', '', 'sheet', '', 'fixture'],
      ['FX-T03', 'Second (test)', 'Yes', '', 'sheet', '', 'fixture']],
    Settings: [['key', 'value', 'meaning'], ['teacher_code', 'TEACH-FX-9', '']]
  };
}
/** Apps Script mock with the fixture library, the per-deploy update already run and FX1 switched live. */
function makeGas(opts = {}) {
  const g = createGas(APP, initialTabs(), { libDir: opts.libDir || LIB, libId: LIB_ID });
  if (!opts.quiet) g.ctx.console = { log() {}, warn() {}, error: console.error, info() {} };
  const r = g.admin('doUpdate');
  if (!/done/.test(r.status)) throw new Error('update failed: ' + JSON.stringify(r));
  if (opts.live !== false) {
    const b = g.ctx.readTable_('Batches').rows.find(x => x.batch === 'FX1');
    g.ctx.updateRow_('Batches', b._row, { live: 'Yes' });
    g.ctx._batchLive = null;
  }
  return g;
}

function page() {
  let html = fs.readFileSync(path.join(APP, 'Index.html'), 'utf8');
  html = html.replace(/<\?!=\s*include\('(\w+)'\);?\s*\?>/g, (m, n) => {
    let s = fs.readFileSync(path.join(APP, n + '.html'), 'utf8');
    if (n === 'Client') s = MOCK_RUN + s;
    return s;
  });
  return html;
}
const MOCK_RUN = `<script>
(function(){
  function runner(succ, fail){ return new Proxy({}, { get: function(_, name){
    if (name === 'withSuccessHandler') return function(f){ return runner(f, fail); };
    if (name === 'withFailureHandler') return function(f){ return runner(succ, f); };
    return function(){ var args = Array.prototype.slice.call(arguments);
      fetch('/rpc', { method: 'POST', body: JSON.stringify({ fn: name, args: args }) })
        .then(function(r){ if (!r.ok) throw new Error('NetworkError: ' + r.status); return r.json(); })
        .then(function(j){ setTimeout(function(){ if (j.error) { fail && fail(new Error(j.error)); } else { succ && succ(j.result); } }, 0); })
        .catch(function(e){ fail && fail(e); });
    }; } }); }
  window.google = { script: { run: runner(null, null), url: { getLocation: function (cb) {
    var p = {}; new URLSearchParams(location.search).forEach(function (v, k) { p[k] = v; }); setTimeout(function () { cb({ parameter: p }); }, 0); } } } };
})();
</script>`;

function start(port) {
  const st = { gas: makeGas(), offline: false, rpcLog: [], latency: 0 };
  st.reset = () => { st.gas = makeGas(); st.rpcLog = []; };
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/?')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page()); return; }
    if (req.url === '/rpc' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        if (st.offline) { res.writeHead(503); res.end('offline'); return; }
        const { fn, args } = JSON.parse(body);
        let out;
        try { st.gas.fresh(); out = { result: st.gas.call(fn, args) }; } catch (e) { out = { error: e.message }; if (!/^(LOGIN|SESSION|FORM)/.test(e.message)) console.error('RPC error', fn, e.stack); }
        const txt = JSON.stringify(out);
        st.rpcLog.push({ fn, req: body.length, res: txt });
        setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(txt); }, st.latency);
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise(r => server.listen(port, () => r({ server, st })));
}

module.exports = { start, initialTabs, makeGas, LIB, LIB_ID };
if (require.main === module) start(8080).then(() => console.log('http://localhost:8080'));
