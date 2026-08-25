#!/usr/bin/env node
// Tiny stand-in for a project's build tool: --check verifies, --stamp writes VERSION.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)

if (args[0] === '--check') { console.log('checks passed'); process.exit(0) }
if (args[0] === '--stamp' && args[1]) { writeFileSync(join(HERE, 'VERSION'), args[1] + '\n'); console.log('stamped ' + args[1]); process.exit(0) }
console.error('usage: build.mjs --check | --stamp <version>'); process.exit(2)
