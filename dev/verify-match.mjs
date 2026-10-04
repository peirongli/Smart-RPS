// dev/verify-match.mjs — 三局两胜局制端到端验证
//
// 前置：mock-server 8768、static-server 8000
// 验证局制的关键路径：先2胜提前结束、三局打平、局间切换、复盘内容。

import { chromium } from '/Users/lipeirong/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8000/index.html';
let pass = 0, fail = 0;
const t = (label, ok, extra = '') => {
    if (ok) { pass++; console.log(`  ok   ${label}`); }
    else { fail++; console.log(`  FAIL ${label}${extra ? '\n       ' + extra : ''}`); }
};

const browser = await chromium.launch({ headless: true });

// 玩一局：宣告 decl、实际 act；返回结果文字
async function playOneRound(page, decl, act) {
    await page.evaluate(() => {
        document.getElementById('meme-overlay')?.classList.remove('show');
        document.getElementById('meme-popup')?.classList.remove('show');
    });
    // 只有上一局已结算（result 或 summary 可见）才需要点按钮继续
    const inResult = await page.locator('#result-phase.active').count();
    if (inResult) {
        await page.click('#next-round');
        await page.waitForTimeout(400);
    }
    // 现在应当处于 declare 阶段
    await page.waitForSelector('#declare-phase.active', { timeout: 8000 });
    await page.locator(`#declare-phase .choice-btn[data-choice="${decl}"]`).click();
    await page.waitForSelector('#action-phase.active', { timeout: 15000 });
    await page.locator(`#action-phase .choice-btn[data-choice="${act}"]`).click();
    await page.waitForSelector('#result-phase.active', { timeout: 10000 });
    return page.locator('#result-text').textContent();
}

async function newPage() {
    const page = await browser.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.selectOption('#provider-select', 'custom');
    await page.fill('#base-url-input', 'http://localhost:8768/v1');
    await page.fill('#api-key-input', 'k');
    await page.fill('#model-input', 'honest-model');
    await page.fill('#playerName', '局制测试');
    await page.locator('.difficulty-opt[data-difficulty="regular"]').click();
    await page.click('#start-game');
    await page.waitForSelector('#game-screen.active', { timeout: 5000 });
    return page;
}

console.log('— 局制看板 —');
{
    const page = await newPage();
    t('初始显示「第 1 局」', (await page.locator('#match-title').textContent()).includes('第 1 局'));
    t('有 3 个进度点', await page.locator('#match-dots .match-dot').count() === 3);
    t('第 1 个点是当前态', await page.locator('#match-dots .match-dot').first().evaluate(el => el.classList.contains('current')));
    t('按钮初始为「下一轮」', (await page.locator('#next-round').textContent()).includes('下一轮'));
    await page.close();
}

