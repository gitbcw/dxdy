const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');
const buildLibDir = path.join(rootDir, 'lib');

fs.rmSync(buildLibDir, { recursive: true, force: true });

function copyRecursive(srcDir, destDir, filter) {
  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, filter);
      continue;
    }

    if (filter && !filter(srcPath)) {
      continue;
    }

    fs.copyFileSync(srcPath, destPath);
  }
}

copyRecursive(srcDir, buildLibDir, file => file.endsWith('.ts'));
copyRecursive(distDir, buildLibDir);
