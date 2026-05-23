import { JSX } from "react";
import type { FileStatus, GitStatus, TrackedFile } from "@shared/ipc";

const STATUS_LABEL: Record<FileStatus, string> = {
  M: "M",
  A: "A",
  D: "D",
  R: "R",
  C: "C",
  "?": "U",
};

const STATUS_CLASS: Record<FileStatus, string> = {
  M: "status-modified",
  A: "status-added",
  D: "status-deleted",
  R: "status-renamed",
  C: "status-added",
  "?": "status-untracked",
};

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function dirname(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx > 0 ? p.slice(0, idx) : "";
}

interface FileRowProps {
  file: TrackedFile;
  checked: boolean;
  focused: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function FileRow({ file, checked, focused, onToggle, onSelect }: FileRowProps): JSX.Element {
  const name = basename(file.path);
  const dir = dirname(file.path);

  return (
    <div
      className={`file-row${focused ? " file-row--focused" : ""}`}
      onClick={() => onSelect(file.path)}
    >
      <input
        type="checkbox"
        className="file-row-checkbox"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(file.path);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <span className={`file-row-status ${STATUS_CLASS[file.status]}`}>
        {STATUS_LABEL[file.status]}
      </span>
      <div className="file-row-info">
        <span className="file-row-name">{name}</span>
        {dir && <span className="file-row-dir">{dir}</span>}
      </div>
    </div>
  );
}

interface FileTreePanelProps {
  gitStatus: GitStatus | null;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  onStageFile: (path: string) => void;
  onUnstageFile: (path: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  isFocused?: boolean;
}

export function FileTreePanel({
  gitStatus,
  selectedFile,
  onFileSelect,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  isFocused,
}: FileTreePanelProps): JSX.Element {
  const staged = gitStatus?.staged ?? [];
  const unstaged = gitStatus?.unstaged ?? [];

  return (
    <div className={`file-tree-panel${isFocused ? ' file-tree-panel--focused' : ''}`}>
      <section className="file-tree-section">
        <div className="file-tree-section-header">
          <span>Staged</span>
          <div className="file-tree-section-actions">
            <span className="file-count">{staged.length}</span>
            {staged.length > 0 && (
              <button className="file-tree-action-btn" onClick={onUnstageAll}>
                Unstage All
              </button>
            )}
          </div>
        </div>
        {staged.length > 0 ? (
          <div className="file-list">
            {staged.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                checked={true}
                focused={file.path === selectedFile}
                onToggle={onUnstageFile}
                onSelect={onFileSelect}
              />
            ))}
          </div>
        ) : (
          <div className="file-tree-empty">No staged changes</div>
        )}
      </section>

      <section className="file-tree-section">
        <div className="file-tree-section-header">
          <span>Unstaged</span>
          <div className="file-tree-section-actions">
            <span className="file-count">{unstaged.length}</span>
            {unstaged.length > 0 && (
              <button className="file-tree-action-btn" onClick={onStageAll}>
                Stage All
              </button>
            )}
          </div>
        </div>
        {unstaged.length > 0 ? (
          <div className="file-list">
            {unstaged.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                checked={false}
                focused={file.path === selectedFile}
                onToggle={onStageFile}
                onSelect={onFileSelect}
              />
            ))}
          </div>
        ) : (
          <div className="file-tree-empty">No unstaged changes</div>
        )}
      </section>
    </div>
  );
}
