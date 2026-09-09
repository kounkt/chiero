/* tsumami.js — 一覧・章・個別作品の共通操作。
   点を減らす／復元、時刻と連動する音、全画面、本人による共有。
   点数を変えても f(i,t) は同じ。音には表示と同じ点番号を渡す。 */

const TSUMAMI = (() => {
  /* 札の言葉。既定は日本語で、英語の面だけが lang() で差し替える。
     **面ごとに札を書き分けない**——書き分けると、面が増えるたびに訳が散らばる。 */
  let T = {
    hear: '聴く', stop: '消す', ready: (p) => '準備 ' + p + '%・取消', muted: '消音中',
    full: '全画面', back: '戻る',
    thin: '点を減らす', undo: '40,000点に戻す',
    tane: '点は、同じ式と時間から配置されています。数を減らしても、残った点は同じ道を進みます。',
    tags: '#常世 #tokoyo'
  };
  const EN = document.documentElement.lang === 'en';
  if (EN) Object.assign(T, {hear:'Listen', stop:'Stop sound', ready:p=>'Preparing '+p+'% · Cancel', muted:'Muted', full:'Full screen', back:'Back', thin:'Fewer points', undo:'Restore 40,000', tane:'Points are placed by the same equation and time. Reduce their number and the remaining points follow the same paths.', tags:'#Tokoyo #常世'});
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

  function stopAll() { live?.stop(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });

  /* 音にも描画と同じ点番号の選択を渡す。保持する音は一作品・一段だけ。
     作成中の取消、点数変更、別作品への切替は世代番号で古い生成を無効にする。 */
  function hear(btn, w, getK) {
    const host = getK().host;
    const LOOP = (w.loop || 1) * 5;
    let generation = 0, node = null, buffer = null, wanted = false, held = false;
    const disconnect = () => { if (node) { try { node.stop(); } catch {} node.disconnect(); node = null; } };
    const stop = () => {
      generation++; wanted = false; disconnect(); buffer = null;
      if (live === api) live = null;
      btn.textContent = T.hear; btn.className = 'ghost'; btn.setAttribute('aria-pressed', 'false');
      btn.dataset.soundState = 'idle'; delete btn.dataset.soundCount;
      if (!live && keep) keep.pause();
    };
    const start = () => {
      if (!wanted || held || !buffer) return;
      disconnect(); node = ac.createBufferSource(); node.buffer = buffer; node.loop = true;
      node.connect(ac.destination);
      const phase = ((getK().now() / (Math.PI * 2) * 5) % LOOP + LOOP) % LOOP;
      node.start(0, phase);
      btn.textContent = T.stop; btn.dataset.soundState = 'playing';
    };
    const build = async () => {
      const id = ++generation;
      disconnect(); buffer = null;
      const pick = getK().selection?.() || {count:w.n, offset:0, stride:1};
      const selected = {...w, n:pick.count, f:(i,t)=>w.f(pick.offset + i * pick.stride, t)};
      btn.dataset.soundCount = String(pick.count); btn.dataset.soundState = 'preparing';
      const current = () => wanted && id === generation && live === api;
      const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));
      try {
        const p = koe(selected, {sr:ac.sampleRate, seconds:LOOP, M:360, samp:1200});
        while (!p.done) {
          if (!current()) return;
          p.step(8); btn.textContent = T.ready(Math.round(p.progress * 50)); await yieldFrame();
        }
        while (current() && !p.mix(1)) {
          btn.textContent = T.ready(Math.round(50 + p.mixed * 50)); await yieldFrame();
        }
        if (!current()) return;
        const {L,R} = p.finish();
        buffer = ac.createBuffer(2, L.length, ac.sampleRate);
        buffer.getChannelData(0).set(L); buffer.getChannelData(1).set(R);
        btn.textContent = T.stop; btn.dataset.soundState = held ? 'paused' : 'ready';
        start();
      } catch (e) {
        if (current()) { stop(); btn.textContent = EN ? 'Try listening again' : 'もう一度聴く'; }
      }
    };
    const changed = () => { if (wanted) build(); };
    const api = {
      stop,
      sync(on) { held = on; if (!wanted) return;
        if (on) { disconnect(); btn.dataset.soundState = 'paused'; } else start(); },
      destroy() { stop(); host?.removeEventListener('tokoyo:pointschange', changed);
        host?.removeEventListener('tokoyo:evict', stop); btn.onclick = null; }
    };
    host?.addEventListener('tokoyo:pointschange', changed);
    host?.addEventListener('tokoyo:evict', stop);
    btn.setAttribute('aria-pressed', 'false');
    btn.onclick = async () => {
      if (wanted) { stop(); return; }
      stopAll(); wanted = true; live = api; held = getK().isHeld();
      const request = ++generation;
      btn.setAttribute('aria-pressed', 'true'); btn.textContent = T.ready(0);
      try {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        unlock(); await ac.resume();
        if (!wanted || generation !== request || live !== api) return;
        build();
      } catch { stop(); btn.textContent = EN ? 'Sound unavailable' : '音を再生できません'; }
    };
    return api;
  }

  /* 全画面。onSize(px) は「その大きさで作り直して」の合図。null は元に戻す合図 */
  function full(btn, fig, onSize) {
    const canFS = !!fig.requestFullscreen;
    const px = () => Math.max(320, Math.min(1100,
      Math.min(innerWidth - 32, innerHeight - 132)));
    const on = () => canFS ? document.fullscreenElement === fig : fig.classList.contains('full');
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
    addEventListener('resize', () => { if (on()) paint(); });
    if (canFS) document.addEventListener('fullscreenchange', () => { if (on() || btn.textContent === T.back) paint(); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && fig.classList.contains('full')) { fig.classList.remove('full'); paint(); }
    });
  }

  /* 40,000 → 625 → 40 → 1。復元は独立したボタン。
     少数点では点幅と残像を増やし、通り道を辿れるようにする。
     apply() は全画面などで描画を作り直した際にも使える。 */
  function thin(btn, getK, o) {
    const n = o.n, ladder = [1, 64, 1000, n];
    const trails = [null, null, .965, .995], dots = [1,1,2,4];
    const restore = o.restore || document.createElement('button');
    if (!o.restore) btn.after(restore);
    restore.className = 'ghost restore';
    let rung = 0, timer = null;
    const count = v => Number(v).toLocaleString(EN ? 'en-US' : 'ja-JP');
    const label = () => rung === 3 ? (EN ? 'One point' : '一点を見ています')
      : (EN ? 'Reduce to ' + count(Math.ceil(n / ladder[rung+1])) : count(Math.ceil(n / ladder[rung+1])) + '点に減らす');
    function apply(wipe = true) {
      const k = getK(); if (!k) return;
      if (wipe) k.clear();
      k.setTrail(trails[rung] === null ? k.baseTrail : trails[rung]);
      k.setDot(dots[rung]); k.setThin(ladder[rung]);
      if (o.cnt) { o.cnt.textContent = count(k.shown()); o.cnt.setAttribute('aria-live','polite'); }
      btn.textContent = label(); btn.className = 'thin-primary'; btn.disabled = rung === 3;
      restore.textContent = EN ? 'Restore ' + count(n) : count(n) + '点に戻す';
      restore.disabled = rung === 0;
      if (o.art) { o.art.setAttribute('aria-label', label()); o.art.setAttribute('aria-disabled', String(rung === 3)); }
    }
    const step = () => { if (rung < 3) { rung++; apply(); } };
    const stopAuto = () => { clearTimeout(timer); timer = null; };
    const byHand = () => { stopAuto(); if (rung < 3) {
      const first = rung === 0; step();
      window.TOKOYO_EVENTS?.record(first ? 'first_reduce' : rung === 3 ? 'one_point' : 'reduce', o.slug);
    } };
    const reset = () => { stopAuto(); rung = 0; apply(); };
    btn.onclick = byHand; restore.onclick = reset;
    const clickArt = e => { if (e.target.closest('button,a')) return; byHand(); };
    const keyArt = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); byHand(); } };
    if (o.art) {
      o.art.tabIndex = 0; o.art.setAttribute('role','button');
      o.art.addEventListener('click',clickArt); o.art.addEventListener('keydown',keyArt);
    }
    // 自動巡回は呼び出し側が明示した場合のみ。操作・停止中は進めない。
    if (o.auto && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const wait = () => { timer = setTimeout(() => {
        const r = btn.getBoundingClientRect();
        if (!document.hidden && !getK().isHeld() && r.bottom > 0 && r.top < innerHeight) {
          rung = (rung+1)%4; apply();
        }
        wait();
      }, o.auto[rung] || 5000); }; wait();
    }
    apply();
    return {apply, step, at:()=>rung, stopAuto, restore:reset,
      destroy() { stopAuto(); o.art?.removeEventListener('click',clickArt); o.art?.removeEventListener('keydown',keyArt); }
    };
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
     現在の描画を使い、あらかじめ選んだ別の画像には置き換えない。

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
