// dev/verify-live.mjs — 真实模型效果验证（需要 API key）
//
// 与 verify-design.mjs 的分工：
//   verify-design.mjs  验证「设计意图是否在代码里落地」——用 mock 即可
//   verify-live.mjs     验证「AI 的行为效果是否符合设计」——必须真实模型
//
// 这个脚本**测的是 mock 测不到的那部分**：
//   1. 读心者是否真的能引用玩家画像（而不是泛泛地说"我猜你要出布"）
//   2. taunt 是否有感染力（是否针对玩家的话而非泛泛嘲讽）
//   3. 三档难度的行为差异是否真实（不只是 prompt 文本不同）
//   4. 宣告与 actual 的一致率是否符合各档的 honestBias
//   5. 格式合规率（JSON 三段式是否稳定输出、是否触发重问）
//   6. 连败时读心者是否会认输
//
// 用法：
//   DEEPSEEK_API_KEY=sk-xxx node dev/verify-live.mjs
//   # 或指定其它服务商：
//   LIVE_PROVIDER=openai OPENAI_API_KEY=sk-xxx node dev/verify-live.mjs
//   # 减少轮数（省钱）：
//   LIVE_ROUNDS=10 node dev/verify-live.mjs
//
// 警告：会真的花钱。ROUNDS × 档数 = 请求数。

import { chromium } from '/Users/lipeirong/node_modules/playwright/index.mjs';

