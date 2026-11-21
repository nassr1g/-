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
    if (!e.target.isConnected) { if (e.target._fire) e.target._fire.setOn(false); io.unobserve(e.target); return; }
    e.target.classList.toggle('fx-live', e.isIntersecting); if (e.target._fire) e.target._fire.setOn(e.isIntersecting);
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
    burst(b, x, y, b.dataset.fx, 9); if (b._fe) b._fe.boost = .5;
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

  // ---------- real fire: WebGL shader (fbm turbulence + heat colour ramp) -> one connected, living flame ----------
  const Fire = (() => {
    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const HEAD = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n'
      + 'uniform vec2 uRes;uniform vec4 uBox;uniform float uT,uH,uI,uR,uF;\n'
      + 'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n'
      + 'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}\n'
      + 'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(11.7,5.3);a*=.5;}return v;}\n'
      + 'vec4 ramp(float f,float I){vec3 c=mix(vec3(.5,.04,0.),vec3(1.,.36,.03),smoothstep(0.,.35,f));c=mix(c,vec3(1.,.74,.16),smoothstep(.35,.72,f));c=mix(c,vec3(1.,.96,.78),smoothstep(.93,1.,f));float a=smoothstep(.06,.34,f)*I*.9;return vec4(c*a,a);}\n'
      + 'float turb(vec2 px){float w=fbm(vec2(px.x*.02*uF,px.y*.02*uF-uT*.6));vec2 p=vec2(px.x*.075*uF+w*1.4,px.y*.04*uF+uT*2.6);return fbm(p)*.65+fbm(p*2.1+vec2(3.,-uT*1.3))*.35;}\n';
    const FS = {
      rect: HEAD + 'void main(){vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);vec2 c=uBox.xy+uBox.zw*.5,h=uBox.zw*.5;vec2 q=abs(px-c)-h+uR;float d=length(max(q,0.))+min(max(q.x,q.y),0.)-uR;'
        + 'float up=clamp((c.y-px.y)/max(length(px-c),1.),-1.,1.)*.5+.5;float hm=mix(.04,1.,up*up*up);float t=max(d,0.)/(uH*hm);'
        + 'float f=clamp((1.-t)*.95+(turb(px)-.5)*1.9,0.,1.);if(d<0.)f*=smoothstep(-10.,0.,d);gl_FragColor=ramp(f,uI);}',
      screen: HEAD + 'void main(){vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);float t=min((uRes.y-px.y)/uH,min(px.x/(uH*.3),(uRes.x-px.x)/(uH*.3)));'
        + 'float f=clamp((1.-t)*.95+(turb(px)-.5)*1.9,0.,1.);gl_FragColor=ramp(f,uI);}'
    };
    let raf = 0, last = 0; const act = new Set();
    function glInit(cv, mode) {
      const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false }); if (!gl) return null;
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : null; };
      const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS[mode]); if (!v || !f) return null;
      const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
      gl.useProgram(pr); const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
      const u = {}; ['uRes', 'uBox', 'uT', 'uH', 'uI', 'uR', 'uF'].forEach((n) => { u[n] = gl.getUniformLocation(pr, n); });
      return { gl, u };
    }
    function loop(now) {
      raf = 0; if (!act.size) return;
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      act.forEach((e) => { if (!e.cv.isConnected) { e.setOn(false); return; } e.step(dt); });
      if (act.size) raf = requestAnimationFrame(loop);
    }
    function make(cv, o) {
      const e = { cv, o, w: 0, h: 0, t: 0, on: false, boost: 0, box: null, g: null,
        size(w, h) { e.cv.width = w; e.cv.height = h; e.w = w; e.h = h; },
        setOn(v) {
          if (v === e.on) return;
          if (v) {
            if (act.size >= 6) return; e.g = glInit(e.cv, o.mode); if (!e.g) return;
            e.on = true; e.t = Math.random() * 40; act.add(e); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
          } else {
            e.on = false; act.delete(e);
            if (e.g) { const x = e.g.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); e.g = null; const n = e.cv.cloneNode(false); e.cv.replaceWith(n); e.cv = n; }
          }
        },
        step(dt) {
          const g = e.g; if (!g) return; const gl = g.gl, u = g.u; e.t += dt; if (e.boost > 0) e.boost -= dt;
          const b = e.box || { x: 0, y: 0, w: 0, h: 0 };
          gl.viewport(0, 0, e.w, e.h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform2f(u.uRes, e.w, e.h); gl.uniform4f(u.uBox, b.x, b.y, b.w, b.h); gl.uniform1f(u.uT, e.t);
          gl.uniform1f(u.uH, o.H * (e.boost > 0 ? 1.3 : 1)); gl.uniform1f(u.uI, o.env ? o.env(e.t) : 1); gl.uniform1f(u.uR, o.R || 0); gl.uniform1f(u.uF, o.F || 1);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } };
      return e;
    }
    return { make };
  })();
  const demoFires = [], fro = 'ResizeObserver' in window ? new ResizeObserver((es) => es.forEach((x) => { if (x.target._fe) x.target._fe.resize(); })) : null;
  function attachFire(host, row, bar) {
    const cv = mk('canvas', 'fxc'); host.appendChild(cv);
    const P = bar ? { pl: 24, pt: 80, pr: 24, pb: 16, H: 48, R: 28 } : { pl: 24, pt: 56, pr: 24, pb: 14, H: 34, R: 17 };
    const e = Fire.make(cv, { mode: 'rect', H: P.H, R: P.R, F: 1 });
    e.resize = () => {
      const w = host.offsetWidth, h = host.offsetHeight; if (!w || !h) return;
      e.size(w + P.pl + P.pr, h + P.pt + P.pb); e.cv.style.cssText = 'left:' + (-P.pl) + 'px;top:' + (-P.pt) + 'px;width:' + e.w + 'px;height:' + e.h + 'px';
      e.box = { x: P.pl, y: P.pt, w, h };
    };
    const base = e.setOn; e.setOn = (v) => { if (v) e.resize(); if (v && !e.box) return; base(v); };
    host._fe = e; if (row) row._fire = e; if (fro) fro.observe(host);
    return e;
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
      const cv = mk('canvas', 'sc-cv'); el.appendChild(cv);
      const e = Fire.make(cv, { mode: 'screen', H: H * .5 * .11, F: .55, env: (t) => t < .35 ? t / .35 : t > 2.7 ? Math.max(0, (3.3 - t) / .6) : 1 });
      e.size(Math.round(W * .5), Math.round(H * .5)); el._fire = e; e.setOn(true);
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
    if (scEl) { if (scEl._fire) scEl._fire.setOn(false); scEl.remove(); clearTimeout(scT); }
    const el = mk('div', 'fx-screen sc-' + k), W = app.clientWidth, H = app.clientHeight;
    el.style.setProperty('--H', (H + 50) + 'px'); d.f(el, W, H); app.appendChild(el); scEl = el;
    scT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { if (el._fire) el._fire.setOn(false); el.remove(); if (scEl === el) scEl = null; }, 500); }, d.ms);
  }

  // ---------- hooks used by app.js ----------
  function after(row, bubble, key, data, mine) {
    index(bubble, key);
    if (bubble.querySelector('.spl')) watch(row);
    const k = data.fx; if (!k || !T[k] || data.sticker) return;
    bubble.classList.add('fx'); bubble.dataset.fx = k;
    const f = mk('div', 'fxb'); f.dataset.k = k; parts(f, PN[k]); bubble.insertBefore(f, bubble.firstChild);
    if (k === 'gift') { bubble.insertBefore(cover(), f.nextSibling); if (mine || opened.has(key)) bubble.classList.add('opened'); }
    if (k === 'fire') { attachFire(bubble, row, false); row.classList.add('fxo-row'); }
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
    if (cur === 'fire' && !outer) { outer = attachFire(glass, null, true); outer.setOn(true); }
    else if (cur !== 'fire' && outer) { const o = outer; outer = null; o.cv.style.transition = 'opacity .4s'; o.cv.style.opacity = 0; setTimeout(() => { o.setOn(false); o.cv.remove(); glass._fe = null; if (fro) fro.unobserve(glass); }, 450); }
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
    if (k === 'fire') demoFires.push(attachFire(b, null, false));
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
    FRNav.push('fx', hidePanel); demoFires.forEach((e) => e.setOn(true));
    const g = panel.querySelector('.fx-stage .msg-bubble[data-fx="gift"]');
    if (g) giftTimer = setInterval(() => { const o = g.classList.toggle('opened'); if (o) { g.classList.add('revealing'); setTimeout(() => g.classList.remove('revealing'), 700); } }, 2800);
    if (C().expand) C().expand();
  }
  function hidePanel() {
    panel.classList.remove('open'); btn.classList.remove('active'); panelOpen = false;
    clearInterval(giftTimer); giftTimer = null; demoFires.forEach((e) => e.setOn(false)); if (C().expand) C().expand();
  }
  function closePanel() { if (panelOpen) FRNav.back('fx'); }
  btn.addEventListener('click', () => { if (panelOpen) closePanel(); else openPanel(); });
  document.addEventListener('pointerdown', (e) => { if (panelOpen && !e.target.closest('.fx-panel') && !e.target.closest('#fxToggleBtn')) closePanel(); }, true);

  window.FRFx = { screen: (k) => { if (k !== 'gift') screen(k); }, after, tap, edited, clear, quote, search, outgoing, closePanel, isOpen: () => panelOpen || !!cur || splAll };
})();
