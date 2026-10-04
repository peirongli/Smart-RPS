// dev/mock-server.mjs — 本地 mock：模拟 OpenAI 兼容的 /chat/completions
// 用途：不花一分钱调通游戏全流程。
//   node dev/mock-server.mjs            → 正常模式（返回合规 JSON）
//   model 填 "bad-model"                → JSON 缺 declared 字段，测重问与报错
//   model 填 "fenced-model"             → 代码块围栏 + 前后废话，测容错
//   model 填 "legacy-model"             → 老格式纯文本，测正则兜底
//   model 填 "garbage-model"            → 完全不解析，测游戏错误弹窗
//   model 填 "honest-model"             → 宣告与实际一致
// 启动后把游戏设置指向 http://localhost:8768/v1 即可。

import http from 'node:http';

const PORT = 8768;

// 合规的 JSON 回应。故意让 declared 与 actual 时一致时不一致，
// 好在本地就能看出双盲机制是否生效。
const GOOD_REPLIES = [
    { taunt: '你又要出石头？行，我记着呢。', declared: 'rock', actual: 'scissors' },
    { taunt: '这次我还真不骗你，但你信吗？', declared: 'paper', actual: 'paper' },
    { taunt: '不告诉你，你就猜去吧。', declared: 'secret', actual: 'rock' },
    { taunt: '你先出，我跟着你的习惯走。', declared: 'scissors', actual: 'paper' },
];

const HONEST_REPLIES = [
    { taunt: '实话实说，这轮我出剪刀。', declared: 'scissors', actual: 'scissors' },
];

// JSON 字段缺失：declared 完全没有 → 应触发重问
const BAD_REPLY = { taunt: '我随便说点什么好了。' };

// 脏输出：代码块围栏 + 前后废话
const FENCED = '好的，这就出：\n```json\n{"taunt":"围栏测试","declared":"paper","actual":"rock"}\n```\n出完！';

const GARBAGE = '哈哈哈这轮看我的我一定会赢你的等着瞧吧～（这段话没有任何可解析格式）';

// XSS 攻击样本：taunt 里塞 HTML，验证游戏用 textContent 渲染而不执行
const XSS = '<img src=x onerror="window.__pwned=1">我是<script>alert(1)</script>。我宣告出布。我实际出：剪刀';

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function render(model) {
    switch (model) {
        case 'bad-model': return JSON.stringify(BAD_REPLY);
        case 'fenced-model': return FENCED;
        case 'legacy-model': return '哦？你这话说的～那我这轮宣告出布。我实际出：剪刀';
        case 'garbage-model': return GARBAGE;
        case 'honest-model': return JSON.stringify(pick(HONEST_REPLIES));
        case 'xss-model': return XSS;
        default: return JSON.stringify(pick(GOOD_REPLIES));
    }
}

const server = http.createServer((req, res) => {
    // CORS：允许本地页面跨域调用
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/__health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('mock ok');
        return;
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            let model = 'unknown';
            try {
                model = JSON.parse(body).model;
            } catch (e) { /* ignore */ }

            const content = render(model);

            const payload = {
                id: 'mock-' + Date.now(),
                object: 'chat.completion',
                model: model,
                choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(payload));
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
});

server.listen(PORT, () => {
    console.log(`mock OpenAI-compatible server on http://localhost:${PORT}/v1`);
    console.log('  model = bad-model     → 缺 declared，测重问与报错');
    console.log('  model = garbage-model  → 完全不解析，测游戏错误弹窗');
    console.log('  model = fenced-model   → 代码块围栏 + 废话，测容错');
    console.log('  model = legacy-model   → 老格式纯文本，测正则兜底');
    console.log('  model = honest-model   → 宣告与实际一致');
});
