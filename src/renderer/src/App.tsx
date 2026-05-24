import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitStatus, IpcEventPayload, TrackedFile, SyncStatus } from "@shared/ipc";
import { FileTreePanel } from "./components/FileTreePanel";
import { DiffCanvas } from "./components/DiffCanvas";
import type { DiffCanvasHandle } from "./components/DiffCanvas";
import { NavRail } from "./components/NavRail";
import { CommitArea } from "./components/CommitArea";
import type { HookState } from "./components/HookOutputPanel";
import { useKeybindings } from "./hooks/useKeybindings";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";

type FocusedColumn = 1 | 2 | 3 | 4;
type SectionedFile = TrackedFile & { section: 'staged' | 'unstaged' };

/** Locate the current selection in the flat file list.
 *  Tries exact {path, section} match first; falls back to path-only
 *  so a stale section (e.g. after col-3 navigation) never returns -1
 *  when the file still exists. */
function resolveIdx(
  files: SectionedFile[],
  path: string | null,
  section: 'staged' | 'unstaged' | null,
): number {
  if (!path) return -1;
  const exact = files.findIndex(f => f.path === path && f.section === section);
  if (exact !== -1) return exact;
  return files.findIndex(f => f.path === path);
}

function App() {
  const [repos, setRepos] = useState<string[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'staged' | 'unstaged' | null>(null);
  const [stagedDiff, setStagedDiff] = useState<string | null>(null);
  const [unstagedDiff, setUnstagedDiff] = useState<string | null>(null);
  const [hookState, setHookState] = useState<HookState>({
    phase: "idle",
    output: [],
    exitCode: null,
  });

  const [branchName, setBranchName] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ ahead: 0, behind: 0 });
  const [remoteName, setRemoteName] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

  const [focusedColumn, setFocusedColumn] = useState<FocusedColumn>(2);

  const diffCanvasRef = useRef<DiffCanvasHandle>(null);
  const { matches, getBinding } = useKeybindings();

  const changedFilesCount =
    (gitStatus?.staged.length ?? 0) + (gitStatus?.unstaged.length ?? 0);

  // Flat ordered list of all files for keyboard navigation (tagged with section)
  const allFiles = useMemo(
    (): SectionedFile[] => [
      ...(gitStatus?.staged ?? []).map(f => ({ ...f, section: 'staged' as const })),
      ...(gitStatus?.unstaged ?? []).map(f => ({ ...f, section: 'unstaged' as const })),
    ],
    [gitStatus],
  );

  // Stable refs so the keyboard handler never goes stale
  const allFilesRef = useRef<SectionedFile[]>(allFiles);
  allFilesRef.current = allFiles;
  const selectedFileRef = useRef<string | null>(selectedFile);
  selectedFileRef.current = selectedFile;
  const selectedSectionRef = useRef<'staged' | 'unstaged' | null>(selectedSection);
  selectedSectionRef.current = selectedSection;
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  const focusedColumnRef = useRef<FocusedColumn>(2);
  focusedColumnRef.current = focusedColumn;
  const gitStatusRef = useRef<GitStatus | null>(gitStatus);
  gitStatusRef.current = gitStatus;
  const handleStageFileRef = useRef<(filePath: string) => Promise<void>>(null!);
  const handleUnstageFileRef = useRef<(filePath: string) => Promise<void>>(null!);
  const handleDiscardFileRef = useRef<(filePath: string) => Promise<void>>(null!);
  const handleOpenInEditorRef = useRef<(filePath: string) => Promise<void>>(null!);

  const refreshGitData = useCallback(
    async (repoPath: string): Promise<void> => {
      const [status, staged, unstaged, branch, sync, remote] = await Promise.all([
        window.electron.ipcRenderer.invoke("git:getStatus", { repoPath }),
        window.electron.ipcRenderer.invoke("git:getStagedDiff", { repoPath }),
        window.electron.ipcRenderer.invoke("git:getUnstagedDiff", { repoPath }),
        window.electron.ipcRenderer.invoke("git:branch", { repoPath }),
        window.electron.ipcRenderer.invoke("git:syncStatus", { repoPath }),
        window.electron.ipcRenderer.invoke("git:remoteName", { repoPath }),
      ]);
      setGitStatus(status as GitStatus);
      setStagedDiff(staged as string);
      setUnstagedDiff(unstaged as string);
      setBranchName(branch as string);
      setSyncStatus(sync as SyncStatus);
      setRemoteName(remote as string);
    },
    [],
  );

  useEffect(() => {
    window.electron.ipcRenderer
      .invoke("repo:getAll", {})
      .then((r: unknown) => {
        const { repos: all, activeIndex } = r as { repos: string[]; activeIndex: number };
        setRepos(all);
        if (all.length > 0) {
          const idx = Math.min(activeIndex, all.length - 1);
          const repo = all[idx];
          setActiveRepo(repo);
          refreshGitData(repo);
        }
      });
  }, [refreshGitData]);

  useEffect(() => {
    window.electron.ipcRenderer
      .invoke("app:version", {})
      .then((v: unknown) => setAppVersion(v as string))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (
      _event: unknown,
      payload: IpcEventPayload<"git:changed">,
    ): void => {
      if (payload.repoPath === activeRepo) {
        refreshGitData(payload.repoPath);
      }
    };
    window.electron.ipcRenderer.on("git:changed", handler);
    return (): void => {
      window.electron.ipcRenderer.removeListener("git:changed", handler);
    };
  }, [activeRepo, refreshGitData]);

  // Re-anchor selectedSection whenever gitStatus changes (e.g. after stage/unstage ops)
  useEffect(() => {
    const path = selectedFileRef.current;
    const section = selectedSectionRef.current;
    if (!path || !gitStatus) return;
    const inStaged = gitStatus.staged.some(f => f.path === path);
    const inUnstaged = gitStatus.unstaged.some(f => f.path === path);
    if (!inStaged && !inUnstaged) {
      setSelectedSection(null);
    } else if (section === 'staged' && !inStaged) {
      setSelectedSection('unstaged');
    } else if (section === 'unstaged' && !inUnstaged) {
      setSelectedSection('staged');
    } else if (section === null) {
      setSelectedSection(inStaged ? 'staged' : 'unstaged');
    }
  }, [gitStatus]);

  useEffect(() => {
    const onStart = (): void => {
      setHookState({ phase: "running", output: [], exitCode: null });
    };
    const onData = (_: unknown, payload: { chunk: string }): void => {
      setHookState((prev) => ({
        ...prev,
        output: [...prev.output, payload.chunk],
      }));
    };
    const onExit = (_: unknown, payload: { code: number }): void => {
      setHookState((prev) => ({
        ...prev,
        phase: payload.code === 0 ? "success" : "failure",
        exitCode: payload.code,
      }));
    };
    window.electron.ipcRenderer.on("hook:start", onStart);
    window.electron.ipcRenderer.on("hook:data", onData);
    window.electron.ipcRenderer.on("hook:exit", onExit);
    return (): void => {
      window.electron.ipcRenderer.removeListener("hook:start", onStart);
      window.electron.ipcRenderer.removeListener("hook:data", onData);
      window.electron.ipcRenderer.removeListener("hook:exit", onExit);
    };
  }, []);

  // Global keyboard navigation — column-aware
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const col = focusedColumnRef.current;
      const isTextarea = document.activeElement instanceof HTMLTextAreaElement;
      const m = matchesRef.current;

      const isEscape = e.key === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      const isFocusLeft = m(e, "focusLeft");
      const isFocusRight = m(e, "focusRight");

      // Focus-movement keys: always fire, even from textarea
      if (isEscape || isFocusLeft) {
        if (col > 1) {
          e.preventDefault();
          if (isTextarea) (document.activeElement as HTMLElement).blur();
          setFocusedColumn((col - 1) as FocusedColumn);
        }
        return;
      }

      if (isFocusRight) {
        const canAdvance = col < 4 && !(col === 2 && allFilesRef.current.length === 0);
        if (canAdvance) {
          e.preventDefault();
          setFocusedColumn((col + 1) as FocusedColumn);
        }
        return;
      }

      // All other shortcuts blocked when textarea is focused
      if (isTextarea) return;

      const files = allFilesRef.current;
      const current = selectedFileRef.current;

      // Enter: activate + advance
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (col === 1) {
          setFocusedColumn(2);
        } else if (col === 2 && files.length > 0) {
          if (!current) {
            setSelectedFile(files[0].path);
            setSelectedSection(files[0].section);
          }
          setFocusedColumn(3);
        } else if (col === 3) {
          setFocusedColumn(4);
        }
        return;
      }

      // Column 2: file navigation + toggleStage
      if (col === 2) {
        if (m(e, "nextLine")) {
          e.preventDefault();
          if (files.length > 0) {
            const idx = resolveIdx(files, current, selectedSectionRef.current);
            const next = idx < files.length - 1 ? idx + 1 : idx;
            const target = idx === -1 ? files[0] : files[next];
            setSelectedFile(target.path);
            setSelectedSection(target.section);
          }
        } else if (m(e, "prevLine")) {
          e.preventDefault();
          if (files.length > 0) {
            const idx = resolveIdx(files, current, selectedSectionRef.current);
            if (idx > 0) {
              const prev = files[idx - 1];
              setSelectedFile(prev.path);
              setSelectedSection(prev.section);
            } else if (idx === -1 && files.length > 0) {
              // Stale selection — re-anchor to first match by path
              const fallback = files.find(f => f.path === current);
              if (fallback) { setSelectedFile(fallback.path); setSelectedSection(fallback.section); }
            }
          }
        } else if (m(e, "toggleStage") && current) {
          e.preventDefault();
          const isStaged = selectedSectionRef.current === 'staged';
          if (isStaged) {
            handleUnstageFileRef.current(current);
          } else {
            handleStageFileRef.current(current);
          }
        } else if (m(e, "stepBack") && current) {
          e.preventDefault();
          const isStaged = selectedSectionRef.current === 'staged';
          if (isStaged) {
            handleUnstageFileRef.current(current);
          } else {
            handleDiscardFileRef.current(current);
          }
        } else if (m(e, "openInEditor") && current) {
          e.preventDefault();
          handleOpenInEditorRef.current(current);
        }
        return;
      }

      // Column 3: diff scroll + file jump
      if (col === 3) {
        if (m(e, "nextLine")) {
          e.preventDefault();
          diffCanvasRef.current?.scrollLineDown();
        } else if (m(e, "prevLine")) {
          e.preventDefault();
          diffCanvasRef.current?.scrollLineUp();
        } else if (m(e, "nextFile")) {
          e.preventDefault();
          const result = diffCanvasRef.current?.scrollToNextFile();
          if (result) {
            setSelectedFile(result.path);
            setSelectedSection(result.section);
          }
        } else if (m(e, "prevFile")) {
          e.preventDefault();
          const result = diffCanvasRef.current?.scrollToPrevFile();
          if (result) {
            setSelectedFile(result.path);
            setSelectedSection(result.section);
          }
        }
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return (): void => document.removeEventListener("keydown", handler);
  }, []); // stable via refs — no deps needed

  const refreshRepos = async (): Promise<string[]> => {
    const r = await window.electron.ipcRenderer.invoke("repo:getAll", {});
    const { repos: all } = r as { repos: string[]; activeIndex: number };
    setRepos(all);
    return all;
  };

  const handleAddRepo = async (): Promise<void> => {
    try {
      const added = await window.electron.ipcRenderer.invoke(
        "repo:openPicker",
        {},
      );
      if (added) {
        const all = await refreshRepos();
        handleSelectRepo(added as string);
        const idx = (all as string[]).indexOf(added as string);
        if (idx !== -1) {
          window.electron.ipcRenderer.invoke("repo:setActiveIndex", { index: idx });
        }
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed to add repository");
    }
  };

  const handleSelectRepo = (repoPath: string): void => {
    setActiveRepo(repoPath);
    setGitStatus(null);
    setSelectedFile(null);
    setSelectedSection(null);
    setStagedDiff(null);
    setUnstagedDiff(null);
    setBranchName('');
    setSyncStatus({ ahead: 0, behind: 0 });
    setRemoteName('');
    refreshGitData(repoPath);
    const idx = repos.indexOf(repoPath);
    if (idx !== -1) {
      window.electron.ipcRenderer.invoke("repo:setActiveIndex", { index: idx });
    }
  };

  const handleRemoveRepo = async (repoPath: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke("repo:remove", { repoPath });
    if (activeRepo === repoPath) {
      setActiveRepo(null);
      setGitStatus(null);
      setSelectedFile(null);
      setSelectedSection(null);
      setStagedDiff(null);
      setUnstagedDiff(null);
      setBranchName('');
      setSyncStatus({ ahead: 0, behind: 0 });
      setRemoteName('');
    }
    await refreshRepos();
  };

  const handleStageFile = useCallback(
    async (filePath: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:stageFile", {
        repoPath: activeRepo,
        filePath,
      });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleUnstageFile = useCallback(
    async (filePath: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:unstageFile", {
        repoPath: activeRepo,
        filePath,
      });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleDiscardFile = useCallback(
    async (filePath: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:discardFile", {
        repoPath: activeRepo,
        filePath,
      });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleOpenInEditor = useCallback(
    async (filePath: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("shell:openInEditor", {
        repoPath: activeRepo,
        filePath,
      });
    },
    [activeRepo],
  );

  handleStageFileRef.current = handleStageFile;
  handleUnstageFileRef.current = handleUnstageFile;
  handleDiscardFileRef.current = handleDiscardFile;
  handleOpenInEditorRef.current = handleOpenInEditor;

  const handleStageAll = useCallback(async (): Promise<void> => {
    if (!activeRepo || !gitStatus?.unstaged.length) return;
    for (const file of gitStatus.unstaged) {
      await window.electron.ipcRenderer.invoke("git:stageFile", {
        repoPath: activeRepo,
        filePath: file.path,
      });
    }
    await refreshGitData(activeRepo);
  }, [activeRepo, gitStatus, refreshGitData]);

  const handleUnstageAll = useCallback(async (): Promise<void> => {
    if (!activeRepo || !gitStatus?.staged.length) return;
    for (const file of gitStatus.staged) {
      await window.electron.ipcRenderer.invoke("git:unstageFile", {
        repoPath: activeRepo,
        filePath: file.path,
      });
    }
    await refreshGitData(activeRepo);
  }, [activeRepo, gitStatus, refreshGitData]);

  const handleStageHunk = useCallback(
    async (patch: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:stageHunk", {
        repoPath: activeRepo,
        patch,
      });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleUnstageHunk = useCallback(
    async (patch: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:unstageHunk", {
        repoPath: activeRepo,
        patch,
      });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleCommit = useCallback(
    async (message: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:commit", {
        repoPath: activeRepo,
        message,
      });
      setHookState({ phase: "idle", output: [], exitCode: null });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleForceCommit = useCallback(
    async (message: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:commitNoVerify", {
        repoPath: activeRepo,
        message,
      });
      setHookState({ phase: "idle", output: [], exitCode: null });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleAmend = useCallback(
    async (message: string): Promise<void> => {
      if (!activeRepo) return;
      await window.electron.ipcRenderer.invoke("git:amendCommit", {
        repoPath: activeRepo,
        message,
      });
      await refreshGitData(activeRepo);
    },
    [activeRepo, refreshGitData],
  );

  const handleGetLastCommitMessage = useCallback(async (): Promise<string> => {
    if (!activeRepo) return "";
    const msg = await window.electron.ipcRenderer.invoke(
      "git:getLastCommitMessage",
      { repoPath: activeRepo },
    );
    return msg as string;
  }, [activeRepo]);

  const handleGlobalMouseDown = (e: React.MouseEvent): void => {
    const target = e.target as Element;
    if (target.closest('.nav-rail')) setFocusedColumn(1);
    else if (target.closest('.file-tree-panel')) setFocusedColumn(2);
    else if (target.closest('.diff-canvas')) setFocusedColumn(3);
    else if (target.closest('.commit-area')) setFocusedColumn(4);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <div className="app" onMouseDown={handleGlobalMouseDown} style={{ display: 'flex', flex: 1 }}>
          <NavRail
            repos={repos}
            activeRepo={activeRepo}
            changedFilesCount={changedFilesCount}
            onSelectRepo={handleSelectRepo}
            onAddRepo={handleAddRepo}
            onRemoveRepo={handleRemoveRepo}
            isFocused={focusedColumn === 1}
          />
          <div className="main-content">
            {activeRepo !== null ? (
              <>
                <FileTreePanel
                  gitStatus={gitStatus}
                  selectedFile={selectedFile}
                  selectedSection={selectedSection}
                  onFileSelect={(path, section) => { setSelectedFile(path); setSelectedSection(section); }}
                  onStageFile={handleStageFile}
                  onUnstageFile={handleUnstageFile}
                  onDiscardFile={handleDiscardFile}
                  onStageAll={handleStageAll}
                  onUnstageAll={handleUnstageAll}
                  onOpenInEditor={handleOpenInEditor}
                  isFocused={focusedColumn === 2}
                />
                <DiffCanvas
                  ref={diffCanvasRef}
                  stagedDiff={stagedDiff}
                  unstagedDiff={unstagedDiff}
                  selectedFile={selectedFile}
                  selectedSection={selectedSection}
                  onStageHunk={handleStageHunk}
                  onUnstageHunk={handleUnstageHunk}
                  isFocused={focusedColumn === 3}
                />
                <CommitArea
                  stagedCount={gitStatus?.staged.length ?? 0}
                  hookState={hookState}
                  onCommit={handleCommit}
                  onAmend={handleAmend}
                  onGetLastCommitMessage={handleGetLastCommitMessage}
                  onForceCommit={handleForceCommit}
                  isFocused={focusedColumn === 4}
                />
              </>
            ) : (
              <div className="empty-state">
                <p>
                  {repos.length === 0
                    ? "Add a repository to get started."
                    : "Select a repository."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar
        branchName={branchName}
        ahead={syncStatus.ahead}
        behind={syncStatus.behind}
        changedCount={changedFilesCount}
        hookState={hookState}
        remoteName={remoteName}
        appVersion={appVersion}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={[]}
        getBinding={getBinding}
      />
    </div>
  );
}

export default App;
