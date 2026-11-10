/* =========================================================
   Otaku Chat — App logic (v2)
   Single public room. Persistent identity. Instant realtime
   sync. Swipe/long-press reply. Context menu (reply/delete).
   Soft delete. Online list. Paginated history.
   ========================================================= */

(() => {
  'use strict';

  // ---------- Config ----------
  const firebaseConfig = {
    apiKey: "AIzaSyDTVX_LM8wtrgAGgCzFAOVb5AV5d_ieI9k",
    authDomain: "otaku2-e2764.firebaseapp.com",
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

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const nameOverlay = $('nameOverlay');
  const nameInput = $('nameInput');
  const joinBtn = $('joinBtn');
  const nameErr = $('nameErr');

  const brandIntro = $('brandIntro');
  const brandIntroText = $('brandIntroText');

  const messagesWrap = $('messagesWrap');
  const messagesList = $('messagesList');
  const welcomeCard = $('welcomeCard');
  const loadMoreRow = $('loadMoreRow');
  const loadMoreBtn = $('loadMoreBtn');

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
  // Brand intro animation: "Hi!" -> "Nice to see you" -> "Otaku Chat"
  // ========================================================
  function playBrandIntro() {
    const sequence = ['Hi', 'Nice to see you'];
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
          setTimeout(next, 2000);
        } else {
          brandIntroText.textContent = 'ᠻ𝘳𝓲ꫀꪀᦔ𝘴' + ' 𝘳ꪮꪮꪑ';
          brandIntroText.classList.add('final', 'anim-in');
        }
      }, 380);
    }
    setTimeout(next, 2000);
  }

  // ========================================================
  // Name modal flow
  // ========================================================
  function showNameOverlay() {
    nameOverlay.style.display = 'flex';
    setTimeout(() => nameInput.focus(), 250);
  }
  function hideNameOverlay() { nameOverlay.style.display = 'none'; }

  function attemptJoin() {
    const name = sanitizeName(nameInput.value);
    if (name.length < 2) {
      nameErr.textContent = 'الرجاء إدخال اسم صحيح (حرفين على الأقل)';
      return;
    }
    saveName(name);
    hideNameOverlay();
    bootChat(true);
  }

  joinBtn.addEventListener('click', attemptJoin);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); attemptJoin(); }
  });

  // ========================================================
  // Connection + presence
  // ========================================================
  function updateConnectionUI() {
    if (isConnected && firebaseReady) {
      statusDot.classList.remove('off');
      sendBtn.disabled = false;
    } else {
      statusDot.classList.add('off');
      sendBtn.disabled = true;
    }
  }

  function setupPresence() {
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
      isConnected = !!snap.val();
      updateConnectionUI();
      if (isConnected) {
        const myUserRef = usersRef.child(myUid);
        myUserRef.set({
          name: myName,
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
          online: true
        });
        myUserRef.onDisconnect().remove();
        typingRef.child(myUid).onDisconnect().remove();
      }
    });

    usersRef.on('value', (snap) => {
      const users = snap.val() || {};
      const keys = Object.keys(users);
      onlineCount.textContent = keys.length;
      renderOnlineList(users);
    });
  }

  function renderOnlineList(users) {
    onlineList.innerHTML = '';
    const names = Object.values(users).map(u => u && u.name).filter(Boolean);
    if (names.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sheet-empty';
      empty.textContent = 'لا يوجد أحد متصل الآن';
      onlineList.appendChild(empty);
      return;
    }
    names.forEach(name => {
      const row = document.createElement('div');
      row.className = 'sheet-row';
      const left = document.createElement('div');
      left.className = 'sheet-row-left';
      const dot = document.createElement('span');
      dot.className = 'dot';
      const nm = document.createElement('span');
      nm.textContent = name;
      left.appendChild(dot);
      left.appendChild(nm);
      row.appendChild(left);
      onlineList.appendChild(row);
    });
  }

  onlineBtn.addEventListener('click', () => {
    onlineSheetBackdrop.style.display = 'flex';
  });
  onlineSheetBackdrop.addEventListener('click', (e) => {
    if (e.target === onlineSheetBackdrop) onlineSheetBackdrop.style.display = 'none';
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
        typingRow.classList.add('show');
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
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 110) + 'px';
  }

  // ========================================================
  // Boot
  // ========================================================
  function bootChat(isFreshJoin) {
    if (!firebaseReady) {
      showSystemError('لا يمكن الاتصال بقاعدة البيانات. تحقق من إعدادات Firebase.');
      return;
    }
    messagesRef = db.ref('chat/messages');
    usersRef = db.ref('chat/presence');
    typingRef = db.ref('chat/typing');
    eventsRef = db.ref('chat/events');

    setupPresence();
    setupTyping();
    startMessageSync();
    listenForEvents();

    if (isFreshJoin) {
      eventsRef.push({
        type: 'join',
        name: myName,
        senderUid: myUid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    }

    playBrandIntro();
  }

  // ========================================================
  // Messages: ONE persistent subscription handles both the
  // initial batch and every live update after it (real fix
  // for "new messages only show after refresh").
  // ========================================================
  function startMessageSync() {
    // limitToLast(PAGE_SIZE) + child_added gives us:
    //  1) an immediate synthetic child_added for each of the last
    //     PAGE_SIZE existing messages (the "initial load")
    //  2) a child_added fired instantly for every new message
    //     pushed afterwards, for as long as this listener lives.
    // Because it's the SAME subscription throughout, there is no
    // window where "new" messages fall outside of what we're
    // listening to - which was the root cause of the old bug.
    const liveQuery = messagesRef.limitToLast(PAGE_SIZE);

    liveQuery.on('child_added', (snap) => {
      const key = snap.key;
      if (allMessagesByKey.has(key)) return;
      const data = snap.val();
      renderMessage(key, data, liveSyncStarted /* animate only once we're past the initial batch */);
      if (oldestLoadedKey === null) oldestLoadedKey = key;
      scrollToBottomIfNear(!liveSyncStarted);
    });

    liveQuery.on('child_changed', (snap) => {
      const key = snap.key;
      const data = snap.val();
      updateExistingMessage(key, data);
    });

    // mark "initial batch done" right after the current queue of
    // synchronous/microtask child_added events has flushed.
    messagesRef.limitToLast(PAGE_SIZE).once('value', () => {
      liveSyncStarted = true;
      hasMoreHistory = allMessagesByKey.size >= PAGE_SIZE;
      loadMoreRow.style.display = hasMoreHistory ? 'flex' : 'none';
      scrollToBottom();
    });
  }

  function loadOlderMessages() {
    if (!hasMoreHistory || !oldestLoadedKey) return;
    loadMoreBtn.classList.add('loading');
    loadMoreBtn.textContent = 'جارٍ التحميل...';

    messagesRef.orderByKey().endBefore(oldestLoadedKey).limitToLast(PAGE_SIZE).once('value', (snap) => {
      const val = snap.val() || {};
      const keys = Object.keys(val).sort((a, b) => (val[a].timestamp||0) - (val[b].timestamp||0));

      const prevHeight = messagesWrap.scrollHeight;
      keys.forEach(key => renderMessage(key, val[key], false, true));

      if (keys.length > 0) oldestLoadedKey = keys[0];
      hasMoreHistory = keys.length === PAGE_SIZE;
      loadMoreRow.style.display = hasMoreHistory ? 'flex' : 'none';
      loadMoreBtn.classList.remove('loading');
      loadMoreBtn.textContent = 'تحميل رسائل أقدم';

      requestAnimationFrame(() => {
        messagesWrap.scrollTop += (messagesWrap.scrollHeight - prevHeight);
      });
    });
  }
  loadMoreBtn.addEventListener('click', loadOlderMessages);

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

  function showSystemError(text) {
    const div = document.createElement('div');
    div.className = 'error-msg';
    div.textContent = text;
    messagesList.appendChild(div);
    scrollToBottomIfNear(false);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { messagesWrap.scrollTop = messagesWrap.scrollHeight; });
  }
  function scrollToBottomIfNear(force) {
    if (force) { scrollToBottom(); return; }
    const threshold = 140;
    const nearBottom = messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight < threshold;
    if (nearBottom) scrollToBottom();
  }

  // ========================================================
  // Rendering a message row
  // ========================================================
  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function renderMessage(key, data, isNew, prepend) {
    if (!data) return;
    const mine = data.senderUid === myUid;
    const isDeleted = !!data.deleted;

    const row = document.createElement('div');
    row.className = `msg-row ${mine ? 'mine' : 'theirs'}`;
    row.dataset.key = key;
    if (isNew) row.classList.add('appear');

    const shell = document.createElement('div');
    shell.className = 'msg-bubble-shell';

    if (!mine) {
      const sender = document.createElement('div');
      sender.className = 'msg-sender';
      sender.textContent = data.senderName || 'مجهول';
      shell.appendChild(sender);
    }

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (isDeleted) {
      bubble.classList.add('deleted');
      bubble.appendChild(trashGlyph());
      const textDiv = document.createElement('div');
      textDiv.className = 'msg-text';
      textDiv.textContent = 'تم حذف هذه الرسالة';
      bubble.appendChild(textDiv);
    } else {
      if (data.replyTo && data.replyTo.key) {
        const quote = document.createElement('div');
        quote.className = 'reply-quote';
        const bar = document.createElement('div'); bar.className = 'bar';
        const info = document.createElement('div'); info.className = 'info';
        const who = document.createElement('div'); who.className = 'who';
        who.textContent = data.replyTo.sender || 'مجهول';
        const txt = document.createElement('div'); txt.className = 'txt';
        txt.textContent = data.replyTo.text || '';
        info.appendChild(who); info.appendChild(txt);
        quote.appendChild(bar); quote.appendChild(info);
        quote.addEventListener('click', (e) => { e.stopPropagation(); jumpToMessage(data.replyTo.key); });
        bubble.appendChild(quote);
      }
      const textDiv = document.createElement('div');
      textDiv.className = 'msg-text';
      textDiv.textContent = data.text || '';
      bubble.appendChild(textDiv);
    }

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = formatTime(data.timestamp);
    bubble.appendChild(meta);

    shell.appendChild(bubble);

    const reactionsRow = document.createElement('div');
    reactionsRow.className = 'reactions-row';
    shell.appendChild(reactionsRow);

    row.appendChild(shell);

    const swipeIcon = document.createElement('div');
    swipeIcon.className = 'reply-swipe-icon';
    swipeIcon.appendChild(replyGlyph());
    row.appendChild(swipeIcon);

    if (!isDeleted) {
      attachGestures(row, shell, swipeIcon, key, data, mine);
    }

    if (prepend) {
      messagesList.insertBefore(row, messagesList.firstChild);
    } else {
      messagesList.appendChild(row);
    }

    allMessagesByKey.set(key, { data, el: row });
    welcomeCard.style.display = 'none';

    if (!isDeleted) {
      db.ref(`chat/messages/${key}/reactions`).on('value', (snap) => {
        updateReactionsUI(key, snap.val() || {});
      });
      if (data.reactions) updateReactionsUI(key, data.reactions);
    }
  }

  function updateExistingMessage(key, data) {
    const entry = allMessagesByKey.get(key);
    if (!entry) return;
    const wasDeleted = !!entry.data.deleted;
    const nowDeleted = !!data.deleted;
    entry.data = data;

    if (!wasDeleted && nowDeleted) {
      // Turn the existing bubble into the "deleted" placeholder in place,
      // without tearing down and rebuilding the whole row.
      db.ref(`chat/messages/${key}/reactions`).off('value');

      const row = entry.el;
      const shell = row.querySelector('.msg-bubble-shell');
      const bubble = row.querySelector('.msg-bubble');
      const reactionsRow = row.querySelector('.reactions-row');
      const swipeIcon = row.querySelector('.reply-swipe-icon');

      if (reactionsRow) reactionsRow.remove();
      if (swipeIcon) swipeIcon.remove();

      bubble.innerHTML = '';
      bubble.classList.add('deleted');
      bubble.appendChild(trashGlyph());
      const textDiv = document.createElement('div');
      textDiv.className = 'msg-text';
      textDiv.textContent = 'تم حذف هذه الرسالة';
      bubble.appendChild(textDiv);
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.textContent = formatTime(data.timestamp);
      bubble.appendChild(meta);

      // swap in a plain clone to drop all gesture/pointer listeners cleanly
      const freshRow = row.cloneNode(true);
      row.replaceWith(freshRow);
      allMessagesByKey.set(key, { data, el: freshRow });
    }
  }

  // Small inline SVG glyphs (no emoji) ------------------------------
  function replyGlyph() {
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('viewBox', '0 0 24 24');
    wrap.setAttribute('width', '15');
    wrap.setAttribute('height', '15');
    wrap.innerHTML = '<path d="M10 7L5 12L10 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M5 12H14C16.7614 12 19 14.2386 19 17V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    return wrap;
  }
  function trashGlyph() {
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('viewBox', '0 0 24 24');
    wrap.setAttribute('width', '14');
    wrap.setAttribute('height', '14');
    wrap.innerHTML = '<path d="M5 7H19M10 11V16M14 11V16M6 7L7 19A2 2 0 0 0 9 21H15A2 2 0 0 0 17 19L18 7M9 7V4A1 1 0 0 1 10 3H14A1 1 0 0 1 15 4V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    return wrap;
  }

  function jumpToMessage(key) {
    const entry = allMessagesByKey.get(key);
    if (!entry) return;
    entry.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const bubble = entry.el.querySelector('.msg-bubble');
    bubble.classList.remove('highlight');
    void bubble.offsetWidth;
    bubble.classList.add('highlight');
  }

  // ========================================================
  // Swipe-to-reply + long-press gesture handling
  // ========================================================
  function attachGestures(row, shell, swipeIcon, key, data, mine) {
    let startX = 0, startY = 0, dx = 0, dy = 0;
    let dragging = false;
    let decided = false;
    let pointerId = null;
    let longPressTimer = null;
    let longPressFired = false;

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      pointerId = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      dx = 0; dy = 0;
      dragging = false; decided = false; longPressFired = false;

      longPressTimer = setTimeout(() => {
        longPressFired = true;
        if (navigator.vibrate) navigator.vibrate(12);
        openContextMenu(row, key, data, mine, { x: e.clientX, y: e.clientY });
      }, 420);

      row.addEventListener('pointermove', onPointerMove);
      row.addEventListener('pointerup', onPointerUp);
      row.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (pointerId !== e.pointerId) return;
      dx = e.clientX - startX; dy = e.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          decided = true;
          if (Math.abs(dx) > Math.abs(dy) * 1.3) {
            dragging = true;
            clearTimeout(longPressTimer);
          } else {
            dragging = false;
            clearTimeout(longPressTimer);
            cleanup();
            return;
          }
        } else return;
      }
      if (!dragging) return;

      clearTimeout(longPressTimer);
      e.preventDefault();
      let clamped = dx;
      if (Math.abs(clamped) > SWIPE_MAX_PX) {
        const over = Math.abs(clamped) - SWIPE_MAX_PX;
        const damped = SWIPE_MAX_PX + over * 0.25;
        clamped = clamped < 0 ? -damped : damped;
      }
      shell.classList.add('dragging');
      shell.style.transform = `translateX(${clamped}px)`;

      const progress = Math.min(Math.abs(dx) / SWIPE_TRIGGER_PX, 1);
      swipeIcon.classList.add('show');
      swipeIcon.style.opacity = String(progress);
      swipeIcon.style.transform = `translateY(-50%) scale(${0.35 + progress * 0.65})`;
      swipeIcon.classList.toggle('ready', progress >= 1);
    }

    function onPointerUp() {
      clearTimeout(longPressTimer);
      const triggeredReply = dragging && Math.abs(dx) >= SWIPE_TRIGGER_PX;

      shell.classList.remove('dragging');
      shell.style.transform = '';
      swipeIcon.classList.remove('show', 'ready');
      swipeIcon.style.opacity = '';
      swipeIcon.style.transform = '';

      if (triggeredReply) {
        if (navigator.vibrate) navigator.vibrate(18);
        startReply(key, data);
      }
      cleanup();
    }

    function cleanup() {
      row.removeEventListener('pointermove', onPointerMove);
      row.removeEventListener('pointerup', onPointerUp);
      row.removeEventListener('pointercancel', onPointerUp);
      pointerId = null; dragging = false; decided = false;
    }

    row.addEventListener('pointerdown', onPointerDown);
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(row, key, data, mine, { x: e.clientX, y: e.clientY });
    });
  }

  // ========================================================
  // WhatsApp/Telegram-style context menu
  // reactions bar (separate, on top) + text-labeled action list
  // ========================================================
  function ensureCtxDom() {
    if (ctxBackdropEl) return;
    ctxBackdropEl = document.createElement('div');
    ctxBackdropEl.className = 'ctx-backdrop';
    ctxMenuEl = document.createElement('div');
    ctxMenuEl.className = 'ctx-menu';
    document.body.appendChild(ctxBackdropEl);
    document.body.appendChild(ctxMenuEl);
    ctxBackdropEl.addEventListener('click', closeContextMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeContextMenu();
    });
  }

  function closeContextMenu() {
    if (!ctxMenuEl) return;
    ctxMenuEl.classList.remove('show');
    ctxBackdropEl.classList.remove('show');
    clearTimeout(ctxCloseTimer);
    ctxCloseTimer = setTimeout(() => { if (ctxMenuEl) ctxMenuEl.innerHTML = ''; }, 160);
  }

  function openContextMenu(row, key, data, mine, point) {
    ensureCtxDom();
    clearTimeout(ctxCloseTimer);
    ctxMenuEl.classList.remove('show');
    ctxBackdropEl.classList.remove('show');
    ctxMenuEl.innerHTML = '';

    const reactionsBar = document.createElement('div');
    reactionsBar.className = 'ctx-reactions';
    QUICK_REACTIONS.forEach(em => {
      const span = document.createElement('span');
      span.textContent = em;
      span.addEventListener('click', () => { toggleMyReaction(key, em); closeContextMenu(); });
      reactionsBar.appendChild(span);
    });
    const more = document.createElement('div');
    more.className = 'ctx-more';
    more.textContent = '+';
    more.addEventListener('click', () => {
      closeContextMenu();
      openFullEmojiPickerForReaction(key);
    });
    reactionsBar.appendChild(more);

    const list = document.createElement('div');
    list.className = 'ctx-list';

    const replyItem = makeCtxItem(replyGlyphMenu(), 'رد على الرسالة', () => {
      startReply(key, data);
      closeContextMenu();
    });
    list.appendChild(replyItem);

    if (mine) {
      const deleteItem = makeCtxItem(trashGlyphMenu(), 'حذف الرسالة', () => {
        deleteOwnMessage(key);
        closeContextMenu();
      }, true);
      list.appendChild(deleteItem);
    }

    ctxMenuEl.appendChild(reactionsBar);
    ctxMenuEl.appendChild(list);

    document.body.appendChild(ctxBackdropEl);
    document.body.appendChild(ctxMenuEl);

    // position: near the tap/press point, kept inside viewport
    const menuWidth = 250;
    let left = point.x - (mine ? menuWidth : 0);
    left = Math.max(10, Math.min(left, window.innerWidth - menuWidth - 10));
    let top = point.y + 10;
    const estHeight = 220;
    if (top + estHeight > window.innerHeight - 10) {
      top = Math.max(10, point.y - estHeight - 10);
    }
    ctxMenuEl.style.left = left + 'px';
    ctxMenuEl.style.top = top + 'px';

    requestAnimationFrame(() => {
      ctxBackdropEl.classList.add('show');
      ctxMenuEl.classList.add('show');
    });
  }

  function makeCtxItem(svgEl, label, onClick, danger) {
    const item = document.createElement('div');
    item.className = 'ctx-item' + (danger ? ' danger' : '');
    item.appendChild(svgEl);
    const span = document.createElement('span');
    span.textContent = label;
    item.appendChild(span);
    item.addEventListener('click', onClick);
    return item;
  }
  function replyGlyphMenu() {
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('viewBox', '0 0 24 24'); wrap.setAttribute('width', '18'); wrap.setAttribute('height', '18');
    wrap.innerHTML = '<path d="M10 7L5 12L10 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M5 12H14C16.7614 12 19 14.2386 19 17V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    return wrap;
  }
  function trashGlyphMenu() {
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('viewBox', '0 0 24 24'); wrap.setAttribute('width', '18'); wrap.setAttribute('height', '18');
    wrap.innerHTML = '<path d="M5 7H19M10 11V16M14 11V16M6 7L7 19A2 2 0 0 0 9 21H15A2 2 0 0 0 17 19L18 7M9 7V4A1 1 0 0 1 10 3H14A1 1 0 0 1 15 4V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    return wrap;
  }

  // ========================================================
  // Reply flow
  // ========================================================
  function startReply(key, data) {
    activeReply = { key, sender: data.senderName || 'مجهول', text: data.text || '' };
    replyPreviewWho.textContent = activeReply.sender;
    replyPreviewTxt.textContent = activeReply.text;
    replyPreview.style.display = 'flex';
    messageInput.focus();
  }
  function cancelReply() { activeReply = null; replyPreview.style.display = 'none'; }
  replyCancelBtn.addEventListener('click', cancelReply);

  // ========================================================
  // Sending messages
  // ========================================================
  function sendMessage() {
    const raw = messageInput.value;
    const text = sanitizeMessage(raw).trim();
    if (!text) return;
    if (!firebaseReady || !isConnected) {
      showSystemError('لا يمكن إرسال الرسالة. تحقق من الاتصال بالإنترنت.');
      return;
    }

    const payload = {
      text,
      senderUid: myUid,
      senderName: myName,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    if (activeReply) {
      payload.replyTo = {
        key: activeReply.key,
        sender: activeReply.sender,
        text: activeReply.text.slice(0, 120)
      };
    }

    messagesRef.push(payload).then(() => {
      messageInput.value = '';
      autoGrow();
      cancelReply();
      sendBtn.classList.remove('pop');
      void sendBtn.offsetWidth;
      sendBtn.classList.add('pop');
      if (navigator.vibrate) navigator.vibrate(30);
      typingRef.child(myUid).remove();
    }).catch((err) => {
      console.error('send error', err);
      showSystemError('فشل في إرسال الرسالة');
    });
  }
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ========================================================
  // Soft delete (own messages only)
  // Original content is NEVER overwritten - we only add
  // `deleted` + `deletedAt` fields alongside it. The original
  // text/sender stay intact in Firebase for the sender's own
  // record; everyone else's UI shows the placeholder instead.
  // ========================================================
  function deleteOwnMessage(key) {
    const entry = allMessagesByKey.get(key);
    if (!entry || entry.data.senderUid !== myUid) return;
    db.ref(`chat/messages/${key}`).update({
      deleted: true,
      deletedAt: firebase.database.ServerValue.TIMESTAMP
    }).catch(err => {
      console.error('delete error', err);
      showSystemError('تعذر حذف الرسالة');
    });
  }

  // ========================================================
  // Reactions
  // ========================================================
  function openFullEmojiPickerForReaction(key) {
    pendingReactionTargetKey = key;
    openEmojiPanel();
  }

  function toggleMyReaction(key, emoji) {
    const reactionRef = db.ref(`chat/messages/${key}/reactions/${emoji}/${myUid}`);
    reactionRef.once('value').then(snap => {
      if (snap.exists()) reactionRef.remove();
      else reactionRef.set({ name: myName, ts: firebase.database.ServerValue.TIMESTAMP });
    });
  }

  function updateReactionsUI(key, reactions) {
    const entry = allMessagesByKey.get(key);
    if (!entry) return;
    const reactionsRow = entry.el.querySelector('.reactions-row');
    if (!reactionsRow) return;
    reactionsRow.innerHTML = '';

    const emojiKeys = Object.keys(reactions || {}).filter(em => reactions[em] && Object.keys(reactions[em]).length > 0);
    emojiKeys.forEach(emoji => {
      const usersMap = reactions[emoji];
      const uids = Object.keys(usersMap);
      const chip = document.createElement('div');
      chip.className = 'reaction-chip' + (usersMap[myUid] ? ' mine' : '');
      const emoSpan = document.createElement('span'); emoSpan.textContent = emoji;
      const countSpan = document.createElement('span'); countSpan.className = 'count'; countSpan.textContent = uids.length;
      chip.appendChild(emoSpan); chip.appendChild(countSpan);

      chip.addEventListener('click', (e) => { e.stopPropagation(); toggleMyReaction(key, emoji); });
      let pressTimer = null;
      chip.addEventListener('pointerdown', () => { pressTimer = setTimeout(() => showWhoReacted(emoji, usersMap), 380); });
      chip.addEventListener('pointerup', () => clearTimeout(pressTimer));
      chip.addEventListener('pointerleave', () => clearTimeout(pressTimer));

      reactionsRow.appendChild(chip);
    });
  }

  function showWhoReacted(emoji, usersMap) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    const handle = document.createElement('div'); handle.className = 'sheet-handle';
    const h4 = document.createElement('h4'); h4.textContent = `تفاعل بـ ${emoji}`;
    sheet.appendChild(handle); sheet.appendChild(h4);

    Object.values(usersMap).forEach(u => {
      const row = document.createElement('div'); row.className = 'sheet-row';
      const nameSpan = document.createElement('span'); nameSpan.textContent = (u && u.name) || 'مجهول';
      const emoSpan = document.createElement('span'); emoSpan.className = 'emo'; emoSpan.textContent = emoji;
      row.appendChild(nameSpan); row.appendChild(emoSpan);
      sheet.appendChild(row);
    });

    backdrop.appendChild(sheet);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  // ========================================================
  // Emoji picker (composer + reaction "more" entry point)
  // ========================================================
  let emojiPanelOpen = false;
  let pendingReactionTargetKey = null;

  function buildEmojiPanel() {
    emojiTabs.innerHTML = ''; emojiGrid.innerHTML = '';
    EMOJI_CATEGORIES.forEach((cat, idx) => {
      const tabBtn = document.createElement('button');
      tabBtn.textContent = cat.icon;
      tabBtn.dataset.cat = cat.key;
      if (idx === 0) tabBtn.classList.add('active');
      tabBtn.addEventListener('click', () => selectEmojiCategory(cat.key));
      emojiTabs.appendChild(tabBtn);
    });
    renderEmojiGrid(EMOJI_CATEGORIES[0].key);
  }

  function renderEmojiGrid(catKey) {
    emojiGrid.innerHTML = '';
    const cat = EMOJI_CATEGORIES.find(c => c.key === catKey);
    if (!cat) return;
    const label = document.createElement('div'); label.className = 'emoji-cat-label'; label.textContent = cat.name;
    emojiGrid.appendChild(label);
    cat.emojis.forEach(em => {
      const span = document.createElement('span'); span.textContent = em;
      span.addEventListener('click', () => onEmojiPicked(em));
      emojiGrid.appendChild(span);
    });
  }

  function selectEmojiCategory(key) {
    [...emojiTabs.children].forEach(b => b.classList.toggle('active', b.dataset.cat === key));
    renderEmojiGrid(key);
  }

  function onEmojiPicked(emoji) {
    if (pendingReactionTargetKey) {
      toggleMyReaction(pendingReactionTargetKey, emoji);
      pendingReactionTargetKey = null;
      closeEmojiPanel();
      return;
    }
    const start = messageInput.selectionStart || messageInput.value.length;
    const end = messageInput.selectionEnd || messageInput.value.length;
    const val = messageInput.value;
    messageInput.value = val.slice(0, start) + emoji + val.slice(end);
    const newPos = start + emoji.length;
    messageInput.setSelectionRange(newPos, newPos);
    messageInput.focus();
    autoGrow();
  }

  function openEmojiPanel() { emojiPanel.classList.add('open'); emojiToggleBtn.classList.add('active'); emojiPanelOpen = true; }
  function closeEmojiPanel() { emojiPanel.classList.remove('open'); emojiToggleBtn.classList.remove('active'); emojiPanelOpen = false; pendingReactionTargetKey = null; }
  emojiToggleBtn.addEventListener('click', () => { if (emojiPanelOpen) closeEmojiPanel(); else openEmojiPanel(); });

  document.addEventListener('pointerdown', (e) => {
    if (ctxMenuEl && ctxMenuEl.classList.contains('show') && !e.target.closest('.ctx-menu')) {
      closeContextMenu();
    }
  }, true);

  // ========================================================
  // Init
  // ========================================================
  function init() {
    loadIdentity();
    initFirebase();
    buildEmojiPanel();
    updateConnectionUI();

    if (myName) {
      hideNameOverlay();
      bootChat(false);
    } else {
      showNameOverlay();
    }
  }

  document.addEventListener('touchstart', () => {}, { passive: true });
  init();
})();
