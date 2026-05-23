import { JSX, useState } from "react";

interface NavRailProps {
  repos: string[];
  activeRepo: string | null;
  changedFilesCount: number;
  onSelectRepo: (path: string) => void;
  onAddRepo: () => Promise<void>;
  onRemoveRepo: (path: string) => void;
}

export function NavRail({
  repos,
  activeRepo,
  changedFilesCount,
  onSelectRepo,
  onAddRepo,
  onRemoveRepo,
}: NavRailProps): JSX.Element {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeRepoName = activeRepo
    ? (activeRepo.split("/").pop() ?? activeRepo)
    : "Select Repository";

  const handleAddRepo = async (): Promise<void> => {
    await onAddRepo();
    setDropdownOpen(false);
  };

  return (
    <nav className="nav-rail">
      {/* Empty area reserved for macOS traffic lights */}
      <div className="nav-rail-traffic-spacer" />

      {/* Repo dropdown — below traffic lights, above nav items */}
      <div className="nav-rail-repo-section">
        <button
          className="repo-dropdown-trigger"
          onClick={() => setDropdownOpen((o) => !o)}
          title={activeRepo ?? undefined}
        >
          <span className="repo-dropdown-name">{activeRepoName}</span>
          <span className="repo-dropdown-chevron">
            {dropdownOpen ? "▲" : "▼"}
          </span>
        </button>

        {dropdownOpen && (
          <>
            <div
              className="repo-dropdown-overlay"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="repo-dropdown-menu">
              {repos.map((repo) => (
                <div
                  key={repo}
                  className={`repo-dropdown-item${
                    activeRepo === repo ? " repo-dropdown-item--active" : ""
                  }`}
                >
                  <span
                    className="repo-dropdown-item-name"
                    title={repo}
                    onClick={() => {
                      onSelectRepo(repo);
                      setDropdownOpen(false);
                    }}
                  >
                    {repo.split("/").pop()}
                  </span>
                  <button
                    className="repo-dropdown-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRepo(repo);
                    }}
                    title="Remove repository"
                  >
                    ×
                  </button>
                </div>
              ))}
              {repos.length === 0 && (
                <div className="repo-dropdown-empty">No repositories added</div>
              )}
              <button className="repo-dropdown-add" onClick={handleAddRepo}>
                + Add Repository
              </button>
            </div>
          </>
        )}
      </div>

      <div className="nav-rail-items">
        <button className="nav-item nav-item--active">
          <span className="nav-item-label">Changes</span>
          {changedFilesCount > 0 && (
            <span className="nav-item-badge">{changedFilesCount}</span>
          )}
        </button>
        <button className="nav-item nav-item--disabled" disabled>
          <span className="nav-item-label">History</span>
        </button>
        <button className="nav-item nav-item--disabled" disabled>
          <span className="nav-item-label">Branches</span>
        </button>
        <button className="nav-item nav-item--disabled" disabled>
          <span className="nav-item-label">Worktrees</span>
        </button>
      </div>

      <div className="nav-rail-footer">
        <button className="nav-item nav-item--disabled" disabled>
          <span className="nav-item-label">Settings</span>
        </button>
      </div>
    </nav>
  );
}
