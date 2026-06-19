#!/usr/bin/env node
/**
 * 一次性迁移脚本：为 articles 集合中缺少 clickCount/viewCount 的文档初始化默认值 0
 *
 * 运行前请确保：
 *   1. 已安装 @cloudbase/cli 并已登录（tcb login）
 *   2. 当前账号有目标环境的写权限
 *
 * 运行方式：
 *   node scripts/migrate-article-click-count.mjs
 *   node scripts/migrate-article-click-count.mjs --dry-run
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ENV_ID = 'cloud1-d7g7ctn4m86bada89'
const COLLECTION = 'articles'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')

let resolvedTcbEntry = ''

function resolveTcbEntry() {
  if (resolvedTcbEntry) return resolvedTcbEntry
  const candidates = []
  if (process.platform === 'win32') {
    const where = spawnSync('where.exe', ['tcb.cmd'], { encoding: 'utf8' })
    for (const line of String(where.stdout || '').split(/\r?\n/).filter(Boolean)) {
      candidates.push(path.join(path.dirname(line), 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'))
    }
  }
  candidates.push(path.join(process.cwd(), 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'))
  const found = candidates.find(candidate => existsSync(candidate))
  if (!found) throw new Error('Cannot find @cloudbase/cli bin/tcb entry. Please run: npm install -g @cloudbase/cli')
  resolvedTcbEntry = found
  return found
}

function runTcb(tcbArgs, options = {}) {
  if (dryRun) {
    console.log(`[dry-run] tcb ${tcbArgs.join(' ')}`)
    return ''
  }
  const result = process.platform === 'win32'
    ? spawnSync(process.execPath, [resolveTcbEntry(), ...tcbArgs], {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false,
        maxBuffer: 1024 * 1024 * 10,
      })
    : spawnSync('tcb', tcbArgs, {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false,
        maxBuffer: 1024 * 1024 * 10,
      })
  if (result.error) throw result.error
  const output = `${result.stdout || ''}${result.stderr || ''}`
  if (result.status !== 0) {
    throw new Error(`tcb ${tcbArgs.join(' ')} failed:\n${output}`)
  }
  return output
}

function executeCommands(commands) {
  return runTcb([
    '-e',
    ENV_ID,
    'db',
    'nosql',
    'execute',
    '--command',
    JSON.stringify(commands),
    '--json',
  ])
}

function main() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Migrating ${COLLECTION} in ${ENV_ID}...`)

  // CloudBase NoSQL 语法：给缺少 clickCount 的文档设置默认值
  const commands = [{
    TableName: COLLECTION,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: COLLECTION,
      updates: [{
        q: { clickCount: { $exists: false } },
        u: { $set: { clickCount: 0, viewCount: 0 } },
        multi: true,
      }],
    }),
  }]

  const output = executeCommands(commands)
  if (output) console.log(output)
  console.log('Migration done.')
}

main()
