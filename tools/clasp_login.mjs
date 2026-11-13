#!/usr/bin/env node
// Two-step Google login for clasp when no browser runs where the chat runs (same result as `clasp login --no-localhost`,
// but in two separate commands, so Minh can answer in his own time).
//   node tools/clasp_login.mjs start            → prints the link Minh opens (choose minhtranipad@gmail.com → Allow)
//   node tools/clasp_login.mjs finish '<url>'   → <url> = the whole "http://localhost:8888/?state=…&code=…" address his
//                                                  browser shows afterwards ("This site can't be reached" is expected)
// Writes ~/.clasprc.json (clasp 3 format). Scopes: Apps Script projects / deployments / web-app deploy, drive.file
// (only files this login creates), email. The OAuth client is clasp's own built-in client (read from the installed
// @google/clasp package; never stored in this repo). The token itself is NEVER printed or written into the repo.
import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';

function claspClient() {
  const tries = [process.cwd(), path.dirname(new URL(import.meta.url).pathname), '/usr/local/lib/node_modules', '/usr/lib/node_modules'];
  for (const p of tries) {
    try {
      const f = [path.join(p, 'node_modules/@google/clasp/build/src/auth/oauth_client.js'), path.join(p, '@google/clasp/build/src/auth/oauth_client.js')].find(x => fs.existsSync(x));
      if (!f) continue;
      const s = fs.readFileSync(f, 'utf8');
      return { id: /DEFAULT_CLASP_OAUTH_CLIENT_ID = '([^']+)'/.exec(s)[1], secret: /DEFAULT_CLASP_OAUTH_CLIENT_SECRET = '([^']+)'/.exec(s)[1] };
    } catch (e) { /* next */ }
  }
  throw new Error('install clasp first: npm i @google/clasp@3.4.1');
}
const SCOPES = ['https://www.googleapis.com/auth/script.deployments', 'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.webapp.deploy', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'];
const REDIRECT = 'http://localhost:8888';
const PENDING = path.join(os.homedir(), '.sml_login_pending.json');
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const c = claspClient();

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'start') {
  const verifier = b64u(crypto.randomBytes(48)), state = b64u(crypto.randomBytes(16));
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  fs.writeFileSync(PENDING, JSON.stringify({ verifier, state, at: Date.now() }), { mode: 0o600 });
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  Object.entries({ client_id: c.id, redirect_uri: REDIRECT, response_type: 'code', access_type: 'offline', prompt: 'consent',
    scope: SCOPES.join(' '), state, code_challenge: challenge, code_challenge_method: 'S256' }).forEach(([k, v]) => u.searchParams.set(k, v));
  console.log(u.toString());
} else if (cmd === 'finish') {
  const p = JSON.parse(fs.readFileSync(PENDING, 'utf8'));
  const back = new URL(String(arg || '').trim());
  if (back.searchParams.get('error')) throw new Error('Google said: ' + back.searchParams.get('error'));
  if (back.searchParams.get('state') !== p.state) throw new Error('state does not match: use the link from the latest "start"');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: back.searchParams.get('code'), client_id: c.id, client_secret: c.secret, redirect_uri: REDIRECT,
                                grant_type: 'authorization_code', code_verifier: p.verifier }) });
  const j = await r.json();
  if (!j.refresh_token) throw new Error('no refresh token: ' + (j.error_description || j.error || 'unknown'));
  const rc = { tokens: { default: { client_id: c.id, client_secret: c.secret, type: 'authorized_user', refresh_token: j.refresh_token, access_token: j.access_token } } };
  fs.writeFileSync(path.join(os.homedir(), '.clasprc.json'), JSON.stringify(rc), { mode: 0o600 });
  fs.rmSync(PENDING, { force: true });
  console.log('OK: ~/.clasprc.json written · scopes granted: ' + (j.scope || '').split(' ').map(s => s.replace('https://www.googleapis.com/auth/', '')).join(', '));
} else { console.error('usage: node tools/clasp_login.mjs start | finish "<url>"'); process.exit(2); }
