// Pallarium Link: MCP (stdio) + peer HTTP server. Zero dependencies.
const http = require('http'), os = require('os'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawn } = require('child_process');
const PORT = +process.env.LINK_PORT || 8777;
const STATE = path.join(__dirname, 'state.json');
let S = { id: crypto.randomBytes(6).toString('hex'), name: os.hostname(), peers: {}, log: [] };
try { S = Object.assign(S, JSON.parse(fs.readFileSync(STATE, 'utf8'))); } catch (e) {}
const save = () => { try { fs.writeFileSync(STATE, JSON.stringify(S, null, 1)); } catch (e) {} };
const log = (m) => { S.log.unshift({ t: Date.now(), m }); S.log.length = Math.min(S.log.length, 60); save(); };
save();
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest('hex');
const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
let pairCode = null, pairExp = 0, pairTries = 0;
const pending = {}, results = {}, seen = new Set();

// ---- whitelisted actions (the ONLY things a peer can make this PC do) ----
const PKG = /^[A-Za-z0-9][A-Za-z0-9.\-_]{1,80}$/;
const ACTIONS = {
  ping: { desc: 'say hello', check: () => true, run: async () => 'pong from ' + S.name },
  notify: { desc: 'show a message', check: a => typeof a.text === 'string' && a.text.length < 300, run: async a => 'message shown: ' + a.text },
  install: { desc: 'winget install', check: a => PKG.test(a.package || ''), run: a => exec('winget', ['install', '--id', a.package, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements']) },
  uninstall: { desc: 'winget uninstall', check: a => PKG.test(a.package || ''), run: a => exec('winget', ['uninstall', '--id', a.package, '-e', '--silent']) },
  search: { desc: 'winget search', check: a => typeof a.query === 'string' && /^[\w .\-]{1,60}$/.test(a.query), run: a => exec('winget', ['search', a.query, '--accept-source-agreements'], 40000) },
};
function exec(cmd, args, ms) {
  return new Promise(res => {
    const p = spawn(cmd, args, { windowsHide: true }); let o = '';
    const t = setTimeout(() => { p.kill(); res(o.slice(-1500) + '\n[timed out]'); }, ms || 600000);
    p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d);
    p.on('error', e => { clearTimeout(t); res('error: ' + e.message); });
    p.on('close', c => { clearTimeout(t); res('exit ' + c + '\n' + o.replace(/[\x00-\x08\x0b-\x1f]/g, '').slice(-1500)); });
  });
}
async function perform(job) {
  job.status = 'running';
  try { job.output = await ACTIONS[job.action].run(job.args); job.status = 'done'; } catch (e) { job.output = String(e); job.status = 'failed'; }
  log(`${job.action} ${JSON.stringify(job.args)} from ${job.fromName}: ${job.status}`);
}

// ---- HTTP ----
const body = req => new Promise(r => { let b = ''; req.on('data', d => { b += d; if (b.length > 1e5) req.destroy(); }); req.on('end', () => r(b)); });
const json = (res, c, o, h) => { res.writeHead(c, Object.assign({ 'Content-Type': 'application/json' }, h || {})); res.end(JSON.stringify(o)); };
const localOK = req => /^(::1|::ffff:)?127\.0\.0\.1$|^::1$/.test(req.socket.remoteAddress) || req.socket.remoteAddress === '::ffff:127.0.0.1';
const originOK = o => !o || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
const ips = () => Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url.startsWith('/local/')) {
      if (!localOK(req) || !originOK(req.headers.origin) || req.headers['x-link'] !== '1') return json(res, 403, { error: 'forbidden' });
      const cors = { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Headers': 'x-link,content-type' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      const b = req.method === 'POST' ? JSON.parse((await body(req)) || '{}') : {};
      if (url === '/local/state') return json(res, 200, { id: S.id, name: S.name, port: PORT, ips: ips(), code: Date.now() < pairExp ? pairCode : null, peers: Object.values(S.peers).map(p => ({ id: p.id, name: p.name, host: p.host, port: p.port, auto: !!p.auto })), pending: Object.values(pending).filter(j => j.status === 'pending').map(j => ({ id: j.id, from: j.fromName, action: j.action, args: j.args })), log: S.log.slice(0, 15) }, cors);
      if (url === '/local/code') { pairCode = String(crypto.randomInt(10000000, 99999999)); pairExp = Date.now() + 300000; pairTries = 0; return json(res, 200, { code: pairCode }, cors); }
      if (url === '/local/approve') { const j = pending[b.id]; if (j && j.status === 'pending') { if (b.yes) perform(j); else { j.status = 'denied'; log(`denied ${j.action} from ${j.fromName}`); } } return json(res, 200, { ok: 1 }, cors); }
      if (url === '/local/auto') { if (S.peers[b.id]) { S.peers[b.id].auto = !!b.on; save(); } return json(res, 200, { ok: 1 }, cors); }
      if (url === '/local/unpair') { delete S.peers[b.id]; save(); return json(res, 200, { ok: 1 }, cors); }
      if (url === '/local/name') { S.name = String(b.name || S.name).slice(0, 40); save(); return json(res, 200, { ok: 1 }, cors); }
      return json(res, 404, {}, cors);
    }
    if (url === '/pair' && req.method === 'POST') {
      const b = JSON.parse(await body(req));
      if (!pairCode || Date.now() > pairExp) return json(res, 403, { error: 'no active pairing code' });
      if (++pairTries > 3) { pairCode = null; return json(res, 403, { error: 'too many tries' }); }
      if (!eq(String(b.proof), hmac(pairCode, 'A' + b.nonceA))) return json(res, 403, { error: 'bad code' });
      const nonceB = crypto.randomBytes(16).toString('hex');
      const secret = hmac(pairCode, 'S' + b.nonceA + nonceB);
      S.peers[b.id] = { id: b.id, name: String(b.name).slice(0, 40), host: req.socket.remoteAddress.replace('::ffff:', ''), port: +b.port, secret, auto: false };
      pairCode = null; log('paired with ' + b.name); return json(res, 200, { id: S.id, name: S.name, nonceB, proof: hmac(secret, 'B' + b.nonceA), port: PORT });
    }
    if (url === '/act' || url === '/status') {
      const raw = await body(req), b = JSON.parse(raw), p = S.peers[b.from];
      if (!p || !eq(String(req.headers['x-sig'] || ''), hmac(p.secret, raw))) return json(res, 401, { error: 'unauthorized' });
      if (Math.abs(Date.now() - b.ts) > 60000 || seen.has(b.nonce)) return json(res, 401, { error: 'stale or replayed' });
      seen.add(b.nonce); setTimeout(() => seen.delete(b.nonce), 120000);
      if (url === '/status') { const j = pending[b.job]; return json(res, 200, j && j.from === p.id ? { status: j.status, output: j.output } : { status: 'unknown' }); }
      const a = ACTIONS[b.action];
      if (!a || !a.check(b.args || {})) return json(res, 400, { error: 'action not allowed' });
      const j = { id: crypto.randomBytes(5).toString('hex'), from: p.id, fromName: p.name, action: b.action, args: b.args || {}, status: 'pending' };
      pending[j.id] = j; log(`request ${j.action} from ${p.name}`);
      if (p.auto) perform(j);
      return json(res, 200, { job: j.id, status: j.status });
    }
    json(res, 404, {});
  } catch (e) { json(res, 400, { error: 'bad request' }); }
}).listen(PORT, '0.0.0.0', () => process.stderr.write('link listening ' + PORT + '\n')).on('error', e => process.stderr.write('link listen error ' + e.message + '\n'));

