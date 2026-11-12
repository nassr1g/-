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

// One branded layout for every email (logo + name on top); each type has its own colour, badge, title and wording.
const KINDS = {
  verify: {
    subject: 'مرحبًا بك في Friends\' Room - فعّل حسابك',
    badge: 'حساب جديد', title: 'أهلًا بك في Friends\' Room',
    intro: 'شكرًا لتسجيلك! اضغط الزر لتأكيد بريدك الإلكتروني وتفعيل حسابك الجديد، ثم أكمل ملفك الشخصي وادخل إلى المحادثة.',
    label: 'تأكيد البريد وتفعيل الحساب', note: 'إن لم تنشئ حسابًا في Friends\' Room فتجاهل هذه الرسالة.',
    accent: '#7b4fc9', tint: '#efe7fb'
  },
  'change-email': {
    subject: 'تأكيد تغيير البريد الإلكتروني لحسابك',
    badge: 'تغيير البريد', title: 'تأكيد البريد الإلكتروني الجديد',
    intro: 'طُلب تغيير البريد الإلكتروني لحسابك الحالي في Friends\' Room إلى هذا العنوان. اضغط الزر لتأكيده؛ بعدها يصبح هذا البريد هو بريد تسجيل الدخول لحسابك.',
    label: 'تأكيد البريد الجديد', note: 'إن لم تطلب هذا التغيير فتجاهل الرسالة، وسيبقى بريدك الحالي كما هو دون تغيير.',
    accent: '#0e9f9a', tint: '#e0f6f5'
  },
  reset: {
    subject: 'إعادة تعيين كلمة المرور',
    badge: 'كلمة المرور', title: 'إعادة تعيين كلمة المرور',
    intro: 'اضغط الزر لاختيار كلمة مرور جديدة لحسابك:',
    label: 'إعادة تعيين كلمة المرور', note: 'إن لم تطلب ذلك فتجاهل هذه الرسالة.',
    accent: '#5b3a99', tint: '#ece6f7'
  }
};

async function send(to, kind, link, origin) {
  const k = KINDS[kind];
  const logo = origin + '/icons/app-icon-192.png';
  const html = '<div dir="rtl" style="background:#f4f1fa;padding:24px 12px;font-family:Tahoma,Arial,sans-serif">'
    + '<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e6dff3">'
    + '<tr><td align="center" style="background:' + k.accent + ';padding:24px 16px 20px">'
    + '<img src="' + esc(logo) + '" width="64" height="64" alt="Friends\' Room" style="display:block;margin:0 auto 10px;border-radius:16px;border:0">'
    + '<div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px">Friends\' Room</div></td></tr>'
    + '<tr><td style="padding:26px 24px 6px;font-size:15px;line-height:1.8;color:#222222">'
    + '<span style="display:inline-block;background:' + k.tint + ';color:' + k.accent + ';font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px">' + esc(k.badge) + '</span>'
    + '<h2 style="margin:12px 0 8px;font-size:19px;color:#1a1030">' + esc(k.title) + '</h2>'
    + '<p style="margin:0 0 20px">' + esc(k.intro) + '</p>'
    + '<p style="text-align:center;margin:0 0 20px"><a href="' + esc(link) + '" style="display:inline-block;background:' + k.accent + ';color:#ffffff;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:700">' + esc(k.label) + '</a></p>'
    + '</td></tr>'
    + '<tr><td style="padding:0 24px 22px;color:#777777;font-size:12px;line-height:1.7;border-top:1px solid #f0ebf8"><p style="margin:14px 0 0">' + esc(k.note) + '</p></td></tr>'
    + '</table></div>';
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await tr.sendMail({
    from: '"Friends\' room" <' + process.env.SMTP_USER + '>', to, subject: k.subject,
    text: k.title + '\n' + k.intro + '\n' + link + '\n\n' + k.note, html
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
      await send(email, 'reset', await auth.generatePasswordResetLink(email, { url }), url);
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
      await send(user.email, 'verify', await auth.generateEmailVerificationLink(user.email, { url }), url);
      return res.status(200).json({ sent: true });
    }
    if (type === 'change-email') {
      const ne = String(body.newEmail || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) return res.status(400).json({ error: 'bad-email' });
      if (!user.providerData.some((p) => p.providerId === 'password')) return res.status(409).json({ error: 'google-only' });
      let taken = true;
      try { await auth.getUserByEmail(ne); } catch (e) { if (e.code === 'auth/user-not-found') taken = false; else throw e; }
      if (taken) return res.status(409).json({ error: 'in-use' });
      await send(ne, 'change-email', await auth.generateVerifyAndChangeEmailLink(user.email, ne, { url }), url);
      return res.status(200).json({ sent: true });
    }
    return res.status(400).json({ error: 'bad-type' });
  } catch (e) {
    console.error('mail error', e);
    return res.status(500).json({ error: 'server' });
  }
};
