import react from '@vitejs/plugin-react-swc'
import { build, transform, type Plugin as EsbuildPlugin } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))
const kicanvasId = 'virtual:kicanvas'

const minifyCss: EsbuildPlugin = {
  name: 'kicanvas-css',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => ({
      loader: 'text',
      contents: (await transform(await readFile(path), { loader: 'css', minify: true })).code,
    }))
  },
}

// KiCanvas relies on legacy decorators and text imports, so it is bundled with its own settings rather than Vite's.
function kicanvas(): Plugin {
  return {
    name: 'kicanvas',
    resolveId: (id) => (id === kicanvasId ? `\0${kicanvasId}` : null),
    async load(id) {
      if (id !== `\0${kicanvasId}`) return null
      const result = await build({
        absWorkingDir: root,
        entryPoints: ['src/hurt/kicanvas/index.ts'],
        tsconfig: 'src/hurt/kicanvas/tsconfig.json',
        bundle: true,
        write: false,
        metafile: true,
        format: 'esm',
        target: 'es2022',
        keepNames: true,
        loader: { '.js': 'ts', '.glsl': 'text', '.css': 'text', '.svg': 'text', '.kicad_wks': 'text' },
        define: { DEBUG: 'false' },
        plugins: [minifyCss],
      })
      for (const input of Object.keys(result.metafile.inputs)) this.addWatchFile(resolve(root, input))
      return result.outputFiles[0].text
    },
  }
}

export default defineConfig({
  plugins: [react(), kicanvas()],
  server: {
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 3000}` },
  },
  worker: {
    format: 'es',
  },
})
