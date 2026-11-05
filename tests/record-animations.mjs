// Records a ~7 s phone-size screen recording of the motion layer (390x844). Run: node tests/record-animations.mjs
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const PW = process.env.PW || '/home/user/node_modules/playwright-core/index.mjs';
const { chromium } = await import(PW);
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const CHROME = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = process.env.OUT || path.join(os.tmpdir(), 'taj-rec'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', recordVideo: { dir: OUT, size: { width: 390, height: 844 } } });
const page = await ctx.newPage();
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await page.goto(BASE + '/#/', { waitUntil: 'load' });
await page.waitForTimeout(1400);                       // hero: photo-less ornament drifting, title fades in
await page.mouse.wheel(0, 520); await page.waitForTimeout(1100); // stats count up, reveals stagger in
await page.mouse.wheel(0, 380); await page.waitForTimeout(700);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(300);
await page.click('#menu-btn'); await page.waitForTimeout(950);  // drawer slides in, links step in
await page.evaluate(() => document.querySelector('#scrim').click()); await page.waitForTimeout(450);
await page.click('[data-act=more], #settings-btn', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(650); // settings sheet
await page.evaluate(() => document.querySelector('#scrim').click()); await page.waitForTimeout(350);
await page.evaluate(() => { location.hash = '#/library'; }); await page.waitForTimeout(1300); // page move between routes
const video = page.video(); await ctx.close(); await browser.close();
console.log('VIDEO', await video.path());
