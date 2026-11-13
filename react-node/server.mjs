import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState } from './src/domain.mjs';
const ROOT = dirname(fileURLToPath(import.meta.url));
const failure = (status, message) => Object.assign(new Error(message), {status});
export function createApp({dbPath = resolve(process.env.ATLAS_DATA_DIR || resolve(ROOT, '.data'), 'preview.sqlite3'), frameworkPath = resolve(ROOT, '../framework.json'), user = process.env.ATLAS_USER || '', password = process.env.ATLAS_PASSWORD || '', production = process.env.NODE_ENV === 'production'} = {}) {
  if (production && (!user || password.length < 16)) throw Error('Production requires ATLAS_USER and ATLAS_PASSWORD (at least 16 characters), and HTTPS at the hosting proxy.');
  if ((user && !password) || (!user && password)) throw Error('Set both ATLAS_USER and ATLAS_PASSWORD.');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), {recursive:true});
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,state TEXT,revision INTEGER,updated TEXT); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,workspace TEXT,title TEXT,state TEXT,created TEXT);');
  const dist = resolve(ROOT, 'dist');
  const send = (res, code, value) => {res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  const digest = text => createHash('sha256').update(text).digest();
  const expected = 'Basic ' + Buffer.from(user + ':' + password).toString('base64');
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
      if (url.pathname === '/api/health' && req.method === 'GET') return send(res,200,{ok:true,preview:true});
      if (password && !timingSafeEqual(digest(req.headers.authorization || ''), digest(expected))) {res.setHeader('WWW-Authenticate','Basic realm="Curriculum Atlas preview", charset="UTF-8"');return send(res,401,{error:'Aanmelden vereist.'});}
      if (req.method === 'POST' && req.headers.origin && req.headers.origin !== 'http://' + req.headers.host && req.headers.origin !== 'https://' + req.headers.host) throw failure(403,'Cross-origin request refused.');
      let body = {};
      if (req.method === 'POST') {
        if (!(req.headers['content-type'] || '').startsWith('application/json')) throw failure(415,'JSON vereist.');
        const chunks=[];let length=0;
        for await (const chunk of req) {length+=chunk.length;if(length>5000000) throw failure(413,'Bestand groter dan 5 MB.');chunks.push(chunk);}
        try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw failure(400,'Ongeldige JSON.');}
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure(400,'JSON-object vereist.');
      }
      if (url.pathname === '/api/framework' && req.method === 'GET') return send(res,200,JSON.parse(readFileSync(frameworkPath,'utf8')));
      if (url.pathname === '/api/workspaces' && req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM workspaces ORDER BY updated DESC').all();
        return send(res,200,rows.flatMap(r=>{const state=JSON.parse(r.state);return state.archived && url.searchParams.get('all') !== '1' ? [] : [{id:r.id,name:state.programme,revision:r.revision,updated:r.updated}];}));
      }
      if (url.pathname.startsWith('/api/workspaces/') && req.method === 'GET') {
        const id=decodeURIComponent(url.pathname.slice('/api/workspaces/'.length)), row=db.prepare('SELECT * FROM workspaces WHERE id=?').get(id);
        if (!row) throw failure(404,'Werkruimte niet gevonden.');
        return send(res,200,{id,state:JSON.parse(row.state),revision:row.revision,sessions:db.prepare('SELECT id,title,created FROM sessions WHERE workspace=? ORDER BY created DESC').all(id)});
      }
      if (url.pathname === '/api/save' && req.method === 'POST') {
        let state;try {state=readState(body.state);} catch(e) {throw failure(400,e.message);}
        if (body.id != null && (typeof body.id !== 'string' || !body.id)) throw failure(400,'Ongeldige werkruimte-ID.');
        const id=body.id || randomUUID(), updated=new Date().toISOString();
        db.exec('BEGIN IMMEDIATE');
        try {
          const old=db.prepare('SELECT * FROM workspaces WHERE id=?').get(id);
          if (body.id && !old) throw failure(409,'Werkruimte verwijderd. Exporteer lokale wijzigingen.');
          if (old && old.revision !== body.revision) throw failure(409,'Een ander venster heeft deze werkruimte gewijzigd. Exporteer lokale wijzigingen voordat je herlaadt.');
          if (old) {const prev=JSON.parse(old.state);if(prev.archived){state.archived=true;state.archivedAt=prev.archivedAt || '';}else{delete state.archived;delete state.archivedAt;}}
          const revision=(old?.revision || 0)+1, json=JSON.stringify(state);
          db.prepare('INSERT OR REPLACE INTO workspaces VALUES(?,?,?,?)').run(id,json,revision,updated);
          if (body.finish === true) db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(randomUUID(),id,state.sessionTitle || 'Review',json,updated);
          db.exec('COMMIT');return send(res,200,{id,revision,updated});
        } catch(e) {db.exec('ROLLBACK');throw e;}
      }
      if (url.pathname.startsWith('/api/')) throw failure(404,'API-route niet beschikbaar in deze preview.');
      if (req.method !== 'GET') throw failure(405,'Methode niet toegestaan.');
      const file = resolve(dist, '.' + (decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(dist + sep)) throw failure(403,'Ongeldig pad.');
      let content;try {if(!statSync(file).isFile()) throw Error();content=readFileSync(file);} catch {throw failure(404,'Frontend ontbreekt of bestand niet gevonden. Voer npm run build uit.');}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
      res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream'});res.end(content);
    } catch(e) {if(!e.status) console.error(e);if(!res.headersSent) send(res,e.status || 500,{error:e.status ? e.message : 'Serverfout; opslag niet bevestigd.'});else res.end();}
  });
  server.on('close',()=>db.close());return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3001), host=process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  createApp().listen(port,host,()=>console.log(`Curriculum Atlas React preview listening on ${host}:${port}`));
}
