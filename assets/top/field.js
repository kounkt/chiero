// 最初の画面の水母（常世 001 と同じ式。点は指やカーソルで動く）。
// トップ（top.js）と、中のページ（hero.js）の両方が、この1つを読む。
import { kurage } from './kurage.js?v=73b74004c349';

const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)').matches;
const still = () => reduceQuery.matches || document.body.classList.contains('motion-off');

export function initField(shared = { dotX: -1, dotY: -1 }) {
  const cv = $('#official-fluid');
  const hero = $('#fluid-hero');
  if (!cv || !hero || !cv.getContext || !hero.classList.contains('kurage-hero')) return;   // 水母用の最初の画面でだけ動かす
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, D = 1, n = 0, small = false, heroTop = 0, heroLeft = 0;
  let x0, y0, ox, oy, vx, vy, sv, order, bStart, mv, ci, box, ei, extra = 0;
  const BUCKETS = 6;
  const ptr = { x: -9999, y: -9999, on: false };
  let raf = 0, visible = true, clock = 0, last = 0, born = 0, started = false;
  const minGap = coarse ? 1000 / 31 : 0;
  // 水母の置き場所。最初の画面の要素に data-kurage-x などを書くと、ページごとに変えられる（書かなければトップと同じ）。
  const num = (k, d) => { const v = parseFloat(hero.dataset[k]); return Number.isFinite(v) ? v : d; };
  const pos = {
    x: num('kurageX', root.lang === 'en' ? 0.81 : 0.74), y: num('kurageY', 0.42), s: num('kurageS', 1),   // 英語は見出しが横に長いので、水母を右へ寄せる
    spX: num('kurageSpX', 0.6), spY: num('kurageSpY', 0.7), spS: num('kurageSpS', 1),
  };

  const build = () => {
    const r = cv.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height); heroTop = r.top + scrollY; heroLeft = r.left;
    small = W < 700;
    D = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D);
    const gap = small ? 16 : 18;
    const cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
    n = cols * rows;
    x0 = new Float32Array(n); y0 = new Float32Array(n);
    ox = new Float32Array(n); oy = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    sv = new Float32Array(n);
    const bucket = new Uint8Array(n);
    const offX = (W - (cols - 1) * gap) / 2, offY = (H - (rows - 1) * gap) / 2;
    let k = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++, k++) {
      const x = offX + i * gap, y = offY + j * gap;
      x0[k] = x; y0[k] = y;
      let s;
      if (small) { const yn = y / H; s = smooth(pos.spY - 0.18, pos.spY - 0.06, yn) * (1 - smooth(0.9, 0.98, yn)); }   // スマホ：ボタンの下の空きに水母を置く
      else s = smooth(0.38, 0.94, x / W + 0.16 * (0.5 - y / H));
      sv[k] = s;
      bucket[k] = Math.min(BUCKETS - 1, Math.floor(s * BUCKETS));
    }
    // 水母になる点：流れの強い所の点ほど、強く引き寄せる。上の点が傘、下の点が触手になるように、式の番号を上から順に割り当てる。
    mv = new Float32Array(n); ci = new Float32Array(n);
    let count = 0;
    for (let q = 0; q < n; q++) { mv[q] = smooth(0.1, 0.62, sv[q]); if (mv[q] > 0) count++; }
    let rank = 0;
    for (let q = 0; q < n; q++) if (mv[q] > 0) ci[q] = Math.floor((rank++ + 0.5) * kurage.n / count);
    // 水母の置き場所と大きさ。式の中の水母は大きく漂うので、画面の側が漂いの一部を追う（式は変えない。見る枠だけを動かす）。
    box = small
      ? { cx: W * pos.spX, cy: H * pos.spY, S: Math.min(W * 1.2, 500) / 400 * pos.spS, follow: 0.75 }
      : { cx: W * pos.x, cy: H * pos.y, S: Math.min(H * 1.3, W * 0.74) / 400 * pos.s, follow: 0.35 };
    // 方眼の点だけでは水母が粗いので、同じ式から、水母だけの点を足す。
    extra = small ? 900 : 2600;
    ei = new Float32Array(extra);
    for (let e = 0; e < extra; e++) ei[e] = Math.floor((e + 0.5) * kurage.n / extra);
    // 濃さの段ごとに並べ替えておく（描く時に色を6回だけ切り替える）。
    order = new Uint32Array(n); bStart = new Uint32Array(BUCKETS + 1);
    let w = 0;
    for (let b = 0; b < BUCKETS; b++) { bStart[b] = w; for (let q = 0; q < n; q++) if (bucket[q] === b) order[w++] = q; }
    bStart[BUCKETS] = w;
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const tk = t * 0.7;                       // 水母の時刻（約9秒でひと巡り）
    const c0 = kurage.f(0, tk);               // 傘のてっぺん。見る枠は、これを少し追う
    const camX = 200 + (c0[0] - 200) * box.follow, camY = 200 + (c0[1] - 158) * box.follow;
    const dx0 = shared.dotX - heroLeft, dy0 = shared.dotY - (heroTop - scrollY);
    const dotOn = shared.dotX >= 0 && dy0 > -200 && dy0 < H + 200;
    const fade = still() ? 1 : clamp((performance.now() - born) / 1400, 0, 1);
    const R = small ? 90 : 150, R2 = R * R;
    for (let b = 0; b < BUCKETS; b++) {
      const sb = (b + 0.5) / BUCKETS;
      ctx.fillStyle = `rgba(255,255,255,${(((small ? 0.07 : 0.08) + 0.4 * sb) * fade).toFixed(3)})`;
      const size = Math.max(1, Math.round((1.3 + 0.7 * sb) * D)), half = size / 2;
      for (let q = bStart[b]; q < bStart[b + 1]; q++) {
        const k = order[q];
        const x = x0[k], y = y0[k], s = sv[k];
        let px = x, py = y;
        const m = mv[k];
        if (m > 0) {
          const c = kurage.f(ci[k], tk);
          px = x + (box.cx + (c[0] - camX) * box.S - x) * m;
          py = y + (box.cy + (c[1] - camY) * box.S - y) * m;
        }
        if (dotOn) {
          const ex = x - dx0, ey = y - dy0;
          const d = Math.sqrt(ex * ex + ey * ey) + 0.001;
          if (d < 900) {
            const ring = Math.sin(d * 0.042 - t * 1.5) * 3.4 * Math.exp(-d / 460);
            px += (ex / d) * ring; py += (ey / d) * ring;
          }
        }
        if (ptr.on) {
          const qx = px - ptr.x, qy = py - ptr.y, d2 = qx * qx + qy * qy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) + 0.001, f = (1 - d / R);
            vx[k] += (qx / d) * f * f * 2.4; vy[k] += (qy / d) * f * f * 2.4;
          }
        }
        if (vx[k] !== 0 || vy[k] !== 0 || ox[k] !== 0 || oy[k] !== 0) {
          vx[k] = (vx[k] - ox[k] * 0.05) * 0.86; vy[k] = (vy[k] - oy[k] * 0.05) * 0.86;
          ox[k] += vx[k]; oy[k] += vy[k];
          if (Math.abs(ox[k]) + Math.abs(oy[k]) + Math.abs(vx[k]) + Math.abs(vy[k]) < 0.02) { ox[k] = oy[k] = vx[k] = vy[k] = 0; }
          px += ox[k]; py += oy[k];
        }
        ctx.fillRect((px * D - half) | 0, (py * D - half) | 0, size, size);
      }
    }
    // 水母だけの点
    ctx.fillStyle = `rgba(255,255,255,${(0.86 * fade).toFixed(3)})`;
    const es = Math.max(1, Math.round((small ? 1.6 : 1.7) * D)), eh = es / 2;
    for (let e = 0; e < extra; e++) {
      const c = kurage.f(ei[e], tk);
      let px = box.cx + (c[0] - camX) * box.S, py = box.cy + (c[1] - camY) * box.S;
      if (ptr.on) {
        const qx = px - ptr.x, qy = py - ptr.y, d2 = qx * qx + qy * qy;
        if (d2 < R2) { const d = Math.sqrt(d2) + 0.001, f = 1 - d / R; px += (qx / d) * f * f * R * 0.28; py += (qy / d) * f * f * R * 0.28; }
      }
      ctx.fillRect((px * D - eh) | 0, (py * D - eh) | 0, es, es);
    }
  };

  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (minGap && now - last < minGap) return;
    const dt = Math.min(now - (last || now), 60) / 1000;
    last = now; clock += dt;
    draw(clock + 9);
    if (!started) { started = true; hero.classList.add('kurage-on'); }
  };
  const sync = () => {
    cancelAnimationFrame(raf); raf = 0; last = 0;
    if (still()) { draw(9); if (!started) { started = true; hero.classList.add('kurage-on'); } return; }
    if (visible && !document.hidden) raf = requestAnimationFrame(tick);
  };

  build(); born = performance.now();
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }).observe(hero);
  let rw = innerWidth;
  addEventListener('resize', () => { if (innerWidth === rw && small) return; rw = innerWidth; build(); sync(); });
  addEventListener('pointermove', (e) => {
    ptr.x = e.clientX - heroLeft; ptr.y = e.clientY - (heroTop - scrollY);
    ptr.on = ptr.y > -40 && ptr.y < H + 40;
  }, { passive: true });
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) ptr.on = false; });
  addEventListener('touchend', () => { ptr.on = false; }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('chiero:motionchange', sync);
  reduceQuery.addEventListener('change', sync);
  sync();
}
