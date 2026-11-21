# OpenCascade

FART's STEP, IGES and BREP reading runs on [OpenCascade](https://github.com/Open-Cascade-SAS/OCCT): natively in the server's `step2glb` converter, and as WebAssembly in the browser's model worker. Both are built from the same pinned release with our fixes applied.

- `source.env` pins the OpenCascade release and RapidJSON (used for glTF output) by SHA-256.
- `patches/` holds our changes to OpenCascade, one patch per fix, applied in order.
- `wasm/` is the browser reader, from [occt-import-js](https://github.com/kovacsv/occt-import-js) (LGPL-2.1, see `wasm/LICENSE.md`), built against our OpenCascade.

## Building

```sh
occt/fetch.sh             # download, verify and patch into occt/work
occt/build.sh native      # static libraries for step2glb, in occt/work/native
occt/build.sh wasm        # occt-import-js.js/.wasm, in occt/work/wasm/dist (needs Docker)
```

The Dockerfile runs the native build in its own stage, so it only recompiles when `occt/` changes. The wasm build is slow and needs Emscripten, so its output is committed in `src/hurt/vendor/occt/`; rebuild and copy it there after changing a patch or `wasm/`.

## Changing OpenCascade

```sh
occt/fetch.sh --git       # occt/work/occt becomes a git repo, one commit per patch
# edit, build and test in occt/work/occt, committing each fix with a message that says what it fixes
occt/save.sh              # writes the commits back to occt/patches
```

To move to a new release, change `source.env`, run `occt/fetch.sh --git`, and fix any patch that no longer applies.
