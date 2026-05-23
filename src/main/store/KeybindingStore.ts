import { EventEmitter } from 'events'
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'fs'
import type { FSWatcher } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'

type Bindings = Record<string, string>

const DEFAULTS: Bindings = {
  nextLine: 'j',
  prevLine: 'k',
  nextFile: 'Ctrl+J',
  prevFile: 'Ctrl+K',
  commit: 'Cmd+Enter',
  toggleStage: 'Space',
  stepBack: 'Backspace',
  focusLeft: 'Ctrl+H',
  focusRight: 'Ctrl+L',
}

export class KeybindingStore extends EventEmitter {
  private configPath: string
  private bindings: Bindings
  private watcher: FSWatcher | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(configPath?: string) {
    super()
    this.configPath = configPath ?? join(homedir(), '.gitrace', 'keybindings.json')
    this.bindings = this.loadAndInit()
    this.startWatcher()
  }

  private loadAndInit(): Bindings {
    const dir = dirname(this.configPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    if (!existsSync(this.configPath)) {
      writeFileSync(this.configPath, JSON.stringify(DEFAULTS, null, 2), 'utf-8')
      return { ...DEFAULTS }
    }
    return this.parse()
  }

  private parse(): Bindings {
    try {
      const parsed = JSON.parse(readFileSync(this.configPath, 'utf-8'))
      return { ...DEFAULTS, ...parsed }
    } catch {
      return { ...DEFAULTS }
    }
  }

  private startWatcher(): void {
    const dir = dirname(this.configPath)
    const filename = basename(this.configPath)
    try {
      this.watcher = watch(dir, (_, changedFile) => {
        if (changedFile !== null && changedFile !== filename) return
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => {
          this.bindings = this.parse()
          this.emit('reload')
        }, 100)
      })
    } catch {
      // directory may not exist — tolerate silently
    }
  }

  getBinding(action: string): string {
    return this.bindings[action] ?? ''
  }

  getAll(): Bindings {
    return { ...this.bindings }
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.watcher?.close()
    this.watcher = null
  }
}
