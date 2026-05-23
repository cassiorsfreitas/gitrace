import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { KeybindingStore } from '../KeybindingStore'

describe('KeybindingStore', () => {
  let tmpDir: string
  let configPath: string
  let store: KeybindingStore

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gitrace-kb-test-'))
    configPath = join(tmpDir, 'keybindings.json')
    store = new KeybindingStore(configPath)
  })

  afterEach(() => {
    store.destroy()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns defaults when no config file exists before construction', () => {
    // store was created with a path that did not exist — defaults are returned
    expect(store.getBinding('nextLine')).toBe('j')
    expect(store.getBinding('prevLine')).toBe('k')
    expect(store.getBinding('nextFile')).toBe('Ctrl+J')
    expect(store.getBinding('prevFile')).toBe('Ctrl+K')
    expect(store.getBinding('commit')).toBe('Cmd+Enter')
    expect(store.getBinding('toggleStage')).toBe('Space')
  })

  it('creates the config file with defaults on first launch', () => {
    expect(existsSync(configPath)).toBe(true)
    const content = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(content.nextLine).toBe('j')
    expect(content.commit).toBe('Cmd+Enter')
  })

  it('overrides a default with a custom binding', () => {
    writeFileSync(configPath, JSON.stringify({ nextLine: 'n' }), 'utf-8')
    const store2 = new KeybindingStore(configPath)
    expect(store2.getBinding('nextLine')).toBe('n')
    expect(store2.getBinding('prevLine')).toBe('k') // default preserved
    store2.destroy()
  })

  it('supports a fully custom binding set', () => {
    const custom = {
      nextLine: 'n',
      prevLine: 'p',
      nextFile: 'Ctrl+N',
      prevFile: 'Ctrl+P',
      commit: 'Ctrl+Enter',
      toggleStage: 's'
    }
    writeFileSync(configPath, JSON.stringify(custom), 'utf-8')
    const store2 = new KeybindingStore(configPath)
    for (const [action, key] of Object.entries(custom)) {
      expect(store2.getBinding(action)).toBe(key)
    }
    store2.destroy()
  })

  it('surfaces keys not present in defaults', () => {
    writeFileSync(configPath, JSON.stringify({ customAction: 'x' }), 'utf-8')
    const store2 = new KeybindingStore(configPath)
    expect(store2.getBinding('customAction')).toBe('x')
    store2.destroy()
  })

  it('returns empty string for unknown actions', () => {
    expect(store.getBinding('doesNotExist')).toBe('')
  })

  it('emits reload and returns updated binding after file change', async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('reload event timed out')), 2000)
      store.once('reload', () => {
        clearTimeout(timeout)
        resolve()
      })
      writeFileSync(configPath, JSON.stringify({ nextLine: 'n' }), 'utf-8')
    })
    expect(store.getBinding('nextLine')).toBe('n')
    expect(store.getBinding('prevLine')).toBe('k') // defaults still merged
  })
})
