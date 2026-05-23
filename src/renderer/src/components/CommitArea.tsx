import { JSX, useCallback, useRef, useState } from "react";

interface CommitAreaProps {
  stagedCount: number;
  onCommit: (message: string) => Promise<void>;
  onAmend: (message: string) => Promise<void>;
}

export function CommitArea({
  stagedCount,
  onCommit,
  onAmend,
}: CommitAreaProps): JSX.Element {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDisabled = stagedCount === 0;

  const handleCommit = useCallback(async () => {
    if (isDisabled || !message.trim()) return;
    await onCommit(message.trim());
    setMessage("");
  }, [isDisabled, message, onCommit]);

  const handleAmend = useCallback(async () => {
    if (!message.trim()) return;
    await onAmend(message.trim());
    setMessage("");
  }, [message, onAmend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit],
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
        disabled={isDisabled}
      />
      <div className="commit-actions">
        <button
          className="commit-btn commit-btn--primary"
          onClick={handleCommit}
          disabled={isDisabled || !message.trim()}
        >
          Commit
        </button>
        <button
          className="commit-btn"
          onClick={handleAmend}
          disabled={!message.trim()}
        >
          Amend
        </button>
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
