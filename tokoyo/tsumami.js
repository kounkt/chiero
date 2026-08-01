/* tsumami.js — 作品に付けるつまみ。正本はここ一つ。
   一覧・章の頁・作品の頁が同じこれを読む。**作品が見えるところなら、どこでも同じことができる。**

   持たせるもの:
     聴く   … その場で式から声を作って鳴らす（音源ファイルは置かない）。
              **同時に鳴るのは一体だけ。**別のを鳴らせば前のは止まる
     全画面 … canvas を引き伸ばさない。その大きさで作り直す（一点＝実ピクセル1個の掟）

   作り直しは呼ぶ側が持つ（kami を握っているのは呼ぶ側なので）。
   ここは「いつ・どの大きさで」だけを伝える。
*/

const TSUMAMI = (() => {
  let ac = null;                 // 音の器は全体で一つ
  let live = null;               // いま鳴っている一体

  function stopAll() {
    if (!live) return;
    try { live.node.stop(); } catch (e) {}
    live.node.disconnect();
    live.btn.textContent = '聴く'; live.btn.className = 'ghost';
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
      btn.textContent = '消す'; btn.className = '';
    };

    btn.onclick = async () => {
      if (making) return;
      if (live && live.btn === btn) { stopAll(); return; }
      // 音の器は押した瞬間に作る（待ってから作ると iOS では許しが切れている）
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      ac.resume();
      if (!buf) {
        making = true; btn.disabled = true;
        const p = koe(w, { sr: ac.sampleRate, seconds: LOOP, M: 480, samp: 1800, hop: 441 });
        while (!p.done) {            // 画を止めたくないので毎フレーム手を離す
          p.step(24);
          btn.textContent = '用意 ' + Math.round(p.progress * 100) + '%';
          await new Promise(requestAnimationFrame);
        }
        const { L, R } = p.finish();
        buf = ac.createBuffer(2, L.length, ac.sampleRate);
        buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
        making = false; btn.disabled = false;
      }
      start();
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
      btn.textContent = o ? '戻る' : '全画面';
      if (o) fig.style.setProperty('--fsw', px() + 'px'); else fig.style.removeProperty('--fsw');
      onSize(o ? px() : null);
    };
    btn.onclick = () => {
      if (canFS) {
        if (document.fullscreenElement) document.exitFullscreen(); else fig.requestFullscreen();
      } else { fig.classList.toggle('full'); paint(); }   // iOS Safari は要素の全画面に非対応
    };
    if (canFS) document.addEventListener('fullscreenchange', () => { if (on() || btn.textContent === '戻る') paint(); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && fig.classList.contains('full')) { fig.classList.remove('full'); paint(); }
    });
  }

  /* 共有。押した人が投稿する——こちらからは出さない。
     スマホでは端末の共有（どこへでも出せる）。無ければ X の下書きを開く。

     文の組み立て（宣伝の言葉は一つも足さない）:
       観測記の**最初の一行**（何が起きているか）
       観測記の**最後の一行**（その理由。たいてい問いが開いたまま残る）
       姿が音になるという事実
       題

     煽らない。作品自身の言葉だけで、答えを言い切らずに渡す。 */
  function share(btn, o) {
    const body = [
      [o.lead, o.tail].filter(Boolean).join('\n'),
      o.lead ? '姿が、そのまま音になっています。' : '',
      o.title + '\n#常世 #tokoyo'
    ].filter(Boolean).join('\n\n');
    btn.onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: o.title, text: body, url: o.url }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const q = 'https://twitter.com/intent/tweet?text='
        + encodeURIComponent(body) + '&url=' + encodeURIComponent(o.url);
      window.open(q, '_blank', 'noopener');
    };
  }

  return { hear, full, share, stopAll };
})();

if (typeof module !== 'undefined') module.exports = { TSUMAMI };
