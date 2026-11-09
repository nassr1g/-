/* Subtle animated color-wave background. Calm, slow, no particles. */
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
    { r: 123, g: 79, h: 201 },   // accent-2 purple
    { r: 95, g: 241, h: 224 },   // neon cyan (used sparingly)
    { r: 239, g: 111, h: 201 },  // neon pink (used sparingly)
    { r: 91, g: 58, h: 153 }     // accent-3
  ];

  // Three soft blobs drifting slowly, blended with low alpha for a wave-like feel.
  const blobs = [
    { cx: 0.25, cy: 0.3, r: 0.55, speedX: 0.00009, speedY: 0.00011, phase: 0, colorIdx: 0 },
    { cx: 0.75, cy: 0.65, r: 0.6, speedX: -0.00007, speedY: 0.00008, phase: 2, colorIdx: 1 },
    { cx: 0.5, cy: 0.85, r: 0.5, speedX: 0.00006, speedY: -0.00009, phase: 4, colorIdx: 2 }
  ];

  let raf = null;
  let visible = true;
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) loop();
  });

  function loop(ts) {
    if (!visible) return;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    blobs.forEach(b => {
      const t = (ts || 0);
      const x = (b.cx + Math.sin(t * b.speedX + b.phase) * 0.12) * w;
      const y = (b.cy + Math.cos(t * b.speedY + b.phase) * 0.1) * h;
      const radius = b.r * Math.max(w, h) * 0.55;
      const c = colors[b.colorIdx];
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.h},0.14)`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.h},0)`);
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
