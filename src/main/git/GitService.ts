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
}
