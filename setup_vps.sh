#!/bin/bash
# VPS 部署脚本 - 适用于 Ubuntu/Debian

set -e

echo "=== 开始部署 Dealer Platform ==="

# 1. 更新包管理器并确保基础工具已安装
echo "正在更新系统依赖..."
apt update
apt install -y curl build-essential python3 sqlite3

# 2. 安装 Node.js 20.x
if ! command -v node &> /dev/null; then
  echo "正在安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 3. 安装 PM2 进程管理器
if ! command -v pm2 &> /dev/null; then
  echo "正在安装 PM2..."
  npm install pm2 -g
fi

# 5. 进入目录并安装项目依赖
echo "正在安装项目 NPM 依赖..."
npm install

# 6. 打包 Next.js 项目
echo "正在编译项目..."
npm run build

# 7. 启动服务 (PM2)
echo "正在通过 PM2 启动服务..."
pm2 start npm --name "dealer-platform" -- start

# 8. 让 PM2 开机自启
pm2 save
pm2 startup | tail -n 1 | bash || true

echo "====================================="
echo "部署完成！"
echo "您的平台现已运行在后台。端口为 3000。"
echo "如果您在云服务商面板开放了 3000 端口，可通过 http://<您的服务器IP>:3000 访问。"
echo "====================================="
