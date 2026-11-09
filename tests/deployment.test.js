import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Serve the real build below a project prefix, as GitHub Pages does.
const root = resolve('dist');
const prefix = '/60second/';
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const file = resolve(root, decodeURIComponent(path.slice(prefix.length)) || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(404).end(); return; }
    const body = await readFile(file);
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
  await page.clock.install({ time: new Date('2026-11-09T03:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-09T03:00:01Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
  await expect(page.locator('h1')).toHaveText('아직, 돌아갈 집이 있다.');
  assert.notEqual(await page.locator('.topbar').evaluate(el => getComputedStyle(el).position), 'static', 'production CSS loaded');
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-loot="7"]').click();
  await page.clock.runFor(1800);
  await expect(page.locator('.bag-cell.filled')).toHaveCount(1);
  await page.locator('[data-action="home"]').first().click();
  await page.clock.runFor(9000);
  await expect(page.locator('.family-modal')).toBeVisible();
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log('PASS deployment: production JS/CSS, start, collect, and return under /60second/; no failed assets or browser errors');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
