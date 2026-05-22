import { describe, expect, it } from 'vitest'
import { IPC, type IpcChannel } from '../ipc'

describe('IPC channel definitions', () => {
  it('IPC constants are strings matching IpcChannel type', () => {
    const channels = Object.values(IPC) as IpcChannel[]
    expect(channels.length).toBeGreaterThan(0)
    for (const ch of channels) {
      expect(typeof ch).toBe('string')
    }
  })

  it('git:getStatus channel is defined', () => {
    expect(IPC.GIT_STATUS).toBe('git:getStatus')
  })

  it('git:commit channel is defined', () => {
    expect(IPC.GIT_COMMIT).toBe('git:commit')
  })

  it('repo channels are defined', () => {
    expect(IPC.REPO_GET_ALL).toBe('repo:getAll')
    expect(IPC.REPO_ADD).toBe('repo:add')
    expect(IPC.REPO_REMOVE).toBe('repo:remove')
  })
})
