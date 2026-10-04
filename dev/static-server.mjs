// dev/static-server.mjs — 零依赖静态服务器（node dev/static-server.mjs [port]）
// 用途：e2e 测试与本地预览。刻意不依赖 python 或 npx serve。

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || 8000);
// 必须用 fileURLToPath 而非 .pathname——项目路径含空格时
// .pathname 会留下 %20，导致所有文件都 404。
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

http.createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(req.url.split('?')[0]);
        if (path === '/') path = '/index.html';
        // 防目录穿越；去掉前导 / 否则 join 会把 ROOT 顶掉
        const safe = normalize(path).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
        const file = join(ROOT, safe);
        if (!file.startsWith(ROOT)) {
            res.writeHead(403); res.end('forbidden'); return;
        }
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(body);
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found');
    }
}).listen(PORT, () => {
    console.log(`static server on http://localhost:${PORT}`);
});
