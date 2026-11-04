import { useSyncExternalStore } from 'react'
import { THEME_EVENT } from '../hurt/ui/themeColor'
import { COLOR_TOKENS, CUSTOM_ID, DEFAULT_THEME, PRESETS, type Colors, type Scheme, type Theme } from './themes'

const STORAGE_KEY = 'fart:theme'
const HEX = /^#[0-9a-f]{6}$/

let current = load()
const listeners = new Set<() => void>()

export function useTheme() {
  return useSyncExternalStore(subscribe, () => current)
}

export function setTheme(theme: Theme) {
  current = theme
  apply(theme)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: theme.id, scheme: theme.scheme, colors: theme.colors }))
  } catch {
    // Private windows can refuse storage; the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener())
}

export function startTheme() {
  apply(current)
}

export function customFrom(theme: Theme, changes: Partial<Colors> = {}, scheme = theme.scheme): Theme {
  return { id: CUSTOM_ID, label: 'Custom', scheme, colors: { ...theme.colors, ...changes } as Colors }
}

export function themeCode(theme: Theme) {
  return `${theme.scheme}:${COLOR_TOKENS.map((t) => theme.colors[t.name].slice(1)).join(',')}`
}

export function parseThemeCode(code: string): Theme | null {
  const match = code
    .trim()
    .toLowerCase()
    .match(/^(dark|light):([0-9a-f,]+)$/)
  if (!match) return null
  const values = match[2].split(',')
  if (values.length !== COLOR_TOKENS.length || values.some((v) => !/^[0-9a-f]{6}$/.test(v))) return null
  const colors = Object.fromEntries(COLOR_TOKENS.map((t, i) => [t.name, `#${values[i]}`]))
  return customFrom(DEFAULT_THEME, colors, match[1] as Scheme)
}

export function contrast(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function apply(theme: Theme) {
  const root = document.documentElement
  for (const token of COLOR_TOKENS) root.style.setProperty(token.name, theme.colors[token.name])
  root.style.colorScheme = theme.scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors['--color-ground'])
  window.dispatchEvent(new Event(THEME_EVENT))
}

function load(): Theme {
  let stored: { id?: unknown; scheme?: unknown; colors?: unknown } | null = null
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return DEFAULT_THEME
  }
  if (!stored || typeof stored !== 'object') return DEFAULT_THEME
  const preset = PRESETS.find((p) => p.id === stored.id)
  if (preset) return preset
  if (stored.id !== CUSTOM_ID || !stored.colors || typeof stored.colors !== 'object') return DEFAULT_THEME
  const saved = stored.colors as Record<string, unknown>
  const colors = Object.fromEntries(
    COLOR_TOKENS.map((t) => {
      const value = saved[t.name]
      return [t.name, typeof value === 'string' && HEX.test(value) ? value : DEFAULT_THEME.colors[t.name]]
    }),
  )
  return customFrom(DEFAULT_THEME, colors, stored.scheme === 'light' ? 'light' : 'dark')
}
