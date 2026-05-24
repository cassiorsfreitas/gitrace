import { JSX, useCallback, useEffect, useRef, useState } from "react";
import { GitCommit } from "lucide-react";
import { HookOutputPanel, type HookState } from "./HookOutputPanel";

interface CommitAreaProps {
  stagedCount: number;
  hookState: HookState;
  branchName?: string;
  onCommit: (message: string) => Promise<void>;
  onAmend: (message: string) => Promise<void>;
  onGetLastCommitMessage: () => Promise<string>;
  onForceCommit: (message: string) => Promise<void>;
  isFocused: boolean;
}

export function CommitArea({
  stagedCount,
  hookState,
  branchName,
  onCommit,
  onAmend,
  onGetLastCommitMessage,
  onForceCommit,
  isFocused,
}: CommitAreaProps): JSX.Element {
  const [message, setMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isFocused) textareaRef.current?.focus();
  }, [isFocused]);

  const canSubmit = !isCommitting && stagedCount > 0 && !!message.trim();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsCommitting(true);
    try {
      await onCommit(message.trim());
      setMessage("");
    } catch {
      // Hook failed — hookState in parent shows the failure UI.
    } finally {
      setIsCommitting(false);
    }
  }, [canSubmit, message, onCommit]);

  const handleAmendClick = useCallback(async () => {
    if (isCommitting) return;
    if (!message.trim()) {
      const lastMsg = await onGetLastCommitMessage();
      setMessage(lastMsg);
      return;
    }
    setIsCommitting(true);
    try {
      await onAmend(message.trim());
      setMessage("");
    } catch {
      // Hook failed — hookState in parent shows the failure UI.
    } finally {
      setIsCommitting(false);
    }
  }, [isCommitting, message, onAmend, onGetLastCommitMessage]);

  const handleForceCommit = useCallback(async () => {
    if (!message.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      await onForceCommit(message.trim());
      setMessage("");
    } finally {
      setIsCommitting(false);
    }
  }, [message, isCommitting, onForceCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className={`commit-area${isFocused ? ' commit-area--focused' : ''}`}>
      <textarea
        ref={textareaRef}
        className="commit-message"
        placeholder="Commit message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={stagedCount === 0}
      />
      <HookOutputPanel
        hookState={hookState}
        isCommitting={isCommitting}
        onForceCommit={handleForceCommit}
      />
      <div className="commit-actions">
        <button
          className="commit-btn commit-btn--primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          <GitCommit size={14} strokeWidth={1.5} />
          Commit{branchName ? ` to ${branchName}` : ''}
          <kbd className="commit-btn-badge">⌘↵</kbd>
        </button>
        <button
          className="commit-btn commit-btn--icon commit-btn--placeholder"
          disabled
          title="AI generation (coming soon)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 1L8.29 5.21L12.5 7L8.29 8.79L7 13L5.71 8.79L1.5 7L5.71 5.21L7 1Z" fill="currentColor"/>
            <path d="M11.5 1.5L12.2 3.3L14 4L12.2 4.7L11.5 6.5L10.8 4.7L9 4L10.8 3.3L11.5 1.5Z" fill="currentColor" opacity="0.6"/>
          </svg>
        </button>
      </div>
      <div className="commit-actions">
        <button className="commit-btn commit-btn--placeholder" disabled>
          Commit &amp; Push
        </button>
        <button
          className="commit-btn"
          onClick={handleAmendClick}
          disabled={isCommitting}
        >
          Amend
        </button>
      </div>
    </div>
  );
}
