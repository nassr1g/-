/* custom-theme.js — user-made themes: colour roles -> full palette (CSS variables), editor UI, list, sharing card.
   Loaded in <head> (core must run before first paint); the UI part starts on DOMContentLoaded. */
(function (G) {
  'use strict';
  const ORIG = [["--p-48-25-79", 48, 25, 79], ["--p-29-18-48", 29, 18, 48], ["--p-155-89-182", 155, 89, 182], ["--p-15-8-24", 15, 8, 24], ["--p-37-22-64", 37, 22, 64], ["--p-10-5-15", 10, 5, 15], ["--p-10-5-18", 10, 5, 18], ["--p-91-58-153", 91, 58, 153], ["--p-8-2-18", 8, 2, 18], ["--p-64-40-104", 64, 40, 104], ["--p-22-11-40", 22, 11, 40], ["--p-6-0-18", 6, 0, 18], ["--p-123-79-201", 123, 79, 201], ["--p-72-46-116", 72, 46, 116], ["--p-24-12-44", 24, 12, 44], ["--p-139-92-214", 139, 92, 214], ["--p-190-150-255", 190, 150, 255], ["--p-40-10-90", 40, 10, 90], ["--p-20-12-34", 20, 12, 34], ["--p-28-16-48", 28, 16, 48], ["--p-60-32-100", 60, 32, 100], ["--p-24-12-42", 24, 12, 42], ["--p-10-5-22", 10, 5, 22], ["--p-40-24-66", 40, 24, 66], ["--p-20-10-36", 20, 10, 36], ["--p-11-6-19", 11, 6, 19], ["--p-4-0-14", 4, 0, 14], ["--p-24-14-40", 24, 14, 40], ["--p-13-7-22", 13, 7, 22], ["--p-8-3-15", 8, 3, 15], ["--p-48-28-80", 48, 28, 80], ["--p-36-20-60", 36, 20, 60], ["--p-8-4-16", 8, 4, 16], ["--h-0f0818", 15, 8, 24], ["--h-160d24", 22, 13, 36], ["--h-1d1230", 29, 18, 48], ["--h-251640", 37, 22, 64], ["--h-30194f", 48, 25, 79], ["--h-9b59b6", 155, 89, 182], ["--h-7b4fc9", 123, 79, 201], ["--h-5b3a99", 91, 58, 153], ["--h-c9a6ec", 201, 166, 236], ["--h-c3b4dd", 195, 180, 221], ["--h-8b7aa8", 139, 122, 168], ["--h-8a4fc0", 138, 79, 192], ["--h-6b3fa8", 107, 63, 168], ["--h-4f2f85", 79, 47, 133], ["--h-cf9cf5", 207, 156, 245], ["--h-9b59d4", 155, 89, 212], ["--h-6a3fb0", 106, 63, 176], ["--h-4b2d8a", 75, 45, 138], ["--h-ece5f9", 236, 229, 249], ["--h-120726", 18, 7, 38]], DER = [["--bg-1", "var(--h-0f0818)"], ["--bg-2", "var(--h-160d24)"], ["--bg-3", "var(--h-1d1230)"], ["--bg-4", "var(--h-251640)"], ["--bg-5", "var(--h-30194f)"], ["--accent-1", "var(--h-9b59b6)"], ["--accent-2", "var(--h-7b4fc9)"], ["--accent-3", "var(--h-5b3a99)"], ["--accent-light", "var(--h-c9a6ec)"], ["--text-2", "var(--h-c3b4dd)"], ["--text-3", "var(--h-8b7aa8)"], ["--bubble-received", "linear-gradient(135deg, rgba(var(--p-48-25-79), 0.92) 0%, rgba(var(--p-29-18-48), 0.92) 100%)"], ["--bubble-sent", "linear-gradient(135deg, var(--h-8a4fc0) 0%, var(--h-6b3fa8) 60%, var(--h-4f2f85) 100%)"], ["--shadow-glow", "0 0 30px rgba(var(--p-155-89-182), 0.3)"]];
  const EXTRA = ['--neon-cyan', '--neon-pink', '--nc', '--np', '--dust-mine', '--dust-theirs', '--c-ga'];
  const MINE = [[138, 79, 192], [107, 63, 168], [79, 47, 133], [170, 120, 225], [243, 238, 252]], THEIRS = [[48, 25, 79], [29, 18, 48], [80, 50, 130], [155, 89, 182], [243, 238, 252]];
  const SHARE = 'FRTHEME1:', MAXC = 12;
  const ROLES = ['الخلفية والشفافية', 'الأسطح والفقاعات', 'اللون الأساسي', 'اللون الفاتح', 'النص', 'توهج ١', 'توهج ٢', 'خلفية متحركة ١', 'خلفية متحركة ٢', 'خلفية متحركة ٣'];
  const PRE = {
    default: { n: 'أرجواني', c: ['0f0818', '30194f', '8a4fc0', 'c9a6ec', 'f3eefc', '5ff1e0', 'ef6fc9', '6b30ac', '3c186e', '823abe'], d: 0 },
    galaxy: { n: 'أزرق', c: ['040a1a', '0e204e', '3b82d6', 'a6c9ec', 'eef5ff', '62e6ff', 'a98bff', '1c54d6', '102c8c', '2896ff'], d: 1 },
    brown: { n: 'بني', c: ['0f0a06', '3b2a1c', 'a8693a', 'e0c2a2', 'f6efe8', 'ffcf8f', 'ff8f6b', '78421e', '462612', '965a2d'], d: 0 },
    green: { n: 'أخضر', c: ['050f0a', '123824', '2f9e66', 'a5e0c0', 'eef8f2', '7dffc4', 'd4ff7a', '147846', '0a462d', '28a05f'], d: 0 },
    pink: { n: 'زهري', c: ['14060f', '4a1c3a', 'c24a8c', 'f0b0d6', 'fdeef7', 'ffe0f4', 'ff6fb3', 'be3278', '6e1c50', 'e65aa0'], d: 0 },
    orange: { n: 'برتقالي', c: ['130a04', '4a2810', 'd6701a', 'ffc895', 'fff3e6', 'ffe08a', 'ff7a59', 'c85f14', '78370c', 'f58c28'], d: 0 },
    night: { n: 'أرجواني ليلي', c: ['030106', '1a0a30', '7a2fd0', 'c79bff', 'f1e8ff', 'c79bff', 'ff5fd2', '300e5a', '160634', '50167d'], d: 0 }
  };
  const SWATCH = ['F72727', 'FF6B6B', 'FF9F43', 'FFD93D', 'C8FF3D', '6BCB77', '2ECC71', '1ABC9C', '5FF1E0', '4DD0FF', '3B82F6', '1C54D6', '6C5CE7', '9B59B6', 'C79BFF', 'EF6FC9', 'FF5FD2', 'FF2D87', '8B5E3C', 'D2A679', 'FFFFFF', 'CFCFD6', '6B6B7A', '000000'];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const root = document.documentElement;
  const h2 = (n) => ('0' + Math.round(n).toString(16)).slice(-2);
  const hex6 = (c) => '#' + h2(c[0]) + h2(c[1]) + h2(c[2]);
  const hex8 = (c) => h2(c[0]) + h2(c[1]) + h2(c[2]) + h2(clamp(c[3], 0, 1) * 255);
  function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; } return [h, mx ? d / mx : 0, mx]; }
  function hsv2rgb(h, s, v) { const f6 = h * 6, i = Math.floor(f6) % 6, f = f6 - Math.floor(f6), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map((x) => Math.round(x * 255)); }
  function parseHex(s) { s = String(s || '').trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(s)) s = s.replace(/./g, '$&$&'); if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return null; const n = (i) => parseInt(s.substr(i, 2), 16); return [n(0), n(2), n(4), s.length === 8 ? n(6) / 255 : undefined]; }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const lum = (c) => { const f = (x) => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

  function fromPreset(k) { const p = PRE[k] || PRE.default; return { roles: p.c.map((x, i) => { const c = parseHex(x); c[3] = i === 0 ? .5 : 1; return c; }), sat: 100, dust: !!p.d }; }
  function parse(v) {
    const p = String(v || '').split('|'), r = (p[0] || '').split(',');
    if (r.length !== 10 || !r.every((x) => /^[0-9a-f]{8}$/i.test(x))) return null;
    return { roles: r.map(parseHex), sat: clamp(parseInt(p[1], 10) || 100, 0, 150), dust: p[2] === '1' };
  }
  const str = (P) => P.roles.map(hex8).join(',') + '|' + P.sat + '|' + (P.dust ? 1 : 0);

  function derive(P) {
    const k = P.sat / 100;
    const R = P.roles.map((c) => { const q = rgb2hsv(c[0], c[1], c[2]); return hsv2rgb(q[0], Math.min(1, q[1] * k), q[2]).concat([c[3]]); });
    const B = R[0].slice(0, 3), E = R.map((c, i) => i === 0 ? B : mix(B, c, c[3]));
    const S = E[1], A = E[2], L = E[3], T = E[4], N1 = E[5], N2 = E[6];
    const stops = [[.1, B], [.3, S], [.55, mix(S, A, .55)], [.75, A], [.93, L]];
    const ramp = (v) => { if (v <= stops[0][0]) return stops[0][1]; for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return stops[4][1]; };
    const map = (n, r, g, b) => { const q = rgb2hsv(r, g, b); if (n === '--h-f3eefc') return T; if (n === '--h-c3b4dd') return mix(T, B, .22); if (n === '--h-8b7aa8') return mix(T, B, .5); if (q[1] < .1 && q[2] > .9) return T; return ramp(q[2]); };
    const V = {}, rr = (c) => c.map(Math.round).join(',');
    ORIG.forEach((o) => { const c = map(o[0], o[1], o[2], o[3]); V[o[0]] = o[0].indexOf('--p-') === 0 ? rr(c) : hex6(c.map(Math.round)); });
    V['--neon-cyan'] = hex6(N1.map(Math.round)); V['--neon-pink'] = hex6(N2.map(Math.round)); V['--nc'] = rr(N1); V['--np'] = rr(N2);
    V['--dust-mine'] = MINE.map((c) => rr(map('', c[0], c[1], c[2]))).join('|'); V['--dust-theirs'] = THEIRS.map((c) => rr(map('', c[0], c[1], c[2]))).join('|');
    V['--c-ga'] = String(clamp(P.roles[0][3], 0.05, 1).toFixed(2));
    return { vars: V, aur: { b: hex6(B.map(Math.round)), c: [E[7], E[8], E[9]].map((c) => c.map(Math.round)), dust: P.dust, dcol: [[255, 255, 255], L.map(Math.round), N1.map(Math.round), A.map(Math.round)] }, B: B, S: S, A: A, T: T };
  }
  function apply(P, el, live) {
    const d = derive(P); el = el || root;
    Object.keys(d.vars).forEach((n) => el.style.setProperty(n, d.vars[n]));
    if (el !== root) DER.forEach((x) => el.style.setProperty(x[0], x[1]));
    if (live) { G.FRCustomAur = d.aur; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = d.aur.b; }
    return d;
  }
  function clear(el) { el = el || root; ORIG.forEach((o) => el.style.removeProperty(o[0])); EXTRA.forEach((n) => el.style.removeProperty(n)); G.FRCustomAur = null; }
  function boot() {
    try { const t = localStorage.getItem('fr_theme'), v = localStorage.getItem('fr_theme_v'), P = t && t.indexOf('c_') === 0 && parse(v); if (P) { root.dataset.theme = 'custom'; apply(P, root, true); } } catch (e) {}
  }
  const isShare = (t) => typeof t === 'string' && t.indexOf(SHARE) === 0;
  function parseShare(t) { if (!isShare(t)) return null; const i = t.indexOf('|'); if (i < 0) return null; const P = parse(t.slice(i + 1)); if (!P) return null; return { name: t.slice(SHARE.length, i).replace(/[<>|]/g, '').slice(0, 20) || 'ثيم', v: t.slice(i + 1), P: P }; }
  const shareText = (name, v) => SHARE + String(name || 'ثيم').replace(/[<>|]/g, '').slice(0, 20) + '|' + v;
  const newId = () => 'c_' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');

  const API = { parse, derive, apply, clear, boot, isShare, parseShare, shareText, str, fromPreset, editing: false, previewing: false, busy() { return API.editing || API.previewing; }, renderList() {}, renderCard() {}, PRE };
  G.FRTheme = API;

  // ===================== UI =====================
  const $ = (id) => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const H = () => G.FRThemeHost;
  const ICON = { e: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/>', s: '<path d="M12 4v10M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>', d: '<path d="M5 7h14M10 11v5M14 11v5M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>' };
  const ico = (k) => '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON[k] + '</svg>';
  const rgba = (c) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (c[3] == null ? 1 : c[3]) + ')';
  const cardBg = (P) => { const d = derive(P), a = d.aur; return 'radial-gradient(90% 60% at 20% 20%,rgb(' + a.c[0] + '),transparent 70%),radial-gradient(80% 60% at 80% 85%,rgba(' + a.c[2] + ',.55),transparent 70%),' + a.b; };

  function previewCard(P, el, name) {
    const d = derive(P); el.style.background = '';
    el.style.cssText = 'background:' + cardBg(P);
    const b1 = el.querySelector('.b1'), b2 = el.querySelector('.b2');
    if (b1) b1.style.background = hex6(d.S.map(Math.round));
    if (b2) b2.style.background = 'linear-gradient(135deg,' + hex6(d.A.map(Math.round)) + ',' + hex6(mix(d.S, d.A, .55).map(Math.round)) + ')';
  }

  function renderList() {
    const grid = $('themeGrid'), nb = grid && grid.querySelector('.tc-new'); if (!grid || !nb || !H()) return;
    grid.querySelectorAll('.tc-c').forEach((n) => n.remove());
    const cs = H().customs(), cur = H().current();
    Object.keys(cs).sort().forEach((id) => {
      const P = parse(cs[id].v); if (!P) return;
      const c = mk('div', 'theme-card tc-c' + (id === cur ? ' active' : '')); c.dataset.themePick = id;
      const tp = mk('span', 'tp'); tp.appendChild(mk('i', 'b1')); tp.appendChild(mk('i', 'b2')); previewCard(P, tp);
      const acts = mk('div', 'tc-acts');
      [['e', 'تعديل'], ['s', 'مشاركة'], ['d', 'حذف']].forEach((a) => {
        const b = mk('button'); b.type = 'button'; b.innerHTML = ico(a[0]); b.setAttribute('aria-label', a[1]); if (a[0] === 'd') b.className = 'danger';
        b.addEventListener('click', (e) => { e.stopPropagation(); act(a[0], id); }); acts.appendChild(b);
      });
      c.appendChild(tp); c.appendChild(mk('b', '', cs[id].name)); c.appendChild(acts); grid.insertBefore(c, nb);
    });
  }
  API.renderList = renderList;
  function act(k, id) {
    const cs = H().customs(), t = cs[id]; if (!t) return;
    if (k === 'e') { pendingId = id; $('themeGrid').querySelector('.tc-new').click(); }
    else if (k === 's') { H().send(shareText(t.name, t.v)); H().toast('تم إرسال الثيم إلى المحادثة'); }
    else G.FRChat && G.FRChat.sheet('حذف الثيم «' + t.name + '»؟', 'سيُحذف من حسابك نهائيًا.', [{ label: 'حذف الثيم', danger: true, onClick: () => H().remove(id) }]);
  }

  // ---------- shared theme card inside a message ----------
  let bar = null, prevKey = null;
  function endPreview(restore) {
    if (bar) { bar.remove(); bar = null; }
    if (API.previewing) { API.previewing = false; if (restore) H().apply(H().current(), true, true); }
  }
  function showPreview(s) {
    if (!API.previewing) { API.previewing = true; }
    apply(s.P, root, true); root.dataset.theme = 'custom';
    if (bar) bar.remove();
    bar = mk('div', 'thm-bar'); bar.appendChild(mk('span', '', 'معاينة الثيم: ' + s.name));
    const ok = mk('button', 'ok', 'تطبيق'), no = mk('button', '', 'إلغاء');
    ok.onclick = () => importApply(s); no.onclick = () => endPreview(true);
    bar.appendChild(ok); bar.appendChild(no); document.body.appendChild(bar);
  }
  function importApply(s) {
    if (Object.keys(H().customs()).length >= MAXC) { H().toast('وصلت للحد الأقصى من الثيمات المخصصة (' + MAXC + '). احذف ثيمًا أولًا.', true); return; }
    const id = newId(); endPreview(false);
    H().save(id, s.name, s.v, true); H().apply(id, true, true); H().toast('تم تطبيق الثيم وحفظه في حسابك');
  }
  API.renderCard = function (el, text) {
    el.textContent = ''; const s = parseShare(text); if (!s) { el.textContent = text; return; }
    const c = mk('div', 'thm-card'); c.appendChild(mk('div', 'thm-t', 'ثيم مشارك')); c.appendChild(mk('div', 'thm-n', s.name));
    const sw = mk('div', 'thm-sw'); [1, 2, 3, 4, 5, 6, 7].forEach((i) => { const d = mk('i'); d.style.background = hex6(s.P.roles[i]); sw.appendChild(d); }); c.appendChild(sw);
    const row = mk('div', 'thm-row'), v = mk('button', 'thm-btn', 'عرض الثيم'), a = mk('button', 'thm-btn pri', 'تطبيق الثيم');
    [v, a].forEach((b) => { b.type = 'button'; b.addEventListener('click', (e) => e.stopPropagation()); });
    v.addEventListener('click', () => showPreview(s)); a.addEventListener('click', () => importApply(s));
    row.appendChild(v); row.appendChild(a); c.appendChild(row); el.appendChild(c);
  };

  // ---------- editor ----------
  let D = null, sel = 0, hsv = [0, 0, 0], saved = false, pendingId = null, editId = null, raf = 0, srcField = false;
  function init() {
    const grid = $('themeGrid'), box = $('themeEditor'); if (!grid || !box) return;
    box.innerHTML = '<label class="afield"><span>اسم الثيم</span><input id="cpName" maxlength="20" autocomplete="off" placeholder="ثيمي"></label>'
      + '<div class="cp-prev" id="cpPrev"><div class="cp-hd"><b>اسم الموقع</b><span class="cp-dot"></span></div><div class="cp-body">'
      + '<div class="msg-row theirs cont"><div class="msg-bubble-shell"><div class="msg-bubble"><div class="msg-text">مرحبًا! هذه معاينة <a class="lnk">رابط</a> <span class="mention">@صديق</span></div><div class="msg-meta">09:35 AM</div></div></div></div>'
      + '<div class="msg-row mine cont"><div class="msg-bubble-shell"><div class="msg-bubble"><div class="msg-text">رسالتي بألوان الثيم</div><div class="msg-meta">09:36 AM <span class="tick" data-s="read"><svg viewBox="0 0 24 24" width="16" height="16"><path class="t1" d="M3.5 12.8l4 4L16 8.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path class="t2" d="M10.4 16.2l.8.8L21 8.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span></div></div><div class="reactions-row"><div class="reaction-chip mine"><span>🔥</span><span class="count">2</span></div></div></div></div>'
      + '</div><div class="cp-comp"><span class="cp-ic"></span><span class="cp-in">اكتب رسالة...</span><span class="cp-send"></span></div></div>'
      + '<div class="cp-warn" id="cpWarn"></div>'
      + '<h4 class="set-sub">ابدأ من ثيم جاهز</h4><div class="cp-start" id="cpStart"></div>'
      + '<h4 class="set-sub">العناصر (اضغط عنصرًا ثم غيّر لونه)</h4><div class="cp-roles" id="cpRoles"></div>'
      + '<div class="cp-picker"><div class="cp-wheelrow"><div class="cp-wheel" id="cpWheel"><canvas id="cpCv"></canvas><i class="cp-thumb" id="cpThumb"></i></div>'
      + '<div class="cp-side"><label>السطوع <b id="cpVv"></b></label><input type="range" class="cp-rng" id="cpV" min="0" max="100"><label>الشفافية <b id="cpAv"></b></label><input type="range" class="cp-rng" id="cpA" min="0" max="100"><label>الرمز (HEX)</label><input class="cp-hex" id="cpHex" dir="ltr" maxlength="9" placeholder="F72727" autocapitalize="characters" spellcheck="false"></div></div><div class="cp-sw" id="cpSw"></div></div>'
      + '<div class="cp-glob"><label>بهتان الألوان <b id="cpSv"></b></label><input type="range" class="cp-rng" id="cpS" min="0" max="150"></div>'
      + '<button class="notif-toggle" id="cpDust" style="margin-top:10px"><span class="opt-txt"><b>غبار الخلفية المتحرك</b><small>ذرّات ناعمة متوهجة تطفو في الخلفية</small></span><span class="switch"></span></button>'
      + '<button class="abtn primary" id="cpSave" style="margin-top:14px"><span>حفظ وتطبيق</span></button><button class="abtn ghost" id="cpShare"><span>مشاركة في المحادثة</span></button><div class="amsg" id="cpMsg"></div>';
    const cv = $('cpCv'), wheel = $('cpWheel'), thumb = $('cpThumb'), WS = 160, dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.height = WS * dpr; cv.style.width = cv.style.height = WS + 'px';
    const roles = $('cpRoles'), dots = [];
    ROLES.forEach((l, i) => { const b = mk('button', 'cp-role'); b.type = 'button'; const d = mk('i'); dots.push(d); b.appendChild(d); b.appendChild(mk('span', '', l)); b.onclick = () => select(i); roles.appendChild(b); });
    Object.keys(PRE).forEach((k) => { const b = mk('button', 'chipbtn', PRE[k].n); b.type = 'button'; b.onclick = () => { const P = fromPreset(k); D.roles = P.roles; D.sat = 100; D.dust = P.dust; select(sel); commit(); }; $('cpStart').appendChild(b); });
    SWATCH.forEach((x) => { const b = mk('button', 'cp-s'); b.type = 'button'; b.style.background = '#' + x; b.onclick = () => { const c = parseHex(x); const a = D.roles[sel][3]; D.roles[sel] = [c[0], c[1], c[2], a]; loadHsv(); commit(); }; $('cpSw').appendChild(b); });

    function drawWheel() {
      const n = cv.width, ctx = cv.getContext('2d'), im = ctx.createImageData(n, n), R = n / 2, d = im.data, V = hsv[2];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = x - R + .5, dy = y - R + .5, r = Math.hypot(dx, dy), i = (y * n + x) * 4; if (r > R) continue;
        const c = hsv2rgb((Math.atan2(dy, dx) / 6.28319 + 1) % 1, r / R, V); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = r > R - 1.5 ? (R - r) / 1.5 * 255 : 255;
      }
      ctx.putImageData(im, 0, 0);
    }
    let wheelV = -1;
    function loadHsv() { const c = D.roles[sel], q = rgb2hsv(c[0], c[1], c[2]); hsv = [q[1] > 0.002 && q[2] > 0.002 ? q[0] : hsv[0], q[1], q[2]]; }
    function setFromHsv() { const c = hsv2rgb(hsv[0], hsv[1], hsv[2]); D.roles[sel] = [c[0], c[1], c[2], D.roles[sel][3]]; }
    function syncPicker() {
      if (Math.abs(hsv[2] - wheelV) > .004) { wheelV = hsv[2]; drawWheel(); }
      const a = hsv[0] * 6.28319, r = hsv[1] * WS / 2; thumb.style.left = (WS / 2 + Math.cos(a) * r) + 'px'; thumb.style.top = (WS / 2 + Math.sin(a) * r) + 'px';
      const c = D.roles[sel], full = hsv2rgb(hsv[0], hsv[1], 1), V = $('cpV'), A = $('cpA');
      V.value = Math.round(hsv[2] * 100); A.value = Math.round(c[3] * 100); $('cpVv').textContent = V.value + '%'; $('cpAv').textContent = A.value + '%';
      V.style.background = 'linear-gradient(90deg,#000,rgb(' + full + '))';
      A.style.background = 'linear-gradient(90deg,transparent,rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')),repeating-conic-gradient(#888 0 25%,#555 0 50%) 0 0/10px 10px';
      if (!srcField) $('cpHex').value = (hex8(c).slice(6) === 'ff' ? hex8(c).slice(0, 6) : hex8(c)).toUpperCase();
      $('cpS').value = D.sat; $('cpSv').textContent = D.sat + '%'; $('cpDust').classList.toggle('on', D.dust);
      dots.forEach((d, i) => { d.style.background = 'linear-gradient(' + rgba(D.roles[i]) + ',' + rgba(D.roles[i]) + '),repeating-conic-gradient(#888 0 25%,#555 0 50%) 0 0/8px 8px'; d.parentNode.classList.toggle('on', i === sel); });
    }
    function select(i) { sel = i; loadHsv(); syncPicker(); }
    function warn(d) {
      const w = [], t = d.T, bg = d.B;
      if (contrast(t, bg) < 4.5) w.push('تباين النص مع الخلفية ضعيف، قد يصعب القراءة');
      if (contrast(t, d.S) < 4) w.push('النص غير واضح فوق لون الأسطح والفقاعات');
      if (contrast([255, 255, 255], d.A) < 3) w.push('اللون الأساسي فاتح جدًا: نص رسائلك (أبيض) لن يظهر جيدًا');
      const el = $('cpWarn'); el.textContent = w.join(' • '); el.style.display = w.length ? '' : 'none';
    }
    function refresh() {
      raf = 0; const P = { roles: D.roles, sat: D.sat, dust: D.dust };
      const d = apply(P, $('cpPrev'), false); $('cpPrev').style.background = cardBg(P);
      apply(P, root, true); root.dataset.theme = 'custom'; warn(d);
    }
    function commit() { syncPicker(); if (!raf) raf = requestAnimationFrame(refresh); }
    function pt(e) { const r = cv.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2, R = r.width / 2; hsv[0] = (Math.atan2(dy, dx) / 6.28319 + 1) % 1; hsv[1] = Math.min(1, Math.hypot(dx, dy) / R); setFromHsv(); commit(); }
    let dragging = false;
    wheel.addEventListener('pointerdown', (e) => { dragging = true; wheel.setPointerCapture(e.pointerId); pt(e); e.preventDefault(); });
    wheel.addEventListener('pointermove', (e) => { if (dragging) pt(e); });
    ['pointerup', 'pointercancel'].forEach((ev) => wheel.addEventListener(ev, () => { dragging = false; }));
    $('cpV').oninput = (e) => { hsv[2] = e.target.value / 100; setFromHsv(); commit(); };
    $('cpA').oninput = (e) => { D.roles[sel][3] = e.target.value / 100; commit(); };
    $('cpS').oninput = (e) => { D.sat = +e.target.value; commit(); };
    $('cpDust').onclick = () => { D.dust = !D.dust; commit(); };
    $('cpHex').oninput = (e) => { const c = parseHex(e.target.value); if (!c) return; D.roles[sel] = [c[0], c[1], c[2], c[3] == null ? D.roles[sel][3] : c[3]]; const q = rgb2hsv(c[0], c[1], c[2]); hsv = [q[1] > .002 && q[2] > .002 ? q[0] : hsv[0], q[1], q[2]]; srcField = true; commit(); srcField = false; };
    $('cpName').oninput = () => {};
    $('cpSave').onclick = () => {
      const name = ($('cpName').value || '').replace(/[<>|]/g, '').trim().slice(0, 20) || 'ثيمي', id = editId || newId();
      if (!editId && Object.keys(H().customs()).length >= MAXC) { H().toast('وصلت للحد الأقصى من الثيمات (' + MAXC + ')', true); return; }
      H().save(id, name, str(D), true); saved = true; H().apply(id, false, true); H().toast('تم حفظ الثيم «' + name + '» في حسابك');
      $('setBack').click();
    };
    $('cpShare').onclick = () => { H().send(shareText($('cpName').value || 'ثيمي', str(D))); H().toast('تم إرسال الثيم إلى المحادثة'); };

    const newBtn = mk('button', 'theme-card tc-new'); newBtn.type = 'button'; newBtn.dataset.go = 'themeedit';
    const tp = mk('span', 'tp tp-new'); tp.appendChild(mk('b', '', '+')); newBtn.appendChild(tp); newBtn.appendChild(mk('b', '', 'ثيم جديد')); grid.appendChild(newBtn);
    newBtn.addEventListener('click', (e) => {
      const id = pendingId; pendingId = null;
      if (!id && Object.keys(H().customs()).length >= MAXC) { e.stopPropagation(); H().toast('وصلت للحد الأقصى من الثيمات المخصصة (' + MAXC + ')', true); return; }
      const t = id && H().customs()[id], P = t && parse(t.v);
      if (P) { D = P; editId = id; $('cpName').value = t.name; }
      else { const cur = H().current(), ct = H().customs()[cur], base = ct && parse(ct.v); D = base || fromPreset(PRE[cur] ? cur : 'default'); editId = null; $('cpName').value = ''; }
      D = { roles: D.roles.map((c) => c.slice()), sat: D.sat, dust: D.dust };
      saved = false; API.editing = true; sel = 0; loadHsv(); wheelV = -1; select(0); commit(); box.parentNode.scrollTop = 0;
    });
    new MutationObserver(() => {
      if (box.parentNode.classList.contains('active') || !API.editing) return;
      API.editing = false; if (!saved) H().apply(H().current(), false, true);
    }).observe(box.parentNode, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar) endPreview(true); });
    renderList();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
