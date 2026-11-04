# Third-party notices

FART's own code is MIT licensed (see `LICENSE`). It also ships or depends on:

- **KiCanvas** (MIT), vendored in `src/hurt/vendor/kicanvas.js`, with the fonts and
  icons it bundles. Its full notice is `src/hurt/vendor/kicanvas.LICENSE.md`.
- **Material Symbols** (Apache-2.0), cut down to the icons KiCanvas draws, in
  `src/hurt/vendor/material-symbols-kicanvas.woff2`.
- **Parasolid schema table** in `src/hurt/viewers/parasolid/schema.ts`: the node fields of
  Parasolid's base transmit schema SCH_13006, derived through ps-parser (MIT).
- **Tailwind CSS preflight** (MIT, Tailwind Labs), in `src/styles/preflight.css`.
- **OpenCascade** (LGPL-2.1 with the OCCT exception), linked by the server's `step2glb`
  converter from Debian's packages, and in the browser through occt-import-js (LGPL-2.1).
- **Nippo** (ITF Free Font License) is loaded from the Fontshare API at runtime. The font
  files are not in this repository and must not be added to it: the license forbids
  redistributing them.

npm dependencies keep their own licenses in `node_modules`.
