import cadWorker from './cadsource.worker.ts?worker&url'
import type { FileSource, HurtFile } from '../../types'
import { WorkerClient } from '../../core/workers'
import type { CadInfo } from './types'

const client = new WorkerClient(cadWorker, 'CAD file reader')

export async function readCadSource(
  source: FileSource,
  file: HurtFile,
  { signal, progress }: { signal?: AbortSignal; progress?: (fraction: number | null, message?: string) => void } = {},
) {
  const bytes = await source.read(file.path, {
    signal,
    onProgress: (loaded, total) => progress?.(total ? loaded / total : null, 'Downloading'),
  })
  progress?.(null, 'Reading the file')
  return client.call<CadInfo>('extract', { bytes, name: file.name }, { signal })
}

function nearest(from: HurtFile, matches: HurtFile[]) {
  const depth = (f: HurtFile) => (f.dir === from.dir ? -1 : f.path.split('/').length)
  return matches.sort((a, b) => depth(a) - depth(b))[0] ?? null
}

export function resolveReference(name: string, from: HurtFile, files: HurtFile[]) {
  const lower = name.toLowerCase()
  return nearest(
    from,
    files.filter((f) => f.name.toLowerCase() === lower),
  )
}

export function stepExport(from: HurtFile, files: HurtFile[]) {
  const stem = from.name.replace(/\.[^.]+$/, '').toLowerCase()
  const exports = files.filter(
    (f) => /^(step|stp)$/.test(f.ext) && f.name.replace(/\.[^.]+$/, '').toLowerCase() === stem,
  )
  return nearest(from, exports)
}
