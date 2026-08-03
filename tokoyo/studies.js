/* 自動生成。正本は studies/motion*.js（tools/build_making.mjs が作る）。
   ここに入るのは許可制で名指ししたファイルだけ。studies/ref/ は入らない。 */
const STUDIES = {};
STUDIES["studies/motion.js"] = (function(){


const STUDY = [

  // ① 遅れだけ（いまの常世と同じ）。等速の正弦。漂流は動きと無関係
  { slug: 'm1', name: '① 遅れだけ', ink: .30, trail: .86, n: 12000, loop: 2,
    f: (i, t,
        e = ((i % 5) / 4 * 2 - 1), s = (i / 5 | 0) / 2399,
        A = 46 * s ** 1.3, W = 9 * (1 - s) ** .6,
        y = A * sin(6.3 * s - t * 2),
        Dx = 200 + 52 * sin(t) + 20 * sin(t * 2 + 1.1),
        Dy = 200 + 44 * cos(t) + 14 * sin(t * 3)
       ) => [Dx + (-140 + 280 * s) * .68, Dy + (y + e * W) * .68] },

  // ② 溜めと放ち。時の進み方を歪めて、ゆっくり溜めて速く放つ
  { slug: 'm2', name: '② 溜めと放ち', ink: .30, trail: .86, n: 12000, loop: 2,
    f: (i, t,
        e = ((i % 5) / 4 * 2 - 1), s = (i / 5 | 0) / 2399,
        p = t * 2 + 1.15 * sin(t * 2),
        A = 46 * s ** 1.3, W = 9 * (1 - s) ** .6,
        y = A * sin(6.3 * s - p),
        Dx = 200 + 52 * sin(t) + 20 * sin(t * 2 + 1.1),
        Dy = 200 + 44 * cos(t) + 14 * sin(t * 3)
       ) => [Dx + (-140 + 280 * s) * .68, Dy + (y + e * W) * .68] },

  // ③ 自分の動きで進む。尾が速く振れたときだけ前へ出る（漂流を動きに繋いだ）
  { slug: 'm3', name: '③ 自分で進む', ink: .30, trail: .86, n: 12000, loop: 2,
    f: (i, t,
        e = ((i % 5) / 4 * 2 - 1), s = (i / 5 | 0) / 2399,
        p = t * 2 + 1.15 * sin(t * 2),
        A = 46 * s ** 1.3, W = 9 * (1 - s) ** .6,
        y = A * sin(6.3 * s - p),
        g = 30 * (sin(t * 2) + .38 * sin(t * 4)),
        Dx = 200 + 40 * sin(t) - g,
        Dy = 200 + 40 * cos(t)
       ) => [Dx + (-140 + 280 * s) * .68, Dy + (y + e * W) * .68] },

  // ④ 打って余韻。ひと巡りに一度だけ強く打ち、あとは減りながら鳴り続ける
  { slug: 'm4', name: '④ 打って余韻', ink: .30, trail: .88, n: 12000, loop: 2,
    f: (i, t,
        e = ((i % 5) / 4 * 2 - 1), s = (i / 5 | 0) / 2399,
        u = (t / (TAU * 2)) % 1, d = exp(-5.2 * u),
        A = 46 * s ** 1.3, W = 9 * (1 - s) ** .6,
        y = A * (d * sin(6.3 * s - 30 * u) + .14 * sin(6.3 * s - t * 2)),
        Dx = 200 + 52 * sin(t) + 20 * sin(t * 2 + 1.1),
        Dy = 200 + 44 * cos(t) + 14 * sin(t * 3)
       ) => [Dx + (-140 + 280 * s) * .68, Dy + (y + e * W) * .68] },

  // ⑤ 向きを変える。曲がる合図が頭から尾へ遅れて伝わる
  { slug: 'm5', name: '⑤ 向きを変える', ink: .30, trail: .86, n: 12000, loop: 2,
    f: (i, t,
        e = ((i % 5) / 4 * 2 - 1), s = (i / 5 | 0) / 2399,
        k = .95 * sin(t - 1.4 * s),
        A = 40 * s ** 1.3, W = 9 * (1 - s) ** .6,
        y = A * sin(6.3 * s - t * 2),
        X = -140 + 280 * s, R = 150 * s,
        Q = [R * cos(k) - 140 + 70, R * sin(k) + y],
        Dx = 200 + 44 * sin(t + 2.1), Dy = 200 + 40 * cos(t + .7)
       ) => [Dx + (Q[0] + e * W * -sin(k)) * .68, Dy + (Q[1] + e * W * cos(k)) * .68] },

  // ⑥ 二つの拍。泳ぐ拍と、それより遅い息が同時に走る
  { slug: 'm6', name: '⑥ 二つの拍', ink: .30, trail: .86, n: 12000, loop: 2,
    f: (i, t,
        e = ((i % 5) / 4 * 2 - 1), s = (i / 5 | 0) / 2399,
        br = .55 + .45 * sin(t * .5),
        p = t * 2 + 1.15 * sin(t * 2),
        A = 46 * s ** 1.3 * br, W = 9 * (1 - s) ** .6 * (.7 + .5 * br),
        y = A * sin(6.3 * s - p),
        Dx = 200 + 52 * sin(t) + 20 * sin(t * 2 + 1.1),
        Dy = 200 + 44 * cos(t) + 14 * sin(t * 3)
       ) => [Dx + (-140 + 280 * s) * .68, Dy + (y + e * W) * .68] },

];

return STUDY;
})();
STUDIES["studies/motion2.js"] = (function(){


const S0 = .06, NR = 55;                 // 体座標の下端 / 筋の本数

const STUDY2 = [

  { slug: 'a', name: 'A 巻き', ink: .25, trail: .74, n: 39600, loop: 2, ribs: NR,
    skel: (s, t,
        A = 1.20 * TAU / (1 - S0 ** 2),
        H = A * (s ** 2 - S0 ** 2) - t * .5,
        R = 26 + 112 * s ** 1.15
       ) => [200 + R * cos(H), 200 + R * sin(H)],
    f: (i, t,
        j = i % NR, m = i / NR | 0,
        u = (m % 40) / 39, g = ((m / 40 | 0) % 9) / 8, e = (m / 360 | 0) % 2 ? 1 : -1,
        s = S0 + (1 - S0) * (j + (1 - cos(PI * g)) / 2) / NR,
        A = 1.20 * TAU / (1 - S0 ** 2),
        H = A * (s ** 2 - S0 ** 2) - t * .5,
        R = 26 + 112 * s ** 1.15,
        dH = A * 2 * s, dR = 112 * 1.15 * s ** .15,
        tx = dR * cos(H) - R * dH * sin(H), ty = dR * sin(H) + R * dH * cos(H),
        tl = hypot(tx, ty),
        q1 = sin(s * 47 - t * 2), q2 = sin(s * 53 + t),
        L = 42 * sin(PI * s ** .7) ** .55 * (.40 + .60 * q1 * q2),
        r = L * u ** .85, w = e * .55 * u ** 1.3,
        nx = (-ty * cos(w) - tx * sin(w)) / tl,
        ny = (tx * cos(w) - ty * sin(w)) / tl
       ) => [200 + R * cos(H) + e * r * nx, 200 + R * sin(H) + e * r * ny] },

  /* B うねり — 角度前進が S 字（端で遅く、中ほどで速い）。巻き量 0.85回転。
     体は中ほどが太い。時の進み方も歪める（溜めと放ち） */
  { slug: 'b', name: 'B うねり', ink: .25, trail: .74, n: 39600, loop: 2, ribs: NR,
    skel: (s, t,
        A = .85 * TAU / (.15 + .85 * (3 * 1 - 2 * 1)),
        H = A * (.15 * s + .85 * (3 * s * s - 2 * s ** 3)) - (t * .5 + 1.1 * sin(t)),
        R = 30 + 96 * s ** .82 * (1 + .30 * sin(PI * s))
       ) => [200 + R * cos(H), 200 + R * sin(H)],
    f: (i, t,
        j = i % NR, m = i / NR | 0,
        u = (m % 40) / 39, g = ((m / 40 | 0) % 9) / 8, e = (m / 360 | 0) % 2 ? 1 : -1,
        s = S0 + (1 - S0) * (j + (1 - cos(PI * g)) / 2) / NR,
        A = .85 * TAU,
        H = A * (.15 * s + .85 * (3 * s * s - 2 * s ** 3)) - (t * .5 + 1.1 * sin(t)),
        R = 30 + 96 * s ** .82 * (1 + .30 * sin(PI * s)),
        dH = A * (.15 + .85 * (6 * s - 6 * s * s)),
        dR = 96 * (.82 * s ** -.18 * (1 + .30 * sin(PI * s)) + s ** .82 * .30 * PI * cos(PI * s)),
        tx = dR * cos(H) - R * dH * sin(H), ty = dR * sin(H) + R * dH * cos(H),
        tl = hypot(tx, ty),
        q1 = sin(s * 41 - t * 2), q2 = sin(s * 46 + t),
        L = 46 * sin(PI * s ** .62) ** .5 * (.40 + .60 * q1 * q2),
        r = L * u ** .85, w = e * .62 * u ** 1.3,
        nx = (-ty * cos(w) - tx * sin(w)) / tl,
        ny = (tx * cos(w) - ty * sin(w)) / tl
       ) => [200 + R * cos(H) + e * r * nx, 200 + R * sin(H) + e * r * ny] },

  /* C ほどけ — 巻きの量そのものが時間で息をする（0.62〜1.38回転）。
     巻きながら解け、また巻く。進みも動きに繋いだ（自分で進む） */
  { slug: 'c', name: 'C ほどけ', ink: .25, trail: .74, n: 39600, loop: 2, ribs: NR,
    skel: (s, t,
        A = (1 + .38 * sin(t * .5)) * TAU / (1 - S0 ** 1.9),
        H = A * (s ** 1.9 - S0 ** 1.9) - t * .5,
        R = 24 + 108 * s ** 1.1,
        gx = 22 * sin(t * .5 + 1.2)
       ) => [200 + gx + R * cos(H), 200 + R * sin(H)],
    f: (i, t,
        j = i % NR, m = i / NR | 0,
        u = (m % 40) / 39, g = ((m / 40 | 0) % 9) / 8, e = (m / 360 | 0) % 2 ? 1 : -1,
        s = S0 + (1 - S0) * (j + (1 - cos(PI * g)) / 2) / NR,
        A = (1 + .38 * sin(t * .5)) * TAU / (1 - S0 ** 1.9),
        H = A * (s ** 1.9 - S0 ** 1.9) - t * .5,
        R = 24 + 108 * s ** 1.1,
        dH = A * 1.9 * s ** .9, dR = 108 * 1.1 * s ** .1,
        tx = dR * cos(H) - R * dH * sin(H), ty = dR * sin(H) + R * dH * cos(H),
        tl = hypot(tx, ty),
        q1 = sin(s * 44 - t * 2), q2 = sin(s * 48 + t * 1.5),
        L = 40 * sin(PI * s ** .68) ** .55 * (.38 + .62 * q1 * q2),
        r = L * u ** .85, w = e * .5 * u ** 1.3,
        nx = (-ty * cos(w) - tx * sin(w)) / tl,
        ny = (tx * cos(w) - ty * sin(w)) / tl,
        gx = 22 * sin(t * .5 + 1.2)
       ) => [200 + gx + R * cos(H) + e * r * nx, 200 + R * sin(H) + e * r * ny] },

];

return STUDY2;
})();
STUDIES["studies/motion3.js"] = (function(){


const NA = .14, NB = .16, NC = .18;         // 体座標の下端

const STUDY3 = [

  /* A2 群 — 三個体。頭と胴で規則が違い、角度そのものが波打つ */
  { slug: 'a2', name: 'A2 群', ink: .24, trail: .74, n: 39600, loop: 2, ribs: 44, bodies: 3, s0: .14,
    ang: (s, t, A = 1.15 * TAU / (1 - NA ** 3.2)) => A * (s ** 3.2 - NA ** 3.2) + .05 * sin(t * 2 - s * 4),
    skel: (s, t,
        A = 1.15 * TAU / (1 - NA ** 3.2),
        H = A * (s ** 3.2 - NA ** 3.2) + .05 * sin(t * 2 - s * 4),
        R = 22 + 104 * s ** 1.1 + 7 * sin(t * 2 - s * 7),
        xb = R * cos(H), yb = (R + 30) * sin(H * .62), G = -t * .5
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        b = i % 3, z = i / 3 | 0, j = z % 44, m = z / 44 | 0,
        u = (m % 25) / 24, g = ((m / 25 | 0) % 6) / 5, e = (m / 150 | 0) % 2 ? 1 : -1,
        s = NA + (1 - NA) * (j + (1 - cos(PI * g)) / 2) / 44,
        T = t + b * 1.7, K = 1 - .11 * b,
        A = 1.15 * TAU / (1 - NA ** 3.2),
        H = A * (s ** 3.2 - NA ** 3.2) + .05 * sin(T * 2 - s * 4),
        R = (22 + 104 * s ** 1.1 + 7 * sin(T * 2 - s * 7)) * K,
        dH = A * 3.2 * s ** 2.2 - .2 * cos(T * 2 - s * 4),
        dR = (104 * 1.1 * s ** .1 - 49 * cos(T * 2 - s * 7)) * K,
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .62) + (R + 30 * K) * dH * .62 * cos(H * .62),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.2 * sin(s * 37 - T * 2)), q2 = sin(s * 43 + T),
        L = s < .34
          ? 15 * K * (.55 + .45 * sin(T * 2 + s * 26))
          : 48 * K * sin(PI * ((s - .34) / .66) ** .7) ** .55 * (.38 + .62 * q1 * q2),
        r = L * u ** .85, w = e * .55 * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 30 * K) * sin(H * .62) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -T * .5 + b * 2.094
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)] },

  /* A3 頭と胴 — 二個体。領域の差を強く、投影も強く潰す */
  { slug: 'a3', name: 'A3 頭と胴', ink: .24, trail: .74, n: 39936, loop: 2, ribs: 48, bodies: 2, s0: .16,
    ang: (s, t, A = 1.00 * TAU / (1 - NB ** 2.6)) => A * (s ** 2.6 - NB ** 2.6) + .09 * sin(t * 2 - s * 5),
    skel: (s, t,
        A = 1.00 * TAU / (1 - NB ** 2.6),
        H = A * (s ** 2.6 - NB ** 2.6) + .09 * sin(t * 2 - s * 5),
        R = 26 + 96 * s ** 1.05 + 9 * sin(t - s * 6),
        xb = R * cos(H), yb = (R + 44) * sin(H * .45), G = -t * .5
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        b = i % 2, z = i / 2 | 0, j = z % 48, m = z / 48 | 0,
        u = (m % 26) / 25, g = ((m / 26 | 0) % 8) / 7, e = (m / 208 | 0) % 2 ? 1 : -1,
        s = NB + (1 - NB) * (j + (1 - cos(PI * g)) / 2) / 48,
        T = t + b * 3.1, K = 1 - .16 * b,
        A = 1.00 * TAU / (1 - NB ** 2.6),
        H = A * (s ** 2.6 - NB ** 2.6) + .09 * sin(T * 2 - s * 5),
        R = (26 + 96 * s ** 1.05 + 9 * sin(T - s * 6)) * K,
        dH = A * 2.6 * s ** 1.6 - .45 * cos(T * 2 - s * 5),
        dR = (96 * 1.05 * s ** .05 - 54 * cos(T - s * 6)) * K,
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .45) + (R + 44 * K) * dH * .45 * cos(H * .45),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.4 * sin(s * 33 - T * 2)), q2 = sin(s * 38 + T * 1.5),
        L = s < .28
          ? 26 * K * (.30 + .70 * sin(T * 3 + s * 34) ** 2)
          : 44 * K * sin(PI * ((s - .28) / .72) ** .62) ** .5 * (.34 + .66 * q1 * q2),
        r = L * u ** .82, w = e * .68 * u ** 1.25,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 44 * K) * sin(H * .45) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -T * .5 + b * 3.1416
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)] },

  /* A4 群れ — 五個体。小さく、巻きが強い。ばらけた拍で、それぞれ別の道を泳ぐ */
  { slug: 'a4', name: 'A4 群れ', ink: .24, trail: .76, n: 40000, loop: 2, ribs: 40, bodies: 5, s0: .18,
    ang: (s, t, A = 1.25 * TAU / (1 - NC ** 3.6)) => A * (s ** 3.6 - NC ** 3.6) + .06 * sin(t * 2 - s * 4),
    skel: (s, t,
        A = 1.25 * TAU / (1 - NC ** 3.6),
        H = A * (s ** 3.6 - NC ** 3.6) + .06 * sin(t * 2 - s * 4),
        R = 16 + 68 * s ** 1.15 + 5 * sin(t * 2 - s * 8),
        xb = R * cos(H), yb = (R + 18) * sin(H * .8), G = -t * .5
       ) => [200 + 92 * sin(t * .5) + xb * cos(G) - yb * sin(G),
             200 + 70 * cos(t * .5) + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        b = i % 5, z = i / 5 | 0, j = z % 40, m = z / 40 | 0,
        u = (m % 25) / 24, g = ((m / 25 | 0) % 4) / 3, e = (m / 100 | 0) % 2 ? 1 : -1,
        s = NC + (1 - NC) * (j + (1 - cos(PI * g)) / 2) / 40,
        T = t + b * 1.27, K = .78 + .09 * (b % 3), F = b * 1.257,
        A = 1.25 * TAU / (1 - NC ** 3.6),
        H = A * (s ** 3.6 - NC ** 3.6) + .06 * sin(T * 2 - s * 4),
        R = (16 + 68 * s ** 1.15 + 5 * sin(T * 2 - s * 8)) * K,
        dH = A * 3.6 * s ** 2.6 - .24 * cos(T * 2 - s * 4),
        dR = (68 * 1.15 * s ** .15 - 40 * cos(T * 2 - s * 8)) * K,
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .8) + (R + 18 * K) * dH * .8 * cos(H * .8),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.0 * sin(s * 29 - T * 2)), q2 = sin(s * 34 + T),
        L = s < .38
          ? 11 * K * (.5 + .5 * sin(T * 2 + s * 22))
          : 33 * K * sin(PI * ((s - .38) / .62) ** .68) ** .55 * (.36 + .64 * q1 * q2),
        r = L * u ** .85, w = e * .5 * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 18 * K) * sin(H * .8) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -T * .5 + F
       ) => [200 + 92 * sin(F + t * .5) + xb * cos(G) - yb * sin(G),
             200 + 70 * cos(F * 1.7 + t * .5) + xb * sin(G) + yb * cos(G)] },

];

