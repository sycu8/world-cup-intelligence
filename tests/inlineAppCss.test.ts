import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inlineAppCss } from '../vite-plugin-inline-app-css';

describe('inlineAppCss', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('inlines app CSS without preloading /api/home', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-css-'));
    dirs.push(dir);
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'assets', 'app.css'), 'body{color:red}');
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/assets/app.css">
<script type="module" crossorigin src="/assets/index.js"></script>
</head><body></body></html>`,
    );

    const plugin = inlineAppCss(dir);
    const hook = plugin.closeBundle;
    if (!hook || typeof hook === 'function') throw new Error('expected post closeBundle hook');
    await hook.handler();

    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    expect(html).toContain('id="app-css"');
    expect(html).toContain('body{color:red}');
    expect(html).toContain('rel="modulepreload"');
    expect(html).not.toContain('/api/home');
    expect(html).not.toContain('as="fetch"');
  });
});
