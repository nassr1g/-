/* =========================================================
   Service Worker — receives pushes (sent by /api/notify via FCM)
   and shows WhatsApp/Telegram-style notifications.
   Two kinds: "message" (stacked into one notification) and
   "reply" (its own distinct notification, pink icon + stronger
   vibration).
   ========================================================= */
'use strict';

const SITE_NAME = "ᠻ𝘳𝓲ꫀꪀᦔ𝘴' 𝘳ꪮꪮꪑ";
const ICON = '/icons/notif-message.png';
const ICON_REPLY = '/icons/notif-reply.png';
const ICON_REACT = '/icons/notif-reaction.png';
const BADGE = '/icons/badge-message.png';
const BADGE_REPLY = '/icons/badge-reply.png';
const BADGE_REACT = '/icons/badge-reaction.png';
const IS_IOS = /iPhone|iPad|iPod/i.test(self.navigator.userAgent);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
    await self.registration.showNotification(sender + ' • تفاعل على رسالتك', {
      body: (d.emoji || '') + '  ' + text,
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
