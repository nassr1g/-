/* =========================================================
   Otaku Chat — App logic (v2)
   Single public room. Persistent identity. Instant realtime
   sync. Swipe/long-press reply. Context menu (reply/delete).
   Soft delete. Online list. Paginated history.
   ========================================================= */

/* (راجع التذكير في auth.js: كل نافذة/قائمة جديدة يجب أن تدعم زر الرجوع عبر FRNav.push / FRNav.back) */
/* ============================================================================
   ⚠️ تذكير إلزامي عند أي تعديل (للمطوّر / للذكاء الاصطناعي):
   كل قائمة أو نافذة أو لوحة أو بطاقة عائمة جديدة يجب أن تدعم زر الرجوع في الهاتف.
     - عند الفتح:            FRNav.push('اسم-فريد', دالة_الإغلاق_الفعلي)
     - عند الإغلاق من الواجهة: FRNav.back('اسم-فريد')   (لا تُخفِ النافذة مباشرةً)
   يجب أن يغلق زر الرجوع آخر طبقة مفتوحة أولًا، ولا يخرج من الموقع وهناك نافذة يمكن إغلاقها.
   الحالات غير المتراكبة (مثل وضع التحديد) تُعالَج في closeTopSoft داخل app.js.
   ============================================================================ */
(() => {
  'use strict';
  window.addEventListener('error', (e) => {
    const pane = document.querySelector('.auth-pane.active[data-pane="loading"]');
    if (!pane) return;
    pane.textContent = '';
    const a = document.createElement('p'); a.style.cssText = 'text-align:center;line-height:1.8;margin:16px 0 6px';
    a.textContent = 'تعذر تشغيل الموقع. تأكد أن كل الملفات رُفعت بنفس الإصدار ثم أعد المحاولة.';
    const b = document.createElement('p'); b.style.cssText = 'text-align:center;font-size:11px;opacity:.6;direction:ltr;margin:0 0 14px;word-break:break-all';
    b.textContent = String(e.message || '').slice(0, 140);
    const c = document.createElement('button'); c.className = 'abtn primary'; c.innerHTML = '<span>إعادة المحاولة</span>'; c.onclick = () => location.reload();
    pane.appendChild(a); pane.appendChild(b); pane.appendChild(c);
  });

  // ---------- Config ----------
  const firebaseConfig = {
    apiKey: "AIzaSyDTVX_LM8wtrgAGgCzFAOVb5AV5d_ieI9k",
    authDomain: "friends-room-topaz.vercel.app",
    databaseURL: "https://otaku2-e2764-default-rtdb.firebaseio.com",
    projectId: "otaku2-e2764",
    storageBucket: "otaku2-e2764.firebasestorage.app",
    messagingSenderId: "1006295063792",
    appId: "1:1006295063792:web:c848a9714ee3ada87af635",
    measurementId: "G-1MR57ZC92C"
  };

  const PAGE_SIZE = 30;
  const SWIPE_TRIGGER_PX = 64;
  const SWIPE_MAX_PX = 88;
  const LS_UID_KEY = 'otaku_uid_v1';
  const LS_NAME_KEY = 'otaku_name_v1';
  const LS_MUTE_KEY = 'otaku_mute_v1';
  const LS_BANNER_KEY = 'otaku_notif_banner_closed_v1';
  const LS_SENDSND_KEY = 'otaku_send_sound_v1';
  const LS_INSTALL_KEY = 'otaku_install_dismissed_v1';
  const LS_MUTEREACT_KEY = 'otaku_mute_react_v1';
  const LS_MUTEMENT_KEY = 'otaku_mute_mention_v1';
  const LS_READ_KEY = 'otaku_lastread_v1_';
  const LS_QUICK_KEY = 'otaku_quick_react_v1';
  const LS_DBLHINT_KEY = 'otaku_dbl_hint_v1';
  const LS_CLEAR_KEY = 'otaku_clear_before_v1';
  const LS_HIDDEN_KEY = 'otaku_hidden_keys_v1';

  // Firebase Console > Project settings > Cloud Messaging > Web Push certificates
  // > Generate key pair  -> paste the PUBLIC key here.
  const VAPID_KEY = 'BGlc_HcdcSEwssUo5AdcZYNQzvYvciQuka8TfDp-sbNdJkl7QYCesAbyfZKrIgXG6N6wWrtSCK1mpZs3A__XH6Y';
  const NOTIFY_ENDPOINT = '/api/notify';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const brandIntro = $('brandIntro');
  const brandIntroText = $('brandIntroText');

  const messagesWrap = $('messagesWrap');
  const messagesList = $('messagesList');
  const welcomeCard = $('welcomeCard');
  const netBar = $('netBar');
  const netBarText = $('netBarText') || document.createElement('span');
  const jumpBottomBtn = $('jumpBottomBtn');
  const jumpBottomBadge = $('jumpBottomBadge');

  const statusDot = $('statusDot');
  const onlineCount = $('onlineCount');
  const onlineBtn = $('onlineBtn');
  const onlineSheetBackdrop = $('onlineSheetBackdrop');
  const onlineList = $('onlineList');

  const replyPreview = $('replyPreview');
  const replyPreviewWho = $('replyPreviewWho');
  const replyPreviewTxt = $('replyPreviewTxt');
  const replyCancelBtn = $('replyCancelBtn');

  const messageInput = $('messageInput');
  const sendBtn = $('sendBtn');
  const emojiToggleBtn = $('emojiToggleBtn');
  const emojiPanel = $('emojiPanel');
  const emojiTabs = $('emojiTabs');
  const emojiGrid = $('emojiGrid');
  const typingRow = $('typingRow');
  const typingNames = $('typingNames');

  const notifBtn = $('notifBtn');
  const notifDot = $('notifDot');
  const notifSheetBackdrop = $('notifSheetBackdrop');
  const notifStatus = $('notifStatus');
  const notifEnableBtn = $('notifEnableBtn');
  const notifOptions = $('notifOptions');
  const notifBanner = $('notifBanner');
  const notifBannerText = $('notifBannerText');
  const notifBannerBtn = $('notifBannerBtn');
  const notifBannerClose = $('notifBannerClose');
  const chatTonesToggle = $('chatTonesToggle');
  const muteReactToggle = $('muteReactToggle');
  const muteMentionToggle = $('muteMentionToggle') || document.createElement('button');
  const mentionPanel = $('mentionPanel') || document.createElement('div');
  const mentionBtn = $('mentionBtn') || document.createElement('button');
  const mentionBadge = $('mentionBadge') || document.createElement('span');
  const quickGrid = $('quickGrid');
  const clearHistoryBtn = $('clearHistoryBtn');
  const selectBar = $('selectBar');
  const selectCount = $('selectCount');
  const selectCancel = $('selectCancel');
  const selectDelete = $('selectDelete');
  const selectCopy = $('selectCopy');
  const bottomDock = $('bottomDock');
  const installBanner = $('installBanner');
  const installBtn = $('installBtn');
  const installClose = $('installClose');
  const installSheetBtn = $('installSheetBtn');

  // ---------- State ----------
  let db = null;
  let firebaseReady = false;
  let myUid = '';
  let myName = '';
  let isConnected = false;

  let messagesRef = null;
  let usersRef = null;
  let typingRef = null;
  let eventsRef = null;

  let oldestLoadedKey = null;
  let allMessagesByKey = new Map(); // key -> {data, el}
  let hasMoreHistory = true;
  let liveSyncStarted = false;

  let activeReply = null;       // {key, sender, text}
  let typingTimeoutLocal = null;
  let typingDebounce = null;

  let ctxMenuEl = null;
  let ctxBackdropEl = null;
  let ctxCloseTimer = null;
  let ctxMenuResizeObserver = null;
  let unseenNewCount = 0;
  let editingKey = null; // key of the message currently being edited, or null
  let myJoined = 0;      // server time when this account joined (decides which history it may read)

  // ========================================================
  // Identity (persistent, localStorage, survives refresh)
  // ========================================================
  function uuidv4() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function loadIdentity() {
    try {
      myUid = localStorage.getItem(LS_UID_KEY) || '';
      myName = localStorage.getItem(LS_NAME_KEY) || '';
    } catch (e) { myUid = ''; myName = ''; }
    if (!myUid) {
      myUid = uuidv4();
      try { localStorage.setItem(LS_UID_KEY, myUid); } catch (e) {}
    }
  }

  function saveName(name) {
    myName = name;
    try { localStorage.setItem(LS_NAME_KEY, name); } catch (e) {}
  }

  // ========================================================
  // Sanitization (XSS safety) — text nodes only, never innerHTML
  // with user-supplied text.
  // ========================================================
  function clampText(str, max) { return (str || '').toString().slice(0, max); }
  function sanitizeName(raw) { return clampText(raw, 20).replace(/<|>/g, '').trim(); }
  function sanitizeMessage(raw) { return clampText(raw, 1000).replace(/<|>/g, ''); }

  // ========================================================
  // Firebase init
  // ========================================================
  function initFirebase() {
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      firebaseReady = true;
    } catch (e) {
      console.error('Firebase init error', e);
      firebaseReady = false;
    }
  }

  // ========================================================
  // Brand intro animation: "Hi!" -> "Nice to see you" -> site name
  // Slow, deliberate, cinematic timing per request.
  // ========================================================
  const SITE_NAME = "ᠻ𝘳𝓲ꫀꪀᦔ𝘴' 𝘳ꪮꪮꪑ";

  function playBrandIntro() {
    const sequence = ['Hi!', 'Nice to see you'];
    let i = 0;
    brandIntroText.textContent = sequence[0];
    brandIntroText.classList.add('anim-in');

    function next() {
      i++;
      brandIntroText.classList.remove('anim-in');
      brandIntroText.classList.add('anim-out');
      setTimeout(() => {
        brandIntroText.classList.remove('anim-out');
        if (i < sequence.length) {
          brandIntroText.textContent = sequence[i];
          brandIntroText.classList.add('anim-in');
          setTimeout(next, 2200);
        } else {
          brandIntroText.textContent = SITE_NAME;
          brandIntroText.classList.add('final', 'anim-in');
          introDone = true;
          brandMode = 'final';
        }
      }, 700);
    }
    setTimeout(next, 2200);
  }

  // ========================================================
  // Name modal flow
  // ========================================================

  // ========================================================
  // Connection + presence
  // ========================================================
  // Header sequence: "connecting..." -> (once stably connected) Hi! -> Nice to see you -> site name.
  // If the connection drops later, "connecting..." takes the site name's place until it returns.
  const CONNECT_TEXT = 'جارِ الاتصال بالمحادثة...';
  const OFFLINE_TEXT = 'بانتظار الشبكة...';
  let introStarted = false, introDone = false, brandMode = 'connecting';
  let connTimer = null, lostTimer = null;

  function swapBrand(text, mode) {
    if (brandMode === mode) return;
    brandMode = mode;
    brandIntroText.classList.remove('anim-in');
    brandIntroText.classList.add('anim-out');
    setTimeout(() => {
      if (brandMode !== mode) return;
      brandIntroText.classList.remove('anim-out', 'final', 'connecting');
      brandIntroText.textContent = text;
      brandIntroText.classList.add(mode === 'final' ? 'final' : 'connecting');
      void brandIntroText.offsetWidth;
      brandIntroText.classList.add('anim-in');
    }, 500);
  }
  function onStableConnection() {
    if (!introStarted) {
      introStarted = true;
      brandMode = 'intro';
      brandIntroText.classList.remove('anim-in');
      brandIntroText.classList.add('anim-out');
      setTimeout(() => {
        brandIntroText.classList.remove('anim-out', 'connecting');
        playBrandIntro();
      }, 500);
    } else if (introDone) {
      swapBrand(SITE_NAME, 'final');
    }
  }
  function onConnectionLost() {
    if (introDone) swapBrand(navigator.onLine === false ? OFFLINE_TEXT : CONNECT_TEXT, 'connecting');
  }

  function updateConnectionUI() {
    clearTimeout(connTimer);
    clearTimeout(lostTimer);
    if (window.FRNet) window.FRNet.connected = !!(isConnected && firebaseReady);
    sendBtn.disabled = false; // writing is always possible: unsent messages wait in the outbox
    if (isConnected && firebaseReady) {
      statusDot.classList.remove('off');
      connTimer = setTimeout(onStableConnection, 700); // only once the connection has held steady
    } else {
      statusDot.classList.add('off');
      lostTimer = setTimeout(onConnectionLost, 1500);  // ignore tiny blips
    }
    renderNetBar();
  }

  function setupPresence() {
    const connectedRef = db.ref('.info/connected');
    db.ref('.info/serverTimeOffset').on('value', (s) => { serverOffset = Number(s.val()) || 0; });
    connectedRef.on('value', (snap) => {
      isConnected = !!snap.val();
      window.FRNet.ready = true;
      updateConnectionUI();
      if (isConnected) { retryDelay = 2000; startChangesFeed(); kickOutbox(); backfillSoon(); scheduleReceipts(); }
      if (isConnected && document.visibilityState === 'visible') announcePresence();
    });

    usersRef.on('value', (snap) => {
      const all = snap.val() || {};
      const users = {};
      Object.keys(all).forEach((k) => { if (all[k] && all[k].online === true) users[k] = all[k]; });
      const keys = Object.keys(users);
      onlineIds = new Set(keys);
      onlineCount.textContent = keys.length;
      renderOnlineList(users);
    });
  }

  function renderOnlineList(users) {
    onlineList.innerHTML = '';
    const ids = Object.keys(users).filter((k) => users[k] && users[k].name);
    if (!ids.length) {
      const empty = document.createElement('div');
      empty.className = 'sheet-empty';
      empty.textContent = 'لا يوجد أحد متصل الآن';
      onlineList.appendChild(empty);
      return;
    }
    ids.forEach((uid) => {
      const name = FRAuth.nameOf(uid, users[uid].name);
      const row = document.createElement('div');
      row.className = 'sheet-row';
      row.style.cursor = 'pointer';
      const left = document.createElement('div');
      left.className = 'sheet-row-left';
      const dot = document.createElement('span');
      dot.className = 'dot';
      const nm = document.createElement('span');
      nm.textContent = name;
      left.appendChild(dot);
      left.appendChild(FRAuth.mkAvatar(uid, name, 'sm'));
      left.appendChild(nm);
      row.appendChild(left);
      row.addEventListener('click', () => FRAuth.openCard(uid, row, name));
      onlineList.appendChild(row);
    });
  }

  onlineBtn.addEventListener('click', () => {
    if (onlineSheetBackdrop.style.display === 'flex') return;
    onlineSheetBackdrop.style.display = 'flex';
    FRNav.push('online', () => { onlineSheetBackdrop.style.display = 'none'; });
  });
  onlineSheetBackdrop.addEventListener('click', (e) => {
    if (e.target === onlineSheetBackdrop) FRNav.back('online');
  });

  // ========================================================
  // Typing indicator
  // ========================================================
  function setupTyping() {
    typingRef.on('value', (snap) => {
      const typers = snap.val() || {};
      const names = Object.keys(typers)
        .filter(uid => uid !== myUid)
        .map(uid => typers[uid] && typers[uid].name)
        .filter(Boolean);
      if (names.length === 0) {
        typingRow.classList.remove('show');
      } else {
        const label = names.length === 1 ? `${names[0]} يكتب` : `${names.slice(0,2).join('، ')} يكتبون`;
        typingNames.textContent = label;
        const wasNear = isNearBottom();
        typingRow.classList.add('show');
        if (wasNear) scrollToBottom();
      }
    });
  }

  function pingTyping() {
    if (!isConnected) return;
    const myTypingRef = typingRef.child(myUid);
    myTypingRef.set({ name: myName, ts: firebase.database.ServerValue.TIMESTAMP });
    clearTimeout(typingTimeoutLocal);
    typingTimeoutLocal = setTimeout(() => myTypingRef.remove(), 2500);
  }

  messageInput.addEventListener('input', () => {
    autoGrow();
    clearTimeout(typingDebounce);
    typingDebounce = setTimeout(pingTyping, 120);
  });

  function autoGrow() {
    const prev = messageInput.offsetHeight;
    messageInput.style.transition = 'none';
    messageInput.style.height = 'auto';
    const full = messageInput.scrollHeight, target = Math.min(full, 110);
    messageInput.style.overflowY = full > 110 ? 'auto' : 'hidden';
    if (prev) { messageInput.style.height = prev + 'px'; void messageInput.offsetHeight; }
    messageInput.style.transition = '';
    messageInput.style.height = target + 'px';
    if (prev && target !== prev && composerEl) {
      composerEl.classList.add('growing');
      document.documentElement.style.setProperty('--dock-h', (bottomDock.offsetHeight + (target - prev)) + 'px');
      if (pinnedToBottom) messagesWrap.scrollTop = messagesWrap.scrollHeight;
      clearTimeout(autoGrow._t); autoGrow._t = setTimeout(() => { composerEl.classList.remove('growing'); syncDock(); }, 450);
    }
    sendBtn.classList.toggle('empty', !messageInput.value.trim());
    updateComposerExpanded();
    scheduleDraft();
  }

  // ========================================================
  // Boot
  // ========================================================
  function bootChat(isFreshJoin) {
    FRNav.init(onRootBack);
    restoreDraft();
    if (!firebaseReady) {
      showSystemError('لا يمكن الاتصال بقاعدة البيانات. تحقق من إعدادات Firebase.');
      return;
    }
    messagesRef = db.ref('chat/messages');
    usersRef = db.ref('chat/presence');
    typingRef = db.ref('chat/typing');
    eventsRef = db.ref('chat/events');
    changesRef = db.ref('chat/changes');
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {} // ask the browser not to evict our data

    setupPresence();
    setupTyping();
    bootMessages();
    startReceipts();
    listenForEvents();
    initNotifications();

    if (isFreshJoin) {
      eventsRef.push({
        type: 'join',
        name: myName,
        senderUid: myUid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    }

  }

  // ========================================================
  // Offline-first messages
  //  - IndexedDB (FRStore) is what the screen is drawn from.
  //  - Firebase is asked only for what this device doesn't have:
  //      * new messages                  -> one query "timestamp >= last cursor"
  //      * edits / deletes / reactions   -> tiny "changes" feed (ids only), then 1 message read each
  //      * older history                 -> pages, only when scrolling up / idle backfill
  //  - Messages written offline wait in the outbox and are sent in order, once each.
  // ========================================================
  const Store = window.FRStore;
  const SV = () => firebase.database.ServerValue.TIMESTAMP;
  const WINDOW = 60, INITIAL = 100, PAGE = 200, UNREAD_CAP = 400;
  const outbox = new Map();        // key -> unsent message (mirrored in IndexedDB)
  const pendingKeys = new Set();
  const lastEvt = new Map();
  let changesRef = null;
  let historyFrom = 0, historyReady = false, syncLive = false, historyComplete = false;
  let scanOldest = null, loadingOlder = false;
  let msgCursor = 0, chgCursor = 0, serverOffset = 0, cursorTimer = null;
  let flushing = false, retryTimer = null, retryDelay = 2000, feedStarted = false, storageWarned = false, reactQuiet = false;
  window.FRNet = { connected: false, ready: false, pending: () => outbox.size };

  const tmo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'TIMEOUT' }), ms))]);
  const serverNow = () => Date.now() + serverOffset;
  const toRec = (k, d) => Object.assign({ k }, d);
  const cmpTK = (at, ak, bt, bk) => ((at - bt) || (ak < bk ? -1 : ak > bk ? 1 : 0));
  const OFFLINE_ERR = 'هذه العملية تتطلب اتصالًا بالإنترنت. اتصل ثم أعد المحاولة.';
  function requireOnline(onFail) {
    if (isConnected && firebaseReady) return true;
    if (onFail) onFail();
    showSystemError(OFFLINE_ERR);
    return false;
  }

  // Accounts created from now on carry `hf` (server time of joining, enforced by the rules): they never see older messages.
  // Older accounts have no `hf` -> 0 -> full history, exactly as before.
  async function getHistoryFrom() {
    let hf = myJoined || 0;
    try {
      if (navigator.onLine !== false) { // ask the server (the authority) instead of trusting a saved copy
        const s = await tmo(db.ref('users/' + myUid + '/hf').once('value'), 6000);
        const v = s.val(); hf = typeof v === 'number' ? v : 0;
        Store.setMeta('hf', hf);
      } else { const c = await Store.getMeta('hf'); if (typeof c === 'number') hf = c; }
    } catch (e) { const c = await Store.getMeta('hf'); if (typeof c === 'number') hf = c; }
    return hf;
  }

  async function bootMessages() {
    // 1) paint from the device immediately — no network involved
    lastRead = loadRead();
    loadMentions();
    firstOpen = !lastRead;
    let local;
    if (lastRead) { // around the last message the reader saw, plus everything after it
      const older = (await Store.before(lastRead.ts, lastRead.k, WINDOW)).reverse();
      const mid = await Store.get(lastRead.k);
      const newer = await Store.after(lastRead.ts, lastRead.k, UNREAD_CAP);
      local = older.concat(mid ? [mid] : [], newer);
    } else local = (await Store.recent(WINDOW)).reverse();
    local.forEach((m) => renderMessage(m.k, m, false));
    if (local.length) scanOldest = { ts: local[0].timestamp, k: local[0].k };
    // 2) messages still waiting to be sent
    (await Store.outboxAll()).forEach((r) => { outbox.set(r.k, r); pendingKeys.add(r.k); renderPending(r); });
    scrollToBottom();
    placeDivider();
    setTimeout(() => { bootHold = false; scheduleSeen(); }, 4000); // safety: never keep the reading position frozen
    historyComplete = !!(await Store.getMeta('histDone'));
    msgCursor = (await Store.getMeta('cursor')) || 0;
    chgCursor = (await Store.getMeta('chgCursor')) || 0;
    setTimeout(() => { if (!introStarted) onStableConnection(); }, 900);
    renderNetBar();
    let topTick = false, trimT = null;
    messagesWrap.addEventListener('scroll', () => {
      if (!topTick) { topTick = true; requestAnimationFrame(() => { topTick = false; if (messagesWrap.scrollTop < 400) loadOlder(); }); }
      clearTimeout(trimT); trimT = setTimeout(trimTop, 450);
      scheduleSeen();
    }, { passive: true });
    setTimeout(() => { if (messagesWrap.scrollHeight <= messagesWrap.clientHeight + 200) loadOlder(); }, 500);
    startRemoteSync();
    kickOutbox();
  }

  // ---------- rich text: @mentions, links, e-mail, phones, code ----------
  const Rich = window.FRRich || { render: (el, t) => { el.textContent = t; }, mentionsUser: () => false };
  const myLower = () => { const m = window.FRAuth && FRAuth.me && FRAuth.me(); return m && m.usernameLower ? m.usernameLower : ''; };
  function findUserByName(lower) {
    let hit = null;
    FRAuth.users.forEach((u, uid) => { if (!hit && u && u.usernameLower === lower) hit = { uid, name: u.displayName, username: u.username }; });
    return hit;
  }
  const richCtx = () => ({ findUser: findUserByName, me: myLower(), copy: (t) => copyText(t, 1, 'تم نسخ الكود') });
  function setMsgText(el, text) { Rich.render(el, text || '', richCtx()); }
  const mentionsMe = (text) => Rich.mentionsUser(text || '', myLower());

  // ---------- @mention suggestions (above the composer, never covering it) ----------
  let onlineIds = new Set(), mentionOpen = false, mentionTok = null, mentionList = [], mentionKey = '';
  const norm = (s) => String(s || '').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  function mentionQuery() {
    const v = messageInput.value, c = messageInput.selectionStart;
    if (c == null || v.indexOf('@') < 0) return null;
    const m = /(^|[\s(\[{«"'،؛:!?؟—\-])@([^\s@]{0,20})$/.exec(v.slice(0, c));
    return m ? { start: c - m[2].length - 1, end: c, q: m[2] } : null;
  }
  function mentionMatches(q) {
    const nq = norm(q).replace(/\s+/g, ''), out = [];
    FRAuth.users.forEach((u, uid) => {
      if (!u || uid === myUid || !u.username) return;
      const un = u.usernameLower || u.username.toLowerCase(), name = norm(u.displayName), words = name.split(/\s+/);
      let s = 0;
      if (!nq) s = 10;
      else if (un.startsWith(nq)) s = 100;
      else if (words.some((w) => w.startsWith(nq))) s = 92;
      else if (name.replace(/\s+/g, '').startsWith(nq)) s = 88;
      else if (un.indexOf(nq) >= 0) s = 60;
      else if (name.indexOf(nq) >= 0) s = 55;
      if (s) out.push({ uid, u, s: s + (onlineIds.has(uid) ? 3 : 0) });
    });
    out.sort((a, b) => b.s - a.s || String(a.u.displayName).localeCompare(String(b.u.displayName)));
    return out.slice(0, 8);
  }
  function renderMentions() {
    const tok = mentionQuery();
    if (!tok) { hideMentions(); return; }
    const list = mentionMatches(tok.q);
    if (!list.length) { hideMentions(); return; }
    mentionTok = tok;
    const key = list.map((m) => m.uid).join(',');
    if (key !== mentionKey) { // rebuild only when the suggestions really changed (avatars are costly to re-decode)
      mentionKey = key; mentionList = list;
      mentionPanel.textContent = '';
      list.forEach((m) => {
        const row = document.createElement('div'); row.className = 'mention-row';
        row.appendChild(FRAuth.mkAvatar(m.uid, m.u.displayName, 'sm'));
        const col = document.createElement('div'); col.className = 'mr-col';
        const nm = document.createElement('div'); nm.className = 'mr-name'; nm.textContent = m.u.displayName;
        const un = document.createElement('div'); un.className = 'mr-user'; un.textContent = '@' + m.u.username;
        col.appendChild(nm); col.appendChild(un); row.appendChild(col);
        row.addEventListener('pointerdown', (e) => e.preventDefault()); // keep the keyboard open
        row.addEventListener('click', () => pickMention(m));
        mentionPanel.appendChild(row);
      });
      mentionPanel.scrollTop = 0;
    }
    mentionOpen = true;
    mentionPanel.classList.add('show');
  }
  function hideMentions() { if (!mentionOpen) return; mentionOpen = false; mentionKey = ''; mentionPanel.classList.remove('show'); }
  function pickMention(m) {
    const tok = mentionTok; if (!tok) return;
    const v = messageInput.value, after = v.slice(tok.end);
    const ins = '@' + m.u.username + (/^\s/.test(after) ? '' : ' ');
    messageInput.value = v.slice(0, tok.start) + ins + after;
    const pos = tok.start + ins.length + (/^\s/.test(after) ? 1 : 0);
    messageInput.setSelectionRange(pos, pos);
    messageInput.focus({ preventScroll: true });
    autoGrow(); hideMentions();
  }
  messageInput.addEventListener('input', renderMentions);
  messageInput.addEventListener('click', renderMentions);
  messageInput.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') renderMentions(); });
  messageInput.addEventListener('blur', () => setTimeout(hideMentions, 150));

  // ---------- delivery / read receipts (✓ sent · ✓✓ delivered · cyan ✓✓ read) ----------
  // chat/receipts/<uid> = { d: newest message delivered to that device, r: newest message read }.
  // A message counts as delivered/read only when ALL active recipients have it; partial reads show a counter.
  const receipts = new Map();
  let rcptD = 0, rcptR = 0, sentD = 0, sentR = 0, rcptTimer = null, ticksTimer = null;
  function recipientsFor(T) {
    const now = serverNow(), out = [];
    receipts.forEach((r, uid) => {
      if (uid === myUid) return;
      const u = FRAuth.users.get(uid);
      if (!u) return;                                                    // deleted account
      if (u.hf && Number(u.hf) > T) return;                              // joined after this message: can never see it
      if (Math.max(r.d || 0, r.r || 0) < now - 14 * 864e5) return;      // dormant for 2 weeks: don't hold the ticks back
      out.push({ uid, d: r.d || 0, r: r.r || 0 });
    });
    return out;
  }
  function receiptState(T) {
    const l = recipientsFor(T); let dl = 0, rd = 0;
    l.forEach((x) => { if (x.d >= T || x.r >= T) dl++; if (x.r >= T) rd++; });
    let s = 'sent';
    if (l.length) { if (rd === l.length) s = 'read'; else if (rd > 0) s = 'part'; else if (dl === l.length) s = 'deliv'; }
    return { s, tot: l.length, dl, rd };
  }
  function tickGlyph() {
    const s = document.createElement('span'); s.className = 'tick'; s.dataset.s = 'sent';
    s.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path class="t1" d="M3.5 12.8l4 4L16 8.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path class="t2" d="M10.4 16.2l.8.8L21 8.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg><i class="cnt"></i>';
    return s;
  }
  function tickGlyphMenu() {
    const w = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    w.setAttribute('viewBox', '0 0 24 24'); w.setAttribute('width', '18'); w.setAttribute('height', '18');
    w.innerHTML = '<path d="M3.5 12.8l4 4L16 8.4M10.4 16.2l.8.8L21 8.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    return w;
  }
  function applyTick(row, data) {
    const t = row.querySelector('.msg-meta .tick'); if (!t) return;
    const st = receiptState(Number(data.timestamp) || 0);
    if (t.dataset.s !== st.s) { t.dataset.s = st.s; t.classList.remove('flip'); void t.offsetWidth; t.classList.add('flip'); }
    t.querySelector('.cnt').textContent = st.s === 'part' ? st.rd + '/' + st.tot : '';
  }
  function refreshTicks() { ticksTimer = null; allMessagesByKey.forEach((e) => { if (e.data.senderUid === myUid && !e.pending && !e.data.deleted) applyTick(e.el, e.data); }); }
  function scheduleTicks() { if (!ticksTimer) ticksTimer = setTimeout(refreshTicks, 250); }
  function startReceipts() {
    const r = db.ref('chat/receipts');
    const upd = (s) => {
      const v = s.val() || {};
      receipts.set(s.key, v);
      if (s.key === myUid) { sentD = Math.max(sentD, v.d || 0); sentR = Math.max(sentR, v.r || 0); }
      scheduleTicks();
    };
    r.on('child_added', upd); r.on('child_changed', upd);
  }
  function scheduleReceipts() { if (!rcptTimer) rcptTimer = setTimeout(pushReceipts, 2200); }
  function pushReceipts() {
    rcptTimer = null;
    if (!isConnected || !firebaseReady) return;
    const d = Math.max(rcptD, rcptR), up = {};
    if (d > sentD) up.d = d;
    if (rcptR > sentR) up.r = rcptR;
    if (!up.d && !up.r) return;
    db.ref('chat/receipts/' + myUid).update(up).then(() => { if (up.d) sentD = up.d; if (up.r) sentR = up.r; }).catch(() => {});
  }
  function showReceipts(key) {
    const e = allMessagesByKey.get(key); if (!e) return;
    const T = Number(e.data.timestamp) || 0, list = recipientsFor(T);
    const backdrop = document.createElement('div'); backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div'); sheet.className = 'sheet';
    const handle = document.createElement('div'); handle.className = 'sheet-handle';
    const h4 = document.createElement('h4'); h4.textContent = 'حالة الرسالة';
    sheet.appendChild(handle); sheet.appendChild(h4);
    const rd = list.filter((x) => x.r >= T), dl = list.filter((x) => x.d >= T && x.r < T);
    const sum = document.createElement('div'); sum.className = 'quick-hint';
    sum.textContent = (rd.length + dl.length) ? 'قرأها ' + rd.length + ' · استلمها ' + (rd.length + dl.length) + ' من أصل ' + list.length : 'لم تصل إلى أحد بعد.';
    sheet.appendChild(sum);
    [['قرأها', rd, 'read'], ['استلمها (ولم يقرأها بعد)', dl, 'deliv']].forEach(([title, arr, kind]) => {
      if (!arr.length) return;
      const h = document.createElement('div'); h.className = 'rc-h ' + kind; h.textContent = title + ' (' + arr.length + ')';
      sheet.appendChild(h);
      arr.forEach((x) => {
        const name = FRAuth.nameOf(x.uid, '');
        const row = document.createElement('div'); row.className = 'sheet-row'; row.style.cursor = 'pointer';
        const left = document.createElement('div'); left.className = 'sheet-row-left';
        const nm = document.createElement('span'); nm.textContent = name || 'مجهول';
        left.appendChild(FRAuth.mkAvatar(x.uid, name, 'sm')); left.appendChild(nm);
        const t = tickGlyph(); t.dataset.s = kind === 'read' ? 'read' : kind === 'deliv' ? 'deliv' : 'sent'; t.classList.add('big');
        row.appendChild(left); row.appendChild(t);
        row.addEventListener('click', () => FRAuth.openCard(x.uid, row, name));
        sheet.appendChild(row);
      });
    });
    backdrop.appendChild(sheet);
    backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) FRNav.back('sheet'); });
    document.body.appendChild(backdrop);
    FRNav.push('sheet', () => backdrop.remove());
  }

  // ---------- reading position, unread divider, mention button ----------
  const unread = new Set(), unreadMentions = new Set();
  let lastRead = null, unreadSep = null, sepFadeT = null, firstOpen = false, bootHold = true, bootAlign = true, alignT = null, seenT = null;
  function loadRead() {
    try { const v = localStorage.getItem(LS_READ_KEY + myUid); if (v) { const i = v.indexOf('|'); return { ts: Number(v.slice(0, i)), k: v.slice(i + 1) }; } } catch (e) {}
    return null;
  }
  const LS_MEN_KEY = 'otaku_unread_men_v1_', menSince = new Map();
  function loadMentions() { try { JSON.parse(localStorage.getItem(LS_MEN_KEY + myUid) || '[]').forEach((k) => unreadMentions.add(k)); } catch (e) {} }
  function saveMentions() { try { localStorage.setItem(LS_MEN_KEY + myUid, JSON.stringify(Array.from(unreadMentions).slice(-150))); } catch (e) {} }
  // a mention counts as read only after its message stayed fully visible for ~0.7s (like Telegram)
  function checkMentionsSeen() {
    if (!unreadMentions.size) return;
    const lim = bottomDock.getBoundingClientRect().top - 8, top = messagesWrap.getBoundingClientRect().top + 8, now = Date.now();
    let waiting = false, changed = false;
    unreadMentions.forEach((k) => {
      const e = allMessagesByKey.get(k); let vis = false;
      if (e) {
        const r = e.el.getBoundingClientRect(), vh = Math.min(r.bottom, lim) - Math.max(r.top, top);
        vis = vh >= Math.min((r.height || 1) * 0.7, (lim - top) * 0.6);
      }
      if (vis) { const s = menSince.get(k) || now; menSince.set(k, s); if (now - s >= 700) { unreadMentions.delete(k); menSince.delete(k); changed = true; } else waiting = true; }
      else menSince.delete(k);
    });
    if (changed) { saveMentions(); updateUnreadUI(); }
    if (waiting) setTimeout(scheduleSeen, 260);
  }
  function saveRead() { try { localStorage.setItem(LS_READ_KEY + myUid, lastRead.ts + '|' + lastRead.k); } catch (e) {} }
  function trackUnread(key, data) {
    if (!lastRead || data.pending || data.deleted || data.senderUid === myUid) return;
    if (cmpTK(Number(data.timestamp) || 0, key, lastRead.ts, lastRead.k) <= 0) return;
    unread.add(key);
    if (mentionsMe(data.text) && !unreadMentions.has(key)) { unreadMentions.add(key); saveMentions(); }
  }
  function markRead(ts, k) {
    if (lastRead && cmpTK(ts, k, lastRead.ts, lastRead.k) <= 0) return;
    lastRead = { ts, k }; saveRead();
    unread.forEach((key) => { const e = allMessagesByKey.get(key); if (!e || cmpTK(Number(e.data.timestamp) || 0, key, ts, k) <= 0) unread.delete(key); }); // mentions are NOT cleared by scrolling past them
    updateUnreadUI();
    rcptR = Math.max(rcptR, ts); scheduleReceipts();
  }
  function markNewestRead() {
    const rows = messagesList.children;
    for (let i = rows.length - 1; i >= 0; i--) { const el = rows[i]; if (el.classList.contains('msg-row') && !el.dataset.pend) { markRead(Number(el.dataset.ts) || 0, el.dataset.key); return; } }
  }
  function scheduleSeen() { if (!seenT) seenT = setTimeout(checkSeen, 180); }
  function checkSeen() { // the newest message whose top is on screen has been read
    seenT = null;
    if (document.visibilityState !== 'visible' || bootHold) return;
    const sp = document.getElementById('settingsPanel');
    if (sp && sp.classList.contains('open')) return;
    checkMentionsSeen();
    if (!unread.size && !firstOpen) return;
    const lim = bottomDock.getBoundingClientRect().top - 20, top = messagesWrap.getBoundingClientRect().top;
    const rows = messagesList.children;
    for (let i = rows.length - 1; i >= 0; i--) {
      const el = rows[i];
      if (!el.classList.contains('msg-row') || el.dataset.pend) continue;
      const r = el.getBoundingClientRect();
      if (r.top < lim && r.bottom > top) { markRead(Number(el.dataset.ts) || 0, el.dataset.key); return; }
    }
  }
  function placeDivider() {
    if (!unread.size) return;
    let row = null;
    for (const el of messagesList.children) { if (el.classList.contains('msg-row') && unread.has(el.dataset.key)) { row = el; break; } }
    if (!row) return;
    if (!unreadSep) { unreadSep = document.createElement('div'); unreadSep.className = 'unread-sep'; unreadSep.appendChild(document.createElement('span')); }
    const nx = unreadSep.nextElementSibling;
    if (!(nx === row || (nx && nx.classList.contains('date-sep') && nx.nextElementSibling === row))) { messagesList.insertBefore(unreadSep, row); scheduleRegroup(); }
    updateUnreadUI();
    if (bootAlign) { clearTimeout(alignT); alignT = setTimeout(alignToDivider, 260); }
  }
  function updateUnreadUI() {
    const n = unread.size;
    updateJumpBtn();
    if (unreadSep) {
      if (n) {
        unreadSep.firstChild.textContent = n + (n === 1 ? ' رسالة جديدة' : ' رسائل جديدة');
        unreadSep.classList.remove('gone'); clearTimeout(sepFadeT); sepFadeT = null;
      } else if (!sepFadeT) {
        sepFadeT = setTimeout(() => { // fully read: fade the divider out gently
          sepFadeT = null; const s = unreadSep; if (!s) return;
          s.classList.add('gone'); setTimeout(() => { s.remove(); if (unreadSep === s) unreadSep = null; }, 600);
        }, 1600);
      }
    }
    const m = unreadMentions.size;
    mentionBadge.textContent = m > 9 ? '9+' : String(m);
    mentionBadge.style.display = m > 1 ? 'flex' : 'none';
    mentionBtn.classList.toggle('show', m > 0);
  }
  function smoothScrollToY(y, dur) {
    cancelSmooth();
    const from = messagesWrap.scrollTop, dist = y - from;
    if (Math.abs(dist) < 4) return;
    const t0 = performance.now(), ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      messagesWrap.scrollTop = from + dist * ease(t);
      smoothRaf = t < 1 ? requestAnimationFrame(step) : null;
    };
    smoothRaf = requestAnimationFrame(step);
  }
  function alignToDivider() { // returning after a while: open where the reader stopped, new messages start below
    alignT = null;
    if (!bootAlign || !unreadSep || !unreadSep.isConnected) { return; }
    bootAlign = false;
    const wr = messagesWrap.getBoundingClientRect(), dr = unreadSep.getBoundingClientRect();
    pinnedToBottom = false; kbHold = 0;
    smoothScrollToY(Math.max(0, messagesWrap.scrollTop + (dr.top - wr.top) - Math.round(wr.height * 0.28)), 500);
    setTimeout(() => { bootHold = false; scheduleSeen(); }, 700);
  }
  ['touchstart', 'wheel', 'pointerdown'].forEach((ev) => messagesWrap.addEventListener(ev, () => { if (bootAlign || bootHold) { bootAlign = false; bootHold = false; } }, { passive: true }));
  mentionBtn.addEventListener('click', () => { // go to the oldest mention you haven't seen (push keys are time-ordered)
    let bk = null;
    unreadMentions.forEach((k) => { if (bk === null || k < bk) bk = k; });
    if (bk) jumpToMessage(bk);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSeen(); });

  // ---------- remote -> device ----------
  let remoteQuery = null, healTries = 0, deniedShown = false;
  function attachRemote(firstRun) {
    let q = messagesRef.orderByChild('timestamp');
    q = firstRun ? q.startAt(historyFrom).limitToLast(INITIAL) : q.startAt(Math.max(msgCursor, historyFrom));
    remoteQuery = q;
    q.on('child_added', queueRemote, onReadDenied);
    q.on('child_changed', queueRemote, onReadDenied);
    q.once('value', () => {
      syncLive = true;
      setTimeout(() => {
        if (firstOpen) { firstOpen = false; markNewestRead(); }          // first time on this device: everything counts as read
        if (bootAlign && !unreadSep) { bootAlign = false; bootHold = false; scheduleSeen(); } // nothing new: no frozen position
      }, 900);
    });
  }
  function onReadDenied(err) { // the rules refused this query: re-read the join time from the server and retry
    console.warn('messages read refused', err && err.message);
    if (healTries < 2) {
      healTries++;
      setTimeout(async () => {
        try { if (remoteQuery) remoteQuery.off(); } catch (e) {}
        historyFrom = await getHistoryFrom();
        attachRemote(!msgCursor);
      }, 700);
    } else if (!deniedShown) {
      deniedShown = true;
      showToast('تعذر قراءة الرسائل بسبب الصلاحيات. حدّث الصفحة أو أعد تسجيل الدخول.', null, null, true, 8000);
    }
  }
  async function startRemoteSync() {
    historyFrom = await getHistoryFrom();
    historyReady = true;
    attachRemote(!msgCursor);
    if (isConnected) startChangesFeed();
  }

  let remoteQ = [], remoteTimer = null;
  function queueRemote(snap) {
    const d = snap.val();
    if (!d || !d.timestamp) return;
    const k = snap.key;
    if (pendingKeys.has(k)) return;            // my own unsent/in-flight message: confirmed by the outbox
    lastEvt.set(k, Date.now());
    if (d.senderUid !== myUid) { rcptD = Math.max(rcptD, Number(d.timestamp) || 0); scheduleReceipts(); }
    if (lastEvt.size > 600) { const old = Date.now() - 20000; lastEvt.forEach((v, key) => { if (v < old) lastEvt.delete(key); }); }
    remoteQ.push({ rec: toRec(k, d), live: syncLive });
    if (!remoteTimer) remoteTimer = setTimeout(flushRemote, 16);
  }
  async function flushRemote() {
    remoteTimer = null;
    let batch = remoteQ; remoteQ = [];
    if (!batch.length) return;
    // messages already on screen: show the change immediately, save it afterwards
    const rest = [];
    batch.forEach((b) => {
      const kn = allMessagesByKey.get(b.rec.k);
      if (kn && !kn.pending && !kn.data.deleted) {
        msgCursor = Math.max(msgCursor, Number(b.rec.timestamp) || 0);
        applyUpsert({ next: b.rec }, b.live);
        Store.upsertMany([b.rec]);
      } else rest.push(b);
    });
    batch = rest;
    if (!batch.length) { persistCursors(); return; }
    const res = await Store.upsertMany(batch.map((b) => b.rec));
    res.forEach((r, i) => {
      if (!r) return;
      msgCursor = Math.max(msgCursor, Number(r.next.timestamp) || 0);
      applyUpsert(r, batch[i].live);
    });
    persistCursors();
    if (Store.failed && !storageWarned) {
      storageWarned = true;
      showToast('مساحة التخزين على الجهاز ممتلئة، لن تُحفظ الرسائل الجديدة محليًا لكنها تبقى في الخادم.', null, null, true, 6000);
    }
  }
  function persistCursors() {
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => { Store.setMeta('cursor', msgCursor); Store.setMeta('chgCursor', chgCursor); }, 1200);
  }

  function applyUpsert(r, live) {
    const next = r.next, k = next.k;
    const known = allMessagesByKey.get(k);
    if (known) {
      if (known.pending) { confirmPending(k, next); return; }
      reactQuiet = !live;
      updateExistingMessage(k, next);
      if (next.deleted && unreadMentions.delete(k)) { saveMentions(); updateUnreadUI(); }
      updateReactionsUI(k, reactMap(next.react));
      reactQuiet = false;
      return;
    }
    if (scanOldest && cmpTK(Number(next.timestamp) || 0, k, scanOldest.ts, scanOldest.k) < 0) return; // older than what's on screen
    renderMessage(k, next, live);
    if (!allMessagesByKey.has(k)) return; // hidden on this device
    const mine = next.senderUid === myUid;
    if (mine) scrollToBottomIfNear(true);
    else if (!live && lastRead && !firstOpen) { /* catch-up after being away: stay at the reading position */ }
    else scrollToBottomIfNear(!live);
    if (live && !mine) handleIncomingForSound(next);
    if (!mine && unread.has(k) && (document.hidden || !isNearBottom() || !live)) placeDivider();
    scheduleSeen();
  }

  // ---------- changes feed: edits / deletes / reactions that happened while we weren't looking ----------
  function startChangesFeed() {
    if (feedStarted || !historyReady || !firebaseReady) return;
    feedStarted = true;
    if (!chgCursor) chgCursor = serverNow() - 60000;
    changesRef.orderByChild('ts').startAt(Math.max(chgCursor, historyFrom)).on('child_added', (s) => onChange(s.val()));
  }
  const chgQ = new Set(); let chgTimer = null;
  function onChange(c) {
    if (!c || !c.k) return;
    if (c.ts > chgCursor) { chgCursor = c.ts; persistCursors(); }
    if (c.by === myUid) return;                                                // my own changes are applied locally
    if (lastEvt.has(c.k) && Date.now() - lastEvt.get(c.k) < 4000) return;     // already delivered live
    chgQ.add(c.k);
    if (!chgTimer) chgTimer = setTimeout(runChanges, 150);
  }
  async function runChanges() {
    chgTimer = null;
    const keys = Array.from(chgQ); chgQ.clear();
    for (let i = 0; i < keys.length; i += 5) {
      await Promise.all(keys.slice(i, i + 5).map(async (k) => {
        if (!(await Store.get(k))) return;           // not on this device -> a later download will already include the change
        try { const s = await tmo(messagesRef.child(k).once('value'), 15000); const d = s.val(); if (d) queueRemote({ key: k, val: () => d }); } catch (e) {}
      }));
    }
  }

  // ---------- older history (from the device first, then Firebase in pages) ----------
  let olderDone = false, olderTryAt = 0;
  // Keeps the page light: after the reader comes back to the bottom, rows far above are dropped
  // from the DOM (they stay in IndexedDB and are re-added when scrolling up again).
  function trimTop() {
    if (!isNearBottom()) return;
    const rows = messagesList.querySelectorAll(':scope > .msg-row');
    if (rows.length <= 280) return;
    const drop = rows.length - 160, dist = messagesWrap.scrollHeight - messagesWrap.scrollTop;
    for (let i = 0; i < drop; i++) { allMessagesByKey.delete(rows[i].dataset.key); rows[i].remove(); }
    scanOldest = { ts: Number(rows[drop].dataset.ts) || 0, k: rows[drop].dataset.key };
    olderDone = false;
    scheduleRegroup();
    messagesWrap.scrollTop = messagesWrap.scrollHeight - dist;
  }
  async function loadOlder() {
    if (loadingOlder || !scanOldest || olderDone || Date.now() < olderTryAt) return;
    loadingOlder = true;
    try {
      for (let n = 0; n < 6; n++) {
        if (clearedBefore && scanOldest.ts <= clearedBefore) break;
        let batch = await Store.before(scanOldest.ts, scanOldest.k, WINDOW);
        if (!batch.length && !historyComplete) batch = await fetchOlderPage();
        if (!batch.length) { if (historyComplete) olderDone = true; else olderTryAt = Date.now() + 1500; break; }
        const before = allMessagesByKey.size;
        prependBatch(batch);
        if (allMessagesByKey.size > before) break; // something visible was added
      }
    } finally { loadingOlder = false; }
  }
  function prependBatch(batch) { // batch: newest first
    const prevH = messagesWrap.scrollHeight, prevTop = messagesWrap.scrollTop;
    batch.forEach((m) => renderMessage(m.k, m, false, true));
    const last = batch[batch.length - 1];
    if (last && (!scanOldest || cmpTK(last.timestamp, last.k, scanOldest.ts, scanOldest.k) < 0)) scanOldest = { ts: last.timestamp, k: last.k };
    requestAnimationFrame(() => { messagesWrap.scrollTop = prevTop + (messagesWrap.scrollHeight - prevH); });
  }
  async function fetchOlderPage() {
    if (!isConnected || !firebaseReady || !historyReady) return [];
    const oldest = await Store.oldest();
    if (!oldest) return [];
    let s;
    try { s = await tmo(messagesRef.orderByChild('timestamp').startAt(historyFrom).endAt(oldest.timestamp).limitToLast(PAGE).once('value'), 20000); } catch (e) { return []; }
    const recs = [];
    s.forEach((c) => { const d = c.val(); if (d && d.timestamp) recs.push(toRec(c.key, d)); });
    if (recs.length < PAGE) { historyComplete = true; Store.setMeta('histDone', true); }
    const res = await Store.upsertMany(recs);
    return res.map((r) => r.next).filter((m) => cmpTK(m.timestamp, m.k, oldest.timestamp, oldest.k) < 0).sort((a, b) => cmpTK(b.timestamp, b.k, a.timestamp, a.k));
  }
  let backfilling = false;
  function backfillSoon() { if (!backfilling && !historyComplete) setTimeout(backfillLoop, 4000); }
  async function backfillLoop() { // quietly completes the local copy of the history, one page at a time
    if (backfilling) return;
    backfilling = true;
    try {
      while (!historyComplete && isConnected && document.visibilityState === 'visible') {
        const page = await fetchOlderPage();
        if (!page.length) break;
        await new Promise((r) => setTimeout(r, 1200));
      }
    } finally { backfilling = false; }
  }
  async function ensureRendered(key) { // for reply-quote jumps to messages above the rendered window
    const m = await Store.get(key);
    if (!m || !scanOldest) return false;
    const asc = await Store.between(m.timestamp, scanOldest.ts, scanOldest.k, 1500);
    if (asc.length) prependBatch(asc.reverse());
    return allMessagesByKey.has(key);
  }

  // ---------- device -> Firebase: the outbox ----------
  function pendingData(r) {
    return { text: r.text, senderUid: r.senderUid, senderName: r.senderName, timestamp: r.created, replyTo: r.replyTo, pending: true, state: r.state };
  }
  function renderPending(r) { renderMessage(r.k, pendingData(r), true); }

  async function queueMessage(text) {
    const k = db.ref('chat/messages').push().key; // generated on the device: unique, time-ordered, works offline
    const rec = { k, text, senderUid: myUid, senderName: myName, created: Date.now(), state: 'pending', tries: 0 };
    if (activeReply) rec.replyTo = { key: activeReply.key, sender: activeReply.sender, text: activeReply.text.slice(0, 120) };
    cancelReply();
    outbox.set(k, rec); pendingKeys.add(k);
    renderPending(rec);
    scrollToBottom();
    playSound('send');
    sendBtn.classList.remove('pop');
    void sendBtn.offsetWidth;
    sendBtn.classList.add('pop');
    if (navigator.vibrate) navigator.vibrate(30);
    renderNetBar();
    try { await Store.outboxPut(rec); } catch (e) {}
    if (Store.failed && !storageWarned) { storageWarned = true; showToast('تعذر حفظ الرسالة على الجهاز، ستُرسل ما دمت داخل الموقع.', null, null, true, 5000); }
    if (!isConnected) registerBgSync();
    kickOutbox();
  }

  function nextPending() {
    let best = null;
    outbox.forEach((r) => { if (r.state === 'pending' && (!best || r.k < best.k)) best = r; });
    return best;
  }
  function kickOutbox() { flushOutbox().catch(() => {}); }
  async function flushOutbox() {
    if (flushing) return;
    flushing = true; renderNetBar();
    try {
      while (isConnected && firebaseReady) {
        const rec = nextPending();
        if (!rec) break;
        const out = await sendOne(rec);
        if (out === 'retry') { clearTimeout(retryTimer); retryTimer = setTimeout(kickOutbox, retryDelay); retryDelay = Math.min(retryDelay * 2, 30000); break; }
      }
    } finally { flushing = false; renderNetBar(); }
  }
  async function sendOne(rec) {
    const ref = db.ref('chat/messages/' + rec.k);
    try {
      const payload = { text: rec.text, senderUid: rec.senderUid, senderName: rec.senderName, timestamp: SV() };
      if (rec.replyTo) payload.replyTo = rec.replyTo;
      await tmo(ref.set(payload), 15000);
      const s = await tmo(ref.once('value'), 10000); // answered from the local cache
      return await confirmSent(rec, s.val() || Object.assign({}, payload, { timestamp: serverNow() }));
    } catch (e) {
      if (e && e.code === 'PERMISSION_DENIED') {
        // same key written twice is refused by the rules -> it may simply have been delivered earlier
        let s = null;
        try { s = await tmo(ref.once('value'), 10000); } catch (e2) { if (!(e2 && e2.code === 'PERMISSION_DENIED')) return 'retry'; }
        if (s && s.exists()) return await confirmSent(rec, s.val());
        rec.tries = (rec.tries || 0) + 1;
        if (rec.tries >= 2) { markFailed(rec); return 'failed'; }
        return 'retry';
      }
      return 'retry'; // timeout / network: try again later (never blindly re-posted: same key)
    }
  }
  async function confirmSent(rec, data) {
    const k = rec.k, full = toRec(k, data);
    outbox.delete(k); pendingKeys.delete(k);
    Store.outboxDel(k);
    const r = await Store.upsertMany([full]);
    confirmPending(k, (r[0] && r[0].next) || full);
    notifyServer(k);
    retryDelay = 2000;
    renderNetBar();
    return 'sent';
  }
  function markFailed(rec) {
    rec.state = 'failed'; Store.outboxPut(rec);
    const e = allMessagesByKey.get(rec.k);
    if (e) { e.el.classList.add('failed'); setMetaState(e.el, true); }
  }
  function retryPending(k) {
    const rec = outbox.get(k); if (!rec) return;
    rec.state = 'pending'; rec.tries = 0; Store.outboxPut(rec);
    const e = allMessagesByKey.get(k);
    if (e) { e.el.classList.remove('failed'); setMetaState(e.el, false); }
    kickOutbox();
  }
  function discardPending(k) {
    outbox.delete(k); pendingKeys.delete(k); Store.outboxDel(k);
    const e = allMessagesByKey.get(k);
    if (e) { vanishRow(e.el); allMessagesByKey.delete(k); }
    renderNetBar();
  }
  function openPendingSheet(k) {
    const r = outbox.get(k); if (!r) return;
    const acts = [];
    if (r.state === 'failed') acts.push({ label: 'إعادة المحاولة', onClick: () => retryPending(k) });
    acts.push({ label: 'إلغاء الإرسال', desc: 'حذف هذه الرسالة التي لم تُرسل', danger: true, onClick: () => discardPending(k) });
    openActionSheet(r.state === 'failed' ? 'تعذر إرسال الرسالة' : 'الرسالة بانتظار الإرسال', r.state === 'failed' ? '' : 'ستُرسل تلقائيًا عند توفر الاتصال.', acts);
  }

  // the unsent row becomes a normal message: clock fades into the time, gestures attach
  function confirmPending(k, data) {
    const entry = allMessagesByKey.get(k);
    if (!entry) { renderMessage(k, data, true); return; }
    const row = entry.el;
    entry.data = data; entry.pending = false;
    row.classList.remove('pending', 'failed');
    delete row.dataset.pend;
    row.dataset.ts = data.timestamp || 0; row.dataset.sk = '0';
    const meta = row.querySelector('.msg-meta');
    if (meta) { meta.textContent = formatTime(data.timestamp); meta.appendChild(tickGlyph()); meta.classList.remove('state-in'); void meta.offsetWidth; meta.classList.add('state-in'); }
    attachGestures(row, row.querySelector('.msg-bubble-shell'), row.querySelector('.reply-swipe-icon'), k, data, true);
    applyTick(row, data);
    const prev = row.previousElementSibling && row.previousElementSibling.classList.contains('msg-row') ? row.previousElementSibling : null;
    const nxt = row.nextElementSibling && row.nextElementSibling.classList.contains('msg-row') ? row.nextElementSibling : null;
    if ((prev && cmpRow(prev, row) > 0) || (nxt && cmpRow(row, nxt) > 0)) { row.remove(); placeRow(row, data, false); }
    scheduleRegroup();
  }

  // background sending when the page is closed / offline
  function registerBgSync() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => reg.sync && reg.sync.register('fr-outbox')).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && outbox.size) registerBgSync(); });
  window.addEventListener('pagehide', () => { if (outbox.size) registerBgSync(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'outbox-sent' && m.key && outbox.has(m.key)) confirmSent(outbox.get(m.key), m.data);
  });
  window.addEventListener('online', () => { renderNetBar(); kickOutbox(); });
  window.addEventListener('offline', renderNetBar);

  // ---------- writes that must reach the server: edit / delete / reaction (+ a changes-feed record) ----------
  function writeChange(type, key, updates) {
    const withFeed = Object.assign({}, updates);
    withFeed['chat/changes/' + db.ref('chat/changes').push().key] = { k: key, t: type, ts: SV(), by: myUid };
    return db.ref().update(withFeed).catch((e) => {
      if (e && e.code === 'PERMISSION_DENIED') return db.ref().update(updates); // rules without the feed deployed yet
      throw e;
    });
  }
  async function localPatch(key, fn) {
    const entry = allMessagesByKey.get(key);
    let rec = entry ? Object.assign({ k: key }, entry.data) : await Store.get(key);
    if (!rec) return;
    rec = fn(rec) || rec;
    const r = await Store.upsertMany([rec]);
    applyUpsert({ next: r[0] ? r[0].next : rec }, true);
  }

  // ---------- connection bar ----------
  let netOffAt = 0, netTimer = null, wasOffline = false, restoredTimer = null;
  function setNetBar(state, text) { netBar.dataset.state = state; if (text) netBarText.textContent = text; }
  function renderNetBar() {
    if (!netBar) return;
    clearTimeout(netTimer);
    const down = !(isConnected && firebaseReady);
    if (down && !netOffAt) netOffAt = Date.now();
    if (!down) netOffAt = 0;
    const n = outbox.size;
    if (down) {
      const hard = navigator.onLine === false || Date.now() - netOffAt > 1200; // don't flash for tiny blips
      if (!hard) { netTimer = setTimeout(renderNetBar, 1250 - (Date.now() - netOffAt)); return; }
      wasOffline = true; clearTimeout(restoredTimer);
      setNetBar('off', n ? 'غير متصل · ' + n + (n === 1 ? ' رسالة بانتظار الإرسال' : ' رسائل بانتظار الإرسال') : 'غير متصل · يمكنك قراءة الرسائل المحفوظة');
      return;
    }
    if (n || flushing) { clearTimeout(restoredTimer); setNetBar('sync', n ? 'جارٍ إرسال ' + n + (n === 1 ? ' رسالة' : ' رسائل') + '...' : 'جارٍ المزامنة...'); return; }
    if (wasOffline) {
      wasOffline = false; setNetBar('ok', 'عاد الاتصال');
      clearTimeout(restoredTimer); restoredTimer = setTimeout(() => { if (netBar.dataset.state === 'ok') setNetBar('', ''); }, 1800);
      return;
    }
    if (netBar.dataset.state !== 'ok') setNetBar('', '');
  }

  // ========================================================
  // System events (join notices) — broadcast to everyone live
  // ========================================================
  function listenForEvents() {
    let eventsSyncStarted = false;
    const liveQuery = eventsRef.limitToLast(20);
    liveQuery.on('child_added', (snap) => {
      if (!eventsSyncStarted) return; // skip historical replay on load
      const data = snap.val();
      if (!data || data.type !== 'join' || !data.name) return;
      if (data.senderUid === myUid) return; // never announce my own join to myself
      addSystemLine(`${data.name} انضم إلى الدردشة`);
    });
    eventsRef.limitToLast(20).once('value', () => { eventsSyncStarted = true; });
  }

  function addSystemLine(text) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.textContent = text;
    messagesList.appendChild(div);
    scrollToBottomIfNear(false);
  }

  function showSystemError(text) { showToast(text, null, null, true); }

  function scrollToBottom() {
    requestAnimationFrame(() => { messagesWrap.scrollTop = messagesWrap.scrollHeight; });
    unseenNewCount = 0;
    updateJumpBtn();
  }
  function isNearBottom() {
    const threshold = 140;
    return messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight < threshold;
  }
  // Auto-scroll only if the user is already at/near the bottom. Otherwise
  // (they're reading older messages) leave their scroll position alone and
  // surface the jump-to-bottom button with an unseen-count badge instead.
  function scrollToBottomIfNear(force) {
    if (force) { scrollToBottom(); return; }
    if (isNearBottom()) {
      scrollToBottom();
    } else {
      jumpBottomBtn.classList.add('show');
      updateJumpBtn();
    }
  }
  function updateJumpBtn() {
    if (unread.size > 0) {
      jumpBottomBadge.textContent = unread.size > 9 ? '9+' : String(unread.size);
      jumpBottomBadge.style.display = 'flex';
    } else {
      jumpBottomBadge.style.display = 'none';
    }
  }
  let smoothRaf = null;
  function cancelSmooth() { if (smoothRaf) { cancelAnimationFrame(smoothRaf); smoothRaf = null; } }
  function smoothScrollToBottom() {
    cancelSmooth();
    unseenNewCount = 0; updateJumpBtn();
    const from = messagesWrap.scrollTop;
    const dist = messagesWrap.scrollHeight - messagesWrap.clientHeight - from;
    if (dist < 4) return;
    const dur = Math.min(1100, Math.max(420, 280 + Math.sqrt(dist) * 22));
    const t0 = performance.now();
    const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const target = messagesWrap.scrollHeight - messagesWrap.clientHeight;
      messagesWrap.scrollTop = from + (target - from) * ease(t);
      if (t < 1) smoothRaf = requestAnimationFrame(step);
      else { smoothRaf = null; messagesWrap.scrollTop = messagesWrap.scrollHeight; }
    };
    smoothRaf = requestAnimationFrame(step);
  }
  jumpBottomBtn.addEventListener('click', smoothScrollToBottom);
  ['touchstart', 'wheel', 'pointerdown'].forEach((ev) => messagesWrap.addEventListener(ev, cancelSmooth, { passive: true }));

  // Stay pinned to the newest message when the chat area changes size
  // (keyboard opens, reply bar appears, banner closes) - but only if the
  // reader was already at the bottom.
  let pinnedToBottom = true, kbHold = 0;
  // After the keyboard opens/closes (or the viewport changes) keep the newest message in view
  function stickBottomSoon() {
    if (!pinnedToBottom && Date.now() >= kbHold) return;
    [0, 100, 250, 450, 700].forEach((ms) => setTimeout(() => {
      if (pinnedToBottom || Date.now() < kbHold) messagesWrap.scrollTop = messagesWrap.scrollHeight;
    }, ms));
  }
  messagesWrap.addEventListener('scroll', () => { pinnedToBottom = isNearBottom() || Date.now() < kbHold; }, { passive: true });
  if (window.ResizeObserver) {
    new ResizeObserver(() => { if (pinnedToBottom) messagesWrap.scrollTop = messagesWrap.scrollHeight; }).observe(messagesWrap);
  }
  // The composer area floats over the chat (messages scroll beneath the glass);
  // keep the chat's bottom padding equal to its height.
  const syncDock = () => {
    if (document.querySelector('.composer.growing')) return; // the final height was reserved at the start of the animation
    document.documentElement.style.setProperty('--dock-h', bottomDock.offsetHeight + 'px');
    if (pinnedToBottom) messagesWrap.scrollTop = messagesWrap.scrollHeight;
  };
  if (window.ResizeObserver) new ResizeObserver(syncDock).observe(bottomDock);
  syncDock();
  messagesWrap.addEventListener('scroll', () => {
    if (isNearBottom()) {
      jumpBottomBtn.classList.remove('show');
      unseenNewCount = 0;
      updateJumpBtn();
    } else {
      jumpBottomBtn.classList.add('show');
    }
  });

  // ========================================================
  // Rendering a message row
  // ========================================================
  function dayLabel(ts) {
    const d = new Date(ts), n = new Date();
    const sd = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((sd(n) - sd(d)) / 864e5);
    if (diff === 0) return 'اليوم';
    if (diff === 1) return 'أمس';
    if (diff > 1 && diff < 7) return d.toLocaleDateString('ar-u-nu-latn', { weekday: 'long' });
    return d.toLocaleDateString('ar-u-nu-latn', d.getFullYear() === n.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function renderMessage(key, data, isNew, prepend) {
    if (!data) return;
    if (isHiddenLocal(key, data)) return; // cleared / deleted on this device onl                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           