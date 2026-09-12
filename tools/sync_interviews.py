#!/usr/bin/env python3
"""Threads の投稿から「都道府県の面接」一覧を作り、chiero.jp/interviews/ へ焼き込む。

なぜ焼き込むのか（訪問者のブラウザから API を叩かない理由）:
  - Threads API はアクセストークンが要る。ブラウザに置けない
  - 本文を JS の人質にしない、というサイト方針（tools/sync_note.py と同じ）
  → 投稿枠のあとにここが取りに行き、HTML と data.json を書き換える。

判別の仕組み:
  - 投稿本文の1行目（題名）を見る。「〇〇県さんの面接」「〇〇さんの二次面接」など
  - 題名に「改訂版」があれば改訂版。「二次面接」があれば二次面接
  - 博多・川崎市など市の回は、その県の欄に「市」として並べる
  - 題名が同じ投稿が複数ある場合（再掲）は新しい方だけ残す。
    例外は tools/interviews_overrides.json に書く（愛知の改訂版は題名に表記がない）

安全側の設計:
  - 取得に失敗したら HTML には触らない
  - 47都道府県のうち 40 未満しか見つからなければ異常とみなして書かない
  - 生成ブロック（INTERVIEWS:*:START〜END）の内側だけを書き換える

使い方:
  python3 tools/sync_interviews.py             # 取得して HTML / data.json を更新
  python3 tools/sync_interviews.py --dry-run   # 判別結果を表示するだけ
  python3 tools/sync_interviews.py --input posts.json   # 保存済みの API 応答から生成（通信なし）
"""
import argparse
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = Path.home() / "Library/Application Support/Chiero/threads-api/token.json"
OVERRIDES = ROOT / "tools/interviews_overrides.json"
DATA_OUT = ROOT / "interviews/data.json"
PAGES = {"ja": ROOT / "interviews/index.html", "en": ROOT / "en/interviews/index.html"}
SITEMAP = ROOT / "sitemap.xml"
API = "https://graph.threads.net/v1.0/me/threads"
SINCE = "2026-08-20"          # 都道府県シリーズは 2026-08-27 開始
MIN_PREFECTURES = 40          # これ未満なら API 異常とみなす
LATEST_COUNT = 6
JST = timezone(timedelta(hours=9))
THREADS = "https://www.threads.com/@chiero_piero/post/"

REGIONS = [
    ("北海道・東北", "Hokkaido & Tohoku"),
    ("関東", "Kanto"),
    ("中部", "Chubu"),
    ("近畿", "Kinki"),
    ("中国", "Chugoku"),
    ("四国", "Shikoku"),
    ("九州・沖縄", "Kyushu & Okinawa"),
]

# (正式名, 英語名, 地域番号)。順序がそのまま表示順。
PREFS = [
    ("北海道", "Hokkaido", 0), ("青森県", "Aomori", 0), ("岩手県", "Iwate", 0), ("宮城県", "Miyagi", 0),
    ("秋田県", "Akita", 0), ("山形県", "Yamagata", 0), ("福島県", "Fukushima", 0),
    ("茨城県", "Ibaraki", 1), ("栃木県", "Tochigi", 1), ("群馬県", "Gunma", 1), ("埼玉県", "Saitama", 1),
    ("千葉県", "Chiba", 1), ("東京都", "Tokyo", 1), ("神奈川県", "Kanagawa", 1),
    ("新潟県", "Niigata", 2), ("富山県", "Toyama", 2), ("石川県", "Ishikawa", 2), ("福井県", "Fukui", 2),
    ("山梨県", "Yamanashi", 2), ("長野県", "Nagano", 2), ("岐阜県", "Gifu", 2), ("静岡県", "Shizuoka", 2),
    ("愛知県", "Aichi", 2),
    ("三重県", "Mie", 3), ("滋賀県", "Shiga", 3), ("京都府", "Kyoto", 3), ("大阪府", "Osaka", 3),
    ("兵庫県", "Hyogo", 3), ("奈良県", "Nara", 3), ("和歌山県", "Wakayama", 3),
    ("鳥取県", "Tottori", 4), ("島根県", "Shimane", 4), ("岡山県", "Okayama", 4), ("広島県", "Hiroshima", 4),
    ("山口県", "Yamaguchi", 4),
    ("徳島県", "Tokushima", 5), ("香川県", "Kagawa", 5), ("愛媛県", "Ehime", 5), ("高知県", "Kochi", 5),
    ("福岡県", "Fukuoka", 6), ("佐賀県", "Saga", 6), ("長崎県", "Nagasaki", 6), ("熊本県", "Kumamoto", 6),
    ("大分県", "Oita", 6), ("宮崎県", "Miyazaki", 6), ("鹿児島県", "Kagoshima", 6), ("沖縄県", "Okinawa", 6),
]
assert len(PREFS) == 47

