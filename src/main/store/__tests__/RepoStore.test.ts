import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { RepoStore } from '../RepoStore'

describe('RepoStore', () => {
  let tmpDir: string
  let store: RepoStore

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gitrace-test-'))
    store = new RepoStore(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('starts empty with activeIndex 0', () => {
    expect(store.getAll()).toEqual([])
    expect(store.getActiveIndex()).toBe(0)
  })

  it('adds a repo and persists across instances', () => {
    store.addRepo('/some/repo')
    const store2 = new RepoStore(tmpDir)
    expect(store2.getAll()).toEqual(['/some/repo'])
  })

  it('does not add duplicate repos', () => {
    store.addRepo('/some/repo')
    store.addRepo('/some/repo')
    expect(store.getAll()).toHaveLength(1)
  })

  it('removes a repo and persists', () => {
    store.addRepo('/repo1')
    store.addRepo('/repo2')
    store.removeRepo('/repo1')
    const store2 = new RepoStore(tmpDir)
    expect(store2.getAll()).toEqual(['/repo2'])
  })

  it('removing a non-existent repo is a no-op', () => {
    store.addRepo('/repo1')
    store.removeRepo('/nope')
    expect(store.getAll()).toEqual(['/repo1'])
  })

  it('reorders repos and persists', () => {
    store.addRepo('/repo1')
    store.addRepo('/repo2')
    store.addRepo('/repo3')
    store.reorderRepos(['/repo3', '/repo1', '/repo2'])
    const store2 = new RepoStore(tmpDir)
    expect(store2.getAll()).toEqual(['/repo3', '/repo1', '/repo2'])
  })

  it('sets and persists active index', () => {
    store.addRepo('/repo1')
    store.addRepo('/repo2')
    store.setActiveIndex(1)
    const store2 = new RepoStore(tmpDir)
    expect(store2.getActiveIndex()).toBe(1)
  })

  it('clamps activeIndex when removed repo shrinks list', () => {
    store.addRepo('/repo1')
    store.addRepo('/repo2')
    store.setActiveIndex(1)
    store.removeRepo('/repo2')
    expect(store.getActiveIndex()).toBe(0)
  })

  it('getAll returns a copy — mutating it does not affect the store', () => {
    store.addRepo('/repo1')
    const repos = store.getAll()
    repos.push('/injected')
    expect(store.getAll()).toHaveLength(1)
  })
})
