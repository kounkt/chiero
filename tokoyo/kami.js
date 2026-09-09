/* kami.js — 共通描画基盤
   点は内部解像度の実ピクセル1個（表示上0.5px相当）。
   同じ画素に溜まった量を 1-exp(-kd) で濃さに変換する。

   trail > 0: 前フレームの墨を trail 倍だけ残す（残像＝時間が画に溜まる）
   dark: 地を墨、点を光にする（深海・発光の見え方）
   数式は作品の中に、落款と同じ帯に置く。 */

const { sin, cos, tan, sqrt, hypot, abs, atan2, floor, round, min, max, pow, exp, log } = Math;
const PI = Math.PI, TAU = PI * 2;

function kami(o) {
  const host = typeof o.mount === 'string' ? document.querySelector(o.mount) : o.mount;
  const CSS = o.size || 540, D = o.dpr || 2, N = CSS * D;
  const n = o.n || 40000;
  const step = o.step || TAU / 300;
  const K = o.ink == null ? 0.5 : o.ink;
  let trail = o.trail || 0;
  const dk = !!o.dark;

  const PAPER = dk ? [11, 11, 13] : [255, 255, 255];
  const INK = dk ? [255, 255, 255] : [14, 14, 14];
  const RULE = dk ? '#2A2A2E' : '#E5E3DE';
  const TEXT = dk ? '#6E6E74' : '#8E8E8E';
  const BG = dk ? '#0B0B0D' : '#FFFFFF';

  const src = o.f.toString().replace(/\s+$/, '');
  const lines = src.split('\n');

  const mg = round(N * 0.082);
  // 数式は折り返さないので、最長行が版面に収まるところまで字の大きさを詰める
  const probe = document.createElement('canvas').getContext('2d');
  const fit = (px) => { probe.font = `${px}px "SF Mono","Menlo","Consolas",monospace`;
    return Math.max(...lines.map(l => probe.measureText(l).width)); };
  let fs = round(N * 0.0152);
  const room = N - mg * 2;
  while (fs > 6 && fit(fs) > room) fs--;
  const lh = round(fs * 1.62);
  const band = round(N * 0.030) + lines.length * lh + round(N * 0.036);
  const artH = N - band;
  const side = round(min(artH * 0.99, N * 0.88));
  const ox = (N - side) / 2, oy = round((artH - side) * 0.5);
  const S = side / 400;

  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  cv.style.cssText = `width:${CSS}px;height:${CSS}px;display:block;background:${BG}`;
  const g = cv.getContext('2d', { alpha: false });
  host.appendChild(cv);

  // ---- 落款と数式（初回のみ） ----
  g.fillStyle = BG; g.fillRect(0, 0, N, N);
  g.fillStyle = RULE;
  g.fillRect(mg, artH + round(N * 0.012), N - mg * 2, max(1, round(D * 0.5)));
  g.font = `${fs}px "SF Mono","Menlo","Consolas",monospace`;
  g.fillStyle = TEXT; g.textBaseline = 'top';
  let ty = artH + round(N * 0.030);
  for (const ln of lines) { g.fillText(ln, mg, ty); ty += lh; }
  const sz = round(N * 0.020);
  g.fillStyle = '#E60012';
  g.fillRect(N - mg - sz, artH + round(N * 0.030), sz, sz);   // 赤は一点＝落款

  // ---- 画の領域の地（方眼を敷く場合はここに描き、以後これを地として使う） ----
  g.fillStyle = BG; g.fillRect(0, 0, N, artH);
  if (o.grid) {
    const L = (v) => ox + v * S, M = (v) => oy + v * S;
    const w1 = max(1, round(D * .5));
    g.lineWidth = 0;
    for (let v = -400; v <= 800; v += 25) {                 // 細目
      const big = v % 100 === 0, ax = v === 200;
      g.fillStyle = dk ? (ax ? '#33333D' : big ? '#232329' : '#17171C')
                       : (ax ? '#D9D6D0' : big ? '#E9E7E2' : '#F2F1ED');
      const x = round(L(v)), y = round(M(v));
      if (x >= 0 && x < N) g.fillRect(x, 0, w1, artH);
      if (y >= 0 && y < artH) g.fillRect(0, y, N, w1);
    }
  }
  const bgImg = g.getImageData(0, 0, N, artH);
  const bg = new Uint32Array(bgImg.data.buffer);

  const img = g.createImageData(N, artH);
  const buf = new Uint32Array(img.data.buffer);
  buf.set(bg);

  const AREA = N * artH;
  const LUT = new Uint32Array(256);
  for (let d = 0; d < 256; d++) {
    const a = 1 - exp(-K * d / 8);
    LUT[d] = (255 << 24)
      | ((PAPER[2] + (INK[2] - PAPER[2]) * a) << 16)
      | ((PAPER[1] + (INK[1] - PAPER[1]) * a) << 8)
      | (PAPER[0] + (INK[0] - PAPER[0]) * a);
  }

  let t = 0;

  // --- 残像なし: 触れた画素だけを戻す ---
  const dens = o.trail ? null : new Uint16Array(AREA);
  let hit = o.trail ? null : new Int32Array(n), prev = o.trail ? null : new Int32Array(n);
  let nPrev = 0;

  // --- 残像あり: 墨のある画素だけを台帳で持ち、そこだけ減衰させる
  //     （全画素を毎フレーム走査すると、作品を並べたときにフレーム落ちする） ---
  const acc = o.trail ? new Float32Array(AREA) : null;
  const live = o.trail ? new Int32Array(AREA) : null;
  let nLive = 0;

  /* 何点に1点だけ描くか。1 なら全部。
     同じ式が決める点のうち、表示する点だけを選ぶ。点同士の力学は変更しない。 */
  let thin = 1;
  /* 点を大きくする口。点が少なくなると1画素では見えないので、
     残っているものが「在る」ことだけは見えるようにするため。
     形が戻るわけではない——数は増えない。 */
  let dot = 1;

  /* 間引きの起点。規則の本体は kami.pickOffset（このファイルの末尾）にある。 */
  let thinOff = 0;
  const pickOffset = (stride) => kami.pickOffset(o.f, n, stride, o.loop || 1);

  function frame(dt = 1, paint = true) {
    if (destroyed) return;
    // 60 Hz を基準に、経過時間に合わせて減衰と光量を揃える。
    const decay = Math.pow(trail, dt);
    const deposit = trail ? 8 * (1 - decay) / (1 - trail) : 8;
    if (o.trail) {
      for (let i = thinOff; i < n; i += thin) {
        const p = o.f(i, t);
        const x = (ox + p[0] * S) | 0, y = (oy + p[1] * S) | 0;
        if (x < 0 || y < 0 || x >= N || y >= artH) continue;
        for (let by = 0; by < dot; by++) {
          const yy = y + by; if (yy >= artH) break;
          for (let bx = 0; bx < dot; bx++) {
            const xx = x + bx; if (xx >= N) break;
            const idx = yy * N + xx;
            if (acc[idx] === 0) live[nLive++] = idx;
            acc[idx] += deposit;
          }
        }
      }
      let w = 0;
      for (let k = 0; k < nLive; k++) {
        const idx = live[k], a = acc[idx];
        if (a < 0.05) { acc[idx] = 0; buf[idx] = bg[idx]; continue; }
        buf[idx] = LUT[a > 255 ? 255 : a | 0];
        acc[idx] = a * decay;
        live[w++] = idx;
      }
      nLive = w;
    } else {
      for (let k = 0; k < nPrev; k++) buf[prev[k]] = bg[prev[k]];
      let nHit = 0;
      for (let i = thinOff; i < n; i += thin) {
        const p = o.f(i, t);
        const x = (ox + p[0] * S) | 0, y = (oy + p[1] * S) | 0;
        if (x < 0 || y < 0 || x >= N || y >= artH) continue;
        const idx = y * N + x;
        if (dens[idx] === 0 && nHit < n) hit[nHit++] = idx;
        dens[idx] += 8;
      }
      for (let k = 0; k < nHit; k++) {
        const idx = hit[k];
        buf[idx] = LUT[min(255, dens[idx])];
        dens[idx] = 0;
      }
      const tmp = prev; prev = hit; hit = tmp; nPrev = nHit;
    }
    if (paint) g.putImageData(img, 0, 0);
  }

  // 時刻はフレーム数でなく実時間で進める。
  // step=TAU/300 は 60fps 換算なので、1周 = 5秒。フレーム落ちしても速さが変わらない。
  const RATE = step * 60;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let t0 = null, last = null, base = 0, run = false, held = motion.matches;
  let onScreen = false, destroyed = false, raf = 0;
  const tick = (ms) => {
    if (!run || destroyed) return;
    if (t0 === null) t0 = ms;
    t = base + (ms - t0) / 1000 * RATE;
    frame(last === null ? 1 : Math.max(.01, (ms - last) * .06));
    last = ms;
    raf = requestAnimationFrame(tick);
  };
  const play = () => {
    if (run || destroyed || document.hidden) return;
    run = true; t0 = last = null; base = t; raf = requestAnimationFrame(tick);
  };
  const halt = () => { run = false; cancelAnimationFrame(raf); raf = 0; };
  const visibility = () => { if (onScreen && !held && !document.hidden) play(); else halt(); };
  const preference = () => { if (motion.matches) { held = true; halt(); }
    host.dispatchEvent(new CustomEvent('tokoyo:holdchange', {detail: held})); };
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener?.('change', preference);
  const observer = new IntersectionObserver(es => {
    for (const e of es) { onScreen = e.isIntersecting; visibility(); }
  }, { rootMargin: '0px' });
  observer.observe(cv);
  frame();

  // 書き出し用: 残像は履歴に依存するので、飛ばさず順に進める
  return {
    host, canvas: cv, frame, src, step,

    /* 画の領域を外から読む口（描画は何も変えない）。
       共有画像で数式帯と落款を切り落とし、画だけを並べるために要る——
       帯ごと三枚並べると赤い落款が三つになり、赤一点の掟を破る。
       単位は内部解像度の画素。CSS px に直すには dpr で割る。 */
    dpr: D, size: CSS, artH, side, ox, oy,
    seek(v) { t = v; base = t; t0 = last = null; frame(); },
    advance(paint = true) { t += step; frame(1, paint); },
    reset() { t = 0; frame(); },
    now() { return t; },

    // --- 見る人が時を握るための口 ---
    // 止めているあいだは画面内でも動かさない
    // 関係を薄める。1=全部、大きいほど点が減る
    setThin(v, silent = false) {
      const next = max(1, min(n, v | 0)), changed = next !== thin;
      thin = next; thinOff = pickOffset(thin); frame();
      if (changed && !silent) host.dispatchEvent(new CustomEvent('tokoyo:pointschange'));
    },
    selection() { return {stride: thin, offset: thinOff, count: Math.ceil((n - thinOff) / thin)}; },
    // 一点だけにしたとき、その点の通り道が残るように残像を伸ばす口。
    // 消えたのは形であって、式ではない——それを見せるため
    setTrail(v) { if (o.trail) trail = min(.995, max(0, v)); },
    setDot(v) { dot = max(1, min(6, v | 0)); },
    baseTrail: o.trail || 0,
    shown() { return Math.ceil((n - thinOff) / thin); },
    hold() { held = true; halt(); },
    release() { held = false; if (onScreen) play(); },
    isHeld() { return held; },
    destroy() {
      if (destroyed) return;
      destroyed = true; halt(); observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener?.('change', preference);
      cv.remove(); cv.width = cv.height = 0;
    },
    // 残像を消す。時刻を飛ばしたあと、履歴を作り直すために使う
    // （飛ばしただけだと、前にいた場所の光が幽霊として残る）
    clear() {
      if (!o.trail) return;
      for (let k = 0; k < nLive; k++) { const i = live[k]; acc[i] = 0; buf[i] = bg[i]; }
      nLive = 0;
    }
  };
}

