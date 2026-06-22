'use client';

import { Select } from 'antd';
import { normalizeDepartmentValues } from '@/lib/resources/departments';

const SELECT_ALL_DEPARTMENTS = '__all_departments__';

interface DepartmentSelectProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  options: string[];
  placeholder?: string;
}

export default function DepartmentSelect({
  value,
  onChange,
  options,
  placeholder = '选择适用部门（可多选）',
}: DepartmentSelectProps) {
  const departmentOptions = normalizeDepartmentValues(options);
  const selectedDepartments = normalizeDepartmentValues(value ?? []);
  const selectOptions = [
    { label: '全部部门', value: SELECT_ALL_DEPARTMENTS, disabled: departmentOptions.length === 0 },
    ...departmentOptions.map((department) => ({ label: department, value: department })),
  ];

  const handleChange = (nextValue: string[]) => {
    if (nextValue.includes(SELECT_ALL_DEPARTMENTS)) {
      onChange?.(departmentOptions);
      return;
    }

    onChange?.(normalizeDepartmentValues(nextValue));
  };

  return (
    <Select
      mode="multiple"
      allowClear
      showSearch
      maxTagCount="responsive"
      placeholder={placeholder}
      optionFilterProp="label"
      value={selectedDepartments}
      onChange={handleChange}
      options={selectOptions}
    />
  );
}
