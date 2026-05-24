const KEY_SYMBOLS: Record<string, string> = {
  Cmd: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Enter: '↩',
  Backspace: '⌫',
}

export function formatKeybind(binding: string): string {
  return binding
    .split('+')
    .map((part) => KEY_SYMBOLS[part] ?? part)
    .join('')
}
