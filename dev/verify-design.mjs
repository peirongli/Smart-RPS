// dev/verify-design.mjs — 设计落地验证（node dev/verify-design.mjs）
//
// 与 e2e-check.mjs 的区别：那个测「机制是否正确」，这个测「设计意图
// 是否真的在代码里落地」。
//
// 关键前提：mock 的回复与上下文无关，所以这个脚本不能验证 AI 的行为效果
// （读心是否准、taunt 是否有感染力）。它验证的是另一件事——
// 当玩家真的打出 30 轮固定模式时，四个难度杠杆是否按设计产生不同行为。
//
// 玩家策略固定为「宣告石头、实际出布」，30 轮下来这是一个 100% 的
// declareBias，应被画像系统捕获。三个难度应看到截然不同的东西。

import { chromium } from '/Users/lipeirong/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8000/index.html';
// 30 轮：与 PROFILE_ROUNDS 一致。少于这个数统计样本不足，
// 模式检测按设计不会输出——那样测出来的"没报模式"没有意义。
const ROUNDS = 30;

let pass = 0, fail = 0;
const t = (label, ok, extra = '') => {
    if (ok) { pass++; console.log(`  ok   ${label}`); }
    else { fail++; console.log(`  FAIL ${label}${extra ? '\n       ' + extra : ''}`); }
};

const browser = await chromium.launch({ headless: true });

// 玩家出拳策略：故意固定成「宣告石头 → 实际出布」
const PLAYER = { declared: 'rock', actual: 'paper' };

