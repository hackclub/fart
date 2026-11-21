#!/bin/sh
# Downloads the pinned OpenCascade release and RapidJSON, checks their hashes and unpacks them into occt/work,
# with occt/patches applied in order. With --git, the OpenCascade tree is a git repo whose commits are the patches,
# so it can be edited and written back with occt/save.sh.
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
. "$here/source.env"
cache="$here/.cache"
work="$here/work"
mkdir -p "$cache"

download() {
  if [ ! -f "$cache/$1" ] || ! echo "$3  $cache/$1" | sha256sum -c - >/dev/null 2>&1; then
    curl -fsSL -o "$cache/$1.part" "$2"
    mv "$cache/$1.part" "$cache/$1"
  fi
  echo "$3  $cache/$1" | sha256sum -c - >/dev/null || { echo "occt/fetch.sh: $1 does not match its pinned hash" >&2; exit 1; }
}

download "occt-$OCCT_TAG.tar.gz" "https://github.com/Open-Cascade-SAS/OCCT/archive/refs/tags/$OCCT_TAG.tar.gz" "$OCCT_SHA256"
download "rapidjson-$RAPIDJSON_COMMIT.tar.gz" "https://github.com/Tencent/rapidjson/archive/$RAPIDJSON_COMMIT.tar.gz" "$RAPIDJSON_SHA256"

rm -rf "$work/occt" "$work/rapidjson"
mkdir -p "$work/occt" "$work/rapidjson"
tar -xzf "$cache/occt-$OCCT_TAG.tar.gz" -C "$work/occt" --strip-components=1
tar -xzf "$cache/rapidjson-$RAPIDJSON_COMMIT.tar.gz" -C "$work/rapidjson" --strip-components=1

cd "$work/occt"
if [ "${1:-}" = "--git" ]; then
  git init -q
  git add -A
  git -c user.name=occt -c user.email=occt@localhost commit -qm "OpenCascade $OCCT_TAG"
  git tag upstream
  for p in "$here"/patches/*.patch; do
    [ -e "$p" ] && git -c user.name=occt -c user.email=occt@localhost am -q --committer-date-is-author-date "$p"
  done
else
  for p in "$here"/patches/*.patch; do
    [ -e "$p" ] && patch -s -p1 < "$p"
  done
fi
echo "OpenCascade $OCCT_TAG is in $work/occt"
