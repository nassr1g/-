/* POST /api/send-verification  (Authorization: Bearer <Firebase ID token>)
   Sends the email-verification link from your own Gmail via SMTP.
   Env: FIREBASE_SERVICE_ACCOUNT, SMTP_USER (Gmail address), SMTP_PASS (Gmail App Password).
   Without SMTP_* it answers 501 and the site falls back to Firebase's built-in mail. */
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

function init() {
  if (admin.apps.length) return;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return res.status(501).json({ error: 'smtp-not-configured' });
  try {
    init();
    const mt = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const dec = mt ? await admin.auth().verifyIdToken(mt[1]).catch(() => null) : null;
    if (!dec) return res.status(401).json({ error: 'unauthorized' });
    const user = await admin.auth().getUser(dec.uid);
    if (!user.email) return res.status(400).json({ error: 'no-email' });
    if (user.emailVerified) return res.status(200).json({ already: true });
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const link = await admin.auth().generateEmailVerificationLink(user.email, { url: 'https://' + host });
    const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await tr.sendMail({
      from: '"Friends\' room" <' + process.env.SMTP_USER + '>',
      to: user.email,
      subject: 'تأكيد بريدك الإلكتروني',
      text: 'لتأكيد بريدك الإلكتروني افتح الرابط:\n' + link,
      html: '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7"><p>مرحبًا،</p><p>اضغط الزر لتأكيد بريدك الإلكتروني والدخول إلى المحادثة:</p><p><a href="' + esc(link) + '" style="display:inline-block;background:#7b4fc9;color:#fff;padding:12px 26px;border-radius:999px;text-decoration:none">تأكيد البريد</a></p><p style="color:#777;font-size:12px">إن لم تنشئ حسابًا فتجاهل هذه الرسالة.</p></div>'
    });
    return res.status(200).json({ sent: true });
  } catch (e) {
    console.error('send-verification error', e);
    return res.status(500).json({ error: 'server' });
  }
};
