-- 修复 035 的 MIN(uuid) 错误
-- 035 的 DELETE 用了 MIN(id)，但 PostgreSQL 没有 MIN(uuid) 内置聚合
-- 改用 ROW_NUMBER() OVER (PARTITION BY ... ORDER BY id)

-- 1. (兜底) 035 的 partial unique index 可能没跑到；确保它在
CREATE UNIQUE INDEX IF NOT EXISTS reminder_targets_role_uniq
  ON reminder_targets (reminder_id, recipient_type, recipient_id)
  WHERE recipient_type <> 'user';

-- 2. 去重：保留 (reminder_id, recipient_type, recipient_id) 组里 id 最小的行
--    用 ROW_NUMBER() 代替 MIN(id)
DELETE FROM reminder_targets
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY reminder_id, recipient_type, recipient_id
      ORDER BY id
    ) AS rn
    FROM reminder_targets
    WHERE reminder_id = '00000000-0000-0000-0000-0000000a0001'
      AND recipient_type = 'role'
      AND recipient_id = 'course_admin'
  ) ranked
  WHERE rn > 1
);