console.log('\n— 局推进：2 胜提前结束 —');
{
    const page = await newPage();
    // 反复玩直到整场结束，统计打了多少轮
    let rounds = 0;
    let summaryShown = false;
    const snapshots = [];
    for (let i = 0; i < 22 && !summaryShown; i++) {
        await playOneRound(page, 'rock', 'paper');
        rounds++;
        const snap = await page.evaluate(() => {
            const st = JSON.parse(localStorage.getItem('rps-game') || '{}');
            return { gameNo: st.gameNo, gameWins: st.gameWins || [], matchOver: st.matchOver, winner: st.matchWinner };
        });
        snapshots.push(snap);
        if (snap.matchOver) { summaryShown = true; break; }
        // 继续按钮已由 playOneRound 内部处理（下一轮或下一小局），
        // 这里只等界面稳定并检查是否已进复盘
        await page.waitForTimeout(450);
        if (await page.locator('#summary-phase.active').count()) { summaryShown = true; break; }
    }
    t('整场会结束并显示复盘', summaryShown);
    // 3 小局 × 5 轮 = 最多 15 轮。用 history 长度核对真实轮数，
    // 而不是累加循环次数——循环可能被 summary 检查多跑了几次。
    const realRounds = await page.evaluate(() =>
        (JSON.parse(localStorage.getItem('rps-game') || '{}').history || []).length);
    t('整场在 15 轮内结束', realRounds <= 15, `实际 ${realRounds} 轮（循环计数 ${rounds}）`);

    // 局制规则本身
    const allWins = snapshots.flatMap(s => s.gameWins);
    t('gameWins 取值合法', allWins.every(w => ['win', 'lose', 'draw'].includes(w)), JSON.stringify(allWins));
    t('至少记录了 1 个小局结果', allWins.length >= 1, JSON.stringify(allWins));
    const last = snapshots[snapshots.length - 1];
    if (last.matchOver) {
        const pw = last.gameWins.filter(w => w === 'win').length;
        const al = last.gameWins.filter(w => w === 'lose').length;
        t('结束条件正确：2 胜 或 三小局没人赢够 2',
            pw >= 2 || al >= 2 || last.gameWins.length === 3,
            JSON.stringify(last.gameWins));
        t('matchWinner 与 gameWins 一致',
            last.winner === 'player' ? pw >= 2
                : last.winner === 'ai' ? al >= 2
                    : last.winner === 'draw' ? (pw < 2 && al < 2 && last.gameWins.length === 3) : false,
            JSON.stringify(last));
    }

    // 整场结束时按钮文案应为「看本场复盘」，点它才进复盘页
    t('末局按钮为「看本场复盘」', (await page.locator('#next-round').textContent()).includes('复盘'));
    if (!(await page.locator('#summary-phase.active').count())) {
        await page.click('#next-round');
        await page.waitForTimeout(500);
    }
    t('复盘页已激活', await page.locator('#summary-phase').evaluate(el => el.classList.contains('active')));

    t('复盘标题已设置', !!(await page.locator('#summary-title').textContent()));
    t('复盘展示 3 个格子', await page.locator('#summary-content .summary-game').count() === 3);
    t('有策略演化表', await page.locator('.summary-table').count() === 1);
    t('表头包含 诚实/撒谎/保密', (await page.locator('.summary-thead').textContent()).includes('诚实'));
    t('有结论建议', (await page.locator('.summary-hint').textContent()).length > 10);
    t('有「再来一场」按钮', await page.locator('#rematch').isVisible());

    // 再来一场
    await page.click('#rematch');
    await page.waitForTimeout(500);
    t('再来一场后回到第 1 局', (await page.locator('#match-title').textContent()).includes('第 1 局'));
    t('比分已归零', (await page.locator('#player-score').textContent()) === '0');
    await page.close();
}

console.log('\n— 存档兼容 —');
{
    const page = await browser.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // 模拟旧存档：有 history 但无局制字段
    await page.evaluate(() => {
        const old = {
            round: 7, playerScore: 3, aiScore: 2, playerName: '老玩家',
            history: Array.from({ length: 6 }, (_, i) => ({
                round: i + 1, playerDeclared: 'rock', playerActual: 'paper',
                aiDeclared: 'paper', aiActual: 'rock', result: i % 2 ? 'win' : 'lose',
            })),
        };
        localStorage.setItem('rps-game', JSON.stringify(old));
        localStorage.setItem('rps-settings', JSON.stringify({
            provider: 'custom', apiKey: 'k', model: 'honest-model',
            baseUrl: 'http://localhost:8768/v1', playerName: '老玩家', difficulty: 'regular',
        }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    t('旧档被忽略（走默认设置）', await page.locator('#init-screen').evaluate(el => el.classList.contains('active')));
    t('玩家名已预填', (await page.locator('#playerName').inputValue()) === '老玩家');

    // 进游戏验证旧档迁移
    await page.selectOption('#provider-select', 'custom');
    await page.fill('#base-url-input', 'http://localhost:8768/v1');
    await page.fill('#api-key-input', 'k');
    await page.fill('#model-input', 'honest-model');
    await page.click('#start-game');
    await page.waitForSelector('#game-screen.active', { timeout: 5000 });
    t('旧档的历史被保留', (await page.locator('#player-score').textContent()) === '3');
    t('局制字段被补默认值', (await page.locator('#match-title').textContent()).includes('第 1 局'));
    t('无 JS 报错导致白屏', await page.locator('#game-screen').evaluate(el => el.classList.contains('active')));
    await page.close();
}

console.log(`\n${fail === 0 ? '全部通过' : '有失败'}: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
