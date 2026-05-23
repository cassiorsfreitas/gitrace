import { JSX, useEffect, useRef } from "react";

export type HookPhase = "idle" | "running" | "success" | "failure";

export interface HookState {
  phase: HookPhase;
  output: string[];
  exitCode: number | null;
}

interface HookOutputPanelProps {
  hookState: HookState;
  isCommitting: boolean;
  onForceCommit: () => void;
}

export function HookOutputPanel({
  hookState,
  isCommitting,
  onForceCommit,
}: HookOutputPanelProps): JSX.Element | null {
  const { phase, output, exitCode } = hookState;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  if (phase === "idle") return null;

  return (
    <div className={`hook-output-panel hook-output-panel--${phase}`}>
      <div className="hook-output-header">
        {phase === "running" && <span className="hook-spinner" />}
        <span className="hook-output-title">
          {phase === "running" && "Running pre-commit\u2026"}
          {phase === "success" && "pre-commit passed"}
          {phase === "failure" && `pre-commit failed (exit ${exitCode})`}
        </span>
      </div>
      {output.length > 0 && (
        <div ref={scrollRef} className="hook-output-scroll">
          <pre className="hook-output-pre">{output.join("")}</pre>
        </div>
      )}
      {phase === "failure" && (
        <button
          className="hook-force-commit"
          onClick={onForceCommit}
          disabled={isCommitting}
        >
          Force commit (--no-verify)
        </button>
      )}
    </div>
  );
}
