# FART

**Fabricate Awesome Review Tool.** Open any public GitHub hardware repository and browse its files in the browser: STEP/IGES/BREP, Fusion 360 `.f3d`/`.f3z`, SolidWorks and Parasolid bodies, KiCad, Eagle, Altium, EasyEDA, LibrePCB, Fritzing, Gerbers, interactive BOMs, DXF/DWG, PDFs, Office files, archives and more.

Live at **https://fart.hackclub.com**. Link straight to a repository with `https://fart.hackclub.com/<owner>/<repo>`.

FART started as the file viewer reviewers use in [Fabricate](https://fabricate.hackclub.com), a Hack Club program, and was split out so anyone can use it.

## How it works

- Files are parsed in the browser, in Web Workers. Bytes come straight from `raw.githubusercontent.com` (and `media.githubusercontent.com` for Git LFS) and are cached in IndexedDB. Files are prepared in the background so they open instantly.
- The Node server (`server/`) serves the built app and a small JSON API that reads file lists, commits and diffs from the GitHub API, with an in-memory cache and per-IP rate limits. Only public repositories are opened.
- STEP/IGES/BREP files too large for the in-browser OpenCascade reader are converted to GLB on the server by `vendor/step2glb`, one at a time, under a memory cap (`CONVERT_MEMORY_MB`, 3 GB by default).

## Themes

The **Theme** button switches between presets or a custom palette. Every viewer colour comes from the `--color-*` tokens in `src/styles/app.css`, which `src/theme` overrides at runtime. A custom theme can be shared as a theme code (`dark:071d1a,04110f,…`). Board and model colours (copper, silkscreen, part colours) do not follow the theme. To add a preset, add it to `PRESETS` in `src/theme/themes.ts`.

## Developing

Needs Node 24.

```sh
npm install
cp .env.example .env   # optional: add a GITHUB_TOKEN
npm run dev:server     # API on :3000
npm run dev            # Vite on :5173, proxies /api to :3000
```

Server-side conversion needs `step2glb`: build it with `sh vendor/step2glb/build.sh <output>` (needs OpenCascade's development packages) and set `STEP2GLB_PATH`. Without it, large models show an error instead.

`npm run check` type-checks, `npm run format` formats, `npm run build` builds `dist/`, and `npm start` serves it.

## Deploying

The `Dockerfile` builds the app and the converter and runs `node server/index.ts` on port 3000 as a non-root user. It is deployed on Hack Club's Orchard. Set `GITHUB_TOKEN` as a secret: a fine-grained token with public-repository read access only. Give the pod about 4 GiB of memory for the converter. See `.env.example` for the other settings.

The page sends a strict Content-Security-Policy. Files under `/assets` are served without one. That is deliberate: the OpenCascade worker needs `eval` (Emscripten embind). If a proxy adds a CSP to static files, STEP viewing breaks.

## License

MIT, see `LICENSE`. Third-party notices are in `NOTICE.md`.
