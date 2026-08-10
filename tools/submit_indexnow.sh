#!/usr/bin/env bash
set -euo pipefail

site_host="chiero.jp"
key="4a7a9958-c1e7-4945-ab04-963782bde773"
key_location="https://${site_host}/${key}.txt"

if [[ "$#" -eq 0 ]]; then
  echo "usage: $0 https://chiero.jp/changed-url/ [...]" >&2
  exit 2
fi

for url in "$@"; do
  case "$url" in
    "https://${site_host}/"*) ;;
    *) echo "refusing URL outside https://${site_host}/: ${url}" >&2; exit 2 ;;
  esac
done

payload=$(jq -n \
  --arg host "$site_host" \
  --arg key "$key" \
  --arg keyLocation "$key_location" \
  --args '{host:$host,key:$key,keyLocation:$keyLocation,urlList:$ARGS.positional}' -- "$@")

curl --fail-with-body --silent --show-error \
  --header 'Content-Type: application/json; charset=utf-8' \
  --data "$payload" \
  https://api.indexnow.org/indexnow
