'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spin, Tabs } from 'antd';
import { ReadOutlined, AppstoreOutlined } from '@ant-design/icons';
import CoursesContent from './courses/page';
import AppsContent from './apps/page';

export default function ResourcesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>}>
      <ResourcesPageInner />
    </Suspense>
  );
}

function ResourcesPageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') ?? 'courses';
  const [activeTab, setActiveTab] = useState(
    ['courses', 'apps'].includes(initialTab) ? initialTab : 'courses'
  );

  return (
    <div className="px-[100px]" style={{ paddingTop: 20 }}>
      <Tabs
        defaultActiveKey="courses"
        activeKey={activeTab}
        onChange={setActiveTab}
        className="resources-tabs"
        items={[
          {
            key: 'courses',
            label: (
              <span className="flex items-center gap-1.5 text-sm font-semibold px-1">
                <ReadOutlined />AI公开课
              </span>
            ),
            children: <div className="pt-6"><CoursesContent /></div>,
          },
          {
            key: 'apps',
            label: (
              <span className="flex items-center gap-1.5 text-sm font-semibold px-1">
                <AppstoreOutlined />工具推荐
              </span>
            ),
            children: <div className="pt-6"><AppsContent /></div>,
          },
        ]}
      />
    </div>
  );
}
