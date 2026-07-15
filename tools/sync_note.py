#!/usr/bin/env python3
"""note の最新記事を chiero.jp の「記録」セクションへ焼き込む。

なぜ焼き込むのか（JSで取りに行かない理由）:
  - note の RSS には CORS ヘッダがなく、ブラウザから直接は読めない
  - そして本文をJSに依存させない、というのがこのサイトの設計方針
    （JSが動かない環境で記録が消えるくらいなら、静的に持つ）
  → 日次でここが取りに行き、HTMLへ直接書き込む。訪問者のブラウザは何もしない。

安全側の設計:
  - 取得に失敗したら HTML には一切触らない（古い記録が残るほうが、消えるよりよい）
  - 1件も記事が取れなければ書き込まない
  - 差分がなければ書き込まない（無駄なコミットを作らない）

使い方:
  python3 tools/sync_note.py            # 取得してHTMLを更新
  python3 tools/sync_note.py --dry-run  # 取得内容を表示するだけ
"""
import argparse
import html
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RSS = "https://note.com/kounkt/rss"
ROOT = Path(__file__).resolve().parent.parent
TARGETS = [ROOT / "corporate" / "v4" / "index.html"]
START = "<!-- NOTE:START 以下は tools/sync_note.py が自動生成する。手で編集しない -->"
END = "<!-- NOTE:END -->"
COUNT = 6
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def tag(item, name):
    m = re.search(rf"<{name}>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{name}>", item, re.S)
    return m.group(1).strip() if m else ""


def parse(xml):
    out = []
    for it in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title = tag(it, "title")
        link = tag(it, "link")
        if not title or not link:
            continue
        pub = tag(it, "pubDate")
        try:
            # 例: Wed, 15 Jul 2026 07:00:00 GMT
            dt = datetime.strptime(pub[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        except Exception:
            dt = None
        thumb = tag(it, "media:thumbnail")
        out.append({
            "title": html.unescape(title),
            "link": link,
            "thumb": thumb,
            "date": dt.strftime("%Y.%m.%d") if dt else "",
            "iso": dt.replace(tzinfo=timezone.utc).isoformat() if dt else "",
        })
    return out


def card(a):
    t = html.escape(a["title"], quote=True)
    if a["thumb"]:
        # note の CDN は10年キャッシュ。自分の画像なので直リンクでよい
        media = (f'<img src="{html.escape(a["thumb"], quote=True)}" alt="" '
                 f'width="1280" height="670" loading="lazy" decoding="async">')
    else:
        # レポート系にはサムネがない。落とさず、印として立てる
        media = '<span class="log-mark" aria-hidden="true">記録</span>'
    date_html = f'<time datetime="{a["iso"]}">{a["date"]}</time>' if a["date"] else ""
    return (
        f'      <a class="log-card" href="{html.escape(a["link"], quote=True)}" '
        f'target="_blank" rel="noopener">\n'
        f'        <span class="log-thumb">{media}</span>\n'
        f'        <span class="log-body">\n'
        f'          <span class="log-meta">note{date_html}</span>\n'
        f'          <span class="log-title">{t}</span>\n'
        f'        </span>\n'
        f'      </a>'
    )


def build(articles):
    cards = "\n".join(card(a) for a in articles)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{START}\n{cards}\n      <!-- 最終同期: {stamp} -->\n      {END}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    try:
        articles = parse(fetch(RSS))[:COUNT]
    except Exception as e:
        print(f"note の取得に失敗: {e}", file=sys.stderr)
        print("HTMLには触れずに終了する（古い記録が残るほうが、消えるよりよい）", file=sys.stderr)
        return 1

    if not articles:
        print("記事が0件だった。HTMLには触れない。", file=sys.stderr)
        return 1

    print(f"取得: {len(articles)} 件")
    for a in articles:
        print(f"  {a['date']}  {'画像あり' if a['thumb'] else '画像なし'}  {a['title'][:44]}")

    if args.dry_run:
        return 0

    block = build(articles)
    changed = 0
    for path in TARGETS:
        if not path.exists():
            print(f"見つからない: {path}", file=sys.stderr)
            continue
        src = path.read_text(encoding="utf-8")
        if START not in src or END not in src:
            print(f"差し込み口がない: {path}", file=sys.stderr)
            continue
        new = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, src, flags=re.S)
        if new == src:
            print(f"変化なし: {path.name}")
            continue
        path.write_text(new, encoding="utf-8")
        changed += 1
        print(f"更新: {path.name}")
    return 0 if changed or True else 1


if __name__ == "__main__":
    sys.exit(main())