# 市・地区の回。題名の主語 → (県, 日本語表示, 英語表示)
CITIES = {
    "博多": ("福岡県", "博多", "Hakata"),
    "川崎": ("神奈川県", "川崎市", "Kawasaki"),
    "横浜": ("神奈川県", "横浜市", "Yokohama"),
    "名古屋": ("愛知県", "名古屋市", "Nagoya"),
    "金沢": ("石川県", "金沢市", "Kanazawa"),
    "神戸": ("兵庫県", "神戸市", "Kobe"),
    "仙台": ("宮城県", "仙台市", "Sendai"),
    "京都市": ("京都府", "京都市", "Kyoto City"),
}

# 題名は「〇〇さんの面接」で終わるか、そのあとに括弧書きだけが続く。
# 「岡山県さんの面接。初の動画化してみました！」のような告知は対象外。
TITLE_RE = re.compile(
    r"^(?P<who>[^\s「」（）()【】、。・]+?)(?:さん|さんたち)?"
    r"(?:と(?P<co>[^\s（）()]+?)さん)?"
    r"の(?P<stage>二次面接|面接)"
    r"(?:\s*[（(【].*)?$"
)
UA = {"User-Agent": "CHIERO-interviews-sync/1.0 (+https://chiero.jp/interviews/)"}


# ---------------------------------------------------------------- 取得
def load_token():
    tok = os.environ.get("THREADS_ACCESS_TOKEN")
    if tok:
        return tok
    data = json.loads(TOKEN_FILE.read_text())
    exp = data.get("expires_at")
    if exp and datetime.fromisoformat(exp) < datetime.now(timezone.utc):
        raise SystemExit(f"Threads token expired at {exp}; re-authorize via the publisher README")
    return data["access_token"]


def fetch_posts(token):
    params = {
        "fields": "id,text,permalink,timestamp,media_type",
        "limit": "100",
        "since": SINCE,
        "access_token": token,
    }
    url = API + "?" + urllib.parse.urlencode(params)
    posts, pages = [], 0
    while url and pages < 20:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=40) as r:
            page = json.load(r)
        posts.extend(page.get("data", []))
        url = page.get("paging", {}).get("next")
        pages += 1
    return posts


# ---------------------------------------------------------------- 判別
def pref_lookup():
    table = {}
    for name, en, region in PREFS:
        table[name] = name
        if name.endswith(("県", "府", "都")):
            table[name[:-1]] = name           # 東京 / 大阪 / 京都 / 福岡 …（末尾1字だけ落とす）
    return table


def classify(posts, overrides):
    """投稿 → 県ごとの候補。戻り値: {県名: [entry, ...]}"""
    lookup = pref_lookup()
    found = {}
    for p in posts:
        text = p.get("text") or ""
        title = text.split("\n", 1)[0].strip()
        if not title:
            continue
        code = p["permalink"].rstrip("/").rsplit("/", 1)[-1]
        ov = overrides.get(code, {})
        if ov.get("ignore"):
            continue
        m = TITLE_RE.match(title)
        if not m:
            continue
        who = m.group("who")
        stage = "second" if m.group("stage") == "二次面接" else "first"
        revised = "改訂版" in title or bool(ov.get("revised"))
        city = None
        pref = lookup.get(who)
        if pref is None:
            key = who[:-1] if who.endswith("市") and who not in CITIES else who
            if key in CITIES:
                pref, city_ja, city_en = CITIES[key]
                city = {"ja": city_ja, "en": city_en}
            else:
                continue
        if ov.get("pref"):
            pref = ov["pref"]
        ts = datetime.fromisoformat(p["timestamp"].replace("+0000", "+00:00")).astimezone(JST)
        found.setdefault(pref, []).append({
            "id": code,
            "url": THREADS + code,
            "title": title,
            "stage": stage,
            "revised": revised,
            "city": city,
            "date": ts.date().isoformat(),
            "timestamp": ts.isoformat(),
        })

    # 同じ枠（県・市・段階・改訂）に複数あれば新しい方だけ残す（再掲対策）
    result = {}
    for pref, entries in found.items():
        slots = {}
        for e in entries:
            key = (e["city"]["ja"] if e["city"] else "", e["stage"], e["revised"])
            if key not in slots or e["timestamp"] > slots[key]["timestamp"]:
                slots[key] = e
        order = {("", "first", False): 0, ("", "first", True): 1, ("", "second", False): 2, ("", "second", True): 3}
        result[pref] = sorted(slots.values(), key=lambda e: (
            order.get((e["city"]["ja"] if e["city"] else "", e["stage"], e["revised"]), 9),
            e["timestamp"]))
    return result


