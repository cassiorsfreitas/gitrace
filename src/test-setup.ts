import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

// cmdk uses ResizeObserver and scrollIntoView internally; jsdom doesn't include them
global.ResizeObserver = class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Element.prototype.scrollIntoView = (): void => {}

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: vi.fn().mockResolvedValue({}),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  writable: true,
  configurable: true,
})
