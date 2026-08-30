#!/usr/bin/env node

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const args = process.argv.slice(2)

if (args[0] === 'skills') {
  if (args[1] === 'install') {
    const { run } = await import(resolve(__dirname, '..', 'bin', 'install-skills.js'))
    run(args.slice(2))
    process.exit(0)
  }

  console.error('Unknown skills subcommand. Usage: npx mcp-image skills install --path <path>')
  console.error('Run "npx mcp-image skills install --help" for more information.')
  process.exit(1)
} else {
  await import('./server-main.js')
}
