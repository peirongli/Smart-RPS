// dev/screenshot.mjs — 生成各界面截图（node dev/screenshot.mjs）
// 用途：改动 UI 后肉眼确认视觉效果，避免只靠 DOM 断言。

import { chromium } from '/Users/lipeirong/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:8000/index.html';
// 必须用 fileURLToPath：项目路径含空格时 .pathname 会留下 %20，
// 截图会写到字面量带 %20 的目录里（踩过）。
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const browser = await chromium.launch({ headless: true });

async function shot(page, name, opts = {}) {
    await page.screenshot({ path: OUT + name + '.png', ...opts });
    console.log('  ' + name + '.png');
}

// ---- 开屏（含难度选择）----
const p1 = await browser.newPage({ viewport: { width: 900, height: 1400 } });
await p1.goto(BASE, { waitUntil: 'domcontentloaded' });
await p1.evaluate(() => localStorage.clear());
await p1.reload({ waitUntil: 'domcontentloaded' });
await p1.waitForTimeout(300);
console.log('截图:');
await shot(p1, '1-start', { fullPage: true });

await p1.locator('.difficulty-opt[data-difficulty="mindreader"]').click();
await p1.waitForTimeout(200);
await shot(p1, '1-start-mindreader', { fullPage: true });

// ---- 游戏中的双盲提示 ----
const p2 = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
await p2.selectOption('#provider-select', 'custom');
await p2.fill('#base-url-input', 'http://localhost:8768/v1');
await p2.fill('#api-key-input', 'k');
await p2.fill('#model-input', 'honest-model');
await p2.fill('#playerName', '小李');
await p2.click('#start-game');
await p2.waitForSelector('#game-screen.active');

for (let i = 0; i < 3; i++) {
    await p2.locator('#declare-phase .choice-btn[data-choice="rock"]').click();
    await p2.waitForSelector('#action-phase.active', { timeout: 15000 });
    if (i === 0) {
        await p2.waitForTimeout(400);
        await shot(p2, '2-blind-action');
    }
    await p2.locator('#action-phase .choice-btn[data-choice="paper"]').click();
    await p2.waitForSelector('#result-phase.active', { timeout: 10000 });
    if (i === 2) await shot(p2, '3-reveal');
    await p2.waitForTimeout(100);
    await p2.evaluate(() => {
        document.getElementById('meme-overlay')?.classList.remove('show');
        document.getElementById('meme-popup')?.classList.remove('show');
    });
    await p2.click('#next-round');
    await p2.waitForSelector('#declare-phase.active', { timeout: 5000 });
}

// ---- 画像面板 ----
await p2.locator('#declare-phase .choice-btn[data-choice="paper"]').click();
await p2.waitForSelector('#action-phase.active', { timeout: 15000 });
await p2.locator('#action-phase .choice-btn[data-choice="scissors"]').click();
await p2.waitForSelector('#result-phase.active', { timeout: 10000 });
await p2.waitForTimeout(2500); // 等表情包浮层出现
await shot(p2, '4-meme-toast');
await p2.evaluate(() => {
    document.getElementById('meme-overlay')?.classList.remove('show');
    document.getElementById('meme-popup')?.classList.remove('show');
});
await p2.click('#toggle-profile');
await p2.waitForTimeout(300);
await shot(p2, '5-profile', { fullPage: true });

// ---- 移动端 ----
const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
await p3.waitForTimeout(300);
await shot(p3, '6-mobile-start', { fullPage: true });

await browser.close();
console.log('完成');
