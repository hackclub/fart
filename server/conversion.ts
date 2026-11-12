import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, accessSync, constants } from 'node:fs'
import { mkdir, mkdtemp, readdir, rename, rm, stat, open } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, extname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { pipeline } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import { encodePath, log } from './github.ts'

const EXTENSIONS = new Set(['step', 'stp', 'iges', 'igs', 'brep', 'brp'])
const MB = 1024 * 1024
const MAX_BYTES = 300 * MB
const MEMORY_LIMIT = Number(process.env.CONVERT_MEMORY_MB ?? 3072) * MB
const OUTPUT_LIMIT = 1024 * MB
const TIMEOUT_MS = 15 * 60 * 1000
const DONE_TTL = 30 * 24 * 60 * 60 * 1000
const FAILED_TTL = 60 * 60 * 1000
const MAX_QUEUE = Number(process.env.CONVERT_QUEUE_LIMIT ?? 10)
const STORE_LIMIT = Number(process.env.CONVERT_STORE_MB ?? 4096) * MB
const STORE_DIR = process.env.CONVERT_DIR ?? join(tmpdir(), 'fart-conversions')
const LFS_POINTER = 'version https://git-lfs.github.com/spec/'
// The converter parses untrusted files, so it gets none of the server's secrets.
const CHILD_ENV = ['PATH', 'LANG', 'LC_ALL', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'MALLOC_CONF']
const CHILD_ENV_PREFIXES = ['CSF_', 'MMGT_']
const STEPS: Record<string, string> = {
  'Reading the model': 'Reading the model on the server',
  'Meshing solids': 'Meshing solids on the server',
  'Writing the model': 'Writing the converted model',
}

export interface Status {
  state: 'queued' | 'working' | 'done' | 'failed'
  message?: string
  error?: string
  file?: string
  size?: number
  expires?: number
}

class Failure extends Error {}

const states = new Map<string, Status>()
const queue: { key: string; repo: string; sha: string; path: string; priority: boolean }[] = []
let running = false

export function converter() {
  const configured = process.env.STEP2GLB_PATH
  if (configured && executable(configured)) return configured
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const file = join(dir, 'step2glb')
    if (executable(file)) return file
  }
  return null
}

export function convertible(path: string) {
  return EXTENSIONS.has(extname(path).slice(1).toLowerCase())
}

export function status(repo: string, sha: string, path: string): Status | null {
  const key = keyFor(repo, sha, path)
  const result = states.get(key)
  if (!result) return null
  if (result.expires !== undefined && result.expires <= Date.now()) {
    states.delete(key)
    return null
  }
  if (result.state === 'done' && (!result.file || !existsSync(join(STORE_DIR, result.file)))) {
    states.delete(key)
    return null
  }
  return result
}

// Priority jobs (from CONVERT_TOKENS callers) skip the queue cap and wait only behind other priority jobs.
export function start(repo: string, sha: string, path: string, priority = false): Status | { error: string } {
  const current = status(repo, sha, path)
  if (current) return publicStatus(current)
  if (!priority && queue.length >= MAX_QUEUE)
    return { error: 'The server is busy converting other models. Try again in a few minutes.' }
  const key = keyFor(repo, sha, path)
  states.set(key, { state: 'queued', message: 'Waiting for the server' })
  const at = priority ? queue.findIndex((job) => !job.priority) : -1
  queue.splice(at < 0 ? queue.length : at, 0, { key, repo, sha, path, priority })
  void drain()
  return publicStatus(states.get(key)!)
}

export function publicStatus(result: Status): Status {
  return { state: result.state, message: result.message, error: result.error }
}

export function converted(repo: string, sha: string, path: string) {
  const result = status(repo, sha, path)
  if (result?.state !== 'done' || !result.file) return null
  return { file: join(STORE_DIR, result.file), size: result.size ?? 0 }
}

async function drain() {
  if (running) return
  running = true
  try {
    for (let job = queue.shift(); job; job = queue.shift()) await run(job.key, job.repo, job.sha, job.path)
  } finally {
    running = false
  }
}

