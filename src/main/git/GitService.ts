import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import simpleGit from 'simple-git'
import type { GitStatus, TrackedFile, FileStatus } from '../../shared/ipc'

export class GitService {
  async getStatus(repoPath: string): Promise<GitStatus> {
    const git = simpleGit(repoPath)
    const status = await git.status()

    const staged: TrackedFile[] = []
    const unstaged: TrackedFile[] = []

    for (const file of status.files) {
      if (file.index !== ' ' && file.index !== '') {
        staged.push({ path: file.path, status: file.index as FileStatus })
      }
      if (file.working_dir !== ' ' && file.working_dir !== '') {
        unstaged.push({ path: file.path, status: file.working_dir as FileStatus })
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

  async getLastCommitMessage(repoPath: string): Promise<string> {
    const git = simpleGit(repoPath)
    const result = await git.raw(['log', '-1', '--format=%B'])
    return result.trim()
  }
}
