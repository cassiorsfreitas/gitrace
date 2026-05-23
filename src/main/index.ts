import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { RepoStore } from './store/RepoStore'
import { KeybindingStore } from './store/KeybindingStore'
import { GitService } from './git/GitService'
import { GitWatcher } from './git/GitWatcher'
import { HookRunner } from './git/HookRunner'
import { IPC, IPC_EVENTS, type IpcRequest, type IpcEventPayload } from '../shared/ipc'

let repoStore: RepoStore
let keybindingStore: KeybindingStore
const gitService = new GitService()
const gitWatcher = new GitWatcher()

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.GIT_STATUS, (_, req: IpcRequest<'git:getStatus'>) =>
    gitService.getStatus(req.repoPath)
  )

  ipcMain.handle(IPC.GIT_STAGED_DIFF, (_, req: IpcRequest<'git:getStagedDiff'>) =>
    gitService.getStagedDiff(req.repoPath)
  )

  ipcMain.handle(IPC.GIT_UNSTAGED_DIFF, (_, req: IpcRequest<'git:getUnstagedDiff'>) =>
    gitService.getUnstagedDiff(req.repoPath)
  )

  ipcMain.handle(IPC.GIT_STAGE_FILE, (_, req: IpcRequest<'git:stageFile'>) =>
    gitService.stageFile(req.repoPath, req.filePath)
  )

  ipcMain.handle(IPC.GIT_UNSTAGE_FILE, (_, req: IpcRequest<'git:unstageFile'>) =>
    gitService.unstageFile(req.repoPath, req.filePath)
  )

  ipcMain.handle(IPC.GIT_STAGE_HUNK, (_, req: IpcRequest<'git:stageHunk'>) =>
    gitService.stageHunk(req.repoPath, req.patch)
  )

  ipcMain.handle(IPC.GIT_UNSTAGE_HUNK, (_, req: IpcRequest<'git:unstageHunk'>) =>
    gitService.unstageHunk(req.repoPath, req.patch)
  )

  ipcMain.handle(IPC.GIT_COMMIT, async (event, req: IpcRequest<'git:commit'>) => {
    const hookPath = join(req.repoPath, '.git', 'hooks', 'pre-commit')

    if (existsSync(hookPath)) {
      const runner = new HookRunner()

      event.sender.send(IPC_EVENTS.HOOK_START, { hookName: 'pre-commit' })

      runner.on('data', (chunk: string) => {
        event.sender.send(IPC_EVENTS.HOOK_DATA, { chunk })
      })

      const exitCode = await runner.run(hookPath, req.repoPath)
      event.sender.send(IPC_EVENTS.HOOK_EXIT, { code: exitCode })

      if (exitCode !== 0) {
        throw new Error(`pre-commit hook failed with exit code ${exitCode}`)
      }
    }

    await gitService.commit(req.repoPath, req.message)
  })

  ipcMain.handle(IPC.GIT_COMMIT_NO_VERIFY, (_, req: IpcRequest<'git:commitNoVerify'>) =>
    gitService.commitNoVerify(req.repoPath, req.message)
  )

  ipcMain.handle(IPC.GIT_AMEND_COMMIT, (_, req: IpcRequest<'git:amendCommit'>) =>
    gitService.amendCommit(req.repoPath, req.message)
  )

  ipcMain.handle(IPC.GIT_LAST_COMMIT_MESSAGE, (_, req: IpcRequest<'git:getLastCommitMessage'>) =>
    gitService.getLastCommitMessage(req.repoPath)
  )

  ipcMain.handle(IPC.REPO_GET_ALL, () => repoStore.getAll())

  ipcMain.handle(IPC.REPO_ADD, (_, req: IpcRequest<'repo:add'>) => {
    repoStore.addRepo(req.repoPath)
    gitWatcher.watch(req.repoPath)
  })

  ipcMain.handle(IPC.REPO_REMOVE, (_, req: IpcRequest<'repo:remove'>) => {
    repoStore.removeRepo(req.repoPath)
    gitWatcher.unwatch(req.repoPath)
  })

  ipcMain.handle(IPC.REPO_OPEN_PICKER, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]
    if (!existsSync(join(selectedPath, '.git'))) {
      throw new Error(`Not a git repository: ${selectedPath}`)
    }
    repoStore.addRepo(selectedPath)
    gitWatcher.watch(selectedPath)
    return selectedPath
  })

  ipcMain.handle(IPC.REPO_REORDER, (_, req: IpcRequest<'repo:reorder'>) => {
    repoStore.reorderRepos(req.paths)
  })

  ipcMain.handle(IPC.REPO_SET_ACTIVE_INDEX, (_, req: IpcRequest<'repo:setActiveIndex'>) => {
    repoStore.setActiveIndex(req.index)
  })

  ipcMain.handle(IPC.KEYBINDINGS_GET_ALL, () => keybindingStore.getAll())
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    center: true,
    show: false,
    autoHideMenuBar: true,
    // macOS native chrome: traffic lights inset over content (Raycast-like)
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  repoStore = new RepoStore(app.getPath('userData'))
  keybindingStore = new KeybindingStore()

  // Watch repos already persisted from a previous session
  for (const repoPath of repoStore.getAll()) {
    gitWatcher.watch(repoPath)
  }

  // Push file-change events to the renderer
  gitWatcher.on('changed', (repoPath: string) => {
    const payload: IpcEventPayload<'git:changed'> = { repoPath }
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send(IPC_EVENTS.GIT_CHANGED, payload)
    })
  })

  // Push keybinding reload events to the renderer
  keybindingStore.on('reload', () => {
    const bindings = keybindingStore.getAll()
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send(IPC_EVENTS.KEYBINDINGS_CHANGED, bindings)
    })
  })

  app.on('before-quit', () => {
    gitWatcher.destroy()
    keybindingStore.destroy()
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
