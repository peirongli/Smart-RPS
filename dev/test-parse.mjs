// dev/test-parse.mjs — 解析器回归测试（node dev/test-parse.mjs）
//
// 覆盖两条路径：
//   1. JSON 主路径（结构化三段式 {taunt, declared, actual}）
//   2. 正则兜底（模型没输出 JSON 时的老格式）
// 以及最容易回归的三处：宣告召回率、实际出拳不被误当宣告、
// "宣告缺失不得被伪装成 secret"。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ai.js 是浏览器模块（含 localStorage），这里只取解析相关片段做隔离测试：
// 从 CHOICE_KEY 定义起，到 getAiMove 之前止，并剥掉 export 关键字。
const src = readFileSync(fileURLToPath(new URL('../ai.js', import.meta.url)), 'utf8');
const start = src.indexOf('const CHOICE_KEY');
const end = src.indexOf('// 每轮一次的 AI 决策调用');
const endLine = src.lastIndexOf('// ---', end);
const body = src.slice(start, endLine).replace(/^export /gm, '');
const mod = new Function(body + '\nreturn { extractActual, extractDeclared, parseAiReply, normalizeChoice, normalizeDeclared };')();
const { extractActual, extractDeclared, parseAiReply } = mod;

let pass = 0, fail = 0;
function t(label, got, want) {
    const ok = got === want;
    if (ok) pass++; else { fail++; console.log(`  FAIL ${label}\n       got=${got} want=${want}`); }
}
function tDeep(label, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else { fail++; console.log(`  FAIL ${label}\n       got=${JSON.stringify(got)}\n      want=${JSON.stringify(want)}`); }
}

console.log('— 正则兜底：实际出拳 —');
t('标准格式', extractActual('我这轮宣告出布。我实际出：剪刀'), 'scissors');
t('全角冒号', extractActual('我实际出：石头'), 'rock');
t('缺失', extractActual('我宣告出石头，加油！'), null);

console.log('— 正则兜底：宣告召回 —');
t('宣告出X', extractDeclared('我这轮宣告出布，稳一点。我实际出：剪刀'), 'paper');
t('我要出X', extractDeclared('我要出布，别猜。我实际出：石头'), 'paper');
t('押X 不被后半句劫持', extractDeclared('我这轮押石头。我实际出：剪刀'), 'rock');
t('真保密', extractDeclared('我不告诉你，我实际出：石头'), 'secret');
t('单拳名兜底', extractDeclared('我不玩这种游戏，就布。我实际出：布'), 'paper');
t('并列表述不猜', extractDeclared('石头布都行。我实际出：石头'), null);
t('两拳并存无关键词不猜', extractDeclared('石头和布我都在想。我实际出：石头'), null);

console.log('— JSON 主路径：理想输出 —');
tDeep('标准三段式', parseAiReply('{"taunt":"你又来这套？","declared":"rock","actual":"scissors"}'),
    { taunt: '你又来这套？', declared: 'rock', actual: 'scissors', source: 'json' });

console.log('— JSON 主路径：现实世界的脏输出 —');
t('代码块围栏', parseAiReply('```json\n{"taunt":"猜吧","declared":"布","actual":"石头"}\n```').actual, 'rock');
t('围栏+前后废话', parseAiReply('好的，我来出拳：{"taunt":"来","declared":"secret","actual":"paper"} 完毕').declared, 'secret');
t('英文枚举值', parseAiReply('{"taunt":"x","declared":"scissors","actual":"rock"}').declared, 'scissors');
t('中文枚举值', parseAiReply('{"taunt":"x","declared":"石头","actual":"布"}').actual, 'paper');
t('declared 大写', parseAiReply('{"taunt":"x","declared":"ROCK","actual":"Paper"}').declared, 'rock');
t('secret 英文', parseAiReply('{"taunt":"x","declared":"secret","actual":"rock"}').declared, 'secret');

console.log('— 关键不变量：缺字段不得伪装成 secret —');
// 注意：缺 actual 时 declared 仍可被正确解析——这不是问题，
// 上层会因为 actual 缺失而重问。要守的不变量是「不凭空变 secret」。
t('JSON 缺 actual → declared 照常解析', parseAiReply('{"taunt":"x","declared":"rock"}').declared, 'rock');
t('JSON 缺 actual → actual 保持 null', parseAiReply('{"taunt":"x","declared":"rock"}').actual, null);
t('JSON 缺 declared → 不得变 secret', parseAiReply('{"taunt":"x","actual":"rock"}').declared, null);
tDeep('JSON 声明非法值', parseAiReply('{"taunt":"x","declared":"看心情","actual":"rock"}').declared, null);
t('JSON 完全不合法 → 走正则兜底', parseAiReply('{这不是json 我实际出：剪刀').actual, 'scissors');
t('空对象 → 不得返回 secret', parseAiReply('{}').declared, null);
t('无关 JSON → 不得返回 secret', parseAiReply('{"foo":"bar","baz":1}').declared, null);

console.log('— 合法 JSON 但字段缺失时，taunt 仍可用 —');
t('taunt 保留', parseAiReply('{"taunt":"先看看你","declared":"rock"}').taunt, '先看看你');

console.log(`\n${fail === 0 ? '全部通过' : '有失败'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
