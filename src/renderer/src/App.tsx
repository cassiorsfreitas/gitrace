import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitStatus, IpcEventPayload, TrackedFile } from "@shared/ipc";

type FocusedColumn = 1 | 2 | 3 | 4;
import { FileTreePanel } from "./components/FileTreePanel";
import { DiffCanvas } from "./components/DiffCanvas";
import type { DiffCanvasHandle } from "./components/DiffCanvas";
import { NavRail } from "./components/NavRail";
import { CommitArea } from "./components/CommitArea";
import type { HookState } from "./components/HookOutputPanel";
import { useKeybindings } from "./hooks/useKeybindings";

function App(): JSX.Element {
  const [repos, setRepos] = useState<string[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [stagedDiff, setStagedDiff] = useState<string | null>(null);
  const [unstagedDiff, setUnstagedDiff] = useState<string | null>(null);
  const [hookState, setHookState] = useState<HookState>({
    phase: "idle",
    output: [],
    exitCode: null,
  });

  const [focusedColumn, setFocusedColumn] = useState<FocusedColumn>(2);

  const diffCanvasRef = useRef<DiffCanvasHandle>(null);
  const { matches } = useKeybindings();

  const changedFilesCount =
    (gitStatus?.staged.length ?? 0) + (gitStatus?.unstaged.length ?? 0);

  // Flat ordered list of all files for keyboard navigation
  const allFiles = useMemo(
    (): TrackedFile[] => [
      ...(gitStatus?.staged ?? []),
      ...(gitStatus?.unstaged ?? []),
    ],
    [gitStatus],
  );

  // Stable refs so the keyboard handler never goes stale
  const allFilesRef = useRef<TrackedFile[]>(allFiles);
  allFilesRef.current = allFiles;
  const selectedFileRef = useRef<string | null>(selectedFile);
  selectedFileRef.current = selectedFile;
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  const focusedColumnRef = useRef<FocusedColumn>(2);
  focusedColumnRef.current = focusedColumn;
  const gitStatusRef = useRef<GitStatus | null>(gitStatus);
  gitStatusRef.current = gitStatus;
  const handleStageFileRef = useRef<(filePath: string) => Promise<void>>(null!);
  const handleUnstageFileRef = useRef<(filePath: string) => Promise<void>>(null!);

  const refreshGitData = useCallback(
    async (repoPath: string): Promise<void> => {
      const [status, staged, unstaged] = await Promise.all([
        window.electron.ipcRenderer.invoke("git:getStatus", { repoPath }),
        window.electron.ipcRenderer.invoke("git:getStagedDiff", { repoPath }),
        window.electron.ipcRenderer.invoke("git:getUnstagedDiff", { repoPath }),
      ]);
      setGitStatus(status as GitStatus);
      setStagedDiff(staged as string);
      setUnstagedDiff(unstaged as string);
    },
    [],
  );

  useEffect(() => {
    window.electron.ipcRenderer
      .invoke("repo:getAll", {})
      .then((r: unknown) => setRepos(r as string[]));
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
          if (!current) setSelectedFile(files[0].path);
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
            const idx = current ? files.findIndex((f) => f.path === current) : -1;
            const next = idx < files.length - 1 ? idx + 1 : idx;
            const target = next >= 0 ? files[next] : files[0];
            setSelectedFile(target.path);
          }
        } else if (m(e, "prevLine")) {
          e.preventDefault();
          if (files.length > 0) {
            const idx = current ? files.findIndex((f) => f.path === current) : -1;
            if (idx > 0) setSelectedFile(files[idx - 1].path);
          }
        } else if (m(e, "toggleStage") && current) {
          e.preventDefault();
          const status = gitStatusRef.current;
          const isStaged = status?.staged.some((f) => f.path === current) ?? false;
          if (isStaged) {
            handleUnstageFileRef.current(current);
          } else {
            handleStageFileRef.current(current);
          }
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
          const filename = diffCanvasRef.current?.scrollToNextFile();
          if (filename) setSelectedFile(filename);
        } else if (m(e, "prevFile")) {
          e.preventDefault();
          const filename = diffCanvasRef.current?.scrollToPrevFile();
          if (filename) setSelectedFile(filename);
        }
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return (): void => document.removeEventListener("keydown", handler);
  }, []); // stable via refs — no deps needed

  const refreshRepos = async (): Promise<void> => {
    const r = await window.electron.ipcRenderer.invoke("repo:getAll", {});
    setRepos(r as string[]);
  };

  const handleAddRepo = async (): Promise<void> => {
    try {
      const added = await window.electron.ipcRenderer.invoke(
        "repo:openPicker",
        {},
      );
      if (added) await refreshRepos();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed to add repository");
    }
  };

  const handleSelectRepo = (repoPath: string): void => {
    setActiveRepo(repoPath);
    setGitStatus(null);
    setSelectedFile(null);
    setStagedDiff(null);
    setUnstagedDiff(null);
    refreshGitData(repoPath);
  };

  const handleRemoveRepo = async (repoPath: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke("repo:remove", { repoPath });
    if (activeRepo === repoPath) {
      setActiveRepo(null);
      setGitStatus(null);
      setSelectedFile(null);
      setStagedDiff(null);
      setUnstagedDiff(null);
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

  handleStageFileRef.current = handleStageFile;
  handleUnstageFileRef.current = handleUnstageFile;

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
    <div className="app" onMouseDown={handleGlobalMouseDown}>
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
              onFileSelect={setSelectedFile}
              onStageFile={handleStageFile}
              onUnstageFile={handleUnstageFile}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
              isFocused={focusedColumn === 2}
            />
            <DiffCanvas
              ref={diffCanvasRef}
              stagedDiff={stagedDiff}
              unstagedDiff={unstagedDiff}
              selectedFile={selectedFile}
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
  );
}

export default App;
