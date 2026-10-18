#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const final = JSON.parse(fs.readFileSync(path.join(root, 'coverage/coverage-final.json'), 'utf8'));

for (const [file, data] of Object.entries(final)) {
  if (!data.b) continue;
  const missed = [];
  for (const [id, counts] of Object.entries(data.b)) {
    if (!counts.some((c) => c === 0)) continue;
    const line = data.branchMap[id]?.line;
    if (line) missed.push(line);
  }
  if (!missed.length) continue;
  const rel = file.replace(root + '/', '');
  const src = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
  console.log(`\n### ${rel} (${missed.length})`);
  for (const line of [...new Set(missed)].sort((a, b) => a - b)) {
    console.log(`L${line}: ${src[line - 1]}`);
  }
}
