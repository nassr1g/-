/* Vercel serverless function: POST /api/notify  { key, uid }
   Reads the message from Firebase (so the client can't forge content),
   finds who should be notified, and sends high-urgency FCM web pushes.
   Env var required: FIREBASE_SERVICE_ACCOUNT (full service-account JSON). */
const admin = require('firebase-admin');

const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://otaku2-e2764-default-rtdb.firebaseio.com';
const DEAD_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
];

function init() {
  if (admin.apps.length) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: DB_URL });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  try {
    init();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const key = String(body.key || '');
    const uid = String(body.uid || '');
    if (!/^[-\w]{10,40}$/.test(key) || !uid || uid.length > 100) {
      return res.status(400).json({ error: 'bad-request' });
    }

    const db = admin.database();
    const msgSnap = await db.ref('chat/messages/' + key).get();
    if (!msgSnap.exists()) return res.status(404).json({ error: 'no-message' });
    const msg = msgSnap.val();
    if (msg.senderUid !== uid || msg.deleted) return res.status(403).json({ error: 'forbidden' });
    if (!msg.timestamp || Date.now() - msg.timestamp > 10 * 60 * 1000) return res.status(410).json({ error: 'too-old' });

    // Send each message once only (blocks replays)
    const tx = await db.ref('chat/pushed/' + key).transaction((cur) => (cur ? undefined : Date.now()));
    if (!tx.committed) return res.status(200).json({ skipped: 'duplicate' });

    // Who is being replied to?
    let replyTargetUid = null;
    let quote = '';
    if (msg.replyTo && msg.replyTo.key) {
      const t = await db.ref('chat/messages/' + String(msg.replyTo.key).slice(0, 40) + '/senderUid').get();
      replyTargetUid = t.val();
      quote = String(msg.replyTo.text || '').slice(0, 80);
    }

    const recSnap = await db.ref('chat/push').get();
    const records = recSnap.val() || {};
    const messages = [];
    const tokens = [];

    Object.keys(records).forEach((token) => {
      const rec = records[token];
      if (!rec || rec.uid === msg.senderUid) return;
      const isReply = !!replyTargetUid && rec.uid === replyTargetUid;
      if (rec.mute === 'all') return;
      if (rec.mute === 'normal' && !isReply) return;

      tokens.push(token);
      messages.push({
        token,
        data: {
          type: isReply ? 'reply' : 'message',
          key,
          sender: String(msg.senderName || '').slice(0, 20),
          text: String(msg.text || '').slice(0, 180),
          quote: isReply ? quote : '',
          ts: String(msg.timestamp)
        },
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high', TTL: '86400' } }
      });
    });

    if (!messages.length) return res.status(200).json({ sent: 0 });

    const result = await admin.messaging().sendEach(messages);
    const cleanup = {};
    result.responses.forEach((r, i) => {
      if (!r.success && r.error && DEAD_TOKEN_CODES.indexOf(r.error.code) !== -1) {
        cleanup['chat/push/' + tokens[i]] = null;
      }
    });
    if (Object.keys(cleanup).length) await db.ref().update(cleanup);

    return res.status(200).json({ sent: result.successCount, failed: result.failureCount });
  } catch (e) {
    console.error('notify error', e);
    return res.status(500).json({ error: 'server' });
  }
};
