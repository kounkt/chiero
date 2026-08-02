/* koe.js — 住人の声。姿を、そのまま波形にする。正本はここ一つ。
   作品の頁（ブラウザ）と書き出し（tools/build_sound.mjs）が同じこのファイルを読む。

   ── 作り ──
     その瞬間の点群を重心のまわりの角度で並べると、住人の輪郭が一本の線になる。
     **その輪郭を一定の速さで辿った値が波形。** x を左、y を右へ出すので、
     左右をオシロスコープの XY に入れると、画面にその住人が現れる。
     聴こえている波形と、見えている姿は同じもの。

     腕や花弁の数だけ一周に山が来るので、**姿の数がそのまま倍音の数になる。**
     音階は選んでいない。一周の速さ（＝高さ）だけがこちらの選択。

   ── なぜ「点の動きを時間で聴く」のをやめたか ──
     体の点はどれも同じ周期を持っている。メトロノーム100台は周期がばらばらだから
     texture が生まれるが、同じ周期のものを足し引きしても位相の合計が変わるだけ。
     実測でも音色の動きは 0.05 から動かず、点を増減すると音量が ±12dB 跳ねるだけだった。

   ── つまみ（すべて実測で選んだ）──
     round 0.15  丸さをどれだけ残すか。0.35 では基音が支配して**どの住人も同じ音**になった
                 （音色どうしの隔たり 0.16／蛸と花は 0.02＝ほぼ同一）。0.15 で 0.35 まで開いた
     lift  1.6   姿の起伏をどれだけ前に出すか。上げるほど個性は出るが、ざらつきも増える
     smoothMs 8  輪郭を時間方向に均す時定数。縁は点一つの出入りで跳ねるので、
                 均さないと緊張と緩和の弧が読めない
     密度で測る案は試して捨てた——個性は変わらず、弧が痩せ、繭と帯が同じ音色になった

   ── 聴く側の作りに合わせた三点（「脳と音楽」）──
     ① 人は差でなく比を感じる（ウェーバー）: 丸さを抑えて起伏を前に出す。**消しはしない**
     ② 繰り返しが予測を作り、変化が情報になる: 一周は反復し、姿は変化する
     ③ 感覚は物理量の対数（ウェーバー・フェヒナー）: 音量は姿の大きさの 0.4 乗で動かす

   ── 使い方 ──
     const p = koe(work, {sr, seconds});
     while (!p.done) p.step();      // 重いので、ブラウザでは小分けにして呼ぶ
     const { L, R } = p.finish();   // Float32Array（-1..1）
*/

