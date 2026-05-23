import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDiff } from "@pierre/diffs/react";
import { processPatch } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs";

interface DiffCanvasProps {
  stagedDiff: string | null;
  unstagedDiff: string | null;
  selectedFile: string | null;
}

export function DiffCanvas({
  stagedDiff,
  unstagedDiff,
  selectedFile,
}: DiffCanvasProps): JSX.Element {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(
    () => new Set(),
  );
  const [diffStyle, setDiffStyle] = useState<"unified" | "split">("unified");
  const fileRefs = useRef(new Map<string, HTMLDivElement>());

  const stagedFiles = useMemo((): FileDiffMetadata[] => {
    if (!stagedDiff) return [];
    try {
      return processPatch(stagedDiff, "staged").files;
    } catch {
      return [];
    }
  }, [stagedDiff]);

  const unstagedFiles = useMemo((): FileDiffMetadata[] => {
    if (!unstagedDiff) return [];
    try {
      return processPatch(unstagedDiff, "unstaged").files;
    } catch {
      return [];
    }
  }, [unstagedDiff]);

  useEffect(() => {
    if (!selectedFile) return;
    const el = fileRefs.current.get(selectedFile);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedFile]);

  const toggleCollapse = useCallback((filename: string): void => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  }, []);

  const options = useMemo(
    () => ({
      diffStyle,
      theme: { dark: "pierre-dark" as const, light: "pierre-light" as const },
    }),
    [diffStyle],
  );

  const renderHeaderPrefix = useCallback(
    (fd: FileDiffMetadata) => (
      <button
        className="diff-collapse-btn"
        onClick={() => toggleCollapse(fd.name)}
      >
        ▼
      </button>
    ),
    [toggleCollapse],
  );

  const renderSection = (
    files: FileDiffMetadata[],
    label: string,
  ): JSX.Element => (
    <section className="diff-section">
      <div className="diff-section-header">
        <span>{label}</span>
        <span className="file-count">{files.length}</span>
      </div>
      {files.length === 0 ? (
        <div className="diff-section-empty">
          No {label.toLowerCase()} changes
        </div>
      ) : (
        files.map((file) => {
          const collapsed = collapsedFiles.has(file.name);
          return (
            <div
              key={file.name}
              className="diff-file-wrapper"
              ref={(el): void => {
                if (el) fileRefs.current.set(file.name, el);
                else fileRefs.current.delete(file.name);
              }}
            >
              {collapsed ? (
                <div
                  className="diff-file-collapsed"
                  onClick={() => toggleCollapse(file.name)}
                >
                  <span className="collapse-icon">▶</span>
                  <span className="diff-filename">{file.name}</span>
                </div>
              ) : (
                <FileDiff
                  fileDiff={file}
                  options={options}
                  renderHeaderPrefix={renderHeaderPrefix}
                  disableWorkerPool
                />
              )}
            </div>
          );
        })
      )}
    </section>
  );

  return (
    <div className="diff-canvas">
      <div className="diff-canvas-toolbar">
        <div className="layout-toggle-group">
          <button
            className={`layout-toggle${diffStyle === "unified" ? " layout-toggle--active" : ""}`}
            onClick={() => setDiffStyle("unified")}
          >
            Unified
          </button>
          <button
            className={`layout-toggle${diffStyle === "split" ? " layout-toggle--active" : ""}`}
            onClick={() => setDiffStyle("split")}
          >
            Split
          </button>
        </div>
      </div>
      <div className="diff-canvas-scroll">
        {stagedDiff === null && unstagedDiff === null ? (
          <div className="diff-canvas-empty">
            Select a repository to view diffs.
          </div>
        ) : (
          <>
            {renderSection(stagedFiles, "Staged")}
            {renderSection(unstagedFiles, "Unstaged")}
          </>
        )}
      </div>
    </div>
  );
}
