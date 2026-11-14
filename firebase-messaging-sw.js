/* =========================================================
   Service Worker (one worker for the whole site)
   1) Offline app shell: the site opens without internet.
   2) Background sending of unsent messages (Background Sync).
   3) Web Push notifications (sent by /api/notify via FCM).
   ========================================================= */
'use strict';
importScripts('/store.js');

const CACHE = 'fr-shell-v1'; // (kept: bumping would drop the saved copies)
const NET_TIMEOUT = 3500; // slow network -> fall back to the saved copy
const SHELL = ['/', '/index.html', '/style.css', '/auth.css', '/aurora.js', '/emoji-data.js', '/store.js', '/auth.js', '/app.js',
  '/manifest.webmanifest', '/icons/app-icon-192.png', '/icons/app-icon-512.png', '/icons/apple-touch-icon.png'];
const FIREBASE_JS = ['app', 'database', 'auth', 'messaging'].map((n) => 'https://www.gstatic.com/firebasejs/10.12.2/firebase-' + n + '-compat.js');
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800&family=Poppins:wght@300;400;500;600&display=swap';

async function cacheCross(cache, url) {
  if (await cache.match(url, { ignoreVary: true })) return;
  let res;
  try { res = await fetch(url, { mode: 'cors' }); } catch (e) { res = await fetch(url, { mode: 'no-cors' }); }
  if (res && (res.ok || res.type === 'opaque')) await cache.put(url, res);
}
async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(async (u) => {
    const res = await fetch(new Request(u, { cache: 'reload' }));
    if (res.ok) await cache.put(u, res);
  }));
  await Promise.allSettled(FIREBASE_JS.map((u) => cacheCross(cache, u)));
  try { // web fonts: the css + every font file it points to
    const res = await fetch(FONT_CSS);
    if (res.ok) {
      await cache.put(FONT_CSS, res.clone());
      const urls = Array.from(new Set((await res.text()).match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || []));
      await Promise.allSettled(urls.map((u) => cacheCross(cache, u)));
    }
  } catch (e) {}
}

self.addEventListener('install', (event) => { self.skipWaiting(); event.waitUntil(precache()); });
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.indexOf('fr-shell-') === 0 && k !== CACHE).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

// network first (always fresh when online), saved copy when offline / very slow
async function networkFirst(event, req, fallbackUrl) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; });
  event.waitUntil(net.catch(() => {}));
  const timer = new Promise((r) => setTimeout(() => r(null), NET_TIMEOUT));
  let res = null;
  try { res = await Promise.race([net, timer]); } catch (e) { res = null; }
  if (res) return res;
  const opt = { ignoreSearch: true, ignoreVary: true };
  const hit = (await cache.match(req, opt)) || (await cache.match(req.url, opt)) || (fallbackUrl ? await cache.match(fallbackUrl, opt) : null);
  if (hit) return hit;
  return net;
}
async function cacheFirst(event, req) {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(req, { ignoreVary: true })) || (await cache.match(req.url, { ignoreVary: true }));
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/__/') === 0) return; // server calls & auth handler: never cached
    if (req.mode === 'navigate') { event.respondWith(networkFirst(event, req, '/index.html')); return; }
    event.respondWith(networkFirst(event, req, null));
    return;
  }
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) { event.respondWith(cacheFirst(event, req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(cacheFirst(event, req)); }
});

/* ---------------- background sending (Background Sync) ----------------
   The page stores unsent messages in IndexedDB and, when it can't send them
   (offline / closing), registers the 'fr-outbox' sync. When the browser gets
   a connection back it wakes this worker, which sends them through the
   Realtime Database REST API using the saved refresh token.
   Sending is idempotent: the message key is fixed, a second write of the same
   key is refused by the rules, so a message can never be posted twice. */
