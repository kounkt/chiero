/* timeline.js — 紹介動画の動き。
   すべての動きを一本の GSAP タイムラインに載せ、書き出し時は window.__frame(i) で i/fps 秒へ進めて撮る。
   CSS の transition / animation と requestAnimationFrame は使わない（何度撮っても同じ絵になるように）。
   書き出しは時間の順に進める。常世の残像は前のコマに依存するので、途中のコマから撮り始めたときは
   場面の頭から残像を積み直す（並列で書き出しても、一続きで撮ったのと同じ絵になる）。 */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const PREFS = ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉',
  '東京', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '京都',
  '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡',
  '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];
// 『葉隠』入門書（book04）を先頭に。表紙はサイトの /covers/ をそのまま使う
const SHELF = [['04', '02', '01', '06', '10', '08', '03'], ['03', '05', '07', '09', '12', '04', '02', '01']];

async function init() {
  const cfg = await (await fetch('scenes.json')).json();
  const FPS = cfg.fps;
  const BAR = 240 / cfg.bpm;
  const S = {};
  let acc = 0;
  for (const sc of cfg.scenes) {
    S[sc.id] = { start: acc, dur: sc.bars * BAR, end: acc + sc.bars * BAR };
    acc += sc.bars * BAR;
  }
  const DURATION = acc;

  // ---- 動的に組む部品 ----
  const grid = $('#pref-grid');
  PREFS.forEach((name, i) => {
    const d = document.createElement('div');
    d.className = 'pref';
    d.innerHTML = `<small>${String(i + 1).padStart(2, '0')}</small>${name}`;
    grid.appendChild(d);
  });
  SHELF.forEach((row, r) => {
    const el = $(`.shelf-row.r${r + 1}`);
    for (const n of row) {
      const img = document.createElement('img');
      img.src = `../../covers/book${n}.jpg`;
      img.alt = '';
      el.appendChild(img);
    }
  });

  // 常世「水母」は works.js の正本の式をそのまま使う
  const kurage = WORKS.find(w => w.slug === '001_kurage');
  const formula = kurage.f.toString().replace(/\s+$/, '');
  const formulaEl = $('#tk-formula');
  formulaEl.textContent = formula;

  // ---- 字と画像を全部読み込んでから測る ----
  const text = $('#stage').textContent;
  await Promise.all([
    ['400', 'Noto Sans JP'], ['500', 'Noto Sans JP'], ['700', 'Noto Sans JP'], ['900', 'Noto Sans JP'],
    ['700', 'Noto Serif JP'], ['900', 'Noto Serif JP'], ['400', 'JetBrains Mono'],
  ].map(([w, f]) => document.fonts.load(`${w} 40px "${f}"`, text)));
  await document.fonts.ready;
  const bgImages = ['../../neko-habit/assets/room-studio.png', '../../neko-habit/assets/cats-kohaku.png'];
  await Promise.all([
    ...$$('img').map(im => im.decode().catch(() => { throw new Error('image failed: ' + im.src); })),
    ...bgImages.map(src => { const im = new Image(); im.src = src; return im.decode(); }),
  ]);

  const art = kami({ ...kurage, dark: true, mount: $('#kami-mount'), size: 1000, dpr: 2, formulaBand: false, deferFirstFrame: true });
  art.hold(); // 実時間では動かさない。時刻は __frame からだけ進める

  gsap.defaults({ ease: 'expo.out', duration: 0.9 });
  const tl = gsap.timeline({ paused: true });
  const syncers = [];

  // ---- 部品の出し入れ ----
  const lines = el => $$('.ln > span', typeof el === 'string' ? $(el) : el);
  const inLines = (el, at, { stagger = 0.1, dur = 1.0, ease = 'expo.out' } = {}) => {
    const ls = lines(el);
    gsap.set(ls, { yPercent: 118 });
    tl.to(ls, { yPercent: 0, duration: dur, stagger, ease }, at);
  };
  const outLines = (el, at, { stagger = 0.04, dur = 0.45 } = {}) =>
    tl.to(lines(el), { yPercent: -118, duration: dur, stagger, ease: 'power3.in' }, at);
  const fadeUp = (els, at, { y = 36, x = 0, dur = 0.9, stagger = 0.08, ease = 'expo.out' } = {}) => {
    gsap.set(els, { autoAlpha: 0, y, x });
    tl.to(els, { autoAlpha: 1, y: 0, x: 0, duration: dur, stagger, ease }, at);
  };
  const fadeOut = (els, at, { y = -24, dur = 0.42, stagger = 0.02 } = {}) =>
    tl.to(els, { autoAlpha: 0, y: `+=${y}`, duration: dur, stagger, ease: 'power2.in' }, at);
  const sceneOn = (id, at) => tl.set('#' + id, { autoAlpha: 1 }, at);
  const sceneOff = (id, at) => tl.set('#' + id, { autoAlpha: 0 }, at);
  const counter = (el, at, dur = 1.8) => {
    const to = Number(el.dataset.to), p = { v: 0 };
    tl.to(p, { v: to, duration: dur, ease: 'power3.out' }, at);
    syncers.push(() => { el.textContent = Math.round(p.v).toLocaleString('en-US'); });
  };

  // ---- 枠（章の見出し・フッター） ----
  gsap.set('#chrome', { autoAlpha: 0 });
  gsap.set('.topbar', { scaleX: 0 });
  gsap.set('.chrome-section .cs', { yPercent: 120 });
  let sectionKey = null;
  const section = (key, at) => {
    if (sectionKey) tl.to(`.cs[data-key="${sectionKey}"]`, { yPercent: -120, duration: 0.45, ease: 'power3.in' }, at);
    if (key) tl.fromTo(`.cs[data-key="${key}"]`, { yPercent: 120 }, { yPercent: 0, duration: 0.8, immediateRender: false }, at + 0.3);
    sectionKey = key;
  };

  // ---- 章の扉 ----
  const titleCard = (id, inAt, outAt, { exit = 'slide' } = {}) => {
    const tc = $('#' + id);
    const parts = [$('.tc-num', tc), $('.tc-en', tc), $('.tc-ja', tc)];
    gsap.set(tc, { autoAlpha: 1, xPercent: 102 });
    gsap.set(parts, { autoAlpha: 0, y: 50 });
    tl.to(tc, { xPercent: 0, duration: 0.75, ease: 'expo.inOut' }, inAt);
    tl.to(parts, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, inAt + 0.4);
    if (exit === 'slide') {
      tl.to(tc, { xPercent: -102, duration: 0.75, ease: 'expo.inOut' }, outAt);
    } else {
      tl.to(parts, { autoAlpha: 0, y: -30, duration: 0.45, stagger: 0.05, ease: 'power2.in' }, outAt);
      tl.set(tc, { autoAlpha: 0 }, outAt + 0.55);
    }
  };

  // ======================================================================
  // 1. オープニング：赤い帽子が落ちてきて、ロゴが立つ。そのままヘッダーへ収まる
  // ======================================================================
  const logo = $('#logo');
  const hat = $('.logo-hat');
  const letters = $$('.logo-wm span');
  const LW = logo.offsetWidth, LH = logo.offsetHeight;
  const DOCK = { scale: 0.164, x: 120 };
  DOCK.y = 69 - LH * DOCK.scale / 2;
  const CENTER = { x: (1920 - LW) / 2, y: (1080 - LH) / 2 - 50, scale: 1 };
  gsap.set(logo, { transformOrigin: '0 0', ...CENTER });
  gsap.set(hat, { y: -760, rotation: -32, transformOrigin: '50% 80%' });
  gsap.set($('.logo-wm'), { overflow: 'hidden' });
  gsap.set(letters, { yPercent: 105 });

  const o = S.opening.start;
  sceneOn('opening', o);
  tl.to(hat, { y: 0, duration: 0.62, ease: 'power2.in' }, o + 0.08);
  tl.to(hat, { rotation: 7, duration: 0.62, ease: 'power1.in' }, o + 0.08);
  tl.to(hat, { y: -34, duration: 0.2, ease: 'power2.out' }, o + 0.7);
  tl.to(hat, { y: 0, duration: 0.24, ease: 'power2.in' }, o + 0.9);
  tl.to(hat, { rotation: 0, duration: 0.9, ease: 'elastic.out(1.1, 0.45)' }, o + 0.7);
  tl.to(letters, { yPercent: 0, duration: 0.9, stagger: 0.06 }, o + 0.95);
  fadeUp('.open-sub', o + 1.75, { y: 24 });
  fadeUp('.open-foot', o + 2.1, { y: 12 });
  fadeOut(['.open-sub', '.open-foot'], o + 3.7);
  tl.to(logo, { x: DOCK.x, y: DOCK.y, scale: DOCK.scale, duration: 1.05, ease: 'expo.inOut' }, o + 3.95);
  sceneOff('opening', S.opening.end);

  // 枠が出る
  tl.set('#chrome', { autoAlpha: 1 }, o + 4.4);
  tl.to('.topbar', { scaleX: 1, duration: 1.1, ease: 'expo.inOut' }, o + 4.3);
  fadeUp(['.chrome-foot-l', '.chrome-foot-r'], o + 4.8, { y: 10 });

  // ======================================================================
  // 2. 商いにも、創造にも、好奇心を。
  // ======================================================================
  let s = S.tagline.start;
  sceneOn('tagline', s - 0.05);
  section('about', s - 0.3);
  fadeUp('#tagline .eyebrow', s + 0.15, { y: 16 });
  inLines('.h-hero', s + 0.25, { stagger: 0.14, dur: 1.1 });
  inLines('.lead', s + 0.95, { stagger: 0.1 });
  gsap.set('.hero-art', { clipPath: 'inset(0% 0% 0% 100%)' });
  tl.to('.hero-art', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut' }, s + 0.1);
  gsap.set('.hero-circle', { scale: 0 });
  tl.to('.hero-circle', { scale: 1, duration: 1.2 }, s + 0.6);
  fadeUp('.hero-char', s + 0.8, { y: 90, dur: 1.1, ease: 'back.out(1.4)' });
  tl.to('.hero-char', { y: -10, duration: 1.25, ease: 'sine.inOut', repeat: 3, yoyo: true }, s + 1.9);
  fadeUp('.hero-cap span', s + 1.15, { y: 30, stagger: 0.07 });
  gsap.set('.hero-dot', { scale: 0 });
  tl.to('.hero-dot', { scale: 1, duration: 0.7, ease: 'back.out(3)' }, s + 1.6);
  let x = S.tagline.end - 0.62;
  fadeOut('#tagline .eyebrow', x);
  outLines('.h-hero', x);
  outLines('.lead', x + 0.05);
  tl.to('.hero-art', { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.6, ease: 'expo.in' }, x);
  sceneOff('tagline', S.tagline.end);

  // ======================================================================
  // 3. 身近なものの、意外な一面を、読んで楽しめる言葉や、触れて分かる作品にする。
  // ======================================================================
  s = S.statement.start;
  sceneOn('statement', s - 0.05);
  gsap.set('.st-q', { autoAlpha: 0, scale: 0.7, rotation: -18, transformPerspective: 1600 });
  tl.to('.st-q', { autoAlpha: 1, scale: 1, rotation: 0, duration: 1.4 }, s);
  tl.to('.st-q', { rotation: 6, duration: 2.6, ease: 'sine.inOut' }, s + 1.4);
  fadeUp('#statement .eyebrow', s + 0.1, { y: 16 });
  inLines('.h-xl', s + 0.2, { stagger: 0.16, dur: 1.1 });
  tl.to('.mark i', { scaleX: 1, duration: 0.8, ease: 'expo.inOut' }, s + 1.05);
  inLines('.h-md', s + 1.45);
  fadeUp('.st-note', s + 2.1, { y: 20 });
  // ？が ！に返る（意外な一面）
  gsap.set('.st-e', { autoAlpha: 0, rotationY: -90, transformPerspective: 1600 });
  tl.to('.st-q', { rotationY: 90, duration: 0.28, ease: 'power2.in' }, s + 2.55);
  tl.to('.st-e', { autoAlpha: 1, rotationY: 0, duration: 0.7, ease: 'back.out(2)' }, s + 2.83);
  x = S.statement.end - 0.6;
  fadeOut(['#statement .eyebrow', '.st-note'], x);
  outLines('.h-xl', x);
  outLines('.h-md', x + 0.05);
  tl.to('.st-e', { autoAlpha: 0, scale: 0.8, duration: 0.45, ease: 'power2.in' }, x);
  sceneOff('statement', S.statement.end);

  // ======================================================================
  // 4. 3つの事業
  // ======================================================================
  s = S.business.start;
  sceneOn('business', s - 0.05);
  fadeUp('#business .eyebrow', s + 0.1, { y: 16 });
  inLines('#business .h-lg', s + 0.2);
  fadeUp('.card', s + 0.55, { y: 140, dur: 1.2, stagger: 0.14 });
  $$('.card').forEach((c, i) => fadeUp($$('.card-num, h3, .card-d, .card-tag', c), s + 0.85 + i * 0.14, { y: 24, stagger: 0.06 }));
  titleCard('tc1', S.business.end - 0.65, S.media.start + 1.15);
  sceneOff('business', S.business.end + 0.2);

  // ======================================================================
  // 5. 01 メディア運営・出版 — 47都道府県の面接
  // ======================================================================
  s = S.media.start;
  sceneOn('media', s + 0.1);
  section('s1', s + 0.9);
  const tiles = $$('.pref');
  const tokyo = tiles[12];
  const chat = $('.chat');
  const tr = tokyo.getBoundingClientRect(), cr = chat.getBoundingClientRect();
  gsap.set(tiles, { autoAlpha: 0, scale: 0.5 });
  tl.to(tiles, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(1.8)', stagger: { amount: 0.9, grid: [6, 8], from: 'start' } }, s + 1.3);
  fadeUp('#media .eyebrow', s + 1.45, { y: 16 });
  inLines('#media .h-lg2', s + 1.55, { stagger: 0.14, dur: 1.1 });
  fadeUp('.md-body', s + 2.2, { y: 24 });
  fadeUp('.md-fine', s + 2.6, { y: 12 });
  tl.to(tokyo, { backgroundColor: '#e60012', color: '#ffffff', scale: 1.12, duration: 0.35, ease: 'power2.out' }, s + 2.75);
  tl.to($('small', tokyo), { color: '#ffb3b8', duration: 0.35 }, s + 2.75);
  tl.to(tiles.filter(t => t !== tokyo), { opacity: 0.4, duration: 0.6, ease: 'power1.out' }, s + 3.1);
  // 東京のマスから面接の画面が立ち上がる
  gsap.set(chat, {
    autoAlpha: 0,
    x: (tr.left + tr.width / 2) - (cr.left + cr.width / 2),
    y: (tr.top + tr.height / 2) - (cr.top + cr.height / 2),
    scale: tr.width / cr.width,
  });
  tl.to(chat, { autoAlpha: 1, duration: 0.25, ease: 'none' }, s + 3.15);
  tl.to(chat, { x: 0, y: 0, scale: 1, duration: 1.0, ease: 'expo.out' }, s + 3.15);
  const msgs = $$('.msg');
  gsap.set($$('.chat-head, .chat-note'), { autoAlpha: 0 });
  tl.to('.chat-head', { autoAlpha: 1, duration: 0.4 }, s + 3.55);
  [3.95, 4.85, 5.95, 6.95].forEach((t, i) => {
    gsap.set(msgs[i], { autoAlpha: 0, y: 18, scale: 0.94, transformOrigin: i % 2 ? '100% 0' : '0 0' });
    tl.to(msgs[i], { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2)' }, s + t);
  });
  tl.to('.chat-note', { autoAlpha: 1, duration: 0.5 }, s + 7.6);
  x = S.media.end - 0.62;
  fadeOut(['#media .eyebrow', '.md-body', '.md-fine'], x);
  outLines('#media .h-lg2', x);
  tl.to(chat, { autoAlpha: 0, y: -40, duration: 0.45, ease: 'power2.in' }, x + 0.05);
  tl.to(tiles, { autoAlpha: 0, scale: 0.8, duration: 0.4, ease: 'power2.in', stagger: { amount: 0.2, from: 'end' } }, x);
  sceneOff('media', S.media.end);

  // ======================================================================
  // 6. 数字
  // ======================================================================
  s = S.reach.start;
  sceneOn('reach', s - 0.05);
  fadeUp('#reach .eyebrow', s + 0.1, { y: 16 });
  inLines('#reach .h-lg', s + 0.2);
  fadeUp('.rc-body', s + 0.65, { y: 20 });
  $$('.stat').forEach((st, i) => {
    fadeUp(st, s + 0.9 + i * 0.22, { y: 50, dur: 1.0 });
    counter($('.n', st), s + 1.0 + i * 0.22, 1.9);
  });
  x = S.reach.end - 0.6;
  fadeOut(['#reach .eyebrow', '.rc-body', ...$$('.stat')], x, { stagger: 0.04 });
  outLines('#reach .h-lg', x);
  sceneOff('reach', S.reach.end);

  // ======================================================================
  // 7. 著書
  // ======================================================================
  s = S.books.start;
  sceneOn('books', s - 0.05);
  fadeUp('#books .eyebrow', s + 0.1, { y: 16 });
  inLines('#books .h-lg2', s + 0.2, { stagger: 0.14, dur: 1.1 });
  fadeUp('.bk-body', s + 0.8, { y: 20 });
  fadeUp('.bk-stat', s + 1.05, { y: 30 });
  counter($('.bk-stat .n'), s + 1.15, 1.8);
  const r1 = $('.shelf-row.r1'), r2 = $('.shelf-row.r2');
  gsap.set(r1, { x: 60 });
  gsap.set(r2, { x: -760 });
  tl.to(r1, { x: -560, duration: S.books.dur + 0.8, ease: 'sine.inOut' }, s - 0.05);
  tl.to(r2, { x: -140, duration: S.books.dur + 0.8, ease: 'sine.inOut' }, s - 0.05);
  fadeUp($$('.shelf-row img'), s + 0.15, { y: 70, dur: 1.1, stagger: 0.05 });
  x = S.books.end - 0.65;
  fadeOut(['#books .eyebrow', '.bk-body', '.bk-stat'], x);
  outLines('#books .h-lg2', x);

  // ======================================================================
  // 8. 02 AIを使った制作・開発 — 常世（作品の式と描画をそのまま動かす）
  // ======================================================================
  titleCard('tc2', S.books.end - 0.65, S.tokoyo.start + 1.0, { exit: 'fade' });
  sceneOff('books', S.books.end + 0.2);
  s = S.tokoyo.start;
  tl.set(['#chrome', '#logo'], { autoAlpha: 0 }, s + 0.2);   // 常世の画面の赤は落款の一点だけにする
  sceneOn('tokoyo', s);
  section('s2', s + 0.5);
  gsap.set('.tk-art', { autoAlpha: 0 });
  tl.to('.tk-art', { autoAlpha: 1, duration: 1.6, ease: 'power1.inOut' }, s + 1.5);
  fadeUp('#tokoyo .eyebrow', s + 1.6, { y: 16 });
  gsap.set('.tk-title', { autoAlpha: 0, letterSpacing: '0.3em' });
  tl.to('.tk-title', { autoAlpha: 1, letterSpacing: '0.04em', duration: 1.6, ease: 'expo.out' }, s + 1.75);
  inLines('.tk-lead', s + 2.4, { stagger: 0.16, dur: 1.2 });
  fadeUp('.tk-body', s + 3.1, { y: 20 });
  fadeUp('.tk-badge', s + 3.5, { y: 16 });
  fadeUp('.tk-count', s + 2.2, { y: 0 });
  const typed = { n: 0 };
  formulaEl.textContent = '';
  tl.to(typed, { n: formula.length, duration: 3.4, ease: 'none' }, s + 2.0);
  syncers.push(() => { formulaEl.textContent = formula.slice(0, Math.round(typed.n)); });

  // 点を減らしていく（関係を薄めると形が消える）。最後は一点と、その通り道だけが残る
  const THIN = [
    [0, 1, 1, kurage.trail], [7.0, 2, 1, kurage.trail], [7.25, 4, 1, kurage.trail], [7.5, 8, 1, kurage.trail],
    [7.75, 16, 2, kurage.trail], [8.0, 32, 2, kurage.trail], [8.25, 64, 2, kurage.trail], [9.0, kurage.n, 5, 0.985],
  ];
  const TK0 = s;   // 常世の場面の頭（下の関数は書き出し時に呼ばれるので、再代入される s を読まない）
  const stateAt = t => { let st = THIN[0]; for (const row of THIN) if (t - TK0 >= row[0]) st = row; return st; };
  x = s + 9.2;
  outLines('.tk-lead', x);
  gsap.set('.tk-after', { autoAlpha: 1 });
  inLines('.tk-after', x + 0.35, { stagger: 0.16, dur: 1.2 });
  const countEl = $('#tk-n');

  // 最後の一点が白く広がって、次の場面の紙になる
  const RATE = TAU / 5;                       // サイトと同じ速さ（一巡り5秒）
  const BLOOM = S.tokoyo.end - 1.15;
  const off = kami.pickOffset(kurage.f, kurage.n, kurage.n, kurage.loop || 1);
  const bp = kurage.f(off, (BLOOM - TK0) * RATE);
  const box = $('.tk-art').getBoundingClientRect();
  gsap.set('#bloom', { x: box.left + (art.ox + bp[0] * art.side / 400) / art.dpr, y: box.top + (art.oy + bp[1] * art.side / 400) / art.dpr, scale: 0.3 });
  tl.set('#bloom', { autoAlpha: 1 }, BLOOM);
  tl.to('#bloom', { scale: 130, duration: 1.0, ease: 'expo.in' }, BLOOM);
  sceneOff('tokoyo', S.tokoyo.end - 0.1);
  tl.set('#bloom', { autoAlpha: 0 }, S.tokoyo.end + 0.05);

  let lastTk = null;
  const tkFirst = Math.round(TK0 * FPS), tkLast = Math.round((S.tokoyo.end - 0.1) * FPS);
  const tkStep = k => {
    const t = k / FPS, [, thin, dot, trail] = stateAt(t);
    art.setThin(thin, true, false);
    art.setDot(dot);
    art.setTrail(trail);
    const T = (t - TK0) * RATE;
    art.seek(T - RATE / 60);    // 60Hz の画面と同じ残像になるよう、1コマに2回描く
    art.seek(T);
  };
  syncers.push((t, i) => {
    if (i < tkFirst || i > tkLast) return;
    if (lastTk === null || i !== lastTk + 1) {   // 途中から撮り始めたときは場面の頭から残像を積み直す
      art.clear();
      for (let k = tkFirst; k < i; k++) tkStep(k);
    }
    tkStep(i);
    lastTk = i;
    countEl.textContent = art.shown().toLocaleString('en-US');
  });

  // ======================================================================
  // 9. アプリと道具
  // ======================================================================
  s = S.apps.start;
  sceneOn('apps', S.tokoyo.end - 0.1);   // 白い光が画面を覆い切ってから
  tl.to(['#chrome', '#logo'], { autoAlpha: 1, duration: 0.5, ease: 'power1.out' }, s + 0.1);
  fadeUp('#apps .eyebrow', s + 0.2, { y: 16 });
  inLines('#apps .h-lg', s + 0.3);
  gsap.set('.neko', { clipPath: 'inset(100% 0% 0% 0%)' });
  tl.to('.neko', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut' }, s + 0.45);
  gsap.set('.neko-room', { scale: 1.1 });
  tl.to('.neko-room', { scale: 1, duration: S.apps.dur, ease: 'power1.out' }, s + 0.45);
  const kohaku = $('.kohaku');
  gsap.set(kohaku, { x: -520 });
  tl.to(kohaku, { x: 0, duration: 1.9, ease: 'power2.out' }, s + 1.0);
  tl.to(kohaku, { y: -9, duration: 0.19, ease: 'sine.inOut', repeat: 9, yoyo: true }, s + 1.0);
  for (const t of [3.35, 5.4]) {
    tl.set('.k-blink', { opacity: 1 }, s + t).set('.k-open', { opacity: 0 }, s + t);
    tl.set('.k-blink', { opacity: 0 }, s + t + 0.16).set('.k-open', { opacity: 1 }, s + t + 0.16);
  }
  fadeUp('.neko-cap', s + 1.2, { y: 30 });
  fadeUp($$('.app-list li'), s + 0.8, { x: 60, y: 0, stagger: 0.14, dur: 1.0 });
  titleCard('tc3', S.apps.end - 0.65, S.advisory.start + 1.15);
  sceneOff('apps', S.apps.end + 0.2);

  // ======================================================================
  // 10. 03 経営者の相談役
  // ======================================================================
  s = S.advisory.start;
  sceneOn('advisory', s + 0.1);
  section('s3', s + 0.9);
  fadeUp('#advisory .eyebrow', s + 1.45, { y: 16 });
  inLines('#advisory .h-lg2', s + 1.55, { stagger: 0.14, dur: 1.1 });
  fadeUp('.ad-body', s + 2.2, { y: 24 });
  fadeUp($$('.door'), s + 1.7, { x: 80, y: 0, stagger: 0.16, dur: 1.1 });
  fadeUp('.door-url', s + 2.5, { y: 14 });
  x = S.advisory.end - 0.6;
  fadeOut(['#advisory .eyebrow', '.ad-body', ...$$('.door'), '.door-url'], x, { stagger: 0.03 });
  outLines('#advisory .h-lg2', x);
  sceneOff('advisory', S.advisory.end);

  // ======================================================================
  // 11. 代表
  // ======================================================================
  s = S.person.start;
  sceneOn('person', s - 0.05);
  section('person', s - 0.3);
  fadeUp('#person .eyebrow', s + 0.1, { y: 16 });
  inLines('#person .h-lg2', s + 0.2, { stagger: 0.14, dur: 1.1 });
  gsap.set('.ph.crowd', { clipPath: 'inset(0% 100% 0% 0%)' });
  tl.to('.ph.crowd', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut' }, s + 0.35);
  gsap.set('.ph.crowd img', { scale: 1.14 });
  tl.to('.ph.crowd img', { scale: 1.0, duration: S.person.dur, ease: 'none' }, s + 0.35);
  gsap.set('.ph.sign', { autoAlpha: 0, scale: 0.7, rotation: -9 });
  tl.to('.ph.sign', { autoAlpha: 1, scale: 1, rotation: -4, duration: 0.9, ease: 'back.out(1.7)' }, s + 1.35);
  fadeUp('.ps-name', s + 1.0, { y: 24 });
  gsap.set('.ph.portrait', { autoAlpha: 0, y: 80, rotation: 0 });
  tl.to('.ph.portrait', { autoAlpha: 1, y: 0, rotation: 2.5, duration: 1.0, ease: 'back.out(1.4)' }, s + 2.6);
  gsap.set('.timeline', { '--tl': 0 });
  tl.to('.timeline', { '--tl': 1, duration: 1.6, ease: 'expo.inOut' }, s + 2.9);
  fadeUp($$('.timeline li'), s + 3.1, { y: 26, stagger: 0.28 });
  x = S.person.end - 0.6;
  fadeOut(['#person .eyebrow', '.ps-name', '.ph.sign', '.ph.portrait', ...$$('.timeline li')], x, { stagger: 0.02 });
  tl.to('.timeline', { '--tl': 0, duration: 0.45, ease: 'power2.in' }, x);
  tl.to('.ph.crowd', { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.55, ease: 'expo.in' }, x);
  outLines('#person .h-lg2', x);
  sceneOff('person', S.person.end);

  // ======================================================================
  // 12. 取材・実績
  // ======================================================================
  s = S.recognition.start;
  sceneOn('recognition', s - 0.05);
  fadeUp('#recognition .eyebrow', s + 0.1, { y: 16 });
  inLines('#recognition .h-lg', s + 0.2);
  $$('.rec').forEach((r, i) => {
    const at = s + 0.6 + i * 0.13;
    gsap.set(r, { '--rl': 0 });
    tl.to(r, { '--rl': 1, duration: 0.9, ease: 'expo.inOut' }, at);
    fadeUp($$('.rec-k, .rec-t, .rec-d', r), at + 0.2, { y: 22, stagger: 0.06 });
  });
  x = S.recognition.end - 0.6;
  fadeOut(['#recognition .eyebrow', ...$$('.rec')], x, { stagger: 0.025 });
  outLines('#recognition .h-lg', x);
  sceneOff('recognition', S.recognition.end);

  // ======================================================================
  // 13. 理念
  // ======================================================================
  s = S.philosophy.start;
  sceneOn('philosophy', s - 0.05);
  section('philosophy', s - 0.3);
  fadeUp('#philosophy .eyebrow', s + 0.2, { y: 16 });
  inLines('.ph-main', s + 0.4, { stagger: 0.38, dur: 1.6 });
  gsap.set('.ph-main', { scale: 1 });
  tl.to('.ph-main', { scale: 1.025, duration: S.philosophy.dur, ease: 'none' }, s);
  fadeUp('.ph-sub', s + 2.2, { y: 20, dur: 1.2 });
  x = S.philosophy.end - 0.8;
  fadeOut(['#philosophy .eyebrow', '.ph-sub'], x);
  outLines('.ph-main', x, { stagger: 0.06 });
  tl.to('#chrome', { autoAlpha: 0, duration: 0.5 }, x + 0.1);
  section(null, x);
  sceneOff('philosophy', S.philosophy.end);

  // ======================================================================
  // 14. エンディング：ロゴが中央へ戻り、帽子がもう一度跳ねる
  // ======================================================================
  s = S.closing.start;
  sceneOn('closing', s - 0.05);
  const END = { x: (1920 - LW * 0.62) / 2, y: 392, scale: 0.62 };
  tl.to(logo, { ...END, duration: 1.2, ease: 'expo.inOut' }, s - 0.4);
  tl.to(hat, { y: -70, rotation: -12, duration: 0.3, ease: 'power2.out' }, s + 0.85);
  tl.to(hat, { y: 0, duration: 0.34, ease: 'power2.in' }, s + 1.15);
  tl.to(hat, { rotation: 0, duration: 0.9, ease: 'elastic.out(1.1, 0.45)' }, s + 1.45);
  fadeUp('.cl-sub', s + 0.7, { y: 20 });
  fadeUp('.cl-url', s + 0.95, { y: 26 });
  fadeUp($$('.cl-links p'), s + 1.3, { y: 18, stagger: 0.1 });
  fadeUp('.cl-foot', s + 1.7, { y: 10 });
  tl.to('#stage', { opacity: 0, duration: 0.7, ease: 'power1.in' }, DURATION - 0.75);
  tl.set({}, {}, DURATION);

  // ---- 書き出し口 ----
  const frames = Math.round(DURATION * FPS);
  window.__frame = i => {
    const t = i / FPS;
    tl.seek(t, true);
    for (const f of syncers) f(t, i);
  };
  window.__meta = { fps: FPS, duration: DURATION, frames, width: cfg.width, height: cfg.height, scenes: S };
}

window.__ready = init().then(() => true, e => { console.error(e); window.__error = String(e && e.stack || e); return false; });
})();
