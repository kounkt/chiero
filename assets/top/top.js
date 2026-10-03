// chiero.jp トップ：今のサイトに足す3つの動き（2026-10-03）
// 1. 最初の画面の水母（常世 001 と同じ式。点は指やカーソルで動く）
// 2. 赤い点（見出しの句点から出て、章の印をたどり、最後に CHIERO の O に着く）
// 3. 数字の数え上げ（画面に入った時に、0 から本当の値まで）
// 今ある動き（home-motion.js・home-editorial.js）と、動きを止める仕組み（body.motion-off）はそのまま使う。
import { kurage } from './kurage.js?v=73b74004c349';

const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)').matches;
const still = () => reduceQuery.matches || document.body.classList.contains('motion-off');
const shared = { dotX: -1, dotY: -1 };
const ready = new WeakSet();

function initField() {
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
      if (small) { const yn = y / H; s = smooth(0.52, 0.64, yn) * (1 - smooth(0.9, 0.98, yn)); }   // スマホ：ボタンの下の空きに水母を置く
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
      ? { cx: W * 0.6, cy: H * 0.7, S: Math.min(W * 1.2, 500) / 400, follow: 0.75 }
      : { cx: W * (root.lang === 'en' ? 0.81 : 0.74), cy: H * 0.42, S: Math.min(H * 1.3, W * 0.74) / 400, follow: 0.35 };   // 英語は見出しが横に長いので、水母を右へ寄せる
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

function initDot() {
  const dot = document.createElement('i'); dot.id = 'dot'; dot.className = 'dot'; dot.setAttribute('aria-hidden', 'true');
  const trailSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); trailSvg.id = 'trail'; trailSvg.setAttribute('class', 'trail'); trailSvg.setAttribute('aria-hidden', 'true');
  trailSvg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'polyline'));
  document.body.append(trailSvg, dot);
  const marks = $$('[data-dot]');
  if (!dot || marks.length < 2) return;
  const secs = marks.map(() => null);
  const ys = marks.map(() => 0);
  const offY = (el) => { let y = 0, e = el; while (e) { y += e.offsetTop; e = e.offsetParent; } return y; };
  // 組版済みの章の印は正確な位置。まだの章の印は、章の上端からの見込み（章が近づいたら測り直す）。
  const measure = () => {
    for (let i = 0; i < marks.length; i++) {
      ys[i] = (!secs[i] || ready.has(secs[i])) ? offY(marks[i]) + marks[i].offsetHeight / 2 : offY(secs[i]) + 160;
    }
    for (let i = 1; i < ys.length; i++) if (ys[i] <= ys[i - 1]) ys[i] = ys[i - 1] + 1;
    findHosts();
    const first = marks.findIndex((m, i) => i > 0 && m.dataset.dot === '' && (!secs[i] || ready.has(secs[i])));
    if (first > 0) { const r = marks[first].getBoundingClientRect(); railX = r.left + r.width / 2; }
  };
  const shapeOf = (i) => {
    const el = marks[i];
    if (secs[i] && !ready.has(secs[i])) return { x: railX, y: ys[i] - scrollY, w: 10, h: 10, r: 5, t: 10 };
    const r = el.getBoundingClientRect();
    const kind = el.dataset.dot;
    // ボタンと大きな O へは、小さな点のまま着く（着いたら、相手が自分で赤くなる）。
    // 大きな赤い面を動く点にすると、スクロール中に相手からずれて見える。
    if (kind === 'cta') return { x: r.left + 10, y: r.top + r.height / 2, w: 12, h: 12, r: 6, t: 12 };
    if (kind === 'o') return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: 14, h: 14, r: 7, t: 14 };
    const rad = kind === 'rakkan' ? 0 : Math.min(r.width, r.height) / 2;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, r: rad, t: Math.min(14, r.width, r.height) };
  };
  // 印ごとの「横に動いてよい高さ」。印を含む箱のうち、上の余白が48px以上ある一番近い箱の、余白の真ん中。
  const hosts = marks.map(() => null);
  const findHosts = () => {
    marks.forEach((m, i) => {
      if (secs[i] && !ready.has(secs[i])) { hosts[i] = null; return; }
      let e = m.parentElement;
      while (e && e !== document.body) {
        const pt = parseFloat(getComputedStyle(e).paddingTop) || 0;
        if (pt >= 48) { hosts[i] = { el: e, half: pt / 2 }; return; }
        e = e.parentElement;
      }
      hosts[i] = null;
    });
  };
  let railX = 24;
  // 印 i から i+1 への道筋（画面の座標）。縦に進み、余白の高さで横に動き、また縦に進む。
  const stacked = matchMedia('(max-width:860px)');
  const offRail = (m) => m.dataset.dot === 'year' || m.dataset.dot === 'rakkan';
  const route = (i, a, b) => {
    const A = marks[i], B = marks[i + 1];
    const pts = [[a.x, a.y]];
    if (Math.abs(a.x - b.x) < 2) { pts.push([b.x, b.y]); return pts; }
    const R = innerWidth - Math.max(12, railX);                 // 右の余白の通り道
    let cx = a.x;
    if (A.dataset.leave === 'right' && stacked.matches) { cx = R; pts.push([cx, a.y]); }   // スマホの句点：行の右へ抜けてから下りる（真下は本文とボタン）
    else if (A.dataset.via === 'side' || (stacked.matches && offRail(A))) { cx = railX; pts.push([cx, a.y]); }
    // 入る向き：横から（左の通り道）／右から（右の通り道）／上から（章の上の余白）
    const fromLeft = B.dataset.via === 'side' || (stacked.matches && offRail(B));
    const ex = fromLeft ? railX : B.dataset.via === 'right' ? R : b.x;
    if (Math.abs(cx - ex) > 2) {
      const h = hosts[i + 1];
      let yv = h && h.el !== (hosts[i] && hosts[i].el) ? h.el.getBoundingClientRect().top + h.half : (a.y + b.y) / 2;
      yv = clamp(yv, Math.min(a.y, b.y), Math.max(a.y, b.y));
      pts.push([cx, yv]); pts.push([ex, yv]);
    }
    if (Math.abs(ex - b.x) > 2) pts.push([ex, b.y]);
    pts.push([b.x, b.y]);
    return pts;
  };
  const along = (pts, u) => {
    let L = 0; const seg = [];
    for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(d); L += d; }
    let d = u * L;
    for (let k = 0; k < seg.length; k++) {
      if (d <= seg[k] || k === seg.length - 1) { const t = seg[k] ? clamp(d / seg[k], 0, 1) : 1; return [mix(pts[k][0], pts[k + 1][0], t), mix(pts[k][1], pts[k + 1][1], t)]; }
      d -= seg[k];
    }
    return pts[pts.length - 1];
  };
  const trail = $('#trail'), trailLine = trail && $('polyline', trail);
  const tail = []; let tailOff = 0;
  const cur = { x: 0, y: 0, w: 10, h: 10, r: 5 };
  const cta = marks.find((m) => m.dataset.dot === 'cta');
  const big = marks.find((m) => m.dataset.dot === 'o');
  const years = marks.filter((m) => m.dataset.dot === 'year');
  let raf = 0, last = 0, first = true, landed = null, lw = '', lh = '', lr = '', lastTone = null;

  const target = () => {
    const vh = innerHeight, sy = scrollY, max = Math.max(1, root.scrollHeight - vh);
    const tail = clamp((sy - (max - vh * 0.9)) / (vh * 0.9), 0, 1);
    const c = sy + vh * (0.45 + 0.55 * tail);
    const L = ys.length - 1;
    if (c < ys[0]) return { ...shapeOf(0), near: marks[0] };
    let i = 0;
    while (i < L && ys[i + 1] <= c) i++;
    if (i >= L) return { ...shapeOf(L), near: marks[L] };
    const gap = ys[i + 1] - ys[i];
    const s = ys[i] + Math.min(vh * 0.3, gap * 0.34), e = ys[i + 1] - Math.min(vh * 0.2, gap * 0.34);
    let q = clamp((c - s) / Math.max(1, e - s), 0, 1);
    if (still()) q = q < 0.5 ? 0 : 1;
    if (q === 0) return { ...shapeOf(i), near: marks[i] };
    if (q === 1) return { ...shapeOf(i + 1), near: marks[i + 1] };
    const a = shapeOf(i), b = shapeOf(i + 1);
    const ex = easeIO(q);
    const [px, py] = along(route(i, a, b), q * q * (3 - 2 * q));
    // 移動の間は小さな丸のまま。出る時に縮み、着く直前に相手の形へ広がる。
    const out = smooth(0, 0.22, q), inn = smooth(0.78, 1, q), mid = mix(a.t, b.t, ex);
    return {
      x: px, y: py,
      w: mix(mix(a.w, mid, out), b.w, inn), h: mix(mix(a.h, mid, out), b.h, inn),
      r: mix(mix(a.r, mid / 2, out), b.r, inn),
      near: q < 0.5 ? marks[i] : marks[i + 1],
    };
  };

  const frame = (now) => {
    raf = 0;
    const t = target();
    const dt = Math.min(now - (last || now), 50) / 1000; last = now;
    const k = first || still() ? 1 : 1 - Math.exp(-dt * 19);
    first = false;
    cur.x = mix(cur.x, t.x, k); cur.y = mix(cur.y, t.y, k);
    cur.w = mix(cur.w, t.w, k); cur.h = mix(cur.h, t.h, k); cur.r = mix(cur.r, t.r, k);
    const sw = cur.w.toFixed(1), sh = cur.h.toFixed(1), sr = cur.r.toFixed(1);
    if (sw !== lw) { dot.style.width = sw + 'px'; lw = sw; }
    if (sh !== lh) { dot.style.height = sh + 'px'; lh = sh; }
    if (sr !== lr) { dot.style.borderRadius = sr + 'px'; lr = sr; }
    dot.style.transform = `translate3d(${(cur.x - cur.w / 2).toFixed(2)}px,${(cur.y - cur.h / 2).toFixed(2)}px,0)`;
    shared.dotX = cur.x; shared.dotY = cur.y;
    // 通った跡（細い線）。動いている間だけ出て、止まると消える。
    if (trailLine && !still()) {
      const moved = tail.length ? Math.hypot(cur.x - tail[tail.length - 1][0], cur.y + scrollY - tail[tail.length - 1][1]) : 9;
      if (moved > 1.5) {
        // 跡はページの上の位置で覚える（スクロールしても、通った道の上に残る）。
        const sy = scrollY;
        tail.push([cur.x, cur.y + sy]); if (tail.length > 18) tail.shift();
        trailLine.setAttribute('points', tail.map((p) => p[0].toFixed(1) + ',' + (p[1] - sy).toFixed(1)).join(' '));
        trail.classList.add('is-on');
        clearTimeout(tailOff);
        tailOff = setTimeout(() => { trail.classList.remove('is-on'); tail.length = 0; }, 140);
      }
    }
    const rest = Math.abs(cur.x - t.x) + Math.abs(cur.y - t.y) + Math.abs(cur.w - t.w);
    const on = rest < 6 ? t.near : null;
    if (on !== landed) {
      landed = on;
      if (on && !still()) { dot.classList.remove('pulse'); void dot.offsetWidth; dot.classList.add('pulse'); }
      if (cta) cta.classList.toggle('is-landed', on === cta);
      if (big) big.classList.toggle('is-landed', on === big);
      // ボタンと大きな O は、着いたら相手が自分で赤くなる（点は重ならないように消える）。
      dot.classList.toggle('is-handed', !!on && (on === cta || on === big));
    }
    // 赤い面の上では、点を白くする（赤の上の赤は見えないため）。
    const tone = t.near && t.near.dataset.on === 'red';
    if (tone !== lastTone) { lastTone = tone; dot.classList.toggle('on-red', !!tone); }
    {
      years.forEach((y) => y.parentElement.classList.toggle('is-now', y === on));
    }
    if (rest > 0.08) request();
  };
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const remeasure = () => { measure(); request(); };

  measure();
  // 見出しがせり上がる間は、句点は見出しの行の中の印（CSS の赤い点）のまま一緒に上がる。
  // 上がり切ってから、動く点に切り替える（切り替えの瞬間に位置がずれないようにするため）。
  const takeOver = () => {
    if (root.classList.contains('js-dot')) return;
    first = true; frame(performance.now()); root.classList.add('js-dot'); request();
    const until = performance.now() + 400;
    const follow = () => { request(); if (performance.now() < until) requestAnimationFrame(follow); };
    requestAnimationFrame(follow);
  };
  const lastLine = null;
  if (still() || scrollY > 0) takeOver();
  else {
    // 見出しの現れ方（約1.3秒）が終わってから、動く点に切り替える。
    setTimeout(takeOver, 1500);
    addEventListener('scroll', takeOver, { once: true, passive: true });
  }
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', remeasure);
  addEventListener('load', remeasure);
  document.addEventListener('chiero:layout', remeasure);
  document.addEventListener('chiero:motionchange', request);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(remeasure); ro.observe(document.querySelector('main') || document.body); }
}

/* ---------- 数字：画面に入った時に、0 から本当の値まで数え上げる ----------
   HTML には最初から本当の値が書いてある（JS なし・動きを止めた時は、そのまま出る）。 */
function initCount() {
  if (!('IntersectionObserver' in window)) return;
  const fmt = new Intl.NumberFormat('ja-JP');
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    if (still()) return;
    const el = en.target, target = Number(el.dataset.count);
    const t0 = performance.now(), dur = 1200 + String(target).length * 60;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt.format(p < 1 ? Math.round(target * e) : target);
      if (p < 1 && !still()) requestAnimationFrame(step); else el.textContent = fmt.format(target);
    };
    el.textContent = '0'; requestAnimationFrame(step);
  }), { threshold: 0.4 });
  $$('.count-number[data-count]').forEach((el) => { if (el.getBoundingClientRect().top > innerHeight * 0.9) io.observe(el); });
}

const boot = () => { initCount(); initDot(); };
requestAnimationFrame(() => setTimeout(boot, 0));
const startField = () => setTimeout(initField, 120);
if (document.readyState === 'complete') startField(); else addEventListener('load', startField, { once: true });
