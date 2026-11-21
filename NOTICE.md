# Third-party notices

FART's own code is MIT licensed (see `LICENSE`). It also ships or depends on:

- **KiCanvas** (MIT), whose source is in `src/hurt/kicanvas/` with FART's changes, along
  with the fonts and icons it bundles. Its full notice is `src/hurt/kicanvas/LICENSE.md`.
- **earcut** (ISC, Mapbox), used by KiCanvas, in `src/hurt/kicanvas/third_party/earcut/`.
- **Material Symbols** (Apache-2.0), cut down to the icons KiCanvas draws, in
  `src/hurt/vendor/material-symbols-kicanvas.woff2`.
- **Parasolid schema table** in `src/hurt/viewers/parasolid/schema.ts`: the node fields of
  Parasolid's base transmit schema SCH_13006, derived through ps-parser (MIT).
- **Tailwind CSS preflight** (MIT, Tailwind Labs), in `src/styles/preflight.css`.
- **OpenCascade** (LGPL-2.1 with the OCCT exception), built from the pinned release in
  `occt/` with the changes in `occt/patches/`. It is linked statically into the server's
  `step2glb` converter and compiled into the browser's STEP reader in `src/hurt/vendor/occt/`,
  together with occt-import-js (LGPL-2.1, `occt/wasm/`). Rebuild either with `occt/build.sh`.
- **RapidJSON** (MIT, Tencent), used by OpenCascade's glTF writer at build time.
- **Nippo** (ITF Free Font License) is loaded from the Fontshare API at runtime. The font
  files are not in this repository and must not be added to it: the license forbids
  redistributing them.

npm dependencies keep their own licenses in `node_modules`.
