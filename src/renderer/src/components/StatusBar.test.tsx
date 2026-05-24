import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { StatusBar } from './StatusBar'
import type { HookState } from './HookOutputPanel'

const baseProps = {
  branchName: 'main',
  ahead: 0,
  behind: 0,
  changedCount: 0,
  hookState: { phase: 'idle', output: [], exitCode: null } as HookState,
  remoteName: 'origin',
  appVersion: '1.2.3',
  onOpenPalette: vi.fn(),
}

describe('StatusBar', () => {
  describe('left zone', () => {
    it('renders the branch name', () => {
      render(<StatusBar {...baseProps} />)
      expect(screen.getByText('main')).toBeInTheDocument()
    })

    it('renders ahead count when ahead > 0', () => {
      render(<StatusBar {...baseProps} ahead={3} />)
      expect(screen.getByText('↑3')).toBeInTheDocument()
    })

    it('renders behind count when behind > 0', () => {
      render(<StatusBar {...baseProps} behind={2} />)
      expect(screen.getByText('↓2')).toBeInTheDocument()
    })

    it('renders changed file count when changedCount > 0', () => {
      render(<StatusBar {...baseProps} changedCount={5} />)
      expect(screen.getByText('5 changed')).toBeInTheDocument()
    })

    it('does not render ahead/behind when both are zero', () => {
      render(<StatusBar {...baseProps} ahead={0} behind={0} />)
      expect(screen.queryByText(/↑/)).not.toBeInTheDocument()
      expect(screen.queryByText(/↓/)).not.toBeInTheDocument()
    })

    it('does not render changed count when zero', () => {
      render(<StatusBar {...baseProps} changedCount={0} />)
      expect(screen.queryByText(/changed/)).not.toBeInTheDocument()
    })
  })

  describe('centre zone', () => {
    it('calls onOpenPalette when the palette button is clicked', async () => {
      const onOpenPalette = vi.fn()
      render(<StatusBar {...baseProps} onOpenPalette={onOpenPalette} />)
      await userEvent.click(screen.getByRole('button', { name: /run command/i }))
      expect(onOpenPalette).toHaveBeenCalledOnce()
    })
  })

  describe('right zone – hook state', () => {
    it('renders "hooks ready" when phase is idle', () => {
      const hookState: HookState = { phase: 'idle', output: [], exitCode: null }
      render(<StatusBar {...baseProps} hookState={hookState} />)
      expect(screen.getByText('hooks ready')).toBeInTheDocument()
    })

    it('renders "running" when phase is running', () => {
      const hookState: HookState = { phase: 'running', output: [], exitCode: null }
      render(<StatusBar {...baseProps} hookState={hookState} />)
      expect(screen.getByText('running')).toBeInTheDocument()
    })

    it('renders "hooks failed" when phase is failure', () => {
      const hookState: HookState = { phase: 'failure', output: [], exitCode: 1 }
      render(<StatusBar {...baseProps} hookState={hookState} />)
      expect(screen.getByText('hooks failed')).toBeInTheDocument()
    })

    it('renders "hooks ready" when phase is success', () => {
      const hookState: HookState = { phase: 'success', output: [], exitCode: 0 }
      render(<StatusBar {...baseProps} hookState={hookState} />)
      expect(screen.getByText('hooks ready')).toBeInTheDocument()
    })

    it('renders the remote name', () => {
      render(<StatusBar {...baseProps} remoteName="upstream" />)
      expect(screen.getByText('upstream')).toBeInTheDocument()
    })

    it('renders the app version prefixed with v', () => {
      render(<StatusBar {...baseProps} appVersion="2.0.0" />)
      expect(screen.getByText('v2.0.0')).toBeInTheDocument()
    })
  })
})
