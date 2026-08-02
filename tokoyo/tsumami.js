/* tsumami.js — 作品に付けるつまみ。正本はここ一つ。
   一覧・章の頁・作品の頁が同じこれを読む。**作品が見えるところなら、どこでも同じことができる。**

   持たせるもの:
     関係を減らす … 点を間引く。**この作品の中心のつまみ**なので、置ける面には必ず置き、
                    どの面でも先頭に並べる（2026-08-02 本人指示で昇格）
     全画面 … canvas を引き伸ばさない。その大きさで作り直す（一点＝実ピクセル1個の掟）
     聴く   … その場で式から声を作って鳴らす（音源ファイルは置かない）。
              **同時に鳴るのは一体だけ。**別のを鳴らせば前のは止まる。
              2026-08-02 に降格し、作品の頁だけに置く——一覧と章では「関係を減らす」に場所を譲る

   作り直しは呼ぶ側が持つ（kami を握っているのは呼ぶ側なので）。
   ここは「いつ・どの大きさで」だけを伝える。
*/

const TSUMAMI = (() => {
  /* 札の言葉。既定は日本語で、英語の面だけが lang() で差し替える。
     **面ごとに札を書き分けない**——書き分けると、面が増えるたびに訳が散らばる。 */
  let T = {
    hear: '聴く', stop: '消す', ready: (p) => '用意 ' + p + '%', muted: '消音中',
    full: '全画面', back: '戻る',
    thin: '関係を減らす', undo: '戻す',
    tane: '点の位置は、ほかの点との関係だけで決まっています。関係を取り除くと、形も消えます。',
    tags: '#常世 #tokoyo'
  };
  const lang = (o) => { T = Object.assign({}, T, o); };

  let ac = null;                 // 音の器は全体で一つ（iOS は器の数に上限がある）
  let live = null;               // いま鳴っている一体
  let keep = null;               // iOS 用の無音（下の unlock を見よ）

  /* iOS で音が出ない三つの理由と、その手当て。

     ① 器が止まったまま
        AudioContext は押した瞬間に作って resume する必要がある。
        用意（数秒）のあとに resume しても、そのときには操作の許しが切れている。
        **押した瞬間に resume を待ち切る。**

     ② 一度も鳴らしていないと「環境音」扱いになる
        その状態だと本体のマナーモードで消される。
        押した瞬間に長さ1の無音を鳴らし、無音の音声要素を回し続けて種類を変える。

     ③ それでもマナーモードで消えることがある
        こちらでは越えられない。鳴っていないことが分かるように、状態を見て札を変える。 */
  function unlock() {
    try {
      const b = ac.createBuffer(1, 1, ac.sampleRate);
      const s = ac.createBufferSource(); s.buffer = b;
      s.connect(ac.destination); s.start(0);
    } catch (e) {}
    if (keep) { keep.play().catch(() => {}); return; }
    try {
      // 無音の WAV を組み立てて回し続ける（音声要素が鳴っていると環境音扱いを抜ける）
      const sr = 8000, n = sr * 0.4, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      w(36, 'data'); v.setUint32(40, n * 2, true);
      keep = document.createElement('audio');
      keep.setAttribute('playsinline', ''); keep.loop = true; keep.volume = 0.0001;
      keep.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
      keep.play().catch(() => {});
    } catch (e) {}
  }

  function stopAll() {
    if (!live) return;
    try { live.node.stop(); } catch (e) {}
    live.node.disconnect();
    live.btn.textContent = T.hear; live.btn.className = 'ghost';
    live = null;
  }

  /* 聴く。
     btn: ボタン要素 / w: 作品 / getK: いまの kami を返す関数 */
  function hear(btn, w, getK) {
    const LOOP = w.loop * 5;
    let buf = null, making = false;

    const phase = () => {
      const k = getK();
      return ((k.now() / (Math.PI * 2) * 5) % LOOP + LOOP) % LOOP;
    };
    const start = () => {
      stopAll();
      const node = ac.createBufferSource();
      node.buffer = buf; node.loop = true;
      node.connect(ac.destination);
      node.start(0, phase());        // いま見えている姿の位置から鳴らす
      live = { node, btn, w };
      btn.textContent = T.stop; btn.className = '';
    };

    btn.onclick = async () => {
      if (making) return;
      if (live && live.btn === btn) { stopAll(); return; }
      // 音の器は押した瞬間に作り、resume を待ち切る（あとで待つと許しが切れている）
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      unlock();
      try { await ac.resume(); } catch (e) {}
      if (!buf) {
        making = true; btn.disabled = true;
        /* ブラウザ側は軽い設定にする。倍音の並びは実測でほぼ変わらないのに、
           作る時間が半分になる（スマホでは待たされること自体が「音が出ない」に見える）。
           書き出しの道具は重い設定のまま。 */
        const p = koe(w, { sr: ac.sampleRate, seconds: LOOP, M: 360, samp: 1200 });
        // 前半が輪郭を取るところ、後半が音を組むところ。合わせて0〜100%で出す
        while (!p.done) {            // 画を止めたくないので毎フレーム手を離す
          p.step(24);
          btn.textContent = T.ready(Math.round(p.progress * 50));
          await new Promise(requestAnimationFrame);
        }
        /* 組み立ても小分けにする。一息にやると数秒ふさがり、画が止まって見える。
           一回で回す仕事は少なめに保つ——粒は一つで最長1.4秒ぶんあるので、
           まとめて回すとそこで詰まる（実測）。 */
        while (!p.mix(2)) {
          btn.textContent = T.ready(Math.round(50 + p.mixed * 50));
          await new Promise(requestAnimationFrame);
        }
        const { L, R } = p.finish();
        buf = ac.createBuffer(2, L.length, ac.sampleRate);
        if (buf.copyToChannel) { buf.copyToChannel(L, 0); buf.copyToChannel(R, 1); }
        else { buf.getChannelData(0).set(L); buf.getChannelData(1).set(R); }  // 古い iOS 向け
        making = false; btn.disabled = false;
      }
      try { await ac.resume(); } catch (e) {}
      start();
      // 器が動いていなければ、鳴っていないことが分かるようにする
      setTimeout(() => {
        if (live && live.btn === btn && ac.state !== 'running') btn.textContent = T.muted;
      }, 400);
    };
    return {
      // 時を止めたら音も止まる。動かしたら、その姿から鳴り直す
      sync(held) {
        if (!live || live.btn !== btn) return;
        if (held) ac.suspend(); else ac.resume().then(start);
      },
      stop: () => { if (live && live.btn === btn) stopAll(); }
    };
  }

  /* 全画面。onSize(px) は「その大きさで作り直して」の合図。null は元に戻す合図 */
  function full(btn, fig, onSize) {
    const canFS = !!fig.requestFullscreen;
    const px = () => Math.max(320, Math.min(1100,
      Math.min(innerWidth - 32, innerHeight - 132)));
    const on = () => canFS ? !!document.fullscreenElement : fig.classList.contains('full');
    const paint = () => {
      const o = on();
      btn.textContent = o ? T.back : T.full;
      if (o) fig.style.setProperty('--fsw', px() + 'px'); else fig.style.removeProperty('--fsw');
      onSize(o ? px() : null);
    };
    btn.onclick = () => {
      if (canFS) {
        if (document.fullscreenElement) document.exitFullscreen(); else fig.requestFullscreen();
      } else { fig.classList.toggle('full'); paint(); }   // iOS Safari は要素の全画面に非対応
    };
    if (canFS) document.addEventListener('fullscreenchange', () => { if (on() || btn.textContent === T.back) paint(); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && fig.classList.contains('full')) { fig.classList.remove('full'); paint(); }
    });
  }

  /* 関係を減らす。**この作品の中心にあるつまみ。**

     点の位置は、ほかの点との関係と時間の進み方だけで決まっている。
     間引いていくと、どこかでパターンが読めなくなり、そこで生き物が消える。
     消えるのは形であって、式ではない——式は最後まで同じものが走っている。

     四段の梯子: 全部 → 64点に1点 → 1000点に1点 → 1点だけ → 全部に戻る。
     点が少ないと1画素では見えないので、通り道を長く残し、点も大きくする。
     **数は増えない**——見えているのは「在ること」だけで、形は戻らない。

     btn: ボタン要素 / getK: いまの kami を返す関数
     o: { n: 点の数, cnt: 数を出す要素(任意), art: 押しても減らす要素(任意),
          auto: 段ごとの持ち時間ミリ秒の配列(任意。入れるとひとりでに巡る) }

     全画面などで kami を作り直したら、呼ぶ側が apply() を呼んで段を戻す。 */
  function thin(btn, getK, o) {
    const n = o.n, LADDER = [1, 64, 1000, n];
    /* 最後の段の残像は .99 だった。前の段の光を消す（下の wipe）ようにしたら、
       一点の通り道がほとんど描かれないことが分かった——一巡り後に見えていたのは
       14画素だけ（繭で実測）。.995 に伸ばし、点を一回り大きくして 308画素。
       通り道は引かれるが、形は戻らない。 */
    const TRAIL = [null, null, .965, .995], DOT = [1, 1, 2, 4];
    let rung = 0;
    /* wipe: 段を変えたら前の段の残像を捨てる。
       捨てないと、四万点で溜まった光が新しい残像の率（.99）で薄れるので、
       一点にしたのに四万点の姿が数秒わだかまり、**何点になったのかが読めない**（実測）。
       捨てると、その段の点だけが最初から積み直される。
       作り直し（全画面）のあとに段を戻すときは捨てない——溜め直した履歴を消さないため。 */
    function apply(wipe) {
      const k = getK(); if (!k) return;
      if (wipe) k.clear();
      k.setThin(LADDER[rung]);
      k.setTrail(TRAIL[rung] === null ? k.baseTrail : TRAIL[rung]);
      k.setDot(DOT[rung]);
      if (o.cnt) o.cnt.textContent = k.shown();
      btn.textContent = rung ? T.undo : T.thin;
      btn.className = rung ? '' : 'ghost';
    }
    const step = () => { rung = (rung + 1) % LADDER.length; apply(true); };

    /* ひとりでに減らす（頭の一体だけに付ける）。
       触らない人にも「点が減ると形が消える」が届くように、段を順に巡る。
       **手で触った瞬間に止める**——そこから先は見る人のもので、勝手に動かさない。

       止める条件は三つ:
         手で押した / 画面の外にいる / 別の頁を見ている
       動きを減らす設定の人には、そもそも動かさない（DESIGN.md §7）。 */
    let timer = null, watcher = null, onScreen = true;
    function stopAuto() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (watcher) { watcher.disconnect(); watcher = null; }
    }
    function startAuto(holds) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const eye = o.art || btn;
      watcher = new IntersectionObserver(
        (es) => { for (const e of es) onScreen = e.isIntersecting; }, { rootMargin: '0px' });
      watcher.observe(eye);
      const wait = () => {
        timer = setTimeout(() => {
          if (!timer) return;
          // 見られていないあいだは段を進めない。戻ってきたら続きから
          if (onScreen && !document.hidden) step();
          wait();
        }, holds[rung] || 5000);
      };
      wait();
    }

    const byHand = () => { stopAuto(); step(); };
    btn.onclick = byHand;
    // ボタンが画の内側に置かれると、泡立ちで二段進んでしまう。押されたのが札なら見送る
    if (o.art) o.art.addEventListener('click', (e) => {
      if (btn.contains(e.target)) return;
      byHand();
    });
    if (o.auto) startAuto(o.auto);

    return { apply, step, at: () => rung, stopAuto };
  }

  /* 共有。押した人が投稿する——こちらからは出さない。
     スマホでは端末の共有（どこへでも出せる）。無ければ X の下書きを開く。

     文の組み立て（宣伝の言葉は一つも足さない）:
       観測記の**最初の一行**（何が起きているか）
       観測記の**最後の一文**（打ち所。たいてい問いが開いたまま残る）
         ——段落まるごとだと長すぎて打ち所がぼやける。最後の一文だけを採る
       **種の一文**（この作品が言いたいこと一つ）
       題

     2026-08-02: ここは「姿が音になる」という事実を置いていた。
     音は作品の中心ではないので外し、**種の一文**に差し替えた。
     流れてきた一投稿だけで、何を見せられているのかが分かる形にする。

     煽らない。作品自身の言葉だけで、答えを言い切らずに渡す。 */

  /* 縦の一枚を、**いま見えている画そのもの**から組む（1080×1920）。

     ストーリーズは縦長で、たいてい繋がる先を押せない。だから
       ・9:16 に組む（横長の札を出すと上下が黒く余る）
       ・住所を画の中に文字で入れる（押せなくても辿れるように）
       ・種の一文を必ず載せる（一枚だけ流れてきた人に、何を見ているのかが渡る）
     出るのは**その人が見ていた瞬間**。減らしている途中なら、減った姿がそのまま出る。
     こちらで作り置きした絵ではないので、同じ画は二度と出ない。

     数式帯は入れない。帯の落款を入れると、下に置く落款と合わせて赤が二つになる。 */
  function card(k, o) {
    const W = 1080, H = 1920, M = 80, S = W - M * 2;      // 画は 920 角
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#0B0B0D'; g.fillRect(0, 0, W, H);

    const G = '"Hiragino Sans","Noto Sans JP",sans-serif';
    const MN = '"Hiragino Mincho ProN","Yu Mincho",serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';

    let y = 210;
    g.font = `34px ${G}`; g.fillStyle = '#6E6E74';
    g.fillText(o.top || '', W / 2, y);
    y += 108;
    g.font = `600 92px ${MN}`; g.fillStyle = '#F2F2F4';
    g.fillText(o.name || '', W / 2, y);

    // 画の正方形だけを切り出して置く（帯と落款は切り落とす）
    y += 74;
    g.strokeStyle = '#26262B'; g.lineWidth = 2;
    g.strokeRect(M - 1, y - 1, S + 2, S + 2);
    g.drawImage(k.canvas, k.ox, k.oy, k.side, k.side, M, y, S, S);
    y += S + 66;

    g.font = `34px ${G}`; g.fillStyle = '#9A9AA0';
    g.fillText(k.shown().toLocaleString('en-US') + '点', W / 2, y);

    /* 種の一文。句点で折って二行に収める。
       端末の書体で幅が変わるので、**版面に収まるまで字を詰める**（決め打ちだと端で切れる）。 */
    y += 104;
    const lines = T.tane.split(/(?<=[。.])\s*/).filter(Boolean);
    const room = W - 144;
    let fs = 40;
    while (fs > 24) {
      g.font = `${fs}px ${MN}`;
      if (Math.max(...lines.map(l => g.measureText(l).width)) <= room) break;
      fs--;
    }
    g.fillStyle = '#D2D2D8';
    for (const ln of lines) { g.fillText(ln, W / 2, y); y += Math.round(fs * 1.55); }

    y += 56;
    g.font = `32px ${G}`; g.fillStyle = '#6E6E74';
    g.fillText((o.url || '').replace(/^https?:\/\//, ''), W / 2, y);

    // 赤は一点だけ（DIRECTIVE §0）
    g.fillStyle = '#E60012'; g.fillRect(W / 2 - 11, y + 46, 22, 22);

    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }

  /* 共有。押した人が投稿する——こちらからは出さない。
     スマホでは端末の共有（どこへでも出せる）。無ければ X の下書きを開く。

     文の組み立て（宣伝の言葉は一つも足さない）:
       観測記の**最初の一行**（何が起きているか）
       観測記の**最後の一文**（打ち所。たいてい問いが開いたまま残る）
         ——段落まるごとだと長すぎて打ち所がぼやける。最後の一文だけを採る
       **種の一文**（この作品が言いたいこと一つ）
       題

     2026-08-02: ここは「姿が音になる」という事実を置いていた。
     音は作品の中心ではないので外し、**種の一文**に差し替えた。
     流れてきた一投稿だけで、何を見せられているのかが分かる形にする。

     同日: **画も一緒に渡す**（getK を渡した面だけ）。
     画が付いていれば、端末の共有からストーリーズへ出せる。
     住所は文にも画にも入れる——ストーリーズは繋がる先を押せないことが多いので。

     煽らない。作品自身の言葉だけで、答えを言い切らずに渡す。 */
  function share(btn, o, getK) {
    const last = (o.tail || '').split('。').map(x => x.trim()).filter(Boolean).pop();
    const body = [
      [o.lead, last ? last + '。' : ''].filter(Boolean).join('\n'),
      T.tane,
      o.title + '\n' + T.tags
    ].filter(Boolean).join('\n\n');
    const was = btn.textContent;

    btn.onclick = async () => {
      let files = null;
      if (getK && navigator.canShare) {
        btn.textContent = '用意中';
        try {
          const k = getK();
          const blob = k && await card(k, o);
          if (blob) {
            const f = new File([blob], (o.file || 'tokoyo') + '.png', { type: 'image/png' });
            if (navigator.canShare({ files: [f] })) files = [f];
          }
        } catch (e) {}
        btn.textContent = was;
      }
      if (navigator.share) {
        // 画を渡すときは住所を文に畳む（画と url を同時に渡すと url を落とす端末がある）
        const data = files ? { files, text: body + '\n' + o.url }
                           : { title: o.title, text: body, url: o.url };
        try { await navigator.share(data); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const q = 'https://twitter.com/intent/tweet?text='
        + encodeURIComponent(body) + '&url=' + encodeURIComponent(o.url);
      window.open(q, '_blank', 'noopener');
    };
  }

  return { hear, full, thin, share, card, stopAll, lang, get TANE() { return T.tane; } };
})();

if (typeof module !== 'undefined') module.exports = { TSUMAMI };
