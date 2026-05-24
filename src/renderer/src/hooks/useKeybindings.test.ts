import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useKeybindings } from './useKeybindings'

describe('useKeybindings / getBinding', () => {
  beforeEach(() => {
    vi.mocked(window.electron.ipcRenderer.invoke).mockReset()
    vi.mocked(window.electron.ipcRenderer.on).mockReset()
    vi.mocked(window.electron.ipcRenderer.removeListener).mockReset()
  })

  it('returns the default binding for a known action before ipc resolves', () => {
    // Never-resolving promise so state stays at DEFAULTS
    vi.mocked(window.electron.ipcRenderer.invoke).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useKeybindings())
    expect(result.current.getBinding('commit')).toBe('Cmd+Enter')
    expect(result.current.getBinding('nextLine')).toBe('j')
    expect(result.current.getBinding('openCommandPalette')).toBe('Cmd+K')
  })

  it('returns undefined for an unknown action', () => {
    vi.mocked(window.electron.ipcRenderer.invoke).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useKeybindings())
    expect(result.current.getBinding('nonexistentAction')).toBeUndefined()
  })

  it('returns an overridden binding after ipc resolves', async () => {
    vi.mocked(window.electron.ipcRenderer.invoke).mockResolvedValue({
      commit: 'Ctrl+Enter',
      nextLine: 'j',
    })
    const { result } = renderHook(() => useKeybindings())
    await waitFor(() => {
      expect(result.current.getBinding('commit')).toBe('Ctrl+Enter')
    })
  })

  it('keeps defaults when ipc rejects', async () => {
    vi.mocked(window.electron.ipcRenderer.invoke).mockRejectedValue(new Error('ipc error'))
    const { result } = renderHook(() => useKeybindings())
    // Give the rejection a chance to settle
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.getBinding('commit')).toBe('Cmd+Enter')
  })
})
