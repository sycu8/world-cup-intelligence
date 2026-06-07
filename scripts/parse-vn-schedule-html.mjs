import fs from 'node:fs';
import path from 'node:path';

const htmlPath =
  process.argv[2] ??
  path.resolve(
    '../../.cursor/projects/d-OneDrive-Not-important-Documents-worldcup-analyst/uploads/426-lich-thi-dau-world-cup-2026-d399919-0.html',
  );

const text = fs.readFileSync(htmlPath, 'utf8');
const lines = text.split('\n');
let currentDate = '';
const entries = [];

for (const line of lines) {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length < 4) continue;
  const num = Number(parts[1]);
  if (!Number.isInteger(num) || num < 1 || num > 104) continue;
  if (parts[2] && /\d/.test(parts[2]) && parts[2].includes('/')) {
    currentDate = parts[2];
  }
  const timeIdx = parts[2]?.includes(':') ? 2 : 3;
  const time = parts[timeIdx];
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) continue;
  entries.push({ fifaNumber: num, vnDate: currentDate, vnTime: time });
}

entries.sort((a, b) => a.fifaNumber - b.fifaNumber);
const outJson = process.argv[3];
if (outJson) {
  fs.writeFileSync(outJson, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.error(`Wrote ${outJson} (${entries.length} entries)`);
} else {
  console.log(JSON.stringify(entries, null, 2));
  console.error(`Parsed ${entries.length} entries`);
}