return STUDY3;
})();
STUDIES["studies/motion4.js"] = (function(){


const P1 = .16, P2 = .18, P3 = .15;

const STUDY4 = [

  /* B1 三体 — 三個体。互いに触れない位置に置く。20秒でひと巡り */
  { slug: 'b1', name: 'B1 三体', ink: .26, trail: .70, n: 39600, loop: 4, ribs: 40, bodies: 3, s0: P1,
    ang: (s, t, A = 1.10 * TAU / (1 - P1 ** 3)) => A * (s ** 3 - P1 ** 3) + .06 * sin(t - s * 4),
    skel: (s, t,
        A = 1.10 * TAU / (1 - P1 ** 3),
        H = A * (s ** 3 - P1 ** 3) + .06 * sin(t - s * 4),
        R = 13 + 46 * s ** 1.1 + 4 * sin(t - s * 7),
        xb = R * cos(H), yb = (R + 15) * sin(H * .62), G = -t * .125
       ) => [200 + 100 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        b = i % 3, z = i / 3 | 0, j = z % 40, m = z / 40 | 0,
        u = (m % 33) / 32, g = ((m / 33 | 0) % 5) / 4, e = (m / 165 | 0) % 2 ? 1 : -1,
        s = P1 + (1 - P1) * (j + (1 - cos(PI * g)) / 2) / 40,
        T = t + b * 3.4, K = 1 - .10 * b, F = b * 2.094,
        A = 1.10 * TAU / (1 - P1 ** 3),
        H = A * (s ** 3 - P1 ** 3) + .06 * sin(T - s * 4),
        R = (13 + 46 * s ** 1.1 + 4 * sin(T - s * 7)) * K,
        dH = A * 3 * s * s - .24 * cos(T - s * 4),
        dR = (46 * 1.1 * s ** .1 - 28 * cos(T - s * 7)) * K,
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .62) + (R + 15 * K) * dH * .62 * cos(H * .62),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.1 * sin(s * 33 - T)), q2 = sin(s * 38 + T * .5),
        L = s < .32
          ? 9 * K * (.6 + .4 * sin(T + s * 24))
          : 26 * K * sin(PI * ((s - .32) / .68) ** .7) ** .55 * (.58 + .42 * q1 * q2),
        r = L * u ** .85, w = e * .55 * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 15 * K) * sin(H * .62) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -T * .125 + F
       ) => [200 + 100 * cos(F) + xb * cos(G) - yb * sin(G),
             200 + 100 * sin(F) + xb * sin(G) + yb * cos(G)] },

  /* B2 一体 — 大きく一体だけ。ごちゃつきの原因が「数」なのか「作り」なのかを分ける対照 */
  { slug: 'b2', name: 'B2 一体', ink: .26, trail: .70, n: 39600, loop: 4, ribs: 44, bodies: 1, s0: P2,
    ang: (s, t, A = 1.15 * TAU / (1 - P2 ** 3)) => A * (s ** 3 - P2 ** 3) + .07 * sin(t - s * 4),
    skel: (s, t,
        A = 1.15 * TAU / (1 - P2 ** 3),
        H = A * (s ** 3 - P2 ** 3) + .07 * sin(t - s * 4),
        R = 24 + 96 * s ** 1.1 + 8 * sin(t - s * 6),
        xb = R * cos(H), yb = (R + 30) * sin(H * .58), G = -t * .125
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        j = i % 44, m = i / 44 | 0,
        u = (m % 45) / 44, g = ((m / 45 | 0) % 10) / 9, e = (m / 450 | 0) % 2 ? 1 : -1,
        s = P2 + (1 - P2) * (j + (1 - cos(PI * g)) / 2) / 44,
        A = 1.15 * TAU / (1 - P2 ** 3),
        H = A * (s ** 3 - P2 ** 3) + .07 * sin(t - s * 4),
        R = 24 + 96 * s ** 1.1 + 8 * sin(t - s * 6),
        dH = A * 3 * s * s - .28 * cos(t - s * 4),
        dR = 96 * 1.1 * s ** .1 - 48 * cos(t - s * 6),
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .58) + (R + 30) * dH * .58 * cos(H * .58),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.1 * sin(s * 35 - t)), q2 = sin(s * 40 + t * .5),
        L = s < .30
          ? 17 * (.6 + .4 * sin(t + s * 24))
          : 50 * sin(PI * ((s - .30) / .70) ** .7) ** .55 * (.58 + .42 * q1 * q2),
        r = L * u ** .85, w = e * .58 * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 30) * sin(H * .58) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -t * .125
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)] },

  /* B3 五体 — 五個体。小さく、それぞれの縄張りをゆっくり巡る。いちばんゆっくり */
  { slug: 'b3', name: 'B3 五体', ink: .26, trail: .72, n: 40000, loop: 4, ribs: 40, bodies: 5, s0: P3,
    ang: (s, t, A = 1.05 * TAU / (1 - P3 ** 3)) => A * (s ** 3 - P3 ** 3) + .05 * sin(t - s * 4),
    skel: (s, t,
        A = 1.05 * TAU / (1 - P3 ** 3),
        H = A * (s ** 3 - P3 ** 3) + .05 * sin(t - s * 4),
        R = 10 + 34 * s ** 1.1 + 3 * sin(t - s * 7),
        xb = R * cos(H), yb = (R + 11) * sin(H * .66), G = -t * .125
       ) => [200 + 118 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        b = i % 5, z = i / 5 | 0, j = z % 40, m = z / 40 | 0,
        u = (m % 25) / 24, g = ((m / 25 | 0) % 4) / 3, e = (m / 100 | 0) % 2 ? 1 : -1,
        s = P3 + (1 - P3) * (j + (1 - cos(PI * g)) / 2) / 40,
        T = t + b * 2.51, K = .84 + .06 * (b % 3), F = b * 1.257,
        A = 1.05 * TAU / (1 - P3 ** 3),
        H = A * (s ** 3 - P3 ** 3) + .05 * sin(T - s * 4),
        R = (10 + 34 * s ** 1.1 + 3 * sin(T - s * 7)) * K,
        dH = A * 3 * s * s - .2 * cos(T - s * 4),
        dR = (34 * 1.1 * s ** .1 - 21 * cos(T - s * 7)) * K,
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .66) + (R + 11 * K) * dH * .66 * cos(H * .66),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.0 * sin(s * 31 - T)), q2 = sin(s * 36 + T * .5),
        L = s < .34
          ? 7 * K * (.6 + .4 * sin(T + s * 22))
          : 20 * K * sin(PI * ((s - .34) / .66) ** .7) ** .55 * (.58 + .42 * q1 * q2),
        r = L * u ** .85, w = e * .5 * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 11 * K) * sin(H * .66) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -T * .125 + F, D = 118 + 14 * sin(t * .25 + F)
       ) => [200 + D * cos(F + t * .25) + xb * cos(G) - yb * sin(G),
             200 + D * sin(F + t * .25) * .74 + xb * sin(G) + yb * cos(G)] },

];

