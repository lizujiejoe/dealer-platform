#!/bin/bash
# VPS 服务端更新脚本 (Git 版)

set -e

echo "=== 开始更新 Dealer Platform ==="

# 确保在正确的工作目录中
cd /opt/dealer

# 1. 从 GitHub 拉取最新代码
echo "正在从 Git 仓库拉取最新代码..."
git pull

# 2. 更新依赖
echo "正在更新 NPM 依赖..."
npm install

# 3. 重新编译
echo "正在重新编译项目..."
npm run build

# 4. 重启 PM2 进程
echo "正在重启服务..."
pm2 restart dealer-platform

echo "====================================="
echo "更新部署完成！"
echo "====================================="
