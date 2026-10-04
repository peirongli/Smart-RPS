// dev/test-profile.mjs — 博弈画像统计测试（node dev/test-profile.mjs）
//
// profile.js 是纯逻辑模块，最容易写出"看起来对但边界错"的代码：
// 样本不足时的噪音结论、损坏的存档、空 history。
// 这些正是它要喂给 AI 的内容，错一条就会误导整个博弈。

import { tallyHistory, findPatterns, checkRandomized, MIN_PATTERN_SAMPLES, RANDOMIZED_THRESHOLD } from '../profile.js';

let pass = 0, fail = 0;
const t = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else { fail++; console.log(`  FAIL ${label}\n       got=${JSON.stringify(got)}\n      want=${JSON.stringify(want)}`); }
};
const tTrue = (label, v) => t(label, !!v, true);
const tFalse = (label, v) => t(label, !!v, false);

// 构造历史记录的辅助函数
const R = (pd, pa, ad, aa, result) => ({
    round: 1, playerDeclared: pd, playerActual: pa,
    aiDeclared: ad, aiActual: aa, result,
});

console.log('— 空与异常输入 —');
t('空 history', tallyHistory([]).total, 0);
t('非数组', tallyHistory(null).total, 0);
t('undefined', tallyHistory(undefined).total, 0);
t('含 null 元素只计有效记录', tallyHistory([null, R('rock', 'rock', 'paper', 'scissors', 'win'), undefined]).total, 1);
t('空 history 无模式', findPatterns(tallyHistory([])).length, 0);
t('空 history 无随机性结论', checkRandomized(tallyHistory([])), null);

console.log('— 基本统计 —');
{
    const h = [
        R('rock', 'paper', 'paper', 'rock', 'win'),
        R('rock', 'paper', 'scissors', 'rock', 'win'),
        R('paper', 'scissors', 'rock', 'scissors', 'lose'),
        R('secret', 'rock', 'paper', 'rock', 'draw'),
    ];
    const s = tallyHistory(h);
    t('总轮数', s.total, 4);
    t('玩家胜', s.playerWins, 2);
    t('AI 胜', s.aiWins, 1);
    t('平局', s.draws, 1);
    t('撒谎次数（宣告石头却出布等）', s.deceived, 3);
    t('保密次数', s.secrets, 1);
    t('实际出拳分布', s.actual, { rock: 1, paper: 2, scissors: 1 });
}

console.log('— 样本不足不报模式（核心不变量）—');
{
    // 宣告石头 4 次、实际出布 4 次：100% 偏差，但样本只有 4
    const h = [R('rock', 'paper', 'rock', 'paper'), R('rock', 'paper', 'rock', 'paper'),
               R('rock', 'paper', 'rock', 'paper'), R('rock', 'paper', 'rock', 'paper')];
    const p = findPatterns(tallyHistory(h));
    t('4 次样本不出 declareBias 模式', p.filter(x => x.kind === 'declareBias').length, 0);
    tTrue('MIN_PATTERN_SAMPLES 是 5', MIN_PATTERN_SAMPLES === 5);

    // 加到 5 次就该报了
    const h5 = [...h, R('rock', 'paper', 'rock', 'paper')];
    const p5 = findPatterns(tallyHistory(h5));
    t('5 次样本出 declareBias 模式', p5.filter(x => x.kind === 'declareBias').length, 1);
}

console.log('— 样本量越大、share 门槛越严 —');
{
    // 5 次里 4 次 = 80%：n=5 门槛 0.6，应报
    const n5 = [R('rock', 'paper'), R('rock', 'paper'), R('rock', 'paper'),
                R('rock', 'paper'), R('rock', 'rock')];
    t('5 样本 80% 报出', findPatterns(tallyHistory(n5)).filter(x => x.kind === 'declareBias').length, 1);

    // 10 次里 7 次 = 70%：n=10 门槛 0.8，不应报
    const n10 = [];
    for (let i = 0; i < 7; i++) n10.push(R('rock', 'paper'));
    for (let i = 0; i < 3; i++) n10.push(R('rock', 'rock'));
    t('10 样本 70% 不报（门槛 0.8）', findPatterns(tallyHistory(n10)).filter(x => x.kind === 'declareBias').length, 0);

    // 10 次里 9 次 = 90%：应报
    const n10hi = [];
    for (let i = 0; i < 9; i++) n10hi.push(R('rock', 'paper'));
    n10hi.push(R('rock', 'rock'));
    t('10 样本 90% 报出', findPatterns(tallyHistory(n10hi)).filter(x => x.kind === 'declareBias').length, 1);
}

