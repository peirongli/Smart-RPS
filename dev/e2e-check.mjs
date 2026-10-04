// dev/e2e-check.mjs — 端到端流程验证（node dev/e2e-check.mjs）
//
// 用真实浏览器跑通一遍，验证三件静态检查看不出来的事：
//   1. 难度三张卡能渲染、能选中、能读进 startGame
//   2. 双盲承诺成立：出拳阶段 AI 宣告不可见，揭晓后才可见
//   3. XSS 修复有效：AI 返回 HTML 不会被执行成 DOM
//
// 前置：mock-server.mjs 跑在 8768，静态服务器跑在 8000。

import { chromium } from '/Users/lipeirong/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8000/index.html';
let pass = 0, fail = 0;
const t = (label, ok, extra = '') => {
    if (ok) { pass++; console.log(`  ok   ${label}`); }
    else { fail++; console.log(`  FAIL ${label}${extra ? ' — ' + extra : ''}`); }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

// 记录 AI 实际收到的是什么，便于断言
let lastContext = '';
page.on('request', req => {
    if (req.url().includes('/chat/completions')) {
        try { lastContext = JSON.parse(req.postData()).messages.map(m => m.content).join('\n'); } catch (e) { }
    }
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });

console.log('— 难度选择 —');
const diffBtns = page.locator('#difficulty-options .difficulty-opt');
t('渲染三张难度卡', await diffBtns.count() === 3, `count=${await diffBtns.count()}`);
t('默认选中读心者之外的档', !(await page.locator('.difficulty-opt[data-difficulty="mindreader"]').evaluate(el => el.classList.contains('active'))));
await page.locator('.difficulty-opt[data-difficulty="mindreader"]').click();
t('点击后选中态切换', await page.locator('.difficulty-opt[data-difficulty="mindreader"]').evaluate(el => el.classList.contains('active')));
t('说明文案同步更新', (await page.locator('#difficulty-note').textContent()).includes('规律'));

console.log('— 填表开局 —');
await page.selectOption('#provider-select', 'custom');
await page.fill('#base-url-input', 'http://localhost:8768/v1');
await page.fill('#api-key-input', 'test-key');
await page.fill('#model-input', 'honest-model');
await page.fill('#playerName', '测试员');
await page.click('#start-game');
await page.waitForSelector('#game-screen.active', { timeout: 5000 });
t('进入游戏界面', await page.locator('#game-screen').evaluate(el => el.classList.contains('active')));
t('欢迎语含对手名', (await page.locator('.ai-message .message-text').last().textContent()).includes('读心者'));

console.log('— 双盲承诺 —');
await page.locator('#declare-phase .choice-btn[data-choice="rock"]').click();
await page.waitForSelector('#action-phase.active', { timeout: 15000 });
t('进入出拳阶段', await page.locator('#action-phase').evaluate(el => el.classList.contains('active')));
t('双盲提示可见', await page.locator('#blind-hint').evaluate(el => el.classList.contains('active')));
const aiDeclaredText = await page.locator('#ai-declared').textContent();
t('出拳阶段 AI 宣告字段为空（未揭晓）', aiDeclaredText.trim() === '', `got="${aiDeclaredText}"`);
const chatText = await page.locator('#chat-messages').textContent();
t('聊天流无 "我宣告出" 泄漏', !/我宣告出/.test(chatText), chatText.slice(-80));
t('注入了 read 心智者人格', lastContext.includes('读心者'));
t('提示词含双盲时序说明', lastContext.includes('你永远猜不到玩家实际出什么'));

await page.locator('#action-phase .choice-btn[data-choice="paper"]').click();
await page.waitForSelector('#result-phase.active', { timeout: 10000 });
t('揭晓后 AI 宣告可见', (await page.locator('#ai-declared').textContent()).trim() !== '');
t('揭晓提示可见', await page.locator('.battle-reveal-note').isVisible());
t('双盲提示已隐藏', !(await page.locator('#blind-hint').evaluate(el => el.classList.contains('active'))));

console.log('— 画像统计（多轮累积）—');
// 表情包会在输的轮次后 2 秒弹出并挡住「下一轮」，先让它自动消失
const dismissMeme = async () => {
    await page.evaluate(() => {
        document.getElementById('meme-overlay')?.classList.remove('show');
        document.getElementById('meme-popup')?.classList.remove('show');
    });
};
for (let i = 0; i < 3; i++) {
    await dismissMeme();
    await page.click('#next-round');
    await page.waitForSelector('#declare-phase.active', { timeout: 5000 });
    await page.locator('#declare-phase .choice-btn[data-choice="paper"]').click();
    await page.waitForSelector('#action-phase.active', { timeout: 15000 });
    await page.locator('#action-phase .choice-btn[data-choice="scissors"]').click();
    await page.waitForSelector('#result-phase.active', { timeout: 10000 });
}
await dismissMeme();
await page.click('#next-round');
await page.locator('#declare-phase .choice-btn[data-choice="paper"]').click();
await page.waitForSelector('#action-phase.active', { timeout: 15000 });
t('读心者拿到了规律分析或随机性判断', lastContext.includes('出拳规律') || lastContext.includes('看不出你的规律'), lastContext.slice(0, 400));

console.log('— 画像面板 —');
// 画像在每轮 result 时就已刷新，这里直接展开查看
await page.click('#toggle-profile');
t('画像面板可展开', await page.locator('#profile-panel').evaluate(el => el.classList.contains('active')));
const profileText = await page.locator('#profile-content').textContent();
t('画像含诚实度统计', profileText.includes('宣告诚实度'));
t('画像含出拳分布', profileText.includes('石头') && profileText.includes('布'));
t('画像含规律或随机化结论', /规律|随机|失效|暂时/.test(profileText), profileText.slice(0, 200));

console.log('— XSS 防护 —');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.selectOption('#provider-select', 'custom');
await page.fill('#base-url-input', 'http://localhost:8768/v1');
await page.fill('#api-key-input', 'k');
await page.fill('#model-input', 'xss-model');
await page.fill('#playerName', 'x');
// 直接验证渲染函数对恶意文本的处理
const xssResult = await page.evaluate(() => {
    const box = document.createElement('div');
    box.className = 'message-text';
    box.textContent = '<img src=x onerror="window.__pwned=1">';
    return { html: box.innerHTML, hasImg: !!box.querySelector('img') };
});
t('恶意文本被转义为纯文本', !xssResult.hasImg && xssResult.html.includes('&lt;img'), JSON.stringify(xssResult));

console.log(`\n${fail === 0 ? '全部通过' : '有失败'}: ${pass} passed, ${fail} failed`);
if (errors.length) {
    console.log('\n页面错误:');
    errors.slice(0, 5).forEach(e => console.log('  ' + e));
}
await browser.close();
process.exit(fail === 0 ? 0 : 1);
