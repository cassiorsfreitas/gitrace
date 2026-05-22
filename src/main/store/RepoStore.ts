import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface RepoStoreData {
  repos: string[]
  activeIndex: number
}

export class RepoStore {
  private filePath: string
  private data: RepoStoreData

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'repos.json')
    this.data = this.load()
  }

  private load(): RepoStoreData {
    if (existsSync(this.filePath)) {
      try {
        return JSON.parse(readFileSync(this.filePath, 'utf-8'))
      } catch {
        // corrupted file — fall back to defaults
      }
    }
    return { repos: [], activeIndex: 0 }
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  getAll(): string[] {
    return [...this.data.repos]
  }

  getActiveIndex(): number {
    return this.data.activeIndex
  }

  addRepo(repoPath: string): void {
    if (!this.data.repos.includes(repoPath)) {
      this.data.repos.push(repoPath)
      this.save()
    }
  }

  removeRepo(repoPath: string): void {
    this.data.repos = this.data.repos.filter((p) => p !== repoPath)
    if (this.data.activeIndex >= this.data.repos.length) {
      this.data.activeIndex = Math.max(0, this.data.repos.length - 1)
    }
    this.save()
  }

  reorderRepos(paths: string[]): void {
    this.data.repos = paths
    this.save()
  }

  setActiveIndex(index: number): void {
    this.data.activeIndex = index
    this.save()
  }
}
