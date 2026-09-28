#!/bin/bash

echo "🎮 启动石头剪刀布心理博弈游戏"
echo ""
echo "正在启动本地服务器..."
echo "请在浏览器中访问: http://localhost:8000"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 尝试使用 Python 启动服务器
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
elif command -v node &> /dev/null; then
    echo "Python 不可用，尝试使用 Node.js..."
    npx serve . -p 8000
else
    echo ""
    echo "❌ 无法启动服务器！"
    echo "请确保安装了 Python 或 Node.js"
    echo ""
    echo "手动启动方法："
    echo "1. Python: python3 -m http.server 8000"
    echo "2. Node.js: npx serve . -p 8000"
    echo ""
fi