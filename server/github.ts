import { Cache } from './cache.ts'

const API = 'https://api.github.com'
const USER_AGENT = 'fart.hackclub.com'
const REPO = /^[A-Za-z0-9-]+\/(?!\.\.?$)[A-Za-z0-9._-]+$/
const SHA = /^[0-9a-f]{7,40}$/i
const ATTACHMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 1024 * 1024
const TIMEOUT_MS = 15_000

const MINUTE = 60 * 1000
const BRANCH_TTL = 60 * MINUTE
const HEAD_TTL = MINUTE
const SNAPSHOT_TTL = 24 * 60 * MINUTE
const RENDERED_TTL = 2 * MINUTE
const COMPARE_FILE_LIMIT = 300
const PATCH_LIMIT = 100 * 1024
const COMMIT_PAGE = 100

const cache = new Cache(Number(process.env.CACHE_MB ?? 256) * 1024 * 1024)

export interface Snapshot {
  repo: string
  branch: string | null
  sha: string
  truncated: boolean
  files: { path: string; size: number; submodule?: boolean }[]
}

export function validRepo(repo: string) {
  return REPO.test(repo)
}

export function encodePath(path: string) {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

export class RepoFiles {
  readonly repo: string

  constructor(repo: string) {
    this.repo = repo
  }

  async isPublic() {
    return (await this.#metadata())?.private === false
  }

  async snapshot(): Promise<Snapshot | null> {
    const head = await this.#headSha()
    if (!head) return null
    return this.#cached(['snapshot', head], SNAPSHOT_TTL, async () => {
      const tree = await apiGet<{ tree?: unknown; truncated?: boolean }>(
        `/repos/${this.repo}/git/trees/${encodePath(head)}?recursive=1`,
      )
      if (!tree || !Array.isArray(tree.tree)) return null
      return {
        repo: this.repo,
        branch: (await this.#metadata())?.branch ?? null,
        sha: head,
        truncated: tree.truncated === true,
        files: (tree.tree as GitTreeEntry[]).flatMap(fileEntry),
      }
    })
  }

  async commits() {
    const head = await this.#headSha()
    if (!head) return null
    return this.#cached(['commits', head], SNAPSHOT_TTL, async () => {
      const batch = await apiGet<GitCommit[]>(
        `/repos/${this.repo}/commits?sha=${encodeURIComponent(head)}&per_page=${COMMIT_PAGE}&page=1`,
      )
      if (!Array.isArray(batch)) return null
      return { commits: batch.map(commitEntry), complete: batch.length < COMMIT_PAGE }
    })
  }

  async compare(base: string, head: string) {
    if (!SHA.test(base) || !SHA.test(head)) return null
    return this.#cached(['compare', base, head], SNAPSHOT_TTL, async () => {
      const data = await apiGet<{ total_commits?: number; files?: GitCompareFile[] }>(
        `/repos/${this.repo}/compare/${encodePath(base)}...${encodePath(head)}`,
      )
      if (!data || typeof data !== 'object') return null
      const files = Array.isArray(data.files) ? data.files : []
      return {
        total_commits: Number(data.total_commits) || 0,
        truncated: files.length >= COMPARE_FILE_LIMIT,
        files: files.map(compareEntry),
      }
    })
  }

  async attachmentUrl(path: string, id: string) {
    if (!ATTACHMENT_ID.test(id)) return null
    const data = await this.snapshot()
    if (!data || !data.files.some((f) => f.path === path)) return null
    const html = await this.#cached(['rendered', data.sha, path], RENDERED_TTL, () =>
      getText(`${API}/repos/${this.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(data.sha)}`, {
        Accept: 'application/vnd.github.html+json',
      }),
    )
    const pattern = new RegExp(
      `https://private-user-images\\.githubusercontent\\.com/\\d+/\\d+-${id}\\.\\w+\\?jwt=[\\w.-]+`,
    )
    return html?.match(pattern)?.[0] ?? null
  }

  async #metadata() {
    return this.#cached(['metadata'], BRANCH_TTL, async () => {
      const data = await apiGet<{ default_branch?: string; private?: boolean }>(`/repos/${this.repo}`)
      return data && typeof data === 'object'
        ? { branch: data.default_branch ?? null, private: data.private !== false }
        : null
    })
  }

  async #headSha() {
    const branch = (await this.#metadata())?.branch
    if (!branch) return null
    return this.#cached(['head', branch], HEAD_TTL, async () => {
      const data = await apiGet<{ object?: { sha?: string } }>(
        `/repos/${this.repo}/git/ref/heads/${encodePath(branch)}`,
      )
      return data?.object?.sha ?? null
    })
  }

  #cached<T>(key: string[], ttl: number, load: () => Promise<T | null>) {
    return cache.fetch<T>(JSON.stringify(['repo', this.repo, ...key]), ttl, load)
  }
}

interface GitTreeEntry {
  path: string
  type: string
  size?: number
}

interface GitCommit {
  sha: string
  author?: { login?: string } | null
  commit?: { message?: string; author?: { name?: string; date?: string }; committer?: { date?: string } }
}

interface GitCompareFile {
  filename: string
  previous_filename?: string
  status: string
  additions?: number
  deletions?: number
  patch?: string
}

function fileEntry(entry: GitTreeEntry) {
  if (entry.type === 'blob') return [{ path: entry.path, size: Number(entry.size) || 0 }]
  if (entry.type === 'commit') return [{ path: entry.path, size: 0, submodule: true }]
  return []
}

function commitEntry(commit: GitCommit) {
  return {
    sha: commit.sha,
    message: (commit.commit?.message ?? '').split('\n')[0].trim(),
    author: commit.commit?.author?.name ?? commit.author?.login ?? null,
    date: commit.commit?.committer?.date ?? commit.commit?.author?.date ?? null,
  }
}

function compareEntry(file: GitCompareFile) {
  const patch = Buffer.from(file.patch ?? '', 'utf8')
  return {
    filename: file.filename,
    previous_filename: file.previous_filename ?? null,
    status: file.status,
    additions: Number(file.additions) || 0,
    deletions: Number(file.deletions) || 0,
    patch: patch.length ? patch.subarray(0, PATCH_LIMIT).toString('utf8').replace(/�+$/, '') : null,
    patch_truncated: patch.length > PATCH_LIMIT,
  }
}

function headers(extra: Record<string, string> = {}) {
  const token = process.env.GITHUB_TOKEN
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function apiGet<T>(path: string): Promise<T | null> {
  const text = await getText(`${API}${path}`)
  if (text === null) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function getText(url: string, extra: Record<string, string> = {}): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: headers(extra), signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) {
      if (response.status !== 404) log('github_api_error', { url, status: response.status })
      await response.body?.cancel()
      return null
    }
    return await readCapped(response, MAX_BODY_BYTES * (url.includes('/git/trees/') ? 64 : 1))
  } catch (error) {
    log('github_api_error', { url, error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

async function readCapped(response: Response, limit: number) {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of response.body ?? []) {
    total += chunk.byteLength
    if (total > limit) throw new Error(`Response over ${limit} bytes`)
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
}