/* 間引きの起点を決める規則。

   刻むと必ず i=0 が残るが、**i=0 が死んでいる作品がある**（2026-08-02 実測）:
     砂紋 … 一巡り300コマすべてで退避値。押しても画は空のまま
     雷・島 … 位置が動かない。一点にしても、ただ点いたままの点が一つ残るだけ
     航跡・潮 … 生きている点は全体の4%と40%しかない
   この五点では「一つに減らす」が成立していなかった。

   そこで、残す点が少ないときだけ**生きている点を選んで**起点にする。
   生きている＝一巡りのあいだに画の中にいて、動くか、現れて消えるか。
   雷・島・砂紋は位置が動かず「現れて消える」ことで動く作品なので、
   動きだけで測ると全部落ちる。**明滅も動きとして数える。**

   残す点が多いとき（64点より多い）は 0 のまま。見た目が変わる所を無駄に触らない。

   kami() の外に出してあるのは、**同じ規則を二か所に書かないため**。
   mcp.js（機械に向けた口）が「その段では何が残るか」を答えるとき、
   画面が実際に残している点と同じ点を数えないと、嘘の要約になる。 */
const offMemo = new WeakMap();
kami.pickOffset = function (f, n, stride, loop) {
  if (stride <= 1) return 0;
  if (Math.ceil(n / stride) > 64) return 0;
  let memo = offMemo.get(f);
  if (!memo) { memo = new Map(); offMemo.set(f, memo); }
  const key = n + ':' + stride + ':' + (loop || 1);
  if (memo.has(key)) return memo.get(key);
  const TS = 24, span = (loop || 1) * TAU, cand = min(stride, 64);
  let best = 0, bestScore = -Infinity;
  for (let c = 0; c < cand; c++) {
    const off = (c * stride / cand) | 0;
    let score = 0;
    for (let i = off; i < n; i += stride) {
      let px = null, py = null, seen = 0, mv = 0, blink = 0, was = false;
      for (let s = 0; s < TS; s++) {
        const p = f(i, s * span / TS);
        const x = p[0], y = p[1];
        const ok = Number.isFinite(x) && Number.isFinite(y)
          && !(x === -9 && y === -9) && x >= 0 && y >= 0 && x <= 400 && y <= 400;
        if (ok) { seen++; if (px !== null) mv += hypot(x - px, y - py); px = x; py = y; }
        else px = null;
        if (s && ok !== was) blink++;
        was = ok;
      }
      score += seen ? min(mv, 600) + 12 * blink : -1000;
    }
    if (score > bestScore) { bestScore = score; best = off; }
  }
  memo.set(key, best);
  return best;
};


