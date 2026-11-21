#!/bin/sh
# Writes the commits made in occt/work/occt (set up by occt/fetch.sh --git) back to occt/patches, one file per commit.
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here/work/occt"
rm -f "$here"/patches/*.patch
git format-patch -q --no-signature --zero-commit --no-stat upstream..HEAD -o "$here/patches"
ls "$here/patches"
