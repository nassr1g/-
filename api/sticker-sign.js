/* POST /api/sticker-sign  body: { h: <sha256 hex>, video?: boolean }  (Authorization: Bearer <Firebase ID token>)
   Returns a signed Cloudinary upload (or {exists:true,...} when the sticker is already registered -> no upload needed).
   Env: FIREBASE_SERVICE_ACCOUNT, CLOUDINARY_CLOUD, CLOUDINARY_KEY, CLOUDINARY_SECRET */
const admin = require('firebase-admin');
const crypto = require('crypto');
const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://otaku2-e2764-default-rtdb.firebaseio.com';
function init() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), databaseURL: DB_URL });
}
const rl = new Map();
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const cloud = process.env.CLOUDINARY_CLOUD, key = process.env.CLOUDINARY_KEY, secret = process.env.CLOUDINARY_SECRET;
  if (!cloud || !key || !secret) return res.status(501).json({ error: 'cloudinary-not-configured' });
  try {
    init();
    const mt = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const dec = mt ? await admin.auth().verifyIdToken(mt[1]).catch(() => null) : null;
    if (!dec || dec.email_verified !== true) return res.status(401).json({ error: 'unauthorized' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const h = String(body.h || '');
    if (!/^[a-f0-9]{64}$/.test(h)) return res.status(400).json({ error: 'bad-hash' });
    const now = Date.now(), list = (rl.get(dec.uid) || []).filter((t) => now - t < 60000);
    if (list.length >= 60) return res.status(429).json({ error: 'too-many' });
    list.push(now); rl.set(dec.uid, list); if (rl.size > 500) rl.clear();
    const s = await admin.database().ref('stickers/' + h).get();
    if (s.exists()) return res.status(200).json(Object.assign({ exists: true }, s.val()));
    const timestamp = Math.floor(now / 1000), publicId = 'stk/' + h;
    const signature = crypto.createHash('sha1').update('overwrite=false&public_id=' + publicId + '&timestamp=' + timestamp + secret).digest('hex');
    return res.status(200).json({ url: 'https://api.cloudinary.com/v1_1/' + cloud + '/' + (body.video ? 'video' : 'image') + '/upload', apiKey: key, timestamp, signature, publicId });
  } catch (e) {
    console.error('sticker-sign error', e);
    return res.status(500).json({ error: 'server' });
  }
};
