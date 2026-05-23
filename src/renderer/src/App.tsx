import { JSX, useCallback, useEffect, useState } from "react";
import type { GitStatus, IpcEventPayload } from "@shared/ipc";
import { FileTreePanel } from "./components/FileTreePanel";
import { DiffCanvas } from "./components/DiffCanvas";
import { NavRail } from "./components/NavRail";
import { CommitArea } from "./components/CommitArea";

function App(): JSX.Element {
  const [repos, setRepos] = useState<string[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [stagedDiff, setStagedDiff] = useState<string | null>(null);
  const [unstagedDiff, setUnstagedDiff] = useState<string | null>(null);

  const changedFilesCount =
    (gitStatus?.staged.length ?? 0) + (gitStatus?.unstaged.length ?? 0);

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

  return (
    <div className="app">
      <NavRail
        repos={repos}
        activeRepo={activeRepo}
        changedFilesCount={changedFilesCount}
        onSelectRepo={handleSelectRepo}
        onAddRepo={handleAddRepo}
        onRemoveRepo={handleRemoveRepo}
      />
      <div className="main-content">
        {activeRepo !== null ? (
          <>
            <FileTreePanel
              gitStatus={gitStatus}
              onFileSelect={setSelectedFile}
              onStageFile={handleStageFile}
              onUnstageFile={handleUnstageFile}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
            />
            <DiffCanvas
              stagedDiff={stagedDiff}
              unstagedDiff={unstagedDiff}
              selectedFile={selectedFile}
              onStageHunk={handleStageHunk}
              onUnstageHunk={handleUnstageHunk}
            />
            <CommitArea
              stagedCount={gitStatus?.staged.length ?? 0}
              onCommit={handleCommit}
              onAmend={handleAmend}
              onGetLastCommitMessage={handleGetLastCommitMessage}
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
