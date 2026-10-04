// dev/audit.mjs — 静态审查：死代码、未用符号、遗留文件
// 用 Node 而非 grep，因为项目路径含空格会让 shell 的 grep 失灵。

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
    for (const f of readdirSync(dir)) {
        if (f === '.git' || f === 'node_modules' || f === '.workbuddy') continue;
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(js|mjs|html|css|md)$/.test(f)) out.push(p);
    }
    return out;
}

const files = walk(ROOT);
const prodFiles = files.filter(f => !f.includes('/dev/'));
const testFiles = files.filter(f => f.includes('/dev/'));

// 1) 收集所有 export 符号
const exported = [];
for (const f of prodFiles) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(f, 'utf8');
    const re = /export\s+(?:async\s+)?(?:function|const|class|let)\s+([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = re.exec(src))) {
        exported.push({ name: m[1], file: f.replace(ROOT, '') });
    }
}

console.log('=== 1. 导出符号的使用情况 ===');
for (const { name, file } of exported) {
    const selfPath = join(ROOT, file);   // file 形如 'ai.js'，已去掉前导斜杠
    let usedInProd = 0, usedInTest = 0;
    // 排除定义所在文件自身——符号在定义处出现是必然的，不算「被使用」
    for (const f of prodFiles) {
        if (f === selfPath) continue;
        const src = readFileSync(f, 'utf8');
        if (new RegExp('\\b' + name + '\\b').test(src)) usedInProd++;
    }
    for (const f of testFiles) {
        const src = readFileSync(f, 'utf8');
        if (new RegExp('\\b' + name + '\\b').test(src)) usedInTest++;
    }
    // 同文件内的调用也要算（早前版本只看跨文件，把 updateMatchScore 误判成死代码）
    const selfSrc = readFileSync(selfPath, 'utf8');
    const selfUses = (selfSrc.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
    const status = (usedInProd > 0 || selfUses > 1) ? 'ok'
        : usedInTest > 0 ? '仅测试用' : '⚠️ 未被使用';
    console.log(`  ${status.padEnd(10)} ${name.padEnd(24)} ${file}` +
        (usedInProd ? `  (${usedInProd} 个文件引用)` : usedInTest ? '  (仅测试)' : ''));
}

// 2) 同一文件内定义但从未使用的函数/常量
console.log('\n=== 2. 文件内定义但未使用 ===');
for (const f of prodFiles) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(f, 'utf8');
    const names = new Set();
    const defRe = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm;
    let m;
    while ((m = defRe.exec(src))) names.add(m[1] || m[2]);
    for (const n of names) {
        // 数全文出现次数；1 = 只有定义处
        const count = (src.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
        if (count === 1) {
            console.log(`  ⚠️  ${n.padEnd(24)} ${f.replace(ROOT, '')}`);
        }
    }
}

// 3) 检查是否残留调试代码
console.log('\n=== 3. 调试残留 ===');
const DEBUG_PATTERNS = [
    [/console\.log\(/g, 'console.log'],
    [/debugger/g, 'debugger'],
    [/\bTODO\b/g, 'TODO'],
    [/\bFIXME\b/g, 'FIXME'],
    [/XXX/g, 'XXX'],
];
for (const f of prodFiles) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
        for (const [re, name] of DEBUG_PATTERNS) {
            if (re.test(line)) {
                console.log(`  ${name.padEnd(12)} ${f.replace(ROOT, '')}:${i + 1}  ${line.trim().slice(0, 70)}`);
            }
        }
    });
}

// 4) innerHTML 用法（XSS 面）
console.log('\n=== 4. innerHTML 使用（应为 0，除 clearChat）===');
for (const f of prodFiles) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
        if (/innerHTML/.test(line)) {
            console.log(`  ${f.replace(ROOT, '')}:${i + 1}  ${line.trim().slice(0, 70)}`);
        }
    });
}

// 5) DOM id 引用一致性：ui.js 里 getElementById 的 id 是否都在 HTML 里存在
console.log('\n=== 5. DOM id 引用一致性 ===');
{
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const js = readFileSync(join(ROOT, 'ui.js'), 'utf8') +
        readFileSync(join(ROOT, 'game.js'), 'utf8');
    const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
    const usedIds = new Set([...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
    const missing = [...usedIds].filter(id => !htmlIds.has(id));
    if (missing.length === 0) {
        console.log('  ok   所有 getElementById 的 id 都存在于 HTML');
    } else {
        console.log('  ⚠️  以下 id 在 HTML 中不存在（可能是拼写错误或已删除）：');
        missing.forEach(id => console.log('        ' + id));
    }
    // 反向：HTML 里定义但从未被 JS 使用的 id（不一定是问题，仅供参考）
    const unused = [...htmlIds].filter(id => !usedIds.has(id));
    if (unused.length) {
        console.log('  以下 HTML id 未被 JS 直接引用（可能通过 CSS 或动态使用）：');
        unused.forEach(id => console.log('        ' + id));
    }
}

// 6) 项目结构
console.log('\n=== 6. 项目文件 ===');
for (const f of files) {
    const rel = f.replace(ROOT, '');
    const size = statSync(f).size;
    console.log(`  ${String(size).padStart(7)}  ${rel}`);
}
