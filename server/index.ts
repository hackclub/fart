import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { RepoFiles, log, validRepo } from './github.ts'
import * as conversion from './conversion.ts'
import { RateLimit } from './rateLimit.ts'

const PORT = Number(process.env.PORT ?? 3000)
const DIST = resolve(import.meta.dirname, '../dist')
const MINUTE = 60 * 1000
const FULL_SHA = /^[0-9a-f]{40}$/
// Bearer tokens for apps (Fabricate, Half Life) that convert on behalf of their own reviewers.
const CONVERT_TOKENS = (process.env.CONVERT_TOKENS ?? '')
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean)
  .map(digest)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pfb': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const index = existsSync(join(DIST, 'index.html')) ? readFileSync(join(DIST, 'index.html'), 'utf8') : null
const csp = index ? contentSecurityPolicy(index) : ''

const limits = {
  api: new RateLimit(240, MINUTE),
  convert: new RateLimit(20, 60 * MINUTE),
}

createServer((req, res) => {
  handle(req, res).catch((error) => {
    log('request_error', { url: req.url, error: error instanceof Error ? error.message : String(error) })
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong on the server.' })
    else res.destroy()
  })
}).listen(PORT, () => log('listening', { port: PORT, converter: conversion.converter() ?? null }))

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (url.pathname === '/up') return text(res, 200, 'ok')
  if (url.pathname.startsWith('/api/')) return api(req, res, url)
  if (req.method !== 'GET' && req.method !== 'HEAD') return text(res, 405, 'Method not allowed')
  return serveStatic(req, res, url)
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  const match = url.pathname.match(
    /^\/api\/repos\/([^/]+)\/([^/]+)(?:\/(commits|compare|convert|converted|attachment))?$/,
  )
  if (!match) return json(res, 404, { error: 'Not found.' })
  const [, owner, name, action = 'files'] = match
  const method = action === 'convert' ? 'POST' : 'GET'
  if (req.method !== method && !(method === 'GET' && req.method === 'HEAD'))
    return json(res, 405, { error: 'Method not allowed.' })

  const ip = clientIp(req)
  const converting = action === 'convert' || action === 'converted'
  const trusted = converting && trustedCaller(req)
  if (converting && !trusted && req.headers.authorization)
    return json(res, 401, { error: 'FART does not recognise the token this app sent.' })
  if (!trusted && !limits.api.allow(ip)) return json(res, 429, { error: 'Too many requests, slow down.' })

  const repo = `${safeDecode(owner)}/${safeDecode(name)}`
  if (!validRepo(repo)) return json(res, 404, { error: "That isn't a GitHub repository." })
  const files = new RepoFiles(repo)
  if (!(await files.isPublic())) return json(res, 404, { error: 'Only public GitHub repositories can be opened here.' })

  switch (action) {
    case 'files':
      return found(res, await files.snapshot())
    case 'commits': {
      const history = await files.commits()
      return history ? json(res, 200, { ...history, ships: [] }) : found(res, null)
    }
    case 'compare':
      return found(res, await files.compare(url.searchParams.get('base') ?? '', url.searchParams.get('head') ?? ''))
    case 'attachment': {
      const target = await files.attachmentUrl(url.searchParams.get('path') ?? '', url.searchParams.get('id') ?? '')
      if (!target) return text(res, 404, 'Not found')
      res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' })
      return res.end()
    }
    case 'convert':
    case 'converted':
      return convertAction(res, files, url, action, ip, trusted)
  }
}

// Trusted callers have already checked the file and commit against their own snapshot, which
// can be a minute apart from this one, so they may name any full commit SHA.
async function convertAction(
  res: ServerResponse,
  files: RepoFiles,
  url: URL,
  action: string,
  ip: string,
  trusted: boolean,
) {
  const path = url.searchParams.get('path') ?? ''
  const sha = url.searchParams.get('sha') ?? ''
  if (action === 'convert' && !conversion.converter())
    return json(res, 503, { error: "Converting models on the server isn't set up here." })
  if (!conversion.convertible(path)) return json(res, 422, { error: "That file can't be converted." })
  if (trusted) {
    if (!FULL_SHA.test(sha) || path.split('/').some((part) => part === '' || part === '.' || part === '..'))
      return json(res, 422, { error: "That file can't be converted." })
  } else {
    const snapshot = await files.snapshot()
    if (!snapshot?.files.some((f) => f.path === path)) return json(res, 422, { error: "That file can't be converted." })
    if (snapshot.sha !== sha)
      return json(res, 409, {
        error: 'The repository changed since this page loaded. Reload it to convert the latest version.',
      })
  }

  if (action === 'convert') {
    const current = conversion.status(files.repo, sha, path)
    if (!current && !trusted && !limits.convert.allow(ip))
      return json(res, 429, { error: 'You have converted a lot of models recently. Try again later.' })
    const result = conversion.start(files.repo, sha, path, trusted)
    return json(res, 'error' in result ? 503 : 200, result)
  }

  const done = conversion.converted(files.repo, sha, path)
  if (!done) return json(res, 404, { error: "This model hasn't been converted yet." })
  res.writeHead(200, {
    'Content-Type': 'model/gltf-binary',
    'Content-Length': String(done.size),
    'Cache-Control': 'private, max-age=86400',
  })
  createReadStream(done.file).pipe(res)
}

function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL) {
  const path = safeDecode(url.pathname)
  const file = normalize(join(DIST, path))
  if (path !== '/' && file.startsWith(DIST + sep) && existsSync(file) && statSync(file).isFile()) {
    const immutable = path.startsWith('/assets/')
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(statSync(file).size),
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    })
    if (req.method === 'HEAD') return res.end()
    return createReadStream(file).pipe(res)
  }
  if (path.startsWith('/assets/')) return text(res, 404, 'Not found')
  if (!index) return text(res, 503, 'The app has not been built. Run npm run build.')
  res.writeHead(200, {
    'Content-Type': TYPES['.html'],
    'Cache-Control': 'no-cache',
    'Content-Security-Policy': csp,
  })
  res.end(req.method === 'HEAD' ? undefined : index)
}

// Worker scripts and wasm under /assets are served without a CSP, which is what lets the
// OpenCascade worker use eval (Emscripten embind) while the page itself cannot.
function contentSecurityPolicy(html: string) {
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
  )
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'wasm-unsafe-eval' ${inline.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    "font-src 'self' data: https://cdn.fontshare.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' blob: https://raw.githubusercontent.com https://media.githubusercontent.com",
  ].join('; ')
}

function trustedCaller(req: IncomingMessage) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ') || CONVERT_TOKENS.length === 0) return false
  const given = digest(header.slice('Bearer '.length).trim())
  return CONVERT_TOKENS.some((token) => timingSafeEqual(given, token))
}

function digest(value: string) {
  return createHash('sha256').update(value).digest()
}

function clientIp(req: IncomingMessage) {
  const header = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for']
  const value = Array.isArray(header) ? header[0] : header
  return value?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
}

function found(res: ServerResponse, data: unknown) {
  if (data) return json(res, 200, data)
  return json(res, 404, { error: "Couldn't read this repository from GitHub." })
}

function json(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': TYPES['.json'],
    'Content-Length': String(Buffer.byteLength(body)),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function text(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { 'Content-Type': TYPES['.txt'], 'Cache-Control': 'no-store' })
  res.end(body)
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