async function idTokenFor(auth) {
  const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(auth.apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refreshToken)
  });
  if (r.status === 400) return null;      // refresh token no longer valid (signed out): give up quietly
  if (!r.ok) throw new Error('token');
  return (await r.json()).id_token;
}
async function flushOutboxBG() {
  const S = self.FRStore;
  const auth = await S.getMeta('auth');
  if (!auth || !auth.refreshToken) return;
  const items = (await S.outboxAll()).filter((r) => r.senderUid === auth.uid && r.state !== 'failed');
  if (!items.length) return;
  const tok = await idTokenFor(auth);
  if (!tok) return;
  const sent = [];
  for (const rec of items) {
    const url = auth.dbUrl + '/chat/messages/' + encodeURIComponent(rec.k) + '.json?auth=' + encodeURIComponent(tok);
    const body = { text: rec.text, senderUid: rec.senderUid, senderName: rec.senderName, timestamp: { '.sv': 'timestamp' } };
    if (rec.replyTo) body.replyTo = rec.replyTo;
    const put = await fetch(url, { method: 'PUT', body: JSON.stringify(body) });   // network error -> throws -> browser retries the sync
    if (put.status >= 500) throw new Error('server');
    let data = null;
    if (put.ok || put.status === 401 || put.status === 403) {
      const g = await fetch(url);                                                  // exists already (sent earlier)? read it back
      if (g.ok) data = await g.json();
    }
    if (!data) {                                                                   // really refused by the rules
      rec.state = 'failed'; await S.outboxPut(rec); continue;
    }
    const full = Object.assign({ k: rec.k }, data);
    await S.upsertMany([full]);
    await S.outboxDel(rec.k);
    sent.push(full);
    fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ key: rec.k, uid: auth.uid }), keepalive: true }).catch(() => {});
  }
  if (sent.length) {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach((c) => sent.forEach((m) => c.postMessage({ type: 'outbox-sent', key: m.k, data: m })));
  }
}
self.addEventListener('sync', (event) => { if (event.tag === 'fr-outbox') event.waitUntil(flushOutboxBG()); });

/* ---------------- push notifications ---------------- */
const SITE_NAME = "ᠻ𝘳𝓲ꫀꪀᦔ𝘴' 𝘳ꪮꪮꪑ";
const ICON = '/icons/notif-message.png';
const ICON_REPLY = '/icons/notif-reply.png';
const ICON_REACT = '/icons/notif-reaction.png';
const BADGE = '/icons/badge-message.png';
const BADGE_REPLY = '/icons/badge-reply.png';
const BADGE_REACT = '/icons/badge-reaction.png';
const IS_IOS = /iPhone|iPad|iPod/i.test(self.navigator.userAgent);


self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }
  const d = payload.data || payload;
  event.waitUntil(handlePush(d));
});

async function handlePush(d) {
  if (!d || (!d.text && !d.sender)) return;

  // If the page is open and visible, it plays its own in-app sound.
  // (iOS requires every push to show a notification, so it always shows.)
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const pageVisible = wins.some((c) => c.visibilityState === 'visible');
  if (pageVisible && !IS_IOS) return;

  const sender = d.sender || 'مجهول';
  const text = d.text || '';
  const ts = Number(d.ts) || Date.now();

  if (d.type === 'reply') {
    await self.registration.showNotification(sender + ' • رد عليك', {
      body: text,
      icon: ICON_REPLY,
      badge: BADGE_REPLY,
      tag: 'reply-' + (d.key || ts),
      renotify: true,
      dir: 'rtl',
      lang: 'ar',
      vibrate: [180, 70, 180, 70, 260],
      timestamp: ts,
      data: { url: '/', type: 'reply', key: d.key || '' }
    });
    return;
  }

  if (d.type === 'reaction') {
    // Unicode isolates keep each piece (name / text / emoji) from mixing with the RTL sentence
    const FSI = '\u2068', PDI = '\u2069';
    const body = '\u200F' + 'تفاعل ' + FSI + sender + PDI + ' على "' + FSI + text + PDI + '" ب"' + FSI + (d.emoji || '') + PDI + '"';
    await self.registration.showNotification(SITE_NAME, {
      body,
      icon: ICON_REACT,
      badge: BADGE_REACT,
      tag: 'react-' + (d.key || ts) + '-' + sender,
      renotify: true,
      dir: 'rtl',
      lang: 'ar',
      vibrate: [90, 50, 90],
      timestamp: ts,
      data: { url: '/', type: 'reaction', key: d.key || '' }
    });
    return;
  }

  // Normal message: stack into one notification, like WhatsApp
  const existing = await self.registration.getNotifications({ tag: 'room' });
  const prev = existing.length && existing[0].data ? existing[0].data : {};
  let items = Array.isArray(prev.items) ? prev.items.slice() : [];
  const total = (prev.count || 0) + 1;
  items.push({ s: sender, t: text.slice(0, 120) });
  items = items.slice(-5);

  const sameSender = items.every((i) => i.s === items[0].s);
  const title = total === 1 ? sender : (sameSender ? sender + ' (' + total + ')' : SITE_NAME + ' (' + total + ')');
  const body = total === 1 ? text : items.map((i) => (sameSender ? i.t : i.s + ': ' + i.t)).join('\n');

  await self.registration.showNotification(title, {
    body,
    icon: ICON,
    badge: BADGE,
    tag: 'room',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [120, 60, 120],
    timestamp: ts,
    data: { url: '/', type: 'message', items, count: total }
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) { await c.focus(); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow('/');
  })());
});
