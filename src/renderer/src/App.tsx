import { JSX, useCallback, useEffect, useState } from "react";
import type { GitStatus, IpcEventPayload } from "@shared/ipc";
import { FileTreePanel } from "./components/FileTreePanel";
import { DiffCanvas } from "./components/DiffCanvas";

function App(): JSX.Element {
  const [repos, setRepos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [stagedDiff, setStagedDiff] = useState<string | null>(null);
  const [unstagedDiff, setUnstagedDiff] = useState<string | null>(null);

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
    setError(null);
    try {
      const added = await window.electron.ipcRenderer.invoke(
        "repo:openPicker",
        {},
      );
      if (added) await refreshRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repository");
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

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="app-title">Gitrace</span>
        </div>
        <div className="sidebar-body">
          {repos.map((repo) => (
            <div
              key={repo}
              className={`repo-item${activeRepo === repo ? " repo-item--active" : ""}`}
              onClick={() => handleSelectRepo(repo)}
            >
              <span className="repo-name" title={repo}>
                {repo.split("/").pop()}
              </span>
              <button
                className="repo-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveRepo(repo);
                }}
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
        {activeRepo !== null ? (
          <>
            <FileTreePanel
              gitStatus={gitStatus}
              onFileSelect={setSelectedFile}
            />
            <DiffCanvas
              stagedDiff={stagedDiff}
              unstagedDiff={unstagedDiff}
              selectedFile={selectedFile}
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
