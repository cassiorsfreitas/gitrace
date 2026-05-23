import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { GitService } from '../GitService'

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gitrace-git-test-'))
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
  return dir
}

function writeFile(dir: string, name: string, content: string): void {
  writeFileSync(join(dir, name), content, 'utf-8')
}

describe('GitService', () => {
  let dir: string
  let svc: GitService

  beforeEach(() => {
    dir = makeRepo()
    svc = new GitService()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe('getStatus()', () => {
    it('returns empty lists for a clean repo', async () => {
      // commit an initial file so HEAD exists
      writeFile(dir, 'init.txt', 'init')
      execSync('git add init.txt && git commit -m "init"', { cwd: dir })

      const status = await svc.getStatus(dir)
      expect(status.staged).toEqual([])
      expect(status.unstaged).toEqual([])
    })

    it('returns staged files for staged-only changes', async () => {
      writeFile(dir, 'init.txt', 'init')
      execSync('git add init.txt && git commit -m "init"', { cwd: dir })

      writeFile(dir, 'staged.txt', 'new file')
      execSync('git add staged.txt', { cwd: dir })

      const status = await svc.getStatus(dir)
      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('staged.txt')
      expect(status.staged[0].status).toBe('A')
      expect(status.unstaged).toEqual([])
    })

    it('returns unstaged files for unstaged-only changes', async () => {
      writeFile(dir, 'file.txt', 'original')
      execSync('git add file.txt && git commit -m "init"', { cwd: dir })

      writeFile(dir, 'file.txt', 'modified')

      const status = await svc.getStatus(dir)
      expect(status.unstaged).toHaveLength(1)
      expect(status.unstaged[0].path).toBe('file.txt')
      expect(status.unstaged[0].status).toBe('M')
      expect(status.staged).toEqual([])
    })

    it('returns both staged and unstaged for mixed changes', async () => {
      writeFile(dir, 'a.txt', 'a')
      writeFile(dir, 'b.txt', 'b')
      execSync('git add . && git commit -m "init"', { cwd: dir })

      writeFile(dir, 'a.txt', 'a modified')
      execSync('git add a.txt', { cwd: dir })

      writeFile(dir, 'b.txt', 'b modified')

      const status = await svc.getStatus(dir)
      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('a.txt')
      expect(status.staged[0].status).toBe('M')
      expect(status.unstaged).toHaveLength(1)
      expect(status.unstaged[0].path).toBe('b.txt')
      expect(status.unstaged[0].status).toBe('M')
    })
  })

  describe('getStagedDiff()', () => {
    it('returns empty string for a clean repo', async () => {
      writeFile(dir, 'init.txt', 'init')
      execSync('git add init.txt && git commit -m "init"', { cwd: dir })

      const diff = await svc.getStagedDiff(dir)
      expect(diff).toBe('')
    })

    it('returns diff only for staged changes', async () => {
      writeFile(dir, 'file.txt', 'original\n')
      execSync('git add file.txt && git commit -m "init"', { cwd: dir })

      writeFile(dir, 'file.txt', 'modified\n')
      execSync('git add file.txt', { cwd: dir })

      // also create an unstaged file that must NOT appear
      writeFile(dir, 'other.txt', 'unstaged\n')

      const diff = await svc.getStagedDiff(dir)
      expect(diff).toContain('file.txt')
      expect(diff).not.toContain('other.txt')
    })
  })

  describe('getUnstagedDiff()', () => {
    it('returns empty string for a clean repo', async () => {
      writeFile(dir, 'init.txt', 'init')
      execSync('git add init.txt && git commit -m "init"', { cwd: dir })

      const diff = await svc.getUnstagedDiff(dir)
      expect(diff).toBe('')
    })

    it('returns diff only for unstaged changes', async () => {
      writeFile(dir, 'file.txt', 'original\n')
      execSync('git add file.txt && git commit -m "init"', { cwd: dir })

      writeFile(dir, 'file.txt', 'modified\n')

      // also stage a different file that must NOT appear in unstaged diff
      writeFile(dir, 'staged.txt', 'staged\n')
      execSync('git add staged.txt', { cwd: dir })

      const diff = await svc.getUnstagedDiff(dir)
      expect(diff).toContain('file.txt')
      expect(diff).not.toContain('staged.txt')
    })
  })

  describe('stageFile()', () => {
    it('moves an unstaged file into the staged list', async () => {
      writeFile(dir, 'file.txt', 'original\n')
      execSync('git add file.txt && git commit -m "init"', { cwd: dir })
      writeFile(dir, 'file.txt', 'modified\n')

      await svc.stageFile(dir, 'file.txt')

      const status = await svc.getStatus(dir)
      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('file.txt')
      expect(status.unstaged).toEqual([])
    })

    it('stages a new untracked file', async () => {
      writeFile(dir, 'init.txt', 'init')
      execSync('git add init.txt && git commit -m "init"', { cwd: dir })
      writeFile(dir, 'new.txt', 'new\n')

      await svc.stageFile(dir, 'new.txt')

      const status = await svc.getStatus(dir)
      expect(status.staged.some((f) => f.path === 'new.txt')).toBe(true)
    })
  })

  describe('unstageFile()', () => {
    it('moves a staged file back to unstaged', async () => {
      writeFile(dir, 'file.txt', 'original\n')
      execSync('git add file.txt && git commit -m "init"', { cwd: dir })
      writeFile(dir, 'file.txt', 'modified\n')
      execSync('git add file.txt', { cwd: dir })

      await svc.unstageFile(dir, 'file.txt')

      const status = await svc.getStatus(dir)
      expect(status.staged).toEqual([])
      expect(status.unstaged).toHaveLength(1)
      expect(status.unstaged[0].path).toBe('file.txt')
    })

    it('does not affect other staged files', async () => {
      writeFile(dir, 'a.txt', 'a\n')
      writeFile(dir, 'b.txt', 'b\n')
      execSync('git add . && git commit -m "init"', { cwd: dir })
      writeFile(dir, 'a.txt', 'a modified\n')
      writeFile(dir, 'b.txt', 'b modified\n')
      execSync('git add a.txt b.txt', { cwd: dir })

      await svc.unstageFile(dir, 'a.txt')

      const status = await svc.getStatus(dir)
      expect(status.staged).toHaveLength(1)
      expect(status.staged[0].path).toBe('b.txt')
      expect(status.unstaged).toHaveLength(1)
      expect(status.unstaged[0].path).toBe('a.txt')
    })
  })

  describe('stageHunk()', () => {
    it('stages only the provided hunk, leaving other hunks unstaged', async () => {
      // Build a file large enough that two changes produce separate hunks.
      // Default diff context is 3 lines; changes must be >6 lines apart.
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
      writeFile(dir, 'file.txt', lines.join('\n') + '\n')
      execSync('git add file.txt && git commit -m "init"', { cwd: dir })

      // Modify line 1 and line 20 — 18 lines apart, guaranteed separate hunks
      const modified = [...lines]
      modified[0] = 'LINE1'
      modified[19] = 'LINE20'
      writeFile(dir, 'file.txt', modified.join('\n') + '\n')

      const fullDiff = await svc.getUnstagedDiff(dir)
      expect(fullDiff).toContain('LINE1')
      expect(fullDiff).toContain('LINE20')

      // Extract the first hunk (header + first @@ block only)
      const hunkMatch = fullDiff.match(/(diff --git [\s\S]*?@@[^\n]*\n(?:(?!@@)[^\n]*\n)*)/)
      expect(hunkMatch).not.toBeNull()
      const firstHunk = hunkMatch![1]

      await svc.stageHunk(dir, firstHunk)

      const stagedDiff = await svc.getStagedDiff(dir)
      const unstagedDiff = await svc.getUnstagedDiff(dir)

      // The first hunk is staged
      expect(stagedDiff).not.toBe('')
      // The second hunk remains unstaged
      expect(unstagedDiff).not.toBe('')
    })
  })

  describe('getLastCommitMessage()', () => {
    it('returns the message of the last commit', async () => {
      writeFile(dir, 'init.txt', 'init')
      execSync('git add init.txt && git commit -m "initial commit"', { cwd: dir })

      const msg = await svc.getLastCommitMessage(dir)
      expect(msg).toBe('initial commit')
    })
  })

  describe('amendCommit()', () => {
    it('replaces the last commit message', async () => {
      writeFile(dir, 'init.txt', 'init')
      execSync('git add init.txt && git commit -m "old message"', { cwd: dir })

      await svc.amendCommit(dir, 'new message')

      const msg = await svc.getLastCommitMessage(dir)
      expect(msg).toBe('new message')
    })
  })

  describe('unstageHunk()', () => {
    it('unstages only the provided hunk, leaving other hunks staged', async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
      writeFile(dir, 'file.txt', lines.join('\n') + '\n')
      execSync('git add file.txt && git commit -m "init"', { cwd: dir })

      const modified = [...lines]
      modified[0] = 'LINE1'
      modified[19] = 'LINE20'
      writeFile(dir, 'file.txt', modified.join('\n') + '\n')
      execSync('git add file.txt', { cwd: dir })

      const stagedDiff = await svc.getStagedDiff(dir)
      expect(stagedDiff).toContain('LINE1')
      expect(stagedDiff).toContain('LINE20')

      // Extract the first staged hunk
      const hunkMatch = stagedDiff.match(/(diff --git [\s\S]*?@@[^\n]*\n(?:(?!@@)[^\n]*\n)*)/)
      expect(hunkMatch).not.toBeNull()
      const firstHunk = hunkMatch![1]

      await svc.unstageHunk(dir, firstHunk)

      const newStagedDiff = await svc.getStagedDiff(dir)
      const unstagedDiff = await svc.getUnstagedDiff(dir)

      // The first hunk is now unstaged
      expect(unstagedDiff).not.toBe('')
      // The second hunk remains staged
      expect(newStagedDiff).not.toBe('')
      expect(newStagedDiff.length).toBeLessThan(stagedDiff.length)
    })
  })
})
