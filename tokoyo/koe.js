/* koe.js — 住人の声。姿を、そのまま音にする。正本はここ一つ。
   作品の頁（ブラウザ）と書き出し（tools/build_sound.mjs）が同じこのファイルを読む。

   ── 作り（2026-08-02 全面改訂）──
     その瞬間の点群を重心のまわりの角度で並べると、住人の輪郭が一本の線になる。
     **その輪郭を、画と同じ速さ（5〜20秒で一周）でなぞる。**
     点が居る向きを跨いだ瞬間に一粒鳴らし、居ない向きは沈黙になる。
     だから点の多い住人はざわめき、少ない住人は拍になり、一点なら一巡りに一脈だけ鳴る。

     これに、低く伸びる地（じ）を重ねる。地の厚みは緊張が決める。

   ── なぜ持続音をやめたか ──
     改訂前は輪郭を**音の速さ**（毎秒100周以上）でなぞっていた。
     その速さでは、輪郭の隙間は毎秒数千回の凹凸＝倍音にしかならず、拍にならない。
     どれも一本調子の持続音で、始まりも山も終わりも無かった。
     読む速さを画に合わせただけで、同じ輪郭が音色でなく出来事になる。**音は作り変えていない。**

   ── 緊張と緩和はどこから来るか（こちらで山を置かない）──
     一巡りのあいだに本当に大きく動く量を測って探した。二つあった。
       でこぼこ … 輪郭が平均からどれだけ外れているか（繭で2.26倍振れる）
       隔たり   … 漂流で中心からどれだけ離れたか（繭で24〜92px）
     0.65:0.35 で混ぜ、輪のまま均したものを**緊張**とする。実測で 0.02〜0.98 まで振れる。
     身が尖れば地が厚くなり倍音が乗る。丸く収まれば低く単純に戻る。

     試した末に捨てた案: **予測が外れた量で山を作る。**
     作品は滑らかな周期運動なので、等速で予測すればどこでもよく当たる——
     25点中16点で起伏1.5倍未満だった。**時間の中に意外性がほとんど無い。**

   ── 途切れさせないための四つ（すべて実測で潰した）──
     ① 一巡りを**輪**として作り、粒の尾は終端で断ち切らず頭へ回り込ませる
     ② 高さは**一巡りに整数回入る値へ丸める**。輪の継ぎ目が原理的に消える
     ③ 粒が重なっても硬く切らず、tanh でやわらかく寝かせる
     ④ 粒の包絡は両端が必ず0。立ち上がりはゆるく、収まりは長く
     測り方も直した。耳に飛びとして届くのは**隣り合う標本の段差**である。
     この高さの滑らかな波なら段差は0.09を超えない。全25点で0.09超は0箇所。

   ── 濁らせない ──
     粒の高さは基音の 1・2・3・4・6 倍からしか選ばない。
     どれを選ぶかはその向きの張り出しが決める。密度が上がっても濁らず、厚みだけが増す。

   ── 高さ ──
     **姿の大きさが決める**（大きい体ほど低い声。弦や管と同じ、長さに反比例）。
     基準 74 は25点の姿の大きさ（輪郭の平均半径）の幾何平均。実測で 52〜203Hz に開く。
     改訂前は全作品 110Hz の固定で、人は音色より先に高さで聞き分けるため、
     倍音がどれだけ違っても同じ声に聞こえていた。

   ── 聴く側の作りに合わせた三点 ──
     ① 人は差でなく比を感じる（ウェーバー）: 粒の強さは張り出しを平均で割った比で決める
     ② 繰り返しが予測を作り、変化が情報になる: 一巡りは正確に繰り返す。
        それを破るのは**見る人が「関係を減らす」を押した瞬間**。緊張の頂点はこちらで置かない
     ③ 感覚は物理量の対数（ウェーバー・フェヒナー）: 緊張から厚みへの写しは飽和させる

   ── 失われた性質（2026-08-02 の改訂で手放した）──
     改訂前は L に x、R に y を出していたので、左右をオシロスコープの XY に入れると
     画面に住人が現れた。いまは左右が**向きの定位**なので、この性質は無い。
     引き換えに、声が時間の形を持った。

   ── 使い方 ──
     const p = koe(work, {sr, seconds});
     while (!p.done) p.step();      // 重いので、ブラウザでは小分けにして呼ぶ
     const { L, R } = p.finish();   // Float32Array（-1..1）
*/

