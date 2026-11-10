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

  const BASE = '#0f0818';

  // Fewer, much bigger blobs (radius ~90-130% of the larger viewport
  // dimension) so each one reads as a clear, dominant wash of color like
  // a soft nebula - not a handful of small faint dots.
  const blobs = [
    { color: [107, 48, 172],  cx: 0.22, cy: 0.28, ax: 0.16, ay: 0.12, freqX: 0.000085, freqY: 0.00011,  phase: 0.0, rBase: 1.05, rAmp: 0.12, rFreq: 0.00009 },
    { color: [60, 24, 110],   cx: 0.80, cy: 0.70, ax: 0.14, ay: 0.16, freqX: -0.00010, freqY: 0.000095, phase: 2.1, rBase: 0.95, rAmp: 0.10, rFreq: 0.00011 },
    { color: [130, 58, 190],  cx: 0.55, cy: 0.92, ax: 0.18, ay: 0.10, freqX: 0.000075, freqY: -0.00012, phase: 4.2, rBase: 0.85, rAmp: 0.11, rFreq: 0.00008 }
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

    ctx.fillStyle = BASE;
    ctx.fillRect(0, 0, w, h);

    const maxDim = Math.max(w, h);
    blobs.forEach(b => {
      const x = (b.cx + Math.sin(t * b.freqX + b.phase) * b.ax) * w;
      const y = (b.cy + Math.cos(t * b.freqY + b.phase * 1.3) * b.ay) * h;
      const rPulse = b.rBase + Math.sin(t * b.rFreq + b.phase) * b.rAmp;
      const radius = rPulse * maxDim * 0.62;
      const [r, g, bl] = b.color;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0,   `rgba(${r},${g},${bl},0.95)`);
      grad.addColorStop(0.35, `rgba(${r},${g},${bl},0.55)`);
      grad.addColorStop(0.7, `rgba(${r},${g},${bl},0.18)`);
      grad.addColorStop(1,   `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
})();
