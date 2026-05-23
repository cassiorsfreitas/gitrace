import { JSX, useCallback, useRef, useState } from "react";

interface CommitAreaProps {
  stagedCount: number;
  onCommit: (message: string) => Promise<void>;
  onAmend: (message: string) => Promise<void>;
  onGetLastCommitMessage: () => Promise<string>;
}

export function CommitArea({
  stagedCount,
  onCommit,
  onAmend,
  onGetLastCommitMessage,
}: CommitAreaProps): JSX.Element {
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = amend
    ? !!message.trim()
    : stagedCount > 0 && !!message.trim();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    if (amend) {
      await onAmend(message.trim());
    } else {
      await onCommit(message.trim());
    }
    setMessage("");
    setAmend(false);
  }, [canSubmit, amend, message, onAmend, onCommit]);

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
