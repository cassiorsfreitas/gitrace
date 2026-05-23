import {
  JSX,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileDiff } from "@pierre/diffs/react";
import { processPatch } from "@pierre/diffs";
import type { AnnotationSide, FileDiffMetadata, Hunk } from "@pierre/diffs";

function findHunkForLine(
  hunks: Hunk[],
  lineNumber: number,
  side: AnnotationSide,
): number {
  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i];
    const start = side === "additions" ? hunk.additionStart : hunk.deletionStart;
    const count = side === "additions" ? hunk.additionCount : hunk.deletionCount;
    if (lineNumber >= start && lineNumber < start + count) {
      return i;
    }
  }
  return -1;
}

function extractHunkPatch(
  rawDiff: string,
  fileName: string,
  hunkIndex: number,
): string | null {
  const sections = rawDiff.split(/^(?=diff --git )/m);
  const section = sections.find((s) =>
    s.split("\n").some((l) => l === `+++ b/${fileName}`),
  );
  if (!section) return null;

  const firstHunkPos = section.search(/^@@/m);
  if (firstHunkPos < 0) return null;

  const header = section.slice(0, firstHunkPos);
  const hunksStr = section.slice(firstHunkPos);
  const hunkParts = hunksStr.split(/(?=^@@ )/m);

  if (hunkIndex >= hunkParts.length) return null;
  return header + hunkParts[hunkIndex];
}

export interface DiffCanvasHandle {
  scrollLineDown(): void;
  scrollLineUp(): void;
  scrollToNextFile(): void;
  scrollToPrevFile(): void;
}

interface DiffCanvasProps {
  stagedDiff: string | null;
  unstagedDiff: string | null;
  selectedFile: string | null;
  onStageHunk: (patch: string) => void;
  onUnstageHunk: (patch: string) => void;
}

export const DiffCanvas = forwardRef<DiffCanvasHandle, DiffCanvasProps>(
  function DiffCanvas(
    { stagedDiff, unstagedDiff, selectedFile, onStageHunk, onUnstageHunk },
    ref,
  ): JSX.Element {
    const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(
      () => new Set(),
    );
    const [diffStyle, setDiffStyle] = useState<"unified" | "split">("unified");
    const fileRefs = useRef(new Map<string, HTMLDivElement>());
    const scrollRef = useRef<HTMLDivElement>(null);
    const navFileIndexRef = useRef<number>(-1);

    const onStageHunkRef = useRef(onStageHunk);
    onStageHunkRef.current = onStageHunk;

    const onUnstageHunkRef = useRef(onUnstageHunk);
    onUnstageHunkRef.current = onUnstageHunk;

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

    // Reset nav index when file list changes
    useEffect(() => {
      navFileIndexRef.current = -1;
    }, [stagedFiles, unstagedFiles]);

    useEffect(() => {
      if (!selectedFile) return;
      const el = fileRefs.current.get(selectedFile);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [selectedFile]);

    useImperativeHandle(
      ref,
      () => ({
        scrollLineDown(): void {
          scrollRef.current?.scrollBy({ top: 20 });
        },
        scrollLineUp(): void {
          scrollRef.current?.scrollBy({ top: -20 });
        },
        scrollToNextFile(): void {
          const allNames = [
            ...stagedFiles.map((f) => f.name),
            ...unstagedFiles.map((f) => f.name),
          ];
          if (allNames.length === 0) return;
          navFileIndexRef.current = Math.min(
            navFileIndexRef.current + 1,
            allNames.length - 1,
          );
          fileRefs.current
            .get(allNames[navFileIndexRef.current])
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        scrollToPrevFile(): void {
          const allNames = [
            ...stagedFiles.map((f) => f.name),
            ...unstagedFiles.map((f) => f.name),
          ];
          if (allNames.length === 0) return;
          navFileIndexRef.current = Math.max(navFileIndexRef.current - 1, 0);
          fileRefs.current
            .get(allNames[navFileIndexRef.current])
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      }),
      [stagedFiles, unstagedFiles],
    );

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
        enableGutterUtility: true,
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

    const makeGutterUtility = useCallback(
      (file: FileDiffMetadata, rawDiff: string, isStaged: boolean) =>
        (
          getHoveredLine: () => { lineNumber: number; side: AnnotationSide } | undefined,
        ): JSX.Element => {
          const handleClick = (): void => {
            const hovered = getHoveredLine();
            if (!hovered) return;
            const hunkIdx = findHunkForLine(
              file.hunks,
              hovered.lineNumber,
              hovered.side,
            );
            if (hunkIdx < 0) return;
            const patch = extractHunkPatch(rawDiff, file.name, hunkIdx);
            if (!patch) return;
            if (isStaged) {
              onUnstageHunkRef.current(patch);
            } else {
              onStageHunkRef.current(patch);
            }
          };
          return (
            <button className="stage-hunk-btn" onClick={handleClick}>
              {isStaged ? "Unstage hunk" : "Stage hunk"}
            </button>
          );
        },
      [],
    );

    const renderSection = (
      files: FileDiffMetadata[],
      label: string,
      rawDiff: string | null,
      isStaged: boolean,
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
                    renderGutterUtility={
                      rawDiff
                        ? makeGutterUtility(file, rawDiff, isStaged)
                        : undefined
                    }
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
        <div className="diff-canvas-scroll" ref={scrollRef}>
          {stagedDiff === null && unstagedDiff === null ? (
            <div className="diff-canvas-empty">
              Select a repository to view diffs.
            </div>
          ) : (
            <>
              {renderSection(stagedFiles, "Staged", stagedDiff, true)}
              {renderSection(unstagedFiles, "Unstaged", unstagedDiff, false)}
            </>
          )}
        </div>
      </div>
    );
  },
);