return STUDY4;
})();
STUDIES["studies/motion5.js"] = (function(){


const Q1 = .17, Q2 = .15, Q3 = .19;

const STUDY5 = [

  /* C1 三部・三体 — 三個体。それぞれ頭・胴・尾がはっきり分かれる */
  { slug: 'c1', name: 'C1 三部・三体', ink: .26, trail: .72, n: 39600, loop: 4, ribs: 40, bodies: 3, s0: Q1,
    ang: (s, t, A = 1.10 * TAU / (1 - Q1 ** 3)) => A * (s ** 3 - Q1 ** 3) + .07 * sin(t - s * 4),
    skel: (s, t,
        A = 1.10 * TAU / (1 - Q1 ** 3),
        H = A * (s ** 3 - Q1 ** 3) + .07 * sin(t - s * 4),
        R = 14 + 50 * s ** 1.1 + 4 * sin(t - s * 6),
        xb = R * cos(H), yb = (R + 16) * sin(H * .62), G = -t * .25
       ) => [200 + 104 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        b = i % 3, z = i / 3 | 0, j = z % 40, m = z / 40 | 0,
        u = (m % 33) / 32, g = ((m / 33 | 0) % 5) / 4, e = (m / 165 | 0) % 2 ? 1 : -1,
        s = Q1 + (1 - Q1) * (j + (1 - cos(PI * g)) / 2) / 40,
        T = t + b * 3.4, K = 1 - .10 * b, F = b * 2.094,
        A = 1.10 * TAU / (1 - Q1 ** 3),
        H = A * (s ** 3 - Q1 ** 3) + .07 * sin(T - s * 4),
        R = (14 + 50 * s ** 1.1 + 4 * sin(T - s * 6)) * K,
        dH = A * 3 * s * s - .28 * cos(T - s * 4),
        dR = (50 * 1.1 * s ** .1 - 24 * cos(T - s * 6)) * K,
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .62) + (R + 16 * K) * dH * .62 * cos(H * .62),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.1 * sin(s * 33 - T)), q2 = sin(s * 38 + T * .5),
        nk = min(1, abs(s - .22) / .030) * min(1, abs(s - .55) / .040),   // 節でくびれる
        L = K * nk * (s < .22
          ? 15 * max(0, sin(PI * s / .22)) ** .5                       // 頭: 短い筋が密
          : s < .55
          ? 17 * (.72 + .28 * sin(T + s * 20))                          // 胴: 等間隔
          : 34 * max(0, sin(PI * ((s - .55) / .45) ** .75)) ** .55
            * (.58 + .42 * q1 * q2)),                                   // 尾: 長く、房が動く
        SW = s < .22 ? .18 : s < .55 ? .5 : 1.05,                       // 寝かせ方も部位で違う
        r = L * u ** .85, w = e * SW * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 16 * K) * sin(H * .62) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -T * .25 + F
       ) => [200 + 104 * cos(F) + xb * cos(G) - yb * sin(G),
             200 + 104 * sin(F) + xb * sin(G) + yb * cos(G)] },

  /* C2 三部・一体 — 大きく一体。部位が読めるかどうかを、いちばん見やすい形で試す */
  { slug: 'c2', name: 'C2 三部・一体', ink: .26, trail: .72, n: 39600, loop: 4, ribs: 44, bodies: 1, s0: Q2,
    ang: (s, t, A = 1.15 * TAU / (1 - Q2 ** 3)) => A * (s ** 3 - Q2 ** 3) + .08 * sin(t - s * 4),
    skel: (s, t,
        A = 1.15 * TAU / (1 - Q2 ** 3),
        H = A * (s ** 3 - Q2 ** 3) + .08 * sin(t - s * 4),
        R = 26 + 92 * s ** 1.1 + 8 * sin(t - s * 6),
        xb = R * cos(H), yb = (R + 30) * sin(H * .58), G = -t * .25
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        j = i % 44, m = i / 44 | 0,
        u = (m % 45) / 44, g = ((m / 45 | 0) % 10) / 9, e = (m / 450 | 0) % 2 ? 1 : -1,
        s = Q2 + (1 - Q2) * (j + (1 - cos(PI * g)) / 2) / 44,
        A = 1.15 * TAU / (1 - Q2 ** 3),
        H = A * (s ** 3 - Q2 ** 3) + .08 * sin(t - s * 4),
        R = 26 + 92 * s ** 1.1 + 8 * sin(t - s * 6),
        dH = A * 3 * s * s - .32 * cos(t - s * 4),
        dR = 92 * 1.1 * s ** .1 - 48 * cos(t - s * 6),
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .58) + (R + 30) * dH * .58 * cos(H * .58),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.1 * sin(s * 35 - t)), q2 = sin(s * 40 + t * .5),
        nk = min(1, abs(s - .24) / .032) * min(1, abs(s - .56) / .042),
        L = nk * (s < .24
          ? 27 * max(0, sin(PI * s / .24)) ** .5
          : s < .56
          ? 30 * (.72 + .28 * sin(t + s * 20))
          : 62 * max(0, sin(PI * ((s - .56) / .44) ** .75)) ** .55
            * (.58 + .42 * q1 * q2)),
        SW = s < .24 ? .18 : s < .56 ? .5 : 1.05,
        r = L * u ** .85, w = e * SW * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 30) * sin(H * .58) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -t * .25
       ) => [200 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)] },

  /* C3 三部・二体 — 二個体。C1 と C2 の中間。部位の差をいちばん強く付けた */
  { slug: 'c3', name: 'C3 三部・二体', ink: .26, trail: .72, n: 39936, loop: 4, ribs: 42, bodies: 2, s0: Q3,
    ang: (s, t, A = 1.08 * TAU / (1 - Q3 ** 3)) => A * (s ** 3 - Q3 ** 3) + .09 * sin(t - s * 5),
    skel: (s, t,
        A = 1.08 * TAU / (1 - Q3 ** 3),
        H = A * (s ** 3 - Q3 ** 3) + .09 * sin(t - s * 5),
        R = 20 + 70 * s ** 1.1 + 6 * sin(t - s * 6),
        xb = R * cos(H), yb = (R + 24) * sin(H * .55), G = -t * .25
       ) => [200 + 88 + xb * cos(G) - yb * sin(G), 200 + xb * sin(G) + yb * cos(G)],
    f: (i, t,
        b = i % 2, z = i / 2 | 0, j = z % 42, m = z / 42 | 0,
        u = (m % 34) / 33, g = ((m / 34 | 0) % 7) / 6, e = (m / 238 | 0) % 2 ? 1 : -1,
        s = Q3 + (1 - Q3) * (j + (1 - cos(PI * g)) / 2) / 42,
        T = t + b * 5.2, K = 1 - .14 * b, F = b * 3.1416,
        A = 1.08 * TAU / (1 - Q3 ** 3),
        H = A * (s ** 3 - Q3 ** 3) + .09 * sin(T - s * 5),
        R = (20 + 70 * s ** 1.1 + 6 * sin(T - s * 6)) * K,
        dH = A * 3 * s * s - .45 * cos(T - s * 5),
        dR = (70 * 1.1 * s ** .1 - 36 * cos(T - s * 6)) * K,
        tx = dR * cos(H) - R * dH * sin(H),
        ty = dR * sin(H * .55) + (R + 24 * K) * dH * .55 * cos(H * .55),
        tl = hypot(tx, ty) + 1e-9,
        q1 = sin(2.3 * sin(s * 31 - T)), q2 = sin(s * 36 + T * .5),
        nk = min(1, abs(s - .26) / .034) * min(1, abs(s - .58) / .044),
        L = K * nk * (s < .26
          ? 22 * max(0, sin(PI * s / .26)) ** .45                      // 頭は丸く、ずんぐり
          : s < .58
          ? 13 * (.80 + .20 * sin(T + s * 22))                         // 胴は細く、節が読める
          : 46 * max(0, sin(PI * ((s - .58) / .42) ** .8)) ** .5
            * (.55 + .45 * q1 * q2)),                                  // 尾はいちばん大きい
        SW = s < .26 ? .10 : s < .58 ? .42 : 1.25,
        r = L * u ** .85, w = e * SW * u ** 1.3,
        xb = R * cos(H) + e * r * (-ty * cos(w) - tx * sin(w)) / tl,
        yb = (R + 24 * K) * sin(H * .55) + e * r * (tx * cos(w) - ty * sin(w)) / tl,
        G = -T * .25 + F
       ) => [200 + 88 * cos(F) + xb * cos(G) - yb * sin(G),
             200 + 88 * sin(F) + xb * sin(G) + yb * cos(G)] },

];

