import { JSX, useState, useEffect } from "react";
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
  onContextMenu: (e: React.MouseEvent, path: string, isStaged: boolean) => void;
  isStaged: boolean;
}

function FileRow({
  file,
  checked,
  focused,
  onToggle,
  onSelect,
  onContextMenu,
  isStaged,
}: FileRowProps): JSX.Element {
  const name = basename(file.path);
  const dir = dirname(file.path);

  return (
    <div
      className={`file-row${focused ? " file-row--focused" : ""}`}
      onClick={() => onSelect(file.path)}
      onContextMenu={(e) => onContextMenu(e, file.path, isStaged)}
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
      {(file.added !== undefined || file.removed !== undefined) && (
        <div className="file-row-stat">
          {!!file.added && (
            <span className="file-row-stat-added">+{file.added}</span>
          )}
          {!!file.removed && (
            <span className="file-row-stat-removed">−{file.removed}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface CtxMenu {
  x: number;
  y: number;
  filePath: string;
  isStaged: boolean;
}

interface FileTreePanelProps {
  gitStatus: GitStatus | null;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  onStageFile: (path: string) => void;
  onUnstageFile: (path: string) => void;
  onDiscardFile: (path: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onOpenInEditor: (path: string) => void;
  isFocused?: boolean;
}

export function FileTreePanel({
  gitStatus,
  selectedFile,
  onFileSelect,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll,
  onUnstageAll,
  onOpenInEditor,
  isFocused,
}: FileTreePanelProps): JSX.Element {
  const staged = gitStatus?.staged ?? [];
  const unstaged = gitStatus?.unstaged ?? [];
  const totalFiles = staged.length + unstaged.length;

  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (): void => setCtxMenu(null);
    document.addEventListener('keydown', close);
    return (): void => document.removeEventListener('keydown', close);
  }, [ctxMenu]);

  const handleContextMenu = (e: React.MouseEvent, filePath: string, isStaged: boolean): void => {
    e.preventDefault();
    onFileSelect(filePath);
    setCtxMenu({ x: e.clientX, y: e.clientY, filePath, isStaged });
  };

  return (
    <div
      className={`file-tree-panel${isFocused ? " file-tree-panel--focused" : ""}`}
    >
      <div className="file-tree-panel-header">
        <span>Working Tree</span>
        <span className="file-tree-panel-total">
          {totalFiles} {totalFiles === 1 ? "file" : "files"}
        </span>
      </div>

      <section className="file-tree-section">
        <div className="file-tree-section-header">
          <span className="file-tree-status-title">Staged Changes</span>
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
                onContextMenu={handleContextMenu}
                isStaged={true}
              />
            ))}
          </div>
        ) : (
          <div className="file-tree-empty">No staged changes</div>
        )}
      </section>

      <section className="file-tree-section">
        <div className="file-tree-section-header">
          <span className="file-tree-status-title">Changes</span>
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
                onContextMenu={handleContextMenu}
                isStaged={false}
              />
            ))}
          </div>
        ) : (
          <div className="file-tree-empty">No unstaged changes</div>
        )}
      </section>

      {ctxMenu && (
        <>
          <div
            className="ctx-menu-backdrop"
            onMouseDown={() => setCtxMenu(null)}
          />
          <div
            className="ctx-menu"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              className="ctx-menu-item"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                onOpenInEditor(ctxMenu.filePath);
                setCtxMenu(null);
              }}
            >
              Open in Editor
            </button>
            {!ctxMenu.isStaged && (
              <button
                className="ctx-menu-item ctx-menu-item--destructive"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onDiscardFile(ctxMenu.filePath);
                  setCtxMenu(null);
                }}
              >
                Discard Changes
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
