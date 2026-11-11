/* =========================================================
   auth.js — accounts (email/Google), profile setup, settings,
   sessions/devices, floating profile card.
   app.js starts it with FRAuth.start({ db, onReady, onProfile,
   beforeSignOut, refresh }).
   ========================================================= */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TS = () => firebase.database.ServerValue.TIMESTAMP;
  const LS_SID = 'fr_sid_v1', WEEK = 7 * 864e5, UN_RE = /^[A-Za-z0-9_]{3,20}$/;
  const ERR = {
    'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
    'auth/user-not-found': 'بيانات الدخول غير صحيحة',
    'auth/wrong-password': 'بيانات الدخول غير صحيحة',
    'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
    'auth/invalid-login-credentials': 'بيانات الدخول غير صحيحة',
    'auth/email-already-in-use': 'هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول',
    'auth/weak-password': 'كلمة المرور ضعيفة (8 أحرف على الأقل)',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة',
    'auth/network-request-failed': 'تعذر الاتصال بالإنترنت',
    'auth/popup-closed-by-user': 'أُغلقت نافذة Google قبل إكمال الدخول',
    'auth/user-disabled': 'هذا الحساب معطّل',
    'auth/requires-recent-login': 'لأسباب أمنية سجّل الخروج ثم الدخول مجددًا وأعد المحاولة',
    'auth/operation-not-allowed': 'طريقة الدخول غير مفعّلة في Firebase Console',
    'auth/unauthorized-domain': 'نطاق الموقع غير مضاف في Authorized domains',
    'auth/account-exists-with-different-credential': 'هذا البريد مرتبط بطريقة دخول أخرى'
  };
  const errText = (e) => (e && ERR[e.code]) || (e && e.message) || 'حدث خطأ غير متوقع';
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const clean = (s) => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  const deb = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  let auth, db, O = {}, user = null, profile = null, started = false, sid = '';
  let verifyTimer = null, stopSess = null, cardS = null, suPhoto = null, acPhoto, resendAt = 0, stack = ['main'];
  const users = new Map();
  const overlay = $('authOverlay'), tabs = $('authTabs'), SP = $('settingsPanel');
  const hasPw = () => !!user && user.providerData.some((p) => p.providerId === 'password');

  // ---------------- small UI helpers ----------------
  const M = () => overlay.querySelector('.auth-pane.active [data-msg]');
  function say(m, text, type) { if (!m) return; m.textContent = text || ''; m.className = 'amsg' + (type ? ' ' + type : ''); }
  function busy(b, on) { b.classList.toggle('loading', on); b.disabled = on; }
  async function run(btn, fn, msg) {
    busy(btn, true);
    try { await fn(); } catch (e) { console.warn(e); say(msg || M(), errText(e), 'err'); } finally { busy(btn, false); }
  }
  function show(name) {
    const old = overlay.querySelector('.auth-pane.active'); if (old) old.classList.remove('active');
    const nx = overlay.querySelector('[data-pane="' + name + '"]');
    nx.style.setProperty('--dx', (name === 'signup' ? -26 : 26) + 'px');
    nx.classList.add('active');
    const isTab = name === 'login' || name === 'signup';
    tabs.style.display = isTab ? '' : 'none';
    if (isTab) { tabs.dataset.active = name; tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name)); }
    overlay.querySelectorAll('[data-msg]').forEach((m) => say(m, ''));
    overlay.style.display = ''; overlay.classList.remove('hide');
  }
  function setHint(h, t, c) { h.textContent = t || ''; h.className = c || ''; }
  const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };

  // ---------------- avatars ----------------
  function paintAvatar(a, p, fb) {
    a.textContent = '';
    if (p && p.photo) { const i = new Image(); i.alt = ''; i.src = p.photo; a.style.background = ''; a.appendChild(i); return; }
    const n = clean((p && p.displayName) || fb || '?') || '?', h = hue(a.dataset.uid || n);
    a.textContent = (Array.from(n)[0] || '?').toUpperCase();
    a.style.background = 'linear-gradient(135deg,hsl(' + h + ' 55% 52%),hsl(' + ((h + 40) % 360) + ' 50% 34%))';
  }
  function mkAvatar(uid, name, cls) {
    const a = el('div', 'avatar ' + (cls || '')); a.dataset.uid = uid || ''; a.dataset.name = name || '';
    paintAvatar(a, users.get(uid), name); return a;
  }
  const nameOf = (uid, fb) => { const u = users.get(uid); return (u && u.displayName) || fb || 'مجهول'; };
  function readPhoto(file) {
    return new Promise((res, rej) => {
      if (!file || !/^image\//.test(file.type)) return rej({ message: 'الملف المختار ليس صورة' });
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const S = 160, c = el('canvas'); c.width = c.height = S;
        const m = Math.min(im.width, im.height);
        c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, S, S);
        URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej({ message: 'تعذر قراءة الصورة' }); };
      im.src = url;
    });
  }

  // ---------------- users cache (profiles) ----------------
  function watchUsers() {
    const r = db.ref('users');
    const upd = (s) => { users.set(s.key, s.val()); refreshDom(s.key); };
    r.on('child_added', upd); r.on('child_changed', upd);
    r.on('child_removed', (s) => { users.delete(s.key); refreshDom(s.key); });
  }
  function refreshDom(uid) {
    const u = users.get(uid);
    document.querySelectorAll('.avatar[data-uid="' + uid + '"]').forEach((a) => paintAvatar(a, u, a.dataset.name));
    document.querySelectorAll('.msg-sender[data-uid="' + uid + '"]').forEach((n) => { n.textContent = nameOf(uid, n.dataset.fb); });
    if (user && uid === user.uid && u) { profile = Object.assign({}, u, { uid }); renderMe(); if (O.onProfile) O.onProfile(profile); }
    if (cardS && cardS.uid === uid) renderCard();
  }

  // ---------------- auth state machine ----------------
  function start(o) {
    O = o; db = o.db; auth = firebase.auth();
    bindAuthUI(); bindSettings(); show('loading');
    auth.getRedirectResult().catch((e) => { show('login'); say(M(), errText(e), 'err'); });
    auth.onAuthStateChanged(handleUser);
  }
  async function handleUser(u) {
    if (started) { if (!u) location.reload(); return; }
    clearInterval(verifyTimer); user = u;
    if (!u) {
      show('login');
      const n = sessionStorage.getItem('fr_note');
      if (n) { sessionStorage.removeItem('fr_note'); say(M(), n, 'err'); }
      return;
    }
    if (hasPw() && !u.emailVerified) {
      $('vEmail').textContent = u.email; show('verify');
      verifyTimer = setInterval(() => checkVerified(false), 5000); return;
    }
    show('loading');
    try {
      const tr = await u.getIdTokenResult();
      if (!tr.claims.email_verified) await u.getIdToken(true);
      const s = await db.ref('users/' + u.uid).once('value');
      profile = s.val();
      if (!profile) { prepSetup(); show('setup'); return; }
      finishReady(false);
    } catch (e) { console.warn(e); show('login'); say(M(), errText(e), 'err'); }
  }
  async function checkVerified(manual) {
    const u = auth.currentUser; if (!u) return;
    try { await u.reload(); } catch (e) { if (manual) say(M(), errText(e), 'err'); return; }
    if (u.emailVerified) { clearInterval(verifyTimer); handleUser(u); }
    else if (manual) say(M(), 'لم يتم التحقق بعد. افتح الرابط في بريدك ثم اضغط مجددًا', 'err');
  }
  function finishReady(isNew) {
    if (started) return;
    started = true; profile.uid = user.uid;
    overlay.classList.add('hide'); setTimeout(() => { overlay.style.display = 'none'; }, 520);
    watchUsers(); initSession(); renderMe();
    O.onReady(profile, isNew);
  }
  async function logout(note) {
    try { if (started && O.beforeSignOut) await O.beforeSignOut(); } catch (e) {}
    try { if (started && sid) await db.ref('sessions/' + user.uid + '/' + sid).remove(); } catch (e) {}
    try { localStorage.removeItem(LS_SID); if (note) sessionStorage.setItem('fr_note', note); } catch (e) {}
    await auth.signOut();
  }

  // ---------------- login / signup / forgot / google ----------------
  async function googleLogin() {
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(p);
      if (e.code === 'auth/cancelled-popup-request') return;
      throw e;
    }
  }
  function bindAuthUI() {
    overlay.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-pane-go],[data-eye],[data-google],[data-logout]'); if (!t) return;
      if (t.dataset.tab) show(t.dataset.tab);
      else if (t.dataset.paneGo) show(t.dataset.paneGo);
      else if (t.dataset.eye) { const i = $(t.dataset.eye), s = i.type === 'password'; i.type = s ? 'text' : 'password'; t.textContent = s ? 'إخفاء' : 'إظهار'; }
      else if (t.dataset.google) run(t, googleLogin);
      else if (t.dataset.logout) logout();
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
      const b = overlay.querySelector('.auth-pane.active [data-submit]'); if (b) { e.preventDefault(); b.click(); }
    });
    $('liBtn').onclick = () => run($('liBtn'), async () => {
      const em = $('liEmail').value.trim(), pw = $('liPass').value;
      if (!em || !pw) throw { message: 'أدخل البريد الإلكتروني وكلمة المرور' };
      await auth.signInWithEmailAndPassword(em, pw);
    });
    $('suEmailBtn').onclick = () => run($('suEmailBtn'), async () => {
      const em = $('sgEmail').value.trim(), pw = $('sgPass').value;
      if (!em) throw { message: 'أدخل البريد الإلكتروني' };
      if (pw.length < 8) throw { code: 'auth/weak-password' };
      const c = await auth.createUserWithEmailAndPassword(em, pw);
      await c.user.sendEmailVerification();
    });
    $('fgBtn').onclick = () => run($('fgBtn'), async () => {
      const em = $('fgEmail').value.trim(); if (!em) throw { message: 'أدخل بريدك الإلكتروني' };
      await auth.sendPasswordResetEmail(em);
      say(M(), 'إن كان البريد مسجّلًا فستصلك رسالة لإعادة تعيين كلمة المرور.', 'ok');
    });
    $('vDone').onclick = () => run($('vDone'), () => checkVerified(true));
    $('vResend').onclick = () => {
      const l = Math.ceil((resendAt - Date.now()) / 1000);
      if (l > 0) return say(M(), 'انتظر ' + l + ' ثانية قبل إعادة الإرسال', 'err');
      run($('vResend'), async () => {
        await auth.currentUser.sendEmailVerification(); resendAt = Date.now() + 45000;
        say(M(), 'تم إرسال رسالة التحقق. تفقد بريدك والرسائل غير المرغوبة.', 'ok');
      });
    };
    // profile setup
    $('suPick').onclick = () => $('suFile').click();
    $('suFile').onchange = async (e) => {
      try { suPhoto = await readPhoto(e.target.files[0]); paintAvatar($('suAv'), { photo: suPhoto }, $('suName').value); say(M(), ''); }
      catch (er) { say(M(), errText(er), 'err'); }
      e.target.value = '';
    };
    $('suUser').addEventListener('input', deb(() => { const v = $('suUser').value.trim(); if (v) checkUN(v, $('suHint'), ''); else setHint($('suHint'), ''); }, 450));
    $('suBtn').onclick = () => run($('suBtn'), createProfile);
  }
  function prepSetup() {
    suPhoto = null; $('suName').value = clean(user.displayName).slice(0, 20); $('suUser').value = ''; $('suBio').value = '';
    setHint($('suHint'), ''); const a = $('suAv'); a.dataset.uid = ''; paintAvatar(a, null, $('suName').value || '?');
  }
  async function checkUN(v, hint, cur) {
    const l = v.toLowerCase();
    if (!UN_RE.test(v)) { setHint(hint, '3–20 حرفًا: إنجليزية وأرقام و _ فقط', 'err'); return false; }
    if (l === cur) { setHint(hint, ''); return true; }
    try {
      const s = await db.ref('usernames/' + l).once('value');
      if (s.exists()) { setHint(hint, 'اسم المستخدم محجوز', 'err'); return false; }
      setHint(hint, 'متاح', 'ok'); return true;
    } catch (e) { setHint(hint, 'تعذر التحقق الآن', 'err'); return false; }
  }
  async function createProfile() {
    const dn = clean($('suName').value), un = $('suUser').value.trim(), bio = clean($('suBio').value).slice(0, 160);
    if (dn.length < 2) throw { message: 'الاسم الظاهر حرفان على الأقل' };
    if (!(await checkUN(un, $('suHint'), ''))) throw { message: 'اختر اسم مستخدم صالحًا ومتاحًا' };
    const l = un.toLowerCase(), data = { displayName: dn, username: un, usernameLower: l, joinedAt: TS() };
    if (bio) data.bio = bio; if (suPhoto) data.photo = suPhoto;
    try { await db.ref().update({ ['usernames/' + l]: user.uid, ['users/' + user.uid]: data }); }
    catch (e) { throw e.code === 'PERMISSION_DENIED' ? { message: 'اسم المستخدم محجوز أو الحساب غير مؤهل بعد. جرّب اسمًا آخر.' } : e; }
    profile = (await db.ref('users/' + user.uid).once('value')).val();
    finishReady(true);
  }

  // ---------------- sessions / devices ----------------
  function deviceLabel() {
    const u = navigator.userAgent;
    const os = /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Mac OS X/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : 'جهاز';
    const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\/|CriOS/.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'متصفح';
    const app = (matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? ' (تطبيق)' : '';
    return (br + ' • ' + os + app).slice(0, 60);
  }
  function initSession() {
    try { sid = localStorage.getItem(LS_SID) || ''; } catch (e) {}
    if (!sid) { sid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)).replace(/[^\w-]/g, '').slice(0, 40); try { localStorage.setItem(LS_SID, sid); } catch (e) {} }
    const ref = db.ref('sessions/' + user.uid + '/' + sid);
    ref.once('value').then((s) => {
      const b = { device: deviceLabel(), lastActive: TS() }; if (!s.exists()) b.created = TS();
      return ref.update(b);
    }).catch(() => {});
    ref.child('revoked').on('value', (s) => { if (s.val() === true) logout('تم إنهاء هذه الجلسة من جهاز آخر'); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ref.update({ lastActive: TS() }).catch(() => {}); });
  }
  function watchSess() {
    const r = db.ref('sessions/' + user.uid), h = r.on('value', (s) => renderSess(s.val() || {}));
    stopSess = () => r.off('value', h);
  }
  function renderSess(v) {
    const list = $('sessList'); list.textContent = '';
    const arr = Object.keys(v).map((k) => Object.assign({ k }, v[k])).sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    arr.forEach((x) => {
      const cur = x.k === sid, row = el('div', 'sess' + (cur ? ' cur' : '')), inf = el('div', 'sess-i');
      inf.appendChild(el('b', '', x.device || 'جهاز'));
      inf.appendChild(el('small', '', cur ? 'هذا الجهاز • نشط الآن' : x.revoked ? 'جارٍ إنهاؤها...' : 'آخر نشاط: ' + fmtSeen(x.lastActive || x.created || Date.now())));
      row.appendChild(inf);
      if (!cur && !x.revoked) {
        const b = el('button', 'chipbtn danger', 'إنهاء');
        b.onclick = () => db.ref('sessions/' + user.uid + '/' + x.k + '/revoked').set(true);
        row.appendChild(b);
      }
      list.appendChild(row);
    });
    $('sessEndOthers').style.display = arr.some((x) => x.k !== sid && !x.revoked) ? '' : 'none';
  }

  // ---------------- date helpers ----------------
  function fmtSeen(ts) {
    const d = new Date(ts), n = new Date(), t = d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(n) - day(d)) / 864e5);
    if (diff === 0) return 'اليوم ' + t; if (diff === 1) return 'أمس ' + t;
    return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + t;
  }
  function fmtLeft(ms) { const h = Math.ceil(ms / 36e5); return h >= 24 ? Math.ceil(h / 24) + ' يوم' : h + ' ساعة'; }

  // ---------------- confirm modal ----------------
  function askConfirm(o) {
    return new Promise((res) => {
      const b = el('div', 'cm-back'), c = el('div', 'cm');
      c.appendChild(el('h4', '', o.title)); c.appendChild(el('p', '', o.desc));
      let pw = null, ty = null;
      if (o.password) { pw = el('input'); pw.type = 'password'; pw.placeholder = 'كلمة المرور الحالية'; pw.dir = 'ltr'; c.appendChild(pw); }
      if (o.type) { ty = el('input'); ty.placeholder = 'اكتب: ' + o.type; ty.dir = 'ltr'; ty.autocapitalize = 'none'; c.appendChild(ty); }
      const ok = el('button', 'abtn ' + (o.danger ? 'danger' : 'primary'), o.label), no = el('button', 'abtn ghost', 'إلغاء');
      if (ty) { ok.disabled = true; ty.oninput = () => { ok.disabled = ty.value.trim().toLowerCase() !== o.type.toLowerCase(); }; }
      const done = (v) => { b.classList.remove('show'); setTimeout(() => b.remove(), 250); res(v); };
      ok.onclick = () => done({ password: pw ? pw.value : '' }); no.onclick = () => done(null);
      b.addEventListener('pointerdown', (e) => { if (e.target === b) done(null); });
      c.appendChild(ok); c.appendChild(no); b.appendChild(c); document.body.appendChild(b);
      requestAnimationFrame(() => b.classList.add('show'));
    });
  }
  async function reauth(pw) {
    if (hasPw()) {
      if (!pw) throw { message: 'أدخل كلمة المرور الحالية' };
      await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, pw));
    } else await user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
  }

  // ---------------- settings panel ----------------
  const page = (n) => SP.querySelector('[data-page="' + n + '"]');
  function renderMe() {
    const m = $('setMe'); if (!m || !profile) return; m.textContent = '';
    m.appendChild(mkAvatar(user.uid, profile.displayName, 'big'));
    const t = el('div', 'set-me-t'); t.appendChild(el('b', '', profile.displayName));
    const u = el('span', '', '@' + profile.username); u.dir = 'ltr'; t.appendChild(u);
    t.appendChild(el('small', '', user.email || '')); m.appendChild(t);
  }
  function setTitle() { $('setTitle').textContent = page(stack[stack.length - 1]).dataset.title; $('setBack').style.visibility = stack.length > 1 ? 'visible' : 'hidden'; }
  function enter(n) {
    if (n === 'account') fillAccount(); else if (n === 'security') fillSecurity(); else if (n === 'sessions') watchSess();
    if (O.refresh && (n === 'main' || n === 'notif' || n === 'sound')) O.refresh();
  }
  function leave(n) { if (n === 'sessions' && stopSess) { stopSess(); stopSess = null; } }
  function go(n) {
    const cur = page(stack[stack.length - 1]), nx = page(n);
    cur.classList.remove('active'); cur.classList.add('behind'); nx.classList.remove('behind'); nx.classList.add('active');
    stack.push(n); enter(n); setTitle(); nx.scrollTop = 0;
  }
  function back() {
    if (stack.length < 2) return closeSettings();
    const c = stack.pop(); leave(c); page(c).classList.remove('active');
    const p = page(stack[stack.length - 1]); p.classList.remove('behind'); p.classList.add('active'); setTitle();
  }
  function openSettings(n) {
    if (!started) return;
    stack = ['main']; SP.querySelectorAll('.set-page').forEach((p) => p.classList.remove('active', 'behind'));
    page('main').classList.add('active'); renderMe(); enter('main'); setTitle();
    SP.classList.add('open'); SP.setAttribute('aria-hidden', 'false');
    if (n && n !== 'main') setTimeout(() => go(n), 40);
  }
  function closeSettings() { while (stack.length > 1) leave(stack.pop()); leave('sessions'); SP.classList.remove('open'); SP.setAttribute('aria-hidden', 'true'); }

  function fillAccount() {
    acPhoto = undefined; const a = $('acAv'); a.dataset.uid = ''; paintAvatar(a, profile, profile.displayName);
    $('acName').value = profile.displayName; $('acUser').value = profile.username; $('acBio').value = profile.bio || '';
    const left = (profile.usernameChangedAt || 0) + WEEK - Date.now(), lock = left > 0;
    $('acUser').disabled = lock;
    setHint($('acUserHint'), lock ? 'يمكنك تغيير اسم المستخدم بعد ' + fmtLeft(left) : 'يمكن تغييره مرة واحدة كل 7 أيام');
    say($('acMsg'), '');
  }
  async function saveProfile() {
    const dn = clean($('acName').value), un = $('acUser').value.trim(), bio = clean($('acBio').value).slice(0, 160), b = 'users/' + user.uid + '/', up = {};
    if (dn.length < 2) throw { message: 'الاسم الظاهر حرفان على الأقل' };
    if (dn !== profile.displayName) up[b + 'displayName'] = dn;
    if (bio !== (profile.bio || '')) up[b + 'bio'] = bio || null;
    if (acPhoto !== undefined) up[b + 'photo'] = acPhoto;
    const l = un.toLowerCase();
    if (un !== profile.username) {
      if (!(await checkUN(un, $('acUserHint'), profile.usernameLower))) throw { message: 'اسم المستخدم غير صالح أو محجوز' };
      if (l !== profile.usernameLower) {
        if ((profile.usernameChangedAt || 0) + WEEK > Date.now()) throw { message: 'لا يمكن تغيير اسم المستخدم قبل مرور 7 أيام' };
        up['usernames/' + l] = user.uid; up['usernames/' + profile.usernameLower] = null; up[b + 'usernameLower'] = l; up[b + 'usernameChangedAt'] = TS();
      }
      up[b + 'username'] = un;
    }
    if (!Object.keys(up).length) return say($('acMsg'), 'لا توجد تغييرات لحفظها', '');
    try { await db.ref().update(up); }
    catch (e) { throw e.code === 'PERMISSION_DENIED' ? { message: 'تعذر الحفظ: اسم المستخدم محجوز أو لم تمض 7 أيام على آخر تغيير' } : e; }
    fillAccount(); say($('acMsg'), 'تم حفظ التغييرات', 'ok');
  }
  function fillSecurity() {
    const pw = hasPw(); $('secPwBoxes').style.display = pw ? '' : 'none'; $('secGoogleNote').style.display = pw ? 'none' : '';
    $('secEmailNow').textContent = user.email || '';
    ['seNewEmail', 'seEmailPw', 'sePassOld', 'sePassNew'].forEach((i) => { $(i).value = ''; });
    say($('seEmailMsg'), ''); say($('sePassMsg'), '');
  }
  async function deleteAccount() {
    const r = await askConfirm({ title: 'حذف الحساب نهائيًا', desc: 'سيُحذف ملفك الشخصي وصورتك وجلساتك واسم المستخدم، ولا يمكن التراجع. رسائلك السابقة تبقى في المحادثة دون ربطها بحساب.', password: hasPw(), type: profile.username, label: 'حذف حسابي نهائيًا', danger: true });
    if (!r) return;
    const m = $('seDelMsg'); say(m, '');
    await reauth(r.password);
    const uid = user.uid, up = {};
    try { if (O.beforeSignOut) await O.beforeSignOut(); } catch (e) {}
    up['users/' + uid] = null; up['usernames/' + profile.usernameLower] = null; up['sessions/' + uid] = null;
    up['chat/presence/' + uid] = null; up['chat/typing/' + uid] = null;
    await db.ref().update(up);
    await user.delete();
    try { localStorage.removeItem(LS_SID); } catch (e) {}
    location.reload();
  }

  function bindSettings() {
    $('settingsFab').onclick = () => openSettings();
    $('setBack').onclick = back; $('setClose').onclick = closeSettings;
    SP.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (cardS) closeCard(); else if (SP.classList.contains('open')) back(); } });
    $('setLogout').onclick = async () => { if (await askConfirm({ title: 'تسجيل الخروج', desc: 'هل تريد تسجيل الخروج من هذا الجهاز؟', label: 'تسجيل الخروج' })) logout(); };
    $('acPick').onclick = () => $('acFile').click();
    $('acFile').onchange = async (e) => {
      try { acPhoto = await readPhoto(e.target.files[0]); paintAvatar($('acAv'), { photo: acPhoto }, $('acName').value); }
      catch (er) { say($('acMsg'), errText(er), 'err'); }
      e.target.value = '';
    };
    $('acDelPhoto').onclick = () => { acPhoto = null; paintAvatar($('acAv'), null, $('acName').value || profile.displayName); };
    $('acUser').addEventListener('input', deb(() => { const v = $('acUser').value.trim(); if (v && v !== profile.username) checkUN(v, $('acUserHint'), profile.usernameLower); }, 450));
    $('acSave').onclick = () => run($('acSave'), saveProfile, $('acMsg'));
    $('seEmailBtn').onclick = () => run($('seEmailBtn'), async () => {
      const ne = $('seNewEmail').value.trim(); if (!ne) throw { message: 'أدخل البريد الجديد' };
      await reauth($('seEmailPw').value); await user.verifyBeforeUpdateEmail(ne);
      say($('seEmailMsg'), 'أرسلنا رابط تأكيد إلى ' + ne + '. يتغير بريدك بعد الضغط عليه، وقد تحتاج إلى تسجيل الدخول مجددًا.', 'ok');
    }, $('seEmailMsg'));
    $('sePassBtn').onclick = () => run($('sePassBtn'), async () => {
      const np = $('sePassNew').value; if (np.length < 8) throw { code: 'auth/weak-password' };
      await reauth($('sePassOld').value); await user.updatePassword(np);
      $('sePassOld').value = ''; $('sePassNew').value = ''; say($('sePassMsg'), 'تم تغيير كلمة المرور', 'ok');
    }, $('sePassMsg'));
    $('secDelete').onclick = () => run($('secDelete'), deleteAccount, $('seDelMsg'));
    $('sessEndOthers').onclick = async () => {
      if (!(await askConfirm({ title: 'إنهاء الجلسات الأخرى', desc: 'سيتم تسجيل الخروج من كل الأجهزة الأخرى.', label: 'إنهاء الجلسات', danger: true }))) return;
      const s = (await db.ref('sessions/' + user.uid).once('value')).val() || {}, up = {};
      Object.keys(s).forEach((k) => { if (k !== sid) up['sessions/' + user.uid + '/' + k + '/revoked'] = true; });
      if (Object.keys(up).length) await db.ref().update(up);
    };
  }

  // ---------------- floating profile card ----------------
  function openCard(uid, anchor, fb) {
    if (!started || !uid) return; closeCard(true);
    const layer = el('div', 'pc-layer'), c = el('div', 'pcard'); layer.appendChild(c); document.body.appendChild(layer);
    const ref = db.ref('chat/presence/' + uid);
    cardS = { uid, layer, c, fb, anchor, pres: null, ref };
    layer.addEventListener('pointerdown', (e) => { if (e.target === layer) closeCard(); });
    cardS.h = ref.on('value', (s) => { if (cardS) { cardS.pres = s.val(); renderCard(); } });
    cardS.t = setInterval(renderCard, 30000);
    renderCard(); requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('show')));
  }
  function renderCard() {
    const s = cardS; if (!s) return;
    const u = users.get(s.uid), p = s.pres, on = !!(p && p.online === true), c = s.c, nm = (u && u.displayName) || s.fb || 'مجهول';
    c.textContent = '';
    c.appendChild(mkAvatar(s.uid, nm, 'xl' + (on ? ' ring-on' : '')));
    c.appendChild(el('div', 'pc-name', nm));
    if (!u) { c.appendChild(el('div', 'pc-note', 'هذا الحساب غير متاح (حُذف أو رسالة قديمة)')); }
    else {
      const un = el('div', 'pc-user', '@' + u.username); un.dir = 'ltr'; c.appendChild(un);
      const st = el('div', 'pc-status' + (on ? ' on' : '')); st.appendChild(el('i', 'dot')); st.appendChild(el('span', '', on ? 'متصل' : 'غير متصل')); c.appendChild(st);
      const rows = el('div', 'pc-rows');
      const row = (k, v) => { const r = el('div', 'pc-row'); r.appendChild(el('span', '', k)); r.appendChild(el('b', '', v)); rows.appendChild(r); };
      row('آخر ظهور', on ? 'الآن' : (p && p.lastSeen ? fmtSeen(p.lastSeen) : 'غير معروف'));
      row('تاريخ الانضمام', u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
      c.appendChild(rows);
      if (u.bio) c.appendChild(el('div', 'pc-bio', u.bio));
    }
    requestAnimationFrame(placeCard);
  }
  function placeCard() {
    const s = cardS; if (!s) return;
    const r = s.anchor.getBoundingClientRect(), c = s.c, w = c.offsetWidth, h = c.offsetHeight, m = 12;
    const left = Math.max(m, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - m));
    let top = r.bottom + 10; if (top + h > innerHeight - m) top = r.top - h - 10;
    top = Math.max(m, Math.min(top, innerHeight - h - m));
    c.style.left = left + 'px'; c.style.top = top + 'px';
    c.style.transformOrigin = (r.left + r.width / 2 - left) + 'px ' + (r.top + r.height / 2 - top) + 'px';
  }
  function closeCard(now) {
    const s = cardS; if (!s) return; cardS = null;
    s.ref.off('value', s.h); clearInterval(s.t);
    if (now) { s.layer.remove(); return; }
    s.layer.style.pointerEvents = 'none'; s.c.classList.remove('show'); setTimeout(() => s.layer.remove(), 260);
  }

  window.FRAuth = { start, users, nameOf, mkAvatar, openCard, openSettings };
})();
