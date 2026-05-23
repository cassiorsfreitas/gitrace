import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { GitWatcher } from '../GitWatcher'

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gitrace-watcher-test-'))
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
  return dir
}

function writeFile(dir: string, name: string, content: string): void {
  writeFileSync(join(dir, name), content, 'utf-8')
}

/** Resolves with the event args when the event fires, rejects on timeout. */
function waitForEvent(
  emitter: GitWatcher,
  event: string,
  timeoutMs = 2000
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for '${event}'`)),
      timeoutMs
    )
    emitter.once(event, (...args: unknown[]) => {
      clearTimeout(timer)
      resolve(args)
    })
  })
}

/** Asserts that `event` does NOT fire within `waitMs` milliseconds. */
function assertNoEvent(emitter: GitWatcher, event: string, waitMs = 600): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (): void => reject(new Error(`Unexpected event: ${event}`))
    emitter.once(event, handler)
    setTimeout(() => {
      emitter.removeListener(event, handler)
      resolve()
    }, waitMs)
  })
}

describe('GitWatcher', () => {
  let dir: string
  let watcher: GitWatcher

  beforeEach(() => {
    dir = makeRepo()
    watcher = new GitWatcher(300)
  })

  afterEach(async () => {
    watcher.destroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits changed with repoPath when a file is written', async () => {
    await watcher.watch(dir)
    const eventPromise = waitForEvent(watcher, 'changed')
    writeFile(dir, 'hello.txt', 'content')
    const [repoPath] = await eventPromise
    expect(repoPath).toBe(dir)
  })

  it('debounces rapid successive writes into a single changed event', async () => {
    await watcher.watch(dir)

    const spy = vi.fn()
    watcher.on('changed', spy)

    // Write five files in rapid succession (well within 300 ms debounce)
    writeFile(dir, 'a.txt', '1')
    writeFile(dir, 'b.txt', '2')
    writeFile(dir, 'c.txt', '3')
    writeFile(dir, 'd.txt', '4')
    writeFile(dir, 'e.txt', '5')

    // Wait for debounce to settle (300 ms) plus a buffer
    await new Promise((r) => setTimeout(r, 800))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('stops emitting events after unwatch', async () => {
    await watcher.watch(dir)

    // Verify it works first
    const firstEvent = waitForEvent(watcher, 'changed')
    writeFile(dir, 'before.txt', 'data')
    await firstEvent

    // Now unwatch and confirm no further events
    watcher.unwatch(dir)
    writeFile(dir, 'after.txt', 'data')
    await assertNoEvent(watcher, 'changed')
  })

  it('watches multiple repos simultaneously without interference', async () => {
    const dir2 = makeRepo()
    try {
      const watcher2 = new GitWatcher(300)
      await watcher.watch(dir)
      await watcher2.watch(dir2)

      const event1 = waitForEvent(watcher, 'changed')
      const event2 = waitForEvent(watcher2, 'changed')

      writeFile(dir, 'repo1.txt', 'x')
      writeFile(dir2, 'repo2.txt', 'y')

      const [[path1], [path2]] = await Promise.all([event1, event2])
      expect(path1).toBe(dir)
      expect(path2).toBe(dir2)

      watcher2.destroy()
    } finally {
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('watch() is idempotent — calling it twice does not double-fire events', async () => {
    await watcher.watch(dir)
    await watcher.watch(dir) // second call should be a no-op

    const spy = vi.fn()
    watcher.on('changed', spy)

    writeFile(dir, 'x.txt', 'v')
    await new Promise((r) => setTimeout(r, 800))
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
