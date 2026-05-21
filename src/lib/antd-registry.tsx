'use client';

import React, { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider, App } from 'antd';
import zhCN from 'antd/locale/zh_CN';

const theme = {
  token: {
    colorPrimary: '#b85c38',
    colorSuccess: '#2d5a3d',
    colorWarning: '#c4883a',
    colorError: '#b83a3a',
    colorInfo: '#4a6fa5',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontFamily: "'DM Sans', 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif",
    colorBgContainer: '#ffffff',
    colorBgLayout: '#faf8f5',
    colorBorder: '#e8e0d6',
    colorBorderSecondary: '#f0ebe4',
    colorText: '#1a1612',
    colorTextSecondary: '#6b5e52',
    colorTextTertiary: '#a89a8c',
    boxShadow: '0 1px 3px rgba(26, 22, 18, 0.04), 0 1px 2px rgba(26, 22, 18, 0.02)',
    boxShadowSecondary: '0 4px 16px rgba(26, 22, 18, 0.06), 0 2px 4px rgba(26, 22, 18, 0.03)',
  },
  components: {
    Card: {
      borderRadiusLG: 12,
      colorBorderSecondary: '#e8e0d6',
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      fontWeight: 500,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Menu: {
      itemSelectedColor: '#b85c38',
      itemHoverColor: 'rgba(184, 92, 56, 0.06)',
    },
  },
};

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => createCache());

  useServerInsertedHTML(() => {
    return (
      <style
        id="antd"
        dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }}
      />
    );
  });

  return (
    <StyleProvider cache={cache}>
      <ConfigProvider locale={zhCN} theme={theme}>
        <App>{children}</App>
      </ConfigProvider>
    </StyleProvider>
  );
}
