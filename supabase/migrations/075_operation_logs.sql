-- 075: 操作日志审计表
-- 记录后台手动操作和系统定时任务，当前用于场景快照同步审计。

CREATE TABLE IF NOT EXISTS operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  source text NOT NULL CHECK (source IN ('admin', 'cron')),
  operator_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  operator_name text,
  request_time timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_request_time
  ON operation_logs(request_time DESC);

CREATE INDEX IF NOT EXISTS idx_operation_logs_action_source
  ON operation_logs(action, source, request_time DESC);

CREATE INDEX IF NOT EXISTS idx_operation_logs_operator
  ON operation_logs(operator_user_id, request_time DESC);

ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operation_logs admin read" ON operation_logs;
CREATE POLICY "operation_logs admin read" ON operation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.roles @> ARRAY['admin']::text[]
    )
  );

DROP POLICY IF EXISTS "operation_logs service insert" ON operation_logs;
CREATE POLICY "operation_logs service insert" ON operation_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