function koe(w, o) {
  o = o || {};
  const M = Math.max(0, Math.trunc(o.M || 600));      // 輪郭を何方向で持つか
  const sr = o.sr || 44100;
  /* 一周の速さ＝音の高さ。**姿に決めさせる**（2026-08-02 変更）。

     それまでは全作品 110Hz の固定だった。人は音色より先に高さで聞き分けるので、
     25点が同じ高さの持続音では、倍音がどれだけ違っても同じ声に聞こえる。
     実測でも音色どうしの隔たりは平均 0.184、いちばん近い組は 0.0066（ほぼ同一）だった。
     輪郭の取り方を6通り変えても 0.16〜0.24 から動かず、その経路は枯れていた。

     **大きい体ほど低い声。**弦や管と同じ、長さに反比例（1乗）。
     REF 74 は25点の姿の大きさ（輪郭の平均半径）の幾何平均。
     ここは「音階を選ぶ」のではなく、**最後に残っていた選択を姿に渡す**変更である。 */
  const REF = o.ref || 74, F0 = o.baseF || 110;
  const HOP = Math.max(1, Math.trunc(o.hop || 220));  // 姿を測り直す間隔
  const SAMP = Math.max(0, Math.trunc(o.samp || 4000));
  const ROUND = o.round == null ? 0.15 : o.round;
  const LIFT = o.lift == null ? 1.6 : o.lift;
  const SMOO = Math.exp(-(HOP / sr) / ((o.smoothMs == null ? 8.3 : o.smoothMs) / 1000));
  const SEC = o.seconds || w.loop * 5;
  const TOTAL = Math.round(SEC * sr / HOP) * HOP;
  const FRAMES = TOTAL / HOP + 1;
  const DT = (Math.PI * 2) / (5 * sr);                // 音の1サンプルで画の時刻が進む量（画は1周5秒）

  const { sin, cos, hypot, atan2, floor, round, min, max, abs, pow, sqrt } = Math;
  const TAU = Math.PI * 2;

  const idx = new Int32Array(SAMP);
  for (let k = 0; k < SAMP; k++) idx[k] = floor((k * 0.618034 % 1) * w.n);

  const bins = new Float64Array(M), cnt = new Int32Array(M), dev = new Float64Array(M);
  // 位置は1フレームにつき一度だけ求める（重心と輪郭で二度呼ぶと倍かかる）
  const px = new Float64Array(SAMP), py = new Float64Array(SAMP), ok = new Uint8Array(SAMP);
  const keepX = new Float64Array(M), keepY = new Float64Array(M);
  // 全フレームぶんの輪郭。あとで滑らかに繋いで読む
  const ox = new Float32Array(FRAMES * M), oy = new Float32Array(FRAMES * M);
  const sz = new Float32Array(FRAMES);
  let fi = 0, warmed = false;

  function one(t, base) {
    let cx = 0, cy = 0, n = 0;
    for (let q = 0; q < SAMP; q++) {
      const p = w.f(idx[q], t);
      const good = isFinite(p[0]) && isFinite(p[1]) && !(p[0] === -9 && p[1] === -9);
      ok[q] = good ? 1 : 0;
      if (!good) continue;
      px[q] = p[0]; py[q] = p[1];
      cx += p[0]; cy += p[1]; n++;
    }
    if (!n) return 0;
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
    // 誰も居ない方向は両隣から埋める（穴があるとそこでプツッと鳴る）
    for (let k = 0; k < M; k++) if (!cnt[k]) {
      let a = 1, b2 = 1;
      while (a < M && !cnt[(k - a + M) % M]) a++;
      while (b2 < M && !cnt[(k + b2) % M]) b2++;
      bins[k] = (bins[(k - a + M) % M] + bins[(k + b2) % M]) / 2;
    }
    let mean = 0;
    for (let k = 0; k < M; k++) mean += bins[k];
    mean /= M;
    /* ①「丸さ」は1周を通じた平均そのもの（局所平均では取れない。円は1周に1回の成分なので）。
       大きさは音量が受け持つので、丸さを下げて姿の起伏を前に出す。
       **半径が負になってよい**——反対側を通るだけで線は切れないので音も切れない。
       正に保とうとすると、起伏の大きい住人ほど縮められる（実測で 0.2倍まで縮んだ）。 */
    for (let k = 0; k < M; k++) dev[k] = bins[k] - mean;
    for (let k = 0; k < M; k++) {
      const r = mean * ROUND + dev[k] * LIFT, a = k / M * TAU;
      let X = r * cos(a), Y = r * sin(a);
      if (!warmed) { keepX[k] = X; keepY[k] = Y; }
      else { keepX[k] = keepX[k] * SMOO + X * (1 - SMOO); keepY[k] = keepY[k] * SMOO + Y * (1 - SMOO); }
      ox[base + k] = keepX[k]; oy[base + k] = keepY[k];
    }
    warmed = true;
    return mean || 1;
  }

  /* 姿の大きさ（輪郭の平均半径）だけを出す。高さを決めるためだけに使う。

     **測り方を固定する。**輪郭は「その向きのいちばん外」で取るので、
     見る点を増やすほど外の点に当たりやすく、体が大きく出る。
     描画の設定（点の数・向きの数）に任せると、同じ作品なのに
     ブラウザと書き出しで高さが変わった——実測で最大307セント＝3半音（貝）。
     高さは作品の性質であって、描き方の性質ではない。**ここだけ 1200点・360方向に固定する。** */
  const B_SAMP = 1200, B_M = 360;
  const bIdx = new Int32Array(B_SAMP);
  for (let k = 0; k < B_SAMP; k++) bIdx[k] = floor((k * 0.618034 % 1) * w.n);
  const bBins = new Float64Array(B_M), bCnt = new Int32Array(B_M);
  const bx = new Float64Array(B_SAMP), by = new Float64Array(B_SAMP), bOk = new Uint8Array(B_SAMP);

  function bodyAt(t) {
    let cx = 0, cy = 0, n = 0;
    for (let q = 0; q < B_SAMP; q++) {
      const p = w.f(bIdx[q], t);
      const good = isFinite(p[0]) && isFinite(p[1]) && !(p[0] === -9 && p[1] === -9);
      bOk[q] = good ? 1 : 0;
      if (!good) continue;
      bx[q] = p[0]; by[q] = p[1];
      cx += p[0]; cy += p[1]; n++;
    }
    if (!n) return 0;
    cx /= n; cy /= n;
    bBins.fill(0); bCnt.fill(0);
    for (let q = 0; q < B_SAMP; q++) {
      if (!bOk[q]) continue;
      const dx = bx[q] - cx, dy = by[q] - cy;
      const b = floor(((atan2(dy, dx) + TAU) % TAU) / TAU * B_M) % B_M;
      const r = hypot(dx, dy);
      if (r > bBins[b]) bBins[b] = r;
      bCnt[b]++;
    }
    for (let k = 0; k < B_M; k++) if (!bCnt[k]) {
      let a = 1, b2 = 1;
      while (a < B_M && !bCnt[(k - a + B_M) % B_M]) a++;
      while (b2 < B_M && !bCnt[(k + b2) % B_M]) b2++;
      bBins[k] = (bBins[(k - a + B_M) % B_M] + bBins[(k + b2) % B_M]) / 2;
    }
    let m = 0;
    for (let k = 0; k < B_M; k++) m += bBins[k];
    return m / B_M;
  }

  return {
    frames: FRAMES,
    get done() { return fi >= FRAMES; },
    get progress() { return fi / FRAMES; },
    step(n) {                                      // 輪郭を n フレームぶん作る
      n = n || 1;
      for (let q = 0; q < n && fi < FRAMES; q++, fi++) {
        sz[fi] = one(fi * HOP * DT, fi * M) || (fi ? sz[fi - 1] : 1);
      }
      return this.done;
    },
    /* その作品の高さ。姿の大きさに決めさせる。

       **描く長さに依らせない。**作った秒数ぶんの平均で出すと、
       伸びていく作品（雷）は3秒だけ作ったときに体が小さく出て、天井に張り付いた（実測）。
       高さは作品の性質であって、切り取り方の性質ではない。**一巡りを均して測る。** */
    pitch() {
      if (o.F) return o.F;                       // 呼ぶ側が決めたならそれに従う
      let m = 0, k = 0;
      for (let s = 0; s < 12; s++) {
        const v = bodyAt(s * (w.loop || 1) * TAU / 12);
        if (v > 0) { m += v; k++; }
      }
      const body = k ? m / k : REF;
      return min(330, max(45, F0 * REF / body));  // 端は締める（極端に小さい/大きい姿の保険）
    },
    finish() {
      const L = new Float32Array(TOTAL), R = new Float32Array(TOTAL), size = new Float32Array(TOTAL);
      const F = this.pitch();
      let ph = 0;
      for (let s = 0; s < TOTAL; s++) {
        const f = (s / HOP) | 0, a = f * M, b = min(FRAMES - 1, f + 1) * M;
        const g = 0.5 - 0.5 * cos(Math.PI * (s % HOP) / HOP);   // 前の姿から次の姿へ滑らかに渡す
        const i0 = ph | 0, fr = ph - i0, i1 = (i0 + 1) % M;
        const xa = ox[a + i0] * (1 - fr) + ox[a + i1] * fr, xb = ox[b + i0] * (1 - fr) + ox[b + i1] * fr;
        const ya = oy[a + i0] * (1 - fr) + oy[a + i1] * fr, yb = oy[b + i0] * (1 - fr) + oy[b + i1] * fr;
        L[s] = xa * (1 - g) + xb * g;
        R[s] = ya * (1 - g) + yb * g;
        size[s] = sz[f] * (1 - g) + sz[min(FRAMES - 1, f + 1)] * g;
        ph = (ph + M * F / sr) % M;
      }
      // ③ 音量は姿の大きさの 0.4 乗で動かす（等しい比が等しい歩幅に感じられる）
      let hi = 0;
      for (let s = 0; s < TOTAL; s++) hi = max(hi, size[s]);
      for (let s = 0; s < TOTAL; s++) {
        const g = pow(size[s] / hi, 0.4) / (size[s] || 1);
        L[s] *= g; R[s] *= g;
      }
      let peak = 0;
      for (let s = 0; s < TOTAL; s++) peak = max(peak, abs(L[s]), abs(R[s]));
      const gain = peak ? 0.86 / peak : 0;
      const FADE = round(sr * 0.02);
      for (let s = 0; s < TOTAL; s++) {
        const e = min(1, s / FADE, (TOTAL - 1 - s) / FADE);   // 頭と尻の当たりだけ取る
        L[s] = max(-1, min(1, L[s] * gain * e));
        R[s] = max(-1, min(1, R[s] * gain * e));
      }
      return { L, R, sr, seconds: TOTAL / sr, F };
    }
  };
}

if (typeof module !== 'undefined') module.exports = { koe };
