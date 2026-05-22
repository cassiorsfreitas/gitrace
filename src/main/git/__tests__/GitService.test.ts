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
})
