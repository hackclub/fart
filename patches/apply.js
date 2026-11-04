import { readFileSync, writeFileSync } from 'node:fs'

const plotter = 'node_modules/@tracespace/plotter/dist'

const patches = [
  {
    file: `${plotter}/tracespace-plotter.js`,
    from: '[y, h] = [u * f / l, u * p / l]',
    to: '[y, h] = [u * p / l, u * f / l]',
  },
  {
    file: `${plotter}/tracespace-plotter.umd.cjs`,
    from: '[p,l]=[f*h/d,f*y/d]',
    to: '[p,l]=[f*y/d,f*h/d]',
  },
]

for (const { file, from, to } of patches) {
  const source = readFileSync(file, 'utf8')
  if (source.includes(to)) continue
  if (source.split(from).length !== 2) throw new Error(`patches/apply.js: ${file} no longer matches, check the patch`)
  writeFileSync(file, source.replace(from, to))
}
