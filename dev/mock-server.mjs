// dev/mock-server.mjs — 本地 mock：模拟 OpenAI 兼容的 /chat/completions
// 用途：不花一分钱调通游戏全流程。
//   node dev/mock-server.mjs            → 正常模式（AI 回应含合规的"我实际出：X"）
//   model 填 "bad-model"                → 返回不合规回应，测试解析失败路径
// 启动后把游戏设置指向 http://localhost:8768/v1 即可。

import http from 'node:http';

const PORT = 8768;

const GOOD_REPLIES = [
    '哦？你这话说的～那我这轮宣告出布，看看谁能笑到最后！我实际出：剪刀',
    '嘿嘿，有意思的宣告！我这轮宣告出石头，稳一点。我实际出：石头',
    '哈哈，让我想想……我这轮宣告出剪刀！我实际出：布',
];

const BAD_REPLY = '哈哈，这轮看我的！我一定会赢你的，等着瞧吧～（这段话没有任何格式）';

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

            const content = model === 'bad-model'
                ? BAD_REPLY
                : GOOD_REPLIES[Math.floor(Math.random() * GOOD_REPLIES.length)];

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
    console.log(`mock OpenAI-compatible server on http://localhost:${PORT}/v1 (model "bad-model" = unparseable replies)`);
});