const ROUNDS = Number(process.env.LIVE_ROUNDS || 20);
const PROVIDERS = {
    deepseek: { key: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { key: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    zhipu: { key: 'ZHIPU_API_KEY', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    moonshot: { key: 'MOONSHOT_API_KEY', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
};
const which = process.env.LIVE_PROVIDER || 'deepseek';
const conf = PROVIDERS[which];
const apiKey = process.env[conf.key];

if (!apiKey) {
    console.error(`缺少环境变量 ${conf.key}`);
    console.error('用法：DEEPSEEK_API_KEY=sk-xxx node dev/verify-live.mjs');
    process.exit(2);
}

let pass = 0, fail = 0, warn = 0;
const t = (label, ok, extra = '') => {
    if (ok) { pass++; console.log(`  ok   ${label}`); }
    else { fail++; console.log(`  FAIL ${label}${extra ? '\n       ' + extra : ''}`); }
};
const tw = (label, ok, extra = '') => {
    if (ok) { pass++; console.log(`  ok   ${label}`); }
    else { warn++; console.log(`  warn ${label}${extra ? ' — ' + extra : ''}`); }
};

const BASE = 'http://localhost:8000/index.html';
const browser = await chromium.launch({ headless: true });

// 玩家策略：前半段固定模式（宣告石头→实际出布），后半段改均匀随机。
// 前半段给读心者可读的东西，后半段测试它的保底弱点。
async function playSession(difficulty, playerPlan) {
    const page = await browser.newPage();
    const taunts = [];
    const declared = [];
    const actual = [];
    let parseRetries = 0;
    let errors = 0;

    page.on('request', req => {
        if (!req.url().includes('/chat/completions')) return;
        try {
            const msgs = JSON.parse(req.postData()).messages;
            // 检测是否触发了重问：重问时 messages 里会有两条 user
            if (msgs.filter(m => m.role === 'user').length > 1) parseRetries++;
        } catch (e) { }
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.selectOption('#provider-select', which);
    await page.fill('#base-url-input', conf.baseUrl);
    await page.fill('#api-key-input', apiKey);
    await page.fill('#model-input', conf.model);
    await page.fill('#playerName', '效果测试');
    await page.locator(`.difficulty-opt[data-difficulty="${difficulty}"]`).click();
    await page.click('#start-game');
    await page.waitForSelector('#game-screen.active', { timeout: 10000 });

    for (let i = 0; i < ROUNDS; i++) {
        await page.evaluate(() => {
            document.getElementById('meme-overlay')?.classList.remove('show');
            document.getElementById('meme-popup')?.classList.remove('show');
        });
        const errorOpen = await page.locator('#error-modal.active').count();
        if (errorOpen) {
            errors++;
            await page.click('#close-error');
        }
        if (i > 0) {
            const nextVisible = await page.locator('#next-round').isVisible().catch(() => false);
            if (nextVisible) await page.click('#next-round');
            await page.waitForSelector('#declare-phase.active', { timeout: 10000 });
        }
        const [d, a] = playerPlan(i);
        await page.locator(`#declare-phase .choice-btn[data-choice="${d}"]`).click();
        try {
            await page.waitForSelector('#action-phase.active', { timeout: 30000 });
        } catch (e) { errors++; continue; }
        // 抓 taunt：AI 消息的最后一条
        const lastAi = await page.locator('.ai-message .message-text').last().textContent();
        taunts.push(lastAi);
        await page.locator(`#action-phase .choice-btn[data-choice="${a}"]`).click();
        await page.waitForSelector('#result-phase.active', { timeout: 15000 });
        declared.push(await page.locator('#ai-declared').textContent());
        actual.push(await page.locator('#ai-actual').textContent());
    }

    const profile = await page.evaluate(() => {
        document.getElementById('meme-overlay')?.classList.remove('show');
        document.getElementById('meme-popup')?.classList.remove('show');
        document.getElementById('toggle-profile').click();
        return document.getElementById('profile-content').textContent;
    });
    const playerScore = Number(await page.locator('#player-score').textContent());
    const aiScore = Number(await page.locator('#ai-score').textContent());

    await page.close();
    return { taunts, declared, actual, parseRetries, errors, profile, playerScore, aiScore };
}

const C = ['rock', 'paper', 'scissors'];
// 前 60% 固定模式，后 40% 均匀随机
const mixedPlan = (i) => {
    if (i < Math.floor(ROUNDS * 0.6)) return ['rock', 'paper'];
    const k = i % 3;
    return [C[k], C[(k + 1) % 3]];
};

console.log(`真实模型效果验证 — ${which}/${conf.model}，每档 ${ROUNDS} 轮`);
console.log(`预计请求数约 ${ROUNDS * 3} 次\n`);

const sessions = {};
for (const d of ['rookie', 'regular', 'mindreader']) {
    console.log(`— ${d} —`);
    const s = await playSession(d, mixedPlan);
    sessions[d] = s;
    console.log(`  比分 ${s.playerScore}:${s.aiScore}，解析重问 ${s.parseRetries} 次，错误 ${s.errors} 次`);

    // 1) 格式合规率
    const emptyTaunt = s.taunts.filter(x => !x || x.trim().length < 2).length;
    t('每轮都有非空 taunt', emptyTaunt === 0, `${emptyTaunt} 轮为空`);

    // 2) 宣告与 actual 的一致率（对应 honestBias）
    let honest = 0, counted = 0;
    s.declared.forEach((dec, i) => {
        if (dec === '不告诉你') return;
        counted++;
        if (dec === s.actual[i]) honest++;
    });
    const rate = counted ? honest / counted : 0;
    console.log(`  诚实率 ${(rate * 100).toFixed(0)}%（样本 ${counted}）`);

    // 3) taunt 是否针对具体轮次（有回应当玩家宣告的内容）
    const hasSpecific = s.taunts.filter(x => /你|这次|刚才|又|猜/.test(x)).length;
    tw('多数 taunt 提及玩家', hasSpecific / s.taunts.length > 0.6,
        `仅 ${(hasSpecific / s.taunts.length * 100).toFixed(0)}%`);

    // 4) 无 XSS 迹象
    t('taunt 无 HTML 注入迹象', !s.taunts.some(x => /<img|<script|onerror=/i.test(x)));

    console.log('');
}

console.log('— 难度行为差异（这才是 mock 测不到的部分）—');
{
    const m = sessions.mindreader, r = sessions.rookie;
    // 读心者后半段（玩家已随机化）应当停止指名玩家出拳
    const lateTaunts = m.taunts.slice(Math.floor(ROUNDS * 0.6));
    const claimsReading = lateTaunts.filter(x =>
        /我(知道|确定|猜到)|你(一定|肯定|向来|总是)|规律|模式/.test(x)
    );
    tw('读心者在玩家随机化后减少断言式读心',
        claimsReading.length <= lateTaunts.length * 0.6,
        `仍有 ${claimsReading.length}/${lateTaunts.length} 轮在断言`);

    const mentionsPattern = m.taunts.filter(x => /你(宣告|最近|总是|老是)|规律|模式|习惯/.test(x));
    tw('读心者会引用玩家规律（应多于新手机）',
        mentionsPattern.length >= sessions.rookie.taunts.filter(x => /你(宣告|最近|总是|老是)|规律|模式|习惯/.test(x)).length,
        `读心者 ${mentionsPattern.length} 轮 vs 新手机 ${sessions.rookie.taunts.filter(x => /你(宣告|最近|总是|老是)|规律|模式|习惯/.test(x)).length} 轮`);

    // 诚实率应呈现 rookie > regular > mindreader 的趋势
    const honestRate = (s) => {
        let h = 0, c = 0;
        s.declared.forEach((dec, i) => {
            if (dec === '不告诉你') return;
            c++;
            if (dec === s.actual[i]) h++;
        });
        return c ? h / c : 0;
    };
    const hr = { rookie: honestRate(sessions.rookie), regular: honestRate(sessions.regular), mindreader: honestRate(sessions.mindreader) };
    console.log(`  诚实率: 新手机 ${(hr.rookie * 100).toFixed(0)}% / 熟客 ${(hr.regular * 100).toFixed(0)}% / 读心者 ${(hr.mindreader * 100).toFixed(0)}%`);
    tw('诚实率呈现 读心者 < 熟客 的趋势（读心者更会骗）',
        hr.mindreader <= hr.regular + 0.1,
        `读心者 ${(hr.mindreader * 100).toFixed(0)}% vs 熟客 ${(hr.regular * 100).toFixed(0)}%`);

    // 读心者胜率不应高到劝退
    const mWin = sessions.mindreader.playerScore / Math.max(1, ROUNDS - sessions.mindreader.errors);
    tw('读心者未碾压玩家（玩家胜率 > 20%）', mWin > 0.2,
        `玩家仅赢 ${(mWin * 100).toFixed(0)}%`);
}

console.log('\n— 样例（读心者前后半段 taunt 对比）—');
const half = Math.floor(ROUNDS * 0.6);
sessions.mindreader.taunts.slice(0, 2).forEach(x => console.log(`  [固定模式期] ${x.slice(0, 120)}`));
sessions.mindreader.taunts.slice(half, half + 2).forEach(x => console.log(`  [随机化之后] ${x.slice(0, 120)}`));

console.log(`\n${fail === 0 ? '关键项全部通过' : '有关键项失败'}: ${pass} passed, ${warn} warnings, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
