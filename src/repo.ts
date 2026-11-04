const REPO = /^[A-Za-z0-9-]+\/(?!\.\.?$)[A-Za-z0-9._-]+$/
const GITHUB_URL =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/(?!\.\.?(?:\.git)?(?:[/?#]|$))([A-Za-z0-9._-]+?)(?:\.git)?(?=[/?#]|$)/i

export function repoFrom(input: string): string | null {
  const text = input.trim()
  if (REPO.test(text)) return text
  const match = (/^(www\.)?github\.com\//i.test(text) ? `https://${text}` : text).match(GITHUB_URL)
  return match ? `${match[1]}/${match[2]}` : null
}

export function repoFromLocation(location: Location): string | null {
  const query = new URLSearchParams(location.search).get('repo')
  if (query) return repoFrom(query)
  const parts = location.pathname.split('/').filter(Boolean).map(decode)
  if (/^(www\.)?github\.com$/i.test(parts[0] ?? '')) parts.shift()
  const [owner, name] = parts
  return owner && name ? repoFrom(`${owner}/${name}`) : null
}

export function repoPath(repo: string) {
  return `/${repo.split('/').map(encodeURIComponent).join('/')}`
}

function decode(part: string) {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}
