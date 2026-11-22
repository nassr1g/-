/* =========================================================
   effects.js — message templates (fx) + spoiler.
   Storage: message.fx = template id; spoiler = ||text|| inside message.text.
   Talks to app.js through window.FRFx (hooks) and window.FRChat.
   Performance: CSS-only ambient animation, paused when the row is off-screen
   (IntersectionObserver); tap bursts are a few short-lived DOM spans.
   ========================================================= */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const C = () => window.FRChat || {};
  const SPL = '\\|\\|(?=\\S)([\\s\\S]*?\\S)\\|\\|';
  const T = { fire: { n: 'ناري', e: '🔥' }, gift: { n: 'هدية', e: '🎁' }, ice: { n: 'ثلجي', e: '❄️' }, love: { n: 'قلوب', e: '💖' }, galaxy: { n: 'مجرة', e: '🌌' }, sakura: { n: 'ساكورا', e: '🌸' }, thunder: { n: 'صاعقة', e: '⚡' }, gold: { n: 'ذهبي', e: '✨' } };
  const PN = { fire: 7, ice: 9, love: 6, galaxy: 10, sakura: 6, thunder: 6, gold: 8, gift: 7 };
  const B = {
    fire: { g: ['●', '✹'], c: ['#ffb347', '#ff6a00', '#ffe08a'] },
    ice: { g: ['❄', '✦', '❅'], c: ['#fff', '#bfeaff', '#8fd0f5'] },
    love: { g: ['♥'], c: ['#ff7eb6', '#ff4d8d', '#ffc2dc'] },
    galaxy: { g: ['✦', '✧', '⋆'], c: ['#fff', '#c9a6ec', '#5ff1e0'] },
    sakura: { g: ['❀', '✿'], c: ['#ffb3d1', '#ff8fbf', '#fff'] },
    thunder: { g: ['⚡', '✦'], c: ['#fff36b', '#9fd8ff', '#fff'] },
    gold: { g: ['✦', '✧'], c: ['#ffe27a', '#ffc233', '#fff'] },
    gift: { g: ['▮', '●', '★', '▬'], c: ['#ff4d6d', '#ffd166', '#5ff1e0', '#c9a6ec', '#fff'] },
    spl: { g: ['✦', '✧'], c: ['#fff', '#5ff1e0', '#ef6fc9'] }
  };
  const X = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>';
  const GIFT = '<svg viewBox="0 0 64 64" aria-hidden="true"><g class="gb"><rect x="10" y="28" width="44" height="28" rx="5" fill="#ff4d6d"/><rect x="29" y="28" width="6" height="28" fill="#ffd166"/></g><g class="gl"><rect x="6" y="19" width="52" height="11" rx="4" fill="#ff7a93"/><rect x="29" y="19" width="6" height="11" fill="#ffe08a"/><path d="M32 19c-6-9-15-7-12-1 2 4 12 1 12 1zM32 19c6-9 15-7 12-1-2 4-12 1-12 1z" fill="#ffd166"/></g></svg>';

  // ---------- local "opened" state (gifts / revealed spoilers), survives reload ----------
  const LS = 'fr_fx_open_v1'; let opened;
  try { opened = new Set(JSON.parse(localStorage.getItem(LS) || '[]')); } catch (e) { opened = new Set(); }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify([...opened].slice(-800))); } catch (e) {} };

  // ---------- shared helpers ----------
  const mask = (t) => String(t || '').replace(new RegExp(SPL, 'g'), '••••');
  function parts(el, n) {
    return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.cssText = '--x:' + (Math.random() * 100).toFixed(0) + '%;--y:' + (Math.random() * 85).toFixed(0) + '%;--s:' + rnd(6, 13).toFixed(1) + 'px;--d:-' + rnd(0, 4).toFixed(2) + 's;--t:' + rnd(2.2, 4.8).toFixed(2) + 's;--h:' + (36 + Math.random() * 50 | 0) + 'px';
      el.appendChild(p);
    }
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.target.isConnected) { if (e.target._fire) e.target._fire.setOn(false); io.unobserve(e.target); return; }
    e.target.classList.toggle('fx-live', e.isIntersecting); if (e.target._fire) e.target._fire.setOn(e.isIntersecting);
  })) : null;
  function watch(row) {
    if (!row || row._fxw) return; row._fxw = 1; row.classList.add('fxwatch');
    if (io) io.observe(row); else row.classList.add('fx-live');
  }
  function index(el, key) {
    el.querySelectorAll('.spl').forEach((s, i) => { s.dataset.i = i; if (key && opened.has(key + ':' + i)) s.classList.add('open'); });
  }
  function burst(anchor, x, y, kind, n, sp) {
    const host = anchor.closest('.msg-row'); if (!host || host.querySelectorAll('.fx-burst').length > 5) return;
    const r = host.getBoundingClientRect(), w = mk('div', 'fx-burst'), K = B[kind] || B.gold;
    w.style.left = (x - r.left) + 'px'; w.style.top = (y - r.top) + 'px';
    for (let i = 0; i < n; i++) {
      const s = mk('span', null, K.g[Math.random() * K.g.length | 0]);
      s.style.color = K.c[Math.random() * K.c.length | 0];
      s.style.setProperty('--dx', ((Math.random() - 0.5) * 120 * (sp || 1)) + 'px');
      s.style.setProperty('--dy', (-(40 + Math.random() * 80)) + 'px');
      s.style.setProperty('--rot', ((Math.random() - 0.5) * 140) + 'deg');
      s.style.fontSize = rnd(11, 22).toFixed(0) + 'px'; s.style.animationDelay = (i * 28) + 'ms';
      w.appendChild(s);
    }
    host.appendChild(w); setTimeout(() => w.remove(), 1500);
  }
  function hit(b, x, y) {
    burst(b, x, y, b.dataset.fx, 9); if (b._fe) b._fe.boost = .5;
    b.classList.remove('fx-hit'); void b.offsetWidth; b.classList.add('fx-hit');
    clearTimeout(b._ht); b._ht = setTimeout(() => b.classList.remove('fx-hit'), 650);
  }
  function cover() { const c = mk('div', 'gift-cover'); c.innerHTML = GIFT; return c; }

  function openGift(b, key) {
    if (b.classList.contains('opened') || b._og) return;
    b._og = 1; opened.add(key); save();
    const c = b.querySelector('.gift-cover');
    if (!c) { b.classList.add('opened'); return; }
    c.classList.add('opening'); if (navigator.vibrate) navigator.vibrate([18, 40, 26]);
    setTimeout(() => {
      const w0 = b.offsetWidth, h0 = b.offsetHeight;
      b.classList.add('opened', 'revealing', 'flash'); screen('gift');
      const w1 = b.offsetWidth, h1 = b.offsetHeight;
      b.style.overflow = 'hidden'; b.style.width = w0 + 'px'; b.style.height = h0 + 'px'; void b.offsetWidth;
      b.style.transition = 'width .5s cubic-bezier(.2,.8,.3,1), height .5s cubic-bezier(.2,.8,.3,1)';
      b.style.width = w1 + 'px'; b.style.height = h1 + 'px';
      const r = b.getBoundingClientRect(); burst(b, r.left + r.width / 2, r.top + r.height / 2, 'gift', 16);
      setTimeout(() => { b.style.width = b.style.height = b.style.overflow = b.style.transition = ''; b._og = 0; }, 540);
      setTimeout(() => b.classList.remove('revealing', 'flash'), 800);
    }, 560);
  }


  // ---------- real flames (outside the frame) ----------
  function flames(el, n, a, b, sp) {
    for (let i = 0; i < n; i++) {
      const f = document.createElement('i'), x = (i + 0.5) / n * 100 + rnd(-3, 3);
      f.style.cssText = '--x:' + x.toFixed(1) + '%;--w:' + rnd(a, b).toFixed(0) + 'px;--t:' + rnd(.35, .7).toFixed(2) + 's;--d:-' + rnd(0, .7).toFixed(2) + 's';
      el.appendChild(f);
    }
    for (let i = 0; i < sp; i++) {
      const s = document.createElement('b');
      s.style.cssText = '--x:' + rnd(5, 95).toFixed(0) + '%;--dx:' + rnd(-16, 16).toFixed(0) + 'px;--t:' + rnd(1, 2).toFixed(2) + 's;--d:-' + rnd(0, 2).toFixed(2) + 's';
      el.appendChild(s);
    }
  }

  // ---------- living edge effects: WebGL shaders drawn around the real shape (fire / ice / hearts / galaxy / sakura / thunder / gold / gift) ----------
  const Fire = (() => {
    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const HEAD = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n'
      + 'float sst(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}\n#define smoothstep(a,b,x) sst(a,b,x)\n'
      + 'uniform vec2 uRes,uA;uniform vec4 uBox;uniform float uT,uH,uI,uR,uF,uW;\n'
      + 'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n'
      + 'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}\n'
      + 'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(11.7,5.3);a*=.5;}return v;}\n'
      + 'vec4 ramp(float f,float I){vec3 c=mix(vec3(.5,.04,0.),vec3(1.,.36,.03),smoothstep(0.,.35,f));c=mix(c,vec3(1.,.74,.16),smoothstep(.35,.72,f));c=mix(c,vec3(1.,.96,.78),smoothstep(.93,1.,f));float a=smoothstep(.06,.34,f)*I*.9;return vec4(c*a,a);}\n'
      + 'float turb(vec2 px){float w=fbm(vec2(px.x*.02*uF,px.y*.02*uF-uT*.6));vec2 p=vec2(px.x*.075*uF+w*1.4,px.y*.04*uF+uT*2.6);return fbm(p)*.65+fbm(p*2.1+vec2(3.,-uT*1.3))*.35;}\n';
    const LIB = 'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n'
      + 'vec2 h22(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}\n'
      + 'vec4 ov(vec4 a,vec4 b){return b+a*(1.-b.a);}\n'
      + 'vec4 pm(vec3 c,float a){return vec4(c*a,a);}\n'
      + 'vec2 rot(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}\n'
      + 'float es(vec2 p,vec2 h){vec2 q=abs(p)-h+uR;return q.x>q.y?p.y+3000.+(p.x>0.?500.:0.):p.x+(p.y>0.?1500.:0.);}\n'
      + 'float sdHeart(vec2 p){p.x=abs(p.x);if(p.y+p.x>1.){vec2 a=p-vec2(.25,.75);return sqrt(dot(a,a))-.35355;}vec2 b=p-vec2(0.,1.);vec2 c=p-.5*max(p.x+p.y,0.);return sqrt(min(dot(b,b),dot(c,c)))*sign(p.x-p.y);}\n'
      + 'float spark(vec2 p){float k=min(abs(p.x),abs(p.y));float m=smoothstep(.16,0.,k)*smoothstep(1.,0.,max(abs(p.x),abs(p.y)));return m+smoothstep(.4,0.,length(p))*.7;}\n'
      // kind: 0 dot, 1 heart, 2 petal, 3 sparkle, 4 confetti
      + 'vec4 parts(vec2 px,float vis,vec2 vel,float S,int kind,float dens,vec3 ca,vec3 cb){vec2 g=px-vel*uT;vec4 o=vec4(0.);vec2 base=floor(g/S);\n'
      + 'for(int i=-1;i<=1;i++){for(int j=-1;j<=1;j++){vec2 id=base+vec2(float(i),float(j));vec2 r=h22(id);float r3=h21(id+7.7);if(r.y>dens)continue;\n'
      + 'vec2 cen=(id+.2+.6*r)*S;cen.x+=sin(uT*1.4+r3*6.28)*S*.2;vec2 v=g-cen;float sz=S*(.12+.14*r3);float tw=.6+.4*sin(uT*3.+r3*40.);vec3 col=mix(ca,cb,r3);float m=0.;\n'
      + 'if(kind==0){m=smoothstep(1.,.25,length(v)/sz);}\n'
      + 'else if(kind==1){vec2 w=rot(v,(r.x-.5)*.6)/(sz*1.9);w=vec2(w.x,-w.y)+vec2(0.,.55);float dd=sdHeart(w)*sz*1.9;m=smoothstep(.9,-.6,dd);col=mix(col,vec3(1.),.35*clamp(w.y-.5,0.,1.));}\n'
      + 'else if(kind==2){vec2 w=rot(v,r3*6.28+uT*(r.x-.5)*2.)/(sz*1.5);float t=clamp(w.y*.5+.5,0.,1.);float wd=.62*pow(max(sin(3.14159*t),0.),.7);if(w.y>.8)wd*=1.-.5*smoothstep(.8,1.,w.y)*(1.-smoothstep(0.,.25,abs(w.x)));m=smoothstep(.1,0.,abs(w.x)-wd)*smoothstep(1.1,.95,abs(w.y));col=mix(col,vec3(1.,.97,.98),.5*(1.-t));}\n'
      + 'else if(kind==3){vec2 w=v/(sz*1.8);m=spark(w)*tw;}\n'
      + 'else{vec2 w=rot(v,r3*6.28+uT*(r.x-.5)*6.)/sz;m=smoothstep(.2,0.,max(abs(w.x)-1.,abs(w.y)-.45));col=.55+.45*cos(6.28*(r3*3.+vec3(0.,.33,.66)));}\n'
      + 'o=ov(o,pm(col,clamp(m,0.,1.)*vis));}}return o;}\n';
    const FX = {
      ice: 'vec4 fx(vec2 px,float d,vec2 p,vec2 h,float up){float R=uH*mix(.55,1.,up);float s=es(p,h);vec4 o=vec4(0.);\n'
        + 'float mist=fbm(vec2(s*.025,d*.05-uT*.35))*smoothstep(R*1.5,0.,max(d,0.))*smoothstep(-2.,2.,d);o=ov(o,pm(vec3(.75,.92,1.),mist*.2));\n'
        + 'for(int k=0;k<2;k++){float per=k==0?13.:8.;float sc=s+(k==0?0.:4.3);float id=floor(sc/per),fr=fract(sc/per);float hh=(pow(h21(vec2(id,float(k)+1.)),1.7)*.85+.15)*R*(k==0?.8:.4);float sp=hh*(1.-abs(fr-.5)*2.);\n'
        + 'float m=smoothstep(.9,-.9,d-sp)*smoothstep(-1.5,.5,d);float tt=clamp(d/max(sp,1.),0.,1.);vec3 col=mix(vec3(.93,.99,1.),vec3(.35,.72,1.),tt);col*=fr<.5?1.:.8;\n'
        + 'float sh=pow(.5+.5*sin(sc*.05-uT*2.6),10.);col=clamp(col+sh*.6,0.,1.);col=mix(col,vec3(1.),smoothstep(1.6,0.,abs(d-sp))*.5);o=ov(o,pm(col,m*(k==0?.95:.7)));}\n'
        + 'float vis=smoothstep(R*1.6,R*.1,max(d,0.))*smoothstep(-1.,3.,d);\n'
        + 'o=ov(o,parts(px,vis,vec2(8.,34.),22.,0,.16,vec3(.85,.95,1.),vec3(1.)));o=ov(o,parts(px,vis,vec2(0.,6.),30.,3,.07,vec3(.7,.9,1.),vec3(1.)));return o;}',
      love: 'vec4 fx(vec2 px,float d,vec2 p,vec2 h,float up){float ph=fract(uT*.9);float b=exp(-ph*8.)+.55*exp(-max(ph-.26,0.)*9.)*step(.26,ph);float dd=max(d,0.);\n'
        + 'vec4 o=pm(vec3(1.,.28,.55),exp(-dd/(uH*.3))*(.22+.38*b)*smoothstep(-3.,1.,d));o=ov(o,pm(vec3(1.,.8,.9),smoothstep(2.4,0.,abs(d-.8))*(.35+.3*b)));\n'
        + 'float vis=smoothstep(uH*2.,uH*.2,dd)*smoothstep(-1.,3.,d);\n'
        + 'o=ov(o,parts(px,vis,vec2(0.,-30.),28.,1,.3,vec3(1.,.3,.55),vec3(1.,.62,.78)));o=ov(o,parts(px+17.,vis,vec2(0.,-18.),24.,3,.08,vec3(1.,.8,.9),vec3(1.)));return o;}',
      galaxy: 'vec4 fx(vec2 px,float d,vec2 p,vec2 h,float up){vec2 c=px-p;float dd=max(d,0.);float reach=uH*1.4;float z=smoothstep(reach,0.,dd)*smoothstep(-2.,2.,d);\n'
        + 'float n=fbm(px*.011+vec2(uT*.04,0.));float n2=fbm(px*.018+vec2(4.,-uT*.05));float neb=smoothstep(.3,.7,n*.65+n2*.5)*z;\n'
        + 'vec3 nc=mix(mix(vec3(.42,.18,.9),vec3(.15,.45,1.),n2),vec3(.9,.35,.8),smoothstep(.55,.85,n));vec4 o=pm(nc,neb*.9);\n'
        + 'float vis=smoothstep(reach,0.,dd)*smoothstep(-1.,3.,d);\n'
        + 'o=ov(o,parts(px,vis,vec2(0.),13.,3,.16,vec3(.8,.85,1.),vec3(.7,1.,.95)));o=ov(o,parts(px+9.,vis,vec2(0.),24.,3,.06,vec3(1.,.85,1.),vec3(1.)));\n'
        + 'float per=4.6;float cy=floor(uT/per);float tt=uT-cy*per;\n'
        + 'if(tt<.8&&h21(vec2(cy,3.))>.3){vec2 dir=normalize(vec2(1.,.55));vec2 st=vec2(c.x+(h21(vec2(cy,5.))-.5)*h.x*1.6-uH*.6,c.y-h.y-uH*.9);vec2 head=st+dir*tt*uH*3.2;vec2 tail=head-dir*uH*.9;vec2 pa=px-tail,ba=head-tail;float k=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);float ds=length(pa-ba*k);\n'
        + 'float env=smoothstep(0.,.1,tt)*smoothstep(.8,.5,tt);o=ov(o,pm(vec3(.85,.92,1.),smoothstep(2.2,0.,ds)*k*k*env));}\n'
        + 'return o;}',
      sakura: 'vec4 fx(vec2 px,float d,vec2 p,vec2 h,float up){float dy=px.y-uA.y;float cx=uA.x+max(dy,0.)*(uW/34.);float hw=18.+max(dy,0.)*.34;float m=smoothstep(hw,hw*.4,abs(px.x-cx))*smoothstep(0.,10.,dy);\n'
        + 'float vis=m*smoothstep(-1.,2.,d);float dd=max(d,0.);vec4 o=pm(vec3(1.,.6,.78),exp(-dd/(uH*.35))*.1*smoothstep(-3.,1.,d));\n'
        + 'o=ov(o,parts(px,vis,vec2(uW,34.),30.,2,.8,vec3(1.,.72,.84),vec3(1.,.9,.95)));o=ov(o,parts(px+33.,vis*.85,vec2(uW*.7,22.),22.,2,.7,vec3(1.,.62,.78),vec3(1.,.85,.92)));return o;}',
      thunder: 'vec4 fx(vec2 px,float d,vec2 p,vec2 h,float up){float s=es(p,h);float dd=max(d,0.);vec2 c=px-p;float pulse=.5+.5*sin(uT*3.1);\n'
        + 'vec4 o=pm(vec3(.35,.5,1.),exp(-dd/(uH*.4))*(.16+.12*pulse)*smoothstep(-3.,1.,d));\n'
        + 'for(int k=0;k<3;k++){float sd=float(k)+1.;float seg=smoothstep(.42,.7,fbm(vec2(s*.012+sd*7.,uT*.9+sd)));\n'
        + 'float jag=(noise(vec2(s*.16+sd*3.,uT*9.+sd))-.5)*uH*.25+(fbm(vec2(s*.05+sd,uT*1.5))-.5)*uH*.38;float off=uH*(.1+.07*sd)+jag;float dist=abs(d-off);\n'
        + 'float fl=.55+.45*h21(vec2(floor(uT*16.),sd));float core=exp(-dist*dist/1.6);float glow=exp(-dist*dist/25.)*.55;vec3 col=mix(vec3(.45,.6,1.),vec3(.75,.55,1.),sd/3.);\n'
        + 'o=ov(o,pm(col,glow*seg*fl*.8));o=ov(o,pm(vec3(.95,.97,1.),core*seg*fl));}\n'
        + 'float per=2.4;float cy=floor(uT/per);float tt=uT-cy*per;float yh=(c.y-h.y)-px.y;\n'
        + 'if(tt<.2&&h21(vec2(cy,9.))>.3&&yh>0.){float x0=c.x+(h21(vec2(cy,2.))-.5)*h.x*1.7;float xp=x0+(fbm(vec2(yh*.07,cy))-.5)*uH*1.3+(noise(vec2(yh*.3,cy*3.))-.5)*uH*.25;float dist=abs(px.x-xp);\n'
        + 'float env=exp(-tt*12.)*(.6+.4*step(.5,fract(tt*38.)))*smoothstep(uH*1.7,uH*.6,yh)*smoothstep(0.,4.,yh);o=ov(o,pm(vec3(.5,.62,1.),exp(-dist*dist/30.)*env*.7));o=ov(o,pm(vec3(1.),exp(-dist*dist/1.4)*env));}\n'
        + 'return o;}',
      gold: 'vec4 fx(vec2 px,float d,vec2 p,vec2 h,float up){float s=es(p,h);float dd=max(d,0.);float sh=.5+.5*sin(s*.028-uT*2.2);float sh2=pow(sh,4.);\n'
        + 'vec4 o=pm(vec3(1.,.72,.2),exp(-dd/(uH*.3))*.3*smoothstep(-3.,1.,d));float band=smoothstep(2.6,0.,abs(d-1.))*(.7+.3*sh);o=ov(o,pm(mix(vec3(1.,.7,.15),vec3(1.,.96,.75),sh2),band));\n'
        + 'float vis=smoothstep(uH*1.6,uH*.1,dd)*smoothstep(-1.,3.,d);\n'
        + 'o=ov(o,parts(px,vis,vec2(0.,-24.),15.,0,.28,vec3(1.,.72,.18),vec3(1.,.9,.5)));o=ov(o,parts(px+5.,vis,vec2(0.,-16.),28.,3,.1,vec3(1.,.85,.4),vec3(1.)));return o;}',
      gift: 'vec4 fx(vec2 px,float d,vec2 p,vec2 h,float up){float dd=max(d,0.);vec3 gc=mix(vec3(1.,.25,.4),vec3(1.,.7,.2),.5+.5*sin(uT*1.2));\n'
        + 'vec4 o=pm(gc,exp(-dd/(uH*.3))*(.2+.06*sin(uT*2.))*smoothstep(-3.,1.,d));o=ov(o,pm(vec3(1.,.85,.4),smoothstep(2.,0.,abs(d-.8))*.55));\n'
        + 'float vis=smoothstep(uH*1.6,uH*.1,dd)*smoothstep(-1.,3.,d);\n'
        + 'o=ov(o,parts(px,vis,vec2(0.,-20.),28.,3,.16,vec3(1.,.85,.4),vec3(1.)));o=ov(o,parts(px+11.,vis,vec2(0.,-12.),28.,4,.14,vec3(1.),vec3(1.)));return o;}'
    };
    const MAIN = 'void main(){vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);vec2 c=uBox.xy+uBox.zw*.5,h=uBox.zw*.5;vec2 p=px-c;vec2 q=abs(p)-h+uR;float d=length(max(q,0.))+min(max(q.x,q.y),0.)-uR;'
      + 'float up=clamp(-p.y/max(length(p),1.),-1.,1.)*.5+.5;float ef=smoothstep(0.,16.,min(min(px.x,uRes.x-px.x),min(px.y,uRes.y-px.y)));gl_FragColor=fx(px,d,p,h,up)*uI*ef;}';
    const FS = {
      fire: HEAD + 'void main(){vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);vec2 c=uBox.xy+uBox.zw*.5,h=uBox.zw*.5;vec2 q=abs(px-c)-h+uR;float d=length(max(q,0.))+min(max(q.x,q.y),0.)-uR;'
        + 'float up=clamp((c.y-px.y)/max(length(px-c),1.),-1.,1.)*.5+.5;float hm=mix(.04,1.,up*up*up);float t=max(d,0.)/(uH*hm);'
        + 'float f=clamp((1.-t)*.95+(turb(px)-.5)*1.9,0.,1.);if(d<0.)f*=smoothstep(-10.,0.,d);gl_FragColor=ramp(f,uI);}',
      screen: HEAD + 'void main(){vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);float t=min((uRes.y-px.y)/uH,min(px.x/(uH*.3),(uRes.x-px.x)/(uH*.3)));'
        + 'float f=clamp((1.-t)*.95+(turb(px)-.5)*1.9,0.,1.);gl_FragColor=ramp(f,uI);}'
    };
    Object.keys(FX).forEach((k) => { FS[k] = HEAD + LIB + FX[k] + MAIN; });
    let raf = 0, last = 0, shared = null, lost = false; const act = new Set(), progs = {};
    function sharedGL() {
      if (shared) return shared;
      const cv = document.createElement('canvas'); cv.width = 720; cv.height = 520;
      const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false }); if (!gl) return null;
      const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      cv.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); lost = true; });
      cv.addEventListener('webglcontextrestored', () => { shared = null; lost = false; Object.keys(progs).forEach((k) => { delete progs[k]; }); });
      return (shared = { cv, gl, bf });
    }
    function prog(mode) {
      if (progs[mode] !== undefined) return progs[mode];
      const S = sharedGL(); if (!S) return null; const gl = S.gl;
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn('fx shader', mode, gl.getShaderInfoLog(x)); return null; } return x; };
      const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS[mode]); if (!v || !f) return (progs[mode] = false);
      const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return (progs[mode] = false);
      const u = {}; ['uRes', 'uBox', 'uT', 'uH', 'uI', 'uR', 'uF', 'uA', 'uW'].forEach((n) => { u[n] = gl.getUniformLocation(pr, n); });
      return (progs[mode] = { pr, u, l: gl.getAttribLocation(pr, 'p') });
    }
    function loop(now) {
      raf = 0; if (!act.size) return;
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      act.forEach((e) => { if (!e.cv.isConnected) { e.setOn(false); return; } e.step(dt); });
      if (act.size) raf = requestAnimationFrame(loop);
    }
    function make(cv, o) {
      const e = { cv, o, ctx: cv.getContext('2d'), w: 0, h: 0, t: 0, on: false, boost: 0, box: null,
        size(w, h) { cv.width = w; cv.height = h; e.w = w; e.h = h; },
        setOn(v) {
          if (v === e.on) return;
          if (v) { if (act.size >= 12 || !sharedGL()) return; e.on = true; e.t = Math.random() * 40; act.add(e); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
          else { e.on = false; act.delete(e); e.ctx.clearRect(0, 0, e.w, e.h); }
        },
        step(dt) {
          const S = shared; if (!S || lost || !e.w || e.w > 720 || e.h > 520) return; const P = prog(o.mode); if (!P) return;
          const gl = S.gl, u = P.u; e.t += dt; if (e.boost > 0) e.boost -= dt;
          const b = e.box || { x: 0, y: 0, w: 0, h: 0 }, A = o.A || [0, 0];
          gl.useProgram(P.pr); gl.bindBuffer(gl.ARRAY_BUFFER, S.bf); gl.enableVertexAttribArray(P.l); gl.vertexAttribPointer(P.l, 2, gl.FLOAT, false, 0, 0);
          gl.enable(gl.SCISSOR_TEST); gl.viewport(0, 0, e.w, e.h); gl.scissor(0, 0, e.w, e.h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform2f(u.uRes, e.w, e.h); gl.uniform4f(u.uBox, b.x, b.y, b.w, b.h); gl.uniform1f(u.uT, e.t); gl.uniform2f(u.uA, A[0], A[1]); gl.uniform1f(u.uW, o.W == null ? 14 : o.W);
          gl.uniform1f(u.uH, o.H * (e.boost > 0 ? 1.3 : 1)); gl.uniform1f(u.uI, o.env ? o.env(e.t) : 1); gl.uniform1f(u.uR, o.R || 0); gl.uniform1f(u.uF, o.F || 1);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          e.ctx.clearRect(0, 0, e.w, e.h); e.ctx.drawImage(S.cv, 0, S.cv.height - e.h, e.w, e.h, 0, 0, e.w, e.h);
        } };
      return e;
    }
    return { make };
  })();
  const tileIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((x) => { const f = x.target._fe; if (f) { f.vis = x.isIntersecting; f.setOn(f.vis && panelVis); } })) : null;
  const demoFires = [], fro = 'ResizeObserver' in window ? new ResizeObserver((es) => es.forEach((x) => { if (x.target._fe) x.target._fe.resize(); })) : null;
  const FXP = {
    fire: [{ pl: 20, pt: 48, pr: 20, pb: 12, H: 30, R: 17 }, { pl: 20, pt: 70, pr: 20, pb: 14, H: 42, R: 28 }],
    other: [{ pl: 30, pt: 44, pr: 30, pb: 30, H: 26, R: 17 }, { pl: 26, pt: 66, pr: 26, pb: 22, H: 42, R: 28 }],
    sakura: [{ pl: 40, pt: 84, pr: 40, pb: 40, H: 26, R: 17 }, { pl: 30, pt: 100, pr: 30, pb: 34, H: 42, R: 28 }]
  };
  const TREE = '<svg viewBox="0 0 80 90" width="100%" height="100%"><defs><radialGradient id="skA" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffe6f0"/><stop offset=".6" stop-color="#ffb3d0"/><stop offset="1" stop-color="#f27aa8"/></radialGradient><linearGradient id="skT" x1="0" x2="1"><stop offset="0" stop-color="#6b3f2c"/><stop offset="1" stop-color="#a06646"/></linearGradient></defs>'
    + '<path d="M33 90C35 76 34 66 30 56C28 50 29 46 33 42L42 42C43 50 47 54 49 60C51 68 47 80 48 90Z" fill="url(#skT)"/>'
    + '<path d="M32 58C25 54 21 49 17 42M46 60C53 55 57 49 63 42" stroke="#7d4b35" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
    + '<g fill="url(#skA)"><circle cx="40" cy="26" r="17"/><circle cx="22" cy="34" r="13"/><circle cx="58" cy="33" r="14"/><circle cx="31" cy="15" r="12"/><circle cx="50" cy="14" r="12"/><circle cx="40" cy="40" r="12"/><circle cx="13" cy="44" r="8"/><circle cx="67" cy="44" r="8"/></g>'
    + '<g fill="#fff" opacity=".9"><circle cx="34" cy="22" r="2.2"/><circle cx="48" cy="28" r="2"/><circle cx="26" cy="36" r="2"/><circle cx="56" cy="22" r="2.2"/><circle cx="40" cy="12" r="1.8"/><circle cx="62" cy="38" r="1.8"/><circle cx="18" cy="42" r="1.8"/></g>'
    + '<g fill="#f06a9c"><circle cx="40" cy="30" r="1.7"/><circle cx="30" cy="30" r="1.5"/><circle cx="52" cy="38" r="1.6"/><circle cx="23" cy="26" r="1.5"/><circle cx="60" cy="30" r="1.5"/><circle cx="44" cy="19" r="1.4"/></g></svg>';
  const HEART = '<svg viewBox="0 0 32 30" width="100%" height="100%"><defs><linearGradient id="hrA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7db3"/><stop offset="1" stop-color="#d6336c"/></linearGradient></defs>'
    + '<path d="M16 29C6 21 1 15 1 9C1 4 5 1 9 1C12 1 15 3 16 6C17 3 20 1 23 1C27 1 31 4 31 9C31 15 26 21 16 29Z" fill="url(#hrA)"/><ellipse cx="9" cy="8" rx="3" ry="2" fill="#fff" opacity=".45" transform="rotate(-30 9 8)"/></svg>';
  function decor(host, k, bar) {
    const a = [];
    if (k === 'sakura') { const t = mk('div', 'sak-tree' + (bar ? ' bar' : '')); t.innerHTML = TREE; host.appendChild(t); a.push(t); }
    if (k === 'love') { const h = mk('div', 'fx-heart' + (bar ? ' bar' : '')); h.innerHTML = HEART; host.appendChild(h); a.push(h); }
    return a;
  }
  function attachFx(host, row, bar, kind) {
    const cv = mk('canvas', 'fxc'); host.appendChild(cv);
    const P = (FXP[kind] || FXP.other)[bar ? 1 : 0];
    const e = Fire.make(cv, { mode: kind, H: P.H, R: P.R, F: 1, W: row && row.classList.contains('mine') ? -22 : 22 });
    e.kind = kind;
    e.resize = () => {
      const w = host.offsetWidth, h = host.offsetHeight; if (!w || !h) return;
      e.size(w + P.pl + P.pr, h + P.pt + P.pb); e.cv.style.cssText = 'left:' + (-P.pl) + 'px;top:' + (-P.pt) + 'px;width:' + e.w + 'px;height:' + e.h + 'px';
      e.box = { x: P.pl, y: P.pt, w, h }; e.o.A = [P.pl + w - (bar ? 95 : 49), P.pt - 46];
    };
    const base = e.setOn; e.setOn = (v) => { if (v) e.resize(); if (v && !e.box) return; base(v); };
    host._fe = e; if (row) row._fire = e; if (fro) fro.observe(host);
    return e;
  }

  // ---------- full-screen effects (sender + live receiver) ----------
  const NS = 'http://www.w3.org/2000/svg'; let scEl = null, scT = null;
  function rain(el, n, fn) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.cssText = '--x:' + rnd(0, 100).toFixed(1) + '%;--dx:' + rnd(-60, 60).toFixed(0) + 'px;--t:' + rnd(1.6, 3).toFixed(2) + 's;--d:' + rnd(0, 1).toFixed(2) + 's;--s:' + rnd(4, 10).toFixed(1) + 'px';
      if (fn) fn(p, i); el.appendChild(p);
    }
  }
  const zig = (x, len, dr) => { const p = [[x, 0]]; let y = 0; while (y < len) { y += rnd(len * .07, len * .14); x += rnd(-dr, dr); p.push([x, y]); } return p; };
  function bolt(g, pts) {
    const d = 'M' + pts.map((q) => q[0].toFixed(0) + ' ' + q[1].toFixed(0)).join('L');
    ['b1', 'b2', 'b3'].forEach((c) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', c); g.appendChild(p); });
  }
  const SC = {
    fire: { ms: 3400, f(el, W, H) {
      const cv = mk('canvas', 'sc-cv'); el.appendChild(cv);
      const e = Fire.make(cv, { mode: 'screen', H: H * .5 * .11, F: .55, env: (t) => t < .35 ? t / .35 : t > 2.7 ? Math.max(0, (3.3 - t) / .6) : 1 });
      e.size(Math.round(W * .5), Math.round(H * .5)); el._fire = e; e.setOn(true);
    } },
    thunder: { ms: 2300, f(el, W, H) {
      const cv = mk('canvas', 'sc-cv'); cv.width = Math.round(W); cv.height = Math.round(H); el.appendChild(cv);
      const ctx = cv.getContext('2d');
      // fractal bolt: midpoint displacement + tapering side branches
      const bolt = (x0, len) => {
        const segs = [];
        const grow = (x1, y1, x2, y2, disp, w, depth) => {
          if (depth <= 0 || Math.hypot(x2 - x1, y2 - y1) < 5) { segs.push([x1, y1, x2, y2, w]); return; }
          const mx = (x1 + x2) / 2 + (Math.random() - .5) * disp, my = (y1 + y2) / 2 + (Math.random() - .5) * disp * .35;
          grow(x1, y1, mx, my, disp * .52, w, depth - 1); grow(mx, my, x2, y2, disp * .52, w, depth - 1);
          if ((depth === 4 || depth === 6) && w > .7 && Math.random() < (depth === 4 ? .6 : .35)) {
            const a = Math.atan2(y2 - y1, x2 - x1) + (Math.random() < .5 ? -1 : 1) * rnd(.3, .75), L = Math.hypot(x2 - x1, y2 - y1) * rnd(.9, 1.8);
            grow(mx, my, mx + Math.cos(a) * L, my + Math.sin(a) * L, disp * .55, w * .5, depth - 1);
          }
        };
        grow(x0, -10, x0 + rnd(-.14, .14) * W, len, W * .3, 2.4, 8);
        return segs;
      };
      const strikes = [{ t0: 0, segs: bolt(rnd(.2, .45) * W, H * rnd(.6, .78)), k: 1 }, { t0: .62, segs: bolt(rnd(.55, .85) * W, H * rnd(.5, .68)), k: .8 }];
      const level = (t) => t < 0 ? 0 : Math.exp(-t * 4.2) * (.55 + .45 * (Math.sin(t * 64) > -.2 ? 1 : .35)) * Math.min(1, t / .02 + .2);
      const t0 = performance.now();
      const draw = (now) => {
        if (!cv.isConnected) return;
        const t = (now - t0) / 1000; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H);
        let I = 0; strikes.forEach((s) => { I = Math.max(I, level(t - s.t0) * s.k); });
        ctx.fillStyle = 'rgba(6,9,30,' + (.32 * Math.min(1, I * 2.2)) + ')'; ctx.fillRect(0, 0, W, H);
        strikes.forEach((s) => {
          const lv = level(t - s.t0) * s.k; if (lv < .02) return;
          const g = ctx.createRadialGradient(s.segs[0][0], 0, 0, s.segs[0][0], 0, H * .75); g.addColorStop(0, 'rgba(190,210,255,' + (.38 * lv) + ')'); g.addColorStop(1, 'rgba(120,150,255,0)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          [[9, '110,140,255', .16], [3.4, '175,198,255', .45], [1, '255,255,255', 1]].forEach(([m, col, a]) => {
            ctx.strokeStyle = 'rgba(' + col + ',' + Math.min(1, a * lv * 1.3) + ')';
            s.segs.forEach((sg) => { ctx.lineWidth = Math.max(.6, sg[4] * m * (1 - sg[3] / H * .35)); ctx.beginPath(); ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[2], sg[3]); ctx.stroke(); });
          });
          ctx.globalCompositeOperation = 'source-over';
        });
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    } },
    ice: { ms: 4200, f(el) { rain(el, 46, (p, i) => { if (i % 6 === 0) { p.className = 'g'; p.style.setProperty('--s', rnd(12, 20).toFixed(0) + 'px'); } }); } },
    love: { ms: 3800, f(el) { rain(el, 26, (p, i) => { p.style.setProperty('--s', rnd(14, 30).toFixed(0) + 'px'); p.style.setProperty('--c', ['#ff7eb6', '#ff4d8d', '#ffc2dc', '#ef6fc9'][i % 4]); }); } },
    galaxy: { ms: 3300, f(el, W) {
      el.style.setProperty('--mx', (W * .7) + 'px'); el.style.setProperty('--my', (W * .37) + 'px');
      for (let i = 0; i < 8; i++) { const b = document.createElement('b'); b.style.cssText = '--x:' + rnd(-10, 60).toFixed(0) + '%;--y:' + rnd(0, 55).toFixed(0) + '%;--l:' + rnd(90, 170).toFixed(0) + 'px;--d:' + (i * .28 + rnd(0, .2)).toFixed(2) + 's'; el.appendChild(b); }
      for (let i = 0; i < 18; i++) { const s = document.createElement('i'); s.style.cssText = '--x:' + rnd(0, 100).toFixed(0) + '%;--y:' + rnd(0, 100).toFixed(0) + '%;--d:' + rnd(0, 1.6).toFixed(2) + 's'; el.appendChild(s); }
    } },
    sakura: { ms: 4600, f(el) { rain(el, 28, (p) => { p.style.setProperty('--s', rnd(10, 18).toFixed(0) + 'px'); p.style.setProperty('--t', rnd(2.2, 3.6).toFixed(2) + 's'); }); } },
    gold: { ms: 3600, f(el) { rain(el, 34, (p, i) => { p.style.setProperty('--s', rnd(8, 16).toFixed(0) + 'px'); if (i % 3 === 0) p.className = 'g'; }); } },
    gift: { ms: 3600, f(el) { rain(el, 44, (p, i) => { p.style.setProperty('--c', ['#ff4d6d', '#ffd166', '#5ff1e0', '#c9a6ec', '#fff', '#ff8a3d'][i % 6]); p.style.setProperty('--s', rnd(7, 13).toFixed(0) + 'px'); }); } }
  };
  function screen(k) {
    const d = SC[k]; if (!d || document.visibilityState !== 'visible' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const app = document.querySelector('.app'); if (!app) return;
    if (scEl) { if (scEl._fire) scEl._fire.setOn(false); scEl.remove(); clearTimeout(scT); }
    const el = mk('div', 'fx-screen sc-' + k), W = app.clientWidth, H = app.clientHeight;
    el.style.setProperty('--H', (H + 50) + 'px'); d.f(el, W, H); app.appendChild(el); scEl = el;
    scT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { if (el._fire) el._fire.setOn(false); el.remove(); if (scEl === el) scEl = null; }, 500); }, d.ms);
  }

  // ---------- hooks used by app.js ----------
  function after(row, bubble, key, data, mine) {
    index(bubble, key);
    if (bubble.querySelector('.spl')) watch(row);
    const k = data.fx; if (!k || !T[k] || data.sticker) return;
    bubble.classList.add('fx'); bubble.dataset.fx = k;
    const f = mk('div', 'fxb'); f.dataset.k = k; parts(f, PN[k]); bubble.insertBefore(f, bubble.firstChild);
    if (k === 'gift') { bubble.insertBefore(cover(), f.nextSibling); if (mine || opened.has(key)) bubble.classList.add('opened'); }
    attachFx(bubble, row, false, k); decor(bubble, k, false); row.classList.add(k === 'fire' ? 'fxo-row' : k === 'sakura' ? 'fxo-row3' : 'fxo-row2');
    watch(row);
  }
  function tap(e, key) {
    const t = e.target; if (!t.closest) return false;
    const s = t.closest('.spl');
    if (s) {
      if (s.classList.contains('open')) return false;
      s.classList.add('open'); opened.add(key + ':' + s.dataset.i); save();
      const r = s.getBoundingClientRect(); burst(s, r.left + r.width / 2, r.top + r.height / 2, 'spl', 7);
      if (navigator.vibrate) navigator.vibrate(10);
      return true;
    }
    const b = t.closest('.msg-bubble.fx');
    if (!b || t.closest('.reply-quote,.reaction-chip,a,.mention,.code-block')) return false;
    if (b.dataset.fx === 'gift' && !b.classList.contains('opened')) { openGift(b, key); return true; }
    const now = Date.now(); if (now - (b._ft || 0) < 280) return false; b._ft = now;
    hit(b, e.clientX, e.clientY); return false;
  }
  function edited(textEl, key) { opened.forEach((v) => { if (v.indexOf(key + ':') === 0) opened.delete(v); }); index(textEl, key); watch(textEl.closest('.msg-row')); }
  function clear(b) {
    [].slice.call(b.classList).forEach((c) => { if (c.indexOf('vn') === 0) b.classList.remove(c); });
    b.classList.remove('fx', 'opened', 'opening', 'fx-hit', 'revealing', 'flash'); delete b.dataset.fx;
    const r = b.closest('.msg-row'); if (r) r.classList.remove('fxwatch', 'fx-live', 'fxo-row');
  }
  const VN = { fire: [18, 780], ice: [22, 620], love: [16, 700], galaxy: [20, 720], sakura: [20, 760], thunder: [14, 640], gold: [26, 700], gift: [24, 600] };
  function vanish(row, k, done) {
    const b = row.querySelector('.msg-bubble'), v = VN[k];
    if (!b || !v || !row.isConnected) { done(); return; }
    if (b._fe) b._fe.boost = k === 'fire' ? 1 : 0;
    const r = b.getBoundingClientRect(); burst(b, r.left + r.width / 2, r.top + r.height / 2, k, v[0], 1.7);
    b.classList.add('vn', 'vn-' + k); if (navigator.vibrate) navigator.vibrate(k === 'thunder' ? [20, 30, 30] : 14);
    setTimeout(() => { b.style.opacity = '0'; done(); }, v[1]);
  }
  const quote = (d) => d.fx === 'gift' ? 'رسالة في قالب هدية 🎁' : mask(d.text);
  const search = (m) => (m.fx === 'gift' && !opened.has(m.k) && m.senderUid !== (C().uid && C().uid())) ? 'رسالة في قالب هدية' : mask(m.text);

  // ---------- composer: state + panel ----------
  const glass = document.querySelector('.composer-glass'), input = $('messageInput'), btn = $('fxToggleBtn'), panel = $('fxPanel'), chipsEl = $('fxChips');
  const ph0 = input ? input.placeholder : '';
  let outer = null, outerK = '', panelVis = false, cur = '', splAll = false, panelOpen = false, built = false, layer = null, giftTimer = null, tiles = {};

  function applyComposer() {
    if (outer && outerK !== cur) { const o = outer; outer = null; o.cv.style.transition = 'opacity .35s'; o.cv.style.opacity = 0; (o.extras || []).forEach((x) => { x.style.transition = 'opacity .35s'; x.style.opacity = 0; }); setTimeout(() => { o.setOn(false); o.cv.remove(); (o.extras || []).forEach((x) => x.remove()); if (glass._fe === o) glass._fe = null; }, 400); }
    if (cur && !outer) { outer = attachFx(glass, null, true, cur); outer.extras = decor(glass, cur, true); outerK = cur; outer.setOn(true); }
    if (cur) {
      glass.dataset.fx = cur;
      if (!layer || layer.dataset.k !== cur) {
        if (layer) layer.remove();
        layer = mk('div', 'fx-layer'); layer.dataset.k = cur; parts(layer, Math.round(PN[cur] * 1.7));
        glass.insertBefore(layer, glass.firstChild);
        glass.classList.remove('fx-in'); void glass.offsetWidth; glass.classList.add('fx-in');
        setTimeout(() => glass.classList.remove('fx-in'), 700);
      }
    } else {
      delete glass.dataset.fx;
      if (layer) { const l = layer; layer = null; l.classList.add('out'); setTimeout(() => l.remove(), 450); }
    }
    glass.dataset.spl = splAll ? '1' : '';
    input.placeholder = splAll ? 'رسالة مخفية…' : ph0;
    btn.classList.toggle('has', !!(cur || splAll));
    Object.keys(tiles).forEach((k) => tiles[k].classList.toggle('on', k === cur));
    if (built) { $('fxSplAll').classList.toggle('on', splAll); }
    drawChips();
    if (C().expand) C().expand();
  }
  function drawChips() {
    chipsEl.textContent = '';
    const add = (cls, label, off) => {
      const d = mk('div', 'fx-chip ' + cls); if (cls === 't') d.dataset.fx = cur;
      d.appendChild(mk('span', 'fc-dot')); d.appendChild(mk('b', null, label));
      const x = mk('button'); x.type = 'button'; x.innerHTML = X; x.setAttribute('aria-label', 'إزالة'); x.onclick = off; d.appendChild(x); chipsEl.appendChild(d);
    };
    if (cur) add('t', 'قالب ' + T[cur].n + ' ' + T[cur].e, () => pick(''));
    if (splAll) add('s', 'رسالة مخفية', () => setSpl(false));
    chipsEl.classList.toggle('has', !!chipsEl.firstChild);
  }
  function focusInput() { setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) {} }, 80); }
  function pick(k) {
    if (k && k === cur) k = '';
    cur = k; applyComposer();
    if (navigator.vibrate) navigator.vibrate(k ? 14 : 8);
    if (k) { closePanel(); focusInput(); }
  }
  function setSpl(v) { splAll = v; applyComposer(); if (v) { closePanel(); focusInput(); } }
  function wrapSel() {
    const v = input.value; let a = input.selectionStart, b = input.selectionEnd;
    const warn = () => C().toast && C().toast('حدّد جزءًا من النص أولًا ثم اضغط', null, null, true, 2400);
    if (a == null || a === b) return warn();
    const s = v.slice(a, b); a += s.length - s.trimStart().length; b -= s.length - s.trimEnd().length;
    if (b <= a) return warn();
    input.value = v.slice(0, a) + '||' + v.slice(a, b) + '||' + v.slice(b);
    const p = b + 4; closePanel(); input.dispatchEvent(new Event('input'));
    setTimeout(() => { try { input.focus({ preventScroll: true }); input.setSelectionRange(p, p); } catch (e) {} }, 90);
  }
  function outgoing(text) {
    let t = text;
    if (splAll && !new RegExp('^' + SPL + '$').test(t)) t = '||' + (t.length > 996 ? t.slice(0, 996) : t) + '||';
    const fx = cur; cur = ''; splAll = false; applyComposer();
    return { text: t, fx };
  }

  function demo(k) {
    const b = mk('div', 'msg-bubble fx'); b.dataset.fx = k;
    const f = mk('div', 'fxb'); f.dataset.k = k; parts(f, PN[k]); b.appendChild(f);
    if (k === 'gift') b.appendChild(cover());
    { const de = attachFx(b, null, false, k); decor(b, k, false); de.vis = false; demoFires.push(de); if (tileIO) tileIO.observe(b); }
    b.appendChild(mk('div', 'msg-text', 'مرحبًا بك'));
    return b;
  }
  function build() {
    built = true;
    panel.innerHTML = '<div class="panel-switch" id="fxSwitch" data-m="tpl"><i class="ps-ink"></i><button data-m="tpl" class="active">القوالب</button><button data-m="spl">تأثيرات الرسالة</button></div>'
      + '<div class="fx-view fx-v-tpl"><div class="fx-scroll"><div class="fx-hint">اختر قالبًا ثم اكتب رسالتك، ويعود الشريط لطبيعته بعد الإرسال. اضغط القالب مرة أخرى لإلغائه.</div><div class="fx-grid" id="fxGrid"></div></div></div>'
      + '<div class="fx-view fx-v-spl"><div class="fx-scroll">'
      + '<div class="fx-card"><b>إخفاء النص (Spoiler)</b><p>جرّب بنفسك: <span class="spl" id="fxDemoSpl">اضغط لتكشف السر</span></p></div>'
      + '<button class="notif-toggle" id="fxSplAll"><span class="opt-txt"><b>إخفاء الرسالة كاملة</b><small>تُرسَل مخفية ولا تنكشف إلا بالضغط عليها</small></span><span class="switch"></span></button>'
      + '<button class="notif-toggle" id="fxSplSel" style="margin-top:8px"><span class="opt-txt"><b>إخفاء الجزء المحدد</b><small>حدّد كلمات داخل رسالتك ثم اضغط هنا</small></span><span class="srch-ic"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9h16M4 15h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/><circle cx="19" cy="15" r="1.3" fill="currentColor"/></svg></span></button>'
      + '<div class="fx-tip">اختصار سريع: اكتب النص بين خطين عموديين مثل <code>||سر||</code> وسيُخفى فور إرساله.</div></div></div>';
    const grid = $('fxGrid');
    Object.keys(T).forEach((k) => {
      const tl = mk('div', 'fx-tile'); tl.dataset.fx = k;
      const st = mk('div', 'fx-stage'); st.appendChild(demo(k)); tl.appendChild(st); tl.appendChild(mk('b', null, T[k].n + ' ' + T[k].e));
      tl.addEventListener('click', () => pick(k)); grid.appendChild(tl); tiles[k] = tl;
    });
    const sw = $('fxSwitch');
    sw.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sw.dataset.m = b.dataset.m; panel.classList.toggle('m-spl', b.dataset.m === 'spl'); sw.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); });
    $('fxSplAll').addEventListener('click', () => setSpl(!splAll));
    $('fxSplSel').addEventListener('click', wrapSel);
    $('fxDemoSpl').addEventListener('click', (e) => e.currentTarget.classList.toggle('open'));
    applyComposer();
  }
  function openPanel() {
    if (panelOpen) return;
    if (C().closeEmoji) C().closeEmoji();
    if (!built) build();
    $('fxSplSel').classList.toggle('dim', input.selectionStart === input.selectionEnd);
    panel.classList.add('open'); btn.classList.add('active'); panelOpen = true;
    if (document.activeElement === input) input.blur();
    FRNav.push('fx', hidePanel); panelVis = true; demoFires.forEach((e) => e.setOn(e.vis));
    const g = panel.querySelector('.fx-stage .msg-bubble[data-fx="gift"]');
    if (g) giftTimer = setInterval(() => { const o = g.classList.toggle('opened'); if (o) { g.classList.add('revealing'); setTimeout(() => g.classList.remove('revealing'), 700); } }, 2800);
    if (C().expand) C().expand();
  }
  function hidePanel() {
    panel.classList.remove('open'); btn.classList.remove('active'); panelOpen = false;
    clearInterval(giftTimer); giftTimer = null; panelVis = false; demoFires.forEach((e) => e.setOn(false)); if (C().expand) C().expand();
  }
  function closePanel() { if (panelOpen) FRNav.back('fx'); }
  btn.addEventListener('click', () => { if (panelOpen) closePanel(); else openPanel(); });
  document.addEventListener('pointerdown', (e) => { if (panelOpen && !e.target.closest('.fx-panel') && !e.target.closest('#fxToggleBtn')) closePanel(); }, true);

  window.FRFx = { vanish, screen: (k) => { if (k !== 'gift') screen(k); }, after, tap, edited, clear, quote, search, outgoing, closePanel, isOpen: () => panelOpen || !!cur || splAll };
})();
