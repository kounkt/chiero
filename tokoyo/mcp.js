/* mcp.js — 訪れた機械にも、同じ観測をさせるための口（WebMCP / document.modelContext）。

   なぜ置くか:
     この作品の三つの事実は「描いていない」「乱数も時計も外部データも使わない」
     「式が唯一の定義場所」の三つで、どれも**手元で数え直せる**ことに全部が懸かっている。
     人間には「式をコピー」と指紋の帯でそれを渡してある。
     ここは同じものを、機械が読める形で渡す面。式は共有財という掟の、機械可読版。

   置かないもの（DIRECTIVE §0）:
     ・値札に類する道具は一つも生やさない。読むだけ・数えるだけ
     ・画面を書き換える道具は置かない。見ている人の画を機械が動かすことはない
     ・外部ライブラリを増やさない。素の JS だけで完結する

   非対応のブラウザでは何も起きない:
     document.modelContext が無ければ即座に戻る。人の閲覧体験は1バイトも変わらない。

   正本の重複を作らないための約束:
     ・式は works.js（唯一の定義場所）から読む。ここには一本も式を書かない
     ・指紋は「その場で計算した値」と「頁に刻んである値」を突き合わせる。
       ここに正解表を持たない（持てば三つ目の正本になる）
     ・間引きの起点は kami.pickOffset を呼ぶ。画面が実際に残す点と同じ点を数える
     ・観測記は observations.js（生成物）を必要になったときだけ取りに行く。
       人が読むだけの訪問では一度も読み込まない
*/

