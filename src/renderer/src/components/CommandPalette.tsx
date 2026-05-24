import React, { useEffect } from "react";
import { Command } from "cmdk";
import { Layers, GitCommit, Compass, GitBranch, Settings } from "lucide-react";
import { formatKeybind } from "../utils/formatKeybind";
import "./CommandPalette.css";

export interface CommandDefinition {
  id: string;
  label: string;
  group: "Staging" | "Commit" | "Navigation" | "Repository" | "App";
  action: () => void;
  bindingKey?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandDefinition[];
  getBinding: (action: string) => string | undefined;
}

const GROUPS: CommandDefinition["group"][] = [
  "Staging",
  "Commit",
  "Navigation",
  "Repository",
  "App",
];

const GROUP_ICONS: Record<CommandDefinition["group"], React.ReactElement> = {
  Staging: <Layers size={13} strokeWidth={1.5} />,
  Commit: <GitCommit size={13} strokeWidth={1.5} />,
  Navigation: <Compass size={13} strokeWidth={1.5} />,
  Repository: <GitBranch size={13} strokeWidth={1.5} />,
  App: <Settings size={13} strokeWidth={1.5} />,
};

export function CommandPalette({
  open,
  onClose,
  commands,
  getBinding,
}: CommandPaletteProps): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="cmd-palette-backdrop" onClick={onClose} />
      <div className="cmd-palette-container">
        <Command className="cmd-palette">
          <Command.Input
            className="cmd-palette-input"
            placeholder="Run command..."
            autoFocus
          />
          <Command.List className="cmd-palette-list">
            <Command.Empty className="cmd-palette-empty">
              No results found.
            </Command.Empty>
            {GROUPS.map((group) => {
              const groupCommands = commands.filter((c) => c.group === group);
              if (groupCommands.length === 0) return null;
              return (
                <Command.Group
                  key={group}
                  heading={group}
                  className="cmd-palette-group"
                >
                  {groupCommands.map((cmd) => {
                    const rawBinding = cmd.bindingKey
                      ? getBinding(cmd.bindingKey)
                      : undefined;
                    const formattedBinding = rawBinding
                      ? formatKeybind(rawBinding)
                      : undefined;
                    return (
                      <Command.Item
                        key={cmd.id}
                        value={cmd.label}
                        className="cmd-palette-item"
                        onSelect={(): void => {
                          cmd.action();
                          onClose();
                        }}
                      >
                        <span className="cmd-palette-item-icon">
                          {GROUP_ICONS[cmd.group]}
                        </span>
                        <span className="cmd-palette-item-label">
                          {cmd.label}
                        </span>
                        {formattedBinding && (
                          <kbd className="cmd-palette-keybind">
                            {formattedBinding}
                          </kbd>
                        )}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </>
  );
}
