import { describe, expect, it, vi } from 'vitest'

const serverEntry = vi.hoisted(() => ({ loaded: false }))

vi.mock('../server-main.js', () => {
  serverEntry.loaded = true
  return {}
})

describe('package entry point', () => {
  it('exports the library API without loading the stdio server entry point', async () => {
    const api = await import('../index.js')

    expect(api.createMCPServer).toBeTypeOf('function')
    expect(api.MCPServerImpl).toBeTypeOf('function')
    expect(serverEntry.loaded).toBe(false)
  })
})
