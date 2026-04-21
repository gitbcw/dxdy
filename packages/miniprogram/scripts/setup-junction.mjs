import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const miniRoot = resolve(__dirname, '..', 'miniprogram')
const sharedSrc = resolve(__dirname, '..', '..', 'shared', 'src')
const targetDir = join(miniRoot, 'shared', 'src')

if (!existsSync(sharedSrc)) {
  console.error('[setup-shared] packages/shared/src not found, skipping')
  process.exit(1)
}

// Remove old junction/symlink or stale copy
if (existsSync(targetDir)) {
  try {
    rmSync(targetDir, { recursive: true, force: true })
  } catch {
    // Windows junction may need rmdir
    const { execSync } = await import('node:child_process')
    try { execSync(`rmdir /S /Q "${targetDir}"`, { shell: 'cmd.exe' }) } catch { /* ignore */ }
  }
}

// Physical copy — works with WeChat devtools module resolver
cpSync(sharedSrc, targetDir, { recursive: true })
console.log('[setup-shared] Copied shared/src -> miniprogram/shared/src')
