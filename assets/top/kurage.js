// 常世 001「水母」の式（chiero_site/tokoyo/works.js の式をそのまま使う。式と40,000点は変えない）。
// 最初の画面の方眼と、作品の帯の両方が、この1つの式を読む（式を二か所に書かない）。
const { sin, cos, sqrt } = Math;
const TAU = Math.PI * 2;
export const kurage = {
  slug: '001_kurage', name: '水母', ink: 0.3, trail: 0.88, n: 40000, loop: 1,
  f: (i, t,
      b = i * 2.39996, d = sqrt(i / 25600),
      r = 110 * sin(d * 1.5708) * (1 + .13 * sin(d * 6 - t * 3)),
      j = i - 25600, m = j % 20, s = (j / 20 | 0) / 720,
      q = 58 * (1 - .24 * s), a = m / 20 * TAU,
      Q = i < 25600
      ? [200 + r * cos(b), 138 + r * sin(b) * .36 + 52 * d * d + 8 * sin(t * 3)]
      : [200 + q * cos(a) + 19 * s * sin(s * 5 - t * 3 + m) + 7 * s * sin(t * 2 + m * 3),
         178 + q * sin(a) * .36 + 172 * s + 8 * sin(s * 9 - t * 3 + m)],
      Dx = 200 + 46 * sin(t + 0.0) + 22 * sin(t * 2 + 0.0),
      Dy = 200 + 50 * cos(t + 0.0) + 16 * sin(t * 3 + 0.0)
     ) => [Dx + (Q[0] - 200) * .68, Dy + (Q[1] - 200) * .68]
};
