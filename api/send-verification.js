/* POST /api/send-verification  body: { type: 'verify' | 'reset' | 'change-email', ... }
   Sends account emails from your own Gmail via SMTP.
   Env: FIREBASE_SERVICE_ACCOUNT, SMTP_USER, SMTP_PASS (Gmail App Password).
   Without SMTP_* it answers 501 and the site falls back to Firebase's built-in mail. */
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

function init() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rl = new Map();
function limited(k) { const n = Date.now(); if (n - (rl.get(k) || 0) < 60000) return true; rl.set(k, n); if (rl.size > 500) rl.clear(); return false; }

async function send(to, subject, intro, label, link) {
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await tr.sendMail({
    from: '"Friends\' room" <' + process.env.SMTP_USER + '>', to, subject,
    text: intro + '\n' + link,
    html: '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7"><p>مرحبًا،</p><p>' + esc(intro) + '</p><p><a href="' + esc(link) + '" style="display:inline-block;background:#7b4fc9;color:#fff;padding:12px 26px;border-radius:999px;text-decoration:none">' + esc(label) + '</a></p><p style="color:#777;font-size:12px">إن لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>'
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return res.status(501).json({ error: 'smtp-not-configured' });
  try {
    init();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const type = String(body.type || 'verify');
    const url = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
    const auth = admin.auth();

    if (type === 'reset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'bad-email' });
      if (limited('r:' + email)) return res.status(429).json({ error: 'too-many' });
      let u;
      try { u = await auth.getUserByEmail(email); } catch (e) { if (e.code === 'auth/user-not-found') return res.status(404).json({ error: 'no-user' }); throw e; }
      if (!u.providerData.some((p) => p.providerId === 'password')) return res.status(409).json({ error: 'google-only' });
      await send(email, 'إعادة تعيين كلمة المرور', 'اضغط الزر لاختيار كلمة مرور جديدة لحسابك:', 'إعادة تعيين كلمة المرور', await auth.generatePasswordResetLink(email, { url }));
      return res.status(200).json({ sent: true });
    }

    const mt = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const dec = mt ? await auth.verifyIdToken(mt[1]).catch(() => null) : null;
    if (!dec) return res.status(401).json({ error: 'unauthorized' });
    const user = await auth.getUser(dec.uid);
    if (!user.email) return res.status(400).json({ error: 'no-email' });
    if (limited('u:' + type + ':' + dec.uid)) return res.status(429).json({ error: 'too-many' });

    if (type === 'verify') {
      if (user.emailVerified) return res.status(200).json({ already: true });
      await send(user.email, 'تأكيد بريدك الإلكتروني', 'اضغط الزر لتأكيد بريدك الإلكتروني والدخول إلى المحادثة:', 'تأكيد البريد', await auth.generateEmailVerificationLink(user.email, { url }));
      return res.status(200).json({ sent: true });
    }
    if (type === 'change-email') {
      const ne = String(body.newEmail || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) return res.status(400).json({ error: 'bad-email' });
      if (!user.providerData.some((p) => p.providerId === 'password')) return res.status(409).json({ error: 'google-only' });
      let taken = true;
      try { await auth.getUserByEmail(ne); } catch (e) { if (e.code === 'auth/user-not-found') taken = false; else throw e; }
      if (taken) return res.status(409).json({ error: 'in-use' });
      await send(ne, 'تأكيد البريد الجديد', 'اضغط الزر لتأكيد هذا البريد واعتماده بريدًا لحسابك:', 'تأكيد البريد الجديد', await auth.generateVerifyAndChangeEmailLink(user.email, ne, { url }));
      return res.status(200).json({ sent: true });
    }
    return res.status(400).json({ error: 'bad-type' });
  } catch (e) {
    console.error('mail error', e);
    return res.status(500).json({ error: 'server' });
  }
};
