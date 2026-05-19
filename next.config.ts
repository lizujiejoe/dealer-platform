import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 声明 better-sqlite3 为服务端外部包，防止 Turbopack 打包原生模块
  // 否则每次 API 请求模块会被重新初始化，数据写入后立即丢失
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
