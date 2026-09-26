// render.mjs — composition.html を1コマずつ撮って PNG に書き出す。
//
//   node render.mjs --stills 5.2,12,55.5      指定した秒の静止画だけ撮る（確認用）→ out/stills/
//   node render.mjs --workers 4               全コマを撮る → out/frames/f_00000.png …
//
// リポジトリ直下を配信する小さなサーバーを立て、/tools/intro-video/composition.html を開く
// （常世の正本 /tokoyo/kami.js・/tokoyo/works.js、表紙 /covers/ などを相対パスで読むため）。
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

function serve() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function openPage(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push('request failed: ' + r.url()));
  await page.goto(base + '/tools/intro-video/composition.html', { waitUntil: 'load' });
  const ok = await page.evaluate(() => window.__ready);
  if (!ok || errors.length) throw new Error('composition failed to load:\n' + errors.join('\n') + '\n' + (await page.evaluate(() => window.__error)));
  const meta = await page.evaluate(() => window.__meta);
  const cdp = await page.context().newCDPSession(page);
  const shoot = async i => {
    await page.evaluate(n => window.__frame(n), i);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
    return Buffer.from(data, 'base64');
  };
  return { page, meta, shoot, errors };
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });

try {
  if (args.stills) {
    const { meta, shoot, errors } = await openPage(browser, base);
    await mkdir(path.join(OUT, 'stills'), { recursive: true });
    const times = String(args.stills).split(',').map(Number).sort((a, b) => a - b);
    for (const t of times) {
      const i = Math.min(meta.frames - 1, Math.round(t * meta.fps));
      const file = path.join(OUT, 'stills', `t${t.toFixed(2).padStart(6, '0')}.png`);
      await writeFile(file, await shoot(i));
      console.log(file);
    }
    if (errors.length) console.error(errors.join('\n'));
  } else {
    const workers = Number(args.workers || 4);
    const probe = await openPage(browser, base);
    const { frames } = probe.meta;
    await probe.page.close();
    const dir = path.join(OUT, 'frames');
    await mkdir(dir, { recursive: true });
    const from = Number(args.from || 0), to = Math.min(frames, Number(args.to || frames));
    const per = Math.ceil((to - from) / workers);
    const t0 = Date.now();
    let done = 0;
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const a = from + w * per, b = Math.min(to, a + per);
      if (a >= b) return;
      const { shoot, errors, page } = await openPage(browser, base);
      for (let i = a; i < b; i++) {
        await writeFile(path.join(dir, `f_${String(i).padStart(5, '0')}.png`), await shoot(i));
        if (++done % 150 === 0) console.log(`${done}/${to - from} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      if (errors.length) throw new Error(errors.join('\n'));
      await page.close();
    }));
    console.log(`rendered ${to - from} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${dir}`);
  }
} finally {
  await browser.close();
  server.close();
}
