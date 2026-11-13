/* =========================================================
   store.js — permanent local storage (IndexedDB) for Friends' Room.
   Shared by the page (app.js / auth.js) and the service worker
   (background sending). Holds: messages, the unsent-message outbox,
   small meta values (sync cursors, cached profile, auth for background
   sync) and a cache of other users' profiles.
   Everything belongs to ONE account at a time (see ensureOwner/wipe).
   ========================================================= */
(function (G) {
  'use strict';
  const DB_NAME = 'friends-room-local', DB_VER = 1;
  let dbp = null;
  const api = { failed: false };

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!G.indexedDB) { rej(new Error('no-idb')); return; }
      const r = G.indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('msgs', { keyPath: 'k' }).createIndex('tk', ['timestamp', 'k']);
        d.createObjectStore('outbox', { keyPath: 'k' });
        d.createObjectStore('meta', { keyPath: 'id' });
        d.createObjectStore('users', { keyPath: 'uid' });
      };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }

  // fn(tx, setResult) — the promise resolves with the value passed to setResult once the tx completes
  function run(stores, mode, fn) {
    return open().then((db) => new Promise((res, rej) => {
      let out;
      const t = db.transaction(stores, mode);
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('abort'));
      fn(t, (v) => { out = v; });
    }));
  }
  const rd = (p, fb) => p.catch(() => fb);
  const wr = (p, fb) => p.catch(() => { api.failed = true; return fb; });

  function collect(store, index, range, dir, n) {
    return run([store], 'readonly', (t, set) => {
      const out = [];
      const src = index ? t.objectStore(store).index(index) : t.objectStore(store);
      const c = src.openCursor(range, dir);
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur || out.length >= n) { set(out); return; }
        out.push(cur.value); cur.continue();
      };
    });
  }
  const all = (store) => run([store], 'readonly', (t, set) => { const q = t.objectStore(store).getAll(); q.onsuccess = () => set(q.result); });

  // a deleted message keeps no text on the device
  function strip(rec) {
    if (rec.deleted) return { k: rec.k, timestamp: rec.timestamp, senderUid: rec.senderUid, senderName: rec.senderName, deleted: true, deletedAt: rec.deletedAt || 0 };
    return rec;
  }

  // ---- meta ----
  api.getMeta = (id) => rd(run(['meta'], 'readonly', (t, set) => { const q = t.objectStore('meta').get(id); q.onsuccess = () => set(q.result ? q.result.v : undefined); }), undefined);
  api.setMeta = (id, v) => wr(run(['meta'], 'readwrite', (t) => { t.objectStore('meta').put({ id, v }); }), null);

  // ---- messages ----
  api.get = (k) => rd(run(['msgs'], 'readonly', (t, set) => { const q = t.objectStore('msgs').get(k); q.onsuccess = () => set(q.result || null); }), null);
  // Insert/update. A message that is already deleted locally never comes back (deleted wins).
  api.upsertMany = (recs) => run(['msgs'], 'readwrite', (t, set) => {
    const os = t.objectStore('msgs'), out = new Array(recs.length);
    recs.forEach((rec, i) => {
      const g = os.get(rec.k);
      g.onsuccess = () => {
        const prev = g.result || null;
        const next = (prev && prev.deleted) ? prev : strip(rec);
        os.put(next);
        out[i] = { k: rec.k, prev, next };
      };
    });
    set(out);
  }).catch(() => { api.failed = true; return recs.map((r) => ({ k: r.k, prev: null, next: strip(r) })); });
  api.recent = (n) => rd(collect('msgs', 'tk', null, 'prev', n), []);
  api.before = (ts, k, n) => rd(collect('msgs', 'tk', G.IDBKeyRange.upperBound([ts, k], true), 'prev', n), []);
  api.between = (fromTs, toTs, toK, cap) => rd(collect('msgs', 'tk', G.IDBKeyRange.bound([fromTs, ''], [toTs, toK], false, true), 'next', cap), []);
  api.oldest = () => rd(collect('msgs', 'tk', null, 'next', 1), []).then((a) => a[0] || null);

  // ---- outbox (messages waiting to be sent) ----
  api.outboxAll = () => rd(all('outbox'), []).then((a) => a.sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : 0)));
  api.outboxPut = (rec) => wr(run(['outbox'], 'readwrite', (t) => { t.objectStore('outbox').put(rec); }), null);
  api.outboxDel = (k) => wr(run(['outbox'], 'readwrite', (t) => { t.objectStore('outbox').delete(k); }), null);

  // ---- cached profiles of other users ----
  api.getUsers = () => rd(all('users'), []);
  api.putUsers = (arr) => wr(run(['users'], 'readwrite', (t) => { arr.forEach((u) => t.objectStore('users').put(u)); }), null);
  api.delUsers = (uids) => wr(run(['users'], 'readwrite', (t) => { uids.forEach((u) => t.objectStore('users').delete(u)); }), null);

  // ---- ownership / privacy ----
  api.wipe = () => run(['msgs', 'outbox', 'meta', 'users'], 'readwrite', (t) => {
    ['msgs', 'outbox', 'meta', 'users'].forEach((s) => t.objectStore(s).clear());
  }).catch(() => {});
  // Local data belongs to a single account: if another account signs in on this device, drop the old data first.
  api.ensureOwner = async (uid) => {
    const o = await api.getMeta('owner');
    if (o && o !== uid) await api.wipe();
    if (o !== uid) await api.setMeta('owner', uid);
  };

  G.FRStore = api;
})(typeof self !== 'undefined' ? self : this);
