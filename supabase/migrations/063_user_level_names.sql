-- 用户成长等级命名升级
-- 旧四档映射到新体系前四档，预留两档用于后续成长值规则。

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_level_check;

ALTER TABLE users
  ALTER COLUMN level SET DEFAULT '灵识初启';

UPDATE users
SET level = CASE level
  WHEN 'AI新手' THEN '灵识初启'
  WHEN 'AI探索者' THEN '问道学徒'
  WHEN 'AI达人' THEN '算法筑基'
  WHEN 'AI专家' THEN '智核结丹'
  WHEN '灵识初启' THEN '灵识初启'
  WHEN '问道学徒' THEN '问道学徒'
  WHEN '算法筑基' THEN '算法筑基'
  WHEN '智核结丹' THEN '智核结丹'
  WHEN '万象化神' THEN '万象化神'
  WHEN '天机掌门' THEN '天机掌门'
  ELSE '灵识初启'
END;

UPDATE users
SET level = CASE
  WHEN COALESCE(points, 0) >= 1000 THEN '天机掌门'
  WHEN COALESCE(points, 0) >= 600 THEN '万象化神'
  WHEN COALESCE(points, 0) >= 300 THEN '智核结丹'
  WHEN COALESCE(points, 0) >= 150 THEN '算法筑基'
  WHEN COALESCE(points, 0) >= 50 THEN '问道学徒'
  ELSE '灵识初启'
END;

ALTER TABLE users
  ADD CONSTRAINT users_level_check
  CHECK (level IN ('灵识初启', '问道学徒', '算法筑基', '智核结丹', '万象化神', '天机掌门'));
