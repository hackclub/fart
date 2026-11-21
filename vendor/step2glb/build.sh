#!/bin/sh
# Builds the STEP/IGES/BREP to GLB converter used by server/conversion.ts, statically linked against the
# OpenCascade that occt/build.sh native puts in occt/work/native.
set -eu

out="${1:-/usr/local/bin/step2glb}"
here="$(cd "$(dirname "$0")" && pwd)"
occt="${OCCT_NATIVE:-$here/../../occt/work/native}"

g++ -O2 -std=c++17 -I"$occt/include/opencascade" "$here/step2glb.cpp" -o "$out" \
  -Wl,--start-group "$occt"/lib/*.a -Wl,--end-group -lpthread -ldl
