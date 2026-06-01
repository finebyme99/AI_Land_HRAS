-- 迁移旧评审分数字段名到新维度名称（仅影响 user 角色的记录）
-- 旧: scenario, painPoint, effectiveness
-- 新: productEffectiveness, dataConsistency, productUsability
UPDATE competition_reviews
SET scores = jsonb_build_object(
  'productEffectiveness', COALESCE(scores->>'scenario', scores->>'productEffectiveness')::int,
  'dataConsistency',      COALESCE(scores->>'painPoint', scores->>'dataConsistency')::int,
  'productUsability',     COALESCE(scores->>'effectiveness', scores->>'productUsability')::int
)
WHERE reviewer_role = 'user'
  AND scores ? 'scenario';
