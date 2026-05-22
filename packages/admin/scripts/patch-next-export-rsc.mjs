import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'out');

function walk(dir, visit) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    visit(fullPath, entry);
    if (entry.isDirectory()) walk(fullPath, visit);
  }
}

let copied = 0;
let routeAliases = 0;

walk(outDir, (filePath, entry) => {
  if (!entry.isFile() || !entry.name.endsWith('.html')) return;
  if (entry.name === 'index.html' || entry.name === '404.html') return;

  const routeDir = filePath.slice(0, -'.html'.length);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.copyFileSync(filePath, path.join(routeDir, 'index.html'));
  routeAliases += 1;

  const textPath = filePath.slice(0, -'.html'.length) + '.txt';
  if (fs.existsSync(textPath)) {
    fs.copyFileSync(textPath, path.join(routeDir, 'index.txt'));
    routeAliases += 1;
  }
});

walk(outDir, (entryPath, entry) => {
  if (!entry.isDirectory() || !entry.name.startsWith('__next.!')) return;

  const marker = entry.name;
  const routeDir = path.dirname(entryPath);

  walk(entryPath, (filePath, fileEntry) => {
    if (!fileEntry.isFile() || !fileEntry.name.endsWith('.txt')) return;

    const relativeParts = path.relative(entryPath, filePath).split(path.sep);
    const dottedName = `${marker}.${relativeParts.join('.')}`;
    const targetPath = path.join(routeDir, dottedName);

    fs.copyFileSync(filePath, targetPath);
    copied += 1;
  });
});

console.log(`Patched Next route aliases: ${routeAliases} file(s).`);
console.log(`Patched Next static RSC export aliases: ${copied} file(s).`);
