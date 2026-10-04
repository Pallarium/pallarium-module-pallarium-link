/* Pallarium Link — Pallarium module. Scaffolded: the PallariumModules hook is
   already wired. Add your feature in the marked block; do NOT create other
   files or edit Pallarium's source. Then it's ready to RegisterModule. */
(function () {
  // ▼ THIS MODULE'S LOOK — generated for it (style seed #2048388962). Keep these values; colour the UI
  //   only with var(--…) inside .pallarium-link-look, never :root or Pallarium's own elements.
  var lookCss = document.createElement('style'); lookCss.id = "pallarium-link-look-css";
  lookCss.textContent = ".pallarium-link-look{--bg:#e4e8de;--surface:#f3f3f1;--ink:#242c16;--muted:#778068;--hairline:#ccd3c0;--accent:#5f0ceb;--warn:#f2ad0d;--error:#e62019;;background:var(--bg);color:var(--ink);font-family:'Quicksand',system-ui,sans-serif}.pallarium-link-look h1,.pallarium-link-look h2,.pallarium-link-look h3{font-family:'Comfortaa',system-ui,sans-serif}";
  document.head.appendChild(lookCss);
  var lookFonts = document.createElement('link'); lookFonts.rel = 'stylesheet'; lookFonts.href = "https://fonts.googleapis.com/css2?family=Comfortaa:wght@500;700\u0026family=Quicksand:wght@500;700\u0026display=swap";
  document.head.appendChild(lookFonts);
  PallariumModules.onTeardown("pallarium-link", function () { lookCss.remove(); lookFonts.remove(); });
  function build(body, detached) {
    body.classList.add("pallarium-link-look");
    // ▼▼▼ YOUR FEATURE — build the panel contents in `body` ▼▼▼
    var API = 'http://127.0.0.1:8777/local/';
    var H = { 'x-link': '1', 'content-type': 'application/json' };
    var get = function (p) { return fetch(API + p, { headers: H }).then(function (r) { return r.json(); }); };
    var post = function (p, o) { return fetch(API + p, { method: 'POST', headers: H, body: JSON.stringify(o || {}) }).then(function (r) { return r.json(); }); };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    body.innerHTML = '<style>.pallarium-link-look{padding:22px;overflow:auto}.pl-card{background:var(--surface);border:2px solid var(--hairline);border-radius:14px;padding:16px;margin-bottom:14px}' +
      '.pl-card h3{margin:0 0 8px;font-size:15px}.pl-m{color:var(--muted);font-size:12px}.pl-b{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:8px 14px;font:700 13px inherit;cursor:pointer;transition:transform .15s}.pl-b:active{transform:scale(.92)}' +
      '.pl-b.g{background:var(--hairline);color:var(--ink)}.pl-b.r{background:var(--error)}.pl-code{font:700 34px Comfortaa,sans-serif;letter-spacing:6px;color:var(--accent)}' +
      '.pl-row{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--hairline)}.pl-row>span{flex:1}.pl-pend{border-color:var(--warn)}' +
      '.pl-log{font:11px ui-monospace,monospace;color:var(--muted);max-height:140px;overflow:auto}</style>' +
      '<h2 style="margin:0 0 14px">Pallarium Link</h2><div id="pl-off" class="pl-card" style="display:none">Link server is not running yet. Enable the module and allow it in Settings, then reopen.</div>' +
      '<div id="pl-me" class="pl-card"></div><div id="pl-pend"></div><div id="pl-peers" class="pl-card"></div><div class="pl-card"><h3>Log</h3><div id="pl-log" class="pl-log"></div></div>';
    var q = function (s) { return body.querySelector(s); };
    function render(s) {
      q('#pl-off').style.display = 'none';
      q('#pl-me').innerHTML = '<h3>This PC: ' + esc(s.name) + '</h3><div class="pl-m">Address: ' + s.ips.map(function (i) { return esc(i) + ':' + s.port; }).join(' · ') + '</div>' +
        '<div style="margin-top:12px">' + (s.code ? '<div class="pl-code">' + esc(s.code) + '</div><div class="pl-m">Tell the other PC: pair with this address and this code. Valid 5 minutes, one use.</div>' : '<button class="pl-b" id="pl-gen">Make pairing code</button>') + '</div>';
      var g = q('#pl-gen'); if (g) g.onclick = function () { post('code').then(poll); };
      q('#pl-pend').innerHTML = s.pending.map(function (j) { return '<div class="pl-card pl-pend"><h3>' + esc(j.from) + ' wants to ' + esc(j.action) + '</h3><div class="pl-m">' + esc(JSON.stringify(j.args)) + '</div><div style="margin-top:10px;display:flex;gap:8px"><button class="pl-b" data-a="1" data-id="' + j.id + '">Approve</button><button class="pl-b r" data-a="0" data-id="' + j.id + '">Deny</button></div></div>'; }).join('');
      q('#pl-pend').querySelectorAll('button').forEach(function (b) { b.onclick = function () { post('approve', { id: b.dataset.id, yes: b.dataset.a === '1' }).then(poll); }; });
      q('#pl-peers').innerHTML = '<h3>Paired PCs</h3>' + (s.peers.length ? s.peers.map(function (p) { return '<div class="pl-row"><span><b>' + esc(p.name) + '</b> <span class="pl-m">' + esc(p.host) + '</span></span><label class="pl-m"><input type="checkbox" data-auto="' + p.id + '"' + (p.auto ? ' checked' : '') + '> auto-approve their requests</label><button class="pl-b g" data-un="' + p.id + '">Unpair</button></div>'; }).join('') : '<div class="pl-m">None yet. Make a code here, then on the other PC ask Pallarium: "pair with ' + (s.ips[0] || 'IP') + ' code XXXXXXXX".</div>');
      q('#pl-peers').querySelectorAll('[data-auto]').forEach(function (c) { c.onchange = function () { post('auto', { id: c.dataset.auto, on: c.checked }); }; });
      q('#pl-peers').querySelectorAll('[data-un]').forEach(function (b) { b.onclick = function () { post('unpair', { id: b.dataset.un }).then(poll); }; });
      q('#pl-log').innerHTML = s.log.map(function (l) { return new Date(l.t).toLocaleTimeString() + '  ' + esc(l.m); }).join('<br>') || 'Nothing yet.';
    }
    function poll() { return get('state').then(render).catch(function () { q('#pl-off').style.display = 'block'; }); }
    if (detached) { poll(); var iv = setInterval(poll, 2500); return function () { clearInterval(iv); }; }
    PallariumModules.pollWhileOpen('pallarium-link', poll, 2500);
    // ▲▲▲ YOUR FEATURE ▲▲▲
  }

  // ---- floating icon: drag to move, double-click to detach / re-attach a transparent window ----
  var SK = 'pl-float-pos', pos = { x: innerWidth - 200, y: 2 };
  try { pos = JSON.parse(localStorage.getItem(SK)) || pos; } catch (e) {}
  var ico = document.createElement('div'); ico.id = 'pl-ico';
  ico.innerHTML = '<style>#pl-ico{position:fixed;z-index:99997;width:44px;height:44px;border-radius:11px;display:grid;place-items:center;cursor:grab;user-select:none;opacity:.6;transition:opacity .2s,box-shadow .2s;' +
    'background:radial-gradient(circle at 30% 25%,rgba(150,110,255,.55),rgba(30,20,60,.35));backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.22);box-shadow:0 6px 22px rgba(0,0,0,.35)}' +
    '#pl-ico:hover{opacity:1;box-shadow:0 0 18px rgba(130,90,255,.6)}#pl-ico i{position:absolute;right:3px;top:3px;width:9px;height:9px;border-radius:50%;background:#777;border:1px solid rgba(0,0,0,.4)}#pl-ico.on i{background:#3ddc84;box-shadow:0 0 6px #3ddc84}#pl-ico.req i{background:#f2ad0d;animation:plp 1s infinite}' +
    '@keyframes plp{50%{transform:scale(1.5)}}' +
    '#pl-win{position:fixed;z-index:99996;width:340px;max-height:70vh;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.22);box-shadow:0 12px 40px rgba(0,0,0,.45);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}' +
    '#pl-win .pl-h{padding:7px 12px;font:700 12px system-ui;color:#fff;background:rgba(40,30,80,.55);cursor:grab;display:flex;justify-content:space-between;user-select:none}' +
    '#pl-win .pl-bd{overflow:auto;flex:1;opacity:.94}#pl-win .pallarium-link-look{background:rgba(228,232,222,.82)}</style>' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg><i></i>';
  document.body.appendChild(ico);
  function place(el, p) { el.style.left = Math.max(0, Math.min(innerWidth - 44, p.x)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 44, p.y)) + 'px'; }
  place(ico, pos);
  function drag(handle, move, done) {
    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return; var sx = e.clientX, sy = e.clientY, moved = false;
      function mv(ev) { var dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; if (moved) move(dx, dy); }
      function up() { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved && done) done(); }
      addEventListener('mousemove', mv); addEventListener('mouseup', up); e.preventDefault();
    });
  }
  var base = { x: 0, y: 0 };
  ico.addEventListener('mousedown', function () { base = { x: pos.x, y: pos.y }; }, true);
  drag(ico, function (dx, dy) { pos = { x: base.x + dx, y: base.y + dy }; place(ico, pos); }, function () { try { localStorage.setItem(SK, JSON.stringify(pos)); } catch (e) {} });
  var win = null, stop = null, wpos = null;
  function closeWin() { if (stop) stop(); if (win) win.remove(); win = null; stop = null; }
  ico.addEventListener('dblclick', function () {
    if (win) return closeWin();
    win = document.createElement('div'); win.id = 'pl-win';
    win.innerHTML = '<div class="pl-h"><span>Pallarium Link</span><span style="cursor:pointer" id="pl-wx">✕</span></div><div class="pl-bd"></div>';
    document.body.appendChild(win);
    wpos = wpos || { x: Math.max(8, Math.min(innerWidth - 348, pos.x - 150)), y: pos.y + 54 };
    win.style.left = wpos.x + 'px'; win.style.top = wpos.y + 'px';
    var wb = { x: 0, y: 0 };
    win.querySelector('.pl-h').addEventListener('mousedown', function () { wb = { x: wpos.x, y: wpos.y }; }, true);
    drag(win.querySelector('.pl-h'), function (dx, dy) { wpos = { x: Math.max(0, wb.x + dx), y: Math.max(0, wb.y + dy) }; win.style.left = wpos.x + 'px'; win.style.top = wpos.y + 'px'; });
    win.querySelector('#pl-wx').onclick = closeWin;
    stop = build(win.querySelector('.pl-bd'), true);
  });
  ico.title = 'Pallarium Link — drag to move, double-click to detach';
  var tick = setInterval(function () {
    fetch('http://127.0.0.1:8777/local/state', { headers: { 'x-link': '1' } }).then(function (r) { return r.json(); }).then(function (s) {
      ico.classList.add('on'); ico.classList.toggle('req', s.pending.length > 0);
    }).catch(function () { ico.classList.remove('on', 'req'); });
  }, 3000);
  PallariumModules.onTeardown('pallarium-link', function () { clearInterval(tick); closeWin(); ico.remove(); });
})();