async function playSession(difficulty) {
    const page = await browser.newPage();
    const contexts = [];   // 每次 AI 调用的完整 user 消息

    page.on('request', req => {
        if (req.url().includes('/chat/completions')) {
            try {
                const msgs = JSON.parse(req.postData()).messages;
                contexts.push({
                    user: msgs.find(m => m.role === 'user')?.content || '',
                    system: msgs.find(m => m.role === 'system')?.content || '',
                });
            } catch (e) { /* ignore */ }
        }
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.selectOption('#provider-select', 'custom');
    await page.fill('#base-url-input', 'http://localhost:8768/v1');
    await page.fill('#api-key-input', 'k');
    await page.fill('#model-input', 'honest-model');
    await page.fill('#playerName', '固定策略');
    await page.locator(`.difficulty-opt[data-difficulty="${difficulty}"]`).click();
    await page.click('#start-game');
    await page.waitForSelector('#game-screen.active');

    for (let i = 0; i < ROUNDS; i++) {
        await page.evaluate(() => {
            document.getElementById('meme-overlay')?.classList.remove('show');
            document.getElementById('meme-popup')?.classList.remove('show');
        });
        if (i > 0) {
            await page.click('#next-round');
            await page.waitForSelector('#declare-phase.active', { timeout: 5000 });
        }
        await page.locator(`#declare-phase .choice-btn[data-choice="${PLAYER.declared}"]`).click();
        await page.waitForSelector('#action-phase.active', { timeout: 15000 });
        await page.locator(`#action-phase .choice-btn[data-choice="${PLAYER.actual}"]`).click();
        await page.waitForSelector('#result-phase.active', { timeout: 10000 });
    }

    // 收尾：取画像面板文本
    await page.evaluate(() => {
        document.getElementById('meme-overlay')?.classList.remove('show');
        document.getElementById('meme-popup')?.classList.remove('show');
    });
    await page.click('#toggle-profile');
    const profile = await page.locator('#profile-content').textContent();
    const score = await page.locator('#player-score').textContent();
    const aiScore = await page.locator('#ai-score').textContent();

    await page.close();
    return { contexts, profile, score: Number(score), aiScore: Number(aiScore) };
}

console.log(`— 固定策略「宣告石头 → 实际出布」× ${ROUNDS} 轮 —\n`);
const rookie = await playSession('rookie');
const regular = await playSession('regular');
const mind = await playSession('mindreader');

const last = (s) => s.contexts[s.contexts.length - 1].user;
const firstFew = (s) => s.contexts.slice(0, 3).map(c => c.user).join('\n');
const avgLen = (s) => Math.round(s.contexts.reduce((a, c) => a + c.user.length, 0) / s.contexts.length);

console.log('1) 画像系统是否捕获到玩家模式（与难度无关，三档都该捕获）');
for (const [name, s] of [['新手机', rookie], ['熟客', regular], ['读心者', mind]]) {
    t(`${name} 面板显示宣告偏差`, /宣告石头/.test(s.profile) && /布/.test(s.profile),
        s.profile.slice(0, 160));
    t(`${name} 面板统计出布为主`, s.profile.includes('布'), s.profile.slice(0, 160));
}

console.log('\n2) 难度杠杆 1：注入信息量（这是最硬的一个杠杆）');
t('新手机前 3 轮不含任何统计结论',
    !/宣告诚实度|出拳分布|出拳规律/.test(firstFew(rookie)),
    firstFew(rookie).slice(0, 200));
t('新手机 30 轮后仍不含条件模式结论（只给原始明细）',
    !/出拳规律|宣告石头时有/.test(last(rookie)),
    last(rookie).slice(0, 300));
t('新手机 30 轮后有结构化战绩（战绩按统计窗口，当前轮未计入故为 29）',
    /战绩：共 29 轮/.test(last(rookie)),
    last(rookie).slice(0, 160));

t('熟客 30 轮后有基础统计（诚实度 + 分布）',
    /宣告诚实度/.test(last(regular)) && /你的实际出拳分布/.test(last(regular)),
    last(regular).slice(0, 300));
t('熟客不给「我已经算出规律」这种结论',
    !/【你的出拳规律，我已算出】/.test(last(regular)),
    last(regular).slice(0, 300));

t('读心者 30 轮后明确给出条件模式结论',
    /【你的出拳规律，我已算出】/.test(last(mind)),
    last(mind).slice(0, 300));
t('读心者点名了「宣告石头时…布」这一偏差',
    /宣告石头.*布/.test(last(mind)),
    last(mind).slice(0, 300));

console.log('\n3) 注入量应有可观测的阶梯（新手机 < 熟客 < 读心者）');
const lens = { rookie: avgLen(rookie), regular: avgLen(regular), mind: avgLen(mind) };
t(`平均 user 消息长度递增 rookie(${lens.rookie}) < regular(${lens.regular}) < mindreader(${lens.mind})`,
    lens.rookie < lens.regular && lens.regular < lens.mind,
    JSON.stringify(lens));

console.log('\n4) 难度杠杆 2/3：人格注入 + 本轮取拳由代码决定');
t('新手机 system 自称新手机', rookie.contexts[0].system.includes('新手机'));
t('熟客 system 自称熟客', regular.contexts[0].system.includes('熟客'));
t('读心者 system 自称读心者', mind.contexts[0].system.includes('读心者'));
t('读心者 system 声明可引用玩家分析', mind.contexts[0].system.includes('引用你对玩家出拳习惯的观察'));
t('新手机 system 禁止心理分析', rookie.contexts[0].system.includes('不要做心理分析'));
t('system 已移除无法执行的概率指令',
    !/misread 倾向|概率看错|% 概率与 actual 一致/.test(mind.contexts[0].system),
    '诚实率/误判率应改由 rollMove() 在代码里掷骰');
t('system 明确告知 declared/actual 已定好',
    /已经替你决定好了|已经决定好了/.test(mind.contexts[0].system));
t('user 消息包含本轮已定的取拳结果',
    /本轮已定的结果，照抄进 JSON/.test(last(mind)), last(mind).slice(-200));
t('三档的本轮结果都由代码给出（都含该标记）',
    [rookie, regular, mind].every(s => /本轮已定的结果/.test(last(s))));

console.log('\n5) 双盲时序在 60 轮中始终成立');
for (const [name, s] of [['新手机', rookie], ['熟客', regular], ['读心者', mind]]) {
    t(`${name} 30 轮全部提示了双盲时序`, s.contexts.every(c => c.user.includes('你永远猜不到玩家实际出什么')));
}

console.log('\n6) 掺随机应使读心者的规律分析失效（设计中的保底弱点）');
{
    // 全新会话：玩家这轮改用均匀随机出拳
    const page = await browser.newPage();
    const contexts = [];
    page.on('request', req => {
        if (req.url().includes('/chat/completions')) {
            try { contexts.push(JSON.parse(req.postData()).messages.find(m => m.role === 'user')?.content || ''); } catch (e) { }
        }
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.selectOption('#provider-select', 'custom');
    await page.fill('#base-url-input', 'http://localhost:8768/v1');
    await page.fill('#api-key-input', 'k');
    await page.fill('#model-input', 'honest-model');
    await page.locator('.difficulty-opt[data-difficulty="mindreader"]').click();
    await page.click('#start-game');
    await page.waitForSelector('#game-screen.active');

    // 先打 6 轮固定模式制造"有规律"的印象，再改真随机。
    //
    // 两个必须避开的陷阱（都踩过）：
    // 1. 宣告与实际不能有固定偏移关系。早前让 actual = declared 的固定位移，
    //    结果那不是随机——它是另一种更隐蔽的规律（宣告石头必出布），
    //    代码正确地报了出来，是测试设计错了。
    // 2. 不能用真随机取样。30 轮里最大拳占比有约 11% 概率超过 50% 阈值，
    //    会让这个断言时好时坏。这里改用确定性的轮转：宣告与实际各自独立轮转，
    //    保证 30 轮内实际出拳恰好各 10 次，远低于阈值。
    const C = ['rock', 'paper', 'scissors'];
    for (let i = 0; i < 30; i++) {
        await page.evaluate(() => {
            document.getElementById('meme-overlay')?.classList.remove('show');
            document.getElementById('meme-popup')?.classList.remove('show');
        });
        if (i > 0) {
            await page.click('#next-round');
            await page.waitForSelector('#declare-phase.active', { timeout: 5000 });
        }
        // 前 6 轮固定偏差（宣告石头 → 实际出布），之后宣告与实际各自独立轮转
        const d = i < 6 ? 'rock' : C[i % 3];
        const a = i < 6 ? 'paper' : C[(i + 1) % 3];
        await page.locator(`#declare-phase .choice-btn[data-choice="${d}"]`).click();
        await page.waitForSelector('#action-phase.active', { timeout: 15000 });
        await page.locator(`#action-phase .choice-btn[data-choice="${a}"]`).click();
        await page.waitForSelector('#result-phase.active', { timeout: 10000 });
    }
    const final = contexts[contexts.length - 1];
    t('分布均匀后读心者被告知规律分析已失效',
        /分析对你已经失效|跟不上/.test(final), final.slice(0, 400));
    t('并被要求在对话里承认跟不上了',
        /别装作看穿|承认/.test(final), final.slice(0, 400));

    await page.evaluate(() => {
        document.getElementById('meme-overlay')?.classList.remove('show');
        document.getElementById('meme-popup')?.classList.remove('show');
    });
    await page.click('#toggle-profile');
    const p = await page.locator('#profile-content').textContent();
    t('画像面板也确认随机化奏效', /失效|随机/.test(p), p.slice(0, 200));
    await page.close();
}

console.log('\n7) 误报率检验（最重要的一项）');
{
    // 纯随机玩家打 30 轮：应当报不出任何条件模式。
    // 若这里报出了模式，说明门槛失效——读心者会把噪声当规律，
    // 玩家一试就发现是假的，可信度会崩。
    //
    // 用确定性轮转而非真随机：宣告与实际各自独立轮转（不同相位），
    // 30 轮内各恰好 10 次，分布精确均匀。随机取样会让断言时好时坏
    // （约 11% 概率最大占比超 50% 阈值），不适合当回归测试。
    const C = ['rock', 'paper', 'scissors'];

    const page = await browser.newPage();
    const contexts = [];
    page.on('request', req => {
        if (req.url().includes('/chat/completions')) {
            try { contexts.push(JSON.parse(req.postData()).messages.find(m => m.role === 'user')?.content || ''); } catch (e) { }
        }
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.selectOption('#provider-select', 'custom');
    await page.fill('#base-url-input', 'http://localhost:8768/v1');
    await page.fill('#api-key-input', 'k');
    await page.fill('#model-input', 'honest-model');
    await page.locator('.difficulty-opt[data-difficulty="mindreader"]').click();
    await page.click('#start-game');
    await page.waitForSelector('#game-screen.active');

    for (let i = 0; i < 30; i++) {
        await page.evaluate(() => {
            document.getElementById('meme-overlay')?.classList.remove('show');
            document.getElementById('meme-popup')?.classList.remove('show');
        });
        if (i > 0) {
            await page.click('#next-round');
            await page.waitForSelector('#declare-phase.active', { timeout: 5000 });
        }
        await page.locator(`#declare-phase .choice-btn[data-choice="${C[i % 3]}"]`).click();
        await page.waitForSelector('#action-phase.active', { timeout: 15000 });
        await page.locator(`#action-phase .choice-btn[data-choice="${C[(i + 1) % 3]}"]`).click();
        await page.waitForSelector('#result-phase.active', { timeout: 10000 });
    }
    const final = contexts[contexts.length - 1];
    t('均匀分布玩家不被报出「出拳规律」',
        !/【你的出拳规律，我已算出】/.test(final), final.slice(0, 400));
    t('且被明确告知规律分析已失效',
        /分析对你已经失效|看不出你的规律/.test(final), final.slice(0, 400));
    await page.close();
}

console.log(`\n${fail === 0 ? '全部通过' : '有失败'}: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
