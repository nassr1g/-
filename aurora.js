/* Calm, clearly-visible moving color wash - big soft blobs of color that
   slowly drift and bleed into a dark background, like a slow-motion nebula.
   No small particles, no "lighter" additive blending (that was washing
   everything out into one flat glow) - each blob is a huge, fully-opaque-
   at-its-core radial gradient painted straight onto the dark base, so the
   color actually reads clearly while still feeling soft and alive. */
(() => {
  'use strict';
  const canvas = document.getElementById('auroraCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, dpr;

  let baseW = 0;
  function resize() {
    dpr = 0.5; // soft blobs don't need full resolution: a quarter of the pixels to paint
    const iw = window.innerWidth, ih = window.innerHeight;
    // The on-screen keyboard only shrinks the HEIGHT: ignore that, so the background never changes when it opens.
    // (A real change of width, e.g. rotation, resets it.)
    if (!baseW || iw !== baseW) { baseW = iw; h = ih; } else if (ih > h) h = ih;
    w = iw;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const BASE = '#0b0613';
  const AUR = {"galaxy": {"b": "#040a1a", "c": [[28, 84, 214], [16, 44, 140], [40, 150, 255]]}, "brown": {"b": "#0f0a06", "c": [[120, 66, 30], [70, 38, 18], [150, 90, 45]]}, "green": {"b": "#050f0a", "c": [[20, 120, 70], [10, 70, 45], [40, 160, 95]]}, "pink": {"b": "#14060f", "c": [[190, 50, 120], [110, 28, 80], [230, 90, 160]]}, "orange": {"b": "#130a04", "c": [[200, 95, 20], [120, 55, 12], [245, 140, 40]]}, "night": {"b": "#030106", "c": [[48, 14, 90], [22, 6, 52], [80, 22, 125]]}};

  // Fewer, much bigger blobs (radius ~90-130% of the larger viewport
  // dimension) so each one reads as a clear, dominant wash of color like
  // a soft nebula - not a handful of small faint dots. Frequencies are
  // fast enough that motion is obvious within a second, not just over
  // many seconds - a full drift cycle takes roughly 5-7 seconds.
  const blobs = [
    { color: [107, 48, 172],  cx: 0.22, cy: 0.28, ax: 0.22, ay: 0.18, freqX: 0.00075, freqY: 0.00095,  phase: 0.0, rBase: 1.05, rAmp: 0.16, rFreq: 0.0009 },
    { color: [60, 24, 110],   cx: 0.80, cy: 0.70, ax: 0.20, ay: 0.22, freqX: -0.00085, freqY: 0.0008, phase: 2.1, rBase: 0.95, rAmp: 0.14, rFreq: 0.0011 },
    { color: [130, 58, 190],  cx: 0.55, cy: 0.92, ax: 0.24, ay: 0.16, freqX: 0.00065, freqY: -0.001, phase: 4.2, rBase: 0.85, rAmp: 0.15, rFreq: 0.0008 }
  ];

  let raf = null, lastDraw = 0;
  let visible = true;
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible && raf === null) raf = requestAnimationFrame(loop);
  });

  function loop(ts) {
    if (!visible) { raf = null; return; }
    if (ts - lastDraw < 32) { raf = requestAnimationFrame(loop); return; } // ~30fps leaves the CPU/GPU free for scrolling
    lastDraw = ts;
    const t = ts || 0;

    const th = document.documentElement.dataset.theme, gal = th === 'galaxy', A = AUR[th];
    ctx.fillStyle = A ? A.b : BASE;
    ctx.fillRect(0, 0, w, h);

    const maxDim = Math.max(w, h);
    blobs.forEach((b, bi) => {
      const x = (b.cx + Math.sin(t * b.freqX + b.phase) * b.ax) * w;
      const y = (b.cy + Math.cos(t * b.freqY + b.phase * 1.3) * b.ay) * h;
      const rPulse = b.rBase + Math.sin(t * b.rFreq + b.phase) * b.rAmp;
      const radius = rPulse * maxDim * 0.62;
      const [r, g, bl] = A ? A.c[bi] : b.color;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0,    `rgba(${r},${g},${bl},0.92)`);
      grad.addColorStop(0.28, `rgba(${r},${g},${bl},0.62)`);
      grad.addColorStop(0.55, `rgba(${r},${g},${bl},0.28)`);
      grad.addColorStop(0.8,  `rgba(${r},${g},${bl},0.08)`);
      grad.addColorStop(1,    `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    if (gal) drawDust(t);

    raf = requestAnimationFrame(loop);
  }
  // soft drifting dust + bokeh, only in the galaxy theme (blue/white/violet specks that twinkle)
  let dust = null;
  const DCOL = [[255, 255, 255], [190, 225, 255], [120, 190, 255], [170, 150, 255]];
  function drawDust(t) {
    if (!dust) dust = Array.from({ length: 52 }, (_, i) => {
      const bokeh = i % 4 === 0;
      return { x: Math.random(), y: Math.random(), vx: (Math.random() - 0.3) * 0.000018, vy: -(0.000008 + Math.random() * 0.00002),
        r: bokeh ? 9 + Math.random() * 16 : 1.2 + Math.random() * 2.6, a: bokeh ? 0.10 + Math.random() * 0.12 : 0.45 + Math.random() * 0.5,
        f: 0.0006 + Math.random() * 0.0016, ph: Math.random() * 6.28, c: DCOL[(Math.random() * DCOL.length) | 0], bokeh };
    });
    ctx.globalCompositeOperation = 'lighter';
    for (const p of dust) {
      const x = (((p.x + t * p.vx) % 1) + 1) % 1 * w, y = (((p.y + t * p.vy) % 1) + 1) % 1 * h;
      const a = p.a * (0.55 + 0.45 * Math.sin(t * p.f + p.ph)), [r, g, b] = p.c;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, p.r);
      grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(p.bokeh ? 0.7 : 0.35, `rgba(${r},${g},${b},${p.bokeh ? a * 0.6 : a * 0.35})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  raf = requestAnimationFrame(loop);
})();
