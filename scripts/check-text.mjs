/* Fails when any project file contains an em dash or en dash.
   The brand voice uses commas, colons or hyphens instead. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const skip = new Set(['node_modules', '.git', 'dist', 'bin', 'obj', 'TestResults']);
const text = /\.(ts|tsx|js|mjs|cjs|json|css|html|md|cs|csproj|slnx|props|yml|yaml|txt|example)$/i;
const dash = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const found = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (text.test(name) || name.startsWith('.env') || name === 'Dockerfile') {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (dash.test(line)) found.push(`${relative(root, path)}:${i + 1}`);
      });
    }
  }
}

walk(root);
if (found.length) {
  console.error(`Travessão encontrado em:\n${found.join('\n')}`);
  process.exit(1);
}
console.log('Nenhum travessão no projeto.');
