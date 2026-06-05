-- 修复 034 的 idempotency + timezone + stale 注释问题
-- Code reviewer 在 034 commit (fa4399a) 之后提出

-- 1. 加 partial unique index，让 (reminder_id, recipient_type, recipient_id) 在非 user 场景下能去重
CREATE UNIQUE INDEX IF NOT EXISTS reminder_targets_role_uniq
  ON reminder_targets (reminder_id, recipient_type, recipient_id)
  WHERE recipient_type <> 'user';

-- 2. 删除 034 误插的重复行（保留最早一行）
DELETE FROM reminder_targets
WHERE id NOT IN (
  SELECT MIN(id) FROM reminder_targets
  WHERE reminder_id = '00000000-0000-0000-0000-0000000a0001'
    AND recipient_type = 'role'
    AND recipient_id = 'course_admin'
  GROUP BY reminder_id, recipient_type, recipient_id
)
AND reminder_id = '00000000-0000-0000-0000-0000000a0001'
  AND recipient_type = 'role'
  AND recipient_id = 'course_admin';
