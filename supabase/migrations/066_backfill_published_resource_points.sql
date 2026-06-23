-- 历史已发布工具资源积分回填：每条已发布工具 +10 分。
-- 使用 user_point_events 唯一键防重复执行。

INSERT INTO user_point_events (user_id, source_type, source_id, reason, points, created_at)
SELECT
  author_id,
  'app',
  id::TEXT,
  'resource_published',
  10,
  COALESCE(created_at, NOW())
FROM apps
WHERE status = 'published'
  AND author_id IS NOT NULL
ON CONFLICT (user_id, source_type, source_id, reason)
DO UPDATE SET
  points = EXCLUDED.points,
  created_at = LEAST(user_point_events.created_at, EXCLUDED.created_at),
  updated_at = NOW();

WITH affected_users AS (
  SELECT DISTINCT author_id AS user_id
  FROM apps
  WHERE status = 'published'
    AND author_id IS NOT NULL
),
point_totals AS (
  SELECT user_id, SUM(points)::INTEGER AS points
  FROM user_point_events
  WHERE user_id IN (SELECT user_id FROM affected_users)
  GROUP BY user_id
)
UPDATE users
SET
  points = COALESCE(point_totals.points, 0),
  level = CASE
    WHEN COALESCE(point_totals.points, 0) >= 1000 THEN '天机掌门'
    WHEN COALESCE(point_totals.points, 0) >= 600 THEN '万象化神'
    WHEN COALESCE(point_totals.points, 0) >= 300 THEN '智核结丹'
    WHEN COALESCE(point_totals.points, 0) >= 150 THEN '算法筑基'
    WHEN COALESCE(point_totals.points, 0) >= 50 THEN '问道学徒'
    ELSE '灵识初启'
  END,
  updated_at = NOW()
FROM point_totals
WHERE users.id = point_totals.user_id;
