import ibomWorker from './ibom.worker.ts?worker&url'
import type { FileSource, HurtFile } from '../../types'
import { cacheGet, cachePut, sizeOf } from '../../core/cache'
import { WorkerClient } from '../../core/workers'
import type { IbomView } from './render'

const VERSION = 3
const worker = new WorkerClient(ibomWorker, 'interactive BOM reader')
const jobs = new Map<string, Promise<IbomView>>()

export type { IbomFrame, IbomPart, IbomView } from './render'

export async function prepareIbom(source: FileSource, file: HurtFile, onProgress?: (message: string) => void) {
  const key = `ibom@${VERSION}|${source.id}|${file.path}`
  const cached = await cacheGet<IbomView>(key)
  if (cached) return cached
  let job = jobs.get(key)
  if (!job) {
    job = (async () => {
      onProgress?.('Downloading')
      const bytes = await source.read(file.path)
      const result = await worker.call<IbomView>('read', { bytes }, { onProgress })
      await cachePut(key, result, sizeOf(result))
      return result
    })()
    jobs.set(key, job)
    void job.finally(() => jobs.delete(key)).catch(() => undefined)
  }
  return job
}
