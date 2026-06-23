-- 070: Make the Feishu record id unique index usable by PostgREST upsert.
-- A partial unique index is not accepted for ON CONFLICT (feishu_record_id).
-- PostgreSQL unique indexes still allow multiple NULL values, so this remains
-- safe for older rows that have not been synced from Feishu.

DROP INDEX IF EXISTS courses_feishu_record_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS courses_feishu_record_id_key
  ON courses(feishu_record_id);