// ---- outgoing ----
async function call(peer, path, o) {
  const raw = JSON.stringify(Object.assign({ from: S.id, ts: Date.now(), nonce: crypto.randomBytes(8).toString('hex') }, o));
  const r = await fetch(`http://${peer.host}:${peer.port}${path}`, { method: 'POST', body: raw, headers: { 'x-sig': hmac(peer.secret, raw) }, signal: AbortSignal.timeout(15000) });
  return r.json();
}
const findPeer = n => Object.values(S.peers).find(p => p.id === n || p.name.toLowerCase() === String(n).toLowerCase());
async function pair(host, port, code) {
  const nonceA = crypto.randomBytes(16).toString('hex');
  const r = await fetch(`http://${host}:${port || 8777}/pair`, { method: 'POST', signal: AbortSignal.timeout(10000), body: JSON.stringify({ id: S.id, name: S.name, port: PORT, nonceA, proof: hmac(code, 'A' + nonceA) }) });
  const b = await r.json(); if (!r.ok) throw new Error(b.error || 'pair failed');
  const secret = hmac(code, 'S' + nonceA + b.nonceB);
  if (!eq(b.proof, hmac(secret, 'B' + nonceA))) throw new Error('peer failed verification');
  S.peers[b.id] = { id: b.id, name: b.name, host, port: b.port, secret, auto: false }; log('paired with ' + b.name); return b.name;
}
async function act(peerName, action, args) {
  const p = findPeer(peerName); if (!p) throw new Error('unknown peer; paired: ' + Object.values(S.peers).map(x => x.name).join(', '));
  const r = await call(p, '/act', { action, args }); if (!r.job) throw new Error(r.error || 'rejected');
  for (let i = 0; i < 200; i++) {
    const s = await call(p, '/status', { job: r.job });
    if (['done', 'failed', 'denied'].includes(s.status)) return `${p.name}: ${s.status}\n${s.output || ''}`;
    if (i === 0) process.stderr.write('waiting for approval on ' + p.name + '\n');
    await new Promise(z => setTimeout(z, 3000));
  }
  return p.name + ': still waiting (not approved yet or still running)';
}

