export type Scheme = 'dark' | 'light'

export interface ColorToken {
  name: string
  label: string
  hint: string
}

export const COLOR_TOKENS: ColorToken[] = [
  { name: '--color-ground', label: 'Background', hint: 'Panels and toolbars' },
  { name: '--color-ink', label: 'Wells', hint: 'Code, file previews, canvases' },
  { name: '--color-deep', label: 'Raised', hint: 'Boards and raised surfaces' },
  { name: '--color-mid', label: 'Lines', hint: 'Borders and dividers' },
  { name: '--color-mat-line', label: 'Grid', hint: 'Grid lines behind models' },
  { name: '--color-bone', label: 'Text', hint: 'Body text and active fills' },
  { name: '--color-paper', label: 'Strong text', hint: 'Titles, links, hovered rows' },
  { name: '--color-onwhite', label: 'Text on fills', hint: 'Text on active buttons' },
  { name: '--color-grey-1', label: 'Soft text', hint: 'Code and secondary text' },
  { name: '--color-grey-2', label: 'Muted text', hint: 'Labels and inactive tabs' },
  { name: '--color-grey-3', label: 'Faint text', hint: 'Metadata and hints' },
  { name: '--color-ok', label: 'Good', hint: 'Added lines, finished work' },
  { name: '--color-warn', label: 'Warning', hint: 'Things to check' },
  { name: '--color-red-soft', label: 'Problem', hint: 'Removed lines, failures' },
  { name: '--color-hc-red', label: 'Alert', hint: 'Errors and the brand mark' },
]

export type Colors = Record<string, string>

export interface Theme {
  id: string
  label: string
  scheme: Scheme
  colors: Colors
}

export const PRESETS: Theme[] = [
  {
    id: 'fabricate',
    label: 'Fabricate',
    scheme: 'dark',
    colors: {
      '--color-ground': '#071d1a',
      '--color-ink': '#04110f',
      '--color-deep': '#0c322c',
      '--color-mid': '#135349',
      '--color-mat-line': '#1e5c52',
      '--color-bone': '#edf7f6',
      '--color-paper': '#ffffff',
      '--color-onwhite': '#0d2f2d',
      '--color-grey-1': '#d7dbda',
      '--color-grey-2': '#bcc2c1',
      '--color-grey-3': '#949e9d',
      '--color-ok': '#33d6a6',
      '--color-warn': '#f1c40f',
      '--color-red-soft': '#cf8a94',
      '--color-hc-red': '#ec3750',
    },
  },
  {
    id: 'hack-club',
    label: 'Hack Club',
    scheme: 'dark',
    colors: {
      '--color-ground': '#17171d',
      '--color-ink': '#121217',
      '--color-deep': '#252429',
      '--color-mid': '#3c4858',
      '--color-mat-line': '#273444',
      '--color-bone': '#e0e6ed',
      '--color-paper': '#ffffff',
      '--color-onwhite': '#17171d',
      '--color-grey-1': '#d2d9e2',
      '--color-grey-2': '#aeb8c6',
      '--color-grey-3': '#8492a6',
      '--color-ok': '#33d6a6',
      '--color-warn': '#f1c40f',
      '--color-red-soft': '#f07d8f',
      '--color-hc-red': '#ec3750',
    },
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    scheme: 'dark',
    colors: {
      '--color-ground': '#0b2545',
      '--color-ink': '#071a33',
      '--color-deep': '#13315c',
      '--color-mid': '#2a4f7f',
      '--color-mat-line': '#1d3f6e',
      '--color-bone': '#e8f1fb',
      '--color-paper': '#ffffff',
      '--color-onwhite': '#0b2545',
      '--color-grey-1': '#c9d8ea',
      '--color-grey-2': '#a3b8d1',
      '--color-grey-3': '#7f99b9',
      '--color-ok': '#5fd3a5',
      '--color-warn': '#f4d35e',
      '--color-red-soft': '#e8899a',
      '--color-hc-red': '#ef476f',
    },
  },
  {
    id: 'solder-mask',
    label: 'Solder mask',
    scheme: 'dark',
    colors: {
      '--color-ground': '#13261a',
      '--color-ink': '#0b170f',
      '--color-deep': '#1d3a27',
      '--color-mid': '#2f5a3d',
      '--color-mat-line': '#264a32',
      '--color-bone': '#f2eda1',
      '--color-paper': '#fffbd6',
      '--color-onwhite': '#13261a',
      '--color-grey-1': '#ddd9a0',
      '--color-grey-2': '#bcb98f',
      '--color-grey-3': '#97967a',
      '--color-ok': '#6ee7a8',
      '--color-warn': '#f5b041',
      '--color-red-soft': '#e59a8c',
      '--color-hc-red': '#ec3750',
    },
  },
  {
    id: 'paper',
    label: 'Paper',
    scheme: 'light',
    colors: {
      '--color-ground': '#f9fafc',
      '--color-ink': '#eef1f5',
      '--color-deep': '#e0e6ed',
      '--color-mid': '#c3ccd7',
      '--color-mat-line': '#d8dee6',
      '--color-bone': '#1f2d3d',
      '--color-paper': '#0d1520',
      '--color-onwhite': '#ffffff',
      '--color-grey-1': '#2f3d4f',
      '--color-grey-2': '#4f5d6e',
      '--color-grey-3': '#6b788a',
      '--color-ok': '#11795a',
      '--color-warn': '#8a6d00',
      '--color-red-soft': '#b4233a',
      '--color-hc-red': '#d32741',
    },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    scheme: 'dark',
    colors: {
      '--color-ground': '#000000',
      '--color-ink': '#000000',
      '--color-deep': '#1a1a1a',
      '--color-mid': '#7a7a7a',
      '--color-mat-line': '#3a3a3a',
      '--color-bone': '#ffffff',
      '--color-paper': '#ffffff',
      '--color-onwhite': '#000000',
      '--color-grey-1': '#f2f2f2',
      '--color-grey-2': '#d9d9d9',
      '--color-grey-3': '#bdbdbd',
      '--color-ok': '#00f0a8',
      '--color-warn': '#ffd400',
      '--color-red-soft': '#ff9a9a',
      '--color-hc-red': '#ff4d5e',
    },
  },
]

export const DEFAULT_THEME = PRESETS[0]
export const CUSTOM_ID = 'custom'