/* 近づいた作品だけ描く。画面から離れたら配列・canvas・監視を解放する。
   時刻、点数、手動停止は軽い状態として保持する。式を読むだけでは描画を作らない。 */
kami.lazy = function(o) {
  const host = typeof o.mount === 'string' ? document.querySelector(o.mount) : o.mount;
  host.style.aspectRatio = '1';
  let live = null, dead = false, size = o.size, time = 0, stride = 1, dot = 1;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let trail = o.trail || 0, held = preference.matches;
  const changedPreference = () => {
    if (preference.matches) { held = true; live?.hold();
      host.dispatchEvent(new CustomEvent('tokoyo:holdchange', {detail:true})); }
  };
  preference.addEventListener?.('change', changedPreference);
  const n = o.n || 40000;
  const selection = () => { const offset = kami.pickOffset(o.f, n, stride, o.loop || 1);
    return {stride, offset, count: Math.ceil((n - offset) / stride)}; };
  const ensure = () => {
    if (dead) throw new Error('This renderer has been disposed');
    if (!live) {
      live = kami({...o, mount: host, size});
      live.hold(); live.clear(); live.setTrail(trail); live.setDot(dot); live.setThin(stride, true);
      live.seek(time);
      if (!held) live.release();
    }
    return live;
  };
  const evict = (notify = true) => {
    if (!live) return;
    time = live.now(); held = live.isHeld(); live.destroy(); live = null;
    if (notify) host.dispatchEvent(new CustomEvent('tokoyo:evict'));
  };
  const eye = new IntersectionObserver(es => {
    if (dead) return;
    for (const e of es) { if (e.isIntersecting) ensure(); else evict(); }
  }, {rootMargin: '220px'});
  eye.observe(host);
  const api = {
    host, src: o.f.toString().replace(/\s+$/, ''), step: o.step || TAU / 300,
    baseTrail: o.trail || 0, selection,
    shown: () => selection().count, now: () => live ? live.now() : time,
    isHeld: () => live ? live.isHeld() : held,
    hold() { held = true; live?.hold(); }, release() { held = false; live?.release(); },
    setThin(v) { const next = Math.max(1, Math.min(n, v | 0)), changed = next !== stride;
      stride = next; if (live) live.setThin(v);
      else if (changed) host.dispatchEvent(new CustomEvent('tokoyo:pointschange')); },
    setTrail(v) { trail = v; live?.setTrail(v); }, setDot(v) { dot = v; live?.setDot(v); },
    clear() { live?.clear(); }, seek(v) { time = v; live?.seek(v); },
    frame(dt) { ensure().frame(dt); }, advance() { ensure().advance(); },
    resize(v) { const visible = !!live; evict(false); size = v; if (visible) ensure(); },
    destroy() { evict(); dead = true; eye.disconnect(); preference.removeEventListener?.('change', changedPreference); }
  };
  for (const key of ['canvas', 'dpr', 'size', 'artH', 'side', 'ox', 'oy'])
    Object.defineProperty(api, key, {get: () => ensure()[key]});
  return api;
};