// ---- MCP stdio ----
const TOOLS = [
  { name: 'link_peers', description: 'List paired Pallarium PCs and this PC\'s link address.', inputSchema: { type: 'object', properties: {} } },
  { name: 'link_pair', description: 'Pair with another PC. host = its IP, code = the 8-digit code shown in its Pallarium Link panel.', inputSchema: { type: 'object', properties: { host: { type: 'string' }, code: { type: 'string' }, port: { type: 'number' } }, required: ['host', 'code'] } },
  { name: 'link_install', description: 'Install a program on a paired PC via winget (package id like Mozilla.Firefox or Discord.Discord). The other PC approves unless auto-approve is on.', inputSchema: { type: 'object', properties: { peer: { type: 'string' }, package: { type: 'string' } }, required: ['peer', 'package'] } },
  { name: 'link_uninstall', description: 'Uninstall a program on a paired PC via winget.', inputSchema: { type: 'object', properties: { peer: { type: 'string' }, package: { type: 'string' } }, required: ['peer', 'package'] } },
  { name: 'link_search', description: 'Search winget packages on a paired PC to find the exact id.', inputSchema: { type: 'object', properties: { peer: { type: 'string' }, query: { type: 'string' } }, required: ['peer', 'query'] } },
  { name: 'link_message', description: 'Send a text message / ping to a paired PC.', inputSchema: { type: 'object', properties: { peer: { type: 'string' }, text: { type: 'string' } }, required: ['peer'] } },
];
async function tool(n, a) {
  if (n === 'link_peers') return JSON.stringify({ me: S.name, id: S.id, port: PORT, ips: ips(), peers: Object.values(S.peers).map(p => ({ name: p.name, host: p.host, auto: !!p.auto })) });
  if (n === 'link_pair') return 'paired with ' + await pair(a.host, a.port, String(a.code));
  if (n === 'link_install') return act(a.peer, 'install', { package: a.package });
  if (n === 'link_uninstall') return act(a.peer, 'uninstall', { package: a.package });
  if (n === 'link_search') return act(a.peer, 'search', { query: a.query });
  if (n === 'link_message') return act(a.peer, a.text ? 'notify' : 'ping', { text: a.text });
  throw new Error('unknown tool');
}
let inb = '';
process.stdin.on('data', d => {
  inb += d; let i;
  while ((i = inb.indexOf('\n')) >= 0) {
    const l = inb.slice(0, i).trim(); inb = inb.slice(i + 1); if (!l) continue;
    let m; try { m = JSON.parse(l); } catch (e) { continue; }
    const out = r => process.stdout.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', id: m.id }, r)) + '\n');
    if (m.method === 'initialize') out({ result: { protocolVersion: m.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'pallarium-link', version: '1.0.0' } } });
    else if (m.method === 'tools/list') out({ result: { tools: TOOLS } });
    else if (m.method === 'tools/call') tool(m.params.name, m.params.arguments || {}).then(t => out({ result: { content: [{ type: 'text', text: String(t) }] } }), e => out({ result: { isError: true, content: [{ type: 'text', text: e.message }] } }));
    else if (m.id !== undefined) out({ result: {} });
  }
});
process.stdin.on('end', () => process.exit(0));