(() => {
  'use strict';

  // 自分がどこから読み込まれたかで、常世の根を知る（日本語頁は ../ 、英語頁は ../../ ）
  const SELF = document.currentScript && document.currentScript.src;

  const mc = document.modelContext;
  if (!mc || typeof mc.registerTool !== 'function') return;   // 非対応なら黙って終わる
  if (typeof WORKS === 'undefined' || !Array.isArray(WORKS)) return;
  if (!SELF) return;

  const ROOT = new URL('.', SELF).href;                        // …/tokoyo/
  const LANG = (document.documentElement.lang || 'ja').slice(0, 2) === 'en' ? 'en' : 'ja';
  const urlOf = (no, lang) => ROOT + (lang === 'en' ? 'en/' : '') + no + '/';

  const TANE_JA = '点の位置は、ほかの点との関係だけで決まっています。関係を取り除くと、形も消えます。';
  const TANE_EN = 'A point has no position of its own. It is fixed only by its relations to the '
    + 'other points. Take the relations away and the shape goes with them.';

  const no = (w) => w.slug.slice(0, 3);
  const say = (o) => JSON.stringify(o, null, 1);
  const oops = (m, extra) => say(Object.assign({ error: m }, extra || {}));

  /* 式の原文。kami が画の下の帯に描く文字列とも、「式をコピー」が返す文字列とも、
     tools/fingerprint.mjs が数える文字列とも、1バイト違わない。 */
  const sourceOf = (w) => w.f.toString().replace(/\s+$/, '');

  async function sha256(text) {
    if (!crypto || !crypto.subtle) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* slug（001_kurage）・番号（001 / 1）・綴り（kurage）・題（水母）のどれでも引ける */
  function find(q) {
    if (q == null) return null;
    const s = String(q).trim();
    if (!s) return null;
    let w = WORKS.find((x) => x.slug === s);
    if (w) return w;
    const m = s.match(/^0*(\d{1,3})$/);
    if (m) {
      const nn = m[1].padStart(3, '0');
      w = WORKS.find((x) => no(x) === nn);
      if (w) return w;
    }
    const low = s.toLowerCase();
    return WORKS.find((x) => x.slug.slice(4).toLowerCase() === low)
        || WORKS.find((x) => x.name === s)
        || null;
  }

  const known = () => WORKS.map((w) => no(w) + ' ' + w.slug).join(', ');

  /* 観測記。頭の頁には既に載っている（OBS / OBS_EN）。
     作品頁・章の頁には載せていないので、**機械に訊かれたときだけ**取りに行く。
     人が読むだけの訪問で 66KB を余分に運ばせないため。 */
  let obsPromise = null;
  function observations() {
    if (typeof OBS !== 'undefined' && typeof OBS_EN !== 'undefined') {
      return Promise.resolve({ ja: OBS, en: OBS_EN });
    }
    if (!obsPromise) {
      obsPromise = fetch(ROOT + 'observations.js')
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((t) => {
          const got = new Function(t + '\nreturn { ja: OBS, en: OBS_EN };')();
          return got;
        })
        .catch(() => null);
    }
    return obsPromise;
  }

  /* 頁に刻んである指紋。ここに正解表を持つと正本が三つになるので、**公開面から読む**。
     いま作品頁を見ているならその場の DOM から、そうでなければ作品頁を取りに行く。 */
  const fpCache = new Map();
  function publishedFingerprint(w) {
    const here = document.getElementById('sha');
    if (here) {
      const m = /sha256:([0-9a-f]{64})/.exec(here.textContent || '');
      // その頁が本人の作品頁であるときだけ採る（別の作品の頁を見ている場合は取りに行く）
      if (m && location.pathname.replace(/\/+$/, '').endsWith('/' + no(w))) {
        return Promise.resolve({ sha: m[1], from: location.href });
      }
    }
    if (fpCache.has(w.slug)) return fpCache.get(w.slug);
    const url = urlOf(no(w), LANG);
    const p = fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((t) => {
        const m = /sha256:([0-9a-f]{64})/.exec(t);
        if (!m) throw new Error('no fingerprint on page');
        return { sha: m[1], from: url };
      })
      .catch((e) => ({ sha: null, from: url, why: String(e && e.message || e) }));
    fpCache.set(w.slug, p);
    return p;
  }

  // ---- 道具 --------------------------------------------------------------

  const ONE = {
    type: 'object',
    properties: {
      creature: {
        type: 'string',
        description: 'Which creature: the slug ("001_kurage"), the observation number '
          + '("001" or "1"), the romanised name ("kurage"), or the Japanese name ("水母").',
      },
    },
    required: ['creature'],
  };

  const TOOLS = [
    {
      name: 'list_creatures',
      description:
        'List every creature observed in Tokoyo (常世), a series of mathematical life forms. '
        + 'Each creature is one equation — nothing is drawn by hand, and no randomness, clock '
        + 'or external data is used, so every run produces the identical shape. Returns the '
        + 'observation number, slug, Japanese and English names, the drawing parameters '
        + '(grid, ink, trail, point count, loop length) and the permanent URL of each '
        + 'observation page. Read-only.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        const obs = await observations();
        return say({
          series: '常世 / Tokoyo',
          about_ja: TANE_JA,
          about_en: TANE_EN,
          count: WORKS.length,
          coordinate_space: '0..400 square; each point is one physical pixel, never enlarged',
          creatures: WORKS.map((w) => {
            const n = no(w);
            const o = obs && obs.ja[w.slug], e = obs && obs.en[w.slug];
            return {
              no: n,
              slug: w.slug,
              name_ja: w.name,
              name_en: (e && e.gloss) || null,
              chapter_ja: (o && o.chapter) || null,
              chapter_en: (e && e.chapter) || null,
              grid: !!w.grid,
              ink: w.ink,
              trail: w.trail,
              points: w.n,
              loop_turns: w.loop,
              seconds_per_loop: w.loop * 5,
              url_ja: urlOf(n, 'ja'),
              url_en: urlOf(n, 'en'),
            };
          }),
        });
      },
    },

    {
      name: 'get_equation',
      description:
        'Return the verbatim source of the equation that generates one creature, together with '
        + 'its SHA-256 fingerprint computed here and now. The text returned is byte-for-byte '
        + 'the same string that is painted under the picture and that the "copy the equation" '
        + 'button puts on the clipboard. The equation is free to take, run and change: it is '
        + 'held as common property, and there is nothing to pay. Read-only.',
      inputSchema: ONE,
      annotations: { readOnlyHint: true },
      async execute({ creature }) {
        const w = find(creature);
        if (!w) return oops('unknown creature: ' + creature, { known: known() });
        const source = sourceOf(w);
        return say({
          no: no(w),
          slug: w.slug,
          name_ja: w.name,
          source,
          signature: 'f(i, t, ...intermediates) -> [x, y] in a 0..400 square; '
            + 'i is the index of the point (0..' + (w.n - 1) + '), t is time in radians; '
            + 't advances by TAU/300 per frame at 60fps, so one turn is 5 seconds.',
          points: w.n,
          loop_turns: w.loop,
          sha256: await sha256(source),
          bytes: new TextEncoder().encode(source).length,
          digest_recipe: 'UTF-8 bytes of the source above with trailing whitespace stripped '
            + 'and no trailing newline; sha256. Shell: printf %s "$(cat f.txt)" | shasum -a 256',
          url_ja: urlOf(no(w), 'ja'),
          url_en: urlOf(no(w), 'en'),
          licence_note: 'The equations are common property. Free to run, copy and modify, '
            + 'for anyone, permanently, at no cost.',
        });
      },
    },

    {
      name: 'verify_fingerprint',
      description:
        'Independently check one creature: hash the equation that is actually running in this '
        + 'page right now, and compare it against the fingerprint published on that creature\'s '
        + 'observation page. Answers whether the two agree. If they disagree, the published '
        + 'record is stale or the equation has been substituted — either way, do not trust the '
        + 'page. The hash is computed over exactly the bytes returned by get_equation. Read-only.',
      inputSchema: ONE,
      annotations: { readOnlyHint: true },
      async execute({ creature }) {
        const w = find(creature);
        if (!w) return oops('unknown creature: ' + creature, { known: known() });
        const source = sourceOf(w);
        const computed = await sha256(source);
        if (!computed) return oops('SubtleCrypto is unavailable in this context', { slug: w.slug });
        const pub = await publishedFingerprint(w);
        if (!pub.sha) {
          return say({
            slug: w.slug, no: no(w), match: null,
            computed_sha256: computed,
            published_sha256: null,
            published_at: pub.from,
            why_unknown: 'could not read the published fingerprint (' + (pub.why || 'unreadable') + ')',
            bytes: new TextEncoder().encode(source).length,
          });
        }
        return say({
          slug: w.slug,
          no: no(w),
          match: computed === pub.sha,
          computed_sha256: computed,
          published_sha256: pub.sha,
          published_at: pub.from,
          bytes: new TextEncoder().encode(source).length,
          method: 'sha256 over the UTF-8 bytes of the running function source, trailing '
            + 'whitespace stripped, no trailing newline — the same string get_equation returns '
            + 'and the same one the page paints under the picture.',
        });
      },
    },

    {
      name: 'thin_points',
      description:
        'Thin the creature down to fewer points and report what survives. This is the centre of '
        + 'the work: the same equation keeps running, only points are removed, and at some rung '
        + 'the creature stops being legible. Nothing on screen is touched — this measures a '
        + 'fresh evaluation. The four rungs the page offers are 40000, 625, 40 and 1 points. '
        + 'Returns how many points actually survive, which fraction of the samples land inside '
        + 'the frame, the bounding box they occupy and how much of the frame they touch over a '
        + 'full turn. Read-only.',
      inputSchema: {
        type: 'object',
        properties: {
          creature: ONE.properties.creature,
          points: {
            type: 'integer',
            description: 'How many points to keep. The rungs used on the page are 40000, 625, '
              + '40 and 1. Any number between 1 and the creature\'s point count is accepted; '
              + 'it is turned into the nearest whole stride.',
          },
        },
        required: ['creature', 'points'],
      },
      annotations: { readOnlyHint: true },
      async execute({ creature, points }) {
        const w = find(creature);
        if (!w) return oops('unknown creature: ' + creature, { known: known() });
        const want = Math.max(1, Math.min(w.n, Math.round(Number(points) || 0) || 1));
        const stride = Math.max(1, Math.min(w.n, Math.round(w.n / want)));

        // 画面が実際に残す点と同じ点を数える。規則は kami.pickOffset ひとつだけ
        const off = (typeof kami === 'function' && kami.pickOffset)
          ? kami.pickOffset(w.f, w.n, stride, w.loop || 1) : 0;
        const shown = Math.ceil((w.n - off) / stride);

        const TS = shown > 2000 ? 6 : 24;
        const span = (w.loop || 1) * Math.PI * 2;
        let lit = 0, total = 0;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        const cells = new Set();                    // 2単位の升で「どこが灯ったか」を数える
        for (let i = off; i < w.n; i += stride) {
          for (let s = 0; s < TS; s++) {
            const p = w.f(i, s * span / TS);
            const x = p[0], y = p[1];
            total++;
            const ok = Number.isFinite(x) && Number.isFinite(y)
              && !(x === -9 && y === -9) && x >= 0 && y >= 0 && x <= 400 && y <= 400;
            if (!ok) continue;
            lit++;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
            cells.add(((y / 2) | 0) * 200 + ((x / 2) | 0));
          }
        }
        const none = lit === 0;
        return say({
          slug: w.slug,
          no: no(w),
          name_ja: w.name,
          points_requested: want,
          points_shown: shown,
          stride,
          start_index: off,
          start_index_note: off
            ? 'the first surviving index is not 0: for this creature index 0 is dead over the '
              + 'whole turn, so the page starts from a living point instead'
            : 'the surviving points are 0, ' + stride + ', ' + (2 * stride) + ', …',
          samples: total,
          time_samples_per_point: TS,
          lit_fraction: total ? +(lit / total).toFixed(4) : 0,
          bbox: none ? null : {
            x_min: +x0.toFixed(1), x_max: +x1.toFixed(1),
            y_min: +y0.toFixed(1), y_max: +y1.toFixed(1),
            width: +(x1 - x0).toFixed(1), height: +(y1 - y0).toFixed(1),
          },
          frame_coverage: +(cells.size / 40000).toFixed(5),
          frame_coverage_note: 'fraction of the 400×400 frame, measured in 2-unit cells, that '
            + 'is touched at least once during one full turn',
          equation_unchanged: true,
          note_ja: TANE_JA,
          note_en: TANE_EN,
        });
      },
    },

    {
      name: 'describe_work',
      description:
        'Return the observation note written for one creature, in Japanese and in English, '
        + 'with the chapter it belongs to and the permanent URLs. The note says what was '
        + 'observed, not what it is supposed to mean. Read-only.',
      inputSchema: ONE,
      annotations: { readOnlyHint: true },
      async execute({ creature }) {
        const w = find(creature);
        if (!w) return oops('unknown creature: ' + creature, { known: known() });
        const obs = await observations();
        if (!obs) return oops('the observation notes could not be read from ' + ROOT + 'observations.js',
          { slug: w.slug, url_ja: urlOf(no(w), 'ja') });
        const o = obs.ja[w.slug], e = obs.en[w.slug];
        return say({
          no: no(w),
          slug: w.slug,
          name_ja: w.name,
          name_en: (e && e.gloss) || null,
          chapter_ja: (o && o.chapter) || null,
          chapter_en: (e && e.chapter) || null,
          observation_ja: (o && o.body) || null,
          observation_en: (e && e.body) || null,
          points: w.n,
          grid: !!w.grid,
          seconds_per_loop: w.loop * 5,
          url_ja: urlOf(no(w), 'ja'),
          url_en: urlOf(no(w), 'en'),
          closing_ja: TANE_JA,
          closing_en: TANE_EN,
        });
      },
    },
  ];

  (async () => {
    for (const t of TOOLS) {
      try { await mc.registerTool(t); }
      catch (e) { console.warn('mcp.js: ' + t.name + ' を登録できなかった', e); }
    }
  })();
})();
