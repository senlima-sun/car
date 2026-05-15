import { spawnSync } from 'node:child_process'

const result = spawnSync('wrangler', ['d1', 'migrations', 'list', 'DB', '--remote'], {
  encoding: 'utf8',
})

if (result.status !== 0) {
  console.error('wrangler d1 migrations list failed')
  console.error(result.stderr || result.stdout)
  process.exit(1)
}

const output = result.stdout
if (output.includes('No migrations to apply')) {
  console.log('D1 migrations up to date.')
  process.exit(0)
}

console.error('Refusing to deploy: pending D1 migration(s):')
console.error(output)
console.error('Run `pnpm db:migrate:prod` first.')
process.exit(1)
