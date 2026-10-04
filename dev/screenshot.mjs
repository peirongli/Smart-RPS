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

// ---- 局制看板（打完一小局后）----
await p2.evaluate(() => {
    document.getElementById('meme-overlay')?.classList.remove('show');
    document.getElementById('meme-popup')?.classList.remove('show');
});
// 再打 4 轮凑满第一小局（5 轮）
for (let i = 0; i < 4; i++) {
    await p2.click('#next-round');
    await p2.waitForSelector('#declare-phase.active', { timeout: 8000 });
    await p2.locator('#declare-phase .choice-btn[data-choice="paper"]').click();
    await p2.waitForSelector('#action-phase.active', { timeout: 15000 });
    await p2.locator('#action-phase .choice-btn[data-choice="rock"]').click();
    await p2.waitForSelector('#result-phase.active', { timeout: 10000 });
}
await p2.waitForTimeout(600);
await shot(p2, '7-match-board');

// ---- 整场复盘页（构造已结束的状态，避免真打 15 轮）----
const p4 = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await p4.goto(BASE, { waitUntil: 'domcontentloaded' });
await p4.evaluate(() => {
    // 造一段有说服力的历史：第 1 局偏撒谎且输，第 2 局开始掺随机且赢
    const mk = (gameNo, rounds, declared, actual, aiDeclared, aiActual, result) =>
        ({ round: (gameNo - 1) * 5 + rounds, gameNo, playerDeclared: declared, playerActual: actual, aiDeclared, aiActual, result });
    const history = [
        mk(1, 1, 'rock', 'paper', 'paper', 'rock', 'win'),
        mk(1, 2, 'rock', 'paper', 'paper', 'rock', 'lose'),
        mk(1, 3, 'rock', 'paper', 'paper', 'rock', 'lose'),
        mk(1, 4, 'rock', 'paper', 'paper', 'rock', 'lose'),
        mk(1, 5, 'rock', 'rock', 'paper', 'rock', 'lose'),
        mk(2, 1, 'rock', 'scissors', 'paper', 'rock', 'win'),
        mk(2, 2, 'paper', 'rock', 'paper', 'rock', 'win'),
        mk(2, 3, 'scissors', 'paper', 'paper', 'rock', 'lose'),
        mk(2, 4, 'rock', 'scissors', 'paper', 'rock', 'win'),
        mk(2, 5, 'paper', 'scissors', 'paper', 'rock', 'win'),
        mk(3, 1, 'rock', 'rock', 'paper', 'rock', 'win'),
        mk(3, 2, 'scissors', 'paper', 'paper', 'rock', 'win'),
        mk(3, 3, 'paper', 'scissors', 'paper', 'rock', 'win'),
    ];
    localStorage.setItem('rps-game', JSON.stringify({
        round: 10, playerScore: 6, aiScore: 4, playerName: '小李',
        history, gameNo: 3, gameWins: ['lose', 'win', 'win'],
        matchOver: true, matchWinner: 'player',
    }));
    localStorage.setItem('rps-settings', JSON.stringify({
        provider: 'custom', apiKey: 'k', model: 'honest-model',
        baseUrl: 'http://localhost:8768/v1', playerName: '小李', difficulty: 'mindreader',
    }));
});
await p4.reload({ waitUntil: 'domcontentloaded' });
await p4.click('#start-game');
await p4.waitForSelector('#game-screen.active');
// 存档已是 matchOver，但结果页按钮只在 result 阶段可见。
// 这里直接把 UI 切到复盘页渲染（等价于 onResultContinue 的效果）。
await p4.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('rps-game'));
    // 动态 import ui.js 复用其渲染函数，避免在测试里复制一份逻辑
    import('./ui.js').then(ui => {
        ui.renderMatchSummary(state, { difficulty: 'mindreader' }, 3);
        ui.showPhase('summary');
    });
});
await p4.waitForSelector('#summary-phase.active', { timeout: 8000 });
await p4.waitForTimeout(400);
await shot(p4, '8-summary', { fullPage: true });

// ---- 移动端 ----
const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
await p3.waitForTimeout(300);
await shot(p3, '6-mobile-start', { fullPage: true });

await browser.close();
console.log('完成');
