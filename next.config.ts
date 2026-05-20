import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/cssinjs', '@ant-design/cssinjs-utils'],
};

export default nextConfig;
