#!/usr/bin/env node
// Upload (or replace) library batches in the private Drive folder "SAT Math Lib - Library".
//   node tools/upload_library.mjs "<project folder>/data/library" HM1 [HM2 …]   [--dry]
// Layout on Drive (spec v1.1 §6.1):  questions/<BATCH>.json  ·  figures/<BATCH>/<qid>_f<n>.png
// Each figure in the uploaded JSON gets its Drive file id (drive_id); a file this tool uploaded before is replaced in place
// (same id). The local files are never changed. Uses the clasp login in ~/.clasprc.json (scope drive.file: it only sees
// files and folders it created itself). NEVER put library files in the repo: they hold questions + answer keys.
// Afterwards the Sheet picks the batch up at the next deploy, or in the Apps Script editor: run syncLibrary.
import fs from 'fs'; import os from 'os'; import path from 'path';

const LIBRARY_FOLDER = '1kv4i4SLgFFJDOBztZdYt6OFN3EPsQI81'; // My Drive › 📚 Academics › SAT › SAT Math Lib › SAT Math Lib - Library
const args = process.argv.slice(2), dry = args.includes('--dry');
const [lib, ...batches] = args.filter(a => a !== '--dry');
if (!lib || !batches.length) { console.error('usage: node tools/upload_library.mjs <data/library> BATCH [BATCH …] [--dry]'); process.exit(2); }

const rcFile = process.env.CLASPRC || path.join(os.homedir(), '.clasprc.json');
const rc = JSON.parse(fs.readFileSync(rcFile, 'utf8'));
const tok = (rc.tokens && (rc.tokens.default || Object.values(rc.tokens)[0])) || rc.token || rc;
let access = null;
async function token() {
  if (access) return access;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: tok.client_id || rc.oauth2ClientSettings?.clientId, client_secret: tok.client_secret || rc.oauth2ClientSettings?.clientSecret,
                                refresh_token: tok.refresh_token, grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Google login refused: ' + JSON.stringify(j));
  return (access = j.access_token);
}
async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + await token(), ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + url.split('?')[0] + ': ' + t.slice(0, 300));
  return t ? JSON.parse(t) : {};
}
const q = s => encodeURIComponent(s);
async function find(name, parent, folder) {
  const mt = folder ? " and mimeType = 'application/vnd.google-apps.folder'" : " and mimeType != 'application/vnd.google-apps.folder'";
  const r = await api(`https://www.googleapis.com/drive/v3/files?q=${q(`name = '${name.replace(/'/g, "\\'")}' and '${parent}' in parents and trashed = false${mt}`)}&fields=files(id,name)&pageSize=10`);
  return (r.files || [])[0] || null;
}
async function folder(name, parent) {
  const f = await find(name, parent, true);
  if (f) return f.id;
  if (dry) return 'DRY-' + name;
  const r = await api('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [parent], mimeType: 'application/vnd.google-apps.folder' }) });
  return r.id;
}
async function put(name, parent, mime, body) {
  const old = await find(name, parent, false);
  if (dry) return old ? old.id : 'DRY';
  const b = 'sml' + Date.now();
  const meta = old ? { name } : { name, parents: [parent], mimeType: mime };
  const head = Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`);
  const data = Buffer.concat([head, Buffer.isBuffer(body) ? body : Buffer.from(body), Buffer.from(`\r\n--${b}--`)]);
  const url = old ? `https://www.googleapis.com/upload/drive/v3/files/${old.id}?uploadType=multipart&fields=id` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  const r = await api(url, { method: old ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: data });
  return r.id;
}

const qFolder = await folder('questions', LIBRARY_FOLDER), fRoot = await folder('figures', LIBRARY_FOLDER);
for (const batch of batches) {
  const file = path.join(lib, 'questions', batch + '.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.batch !== batch) throw new Error(file + ' holds batch ' + data.batch);
  const fFolder = await folder(batch, fRoot);
  let nFig = 0;
  for (const qq of data.questions || []) for (const f of qq.figures || []) {
    const png = fs.readFileSync(path.join(lib, f.file));
    f.drive_id = await put(path.basename(f.file), fFolder, 'image/png', png);
    delete f.src;
    nFig++;
  }
  data.uploaded_at = new Date().toISOString();
  const id = await put(batch + '.json', qFolder, 'application/json', JSON.stringify(data));
  console.log(`${dry ? '[dry] ' : ''}${batch}: ${data.questions.length} questions, ${nFig} figures → questions/${batch}.json (id ${id})`);
}