function koe(w, o) {
  o = o || {};
  const sr = o.sr || 44100;
  const M = Math.max(8, Math.trunc(o.M || 360));       // 輪郭を何方向で持つか
  const SAMP = Math.max(8, Math.trunc(o.samp || 1200));// 一枚を何点で測るか
  const REF = o.ref || 74, F0 = o.baseF || 110;

  const { sin, cos, hypot, atan2, floor, round, min, max, abs, pow, sqrt, tanh } = Math;
  const TAU = Math.PI * 2, PI = Math.PI;

  const LAP = (w.loop || 1) * 5;                       // 画の一巡り（秒）
  const FR = Math.max(8, round(LAP * (o.fps || 60)));  // 輪郭を何枚取るか
  const N = round(LAP * sr);                           // 一巡りの標本数
  const SEC = o.seconds || LAP;

  const idx = new Int32Array(SAMP);
  for (let k = 0; k < SAMP; k++) idx[k] = floor((k * 0.618034 % 1) * w.n);

  // 一枚ぶんの作業場（使い回す）
  const px = new Float64Array(SAMP), py = new Float64Array(SAMP), ok = new Uint8Array(SAMP);
  const bins = new Float64Array(M), cnt = new Int32Array(M);

  // 全枚数ぶんの輪郭と、そこから出る量
  const R_ = new Float32Array(FR * M);                 // 各向きの半径（0＝誰も居ない）
  const LIVE = new Uint8Array(FR * M);
  const MEAN = new Float32Array(FR), DEV = new Float32Array(FR), DRIFT = new Float32Array(FR);

  let fi = 0;

  function one(f) {
    const t = f * (w.loop || 1) * TAU / FR, base = f * M;
    let cx = 0, cy = 0, n = 0;
    for (let q = 0; q < SAMP; q++) {
      const p = w.f(idx[q], t);
      const good = isFinite(p[0]) && isFinite(p[1]) && !(p[0] === -9 && p[1] === -9);
      ok[q] = good ? 1 : 0;
      if (!good) continue;
      px[q] = p[0]; py[q] = p[1];
      cx += p[0]; cy += p[1]; n++;
    }
    if (!n) { MEAN[f] = f ? MEAN[f - 1] : 1; return; }
    cx /= n; cy /= n;
    bins.fill(0); cnt.fill(0);
    for (let q = 0; q < SAMP; q++) {
      if (!ok[q]) continue;
      const dx = px[q] - cx, dy = py[q] - cy;
      const b = floor(((atan2(dy, dx) + TAU) % TAU) / TAU * M) % M;
      const r = hypot(dx, dy);
      if (r > bins[b]) bins[b] = r;
      cnt[b]++;
    }
    let live = 0, m = 0;
    for (let k = 0; k < M; k++) if (cnt[k]) { live++; m += bins[k]; }
    m /= (live || 1);
    let dv = 0;
    for (let k = 0; k < M; k++) if (cnt[k]) dv += abs(bins[k] - m);
    for (let k = 0; k < M; k++) { R_[base + k] = bins[k]; LIVE[base + k] = cnt[k] ? 1 : 0; }
    MEAN[f] = m || 1;
    DEV[f] = dv / ((live || 1) * (m || 1));
    DRIFT[f] = hypot(cx - 200, cy - 200);
  }

  /* 姿の大きさ。高さを決めるためだけに使う。

     **測り方を固定する。**輪郭は「その向きのいちばん外」で取るので、
     見る点を増やすほど外の点に当たりやすく、体が大きく出る。
     描画の設定に任せると、同じ作品なのにブラウザと書き出しで高さが変わった——
     実測で最大307セント＝3半音（貝）。高さは作品の性質であって、描き方の性質ではない。
     **描く長さにも依らせない**（伸びていく作品は短く切ると小さく出る）。一巡りを12点で均す。 */
  const B_SAMP = 1200, B_M = 360;
  function bodySize() {
    const bIdx = new Int32Array(B_SAMP);
    for (let k = 0; k < B_SAMP; k++) bIdx[k] = floor((k * 0.618034 % 1) * w.n);
    const bb = new Float64Array(B_M), bc = new Int32Array(B_M);
    const bxx = new Float64Array(B_SAMP), byy = new Float64Array(B_SAMP), bo = new Uint8Array(B_SAMP);
    let acc = 0, got = 0;
    for (let s = 0; s < 12; s++) {
      const t = s * (w.loop || 1) * TAU / 12;
      let cx = 0, cy = 0, n = 0;
      for (let q = 0; q < B_SAMP; q++) {
        const p = w.f(bIdx[q], t);
        const good = isFinite(p[0]) && isFinite(p[1]) && !(p[0] === -9 && p[1] === -9);
        bo[q] = good ? 1 : 0;
        if (!good) continue;
        bxx[q] = p[0]; byy[q] = p[1]; cx += p[0]; cy += p[1]; n++;
      }
      if (!n) continue;
      cx /= n; cy /= n;
      bb.fill(0); bc.fill(0);
      for (let q = 0; q < B_SAMP; q++) {
        if (!bo[q]) continue;
        const dx = bxx[q] - cx, dy = byy[q] - cy;
        const b = floor(((atan2(dy, dx) + TAU) % TAU) / TAU * B_M) % B_M;
        const r = hypot(dx, dy);
        if (r > bb[b]) bb[b] = r;
        bc[b]++;
      }
      for (let k = 0; k < B_M; k++) if (!bc[k]) {
        let a = 1, b2 = 1;
        while (a < B_M && !bc[(k - a + B_M) % B_M]) a++;
        while (b2 < B_M && !bc[(k + b2) % B_M]) b2++;
        bb[k] = (bb[(k - a + B_M) % B_M] + bb[(k + b2) % B_M]) / 2;
      }
      let m = 0;
      for (let k = 0; k < B_M; k++) m += bb[k];
      acc += m / B_M; got++;
    }
    return got ? acc / got : REF;
  }

  const PARTIAL = [1, 2, 3, 4, 6];       // 濁らない並び。ここからしか選ばない

  /* 波と包絡は表を引く。
     素直に書くと Math.sin を2千万回呼ぶことになり、一体作るのに最大23秒かかった（実測）。
     表引きにすると耳では区別できないまま、待ち時間が実用の範囲へ落ちる。 */
  const TB = 4096, WAVE = new Float32Array(TB + 1);
  for (let i = 0; i <= TB; i++) WAVE[i] = sin(TAU * i / TB);
  const wave = (ph) => {                  // ph は「周」単位。整数部は捨てる
    const x = (ph - floor(ph)) * TB, i = x | 0;
    return WAVE[i] + (WAVE[i + 1] - WAVE[i]) * (x - i);
  };
  const EB = 2048, ENV = new Float32Array(EB + 1);
  for (let i = 0; i <= EB; i++) {
    const x = i / EB;
    ENV[i] = x < 0.12 ? (0.5 - 0.5 * cos(PI * x / 0.12)) : pow(1 - (x - 0.12) / 0.88, 2.2);
  }

  return {
    frames: FR,
    get done() { return fi >= FR; },
    get progress() { return fi / FR; },
    step(n) {
      n = n || 1;
      for (let q = 0; q < n && fi < FR; q++, fi++) one(fi);
      return this.done;
    },

    /* その作品の高さ。姿の大きさに決めさせる。
       返す値は**一巡りに整数回入る**よう丸めてある（輪の継ぎ目を原理的に消すため）。 */
    pitch() {
      const raw = o.F || min(330, max(45, F0 * REF / (bodySize() || REF)));
      return round(raw * LAP) / LAP;
    },

    /* 組み立ても小分けにできるようにする。
       輪郭を取るのと同じくらい重いので、一息にやるとブラウザが数秒固まる（実測9.4秒）。
       仕事を「地を一区切り」と「粒を一つ」に割り、呼ぶ側が好きな粒度で回せるようにした。 */
    mix(n) { return this._go(n || 1); },
    get mixed() { return this._st ? min(1, this._st.at / this._st.total) : 0; },

    finish() {
      while (!this._go(64));
      return this._out();
    },

    _prep() {
      const F = this.pitch();

      /* 緊張（0..1）。でこぼこと隔たりを混ぜ、**輪のまま**均す（頭と尻が繋がる）。 */
      const nz = (a) => {
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < FR; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
        const out = new Float64Array(FR);
        for (let i = 0; i < FR; i++) out[i] = hi > lo ? (a[i] - lo) / (hi - lo) : 0.5;
        return out;
      };
      const A = nz(DEV), B = nz(DRIFT);
      let ten = new Float64Array(FR);
      for (let i = 0; i < FR; i++) ten[i] = 0.65 * A[i] + 0.35 * B[i];
      for (let pass = 0; pass < 3; pass++) {
        const t2 = new Float64Array(FR);
        for (let i = 0; i < FR; i++)
          t2[i] = (ten[(i - 1 + FR) % FR] + 2 * ten[i] + ten[(i + 1) % FR]) / 4;
        ten = t2;
      }

      /* 溜めは倍精度で持つ。単精度の配列へ一標本ずつ足すと、
         読み書きのたびに丸めが挟まって遅い（実測で合成が2倍以上かかった）。 */
      const CH = 1 << 13;                        // 地はこの標本数ずつ組む（一回で止まる時間を短く保つ）
      this._st = { F, ten, LL: new Float64Array(N), RR: new Float64Array(N),
                   bed: 0, bedN: Math.ceil(N / CH), CH, k: 0, grains: 0, at: 0,
                   total: Math.ceil(N / CH) + M };
    },

    // 一仕事＝「地を一区切り」または「粒を一つ」。true を返したら組み上がり
    _go(n) {
      if (!this._st) this._prep();
      const S = this._st, { LL, RR, ten, F, CH } = S;
      for (let q = 0; q < n; q++) {
        if (S.bed < S.bedN) {
          // 地 — 低く伸びる音。緊張で厚みと明るさが動く
          const s0 = S.bed * CH, s1 = min(N, s0 + CH);
          const d1 = F / sr, d2 = F * 2 / sr, d3 = F * 3 / sr, dsp = 1 / N;
          let p1 = s0 * d1, p2 = s0 * d2, p3 = s0 * d3, psp = s0 * dsp;
          for (let s = s0; s < s1; s++) {
            const f = min(FR - 1, (s / N * FR) | 0), t = ten[f];
            const a = 0.10 + 0.16 * t;
            // 表引きは呼ばずにその場で展開する（一標本ごとの関数呼び出しが効く）
            let x = (p1 - floor(p1)) * TB, i0 = x | 0;
            const w1 = WAVE[i0] + (WAVE[i0 + 1] - WAVE[i0]) * (x - i0);
            x = (p2 - floor(p2)) * TB; i0 = x | 0;
            const w2 = WAVE[i0] + (WAVE[i0 + 1] - WAVE[i0]) * (x - i0);
            x = (p3 - floor(p3)) * TB; i0 = x | 0;
            const w3 = WAVE[i0] + (WAVE[i0 + 1] - WAVE[i0]) * (x - i0);
            x = (psp - floor(psp)) * TB; i0 = x | 0;
            const ws = WAVE[i0] + (WAVE[i0 + 1] - WAVE[i0]) * (x - i0);
            const v = w1 * a + w2 * a * 0.30 * t + w3 * a * 0.14 * t * t;
            const sp = 0.15 * ws;
            LL[s] += v * (1 - sp); RR[s] += v * (1 + sp);
            p1 += d1; p2 += d2; p3 += d3; psp += dsp;
          }
          S.bed++; S.at++;
          continue;
        }
        if (S.k >= M) return true;

        /* 粒 — 画の速さで輪郭をなぞり、点が居る向きを跨いだら一粒。
           向きの切り替わる標本は先に割り出す（全標本を舐めて境目を探すと N 回まわる）。 */
        const k = S.k++; S.at++;
        const s = round(k * N / M);
        const f = min(FR - 1, (s / N * FR) | 0), base = f * M;
        if (!LIVE[base + k]) continue;
        const mean = MEAN[f] || 1;
        const mag = min(1, abs((R_[base + k] - mean) / mean) * 2.2);
        const t = ten[f];
        const fq = F * PARTIAL[min(PARTIAL.length - 1, floor(mag * PARTIAL.length))];
        const amp = (0.10 + 0.22 * mag) * (0.55 + 0.45 * t);
        const len = round(sr * (0.45 + 0.95 * (1 - mag)));
        const a = k / M * TAU, pl = (1 - cos(a)) / 2, pr = (1 + cos(a)) / 2;
        const dph = fq / sr, de = EB / len;
        const al = amp * pl, ar = amp * pr;
        let ph = 0, ei = 0, j = s;
        for (let i = 0; i < len; i++) {
          // 包絡は両端が必ず0。立ち上がりはゆるく、収まりは長く
          const x = (ph - (ph | 0)) * TB, wi = x | 0;
          const gi = ei | 0;
          const v = (WAVE[wi] + (WAVE[wi + 1] - WAVE[wi]) * (x - wi))
                  * (ENV[gi] + (ENV[gi + 1] - ENV[gi]) * (ei - gi));
          LL[j] += v * al; RR[j] += v * ar;
          ph += dph; ei += de;
          if (++j === N) j = 0;                  // 輪へ回り込ませる（終端で断ち切らない）
        }
        S.grains++;
      }
      return S.bed >= S.bedN && S.k >= M;
    },

    _out() {
      const S = this._st, { LL, RR } = S;
      // 硬く切らず、やわらかく寝かせる（重なっても潰れない・段差を作らない）
      const L = new Float32Array(N), R = new Float32Array(N);
      let peak = 0;
      for (let s = 0; s < N; s++) {
        const a = abs(LL[s]), b = abs(RR[s]);
        if (a > peak) peak = a;
        if (b > peak) peak = b;
      }
      const pre = (peak > 0 ? 0.9 / peak : 0) * 1.25;
      for (let s = 0; s < N; s++) {
        L[s] = tanh(LL[s] * pre) * 0.86;
        R[s] = tanh(RR[s] * pre) * 0.86;
      }
      // 頼まれた長さへ。輪なので、並べても継ぎ目は出ない
      const TOTAL = max(N, round(SEC * sr));
      if (TOTAL === N) return { L, R, sr, seconds: N / sr, F: S.F, grains: S.grains };
      const L2 = new Float32Array(TOTAL), R2 = new Float32Array(TOTAL);
      for (let s = 0; s < TOTAL; s++) { const j = s % N; L2[s] = L[j]; R2[s] = R[j]; }
      return { L: L2, R: R2, sr, seconds: TOTAL / sr, F: S.F, grains: S.grains };
    }
  };
}

if (typeof module !== 'undefined') module.exports = { koe };
