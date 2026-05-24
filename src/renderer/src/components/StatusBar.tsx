import React from 'react'
import type { HookState } from './HookOutputPanel'
import './StatusBar.css'

interface StatusBarProps {
  branchName: string
  ahead: number
  behind: number
  changedCount: number
  hookState: HookState
  remoteName: string
  appVersion: string
  onOpenPalette: () => void
}

export function StatusBar({
  branchName,
  ahead,
  behind,
  changedCount,
  hookState,
  remoteName,
  appVersion,
  onOpenPalette,
}: StatusBarProps): React.ReactElement {
  const phase = hookState.phase

  const hookClass =
    phase === 'running'
      ? 'status-bar-hook status-bar-hook--running'
      : phase === 'failure'
        ? 'status-bar-hook status-bar-hook--failed'
        : 'status-bar-hook status-bar-hook--ready'

  const hookLabel =
    phase === 'running' ? 'running' : phase === 'failure' ? 'hooks failed' : 'hooks ready'

  return (
    <div className="status-bar">
      {/* Left zone: branch, sync arrows, changed count */}
      <div className="status-bar-left">
        {branchName && (
          <span className="status-bar-branch">
            <span className="status-bar-branch-icon">&#x2387;</span>
            {branchName}
          </span>
        )}
        {(ahead > 0 || behind > 0) && (
          <span className="status-bar-sync">
            {ahead > 0 && <span>&#x2191;{ahead}</span>}
            {behind > 0 && <span>&#x2193;{behind}</span>}
          </span>
        )}
        {changedCount > 0 && (
          <span className="status-bar-changed">{changedCount} changed</span>
        )}
      </div>

      {/* Centre zone: command palette button */}
      <div className="status-bar-center">
        <button className="status-bar-palette-btn" onClick={onOpenPalette} tabIndex={-1}>
          <span className="status-bar-palette-icon">&#x2315;</span>
          Run command
          <span className="status-bar-palette-hint">&#x2318;K</span>
        </button>
      </div>

      {/* Right zone: hook state, remote, version */}
      <div className="status-bar-right">
        <span className={hookClass}>{hookLabel}</span>
        {remoteName && <span className="status-bar-remote">{remoteName}</span>}
        {appVersion && <span className="status-bar-version">v{appVersion}</span>}
      </div>
    </div>
  )
}
