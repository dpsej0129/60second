import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', req => { if (/^https?:/.test(req.url())) network.push(req.url()); });
  await page.clock.install({ time: new Date('2026-11-08T03:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-08T03:00:01Z'));
  // Managed Chrome blocks file:// URLs by policy. Load the exact standalone
  // document into a blank page to validate it without weakening that policy.
  await page.setContent(await readFile(resolve('dist/60second.html'), 'utf8'));
  await expect(page.locator('h1')).toHaveText('아직, 돌아갈 집이 있다.');
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-loot="7"]').click();
  await page.clock.runFor(1800);
  await expect(page.locator('.bag-cell.filled')).toHaveCount(1);
  await page.locator('[data-action="home"]').first().click();
  await page.clock.runFor(9000);
  await expect(page.locator('.family-modal')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.locator('[data-action="family-yes"]').click();
  await expect(page.locator('.person-row')).toHaveCount(4);
  await page.locator('[data-action="next-day"]').click();
  await expect(page.locator('.day-stamp b')).toHaveText('02');
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  console.log('PASS standalone HTML: start, collect, return, family, daily rations; zero HTTP requests and no browser errors');
} finally { await browser.close(); }
