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
  function cover() { const c = mk('div', 'gift-cover'); c.innerHTML = GIFT + '<span>اضغط لفتح الهدية</span>'; return c; }

  function openGift(b, key) {
    if (b.classList.contains('opened') || b._og) return;
    b._og = 1; opened.add(key); save();
    const c = b.querySelector('.gift-cover');
    if (!c) { b.classList.add('opened'); return; }
    c.classList.add('opening'); if (navigator.vibrate) navigator.vibrate([18, 40, 26]);
    setTimeout(() => {
      const w0 = b.offsetWidth, h0 = b.offsetHeight;
      b.classList.add('opened', 'revealing', 'flash');
      const w1 = b.offsetWidth, h1 = b.offsetHeight;
      b.style.overflow = 'hidden'; b.style.width = w0 + 'px'; b.style.height = h0 + 'px'; void b.offsetWidth;
      b.style.transition = 'width .5s cubic-bezier(.2,.8,.3,1), height .5s cubic-bezier(.2,.8,.3,1)';
      b.style.width = w1 + 'px'; b.style.height = h1 + 'px';
      const r = b.getBoundingClientRect(); burst(b, r.left + r.width / 2, r.top + r.height / 2, 'gift', 16);
      setTimeout(() => { b.style.width = b.style.height = b.style.overflow = b.style.transition = ''; b._og = 0; }, 540);
      setTimeout(() => b.classList.remove('revealing', 'flash'), 800);
    }, 560);
  }

  // ---------- hooks used by app.js ----------
  function after(row, bubble, key, data, mine) {
    index(bubble, key);
    if (bubble.querySelector('.spl')) watch(row);
    const k = data.fx; if (!k || !T[k] || data.sticker) return;
    bubble.classList.add('fx'); bubble.dataset.fx = k;
    const f = mk('div', 'fxb'); f.dataset.k = k; parts(f, PN[k]); bubble.insertBefore(f, bubble.firstChild);
    if (k === 'gift') { bubble.insertBefore(cover(), f.nextSibling); if (mine || opened.has(key)) bubble.classList.add('opened'); }
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
    const r = b.closest('.msg-row'); if (r) r.classList.remove('fxwatch', 'fx-live');
  }
  const quote = (d) => d.fx === 'gift' ? 'رسالة في قالب هدية 🎁' : mask(d.text);
  const search = (m) => (m.fx === 'gift' && !opened.has(m.k) && m.senderUid !== (C().uid && C().uid())) ? 'رسالة في قالب هدية' : mask(m.text);

  // ---------- composer: state + panel ----------
  const glass = document.querySelector('.composer-glass'), input = $('messageInput'), btn = $('fxToggleBtn'), panel = $('fxPanel'), chipsEl = $('fxChips');
  const ph0 = input ? input.placeholder : '';
  let cur = '', splAll = false, panelOpen = false, built = false, layer = null, giftTimer = null, tiles = {};

  function applyComposer() {
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

  window.FRFx = { after, tap, edited, clear, quote, search, outgoing, closePanel, isOpen: () => panelOpen || !!cur || splAll };
})();