console.log('— 条件模式识别 —');
{
    // 玩家宣告石头 → 实际出布，5 次全是 → 应识别
    const h = [];
    for (let i = 0; i < 5; i++) h.push(R('rock', 'paper', 'scissors', 'rock', 'win'));
    const p = findPatterns(tallyHistory(h));
    const bias = p.find(x => x.kind === 'declareBias');
    tTrue('识别宣告偏差', bias && bias.declared === 'rock' && bias.actual === 'paper' && Math.round(bias.share * 100) === 100);
}

console.log('— followAi：玩家被 AI 宣告带跑（最危险的一条）—');
{
    // AI 宣告布 → 玩家 5 次都出石头
    const h = [];
    for (let i = 0; i < 5; i++) h.push(R('rock', 'rock', 'paper', 'scissors', 'win'));
    const p = findPatterns(tallyHistory(h));
    const f = p.find(x => x.kind === 'followAi');
    tTrue('识别 followAi', f && f.aiDeclared === 'paper' && f.actual === 'rock');
    tTrue('文案含"这条我可以用"', f && f.text.includes('这条我可以用'));
}

console.log('— 诚实宣告不算偏差 —');
{
    // 宣告与实际一致：不该被报成"你在撒谎"
    const h = [];
    for (let i = 0; i < 5; i++) h.push(R('rock', 'rock', 'rock', 'rock', 'win'));
    const p = findPatterns(tallyHistory(h));
    t('宣告=实际不报偏差', p.filter(x => x.kind === 'declareBias').length, 0);
}

console.log('— 随机性检测（掺随机应当使规律失效）—');
{
    // 均匀分布：6 次实际出拳各 2 次
    const h = [
        R('rock', 'rock', 'rock', 'rock'),
        R('rock', 'rock', 'rock', 'rock'),
        R('paper', 'paper', 'rock', 'rock'),
        R('paper', 'paper', 'rock', 'rock'),
        R('scissors', 'scissors', 'rock', 'rock'),
        R('scissors', 'scissors', 'rock', 'rock'),
    ];
    const r = checkRandomized(tallyHistory(h));
    tTrue('检测出已随机化', r && r.verdict === 'randomized');
    t('最高占比 33%', Math.round(r.maxShare * 100), 33);

    // 集中分布：不该判定为随机化
    const skewed = [
        R('rock', 'rock'), R('rock', 'rock'), R('rock', 'rock'),
        R('rock', 'rock'), R('rock', 'rock'), R('paper', 'paper'),
    ];
    t('集中出拳不判为随机化', checkRandomized(tallyHistory(skewed)), null);

    // 样本不足 4 次：不下结论
    t('样本 4 次不下结论', checkRandomized(tallyHistory([R('rock', 'rock'), R('paper', 'paper'), R('scissors', 'scissors'), R('rock', 'rock')])), null);
}

console.log('— 随机性阈值取 50%（依模拟数据校准）—');
{
    tTrue('阈值是 0.5', RANDOMIZED_THRESHOLD === 0.5);
    // 30 轮里某拳占 40%（16/40）：典型纯随机水平，应判为已随机化
    const even = [];
    for (let i = 0; i < 16; i++) even.push(R('rock', 'rock'));
    for (let i = 0; i < 14; i++) even.push(R('paper', 'paper'));
    for (let i = 0; i < 10; i++) even.push(R('scissors', 'scissors'));
    t('占比 40% 判为随机化（纯随机中位水平）',
        !!checkRandomized(tallyHistory(even)), true);

    // 某拳占 55%：明显集中，不该判为随机化
    const concentrated = [];
    for (let i = 0; i < 22; i++) concentrated.push(R('rock', 'rock'));
    for (let i = 0; i < 9; i++) concentrated.push(R('paper', 'paper'));
    for (let i = 0; i < 9; i++) concentrated.push(R('scissors', 'scissors'));
    t('占比 55% 不判为随机化',
        checkRandomized(tallyHistory(concentrated)), null);
}

console.log(`\n${fail === 0 ? '全部通过' : '有失败'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
