import { JSX, useCallback, useRef, useState } from "react";
import { HookOutputPanel, type HookState } from "./HookOutputPanel";

interface CommitAreaProps {
  stagedCount: number;
  hookState: HookState;
  onCommit: (message: string) => Promise<void>;
  onAmend: (message: string) => Promise<void>;
  onGetLastCommitMessage: () => Promise<string>;
  onForceCommit: (message: string) => Promise<void>;
}

export function CommitArea({
  stagedCount,
  hookState,
  onCommit,
  onAmend,
  onGetLastCommitMessage,
  onForceCommit,
}: CommitAreaProps): JSX.Element {
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit =
    !isCommitting &&
    (amend ? !!message.trim() : stagedCount > 0 && !!message.trim());

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsCommitting(true);
    try {
      if (amend) {
        await onAmend(message.trim());
        setMessage("");
        setAmend(false);
      } else {
        await onCommit(message.trim());
        setMessage("");
        setAmend(false);
      }
    } catch {
      // Hook failed — hookState in parent shows the failure UI.
      // Keep the message so the user can force-commit.
    } finally {
      setIsCommitting(false);
    }
  }, [canSubmit, amend, message, onAmend, onCommit]);

  const handleForceCommit = useCallback(async () => {
    if (!message.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      await onForceCommit(message.trim());
      setMessage("");
      setAmend(false);
    } finally {
      setIsCommitting(false);
    }
  }, [message, isCommitting, onForceCommit]);

  const handleAmendToggle = useCallback(
    async (checked: boolean) => {
      setAmend(checked);
      if (checked) {
        const lastMsg = await onGetLastCommitMessage();
        setMessage(lastMsg);
      } else {
        setMessage("");
      }
    },
    [onGetLastCommitMessage],
  );

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
    <div className="commit-area">
      <textarea
        ref={textareaRef}
        className="commit-message"
        placeholder="Commit message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!amend && stagedCount === 0}
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
          {amend ? "Amend" : "Commit"}
        </button>
        <label className="commit-amend-label">
          <input
            type="checkbox"
            checked={amend}
            onChange={(e) => handleAmendToggle(e.target.checked)}
          />
          Amend
        </label>
      </div>
      <div className="commit-actions">
        <button className="commit-btn commit-btn--placeholder" disabled>
          Commit &amp; Push
        </button>
        <button className="commit-btn commit-btn--placeholder" disabled>
          AI generation
        </button>
      </div>
    </div>
  );
}
