import { useCallback, useEffect, useState } from 'react'

const DEFAULTS: Record<string, string> = {
  nextLine: 'j',
  prevLine: 'k',
  nextFile: 'Ctrl+J',
  prevFile: 'Ctrl+K',
  commit: 'Cmd+Enter',
  toggleStage: 'Space',
  stepBack: 'Backspace',
  focusLeft: 'Ctrl+H',
  focusRight: 'Ctrl+L',
  openInEditor: 'o',
  openCommandPalette: 'Cmd+K',
  openKeybindingsFile: 'Cmd+,',
}

function normalizeKey(key: string): string {
  if (key === 'Space') return ' '
  return key.toLowerCase()
}

function matchesBinding(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.split('+')
  const key = normalizeKey(parts[parts.length - 1])
  const hasCtrl = parts.includes('Ctrl')
  const hasCmd = parts.includes('Cmd')
  const hasAlt = parts.includes('Alt')
  const hasShift = parts.includes('Shift')
  return (
    e.key.toLowerCase() === key &&
    e.ctrlKey === hasCtrl &&
    e.metaKey === hasCmd &&
    e.altKey === hasAlt &&
    e.shiftKey === hasShift
  )
}

export function useKeybindings(): {
  matches: (e: KeyboardEvent, action: string) => boolean
  getBinding: (action: string) => string | undefined
} {
  const [bindings, setBindings] = useState<Record<string, string>>(DEFAULTS)

  useEffect(() => {
    window.electron.ipcRenderer
      .invoke('keybindings:getAll', {})
      .then((b: unknown) => setBindings(b as Record<string, string>))
      .catch(() => {})

    const handler = (_: unknown, b: Record<string, string>): void => setBindings(b)
    window.electron.ipcRenderer.on('keybindings:changed', handler)
    return (): void => {
      window.electron.ipcRenderer.removeListener('keybindings:changed', handler)
    }
  }, [])

  const matches = useCallback(
    (e: KeyboardEvent, action: string): boolean => {
      const binding = bindings[action]
      if (!binding) return false
      return matchesBinding(e, binding)
    },
    [bindings],
  )

  const getBinding = useCallback(
    (action: string): string | undefined => {
      return bindings[action]
    },
    [bindings],
  )

  return { matches, getBinding }
}
