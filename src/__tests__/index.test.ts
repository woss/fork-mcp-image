import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { describe, expect, it } from 'vitest'

describe('package entry point', () => {
  it('serves MCP over stdio when dist/index.js is executed directly', async () => {
    const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['dist/index.js'],
      cwd: projectRoot,
      stderr: 'pipe',
    })
    const client = new Client({ name: 'entry-point-test', version: '1.0.0' })

    try {
      await client.connect(transport)
      const { tools } = await client.listTools()

      expect(tools.map(({ name }) => name)).toEqual(['generate_image'])
    } finally {
      await client.close()
    }
  })
})
