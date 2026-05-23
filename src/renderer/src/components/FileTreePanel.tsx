import { useEffect, useRef } from 'react'
import { FileTree, useFileTree } from '@pierre/trees/react'
import type { GitStatus as PierreGitStatus } from '@pierre/trees'
import type { FileStatus, GitStatus } from '@shared/ipc'

function mapStatus(status: FileStatus): PierreGitStatus {
  switch (status) {
    case 'M':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'added'
    case '?':
      return 'untracked'
  }
}

interface FileTreePanelProps {
  gitStatus: GitStatus | null
  onFileSelect: (path: string) => void
}

export function FileTreePanel({ gitStatus, onFileSelect }: FileTreePanelProps): JSX.Element {
  const onFileSelectRef = useRef(onFileSelect)
  onFileSelectRef.current = onFileSelect

  const { model: stagedModel } = useFileTree({
    paths: [],
    onSelectionChange: (paths) => {
      if (paths.length > 0) onFileSelectRef.current(paths[0])
    }
  })

  const { model: unstagedModel } = useFileTree({
    paths: [],
    onSelectionChange: (paths) => {
      if (paths.length > 0) onFileSelectRef.current(paths[0])
    }
  })

  useEffect(() => {
    const staged = gitStatus?.staged ?? []
    stagedModel.resetPaths(staged.map((f) => f.path))
    stagedModel.setGitStatus(staged.map((f) => ({ path: f.path, status: mapStatus(f.status) })))
  }, [stagedModel, gitStatus])

  useEffect(() => {
    const unstaged = gitStatus?.unstaged ?? []
    unstagedModel.resetPaths(unstaged.map((f) => f.path))
    unstagedModel.setGitStatus(
      unstaged.map((f) => ({ path: f.path, status: mapStatus(f.status) }))
    )
  }, [unstagedModel, gitStatus])

  const staged = gitStatus?.staged ?? []
  const unstaged = gitStatus?.unstaged ?? []

  return (
    <div className="file-tree-panel">
      <section className="file-tree-section">
        <div className="file-tree-section-header">
          <span>Staged</span>
          <span className="file-count">{staged.length}</span>
        </div>
        {staged.length > 0 ? (
          <FileTree model={stagedModel} className="file-tree" />
        ) : (
          <div className="file-tree-empty">No staged changes</div>
        )}
      </section>
      <section className="file-tree-section">
        <div className="file-tree-section-header">
          <span>Unstaged</span>
          <span className="file-count">{unstaged.length}</span>
        </div>
        {unstaged.length > 0 ? (
          <FileTree model={unstagedModel} className="file-tree" />
        ) : (
          <div className="file-tree-empty">No unstaged changes</div>
        )}
      </section>
    </div>
  )
}
