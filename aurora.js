/* Lively, continuously-moving color-wave background - video-like motion,
   not a near-static gradient. Calm palette, no particles/sprites. */
(() => {
  'use strict';
  const canvas = document.getElementById('auroraCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, dpr;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const colors = [
    { r: 155, g: 89, b: 182 },   // purple
    { r: 95, g: 241, b: 224 },   // neon cyan
    { r: 239, g: 111, b: 201 },  // neon pink
    { r: 107, g: 63, b: 168 }    // deep violet
  ];

  // Each blob drifts along its own Lissajous-style path and slowly
  // changes size, so the motion reads as continuous and organic rather
  // than a fixed gradient - a full loop takes roughly 14-22 seconds.
  const blobs = [
    { cx: 0.28, cy: 0.32, ax: 0.22, ay: 0.16, freqX: 0.00022, freqY: 0.00031, phase: 0.0,  rBase: 0.5, rAmp: 0.08, rFreq: 0.00019, colorIdx: 0, alpha: 0.20 },
    { cx: 0.74, cy: 0.62, ax: 0.18, ay: 0.20, freqX: -0.00026, freqY: 0.00024, phase: 1.7, rBase: 0.55, rAmp: 0.09, rFreq: 0.00023, colorIdx: 1, alpha: 0.14 },
    { cx: 0.5,  cy: 0.86, ax: 0.26, ay: 0.14, freqX: 0.00020, freqY: -0.00028, phase: 3.4, rBase: 0.46, rAmp: 0.07, rFreq: 0.00017, colorIdx: 2, alpha: 0.16 },
    { cx: 0.18, cy: 0.78, ax: 0.15, ay: 0.18, freqX: -0.00024, freqY: -0.00020, phase: 5.1, rBase: 0.4, rAmp: 0.06, rFreq: 0.00021, colorIdx: 3, alpha: 0.15 }
  ];

  let raf = null;
  let visible = true;
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible && raf === null) raf = requestAnimationFrame(loop);
  });

  function loop(ts) {
    if (!visible) { raf = null; return; }
    const t = ts || 0;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    blobs.forEach(b => {
      const x = (b.cx + Math.sin(t * b.freqX + b.phase) * b.ax) * w;
      const y = (b.cy + Math.cos(t * b.freqY + b.phase * 1.3) * b.ay) * h;
      const rPulse = b.rBase + Math.sin(t * b.rFreq + b.phase) * b.rAmp;
      const radius = rPulse * Math.max(w, h) * 0.6;
      const c = colors[b.colorIdx];
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${b.alpha})`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
})();