return STUDY5;
})();
STUDIES["studies/motion6.js"] = (function(){


const STUDY6 = [

  /* D1 エイ — 翼を前から後ろへ波が伝わる。翼端ほど遅れ、振れが大きい。
     胸鰭の縁が先に動き、内側が追う。尾は細く、波の名残だけを引きずる */
  { slug: 'd1', name: 'D1 エイ', ink: .24, trail: .88, n: 40000, loop: 2,
    f: (i, t,
        b = i < 34000,
        c = i % 200, m = (i / 200 | 0),
        v = b ? (c / 199) * 2 - 1 : 0,
        p = b ? (m % 170) / 169 : (i - 34000) / 6000,
        av = abs(v),
        W = 158 * sin(PI * p ** .82) ** .62,
        z = (16 + 30 * av ** 1.9) * sin(p * 2.4 - t * 2 + av * 1.15),
        Q = b
        ? [200 + v * W * (1 - .10 * av * av), 178 + 108 * (p - .5) - z * .74 + 18 * av * av]
        : [200 + 5 * sin(p * 5 - t * 2), 232 + 152 * p ** .9
           + 9 * sin(p * 4 - t * 2 - 1.1) * p],
        Dx = 200 + 34 * sin(t + 1.4) + 14 * sin(t * 2 + 3.9),
        Dy = 200 + 30 * cos(t + 2.6) + 11 * sin(t * 3 + 1.4)
       ) => [Dx + (Q[0] - 200) * .74, Dy + (Q[1] - 200) * .74] },

  /* D2 烏賊 — 外套は硬い。鰭を波が伝い、十本の腕がそれに遅れて従う。
     遅れの量を腕ごとに変えてあるので、束ねて動かない */
  { slug: 'd2', name: 'D2 烏賊', ink: .26, trail: .88, n: 40000, loop: 2,
    f: (i, t,
        b = i < 13000, h = i >= 13000 && i < 25000,
        c = (i * .754878 % 1) * PI, d = sqrt(i / 13000),
        j = (i - 13000) % 2 ? 1 : -1, q = ((i - 13000) / 2 | 0) / 5999,
        k = (i - 25000) % 10, s = ((i - 25000) / 10 | 0) / 1499,
        wv = sin(q * 3.6 - t * 2),
        Q = b
        ? [200 + 34 * sin(d * 1.5708) * cos(c) * (1 - .12 * d),
           104 + 34 * sin(d * 1.5708) * sin(c) * .5 + 116 * d * d]
        : h
        ? [200 + j * (30 + 52 * sin(PI * q ** .8) ** .7) + j * 7 * wv,
           118 + 122 * q + 5 * wv]
        : [200 + (k / 9 - .5) * 46 * (1 - .34 * s)
             + 15 * s ** 1.4 * sin(s * 3.4 - t * 2 - 1.5 - k * .42),
           236 + 118 * s ** .92
             + 7 * s * sin(s * 5 - t * 2 - 1.2 - k * .3)],
        Dx = 200 + 40 * sin(t + 4.7) + 16 * sin(t * 2 + 1.3),
        Dy = 200 + 34 * cos(t + .8) + 12 * sin(t * 3 + 4.7)
       ) => [Dx + (Q[0] - 200) * .74, Dy + (Q[1] - 200) * .74] },

  /* D3 海馬 — 体はほとんど止まる。背鰭だけが速く震える。
     **止まっている部分があるから、震えが生きて見える。**全部が動くと機械になる */
  { slug: 'd3', name: 'D3 海馬', ink: .26, trail: .86, n: 40000, loop: 2,
    f: (i, t,
        b = i < 22000, h = i >= 22000 && i < 33000,
        m = i % 120, p = min(1, (i / 120 | 0) / 182),
        c = (m / 119) * 2 - 1,
        a = -1.15 + 2.5 * p ** .92 + .30 * sin(p * 2.2) + .05 * sin(t - p * 1.6),
        R = 96,
        Sx = 214 - R * .52 * (cos(a) - cos(-1.15)),
        Sy = 92 + R * (sin(a) - sin(-1.15)) * .84,
        W = 21 * max(0, sin(PI * min(1, p) ** .55)) ** .48 * (1 - .30 * p),
        j = (i - 22000) % 26, u = ((i - 22000) / 26 | 0) / 422,
        fp = .18 + .56 * (j / 25),
        fa = -1.15 + 2.5 * fp ** .92 + .30 * sin(fp * 2.2),
        Fx = 214 - R * .52 * (cos(fa) - cos(-1.15)) + (16 + 20 * u) * sin(fa),
        Fy = 92 + R * (sin(fa) - sin(-1.15)) * .84 - (16 + 20 * u) * cos(fa) * .8,
        fl = 7 * u * sin(t * 24 - j * 1.15),
        k2 = i - 33000, s2 = (k2 % 90) / 89, e2 = ((k2 / 90 | 0) % 78) / 77 * 2 - 1,
        Q = b
        ? [Sx + c * W * .5, Sy + c * W * cos(a) * .35 + 3 * sin(p * 9 - t)]
        : h
        ? [Fx + fl * cos(fa), Fy + fl * sin(fa)]
        : [244 + 30 * s2 - 9 * e2 * (1 - s2),
           108 + 8 * e2 * (1 - s2 * .6) + 5 * sin(t * 18 - s2 * 4) * s2],
        Dx = 200 + 30 * sin(t + 2.2) + 12 * sin(t * 2 + 5.4),
        Dy = 200 + 26 * cos(t + 3.9) + 10 * sin(t * 3 + 2.2)
       ) => [Dx + (Q[0] - 200) * .74, Dy + (Q[1] - 200) * .74] },

];

return STUDY6;
})();
STUDIES["studies/motion7.js"] = (function(){


const STUDY7 = [

  /* E1 やや遅い — ひと打ち 5.0秒・漂流 20秒。翼の速さを半分に */
  { slug: 'e1', name: 'E1 やや遅い', ink: .24, trail: .88, n: 40000, loop: 4,
    f: (i, t,
        b = i < 34000,
        c = i % 200, m = (i / 200 | 0),
        v = b ? (c / 199) * 2 - 1 : 0,
        p = b ? (m % 170) / 169 : (i - 34000) / 6000,
        av = abs(v),
        W = 158 * sin(PI * p ** .82) ** .62,
        z = (16 + 30 * av ** 1.9) * sin(p * 2.4 - t * 1 + av * 1.15),
        Q = b
        ? [200 + v * W * (1 - .10 * av * av), 178 + 108 * (p - .5) - z * .74 + 18 * av * av]
        : [200 + 5 * sin(p * 5 - t * 1), 232 + 152 * p ** .9
           + 9 * sin(p * 4 - t * 1 - 1.1) * p],
        Dx = 200 + 34 * sin(t * 0.25 + 1.4) + 14 * sin(t * 0.5 + 3.9),
        Dy = 200 + 30 * cos(t * 0.25 + 2.6) + 11 * sin(t * 0.75 + 1.4)
       ) => [Dx + (Q[0] - 200) * .74, Dy + (Q[1] - 200) * .74] },

  /* E2 遅い — ひと打ち 6.7秒・漂流 20秒 */
  { slug: 'e2', name: 'E2 遅い', ink: .24, trail: .88, n: 40000, loop: 4,
    f: (i, t,
        b = i < 34000,
        c = i % 200, m = (i / 200 | 0),
        v = b ? (c / 199) * 2 - 1 : 0,
        p = b ? (m % 170) / 169 : (i - 34000) / 6000,
        av = abs(v),
        W = 158 * sin(PI * p ** .82) ** .62,
        z = (16 + 30 * av ** 1.9) * sin(p * 2.4 - t * 0.75 + av * 1.15),
        Q = b
        ? [200 + v * W * (1 - .10 * av * av), 178 + 108 * (p - .5) - z * .74 + 18 * av * av]
        : [200 + 5 * sin(p * 5 - t * 0.75), 232 + 152 * p ** .9
           + 9 * sin(p * 4 - t * 0.75 - 1.1) * p],
        Dx = 200 + 34 * sin(t * 0.25 + 1.4) + 14 * sin(t * 0.5 + 3.9),
        Dy = 200 + 30 * cos(t * 0.25 + 2.6) + 11 * sin(t * 0.75 + 1.4)
       ) => [Dx + (Q[0] - 200) * .74, Dy + (Q[1] - 200) * .74] },

  /* E3 とても遅い — ひと打ち 10.0秒・漂流 20秒。実物より遅い */
  { slug: 'e3', name: 'E3 とても遅い', ink: .24, trail: .88, n: 40000, loop: 4,
    f: (i, t,
        b = i < 34000,
        c = i % 200, m = (i / 200 | 0),
        v = b ? (c / 199) * 2 - 1 : 0,
        p = b ? (m % 170) / 169 : (i - 34000) / 6000,
        av = abs(v),
        W = 158 * sin(PI * p ** .82) ** .62,
        z = (16 + 30 * av ** 1.9) * sin(p * 2.4 - t * 0.5 + av * 1.15),
        Q = b
        ? [200 + v * W * (1 - .10 * av * av), 178 + 108 * (p - .5) - z * .74 + 18 * av * av]
        : [200 + 5 * sin(p * 5 - t * 0.5), 232 + 152 * p ** .9
           + 9 * sin(p * 4 - t * 0.5 - 1.1) * p],
        Dx = 200 + 34 * sin(t * 0.25 + 1.4) + 14 * sin(t * 0.5 + 3.9),
        Dy = 200 + 30 * cos(t * 0.25 + 2.6) + 11 * sin(t * 0.75 + 1.4)
       ) => [Dx + (Q[0] - 200) * .74, Dy + (Q[1] - 200) * .74] },

];

return STUDY7;
})();
