/**
 * Typed IPC channel definitions for main↔renderer communication.
 *
 * No electron imports — safe to import in both the main process,
 * the renderer, and tests without mocking.
 *
 * Usage pattern:
 *   Main:     ipcMain.handle(IPC.GIT_STATUS, async (_, req: IpcRequest<'git:getStatus'>) => …)
 *   Renderer: window.electron.ipcRenderer.invoke(IPC.GIT_STATUS, { repoPath })
 */

// ── Domain types ──────────────────────────────────────────────────────────────

export type FileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | '?'

export interface TrackedFile {
  path: string
  status: FileStatus
  added?: number
  removed?: number
}

export interface GitStatus {
  staged: TrackedFile[]
  unstaged: TrackedFile[]
}

// ── Channel map ───────────────────────────────────────────────────────────────

export interface IpcChannels {
  'git:getStatus': {
    request: { repoPath: string }
    response: GitStatus
  }
  'git:stageFile': {
    request: { repoPath: string; filePath: string }
    response: void
  }
  'git:unstageFile': {
    request: { repoPath: string; filePath: string }
    response: void
  }
  'git:stageHunk': {
    request: { repoPath: string; patch: string }
    response: void
  }
  'git:unstageHunk': {
    request: { repoPath: string; patch: string }
    response: void
  }
  'git:commit': {
    request: { repoPath: string; message: string }
    response: void
  }
  'git:amendCommit': {
    request: { repoPath: string; message: string }
    response: void
  }
  'git:commitNoVerify': {
    request: { repoPath: string; message: string }
    response: void
  }
  'git:getLastCommitMessage': {
    request: { repoPath: string }
    response: string
  }
  'git:getStagedDiff': {
    request: { repoPath: string }
    response: string
  }
  'git:getUnstagedDiff': {
    request: { repoPath: string }
    response: string
  }
  'repo:getAll': {
    request: Record<string, never>
    response: string[]
  }
  'repo:add': {
    request: { repoPath: string }
    response: void
  }
  'repo:remove': {
    request: { repoPath: string }
    response: void
  }
  'repo:openPicker': {
    request: Record<string, never>
    response: string | null // null = cancelled, string = added path; throws if not a git repo
  }
  'repo:reorder': {
    request: { paths: string[] }
    response: void
  }
  'repo:setActiveIndex': {
    request: { index: number }
    response: void
  }
  'keybindings:getAll': {
    request: Record<string, never>
    response: Record<string, string>
  }
}

export type IpcChannel = keyof IpcChannels
export type IpcRequest<C extends IpcChannel> = IpcChannels[C]['request']
export type IpcResponse<C extends IpcChannel> = IpcChannels[C]['response']

// ── Push-event map (main → renderer via webContents.send / ipcRenderer.on) ───

export interface IpcEvents {
  'git:changed': { repoPath: string }
  'hook:start': { hookName: string }
  'hook:data': { chunk: string }
  'hook:exit': { code: number }
  'keybindings:changed': Record<string, string>
}

export type IpcEvent = keyof IpcEvents
export type IpcEventPayload<E extends IpcEvent> = IpcEvents[E]

export const IPC_EVENTS = {
  GIT_CHANGED: 'git:changed',
  HOOK_START: 'hook:start',
  HOOK_DATA: 'hook:data',
  HOOK_EXIT: 'hook:exit',
  KEYBINDINGS_CHANGED: 'keybindings:changed',
} as const satisfies Record<string, IpcEvent>

// ── Channel name constants (runtime values for ipcMain.handle / invoke) ───────

export const IPC = {
  GIT_STATUS: 'git:getStatus',
  GIT_STAGE_FILE: 'git:stageFile',
  GIT_UNSTAGE_FILE: 'git:unstageFile',
  GIT_STAGE_HUNK: 'git:stageHunk',
  GIT_UNSTAGE_HUNK: 'git:unstageHunk',
  GIT_COMMIT: 'git:commit',
  GIT_AMEND_COMMIT: 'git:amendCommit',
  GIT_COMMIT_NO_VERIFY: 'git:commitNoVerify',
  GIT_LAST_COMMIT_MESSAGE: 'git:getLastCommitMessage',
  GIT_STAGED_DIFF: 'git:getStagedDiff',
  GIT_UNSTAGED_DIFF: 'git:getUnstagedDiff',
  REPO_GET_ALL: 'repo:getAll',
  REPO_ADD: 'repo:add',
  REPO_REMOVE: 'repo:remove',
  REPO_OPEN_PICKER: 'repo:openPicker',
  REPO_REORDER: 'repo:reorder',
  REPO_SET_ACTIVE_INDEX: 'repo:setActiveIndex',
  KEYBINDINGS_GET_ALL: 'keybindings:getAll',
} as const satisfies Record<string, IpcChannel>