def build_data(by_pref, generated):
    prefs = []
    for name, en, region in PREFS:
        prefs.append({"name": name, "en": en, "region": region, "posts": by_pref.get(name, [])})
    all_posts = [dict(p, pref=pr["name"], pref_en=pr["en"]) for pr in prefs for p in pr["posts"]]
    latest = sorted(all_posts, key=lambda e: e["timestamp"], reverse=True)[:LATEST_COUNT]
    return {
        "generated_at": generated.isoformat(),
        "source": "Threads API (@chiero_piero), classified by post title",
        "count": len(all_posts),
        "prefectures_with_posts": sum(1 for p in prefs if p["posts"]),
        "regions": [{"ja": ja, "en": en} for ja, en in REGIONS],
        "prefectures": prefs,
        "latest": latest,
    }


# ---------------------------------------------------------------- HTML
def kind_label(e, lang):
    if e["city"]:
        base = e["city"][lang]
        if e["revised"]:
            return base + ("・改訂版" if lang == "ja" else " · revised")
        return base
    if e["stage"] == "second":
        return ("二次面接・改訂版" if e["revised"] else "二次面接") if lang == "ja" else \
               ("Second interview · revised" if e["revised"] else "Second interview")
    return ("改訂版" if e["revised"] else "面接") if lang == "ja" else ("Revised" if e["revised"] else "Interview")


def kind_class(e):
    if e["city"]:
        return "is-city"
    if e["stage"] == "second":
        return "is-second"
    return "is-revised" if e["revised"] else "is-first"


def short_date(iso, lang):
    d = datetime.fromisoformat(iso)
    return f"{d.month}/{d.day}" if lang == "ja" else d.strftime("%b %-d")


def esc(s):
    return html.escape(s, quote=True)


def render_grid(data, lang):
    out = []
    for i, (ja, en) in enumerate(REGIONS):
        out.append(f'<section class="pref-region" id="region-{i}"><h2>{ja if lang == "ja" else en}</h2><ul class="pref-grid">')
        for pr in data["prefectures"]:
            if pr["region"] != i:
                continue
            key = pr["name"] if lang == "ja" else f'{pr["en"]} {pr["name"]}'
            pid = "pref-" + pr["en"].lower()          # #pref-toyama のように直接リンクできる
            head = f'<strong>{esc(pr["name"])}</strong>' if lang == "ja" else \
                   f'<strong>{esc(pr["en"])}</strong><span class="pref-ja" lang="ja">{esc(pr["name"])}</span>'
            if not pr["posts"]:
                note = "準備中" if lang == "ja" else "Coming soon"
                out.append(f'<li id="{pid}" data-prefecture="{esc(key)}" class="pref-card is-empty">{head}<span class="pref-note">{note}</span></li>')
                continue
            n = len(pr["posts"])
            cls = "pref-card" + (" has-many" if n > 1 else "")
            items = []
            for e in pr["posts"]:
                label = kind_label(e, lang)
                if lang == "ja":
                    aria = f'{esc(e["title"])}をThreadsで読む'
                else:
                    aria = f'Read {esc(pr["en"])}: {esc(label.lower())} on Threads (Japanese)'
                items.append(
                    f'<li><a href="{e["url"]}" aria-label="{aria}">'
                    f'<span class="pref-kind {kind_class(e)}">{esc(label)}</span>'
                    f'<time datetime="{e["date"]}">{short_date(e["date"], lang)}</time>'
                    f'<b aria-hidden="true">↗</b></a></li>')
            out.append(f'<li id="{pid}" data-prefecture="{esc(key)}" class="{cls}">{head}<ul class="pref-posts">{"".join(items)}</ul></li>')
        out.append("</ul></section>")
    return "".join(out)


