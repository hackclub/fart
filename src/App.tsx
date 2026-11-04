import { lazy, Suspense, useEffect, useState } from 'react'
import ThemeButton from './theme/ThemePanel'
import { repoFrom, repoFromLocation, repoPath } from './repo'

const Hurt = lazy(() => import('./hurt'))

const SOURCE_URL = 'https://github.com/hackclub/fart'

function navigate(repo: string | null) {
  const path = repo ? repoPath(repo) : '/'
  if (location.pathname + location.search !== path) history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function useRepo() {
  const [repo, setRepo] = useState(() => repoFromLocation(location))
  useEffect(() => {
    const change = () => setRepo(repoFromLocation(location))
    window.addEventListener('popstate', change)
    return () => window.removeEventListener('popstate', change)
  }, [])
  useEffect(() => {
    if (repo && location.pathname !== repoPath(repo)) history.replaceState(null, '', repoPath(repo))
    document.title = repo ? `${repo} · FART` : 'FART'
  }, [repo])
  return repo
}

function RepoPicker({ initial, collapsible }: { initial: string; collapsible: boolean }) {
  const [open, setOpen] = useState(!collapsible)
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  if (!open)
    return (
      <button type="button" className="fart-button" onClick={() => setOpen(true)}>
        Open repo
      </button>
    )
  return (
    <form
      className="repo-picker"
      onSubmit={(e) => {
        e.preventDefault()
        const repo = repoFrom(value)
        if (!repo) return setError("That isn't a GitHub repository link.")
        setError(null)
        if (collapsible) setOpen(false)
        navigate(repo)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && collapsible) setOpen(false)
      }}
    >
      <input
        type="text"
        inputMode="url"
        placeholder="GitHub repository link"
        aria-label="GitHub repository link"
        autoFocus
        value={value}
        onFocus={(e) => value === initial && e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="fart-button">
        Open
      </button>
      {error && <span className="repo-picker__error">{error}</span>}
    </form>
  )
}

function HomeLink() {
  return (
    <a
      href="/"
      className="fart-button fart-home"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(null)
      }}
    >
      FART
    </a>
  )
}

export default function App() {
  const repo = useRepo()

  if (repo)
    return (
      <div className="repo-viewer">
        <Suspense fallback={<p className="repo-viewer__empty">Loading the file viewer…</p>}>
          <Hurt
            key={repo}
            repo={repo}
            tools={
              <>
                <HomeLink />
                <RepoPicker initial={repo} collapsible />
                <ThemeButton />
              </>
            }
          />
        </Suspense>
      </div>
    )

  return (
    <main className="home">
      <div className="home__theme">
        <ThemeButton />
      </div>
      <h1 className="home__title">FART</h1>
      <p className="home__name">Fabricate Awesome Review Tool</p>
      <p className="home__lead">
        Paste a public GitHub repository link to browse its CAD models, PCBs, schematics and documents in the browser.
      </p>
      <RepoPicker initial="" collapsible={false} />
      <footer className="home__footer">
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
        <span>·</span>
        <a href="https://hackclub.com" target="_blank" rel="noopener noreferrer">
          Hack Club
        </a>
      </footer>
    </main>
  )
}
