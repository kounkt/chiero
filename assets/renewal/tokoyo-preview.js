import { kami } from './tokoyo-kami.js';

// Original TOKOYO work 001 (chiero_site/tokoyo/works.js).
// The formula and all 40,000 points are preserved; the host controls scheduling.
const { sin, cos, sqrt } = Math;
const TAU = Math.PI * 2;
const kurage = {
  slug: '001_kurage', name: '水母', ink: 0.3, trail: 0.88, n: 40000, loop: 1,
  f: (i, t,
      b = i * 2.39996, d = sqrt(i / 25600),
      r = 110 * sin(d * 1.5708) * (1 + .13 * sin(d * 6 - t * 3)),
      j = i - 25600, m = j % 20, s = (j / 20 | 0) / 720,
      q = 58 * (1 - .24 * s), a = m / 20 * TAU,
      Q = i < 25600
      ? [200 + r * cos(b), 138 + r * sin(b) * .36 + 52 * d * d + 8 * sin(t * 3)]
      : [200 + q * cos(a) + 19 * s * sin(s * 5 - t * 3 + m) + 7 * s * sin(t * 2 + m * 3),
         178 + q * sin(a) * .36 + 172 * s + 8 * sin(s * 9 - t * 3 + m)],
      Dx = 200 + 46 * sin(t + 0.0) + 22 * sin(t * 2 + 0.0),
      Dy = 200 + 50 * cos(t + 0.0) + 16 * sin(t * 3 + 0.0)
     ) => [Dx + (Q[0] - 200) * .68, Dy + (Q[1] - 200) * .68]
};

export function startTokoyoPreview(mount) {
  const en = document.documentElement.lang === 'en';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const button = mount.closest('figure').querySelector('.tokoyo-motion');
  const artwork = kami({ ...kurage, mount, dark: true, size: 480, dpr: 1.5, manual: true });
  const canvas = artwork.canvas;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', en ? 'TOKOYO Kurage: a jellyfish drawn with 40,000 mathematical points' : '常世・水母。40,000の点を数式で描いたクラゲ');
  mount.querySelector('.tokoyo-fallback').hidden = true;
  let paused = false, visible = false, request = 0, previous = 0;
  let time = 0;
  // Seed the original trail for a clear first frame, including reduced motion.
  for (let i = 0; i < 8; i++) artwork.frame();
  const isPaused = () => paused || preference.matches || document.body.classList.contains('motion-off');
  const tick = timestamp => {
    request = requestAnimationFrame(tick);
    if (!previous) previous = timestamp;
    const elapsed = timestamp - previous;
    if (elapsed < 1000 / 30) return;
    time += Math.min(elapsed, 100) / 1000 * TAU / 5;
    previous = timestamp;
    artwork.seek(time);
  };
  const sync = () => {
    cancelAnimationFrame(request);
    request = 0;
    previous = 0;
    const held = isPaused();
    button.setAttribute('aria-pressed', String(held));
    button.textContent = preference.matches ? (en ? 'Reduced motion enabled' : '動きを抑える設定中') : held ? (en ? 'Resume motion' : '動きを再開する') : (en ? 'Pause motion' : '動きを止める');
    button.disabled = preference.matches;
    if (visible && !document.hidden && !held) request = requestAnimationFrame(tick);
  };
  button.hidden = false;
  button.addEventListener('click', () => {
    if (document.body.classList.contains('motion-off')) {
      document.querySelector('.motion-button')?.click();
      paused = false;
    } else paused = !paused;
    sync();
  });
  const observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    sync();
  });
  observer.observe(mount);
  preference.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('chiero:motionchange', sync);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(request);
    request = 0;
  });
  window.addEventListener('pageshow', sync);
  sync();
}
