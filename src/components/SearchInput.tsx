'use client';

import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  allowClear?: boolean;
}

export default function SearchInput({ placeholder = '搜索...', value, onChange, className = '', allowClear = true }: SearchInputProps) {
  return (
    <div className={`${className}`}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        allowClear={allowClear}
        className="search-input-override"
        style={{
          height: 36,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
        }}
        prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
      />
    </div>
  );
}
