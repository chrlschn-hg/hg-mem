// Validate source-package shape and links; no database or provider installation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill');
const expected = ['memory-maintain', 'memory-recall', 'memory-setup', 'memory-workflow', 'memory-write'];
const folders = fs.readdirSync(root).sort();
if (JSON.stringify(folders) !== JSON.stringify(expected)) throw new Error(`Unexpected skills: ${folders}`);
let files = 0, links = 0;
function check(file) {
  if (!file.endsWith('.md')) throw new Error(`Non-text skill asset: ${file}`);
  const text = fs.readFileSync(file, 'utf8');
  files++;
  if (path.basename(file) === 'SKILL.md') {
    const name = text.match(/^name: (.+)$/m)?.[1];
    if (name !== path.basename(path.dirname(file))) throw new Error(`Name/folder mismatch: ${file}`);
    if (!/^description: .+$/m.test(text)) throw new Error(`Missing description: ${file}`);
  }
  for (const [, target] of text.matchAll(/\]\(([^\s)]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const local = path.resolve(path.dirname(file), target.split('#')[0]);
    if (!fs.existsSync(local)) throw new Error(`Broken link: ${file} -> ${target}`);
    links++;
  }
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file); else check(file);
  }
}
walk(root);
console.log(`Skills valid: ${folders.length} skills, ${files} Markdown assets, ${links} local links`);
