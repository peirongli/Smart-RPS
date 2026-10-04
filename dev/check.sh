#!/bin/sh
# dev/check.sh — 跑全部质量门禁
#
# 为什么需要它：node --check 会把 ES module 当 CommonJS 解析，
# 因此语法错误（如对象字面量被误删导致的 "Unexpected token ':'"）查不出来。
# 这里用两种方式交叉验证：
#   1. 复制成 .mjs 后再 --check  → 能按 ES module 语法检查
#   2. 真实浏览器加载页面          → 能抓住运行期错误（如 import 路径错、DOM id 不存在）

set -e
cd "$(dirname "$0")/.."
NODE=node
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "== 1. ES module 语法检查 =="
for f in ai.js game.js ui.js profile.js; do
    cp "$f" "$TMP/$(basename "$f" .js).mjs"
    if $NODE --check "$TMP/$(basename "$f" .js).mjs" 2>"$TMP/err"; then
        echo "  ok   $f"
    else
        echo "  FAIL $f"
        head -8 "$TMP/err"
        exit 1
    fi
done
for f in dev/mock-server.mjs dev/static-server.mjs dev/e2e-check.mjs dev/test-parse.mjs dev/test-profile.mjs; do
    if $NODE --check "$f" 2>"$TMP/err"; then
        echo "  ok   $f"
    else
        echo "  FAIL $f"
        head -8 "$TMP/err"
        exit 1
    fi
done

echo
echo "== 2. 单元测试：解析器 =="
$NODE dev/test-parse.mjs

echo
echo "== 3. 单元测试：博弈画像 =="
$NODE dev/test-profile.mjs

echo
echo "== 4. 端到端（真实浏览器）=="
$NODE dev/mock-server.mjs > /tmp/rps-mock.log 2>&1 &
MOCK=$!
$NODE dev/static-server.mjs 8000 > /tmp/rps-static.log 2>&1 &
STATIC=$!
trap 'kill $MOCK $STATIC 2>/dev/null || true; rm -rf "$TMP"' EXIT
sleep 1.5
$NODE dev/e2e-check.mjs
STATUS=$?

if [ $STATUS -eq 0 ]; then
    echo
    echo "== 5. 设计落地验证（30 轮 × 三档难度）=="
    # 这个较慢（约 5 个会话 × 30 轮），用 --fast 可跳过
    if [ "$1" != "--fast" ]; then
        $NODE dev/verify-design.mjs
        STATUS=$?
    else
        echo "  SKIPPED（--fast）—— 本层未运行，不代表已验证"
    fi
fi

echo
if [ $STATUS -eq 0 ]; then
    echo "全部通过"
else
    echo "存在失败"
fi
exit $STATUS
