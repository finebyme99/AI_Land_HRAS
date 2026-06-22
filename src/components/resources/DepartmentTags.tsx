'use client';

import { Tag } from 'antd';
import { getDepartmentDisplayValues, normalizeDepartmentValues } from '@/lib/resources/departments';

interface DepartmentTagsProps {
  departments?: string[] | null;
  allDepartments?: string[] | null;
  max?: number;
  className?: string;
  variant?: 'tags' | 'inline';
}

export default function DepartmentTags({ departments, allDepartments, max = 4, className = '', variant = 'tags' }: DepartmentTagsProps) {
  const values = normalizeDepartmentValues(departments ?? []);
  if (values.length === 0) return null;

  const displayValues = getDepartmentDisplayValues(values, allDepartments ?? []);
  const isAll = displayValues[0] === '全部';
  const visible = isAll ? displayValues : displayValues.slice(0, max);
  const restCount = isAll ? 0 : displayValues.length - visible.length;
  const inlineText = isAll
    ? '全部'
    : `${visible.join('、')}${restCount > 0 ? ` +${restCount}` : ''}`;

  if (variant === 'inline') {
    return (
      <span
        className={['inline-flex min-w-0 items-center text-[11px]', className].filter(Boolean).join(' ')}
        style={{ color: 'var(--text-muted)' }}
        title={`适用部门：${displayValues.join('、')}`}
      >
        <span className="shrink-0">适用部门：</span>
        <span className="truncate">{inlineText}</span>
      </span>
    );
  }

  return (
    <div className={['flex flex-wrap items-center gap-1.5', className].filter(Boolean).join(' ')}>
      <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
        适用部门：
      </span>
      {visible.map((department) => (
        <Tag key={department} className="m-0 text-[11px]">
          {department}
        </Tag>
      ))}
      {restCount > 0 && (
        <Tag className="m-0 text-[11px]">
          +{restCount}
        </Tag>
      )}
    </div>
  );
}
