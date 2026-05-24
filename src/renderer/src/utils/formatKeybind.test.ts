import { describe, it, expect } from 'vitest'
import { formatKeybind } from './formatKeybind'

describe('formatKeybind', () => {
  it('maps Cmd to ⌘', () => {
    expect(formatKeybind('Cmd+K')).toBe('⌘K')
  })

  it('maps Ctrl to ⌃', () => {
    expect(formatKeybind('Ctrl+J')).toBe('⌃J')
  })

  it('maps Alt to ⌥', () => {
    expect(formatKeybind('Alt+F')).toBe('⌥F')
  })

  it('maps Shift to ⇧', () => {
    expect(formatKeybind('Shift+S')).toBe('⇧S')
  })

  it('maps Enter to ↩', () => {
    expect(formatKeybind('Enter')).toBe('↩')
  })

  it('maps Backspace to ⌫', () => {
    expect(formatKeybind('Backspace')).toBe('⌫')
  })

  it('handles multi-modifier combinations', () => {
    expect(formatKeybind('Cmd+Shift+P')).toBe('⌘⇧P')
  })

  it('handles Cmd+Enter combination', () => {
    expect(formatKeybind('Cmd+Enter')).toBe('⌘↩')
  })

  it('passes through unknown key names unchanged', () => {
    expect(formatKeybind('x')).toBe('x')
  })

  it('passes through single letter bindings unchanged', () => {
    expect(formatKeybind('j')).toBe('j')
  })

  it('handles Space key (not in symbol map) as-is', () => {
    expect(formatKeybind('Space')).toBe('Space')
  })
})
