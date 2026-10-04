// eval-ab.mjs — 对比修法 A+B 前后：最优策略差距（gap）是否收敛
//
// 背景：原先 AI 的反制是「盲目克制玩家的宣告」，导致
//   玩家诚实说石头出石头 → AI 克石头（出剪刀）→ 玩家输
//   玩家撒谎说石头出布   → AI 克石头（出剪刀）→ 布克剪刀 → 玩家赢
// 于是「固定模式撒谎」成了必胜公式，且难度越高越强（41→50→59%），
// 难度曲线是反的。
//
// 修法 B：AI 预判「宣告 X 时玩家实际最常出 Y」的众数，克制 Y 本身。
// 修法 A：上调 counterRate，让诚实玩家也面临压力。
//
// 本脚本用与 ai.js 相同的公式做对照。

import { tallyHistory, predictPlayerActual, MIN_PATTERN_SAMPLES } from '../profile.js';

const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const MOVES = ['rock', 'paper', 'scissors'];
const pick = () => MOVES[Math.floor(Math.random() * 3)];

// ── 旧版：盲目克制宣告 ──
function oldPick(d, playerDeclared) {
    if (playerDeclared && playerDeclared !== 'secret' && Math.random() < d.counterRate) {
        return BEATS[playerDeclared];
    }
    return pick();
}

// ── 新版：预判实际出拳（A+B）──
function newPick(d, playerDeclared, tally) {
    if (!tally) return pick();
    const pred = predictPlayerActual(tally, playerDeclared);
    if (!pred.guess) return pick();
    let rate = d.counterRate * (0.7 + pred.confidence * 0.6);
    if (Math.random() < rate) return BEATS[pred.guess];
    if (Math.random() < d.misreadRate) {
        const pool = MOVES.filter(m => m !== BEATS[pred.guess]);
        return pool[Math.floor(Math.random() * pool.length)];
    }
    return pick();
}

const DIFFS = {
    rookie: { counterRate: 0.22, misreadRate: 0.35 },
    regular: { counterRate: 0.32, misreadRate: 0.22 },
    mindreader: { counterRate: 0.42, misreadRate: 0.30 },
};
const OLD_DIFFS = {
    rookie: { counterRate: 0.12 },
    regular: { counterRate: 0.25 },
    mindreader: { counterRate: 0.38 },
};

const STRATS = {
    '撒谎固定 石头→布': () => ['rock', 'paper'],
    '诚实固定 石头→石头': () => ['rock', 'rock'],
    '撒谎固定 布→剪刀': () => ['paper', 'scissors'],
    '半随机 出拳随机': () => { const d = pick(); return [d, pick()]; },
    '纯随机': () => { const d = pick(); return [d, pick()]; },
    '诚实但拳随机': () => { const m = pick(); return [m, m]; },
};

function run(aiPicker, diffs, plan, roundsPerMatch = 20, matches = 3000) {
    let win = 0, total = 0;
    for (let m = 0; m < matches; m++) {
        const history = [];
        for (let i = 0; i < roundsPerMatch; i++) {
            const [pd, pa] = plan();
            const tally = tallyHistory(history);
            const ai = aiPicker(diffs, pd, tally);
            if (pa !== ai && BEATS[ai] === pa) win++;
            total++;
            history.push({ round: i, playerDeclared: pd, playerActual: pa, aiDeclared: 'paper', aiActual: ai, result: 'draw' });
        }
    }
    return win / total;
}

const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
const bar = (r) => '█'.repeat(Math.round(r * 40));

console.log('═══════ 修法 A+B 前后对比（每项 20 轮 × 3000 场）═══════\n');

for (const [name, diffsNew, diffsOld] of [
    ['新手机', DIFFS.rookie, OLD_DIFFS.rookie],
    ['熟客', DIFFS.regular, OLD_DIFFS.regular],
    ['读心者', DIFFS.mindreader, OLD_DIFFS.mindreader],
]) {
    console.log(`— ${name} —`);
    console.log('  ' + pad('策略', 20) + pad('修法前', 16) + pad('修法后', 16) + '变化');
    const before = [], after = [];
    for (const [sn, plan] of Object.entries(STRATS)) {
        const b = run(oldPick, diffsOld, plan);
        const a = run(newPick, diffsNew, plan);
        before.push(b); after.push(a);
        const delta = a - b;
        const mark = Math.abs(delta) > 0.08 ? (delta > 0 ? ' ↑ 大幅提升' : ' ↓ 大幅下降') : '';
        console.log('  ' + pad(sn, 20) +
            (b * 100).toFixed(1).padStart(5) + '%      ' +
            (a * 100).toFixed(1).padStart(5) + '%      ' +
            (delta > 0 ? '+' : '') + (delta * 100).toFixed(1) + 'pp' + mark);
    }
    const gapB = Math.max(...before) - Math.min(...before);
    const gapA = Math.max(...after) - Math.min(...after);
    console.log(`  → gap：${(gapB * 100).toFixed(1)}pp  ⇒  ${(gapA * 100).toFixed(1)}pp` +
        `  (${gapA < gapB ? '收窄 ' + ((gapB - gapA) * 100).toFixed(1) + 'pp ✅' : '未收窄 ❌'})`);
    const winB = before[0], winA = after[0];
    console.log(`  → 必胜公式（原最强策略）${(winB * 100).toFixed(1)}% ⇒ ${(winA * 100).toFixed(1)}%` +
        `  (33% 为纯随机基准)\n`);
}
