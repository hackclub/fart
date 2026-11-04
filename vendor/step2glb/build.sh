#!/bin/sh
# Builds the STEP/IGES/BREP to GLB converter used by server/conversion.ts.
# Toolkit names changed in OpenCascade 7.8, so link whichever ones exist.
set -eu

out="${1:-/usr/local/bin/step2glb}"
here="$(dirname "$0")"
include="$(dirname "$(find /usr/include /usr/local/include -name Standard.hxx 2>/dev/null -path '*opencascade*' -print -quit)")"
libdir="$(dirname "$(ldconfig -p | awk '/libTKernel\.so[^.]/ {print $NF; exit}')")"
if [ ! -e "$libdir/libTKernel.so" ]; then libdir="/usr/lib/$(gcc -dumpmachine)"; fi

libs=""
for toolkit in TKernel TKMath TKG2d TKG3d TKGeomBase TKBRep TKGeomAlgo TKTopAlgo TKMesh TKLCAF TKCAF TKXCAF \
  TKRWMesh TKXSBase TKDE TKDESTEP TKDEIGES TKDEGLTF TKSTEP TKSTEPBase TKSTEPAttr TKSTEP209 TKXDESTEP TKIGES TKXDEIGES; do
  if [ -e "$libdir/lib$toolkit.so" ]; then libs="$libs -l$toolkit"; fi
done

# shellcheck disable=SC2086
g++ -O2 -std=c++17 -I"$include" "$here/step2glb.cpp" -o "$out" -L"$libdir" -Wl,--as-needed $libs
