import { EventEmitter } from 'events'
import chokidar, { type FSWatcher } from 'chokidar'
import { join, sep } from 'path'

/**
 * Watches one or more git repository working directories for file changes.
 *
 * Wraps chokidar and debounces rapid saves into a single `changed` event.
 * Multiple repos can be watched simultaneously without interference.
 *
 * Events:
 *   'changed' (repoPath: string) — emitted after debounce when any tracked
 *                                  file in the repo changes.
 */
export class GitWatcher extends EventEmitter {
  private readonly watchers = new Map<string, FSWatcher>()
  private readonly gitStateWatchers = new Map<string, FSWatcher>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly debounceMs: number

  constructor(debounceMs = 300) {
    super()
    this.debounceMs = debounceMs
  }

  /**
   * Start watching `repoPath`. No-op if already watching.
   * Returns a promise that resolves once chokidar is ready to detect changes.
   */
  watch(repoPath: string): Promise<void> {
    if (this.watchers.has(repoPath)) return Promise.resolve()

    const gitDir = join(repoPath, '.git')

    const schedule = (): void => {
      const existing = this.timers.get(repoPath)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        this.timers.delete(repoPath)
        this.emit('changed', repoPath)
      }, this.debounceMs)
      this.timers.set(repoPath, timer)
    }

    // Watch working-tree files (excludes .git and node_modules)
    const watcher = chokidar.watch(repoPath, {
      ignored: (filePath: string) => {
        if (filePath.includes('node_modules')) return true
        // Ignore .git directory and all its contents
        if (filePath === gitDir || filePath.startsWith(gitDir + sep)) return true
        return false
      },
      ignoreInitial: true,
      persistent: true
    })

    watcher.on('add', schedule)
    watcher.on('change', schedule)
    watcher.on('unlink', schedule)

    this.watchers.set(repoPath, watcher)

    // Watch git state files so staging, commits, and branch switches are detected
    const gitStateWatcher = chokidar.watch(
      [
        join(gitDir, 'index'),
        join(gitDir, 'HEAD'),
        join(gitDir, 'refs'),
        join(gitDir, 'MERGE_HEAD'),
        join(gitDir, 'CHERRY_PICK_HEAD'),
      ],
      { ignoreInitial: true, persistent: true }
    )

    gitStateWatcher.on('add', schedule)
    gitStateWatcher.on('change', schedule)
    gitStateWatcher.on('unlink', schedule)

    this.gitStateWatchers.set(repoPath, gitStateWatcher)

    return new Promise((resolve) => watcher.on('ready', resolve))
  }

  /**
   * Stop watching `repoPath` and cancel any pending debounce timer.
   */
  unwatch(repoPath: string): void {
    const timer = this.timers.get(repoPath)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(repoPath)
    }
    const watcher = this.watchers.get(repoPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(repoPath)
    }
    const gitStateWatcher = this.gitStateWatchers.get(repoPath)
    if (gitStateWatcher) {
      gitStateWatcher.close()
      this.gitStateWatchers.delete(repoPath)
    }
  }

  /**
   * Stop all watchers and cancel pending timers. Call on app quit.
   */
  destroy(): void {
    for (const repoPath of Array.from(this.watchers.keys())) {
      this.unwatch(repoPath)
    }
  }
}
