import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const final = JSON.parse(fs.readFileSync(path.join(root, 'coverage/coverage-final.json'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(root, 'coverage/coverage-summary.json'), 'utf8'));

const missed = [];

for (const [file, data] of Object.entries(final)) {
  if (file === 'total' || !data.b) continue;
  const sum = summary[file];
  if (!sum || sum.branches.total === sum.branches.covered) continue;

  for (const [id, counts] of Object.entries(data.b)) {
    if (!counts.some((c) => c === 0)) continue;
    const loc = data.branchMap[id];
    missed.push({ file: file.replace(root + '/', ''), line: loc?.line ?? -1, id, counts });
  }
}

missed.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const byFile = new Map();
for (const m of missed) {
  const list = byFile.get(m.file) ?? [];
  list.push(m);
  byFile.set(m.file, list);
}

const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [file, items] of sorted) {
  const lines = items.map((i) => `L${i.line}`).join(', ');
  console.log(`${items.length}\t${file}\t${lines}`);
}
console.log('---');
console.log('TOTAL_MISSED', missed.length);
console.log('SUMMARY', JSON.stringify(summary.total.branches));
