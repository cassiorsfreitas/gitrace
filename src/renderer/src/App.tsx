import { useEffect, useState } from 'react'

function App(): JSX.Element {
  const [repos, setRepos] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.electron.ipcRenderer
      .invoke('repo:getAll', {})
      .then((r: unknown) => setRepos(r as string[]))
  }, [])

  const refreshRepos = async (): Promise<void> => {
    const r = await window.electron.ipcRenderer.invoke('repo:getAll', {})
    setRepos(r as string[])
  }

  const handleAddRepo = async (): Promise<void> => {
    setError(null)
    try {
      const added = await window.electron.ipcRenderer.invoke('repo:openPicker', {})
      if (added) await refreshRepos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository')
    }
  }

  const handleRemoveRepo = async (repoPath: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('repo:remove', { repoPath })
    await refreshRepos()
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="app-title">Gitrace</span>
        </div>
        <div className="sidebar-body">
          {repos.map((repo) => (
            <div key={repo} className="repo-item">
              <span className="repo-name" title={repo}>
                {repo.split('/').pop()}
              </span>
              <button
                className="repo-remove"
                onClick={() => handleRemoveRepo(repo)}
                title="Remove repository"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          {error && <div className="error-message">{error}</div>}
          <button className="add-repo-btn" onClick={handleAddRepo}>
            + Add Repository
          </button>
        </div>
      </div>
      <div className="main-content">
        <div className="empty-state">
          <p>{repos.length === 0 ? 'Add a repository to get started.' : 'Select a repository.'}</p>
        </div>
      </div>
    </div>
  )
}

export default App
