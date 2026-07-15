/* ============================================================
   「傾きを、構造に変える。」の視覚化
   ------------------------------------------------------------
   4段の物語を時間で展開する:
     1. 傾き — 場に勾配がある（線が一本引かれる）
     2. 流れ — 勾配に沿って赤い粒が滑り落ちる（単純な流れ）
     3. 構造 — 落ちた先で粒が積み上がり、格子が下から組み上がる
     4. 自走 — 格子が網になり、自分でパルスを回し、自分で粒を生む（複雑系）
   憲法 L0「快楽構造の完全形＝数字を刻みながら自走している」まで到達して停まる。
   ------------------------------------------------------------
   本文はこれに一切依存しない。描画が失敗しても文字は読める。
   外部素材ゼロ。色はブランド色（赤・黒）のみ。
   ============================================================ */

const RED = '#E60012';
const INK = '#111111';

const T_FLOW  = 2.5;   // ここまでは流れだけ
const T_ALIVE = 18;    // ここから自走（網化・パルス・自己供給）
const MAX_NODES = 190; // 構造の完成形。埋め尽くさず、輪郭を持たせて止める

export function startSlope(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const density = opts.density ?? 1;

  let W = 0, H = 0;
  let particles = [];
  let nodes = [];
  let edges = [];
  let pulses = [];
  let grid = new Map();          // "cx,cy" -> node
  let sites = new Set();         // 成長点＝既存構造に隣接する空きセル
  let t0 = performance.now();
  let raf = null;

  const now = () => (performance.now() - t0) / 1000;

  // ---- 場の形 ----
  let CELL = 26;
  let RAMP_END, FLOOR, TOP;
  const slopeY = (x) => TOP + (x / RAMP_END) * (FLOOR - TOP);   // 傾き（滑り台）

  function layout() {
    CELL = W < 700 ? 20 : 26;
    RAMP_END = W * 0.54;         // ここで傾きが終わり、粒は落ちる
    TOP = H * 0.16;
    FLOOR = H * 0.72;            // 積み上がりの床
  }

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(r.width, 1);
    H = Math.max(r.height, 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    // 場が変われば座標が意味を失う。作り直す
    nodes = []; edges = []; pulses = []; grid.clear(); sites.clear(); particles = [];
  }

  const key = (cx, cy) => cx + ',' + cy;
  const cellX = (cx) => cx * CELL;
  const cellY = (cy) => cy * CELL;

  function spawnFlow() {
    const x = -30 - Math.random() * 80;
    // 速さをばらけさせる＝傾きの端から飛ぶ距離が変わり、着地が右へ広く散る
    particles.push({ x, y: slopeY(x), vx: 1.3 + Math.random() * 2.4, vy: 0, self: false });
  }

  /* 自走段: 構造自身が粒を吐き、それがまた場を巡る */
  function spawnSelf() {
    if (!nodes.length) return;
    const n = nodes[(Math.random() * nodes.length) | 0];
    particles.push({ x: n.x, y: n.y, vx: -1.2 - Math.random(), vy: -1.6 - Math.random(), self: true });
  }

  /* 構造が育つ場所＝傾きの下、右側。文字の側と上半分には決して伸ばさない */
  const inZone = (cx, cy) =>
    cellX(cx) >= RAMP_END - CELL && cellX(cx) <= W + CELL &&
    cellY(cy) <= FLOOR && cellY(cy) >= FLOOR - CELL * 8;

  /* 結晶化させ、近傍とつなぎ、周囲を新しい成長点として開く */
  function settle(cx, cy, T) {
    const k = key(cx, cy);
    if (grid.has(k)) return null;
    const node = { x: cellX(cx), y: cellY(cy), cx, cy, born: T, deg: 0 };
    grid.set(k, node);
    nodes.push(node);
    sites.delete(k);
    // 上下左右を次の成長点として開く（構造が縁から育っていく）
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = key(cx + dx, cy + dy);
      if (!grid.has(nk) && inZone(cx + dx, cy + dy)) sites.add(nk);
    }

    // 近傍を結ぶ。育つほど遠くまで届き、次数の高い節ほどさらに集める（優先的選択）
    const reach = T < T_ALIVE ? 1 : 2;
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        if (!dx && !dy) continue;
        const o = grid.get(key(cx + dx, cy + dy));
        if (!o) continue;
        const far = Math.abs(dx) > 1 || Math.abs(dy) > 1;
        if (far && Math.random() > Math.min(0.9, 0.15 + o.deg * 0.12)) continue;
        if (!far && Math.abs(dx) && Math.abs(dy) && Math.random() > 0.45) continue;  // 斜めは間引く
        edges.push({ a: node, b: o, born: T });
        node.deg++; o.deg++;
      }
    }
    return node;
  }

  /* 落ちてきた粒を構造に取り込む。
     一粒目は種。以降は「既存構造の縁（成長点）のうち、粒に近いところ」に付く。
     ——結果、構造は一本の塔ではなく、縁から右へ上へと広がって育つ。 */
  function tryDeposit(p, T) {
    const floorCy = Math.floor(FLOOR / CELL);
    if (nodes.length >= MAX_NODES) return false;   // 組み上がった。以降の粒は通り抜ける

    if (!nodes.length) {
      if (p.y < FLOOR) return false;                       // 床に着くまで待つ
      const cx = Math.max(Math.round(p.x / CELL), Math.ceil(RAMP_END / CELL));
      return !!settle(cx, floorCy, T);
    }
    if (!sites.size) return false;
    if (p.y < FLOOR - CELL * 10) return false;             // まだ高い。落下を続けさせる

    /* 成長点の選び方＝足場の組み方。
       ①土台から先に敷く（床に近いほど強く優先） ②その中で粒の落下点に近いところ
       ③わずかに乱数を入れて機械的な整列を崩す。
       結果、構造は床を右へ伸ばしながら、順に上へ積み上がっていく。 */
    let best = null, bestScore = Infinity;
    for (const k of sites) {
      const i = k.indexOf(',');
      const cx = +k.slice(0, i), cy = +k.slice(i + 1);
      const above = FLOOR - cellY(cy);                     // 床からの高さ
      const score = above * above * 1.4                    // 土台優先
                  + (cellX(cx) - p.x) ** 2 * 0.18          // 落下点の近く
                  + Math.random() * (CELL * 6) ** 2;       // 有機的な揺らぎ
      if (score < bestScore) { bestScore = score; best = [cx, cy]; }
    }
    return best ? !!settle(best[0], best[1], T) : false;
  }

  function step() {
    const T = now();
    ctx.clearRect(0, 0, W, H);

    // ---- 1. 傾き ----
    ctx.strokeStyle = 'rgba(17,17,17,.13)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, slopeY(0));
    ctx.lineTo(RAMP_END, slopeY(RAMP_END));
    ctx.stroke();

    // ---- 供給。組み上がったら流入は落ち着き、構造の自走に主役が移る ----
    const rate = nodes.length < MAX_NODES ? 0.3 : 0.12;
    if (Math.random() < rate * density) spawnFlow();
    if (T > T_ALIVE && Math.random() < 0.09 * density) spawnSelf();

    // ---- 2. 流れ ----
    particles = particles.filter((p) => {
      if (p.self) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05;          // 吐き出された粒
        ctx.globalAlpha = 0.45;
      } else if (p.x < RAMP_END) {
        p.x += p.vx;                                      // 傾きを滑る
        p.y = slopeY(p.x);
        p.vx += 0.012;                                    // 勾配で加速する
        ctx.globalAlpha = 0.65;
      } else {
        p.x += p.vx * 0.8; p.y += p.vy; p.vy += 0.3;      // 傾きの端から飛び出して落ちる
        ctx.globalAlpha = 0.7;
        if (T > T_FLOW && tryDeposit(p, T)) return false;  // 構造に取り込まれた
        if (p.y > FLOOR + CELL * 2) return false;
      }
      if (p.x > W + 40 || p.y > H + 60 || p.x < -140 || p.y < -80) return false;
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;

    // ---- 3. 構造（辺が引かれる） ----
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    for (const e of edges) {
      const a = Math.min(1, Math.max(0, (T - e.born) * 2.2));
      if (a <= 0) continue;
      ctx.globalAlpha = 0.17 * a;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.a.x + (e.b.x - e.a.x) * a, e.a.y + (e.b.y - e.a.y) * a);
      ctx.stroke();
    }

    // ---- 3. 構造（節。着地の瞬間に赤く弾んで、黒く締まる＝流れが構造になる） ----
    for (const n of nodes) {
      const age = Math.max(0, T - n.born);
      const pop = Math.min(1, age * 4);
      const r = Math.max(0, 2.5 * pop * (1 + Math.max(0, 1 - age * 3) * 1.6));
      const toInk = Math.min(1, age * 0.9);
      ctx.globalAlpha = Math.min(0.85, 0.24 + (1 - toInk) * 0.55 + n.deg * 0.015);
      ctx.fillStyle = toInk > 0.85 ? INK : RED;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- 4. 自走 ----
    if (T > T_ALIVE && edges.length) {
      if (pulses.length < 30 && Math.random() < 0.3) {
        pulses.push({ e: edges[(Math.random() * edges.length) | 0], t: 0, dir: Math.random() < 0.5 ? 1 : -1 });
      }
      ctx.fillStyle = RED;
      pulses = pulses.filter((pl) => {
        pl.t += 0.025;
        if (pl.t >= 1) return false;
        const k = pl.dir > 0 ? pl.t : 1 - pl.t;
        ctx.globalAlpha = Math.sin(pl.t * Math.PI) * 0.9;
        ctx.beginPath();
        ctx.arc(pl.e.a.x + (pl.e.b.x - pl.e.a.x) * k, pl.e.a.y + (pl.e.b.y - pl.e.a.y) * k, 2, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(step);
  }

  /* 動きを止めている人には、出来上がった構造を一枚の絵として見せる */
  function still() {
    const T = T_ALIVE + 5;
    const floorCy = Math.floor(FLOOR / CELL);
    for (let cx = Math.ceil(RAMP_END / CELL); cx <= Math.ceil(W / CELL); cx++) {
      const h = 4 + Math.round(Math.abs(Math.sin(cx * 0.8)) * 6);
      for (let i = 0; i < h; i++) settle(cx, floorCy - i, T);
    }
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(17,17,17,.13)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, slopeY(0)); ctx.lineTo(RAMP_END, slopeY(RAMP_END)); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.globalAlpha = .17;
    for (const e of edges) { ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke(); }
    ctx.globalAlpha = .5; ctx.fillStyle = INK;
    for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  fit();
  /* 場が変わると構造は建て直しになる。ドラッグ中に毎フレーム壊さないよう間引き、
     幅が実質変わっていないリサイズ（モバイルのアドレスバー伸縮など）は無視する */
  let rt = null, lastW = W;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const w = canvas.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 40) return;
      lastW = w;
      fit();
      if (reduced) still();
    }, 220);
  };
  addEventListener('resize', onResize);

  if (reduced) still();
  else raf = requestAnimationFrame(step);

  // 見えていない間は回さない（電池と発熱）
  const onVis = () => {
    if (reduced) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf) raf = requestAnimationFrame(step);
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(rt);
    removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
  };
}
