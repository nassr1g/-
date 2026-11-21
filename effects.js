/* =========================================================
   effects.js — message templates (fx) + spoiler.
   Storage: message.fx = template id; spoiler = ||text|| inside message.text.
   Talks to app.js through window.FRFx (hooks) and window.FRChat.
   Performance: CSS-only ambient animation, paused when the row is off-screen
   (IntersectionObserver); tap bursts are a few short-lived DOM spans.
   ========================================================= */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const C = () => window.FRChat || {};
  const SPL = '\\|\\|(?=\\S)([\\s\\S]*?\\S)\\|\\|';
  const T = { fire: { n: 'ناري', e: '🔥' }, gift: { n: 'هدية', e: '🎁' }, ice: { n: 'ثلجي', e: '❄️' }, love: { n: 'قلوب', e: '💖' }, galaxy: { n: 'مجرة', e: '🌌' }, sakura: { n: 'ساكورا', e: '🌸' }, thunder: { n: 'صاعقة', e: '⚡' }, gold: { n: 'ذهبي', e: '✨' } };
  const PN = { fire: 7, ice: 9, love: 6, galaxy: 10, sakura: 6, thunder: 6, gold: 8, gift: 7 };
  const B = {
    fire: { g: ['●', '✹'], c: ['#ffb347', '#ff6a00', '#ffe08a'] },
    ice: { g: ['❄', '✦', '❅'], c: ['#fff', '#bfeaff', '#8fd0f5'] },
    love: { g: ['♥'], c: ['#ff7eb6', '#ff4d8d', '#ffc2dc'] },
    galaxy: { g: ['✦', '✧', '⋆'], c: ['#fff', '#c9a6ec', '#5ff1e0'] },
    sakura: { g: ['❀', '✿'], c: ['#ffb3d1', '#ff8fbf', '#fff'] },
    thunder: { g: ['⚡', '✦'], c: ['#fff36b', '#9fd8ff', '#fff'] },
    gold: { g: ['✦', '✧'], c: ['#ffe27a', '#ffc233', '#fff'] },
    gift: { g: ['▮', '●', '★', '▬'], c: ['#ff4d6d', '#ffd166', '#5ff1e0', '#c9a6ec', '#fff'] },
    spl: { g: ['✦', '✧'], c: ['#fff', '#5ff1e0', '#ef6fc9'] }
  };
  const X = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>';
  const GIFT = '<svg viewBox="0 0 64 64" aria-hidden="true"><g class="gb"><rect x="10" y="28" width="44" height="28" rx="5" fill="#ff4d6d"/><rect x="29" y="28" width="6" height="28" fill="#ffd166"/></g><g class="gl"><rect x="6" y="19" width="52" height="11" rx="4" fill="#ff7a93"/><rect x="29" y="19" width="6" height="11" fill="#ffe08a"/><path d="M32 19c-6-9-15-7-12-1 2 4 12 1 12 1zM32 19c6-9 15-7 12-1-2 4-12 1-12 1z" fill="#ffd166"/></g></svg>';

  // ---------- local "opened" state (gifts / revealed spoilers), survives reload ----------
  const LS = 'fr_fx_open_v1'; let opened;
  try { opened = new Set(JSON.parse(localStorage.getItem(LS) || '[]')); } catch (e) { opened = new Set(); }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify([...opened].slice(-800))); } catch (e) {} };

  // ---------- shared helpers ----------
  const mask = (t) => String(t || '').replace(new RegExp(SPL, 'g'), '••••');
  function parts(el, n) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.cssText = '--x:' + (Math.random() * 100).toFixed(0) + '%;--y:' + (Math.random() * 85).toFixed(0) + '%;--s:' + rnd(6, 13).toFixed(1) + 'px;--d:-' + rnd(0, 4).toFixed(2) + 's;--t:' + rnd(2.2, 4.8).toFixed(2) + 's;--h:' + (36 + Math.random() * 50 | 0) + 'px';
      el.appendChild(p);
    }
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.target.isConnected) { io.unobserve(e.target); return; }
    e.target.classList.toggle('fx-live', e.isIntersecting);
  })) : null;
  function watch(row) {
    if (!row || row._fxw) return; row._fxw = 1; row.classList.add('fxwatch');
    if (io) io.observe(row); else row.classList.add('fx-live');
  }
  function index(el, key) {
    el.querySelectorAll('.spl').forEach((s, i) => { s.dataset.i = i; if (key && opened.has(key + ':' + i)) s.classList.add('open'); });
  }
  function burst(anchor, x, y, kind, n) {
    const host = anchor.closest('.msg-row'); if (!host || host.querySelectorAll('.fx-burst').length > 3) return;
    const r = host.getBoundingClientRect(), w = mk('div', 'fx-burst'), K = B[kind] || B.gold;
    w.style.left = (x - r.left) + 'px'; w.style.top = (y - r.top) + 'px';
    for (let i = 0; i < n; i++) {
      const s = mk('span', null, K.g[Math.random() * K.g.length | 0]);
      s.style.color = K.c[Math.random() * K.c.length | 0];
      s.style.setProperty('--dx', ((Math.random() - 0.5) * 120) + 'px');
      s.style.setProperty('--dy', (-(40 + Math.random() * 80)) + 'px');
      s.style.setProperty('--rot', ((Math.random() - 0.5) * 140) + 'deg');
      s.style.fontSize = rnd(11, 22).toFixed(0) + 'px'; s.style.animationDelay = (i * 28) + 'ms';
      w.appendChild(s);
    }
    host.appendChild(w); setTimeout(() => w.remove(), 1500);
  }
  function hit(b, x, y) {
    burst(b, x, y, b.dataset.fx, 9);
    b.classList.remove('fx-hit'); void b.offsetWidth; b.classList.add('fx-hit');
    clearTimeout(b._ht); b._ht = setTimeout(() => b.classList.remove('fx-hit'), 650);
  }
  function cover() { const c = mk('div', 'gift-cover'); c.innerHTML = GIFT; return c; }

  function openGift(b, key) {
    if (b.classList.contains('opened') || b._og) return;
    b._og = 1; opened.add(key); save();
    const c = b.querySelector('.gift-cover');
    if (!c) { b.classList.add('opened'); return; }
    c.classList.add('opening'); if (navigator.vibrate) navigator.vibrate([18, 40, 26]);
    setTimeout(() => {
      const w0 = b.offsetWidth, h0 = b.offsetHeight;
      b.classList.add('opened', 'revealing', 'flash'); screen('gift');
      const w1 = b.offsetWidth, h1 = b.offsetHeight;
      b.style.overflow = 'hidden'; b.style.width = w0 + 'px'; b.style.height = h0 + 'px'; void b.offsetWidth;
      b.style.transition = 'width .5s cubic-bezier(.2,.8,.3,1), height .5s cubic-bezier(.2,.8,.3,1)';
      b.style.width = w1 + 'px'; b.style.height = h1 + 'px';
      const r = b.getBoundingClientRect(); burst(b, r.left + r.width / 2, r.top + r.height / 2, 'gift', 16);
      setTimeout(() => { b.style.width = b.style.height = b.style.overflow = b.style.transition = ''; b._og = 0; }, 540);
      setTimeout(() => b.classList.remove('revealing', 'flash'), 800);
    }, 560);
  }


  // ---------- real flames (outside the frame) ----------
  function flames(el, n, a, b, sp) {
    for (let i = 0; i < n; i++) {
      const f = document.createElement('i'), x = (i + 0.5) / n * 100 + rnd(-3, 3);
      f.style.cssText = '--x:' + x.toFixed(1) + '%;--w:' + rnd(a, b).toFixed(0) + 'px;--t:' + rnd(.35, .7).toFixed(2) + 's;--d:-' + rnd(0, .7).toFixed(2) + 's';
      el.appendChild(f);
    }
    for (let i = 0; i < sp; i++) {
      const s = document.createElement('b');
      s.style.cssText = '--x:' + rnd(5, 95).toFixed(0) + '%;--dx:' + rnd(-16, 16).toFixed(0) + 'px;--t:' + rnd(1, 2).toFixed(2) + 's;--d:-' + rnd(0, 2).toFixed(2) + 's';
      el.appendChild(s);
    }
  }

  // ---------- real flames: curved tongues that burn out of the edges ----------
  const FO = 'M45 124C18 124 6 104 10 82C13 66 24 58 26 42C27 34 24 24 30 14C32 24 40 28 42 18C43 12 41 6 46 0C48 14 58 22 66 36C74 48 84 62 82 84C80 108 66 124 45 124Z';
  const FI = 'M45 122C30 122 24 108 28 94C31 84 38 80 40 68C46 76 54 82 58 94C62 108 56 122 45 122Z';
  let defsOk = false;
  function ensureDefs() {
    if (defsOk) return; defsOk = true;
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0"><defs><linearGradient id="fxgA" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4d00"/><stop offset=".5" stop-color="#ff9a1a"/><stop offset="1" stop-color="#ffd45e"/></linearGradient>'
      + '<linearGradient id="fxgB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffc23d"/><stop offset="1" stop-color="#fff3c4"/></linearGradient>'
      + '<linearGradient id="fxgR" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#c81e00"/><stop offset="1" stop-color="#ff6a12"/></linearGradient>'
      + '<symbol id="fxF" viewBox="0 0 90 124"><path d="' + FO + '" fill="url(#fxgA)"/><path d="' + FI + '" fill="url(#fxgB)"/></symbol>'
      + '<symbol id="fxR" viewBox="0 0 90 124"><path d="' + FO + '" fill="url(#fxgR)"/></symbol></defs></svg>';
    document.body.appendChild(d);
  }
  function fl(parent, x, y, h, r) {
    const e = document.createElement('span'); e.className = 'fl';
    e.innerHTML = '<svg viewBox="0 0 90 124" class="bk"><use href="#fxR"/></svg><svg viewBox="0 0 90 124"><use href="#fxF"/></svg>';
    e.style.cssText = '--x:' + x + ';--y:' + y + ';--h:' + h.toFixed(0) + 'px;--w:' + (h * .73).toFixed(0) + 'px;--r:' + r + 'deg;--t:' + rnd(.45, .9).toFixed(2) + 's;--d:-' + rnd(0, .9).toFixed(2) + 's';
    parent.appendChild(e);
  }
  const BUB = [[8, 34, -10], [19, 24, 6], [47, 26, -2], [76, 40, -4], [90, 56, 6], [97, 28, 16]];
  const BAR = [[4, 40, -8], [12, 26, 5], [22, 20, -3], [34, 24, 2], [47, 34, -3], [53, 48, 4], [62, 26, -5], [74, 30, 3], [86, 38, -4], [94, 54, 5], [99, 28, 12]];
  function burn(o, bar) {
    ensureDefs();
    (bar ? BAR : BUB).forEach((a) => fl(o, a[0] + '%', '5px', a[1], a[2]));
    if (bar) { fl(o, '4px', '45%', 34, -80); fl(o, 'calc(100% - 4px)', '45%', 34, 80); }
    else { fl(o, '3px', '42%', 30, -78); fl(o, 'calc(100% - 3px)', '36%', 26, 80); }
    flames(o, 0, 0, 0, bar ? 8 : 5);
  }

  // ---------- full-screen effects (sender + live receiver) ----------
  const NS = 'http://www.w3.org/2000/svg'; let scEl = null, scT = null;
  function rain(el, n, fn) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.cssText = '--x:' + rnd(0, 100).toFixed(1) + '%;--dx:' + rnd(-60, 60).toFixed(0) + 'px;--t:' + rnd(1.6, 3).toFixed(2) + 's;--d:' + rnd(0, 1).toFixed(2) + 's;--s:' + rnd(4, 10).toFixed(1) + 'px';
      if (fn) fn(p, i); el.appendChild(p);
    }
  }
  const zig = (x, len, dr) => { const p = [[x, 0]]; let y = 0; while (y < len) { y += rnd(len * .07, len * .14); x += rnd(-dr, dr); p.push([x, y]); } return p; };
  function bolt(g, pts) {
    const d = 'M' + pts.map((q) => q[0].toFixed(0) + ' ' + q[1].toFixed(0)).join('L');
    ['b1', 'b2', 'b3'].forEach((c) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', c); g.appendChild(p); });
  }
  const SC = {
    fire: { ms: 3400, f(el, W, H) {
      const m = (cls, w) => { const o = mk('div', 'fxo2 ' + cls), g = mk('div', 'fg'); if (w) o.style.width = w + 'px'; o.appendChild(g); el.appendChild(o); return g; };
      ensureDefs(); const b = m('', 0), l = m('sl', H), r = m('sr', H);
      for (let i = 0; i < 14; i++) fl(b, ((i + .5) / 14 * 100 + rnd(-3, 3)).toFixed(1) + '%', '0px', rnd(120, 230), rnd(-6, 6));
      [l, r].forEach((g) => { for (let i = 0; i < 8; i++) fl(g, ((i + .5) / 8 * 100 + rnd(-3, 3)).toFixed(1) + '%', '0px', rnd(60, 110), rnd(-8, 8)); });
      flames(b, 0, 0, 0, 16);
    } },
    thunder: { ms: 1900, f(el, W, H) {
      el.appendChild(mk('div', 'sc-dark')); el.appendChild(mk('div', 'sc-flash'));
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      [[rnd(.12, .4) * W, 0], [rnd(.6, .88) * W, .5]].forEach(([x0, d]) => {
        const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'bolt'); g.style.animationDelay = d + 's';
        const pts = zig(x0, H * rnd(.5, .72), W * .07); bolt(g, pts);
        const m = pts[Math.floor(pts.length / 2)], br = zig(m[0], H * .22, W * .06).map((q) => [q[0] + (Math.random() < .5 ? 1 : -1) * q[1] * .5, q[1] + m[1]]); bolt(g, br);
        svg.appendChild(g);
      });
      el.appendChild(svg);
    } },
    ice: { ms: 4200, f(el) { rain(el, 46, (p, i) => { if (i % 6 === 0) { p.className = 'g'; p.style.setProperty('--s', rnd(12, 20).toFixed(0) + 'px'); } }); } },
    love: { ms: 3800, f(el) { rain(el, 26, (p, i) => { p.style.setProperty('--s', rnd(14, 30).toFixed(0) + 'px'); p.style.setProperty('--c', ['#ff7eb6', '#ff4d8d', '#ffc2dc', '#ef6fc9'][i % 4]); }); } },
    galaxy: { ms: 3300, f(el, W) {
      el.style.setProperty('--mx', (W * .7) + 'px'); el.style.setProperty('--my', (W * .37) + 'px');
      for (let i = 0; i < 8; i++) { const b = document.createElement('b'); b.style.cssText = '--x:' + rnd(-10, 60).toFixed(0) + '%;--y:' + rnd(0, 55).toFixed(0) + '%;--l:' + rnd(90, 170).toFixed(0) + 'px;--d:' + (i * .28 + rnd(0, .2)).toFixed(2) + 's'; el.appendChild(b); }
      for (let i = 0; i < 18; i++) { const s = document.createElement('i'); s.style.cssText = '--x:' + rnd(0, 100).toFixed(0) + '%;--y:' + rnd(0, 100).toFixed(0) + '%;--d:' + rnd(0, 1.6).toFixed(2) + 's'; el.appendChild(s); }
    } },
    sakura: { ms: 4600, f(el) { rain(el, 28, (p) => { p.style.setProperty('--s', rnd(10, 18).toFixed(0) + 'px'); p.style.setProperty('--t', rnd(2.2, 3.6).toFixed(2) + 's'); }); } },
    gold: { ms: 3600, f(el) { rain(el, 34, (p, i) => { p.style.setProperty('--s', rnd(8, 16).toFixed(0) + 'px'); if (i % 3 === 0) p.className = 'g'; }); } },
    gift: { ms: 3600, f(el) { rain(el, 44, (p, i) => { p.style.setProperty('--c', ['#ff4d6d', '#ffd166', '#5ff1e0', '#c9a6ec', '#fff', '#ff8a3d'][i % 6]); p.style.setProperty('--s', rnd(7, 13).toFixed(0) + 'px'); }); } }
  };
  function screen(k) {
    const d = SC[k]; if (!d || document.visibilityState !== 'visible' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const app = document.querySelector('.app'); if (!app) return;
    if (scEl) { scEl.remove(); clearTimeout(scT); }
    const el = mk('div', 'fx-screen sc-' + k), W = app.clientWidth, H = app.clientHeight;
    el.style.setProperty('--H', (H + 50) + 'px'); d.f(el, W, H); app.appendChild(el); scEl = el;
    scT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); if (scEl === el) scEl = null; }, 500); }, d.ms);
  }

  // ---------- hooks used by app.js ----------
  function after(row, bubble, key, data, mine) {
    index(bubble, key);
    if (bubble.querySelector('.spl')) watch(row);
    const k = data.fx; if (!k || !T[k] || data.sticker) return;
    bubble.classList.add('fx'); bubble.dataset.fx = k;
    const f = mk('div', 'fxb'); f.dataset.k = k; parts(f, PN[k]); bubble.insertBefore(f, bubble.firstChild);
    if (k === 'gift') { bubble.insertBefore(cover(), f.nextSibling); if (mine || opened.has(key)) bubble.classList.add('opened'); }
    if (k === 'fire') { const o = mk('div', 'fxo'); burn(o, false); bubble.appendChild(o); row.classList.add('fxo-row'); }
    watch(row);
  }
  function tap(e, key) {
    const t = e.target; if (!t.closest) return false;
    const s = t.closest('.spl');
    if (s) {
      if (s.classList.contains('open')) return false;
      s.classList.add('open'); opened.add(key + ':' + s.dataset.i); save();
      const r = s.getBoundingClientRect(); burst(s, r.left + r.width / 2, r.top + r.height / 2, 'spl', 7);
      if (navigator.vibrate) navigator.vibrate(10);
      return true;
    }
    const b = t.closest('.msg-bubble.fx');
    if (!b || t.closest('.reply-quote,.reaction-chip,a,.mention,.code-block')) return false;
    if (b.dataset.fx === 'gift' && !b.classList.contains('opened')) { openGift(b, key); return true; }
    const now = Date.now(); if (now - (b._ft || 0) < 280) return false; b._ft = now;
    hit(b, e.clientX, e.clientY); return false;
  }
  function edited(textEl, key) { opened.forEach((v) => { if (v.indexOf(key + ':') === 0) opened.delete(v); }); index(textEl, key); watch(textEl.closest('.msg-row')); }
  function clear(b) {
    b.classList.remove('fx', 'opened', 'opening', 'fx-hit', 'revealing', 'flash'); delete b.dataset.fx;
    const r = b.closest('.msg-row'); if (r) r.classList.remove('fxwatch', 'fx-live', 'fxo-row');
  }
  const quote = (d) => d.fx === 'gift' ? 'رسالة في قالب هدية 🎁' : mask(d.text);
  const search = (m) => (m.fx === 'gift' && !opened.has(m.k) && m.senderUid !== (C().uid && C().uid())) ? 'رسالة في قالب هدية' : mask(m.text);

  // ---------- composer: state + panel ----------
  const glass = document.querySelector('.composer-glass'), input = $('messageInput'), btn = $('fxToggleBtn'), panel = $('fxPanel'), chipsEl = $('fxChips');
  const ph0 = input ? input.placeholder : '';
  let outer = null, cur = '', splAll = false, panelOpen = false, built = false, layer = null, giftTimer = null, tiles = {};

  function applyComposer() {
    if (cur === 'fire' && !outer) { outer = mk('div', 'fxo fxo-c'); burn(outer, true); glass.appendChild(outer); }
    else if (cur !== 'fire' && outer) { const o = outer; outer = null; o.classList.add('out'); setTimeout(() => o.remove(), 450); }
    if (cur) {
      glass.dataset.fx = cur;
      if (!layer || layer.dataset.k !== cur) {
        if (layer) layer.remove();
        layer = mk('div', 'fx-layer'); layer.dataset.k = cur; parts(layer, Math.round(PN[cur] * 1.7));
        glass.insertBefore(layer, glass.firstChild);
        glass.classList.remove('fx-in'); void glass.offsetWidth; glass.classList.add('fx-in');
        setTimeout(() => glass.classList.remove('fx-in'), 700);
      }
    } else {
      delete glass.dataset.fx;
      if (layer) { const l = layer; layer = null; l.classList.add('out'); setTimeout(() => l.remove(), 450); }
    }
    glass.dataset.spl = splAll ? '1' : '';
    input.placeholder = splAll ? 'رسالة مخفية…' : ph0;
    btn.classList.toggle('has', !!(cur || splAll));
    Object.keys(tiles).forEach((k) => tiles[k].classList.toggle('on', k === cur));
    if (built) { $('fxSplAll').classList.toggle('on', splAll); }
    drawChips();
    if (C().expand) C().expand();
  }
  function drawChips() {
    chipsEl.textContent = '';
    const add = (cls, label, off) => {
      const d = mk('div', 'fx-chip ' + cls); if (cls === 't') d.dataset.fx = cur;
      d.appendChild(mk('span', 'fc-dot')); d.appendChild(mk('b', null, label));
      const x = mk('button'); x.type = 'button'; x.innerHTML = X; x.setAttribute('aria-label', 'إزالة'); x.onclick = off; d.appendChild(x); chipsEl.appendChild(d);
    };
    if (cur) add('t', 'قالب ' + T[cur].n + ' ' + T[cur].e, () => pick(''));
    if (splAll) add('s', 'رسالة مخفية', () => setSpl(false));
    chipsEl.classList.toggle('has', !!chipsEl.firstChild);
  }
  function focusInput() { setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) {} }, 80); }
  function pick(k) {
    if (k && k === cur) k = '';
    cur = k; applyComposer();
    if (navigator.vibrate) navigator.vibrate(k ? 14 : 8);
    if (k) { closePanel(); focusInput(); }
  }
  function setSpl(v) { splAll = v; applyComposer(); if (v) { closePanel(); focusInput(); } }
  function wrapSel() {
    const v = input.value; let a = input.selectionStart, b = input.selectionEnd;
    const warn = () => C().toast && C().toast('حدّد جزءًا من النص أولًا ثم اضغط', null, null, true, 2400);
    if (a == null || a === b) return warn();
    const s = v.slice(a, b); a += s.length - s.trimStart().length; b -= s.length - s.trimEnd().length;
    if (b <= a) return warn();
    input.value = v.slice(0, a) + '||' + v.slice(a, b) + '||' + v.slice(b);
    const p = b + 4; closePanel(); input.dispatchEvent(new Event('input'));
    setTimeout(() => { try { input.focus({ preventScroll: true }); input.setSelectionRange(p, p); } catch (e) {} }, 90);
  }
  function outgoing(text) {
    let t = text;
    if (splAll && !new RegExp('^' + SPL + '$').test(t)) t = '||' + (t.length > 996 ? t.slice(0, 996) : t) + '||';
    const fx = cur; cur = ''; splAll = false; applyComposer();
    return { text: t, fx };
  }

  function demo(k) {
    const b = mk('div', 'msg-bubble fx'); b.dataset.fx = k;
    const f = mk('div', 'fxb'); f.dataset.k = k; parts(f, PN[k]); b.appendChild(f);
    if (k === 'gift') b.appendChild(cover());
    if (k === 'fire') { const o = mk('div', 'fxo'); burn(o, false); b.appendChild(o); }
    b.appendChild(mk('div', 'msg-text', 'مرحبًا بك'));
    return b;
  }
  function build() {
    built = true;
    panel.innerHTML = '<div class="panel-switch" id="fxSwitch" data-m="tpl"><i class="ps-ink"></i><button data-m="tpl" class="active">القوالب</button><button data-m="spl">تأثيرات الرسالة</button></div>'
      + '<div class="fx-view fx-v-tpl"><div class="fx-scroll"><div class="fx-hint">اختر قالبًا ثم اكتب رسالتك، ويعود الشريط لطبيعته بعد الإرسال. اضغط القالب مرة أخرى لإلغائه.</div><div class="fx-grid" id="fxGrid"></div></div></div>'
      + '<div class="fx-view fx-v-spl"><div class="fx-scroll">'
      + '<div class="fx-card"><b>إخفاء النص (Spoiler)</b><p>جرّب بنفسك: <span class="spl" id="fxDemoSpl">اضغط لتكشف السر</span></p></div>'
      + '<button class="notif-toggle" id="fxSplAll"><span class="opt-txt"><b>إخفاء الرسالة كاملة</b><small>تُرسَل مخفية ولا تنكشف إلا بالضغط عليها</small></span><span class="switch"></span></button>'
      + '<button class="notif-toggle" id="fxSplSel" style="margin-top:8px"><span class="opt-txt"><b>إخفاء الجزء المحدد</b><small>حدّد كلمات داخل رسالتك ثم اضغط هنا</small></span><span class="srch-ic"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9h16M4 15h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/><circle cx="19" cy="15" r="1.3" fill="currentColor"/></svg></span></button>'
      + '<div class="fx-tip">اختصار سريع: اكتب النص بين خطين عموديين مثل <code>||سر||</code> وسيُخفى فور إرساله.</div></div></div>';
    const grid = $('fxGrid');
    Object.keys(T).forEach((k) => {
      const tl = mk('div', 'fx-tile'); tl.dataset.fx = k;
      const st = mk('div', 'fx-stage'); st.appendChild(demo(k)); tl.appendChild(st); tl.appendChild(mk('b', null, T[k].n + ' ' + T[k].e));
      tl.addEventListener('click', () => pick(k)); grid.appendChild(tl); tiles[k] = tl;
    });
    const sw = $('fxSwitch');
    sw.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sw.dataset.m = b.dataset.m; panel.classList.toggle('m-spl', b.dataset.m === 'spl'); sw.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); });
    $('fxSplAll').addEventListener('click', () => setSpl(!splAll));
    $('fxSplSel').addEventListener('click', wrapSel);
    $('fxDemoSpl').addEventListener('click', (e) => e.currentTarget.classList.toggle('open'));
    applyComposer();
  }
  function openPanel() {
    if (panelOpen) return;
    if (C().closeEmoji) C().closeEmoji();
    if (!built) build();
    $('fxSplSel').classList.toggle('dim', input.selectionStart === input.selectionEnd);
    panel.classList.add('open'); btn.classList.add('active'); panelOpen = true;
    if (document.activeElement === input) input.blur();
    FRNav.push('fx', hidePanel);
    const g = panel.querySelector('.fx-stage .msg-bubble[data-fx="gift"]');
    if (g) giftTimer = setInterval(() => { const o = g.classList.toggle('opened'); if (o) { g.classList.add('revealing'); setTimeout(() => g.classList.remove('revealing'), 700); } }, 2800);
    if (C().expand) C().expand();
  }
  function hidePanel() {
    panel.classList.remove('open'); btn.classList.remove('active'); panelOpen = false;
    clearInterval(giftTimer); giftTimer = null; if (C().expand) C().expand();
  }
  function closePanel() { if (panelOpen) FRNav.back('fx'); }
  btn.addEventListener('click', () => { if (panelOpen) closePanel(); else openPanel(); });
  document.addEventListener('pointerdown', (e) => { if (panelOpen && !e.target.closest('.fx-panel') && !e.target.closest('#fxToggleBtn')) closePanel(); }, true);

  window.FRFx = { screen: (k) => { if (k !== 'gift') screen(k); }, after, tap, edited, clear, quote, search, outgoing, closePanel, isOpen: () => panelOpen || !!cur || splAll };
})();
