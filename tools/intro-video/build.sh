#!/bin/sh
# 紹介動画を書き出す：BGM合成 → 全コマ撮影 → MP4（H.264 / AAC）→ /media/ へ置く
#   sh tools/intro-video/build.sh
#   WORKERS=2 sh tools/intro-video/build.sh      並列数を変える（既定 4）
#   NO_BGM=1 sh tools/intro-video/build.sh       音なしで書き出す
set -eu
cd "$(dirname "$0")"

FFMPEG="${FFMPEG:-$(command -v ffmpeg || python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')}"
WORKERS="${WORKERS:-4}"
OUT=out
DEST=../../media

[ -d node_modules ] || npm install --no-audit --no-fund

rm -rf "$OUT/frames"
node render.mjs --workers "$WORKERS"

# 色は BT.709（HD の標準）で変換し、そのことを動画に書いておく。赤 #E60012 がずれないように
VIDEO="-vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.1 -g 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
if [ -n "${NO_BGM:-}" ]; then
  "$FFMPEG" -hide_banner -loglevel warning -y -framerate 30 -i "$OUT/frames/f_%05d.png" \
    $VIDEO -movflags +faststart -metadata title="株式会社CHIERO 紹介動画" "$OUT/chiero-intro.mp4"
else
  python3 bgm.py
  "$FFMPEG" -hide_banner -loglevel warning -y -framerate 30 -i "$OUT/frames/f_%05d.png" -i "$OUT/bgm.wav" \
    -map 0:v -map 1:a $VIDEO -c:a aac -b:a 192k -ar 48000 \
    -movflags +faststart -metadata title="株式会社CHIERO 紹介動画" "$OUT/chiero-intro.mp4"
fi

cp "$OUT/chiero-intro.mp4" "$DEST/chiero-intro.mp4"
# サムネイル（10秒目：「商いにも、創造にも、好奇心を。」）
"$FFMPEG" -hide_banner -loglevel warning -y -i "$OUT/frames/f_00300.png" -frames:v 1 -update 1 -q:v 2 "$DEST/chiero-intro-poster.jpg"
echo "→ media/chiero-intro.mp4"
