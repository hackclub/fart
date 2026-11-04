import { useEffect, useRef, useState } from 'react'
import { COLOR_TOKENS, CUSTOM_ID, PRESETS, type Scheme, type Theme } from './themes'
import { contrast, customFrom, parseThemeCode, setTheme, themeCode, useTheme } from './store'

export default function ThemeButton() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="theme" ref={root}>
      <button
        type="button"
        className={open ? 'fart-button is-active' : 'fart-button'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Theme
      </button>
      {open && <ThemePanel />}
    </div>
  )
}

function ThemePanel() {
  const theme = useTheme()
  const [customizing, setCustomizing] = useState(theme.id === CUSTOM_ID)

  return (
    <section className="theme__panel" aria-label="Theme">
      <h2 className="theme__heading">Theme</h2>
      <div className="theme__presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={preset.id === theme.id ? 'theme__preset is-active' : 'theme__preset'}
            aria-pressed={preset.id === theme.id}
            onClick={() => setTheme(preset)}
          >
            <Swatches theme={preset} />
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={theme.id === CUSTOM_ID ? 'theme__preset is-active' : 'theme__preset'}
          aria-pressed={theme.id === CUSTOM_ID}
          onClick={() => {
            if (theme.id !== CUSTOM_ID) setTheme(customFrom(theme))
            setCustomizing(true)
          }}
        >
          <Swatches theme={theme} />
          Custom
        </button>
      </div>
      {customizing ? <CustomEditor theme={theme} /> : <ThemeCode theme={theme} />}
      {!customizing && (
        <button type="button" className="fart-link" onClick={() => setCustomizing(true)}>
          Customize colours
        </button>
      )}
    </section>
  )
}

function Swatches({ theme }: { theme: Theme }) {
  return (
    <span className="theme__swatches" aria-hidden="true">
      {['--color-ground', '--color-bone', '--color-mid', '--color-ok'].map((name) => (
        <span key={name} style={{ background: theme.colors[name] }} />
      ))}
    </span>
  )
}

function CustomEditor({ theme }: { theme: Theme }) {
  const change = (name: string, value: string) => setTheme(customFrom(theme, { [name]: value }))
  const scheme = (value: Scheme) => setTheme(customFrom(theme, {}, value))
  const text = contrast(theme.colors['--color-bone'], theme.colors['--color-ground'])
  const faint = contrast(theme.colors['--color-grey-3'], theme.colors['--color-ground'])

  return (
    <div className="theme__custom">
      <fieldset className="theme__scheme">
        <legend>Browser controls</legend>
        {(['dark', 'light'] as const).map((value) => (
          <label key={value}>
            <input type="radio" name="scheme" checked={theme.scheme === value} onChange={() => scheme(value)} />
            {value === 'dark' ? 'Dark' : 'Light'}
          </label>
        ))}
      </fieldset>
      <div className="theme__colors">
        {COLOR_TOKENS.map((token) => (
          <label key={token.name} className="theme__color" title={token.hint}>
            <input type="color" value={theme.colors[token.name]} onChange={(e) => change(token.name, e.target.value)} />
            <span>
              {token.label}
              <small>{token.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="theme__contrast">
        Text on background <Ratio value={text} min={4.5} /> · Faint text <Ratio value={faint} min={3} />
      </p>
      <ThemeCode theme={theme} />
    </div>
  )
}

function Ratio({ value, min }: { value: number; min: number }) {
  return (
    <strong
      className={value < min ? 'is-low' : undefined}
      title={value < min ? `Below ${min}:1, hard to read` : undefined}
    >
      {value.toFixed(1)}:1
    </strong>
  )
}

function ThemeCode({ theme }: { theme: Theme }) {
  const code = themeCode(theme)
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [code])
  const parsed = pasted.trim() ? parseThemeCode(pasted) : null

  return (
    <div className="theme__code">
      <label>
        Theme code
        <span className="theme__code-row">
          <input type="text" readOnly value={code} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="fart-button"
            onClick={() =>
              void navigator.clipboard.writeText(code).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </label>
      <form
        className="theme__code-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!parsed) return
          setTheme(parsed)
          setPasted('')
        }}
      >
        <input
          type="text"
          placeholder="Paste a theme code"
          aria-label="Paste a theme code"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button type="submit" className="fart-button" disabled={!parsed}>
          Use
        </button>
      </form>
      {pasted.trim() && !parsed && <p className="theme__error">That isn't a theme code.</p>}
    </div>
  )
}
