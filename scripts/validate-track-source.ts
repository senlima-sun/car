#!/usr/bin/env bun

import { validateTrackSource } from './lib/validate/validate-source'
import type { CircuitConfigFile } from './circuits/_schema'
import type { ValidationResult } from '../src/utils/trackValidation'

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function colorForSeverity(severity: ValidationResult['severity']): string {
  if (severity === 'critical') return RED
  if (severity === 'warning') return YELLOW
  return GREEN
}

function labelForSeverity(severity: ValidationResult['severity']): string {
  if (severity === 'critical') return 'CRITICAL'
  if (severity === 'warning') return 'WARNING '
  return 'PASS    '
}

async function run(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: bun run track:validate-source <circuit-name>')
    process.exit(1)
  }

  const circuitName = args[0]!.toLowerCase()

  const configFile = Bun.file(`scripts/circuits/${circuitName}.config.json`)
  if (!(await configFile.exists())) {
    console.error(`Unknown circuit: ${circuitName}`)
    console.error(`No config found at scripts/circuits/${circuitName}.config.json`)
    process.exit(1)
  }
  const config = (await configFile.json()) as CircuitConfigFile

  const sourceFile = Bun.file(`src/constants/tracks/sources/${circuitName}.json`)
  if (!(await sourceFile.exists())) {
    console.error(`No source found at src/constants/tracks/sources/${circuitName}.json`)
    process.exit(1)
  }
  const source = await sourceFile.json()

  const report = validateTrackSource(source, config)

  console.log(`\n${BOLD}Track source validation: ${config.displayName}${RESET}`)
  console.log('─'.repeat(60))

  for (const result of report.results) {
    const color = colorForSeverity(result.severity)
    const label = labelForSeverity(result.severity)
    console.log(`  ${color}${label}${RESET}  ${result.rule}: ${result.message}`)
  }

  console.log('─'.repeat(60))

  if (report.canRace) {
    console.log(
      `  ${GREEN}${BOLD}PASS${RESET} — circuit is race-ready (${report.criticalCount} critical, ${report.warningCount} warnings)`,
    )
  } else {
    console.log(
      `  ${RED}${BOLD}FAIL${RESET} — ${report.criticalCount} critical issue(s), ${report.warningCount} warning(s)`,
    )
  }
  console.log()

  const reportDir = `.cache/track-validation`
  const reportPath = `${reportDir}/${circuitName}.json`

  const mkdirResult = Bun.spawnSync(['mkdir', '-p', reportDir])
  if (mkdirResult.exitCode !== 0) {
    console.error(`Failed to create report directory ${reportDir}`)
  } else {
    await Bun.write(
      reportPath,
      JSON.stringify(
        {
          circuit: circuitName,
          timestamp: new Date().toISOString(),
          ...report,
        },
        null,
        2,
      ),
    )
    console.log(`  Report written to ${reportPath}`)
  }

  process.exit(report.canRace ? 0 : 1)
}

run().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
