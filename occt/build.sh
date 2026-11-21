#!/bin/sh
# Builds OpenCascade from occt/work (set up by occt/fetch.sh) as static libraries with only the toolkits we use,
# and no image, font, windowing or OpenGL libraries.
#   occt/build.sh native   libraries for the server's step2glb, in occt/work/native
#   occt/build.sh wasm     occt-import-js.js and .wasm for the browser, in occt/work/wasm/dist (Emscripten in Docker)
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
target="${1:-}"
emsdk="emscripten/emsdk:3.1.69"

# occt <install dir> <toolkits> <cmake launcher or ""> [extra cmake arguments...]
occt() {
  build="$1" toolkits="$2" launcher="$3"
  shift 3
  $launcher cmake -S "$here/work/occt" -B "$build/build" -Wno-dev \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_LIBRARY_TYPE=Static \
    -DINSTALL_DIR="$build" \
    -DBUILD_MODULE_FoundationClasses=OFF \
    -DBUILD_MODULE_ModelingData=OFF \
    -DBUILD_MODULE_ModelingAlgorithms=OFF \
    -DBUILD_MODULE_Visualization=OFF \
    -DBUILD_MODULE_ApplicationFramework=OFF \
    -DBUILD_MODULE_DataExchange=OFF \
    -DBUILD_MODULE_DETools=OFF \
    -DBUILD_MODULE_Draw=OFF \
    -DBUILD_ADDITIONAL_TOOLKITS="$toolkits" \
    -DBUILD_DOC_Overview=OFF \
    -DBUILD_RELEASE_DISABLE_EXCEPTIONS=OFF \
    -DUSE_FREETYPE=OFF \
    -DUSE_FREEIMAGE=OFF \
    -DUSE_TK=OFF \
    -DUSE_XLIB=OFF \
    -DUSE_OPENGL=OFF \
    -DUSE_GLES2=OFF \
    -DUSE_TBB=OFF \
    -DUSE_VTK=OFF \
    -DUSE_DRACO=OFF \
    -DUSE_RAPIDJSON=ON \
    -D3RDPARTY_RAPIDJSON_INCLUDE_DIR="$here/work/rapidjson/include" \
    "$@" >/dev/null
  cmake --build "$build/build" -j "${OCCT_JOBS:-$(nproc)}"
  cmake --install "$build/build" >/dev/null
}

case "$target" in
  native)
    occt "$here/work/native" "TKDESTEP;TKDEIGES;TKDEGLTF" ""
    echo "OpenCascade libraries are in $here/work/native"
    ;;
  wasm)
    exec docker run --rm -u "$(id -u):$(id -g)" -v "$here:/occt" -e OCCT_JOBS "$emsdk" sh /occt/build.sh wasm-in-docker
    ;;
  wasm-in-docker)
    # OCC_CONVERT_SIGNALS turns signals into exceptions with setjmp/longjmp, which wasm has no use for and which
    # breaks linking alongside wasm exceptions.
    occt "$here/work/wasm" "TKDESTEP;TKDEIGES;TKMesh" emcmake \
      -DCMAKE_CXX_FLAGS="-fwasm-exceptions -UOCC_CONVERT_SIGNALS" -DCMAKE_CXX_FLAGS_RELEASE=-Oz
    emcmake cmake -S "$here/wasm" -B "$here/work/wasm/importer" -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_CXX_FLAGS_RELEASE=-Oz -DOpenCASCADE_DIR="$here/work/wasm/lib/cmake/opencascade" >/dev/null
    cmake --build "$here/work/wasm/importer" -j "${OCCT_JOBS:-$(nproc)}"
    mkdir -p "$here/work/wasm/dist"
    cp "$here/work/wasm/importer/occt-import-js.js" "$here/work/wasm/importer/occt-import-js.wasm" "$here/work/wasm/dist/"
    echo "occt-import-js is in occt/work/wasm/dist; copy both files to src/hurt/vendor/occt/"
    ;;
  *)
    echo "usage: occt/build.sh native|wasm" >&2
    exit 2
    ;;
esac
