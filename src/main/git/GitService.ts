import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import simpleGit from 'simple-git'
import type { GitStatus, TrackedFile, FileStatus, SyncStatus } from '../../shared/ipc'

export class GitService {
  async getStatus(repoPath: string): Promise<GitStatus> {
    const git = simpleGit(repoPath)

    const [status, stagedNumstatRaw, unstagedNumstatRaw] = await Promise.all([
      git.status(),
      git.diff(['--cached', '--numstat']).catch(() => ''),
      git.diff(['--numstat']).catch(() => ''),
    ])

    const parseNumstat = (raw: string): Map<string, { added: number; removed: number }> => {
      const map = new Map<string, { added: number; removed: number }>()
      for (const line of raw.split('\n')) {
        const parts = line.split('\t')
        if (parts.length < 3) continue
        const [a, r, ...rest] = parts
        const filePath = rest.join('\t')
        map.set(filePath, {
          added: a === '-' ? 0 : parseInt(a, 10) || 0,
          removed: r === '-' ? 0 : parseInt(r, 10) || 0,
        })
      }
      return map
    }

    const stagedStats = parseNumstat(stagedNumstatRaw)
    const unstagedStats = parseNumstat(unstagedNumstatRaw)

    const staged: TrackedFile[] = []
    const unstaged: TrackedFile[] = []

    for (const file of status.files) {
      if (file.index !== ' ' && file.index !== '' && file.index !== '?') {
        const stats = stagedStats.get(file.path)
        staged.push({ path: file.path, status: file.index as FileStatus, ...stats })
      }
      if (file.working_dir !== ' ' && file.working_dir !== '') {
        const stats = unstagedStats.get(file.path)
        unstaged.push({ path: file.path, status: file.working_dir as FileStatus, ...stats })
      }
    }

    return { staged, unstaged }
  }

  async getStagedDiff(repoPath: string): Promise<string> {
    const git = simpleGit(repoPath)
    return git.diff(['--cached'])
  }

  async getUnstagedDiff(repoPath: string): Promise<string> {
    const git = simpleGit(repoPath)
    return git.diff()
  }

  async stageFile(repoPath: string, filePath: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.add(filePath)
  }

  async unstageFile(repoPath: string, filePath: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.reset(['HEAD', '--', filePath])
  }

  async discardFile(repoPath: string, filePath: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.checkout(['--', filePath])
  }

  async stageHunk(repoPath: string, patch: string): Promise<void> {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gitrace-patch-'))
    const patchFile = join(tmpDir, 'hunk.patch')
    try {
      writeFileSync(patchFile, patch, 'utf-8')
      const git = simpleGit(repoPath)
      await git.applyPatch(patchFile, ['--cached'])
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  async unstageHunk(repoPath: string, patch: string): Promise<void> {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gitrace-patch-'))
    const patchFile = join(tmpDir, 'hunk.patch')
    try {
      writeFileSync(patchFile, patch, 'utf-8')
      const git = simpleGit(repoPath)
      await git.applyPatch(patchFile, ['--cached', '--reverse'])
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  async commit(repoPath: string, message: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.commit(message)
  }

  async amendCommit(repoPath: string, message: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.raw(['commit', '--amend', '-m', message])
  }

  async commitNoVerify(repoPath: string, message: string): Promise<void> {
    const git = simpleGit(repoPath)
    await git.raw(['commit', '--no-verify', '-m', message])
  }

  async getLastCommitMessage(repoPath: string): Promise<string> {
    const git = simpleGit(repoPath)
    const result = await git.raw(['log', '-1', '--format=%B'])
    return result.trim()
  }

  async getBranch(repoPath: string): Promise<string> {
    const git = simpleGit(repoPath)
    const result = await git.revparse(['--abbrev-ref', 'HEAD'])
    return result.trim()
  }

  async getSyncStatus(repoPath: string): Promise<SyncStatus> {
    try {
      const git = simpleGit(repoPath)
      const result = await git.raw(['rev-list', '--left-right', '--count', 'HEAD...@{u}'])
      const [ahead, behind] = result.trim().split('\t').map(Number)
      return { ahead: ahead || 0, behind: behind || 0 }
    } catch {
      return { ahead: 0, behind: 0 }
    }
  }

  async getRemoteName(repoPath: string): Promise<string> {
    try {
      const git = simpleGit(repoPath)
      const remotes = await git.getRemotes(false)
      return remotes[0]?.name ?? ''
    } catch {
      return ''
    }
  }
}