def render_latest(data, lang):
    items = []
    for e in data["latest"]:
        name = e["pref"] if lang == "ja" else e["pref_en"]
        label = kind_label(e, lang)
        items.append(
            f'<a href="{e["url"]}"><span>{esc(name)}<em class="pref-kind {kind_class(e)}">{esc(label)}</em></span>'
            f'<time datetime="{e["date"]}">{short_date(e["date"], lang)}</time><b aria-hidden="true">↗</b></a>')
    return f'<div class="latest-links">{"".join(items)}</div>'


def render_meta(data, lang):
    g = datetime.fromisoformat(data["generated_at"])
    n, k = data["count"], data["prefectures_with_posts"]
    if lang == "ja":
        return (f'<p class="micro space-top">{g.year}年{g.month}月{g.day}日 更新。Threadsの投稿から自動で反映しています。'
                f'現在 {k}都道府県・{n}話。改訂版や二次面接が増えると、この欄も増えます。</p>')
    return (f'<p class="micro space-top">Updated {g.strftime("%B %-d, %Y")} from the Threads feed. '
            f'{n} stories across {k} prefectures so far. New revisions and second interviews appear here automatically.</p>')


def replace_block(text, name, body):
    start, end = f"<!-- INTERVIEWS:{name}:START -->", f"<!-- INTERVIEWS:{name}:END -->"
    i, j = text.find(start), text.find(end)
    if i < 0 or j < 0 or j < i:
        raise SystemExit(f"marker {name} missing")
    return text[: i + len(start)] + body + text[j:]


def update_sitemap(text, day):
    for loc in ("https://chiero.jp/interviews/", "https://chiero.jp/en/interviews/"):
        text = re.sub(rf"(<loc>{re.escape(loc)}</loc><lastmod>)\d{{4}}-\d{{2}}-\d{{2}}", rf"\g<1>{day}", text)
    return text


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--input", help="保存済みの API 応答（JSON 配列）。指定時は通信しない")
    ap.add_argument("--save-posts", help="取得した API 応答をこのファイルへ保存")
    args = ap.parse_args()

    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    overrides = {k: v for k, v in overrides.items() if not k.startswith("_")}

    if args.input:
        posts = json.loads(Path(args.input).read_text())
    else:
        posts = fetch_posts(load_token())
        if args.save_posts:
            Path(args.save_posts).write_text(json.dumps(posts, ensure_ascii=False, indent=1))

    by_pref = classify(posts, overrides)
    now = datetime.now(JST)
    data = build_data(by_pref, now)

    if args.dry_run:
        for pr in data["prefectures"]:
            marks = ", ".join(f'{kind_label(e, "ja")} {e["date"][5:]} {e["id"]}' for e in pr["posts"]) or "—"
            print(f'{pr["name"]:5s} {marks}')
        print(f'\n{data["prefectures_with_posts"]} prefectures, {data["count"]} posts, from {len(posts)} threads')
        return 0

    if data["prefectures_with_posts"] < MIN_PREFECTURES:
        raise SystemExit(f'only {data["prefectures_with_posts"]} prefectures matched; refusing to write')

    changed = []
    for lang, path in PAGES.items():
        before = path.read_text()
        after = replace_block(before, "GRID", render_grid(data, lang))
        after = replace_block(after, "LATEST", render_latest(data, lang))
        after = replace_block(after, "META", render_meta(data, lang))
        if after != before:
            path.write_text(after)
            changed.append(path)

    payload = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if not DATA_OUT.exists() or json.loads(DATA_OUT.read_text()).get("prefectures") != data["prefectures"]:
        DATA_OUT.write_text(payload)
        changed.append(DATA_OUT)

    if changed:
        sm = SITEMAP.read_text()
        sm2 = update_sitemap(sm, now.date().isoformat())
        if sm2 != sm:
            SITEMAP.write_text(sm2)
            changed.append(SITEMAP)

    print(f'{data["prefectures_with_posts"]} prefectures, {data["count"]} posts; '
          + ("updated: " + ", ".join(str(p.relative_to(ROOT)) for p in changed) if changed else "no change"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
