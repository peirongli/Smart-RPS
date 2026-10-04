// verify-ab-real.mjs — 用真实参数验证「修法 B 是否真的反制固定撒谎模式」
// 直接复用 ai.js 的 DIFFICULTIES 与 profile.js 的统计，与游戏同一套公式。
import { tallyHistory, predictPlayerActual } from '../profile.js';
import { readFileSync } from 'node:fs';

const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const MOVES = ['rock', 'paper', 'scissors'];
const pick = () => MOVES[Math.floor(Math.random() * 3)];

// 从 ai.js 里读出真实参数，避免文档与代码漂移
const src = readFileSync(new URL('../ai.js', import.meta.url), 'utf8');
const parseBlock = (id) => {
    const i = src.indexOf(`id: '${id}'`);
    const seg = src.slice(i, i + 700);
    const grab = (k) => {
        const m = seg.match(new RegExp(k + ':\\s*([0-9.]+)'));
        return m ? Number(m[1]) : null;
    };
    return { counterRate: grab('counterRate'), misreadRate: grab('misreadRate'), honestBias: grab('honestBias'), secretRate: grab('secretRate') };
};

function pickActual(d, playerDeclared, tally) {
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

function rollMove(d, playerDeclared, tally) {
    const r = Math.random();
    if (r < d.secretRate) return { declared: 'secret', actual: pickActual(d, playerDeclared, tally) };
    const honest = Math.random() < d.honestBias;
    const actual = pickActual(d, playerDeclared, tally);
    const declared = honest ? actual : MOVES.filter(m => m !== actual)[Math.floor(Math.random() * 2)];
    return { declared, actual };
}

function play(playerPlan, d, rounds = 40, matches = 3000) {
    let win = 0, total = 0, aiCountered = 0;
    for (let m = 0; m < matches; m++) {
        const history = [];
        for (let i = 0; i < rounds; i++) {
            const [pd, pa] = playerPlan();
            const tally = tallyHistory(history);
            const move = rollMove(d, pd, tally);
            if (move.actual !== pa) aiCountered++;
            if (pa !== move.actual && BEATS[move.actual] === pa) win++;
            total++;
            history.push({ round: i, playerDeclared: pd, playerActual: pa, aiDeclared: move.declared, aiActual: move.actual, result: 'draw' });
        }
    }
    return { win: win / total, counterRate: aiCountered / total };
}

const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));

const PLANS = {
    '固定撒谎 石头→布': () => ['rock', 'paper'],
    '固定诚实 石头→石头': () => ['rock', 'rock'],
    '固定撒谎 布→剪刀': () => ['paper', 'scissors'],
    '轮转撒谎（宣告/实际错开）': () => { const k = Math.floor(Math.random() * 3); return [MOVES[k], MOVES[(k + 1) % 3]]; },
    '纯随机': () => { const d = pick(); return [d, pick()]; },
};

console.log('═══ 用 ai.js 真实参数验证（每项 40 轮 × 3000 场）═══\n');
for (const id of ['rookie', 'regular', 'mindreader']) {
    const d = parseBlock(id);
    console.log(`— ${id} (counterRate=${d.counterRate} misreadRate=${d.misreadRate} honestBias=${d.honestBias}) —`);
    const rates = [];
    for (const [name, plan] of Object.entries(PLANS)) {
        const r = play(plan, d);
        rates.push(r.win);
        console.log('  ' + pad(name, 28) + (r.win * 100).toFixed(1).padStart(5) + '% 胜   AI 猜中率 ' + (r.counterRate * 100).toFixed(0) + '%');
    }
    const best = Math.max(...rates), worst = Math.min(...rates);
    console.log(`  → 最优 ${(best * 100).toFixed(1)}% / 最劣 ${(worst * 100).toFixed(1)}% / gap ${((best - worst) * 100).toFixed(1)}pp\n`);
}
