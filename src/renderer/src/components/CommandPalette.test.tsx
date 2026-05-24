import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { CommandPalette } from './CommandPalette'
import type { CommandDefinition } from './CommandPalette'

const noop = vi.fn()

const stageAction = vi.fn()
const commitAction = vi.fn()

const sampleCommands: CommandDefinition[] = [
  { id: 'stage', label: 'Stage file', group: 'Staging', action: stageAction },
  { id: 'commit', label: 'Commit changes', group: 'Commit', action: commitAction, bindingKey: 'commit' },
  { id: 'next', label: 'Next file', group: 'Navigation', action: noop },
]

const getBinding = vi.fn((action: string) => {
  if (action === 'commit') return 'Cmd+Enter'
  return undefined
})

function renderPalette(open = true, commands = sampleCommands) {
  const onClose = vi.fn()
  render(
    <CommandPalette
      open={open}
      onClose={onClose}
      commands={commands}
      getBinding={getBinding}
    />,
  )
  return { onClose }
}

describe('CommandPalette', () => {
  it('renders nothing when open is false', () => {
    renderPalette(false)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Stage file')).not.toBeInTheDocument()
  })

  it('renders the input when open', () => {
    renderPalette()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders group headings', () => {
    renderPalette()
    expect(screen.getByText('Staging')).toBeInTheDocument()
    expect(screen.getByText('Commit')).toBeInTheDocument()
    expect(screen.getByText('Navigation')).toBeInTheDocument()
  })

  it('renders command labels', () => {
    renderPalette()
    expect(screen.getByText('Stage file')).toBeInTheDocument()
    expect(screen.getByText('Commit changes')).toBeInTheDocument()
    expect(screen.getByText('Next file')).toBeInTheDocument()
  })

  it('renders keybind badge when bindingKey resolves to a binding', () => {
    renderPalette()
    // formatKeybind('Cmd+Enter') → '⌘↩'
    expect(screen.getByText('⌘↩')).toBeInTheDocument()
  })

  it('does not render a keybind badge for commands without bindingKey', () => {
    renderPalette()
    // Only 'Commit changes' has a bindingKey, so only one <kbd> should exist
    const kbds = document.querySelectorAll('kbd')
    expect(kbds).toHaveLength(1)
  })

  it('calls onClose when Escape is pressed', async () => {
    const { onClose } = renderPalette()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls action and onClose when a command is selected', async () => {
    const { onClose } = renderPalette()
    await userEvent.click(screen.getByText('Stage file'))
    expect(stageAction).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('filters results when typing in the input', async () => {
    renderPalette()
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'Stage')
    // The matching item should be present and visible
    expect(screen.getByText('Stage file')).toBeVisible()
    // Non-matching items are removed from the DOM by cmdk
    expect(screen.queryByText('Commit changes')).not.toBeInTheDocument()
    expect(screen.queryByText('Next file')).not.toBeInTheDocument()
  })
})
