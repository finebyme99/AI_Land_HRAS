-- 074: 记录场景快照同步状态
-- 用于后台统一展示「从飞书多维表格同步到 Supabase」的最近时间和结果。

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS competition_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS competition_last_sync_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS competition_last_sync_status TEXT DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS competition_last_sync_result JSONB DEFAULT '{}'::jsonb;
