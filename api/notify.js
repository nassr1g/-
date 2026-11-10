/* Vercel serverless function: POST /api/notify
   - message/reply:  { key, uid }
   - reaction:       { type:'reaction', key, uid, emoji }
   Reads everything from Firebase (client can't forge content), then sends
   high-urgency FCM web pushes. Env: FIREBASE_SERVICE_ACCOUNT (JSON). */
const admin = require('firebase-admin');

const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://otaku2-e2764-default-rtdb.firebaseio.com';
const DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

function init() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), databaseURL: DB_URL });
}

function build(token, data) {
  return {
    token,
    data,
    android: { priority: 'high' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } }
  };
}

async function deliver(db, messages, tokens) {
  if (!messages.length) return { sent: 0 };
  const result = await admin.messaging().sendEach(messages);
  const cleanup = {};
  result.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD.indexOf(r.error.code) !== -1) cleanup['chat/push/' + tokens[i]] = null;
  });
  if (Object.keys(cleanup).length) await db.ref().update(cleanup);
  return { sent: result.successCount, failed: result.failureCount };
}

async function handleMessage(db, key, uid) {
  const msgSnap = await db.ref('chat/messages/' + key).get();
  if (!msgSnap.exists()) return [404, { error: 'no-message' }];
  const msg = msgSnap.val();
  if (msg.senderUid !== uid || msg.deleted) return [403, { error: 'forbidden' }];
  if (!msg.timestamp || Date.now() - msg.timestamp > 10 * 60 * 1000) return [410, { error: 'too-old' }];

  const tx = await db.ref('chat/pushed/' + key).transaction((cur) => (cur ? undefined : Date.now()));
  if (!tx.committed) return [200, { skipped: 'duplicate' }];

  let replyTargetUid = null;
  if (msg.replyTo && msg.replyTo.key) {
    const t = await db.ref('chat/messages/' + String(msg.replyTo.key).slice(0, 40) + '/senderUid').get();
    replyTargetUid = t.val();
  }

  const records = (await db.ref('chat/push').get()).val() || {};
  const messages = [], tokens = [];
  Object.keys(records).forEach((token) => {
    const rec = records[token];
    if (!rec || rec.uid === msg.senderUid) return;
    const isReply = !!replyTargetUid && rec.uid === replyTargetUid;
    if (rec.mute === 'all') return;
    if (rec.mute === 'normal' && !isReply) return;
    tokens.push(token);
    messages.push(build(token, {
      type: isReply ? 'reply' : 'message',
      key,
      sender: String(msg.senderName || '').slice(0, 20),
      text: String(msg.text || '').slice(0, 180),
      ts: String(msg.timestamp)
    }));
  });
  return [200, await deliver(db, messages, tokens)];
}

async function handleReaction(db, key, uid, emoji) {
  if (!/^[-\w]{1,100}$/.test(uid) || !emoji || emoji.length > 16 || /[.$#\[\]\/]/.test(emoji)) return [400, { error: 'bad-request' }];
  const [msgSnap, recSnap] = await Promise.all([
    db.ref('chat/messages/' + key).get(),
    db.ref('chat/messages/' + key + '/reactions/' + emoji + '/' + uid).get()
  ]);
  if (!msgSnap.exists() || !recSnap.exists()) return [404, { error: 'no-reaction' }];
  const msg = msgSnap.val(), rec = recSnap.val();
  if (msg.deleted || !msg.senderUid || msg.senderUid === uid) return [200, { skipped: 'self-or-deleted' }];
  if (!rec.ts || Date.now() - rec.ts > 2 * 60 * 1000) return [410, { error: 'too-old' }];

  const tx = await db.ref('chat/pushed/r_' + key + '_' + uid + '_' + rec.ts).transaction((cur) => (cur ? undefined : Date.now()));
  if (!tx.committed) return [200, { skipped: 'duplicate' }];

  const records = (await db.ref('chat/push').get()).val() || {};
  const messages = [], tokens = [];
  Object.keys(records).forEach((token) => {
    const r = records[token];
    if (!r || r.uid !== msg.senderUid || r.mute !== 'none') return; // reactions are "normal" notifications
    tokens.push(token);
    messages.push(build(token, {
      type: 'reaction',
      key,
      sender: String(rec.name || '').slice(0, 20),
      emoji,
      text: String(msg.text || '').slice(0, 80),
      ts: String(rec.ts)
    }));
  });
  return [200, await deliver(db, messages, tokens)];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    init();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const key = String(body.key || ''), uid = String(body.uid || '');
    if (!/^[-\w]{10,40}$/.test(key) || !uid || uid.length > 100) return res.status(400).json({ error: 'bad-request' });
    const db = admin.database();
    const [code, out] = body.type === 'reaction'
      ? await handleReaction(db, key, uid, String(body.emoji || ''))
      : await handleMessage(db, key, uid);
    return res.status(code).json(out);
  } catch (e) {
    console.error('notify error', e);
    return res.status(500).json({ error: 'server' });
  }
};
