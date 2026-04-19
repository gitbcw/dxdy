import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(__dirname, '..')
const miniRoot = resolve(workspaceRoot, 'miniprogram')
const tempDir = mkdtempSync(join(tmpdir(), 'dxdy-mini-build-'))
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function copyJsFiles(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    return
  }

  mkdirSync(targetDir, { recursive: true })

  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry)
    const targetPath = join(targetDir, entry)
    const sourceStat = statSync(sourcePath)

    if (sourceStat.isDirectory()) {
      copyJsFiles(sourcePath, targetPath)
      continue
    }

    if (sourcePath.endsWith('.js')) {
      cpSync(sourcePath, targetPath)
    }
  }
}

try {
  execFileSync(
    npxBin,
    ['tsc', '-p', 'tsconfig.json', '--outDir', tempDir, '--rootDir', 'miniprogram'],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
    },
  )

  const compiledApp = join(tempDir, 'app.js')
  if (!existsSync(compiledApp)) {
    throw new Error('TypeScript compile completed, but app.js was not generated.')
  }

  cpSync(compiledApp, join(miniRoot, 'app.js'))
  copyJsFiles(join(tempDir, 'pages'), join(miniRoot, 'pages'))

  console.log('WeChat DevTools bundles prepared in miniprogram/app.js and miniprogram/pages/**/*.js')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