async function run(key: string, repo: string, sha: string, path: string) {
  const dir = await mkdtemp(join(tmpdir(), 'fart-model-'))
  const progress = (message: string) => states.set(key, { state: 'working', message })
  try {
    const input = join(dir, `model.${extname(path).slice(1).toLowerCase()}`)
    const output = join(dir, 'model.glb')
    progress('Downloading the file on the server')
    await download(repo, sha, path, input)
    await convert(input, output, dir, progress)
    progress('Storing the converted model')
    const stored = await store(output)
    states.set(key, { state: 'done', ...stored, expires: Date.now() + DONE_TTL })
    log('model_conversion_done', { repo, path, size: stored.size })
  } catch (error) {
    const message = error instanceof Failure ? error.message : 'The server could not convert this model.'
    if (!(error instanceof Failure))
      log('model_conversion_error', { repo, path, error: error instanceof Error ? error.message : String(error) })
    states.set(key, { state: 'failed', error: message, expires: Date.now() + FAILED_TTL })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function download(repo: string, sha: string, path: string, target: string) {
  const file = `${repo}/${sha}/${encodePath(path)}`
  await fetchTo(`https://raw.githubusercontent.com/${file}`, target)
  const pointer = await lfsPointer(target)
  if (!pointer) return
  if (pointer.size > MAX_BYTES)
    throw new Failure(`This file is ${Math.floor(pointer.size / MB)} MB, too large for the server to convert.`)
  await fetchTo(`https://media.githubusercontent.com/media/${file}`, target)
  const digest = createHash('sha256')
  await pipeline(createReadStream(target), digest)
  if (digest.digest('hex') !== pointer.oid)
    throw new Failure('GitHub sent a Git LFS file that does not match its checksum.')
}

async function fetchTo(url: string, target: string) {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) })
  } catch (error) {
    throw new Failure(`Downloading the file from GitHub failed: ${error instanceof Error ? error.message : error}`)
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Failure(`GitHub would not hand over this file (${response.status}).`)
  }
  let received = 0
  const cap = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.length
      if (received > MAX_BYTES)
        return done(new Failure(`This file is over ${MAX_BYTES / MB} MB, too large for the server to convert.`))
      done(null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(response.body as WebReadableStream), cap, createWriteStream(target))
  } catch (error) {
    if (error instanceof Failure) throw error
    throw new Failure(`Downloading the file from GitHub failed: ${error instanceof Error ? error.message : error}`)
  }
}

async function lfsPointer(file: string) {
  if ((await stat(file)).size > 1024) return null
  const handle = await open(file)
  try {
    const text = (await handle.readFile()).toString('utf8')
    if (!text.startsWith(LFS_POINTER)) return null
    const oid = text.match(/^oid sha256:([0-9a-f]{64})$/m)?.[1]
    const size = text.match(/^size (\d+)$/m)?.[1]
    return oid && size ? { oid, size: Number(size) } : null
  } finally {
    await handle.close()
  }
}

function convert(input: string, output: string, dir: string, progress: (message: string) => void) {
  const binary = converter()
  if (!binary) throw new Failure("Converting models on the server isn't set up here.")
  return new Promise<void>((resolve, reject) => {
    const child = spawn('prlimit', [`--as=${MEMORY_LIMIT}`, `--fsize=${OUTPUT_LIMIT}`, '--', binary, input, output], {
      cwd: dir,
      env: childEnv(dir),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let errors = ''
    child.stderr.on('data', (chunk: Buffer) => (errors = (errors + chunk.toString('utf8')).slice(-8192)))
    createInterface({ input: child.stdout }).on('line', (line) => {
      const step = STEPS[line.trim()]
      if (step) progress(step)
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try {
        process.kill(-child.pid!, 'SIGKILL')
      } catch {
        // Already gone.
      }
    }, TIMEOUT_MS)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', async (code, signal) => {
      clearTimeout(timer)
      if (timedOut) return reject(new Failure(`Converting took longer than ${TIMEOUT_MS / 60000} minutes.`))
      const size = await stat(output).then(
        (s) => s.size,
        () => 0,
      )
      if (code === 0 && size > 0) return resolve()
      const last = errors.trim().split('\n').pop()?.trim()
      reject(
        new Failure(
          signal
            ? 'The model is too big even for the server to convert.'
            : last || 'The server could not convert this model.',
        ),
      )
    })
  })
}

function childEnv(dir: string) {
  const env: Record<string, string> = { HOME: dir, TMPDIR: dir }
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && (CHILD_ENV.includes(key) || CHILD_ENV_PREFIXES.some((p) => key.startsWith(p))))
      env[key] = value
  }
  return env
}

async function store(output: string) {
  const digest = createHash('sha256')
  await pipeline(createReadStream(output), digest)
  const file = `${digest.digest('hex')}.glb`
  const { size } = await stat(output)
  await mkdir(STORE_DIR, { recursive: true })
  await rename(output, join(STORE_DIR, file)).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EXDEV') throw error
    await pipeline(createReadStream(output), createWriteStream(join(STORE_DIR, file)))
  })
  await prune(file)
  return { file, size }
}

// Drops the least recently converted models once the store passes its size cap.
async function prune(keep: string) {
  const names = (await readdir(STORE_DIR)).filter((name) => name.endsWith('.glb'))
  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      ...(await stat(join(STORE_DIR, name)).catch(() => ({ size: 0, mtimeMs: 0 }))),
    })),
  )
  let total = files.reduce((sum, f) => sum + f.size, 0)
  for (const f of files.sort((a, b) => a.mtimeMs - b.mtimeMs)) {
    if (total <= STORE_LIMIT) break
    if (f.name === keep) continue
    await rm(join(STORE_DIR, f.name), { force: true })
    total -= f.size
  }
}

function keyFor(repo: string, sha: string, path: string) {
  return JSON.stringify([repo, sha, path])
}

function executable(file: string) {
  try {
    accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}
