/* GET /api/cleanup?key=SECRET            -> report only (dry run): accounts whose sign-in no longer exists
   GET /api/cleanup?key=SECRET&apply=1    -> delete their leftovers (profile, reserved username, sessions, presence, push tokens...)
   GET /api/cleanup?key=SECRET&username=x -> report the account with that username
   GET /api/cleanup?key=SECRET&username=x&apply=1 -> delete that account completely (sign-in + leftovers)
   Env: FIREBASE_SERVICE_ACCOUNT, CLEANUP_SECRET (any long random text you choose). Old messages are kept. */
const admin = require('firebase-admin');
const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://otaku2-e2764-default-rtdb.firebaseio.com';
function init() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), databaseURL: DB_URL });
}
async function authExists(uid) {
  try { await admin.auth().getUser(uid); return true; } catch (e) { if (e.code === 'auth/user-not-found') return false; throw e; }
}
async function wipeUser(db, uid, lower, apply) {
  const up = {};
  up['users/' + uid] = null; up['sessions/' + uid] = null;
  up['chat/presence/' + uid] = null; up['chat/typing/' + uid] = null; up['chat/receipts/' + uid] = null;
  if (lower) up['usernames/' + lower] = null;
  up['removedUsers/' + uid] = Date.now(); // tells every device to drop this account from its saved list
  const push = (await db.ref('chat/push').get()).val() || {};
  Object.keys(push).forEach((t) => { if (push[t] && push[t].uid === uid) up['chat/push/' + t] = null; });
  if (apply) await db.ref().update(up);
  return Object.keys(up).length;
}
module.exports = async (req, res) => {
  try {
    if (!process.env.CLEANUP_SECRET) return res.status(501).json({ error: 'set CLEANUP_SECRET in the Vercel environment variables' });
    const q = req.query || {};
    if (String(q.key || req.headers['x-cleanup-key'] || '') !== process.env.CLEANUP_SECRET) return res.status(401).json({ error: 'unauthorized' });
    init();
    const db = admin.database(), apply = q.apply === '1';
    const users = (await db.ref('users').get()).val() || {};
    const names = (await db.ref('usernames').get()).val() || {};
    const report = { apply, accounts: [], orphanUsernames: [] };
    const target = q.username ? String(q.username).toLowerCase() : '';
    for (const uid of Object.keys(users)) {
      const u = users[uid] || {}, lower = u.usernameLower || '';
      if (target) { if (lower !== target) continue; }
      else if (await authExists(uid)) continue;
      if (target && apply) { try { await admin.auth().deleteUser(uid); } catch (e) {} }
      await wipeUser(db, uid, lower, apply);
      report.accounts.push({ uid, username: u.username || null, name: u.displayName || null });
    }
    if (!target) { // reserved usernames pointing to nobody
      for (const n of Object.keys(names)) {
        const uid = names[n];
        if (users[uid]) continue;
        if (await authExists(uid)) continue;
        if (apply) await db.ref('usernames/' + n).remove();
        report.orphanUsernames.push(n);
      }
    }
    return res.status(200).json(report);
  } catch (e) {
    console.error('cleanup error', e);
    return res.status(500).json({ error: 'server' });
  }
};
