'use client';

import React, { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider, App } from 'antd';
import zhCN from 'antd/locale/zh_CN';

const theme = {
  token: {
    colorPrimary: '#1a3a8a',
    colorSuccess: '#10b981',
    colorWarning: '#F27F22',
    colorError: '#ef4444',
    colorInfo: '#4a6fc7',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontFamily: "'Outfit', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
    colorBgContainer: 'rgba(255, 255, 255, 0.45)',
    colorBgLayout: '#f5f0eb',
    colorBorder: 'rgba(255, 255, 255, 0.6)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.7)',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748b',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
    boxShadowSecondary: '0 12px 40px rgba(26, 58, 138, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
  },
  components: {
    Card: {
      borderRadiusLG: 20,
      colorBorderSecondary: 'rgba(255, 255, 255, 0.6)',
    },
    Button: {
      borderRadius: 12,
      controlHeight: 36,
      fontWeight: 500,
    },
    Tag: {
      borderRadiusSM: 999,
    },
    Input: {
      borderRadius: 12,
      controlHeight: 36,
    },
    Select: {
      borderRadius: 12,
      controlHeight: 36,
    },
    Menu: {
      itemSelectedColor: '#1a3a8a',
      itemHoverColor: 'rgba(26, 58, 138, 0.06)',
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
