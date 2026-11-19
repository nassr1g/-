/* =========================================================
   stickers.js — Friends' Room sticker system
   - Panel (emoji / stickers), Recent + Saved library (synced to the account)
   - Create sticker (image crop + simple background removal, GIF, animated WebP, video)
   - WhatsApp import (export-chat ZIP, .webp files, or Share Target)
   - Dedup: every sticker is identified by the SHA-256 of its bytes.
       upload : registry stickers/<hash> in Firebase -> if it exists, the file is NEVER uploaded again
       download: IndexedDB (fr-stickers) first -> network only when this device never had it
   Talks to app.js only through window.FRChat.
   ========================================================= */
(() => {
  'use strict';
  const C = () => window.FRChat;
  const $ = (id) => document.getElementById(id);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const tmo = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
  const SV = () => firebase.database.ServerValue.TIMESTAMP;
  const MAX_RECENT = 30, LS_MODE = 'fr_panel_mode';
  const ico = (d) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const err = (m) => C().toast(m, null, null, true, 4500);

  // ---------------- local storage (IndexedDB, own database: never touches the chat store) ----------------
  let dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('no-idb')); return; }
      const r = indexedDB.open('fr-stickers', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('blobs', { keyPath: 'h' }).createIndex('at', 'at');
        d.createObjectStore('meta', { keyPath: 'id' });
      };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  const tx = (store, mode, fn) => idb().then((d) => new Promise((res, rej) => {
    let out; const t = d.transaction(store, mode);
    t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error);
    fn(t.objectStore(store), (v) => { out = v; });
  }));
  const bGet = (h) => tx('blobs', 'readonly', (s, set) => { const q = s.get(h); q.onsuccess = () => set(q.result || null); }).catch(() => null);
  const bPut = (rec) => tx('blobs', 'readwrite', (s) => { s.put(rec); }).catch(() => {});
  const mGet = (id) => tx('meta', 'readonly', (s, set) => { const q = s.get(id); q.onsuccess = () => set(q.result ? q.result.v : null); }).catch(() => null);
  const mPut = (id, v) => tx('meta', 'readwrite', (s) => { s.put({ id, v }); }).catch(() => {});
  let trimT = null;
  function trimLater() { // keep the local cache bounded: drop the 100 oldest once it passes 500 files
    clearTimeout(trimT);
    trimT = setTimeout(() => tx('blobs', 'readwrite', (s) => {
      const cq = s.count();
      cq.onsuccess = () => {
        if (cq.result <= 500) return;
        let n = 0; const c = s.index('at').openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur && n++ < 100) { cur.delete(); cur.continue(); } };
      };
    }).catch(() => {}), 4000);
  }

  // ---------------- download side: memory -> IndexedDB -> network (once per device) ----------------
  const mem = new Map(), inflight = new Map();
  function srcFor(stk) {
    if (mem.has(stk.h)) return Promise.resolve(mem.get(stk.h));
    if (inflight.has(stk.h)) return inflight.get(stk.h);
    const p = (async () => {
      let rec = await bGet(stk.h);
      if (!rec) {
        const r = await fetch(stk.u, { mode: 'cors' });
        if (!r.ok) throw new Error('http ' + r.status);
        const blob = await r.blob();
        if (!blob.size || blob.size > 8 * 1048576) throw new Error('bad');
        rec = { h: stk.h, blob, at: Date.now() }; bPut(rec); trimLater();
      }
      const u = URL.createObjectURL(rec.blob); mem.set(stk.h, u); return u;
    })();
    inflight.set(stk.h, p);
    const done = () => inflight.delete(stk.h); p.then(done, done);
    return p;
  }

  // ---------------- lazy host element (used in the grid and inside messages) ----------------
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
    const h = e.target;
    if (e.isIntersecting) { if (!h._loaded) load(h); else if (h._m && h._m.tagName === 'VIDEO') h._m.play().catch(() => {}); }
    else if (h._m && h._m.tagName === 'VIDEO') h._m.pause();
  }), { rootMargin: '160px' }) : null;

  function attach(h, src) {
    if (h._m) h._m.remove();
    const v = h._stk.a === 2, m = document.createElement(v ? 'video' : 'img');
    if (v) { m.muted = true; m.loop = true; m.playsInline = true; m.setAttribute('playsinline', ''); m.preload = 'auto'; }
    else { m.decoding = 'async'; m.draggable = false; m.alt = ''; }
    m.addEventListener(v ? 'loadeddata' : 'load', () => { h.classList.add('ok'); h.classList.remove('err'); });
    m.addEventListener('error', () => { h.classList.add('err'); h.classList.remove('ok'); h._loaded = false; });
    m.src = src; h.appendChild(m); h._m = m; h._loaded = true;
    if (v) m.play().catch(() => {});
  }
  async function load(h) {
    if (h._busy) return;
    h._busy = true; h.classList.remove('err');
    try { attach(h, await srcFor(h._stk)); }
    catch (e) { attach(h, h._stk.u); } // storage unreachable / no CORS: let the browser load it directly
    h._busy = false;
  }
  function host(stk, cls) {
    const h = el('div', 'stk-host ' + (cls || '')); h._stk = stk;
    h.addEventListener('click', (e) => { if (h.classList.contains('err')) { e.stopPropagation(); load(h); } });
    if (io) io.observe(h); else load(h);
    return h;
  }
  window.addEventListener('online', () => document.querySelectorAll('.stk-host.err').forEach(load));
  function makeEl(stk) {
    const h = host(stk, 'stk-msg-host'), k = 168 / Math.max(stk.w || 1, stk.g || 1);
    h.style.width = Math.max(60, Math.round(stk.w * k)) + 'px'; h.style.height = Math.max(60, Math.round(stk.g * k)) + 'px';
    return h;
  }

  // ---------------- upload side: hash -> registry -> (only if new) signed upload ----------------
  async function sha256(buf) {
    const d = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function upload(url, fd, onProg) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest(); x.open('POST', url); x.timeout = 90000;
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProg) onProg(e.loaded / e.total); };
      x.onload = () => { try { const j = JSON.parse(x.responseText); if (x.status < 300 && j.secure_url) res(j); else rej(new Error((j.error && j.error.message) || 'upload')); } catch (e) { rej(e); } };
      x.onerror = () => rej(new Error('net')); x.ontimeout = () => rej(new Error('timeout'));
      x.send(fd);
    });
  }
  async function registerBlob(blob, meta, onProg) { // -> {h,u,w,g,a}; uploads only when nobody ever uploaded these exact bytes
    const db = C().db(), h = await sha256(await blob.arrayBuffer());
    const norm = (r) => ({ h, u: r.u, w: r.w, g: r.g, a: r.a });
    try { const s = await tmo(db.ref('stickers/' + h).once('value'), 8000); if (s.val() && s.val().u) return norm(s.val()); } catch (e) {}
    const tok = await firebase.auth().currentUser.getIdToken();
    const sr = await tmo(fetch('/api/sticker-sign', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ h, video: meta.a === 2 }) }), 15000);
    if (!sr.ok) throw new Error('sign ' + sr.status);
    const sg = await sr.json();
    if (sg.exists) return norm(sg);
    const fd = new FormData();
    fd.append('file', blob); fd.append('api_key', sg.apiKey); fd.append('timestamp', sg.timestamp);
    fd.append('signature', sg.signature); fd.append('public_id', sg.publicId); fd.append('overwrite', 'false');
    const up = await upload(sg.url, fd, onProg);
    const rec = { u: up.secure_url, w: meta.w, g: meta.g, a: meta.a, by: C().uid(), ts: SV() };
    try { await db.ref('stickers/' + h).set(rec); } catch (e) {} // first writer wins; same bytes -> same URL anyway
    bPut({ h, blob, at: Date.now() }); // the uploader never has to download its own sticker
    return norm(rec);
  }

  // ---------------- library (Saved + Recent), synced to the account, cached for offline ----------------
  const lib = { saved: [], recent: [] }; let libStarted = false, secs = {};
  const entry = (s) => ({ u: s.u, w: s.w, g: s.g, a: s.a, ts: SV() });
  const libRef = (k) => C().db().ref('stickerLib/' + C().uid() + '/' + k);
  const toList = (s) => { const a = []; s.forEach((c) => { a.push(Object.assign({ h: c.key }, c.val())); }); return a.reverse(); };
  function startLib() {
    if (libStarted) return; libStarted = true;
    const id = 'lib:' + C().uid(); let fresh = false;
    mGet(id).then((v) => { if (v && !fresh) { lib.saved = v.saved || []; lib.recent = v.recent || []; renderLib(); } });
    const upd = (k) => (s) => { fresh = true; lib[k] = toList(s); renderLib(); mPut(id, lib); };
    libRef('saved').orderByChild('ts').limitToLast(200).on('value', upd('saved'));
    libRef('recent').orderByChild('ts').limitToLast(MAX_RECENT).on('value', upd('recent'));
  }
  function fill(kind) {
    const list = lib[kind], s = secs[kind], k = list.map((x) => x.h).join(',');
    if (s.sig === k) return; s.sig = k;
    s.grid.textContent = ''; s.empty.style.display = list.length ? 'none' : '';
    list.forEach((stk) => { const c = host(stk, 'stk-cell'); bindCell(c, stk, kind); s.grid.appendChild(c); });
  }
  const renderLib = () => { if (secs.recent) { fill('recent'); fill('saved'); } };
  function save(stk, quiet) {
    if (!C().online()) { err('الحفظ يتطلب اتصالًا بالإنترنت'); return Promise.resolve(); }
    return libRef('saved/' + stk.h).set(entry(stk)).then(() => { if (!quiet) C().toast('تم حفظ الملصق', null, null, false, 1600); }).catch(() => err('تعذر حفظ الملصق'));
  }
  function touchRecent(stk) {
    if (!C().online()) return;
    const full = lib.recent.length >= MAX_RECENT && !lib.recent.some((x) => x.h === stk.h);
    libRef('recent/' + stk.h).set(entry(stk)).then(() => {
      if (!full) return;
      libRef('recent').orderByChild('ts').once('value').then((s) => { const a = []; s.forEach((c) => { a.push(c.key); }); a.slice(0, Math.max(0, a.length - MAX_RECENT)).forEach((k) => libRef('recent/' + k).remove()); });
    }).catch(() => {});
  }
  function sendSticker(stk) {
    C().sendSticker({ h: stk.h, u: stk.u, w: stk.w, g: stk.g, a: stk.a });
    touchRecent(stk);
  }
  function bindCell(c, stk, kind) {
    let t = null, fired = false, sx = 0, sy = 0;
    c.addEventListener('pointerdown', (e) => {
      fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(t);
      t = setTimeout(() => { fired = true; if (navigator.vibrate) navigator.vibrate(12); cellMenu(stk, kind); }, 430);
    });
    c.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) clearTimeout(t); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => c.addEventListener(ev, () => clearTimeout(t)));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('click', () => {
      if (fired) { fired = false; return; }
      if (c.classList.contains('err')) return;
      sendSticker(stk); c.classList.remove('sent'); void c.offsetWidth; c.classList.add('sent');
      if (navigator.vibrate) navigator.vibrate(10);
    });
  }
  function cellMenu(stk, kind) {
    const isSaved = lib.saved.some((x) => x.h === stk.h), acts = [];
    if (isSaved) acts.push({ label: 'إزالة من المحفوظة', danger: true, onClick: () => libRef('saved/' + stk.h).remove().catch(() => err('تعذرت الإزالة')) });
    else acts.push({ label: 'حفظ في المحفوظة', onClick: () => save(stk) });
    if (kind === 'recent') acts.push({ label: 'حذف من الأخيرة', danger: true, onClick: () => libRef('recent/' + stk.h).remove().catch(() => {}) });
    C().sheet('الملصق', '', acts);
  }

  // ---------------- panel (emoji / stickers) ----------------
  let mode = 'emoji', view = null;
  function setMode(m, persist) {
    mode = m; const p = $('emojiPanel'), sw = $('panelSwitch');
    p.classList.toggle('m-stk', m === 'stk'); sw.dataset.m = m;
    sw.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.m === m));
    if (persist) { try { localStorage.setItem(LS_MODE, m); } catch (e) {} }
    if (m === 'stk') { startLib(); toggleVideos(true); } else toggleVideos(false);
  }
  function toggleVideos(on) { if (view) view.querySelectorAll('video').forEach((v) => { if (on) v.play().catch(() => {}); else v.pause(); }); }
  function panelOpened(isReaction) {
    let m = 'emoji'; if (!isReaction) { try { m = localStorage.getItem(LS_MODE) || 'emoji'; } catch (e) {} }
    setMode(m === 'stk' ? 'stk' : 'emoji', false);
  }
  function panelClosed() { toggleVideos(false); }
  function section(title) {
    const w = el('section', 'stk-sec'), g = el('div', 'stk-grid');
    const e = el('div', 'stk-empty', title === 'recent' ? 'الملصقات التي ترسلها ستظهر هنا' : 'اضغط مطولًا على أي ملصق لحفظه هنا');
    w.appendChild(el('h5', '', title === 'recent' ? 'آخر الملصقات المرسلة' : 'الملصقات المحفوظة')); w.appendChild(e); w.appendChild(g);
    return { w, grid: g, empty: e, sig: null };
  }
  function boot() {
    view = $('stkView'); if (!view || view.firstChild) return;
    const acts = el('div', 'stk-acts');
    const bc = el('button', 'stk-act primary'); bc.innerHTML = ico('<path d="M12 5v14M5 12h14"/>') + '<span>إنشاء ملصق</span>';
    const bi = el('button', 'stk-act'); bi.innerHTML = ico('<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>') + '<span>استيراد من WhatsApp</span>';
    acts.appendChild(bc); acts.appendChild(bi);
    const sc = el('div', 'stk-scroll'); secs.recent = section('recent'); secs.saved = section('saved');
    sc.appendChild(secs.recent.w); sc.appendChild(secs.saved.w);
    view.appendChild(acts); view.appendChild(sc);
    $('panelSwitch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.m !== mode) setMode(b.dataset.m, true); });
    bc.addEventListener('click', () => pickFiles('image/*,video/*', false, (f) => openEditor(f[0])));
    bi.addEventListener('click', () => openImport());
    renderLib(); handleShared();
  }

  // ---------------- helpers: file picking, overlay sheets ----------------
  function pickFiles(accept, multiple, cb) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple; i.style.display = 'none';
    i.onchange = () => { const f = Array.from(i.files || []); i.remove(); if (f.length) cb(f); };
    i.addEventListener('cancel', () => i.remove());
    document.body.appendChild(i); i.click();
  }
  function overlay(title, nav, onClose) {
    const o = el('div', 'stk-ov'), sh = el('div', 'stk-sheet'), hd = el('div', 'stk-hd'), x = el('button', 'stk-x');
    x.innerHTML = ico('<path d="M6 6l12 12M18 6L6 18"/>'); x.setAttribute('aria-label', 'إغلاق');
    hd.appendChild(el('b', '', title)); hd.appendChild(x); sh.appendChild(hd); o.appendChild(sh); document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('show'));
    let closed = false;
    FRNav.push(nav, () => { if (closed) return; closed = true; o.classList.remove('show'); setTimeout(() => o.remove(), 320); if (onClose) onClose(); });
    x.onclick = () => FRNav.back(nav);
    o.addEventListener('pointerdown', (e) => { if (e.target === o) FRNav.back(nav); });
    return { sh, close: () => FRNav.back(nav) };
  }
  const busy = (b, on) => { b.classList.toggle('loading', on); b.disabled = on; };
  function btn(cls, text) { const b = el('button', 'abtn ' + cls); b.appendChild(el('span', '', text)); b.appendChild(el('i', 'spinner')); return b; }
  function loadImg(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = url; }); }
  async function isAnimWebp(blob) {
    const u = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    return String.fromCharCode(u[0], u[1], u[2], u[3]) === 'RIFF' && String.fromCharCode(u[12], u[13], u[14], u[15]) === 'VP8X' && !!(u[20] & 2);
  }

  // ---------------- create sticker ----------------
  function cutBg(ctx, N, x, y, dw, dh, tol) { // flood-fill from the picture's edge: removes a plain / uniform background
    const im = ctx.getImageData(0, 0, N, N), d = im.data;
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(N - 1, Math.ceil(x + dw) - 1), y1 = Math.min(N - 1, Math.ceil(y + dh) - 1);
    if (x1 <= x0 + 2 || y1 <= y0 + 2) return;
    let r = 0, g = 0, b = 0;
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach((p) => { const i = (p[1] * N + p[0]) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; });
    r /= 4; g /= 4; b /= 4;
    const T = tol * 3, seen = new Uint8Array(N * N), st = [];
    const push = (X, Y) => {
      if (X < 0 || Y < 0 || X >= N || Y >= N) return;
      const p = Y * N + X; if (seen[p]) return; seen[p] = 1;
      const i = p * 4;
      if (d[i + 3] < 10 || Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b) <= T) st.push(p);
    };
    for (let X = x0; X <= x1; X++) { push(X, y0); push(X, y1); }
    for (let Y = y0; Y <= y1; Y++) { push(x0, Y); push(x1, Y); }
    while (st.length) { const p = st.pop(); d[p * 4 + 3] = 0; const X = p % N, Y = (p - X) / N; push(X + 1, Y); push(X - 1, Y); push(X, Y + 1); push(X, Y - 1); }
    ctx.putImageData(im, 0, 0);
  }
  async function toWebp(cv) {
    let last = null;
    for (const q of [0.92, 0.8, 0.65, 0.5]) {
      const b = await new Promise((r) => cv.toBlob(r, 'image/webp', q));
      if (!b) break; if (b.type !== 'image/webp') return b;
      last = b; if (b.size <= 400 * 1024) return b;
    }
    return last || new Promise((r) => cv.toBlob(r, 'image/png'));
  }
  async function openEditor(file) {
    const isVid = /^video\//.test(file.type), animWebp = file.type === 'image/webp' && await isAnimWebp(file).catch(() => false);
    const raw = file.type === 'image/gif' || animWebp; // animated image: keep the original bytes (motion preserved)
    if (raw && file.size > 2 * 1048576) return err('حجم الصورة المتحركة كبير (الحد 2MB). جرّب فيديو قصيرًا بدلًا منها.');
    if (isVid && file.size > 80 * 1048576) return err('الفيديو كبير جدًا (الحد 80MB)');
    if (!isVid && !/^image\//.test(file.type)) return err('الملف المختار ليس صورة أو فيديو');
    const url = URL.createObjectURL(file);
    let stop = false, video = null, working = false;
    const O = overlay('إنشاء ملصق', 'stkedit', () => { stop = true; if (video) video.pause(); URL.revokeObjectURL(url); });
    const box = el('div', 'stk-prev'); O.sh.appendChild(box);
    const N = isVid ? 384 : 512, S = { z: 1, ox: 0, oy: 0, bg: false, tol: 28 };
    let src, sw, sh, cv, ctx;
    try {
      if (isVid) {
        video = document.createElement('video'); video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.src = url;
        await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new Error('v')); });
        src = video; sw = video.videoWidth; sh = video.videoHeight;
      } else { src = await loadImg(url); sw = src.naturalWidth; sh = src.naturalHeight; }
    } catch (e) { O.close(); return err('تعذر قراءة هذا الملف'); }
    if (!raw) {
      cv = el('canvas'); cv.width = cv.height = N; ctx = cv.getContext('2d', { willReadFrequently: true }); box.appendChild(cv);
    } else { const im = el('img'); im.src = url; box.appendChild(im); }
    let rq = 0;
    const draw = () => {
      rq = 0; ctx.clearRect(0, 0, N, N);
      const s = Math.min(N / sw, N / sh) * S.z, dw = sw * s, dh = sh * s, x = (N - dw) / 2 + S.ox * N, y = (N - dh) / 2 + S.oy * N;
      ctx.drawImage(src, x, y, dw, dh);
      if (S.bg && !isVid) cutBg(ctx, N, x, y, dw, dh, S.tol);
    };
    const redraw = () => { if (!isVid && !rq) rq = requestAnimationFrame(draw); };
    if (!raw) {
      if (isVid) { video.play().catch(() => {}); const tick = () => { if (stop) return; draw(); requestAnimationFrame(tick); }; tick(); } else draw();
      let dr = null; cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', (e) => { dr = { x: e.clientX, y: e.clientY, ox: S.ox, oy: S.oy }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { if (!dr) return; const k = cv.getBoundingClientRect().width; S.ox = dr.ox + (e.clientX - dr.x) / k; S.oy = dr.oy + (e.clientY - dr.y) / k; redraw(); });
      ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, () => { dr = null; }));
      const zr = el('div', 'stk-row'); zr.appendChild(el('span', '', 'تكبير'));
      const zi = el('input'); zi.type = 'range'; zi.min = '0.4'; zi.max = '4'; zi.step = '0.02'; zi.value = '1';
      zi.oninput = () => { S.z = Number(zi.value); redraw(); }; zr.appendChild(zi); O.sh.appendChild(zr);
      if (!isVid) {
        const br = el('div', 'stk-row'), chip = el('button', 'stk-chip', 'إزالة الخلفية'), ti = el('input');
        ti.type = 'range'; ti.min = '8'; ti.max = '90'; ti.value = String(S.tol); ti.style.display = 'none';
        chip.onclick = () => { S.bg = !S.bg; chip.classList.toggle('on', S.bg); ti.style.display = S.bg ? '' : 'none'; redraw(); };
        ti.oninput = () => { S.tol = Number(ti.value); redraw(); };
        br.appendChild(chip); br.appendChild(ti); O.sh.appendChild(br);
        O.sh.appendChild(el('div', 'stk-note', 'تعمل إزالة الخلفية جيدًا مع الخلفيات الموحدة اللون. اسحب الصورة لتحريكها.'));
      } else O.sh.appendChild(el('div', 'stk-note', 'يُسجَّل أول 6 ثوانٍ من الفيديو كملصق متحرك. اسحب الفيديو لتحريكه.'));
    } else O.sh.appendChild(el('div', 'stk-note', 'ستُحفظ الحركة كما هي دون تحويلها إلى صورة ثابتة.'));
    const msg = el('div', 'stk-msgline'), bar = el('div', 'stk-bar'), fill = el('i'); bar.appendChild(fill); bar.style.display = 'none';
    const bSend = btn('primary', 'حفظ وإرسال'), bSave = btn('ghost', 'حفظ في المحفوظة');
    O.sh.appendChild(msg); O.sh.appendChild(bar); O.sh.appendChild(bSend); O.sh.appendChild(bSave);
    async function recordVideo() {
      const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      const mt = window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported(t));
      if (!mt) throw new Error('norec');
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mt, videoBitsPerSecond: 1200000 }), chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const fin = new Promise((r) => { rec.onstop = r; });
      video.loop = false; video.currentTime = 0; await video.play();
      rec.start(250);
      const end = () => { if (rec.state !== 'inactive') rec.stop(); };
      video.onended = end; setTimeout(end, Math.min(6, video.duration || 6) * 1000 + 150);
      await tmo(fin, 12000);
      video.loop = true; video.play().catch(() => {});
      return new Blob(chunks, { type: mt.split(';')[0] });
    }
    async function go(send, b) {
      if (working) return;
      if (!C().online()) { msg.textContent = 'إنشاء الملصق يتطلب اتصالًا بالإنترنت'; return; }
      working = true; busy(b, true); msg.textContent = ''; bar.style.display = ''; fill.style.width = '0';
      try {
        const m = raw ? { blob: file, w: sw, g: sh, a: 1 } : isVid ? { blob: await recordVideo(), w: N, g: N, a: 2 } : { blob: await toWebp(cv), w: N, g: N, a: 0 };
        const stk = await registerBlob(m.blob, m, (p) => { fill.style.width = Math.round(p * 100) + '%'; });
        await save(stk, true);
        if (send) sendSticker(stk); else C().toast('تم حفظ الملصق', null, null, false, 1600);
        O.close();
      } catch (e) {
        console.warn('sticker create', e);
        msg.textContent = e.message === 'norec' ? 'متصفحك لا يدعم تسجيل الفيديو كملصق' : 'تعذر إنشاء الملصق، حاول مرة أخرى';
        bar.style.display = 'none'; working = false; busy(b, false);
      }
    }
    bSend.onclick = () => go(true, bSend); bSave.onclick = () => go(false, bSave);
  }

  // ---------------- WhatsApp import ----------------
  async function zipEntries(file) {
    const tail = await file.slice(Math.max(0, file.size - 66000)).arrayBuffer(), dv = new DataView(tail);
    let p = -1; for (let i = tail.byteLength - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { p = i; break; } }
    if (p < 0) throw new Error('zip');
    const n = dv.getUint16(p + 10, true), cdSize = dv.getUint32(p + 12, true), cdOff = dv.getUint32(p + 16, true);
    if (cdOff === 0xFFFFFFFF || n === 0xFFFF) throw new Error('zip64');
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), out = [], dec = new TextDecoder(); let o = 0;
    for (let i = 0; i < n && o + 46 <= cd.byteLength; i++) {
      if (cd.getUint32(o, true) !== 0x02014b50) break;
      const nl = cd.getUint16(o + 28, true), el2 = cd.getUint16(o + 30, true), cl = cd.getUint16(o + 32, true);
      out.push({ name: dec.decode(new Uint8Array(cd.buffer, o + 46, nl)), method: cd.getUint16(o + 10, true), csize: cd.getUint32(o + 20, true), usize: cd.getUint32(o + 24, true), lo: cd.getUint32(o + 42, true) });
      o += 46 + nl + el2 + cl;
    }
    return out;
  }
  async function zipData(file, e) {
    const lh = new DataView(await file.slice(e.lo, e.lo + 30).arrayBuffer()), s = e.lo + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), raw = file.slice(s, s + e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    throw new Error('method');
  }
  async function gather(files, onProg) {
    const out = [], seen = new Set();
    const add = async (blob) => {
      if (out.length >= 400 || blob.size < 100 || blob.size > 1.5 * 1048576) return;
      const buf = await blob.arrayBuffer(), u = new Uint8Array(buf);
      const webp = String.fromCharCode(u[0], u[1], u[2], u[3]) === 'RIFF' && String.fromCharCode(u[8], u[9], u[10], u[11]) === 'WEBP', png = u[0] === 0x89 && u[1] === 0x50;
      if (!webp && !png) return;
      const h = await sha256(buf); if (seen.has(h)) return; seen.add(h);
      const b = blob.slice(0, blob.size, webp ? 'image/webp' : 'image/png'), url = URL.createObjectURL(b);
      let im; try { im = await loadImg(url); } catch (e) { URL.revokeObjectURL(url); return; }
      if (im.naturalWidth > 1024 || im.naturalHeight > 1024) { URL.revokeObjectURL(url); return; }
      out.push({ h, blob: b, url, w: im.naturalWidth, g: im.naturalHeight, a: webp && String.fromCharCode(u[12], u[13], u[14], u[15]) === 'VP8X' && (u[20] & 2) ? 1 : 0 });
      onProg(out.length);
    };
    for (const f of files) {
      if (/\.zip$/i.test(f.name) || /zip/.test(f.type)) {
        const es = (await zipEntries(f)).filter((e) => /\.webp$/i.test(e.name) && e.usize > 100 && e.usize < 1.5 * 1048576);
        for (const e of es) { try { await add(await zipData(f, e)); } catch (er) {} }
      } else await add(f);
    }
    return out;
  }
  function openImport(pre) {
    let items = [];
    const O = overlay('استيراد من WhatsApp', 'stkimp', () => items.forEach((i) => URL.revokeObjectURL(i.url)));
    const intro = el('div', 'stk-intro');
    ['واتساب لا يسمح لأي موقع بقراءة مفضلتك أو أخيرتك مباشرة، فهذه أبسط طريقة ممكنة:',
      '١) في واتساب افتح محادثة فيها ملصقاتك ← ⋮ ← المزيد ← تصدير المحادثة ← مع الوسائط.',
      '٢) اختر «Friends\' Room» من قائمة المشاركة (بعد تثبيت الموقع على الشاشة الرئيسية)، أو احفظ الملف ثم اخترْه بالزر أدناه.',
      '٣) ستظهر الملصقات فتختار ما تريد، ولا حاجة لفك الضغط. ويمكنك أيضًا اختيار ملفات ‎.webp‎ مباشرة.'
    ].forEach((t, i) => intro.appendChild(el('p', i ? '' : 'lead', t)));
    const pickB = btn('primary', 'اختيار ملف التصدير أو الملصقات');
    const status = el('div', 'stk-msgline'), grid = el('div', 'stk-igrid'), tools = el('div', 'stk-row'), go = btn('primary', 'استيراد المحدد');
    const bar = el('div', 'stk-bar'), fill = el('i'); bar.appendChild(fill); bar.style.display = 'none';
    grid.style.display = 'none'; tools.style.display = 'none'; go.style.display = 'none';
    const all = el('button', 'stk-chip', 'تحديد الكل'), cnt = el('span', 'stk-cnt');
    tools.appendChild(all); tools.appendChild(cnt);
    O.sh.appendChild(intro); O.sh.appendChild(pickB); O.sh.appendChild(status); O.sh.appendChild(tools); O.sh.appendChild(grid); O.sh.appendChild(bar); O.sh.appendChild(go);
    const sel = () => items.filter((i) => i.sel);
    const upd = () => { const n = sel().length; cnt.textContent = n + ' / ' + items.length; go.firstChild.textContent = 'استيراد المحدد (' + n + ')'; go.disabled = !n; all.textContent = n === items.length ? 'إلغاء التحديد' : 'تحديد الكل'; };
    async function run(files) {
      busy(pickB, true); status.textContent = 'جارٍ قراءة الملصقات...';
      try {
        items.forEach((i) => URL.revokeObjectURL(i.url));
        items = await gather(files, (n) => { status.textContent = 'تم العثور على ' + n + ' ملصق...'; });
      } catch (e) { items = []; status.textContent = e.message === 'zip64' ? 'الملف كبير جدًا. صدّر المحادثة بدون وسائط كثيرة أو اختر ملفات ‎.webp‎ مباشرة.' : 'تعذرت قراءة الملف'; busy(pickB, false); return; }
      busy(pickB, false);
      if (!items.length) { status.textContent = 'لم نجد ملصقات في هذا الملف.'; return; }
      status.textContent = 'اختر الملصقات التي تريد استيرادها (ستجد هنا ما أرسلته وما استلمته).';
      grid.textContent = ''; grid.style.display = ''; tools.style.display = ''; go.style.display = '';
      items.forEach((it) => {
        const c = el('div', 'stk-icell'), im = el('img'); im.src = it.url; im.alt = ''; c.appendChild(im);
        c.onclick = () => { it.sel = !it.sel; c.classList.toggle('sel', it.sel); upd(); };
        grid.appendChild(c);
      });
      upd();
    }
    pickB.onclick = () => pickFiles('.zip,.webp,application/zip,image/webp,image/png', true, run);
    all.onclick = () => { const on = sel().length !== items.length; items.forEach((i) => { i.sel = on; }); grid.querySelectorAll('.stk-icell').forEach((c, k) => c.classList.toggle('sel', items[k].sel)); upd(); };
    go.onclick = async () => {
      if (!C().online()) { status.textContent = 'الاستيراد يتطلب اتصالًا بالإنترنت'; return; }
      const q = sel(), res = []; let done = 0; busy(go, true); bar.style.display = '';
      const worker = async () => {
        while (q.length) {
          const it = q.shift();
          try { res.push(await registerBlob(it.blob, it)); } catch (e) { console.warn('import', e); }
          done++; fill.style.width = Math.round(done / (done + q.length) * 100) + '%'; status.textContent = 'جارٍ الاستيراد ' + done + '...';
        }
      };
      const total = q.length;
      await Promise.all([worker(), worker(), worker()]);
      if (res.length) { const up = {}; res.forEach((s) => { up['stickerLib/' + C().uid() + '/saved/' + s.h] = entry(s); }); try { await C().db().ref().update(up); } catch (e) { res.length = 0; } }
      busy(go, false); bar.style.display = 'none';
      if (res.length === total) { C().toast('تم استيراد ' + res.length + ' ملصق', null, null, false, 2500); O.close(); mode === 'stk' || setMode('stk', true); }
      else { status.textContent = 'تم استيراد ' + res.length + ' من ' + total + '. أعد المحاولة لاستيراد الباقي.'; items.forEach((i) => { i.sel = false; }); }
    };
    if (pre && pre.length) run(pre);
  }
  async function handleShared() { // files shared to the installed site (service worker keeps them in Cache Storage)
    if (!/[?&]share=1/.test(location.search)) return;
    try {
      history.replaceState(history.state, '', location.pathname);
      const c = await caches.open('fr-share'), files = [];
      for (const k of await c.keys()) {
        const r = await c.match(k), b = await r.blob();
        files.push(new File([b], decodeURIComponent(r.headers.get('X-Name') || 'f'), { type: b.type })); await c.delete(k);
      }
      if (files.length) { if (!$('emojiPanel').classList.contains('open')) $('emojiToggleBtn').click(); setMode('stk', true); openImport(files); }
    } catch (e) {}
  }

  window.FRStickers = { boot, makeEl, save: (s) => save(s), panelOpened, panelClosed };
})();
