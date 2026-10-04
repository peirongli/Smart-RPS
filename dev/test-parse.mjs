// dev/test-parse.mjs — 解析器回归测试（node dev/test-parse.mjs）
// 覆盖 P0 修复里最容易回归的两处：extractDeclared 的召回率、
// 以及"宣告缺失不得被伪装成 secret"。

import { readFileSync } from 'node:fs';

// ai.js 是浏览器模块（含 localStorage），这里只取解析相关片段做隔离测试：
// 从 CHOICE_KEY 定义起，到 declarationOnly 之前止。
const src = readFileSync(new URL('../ai.js', import.meta.url), 'utf8');
const start = src.indexOf('const CHOICE_KEY');
const end = src.indexOf('export function declarationOnly');
const body = src.slice(start, end);
const mod = new Function(body + '\nreturn { extractActual, extractDeclared };')();

const { extractActual, extractDeclared } = mod;

let pass = 0, fail = 0;
function t(label, got, want) {
    const ok = got === want;
    if (ok) pass++; else { fail++; console.log(`  FAIL ${label}\n       got=${got} want=${want}`); }
}

console.log('— 实际出拳 —');
t('标准格式', extractActual('我这轮宣告出布。我实际出：剪刀'), 'scissors');
t('全角冒号', extractActual('我实际出：石头'), 'rock');
t('无空格', extractActual('我实际出：布'), 'paper');
t('缺失', extractActual('我宣告出石头，加油！'), null);

console.log('— 宣告（P0 加固后召回率应显著上升）—');
t('宣告出X', extractDeclared('我这轮宣告出布，稳一点。我实际出：剪刀'), 'paper');
t('宣誓告是X', extractDeclared('我宣告是石头。我实际出：石头'), 'rock');
t('打算出X', extractDeclared('我打算出剪刀。我实际出：布'), 'scissors');
t('我要出X', extractDeclared('我要出布，别猜。我实际出：石头'), 'paper');
t('押X', extractDeclared('我这轮押石头。我实际出：剪刀'), 'rock');
t('口语 单拳名兜底', extractDeclared('我不玩这种游戏，就布。我实际出：布'), 'paper');
t('真保密', extractDeclared('我不告诉你，我实际出：石头'), 'secret');
t('保密词优先', extractDeclared('我宣告出石头，但保密。我实际出：石头'), 'secret');
t('两拳并存且无关键词→不猜', extractDeclared('石头布都行。我实际出：石头'), null);
t('两拳并存无关键词无含糊词→不猜', extractDeclared('石头和布我都在想。我实际出：石头'), null);

console.log(`\n${fail === 0 ? '全部通过' : '有失败'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
