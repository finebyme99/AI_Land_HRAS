-- 用户积分事件：用于避免重复同步导致重复加分。

CREATE TABLE IF NOT EXISTS user_point_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_user_point_events_user_id ON user_point_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_point_events_source ON user_point_events(source_type, source_id);

INSERT INTO user_point_events (user_id, source_type, source_id, reason, points)
SELECT id, 'legacy_points', 'initial', 'legacy_points', points
FROM users
WHERE COALESCE(points, 0) <> 0
ON CONFLICT (user_id, source_type, source_id, reason)
DO UPDATE SET points = EXCLUDED.points, updated_at = NOW();

ALTER TABLE user_point_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own point events' AND tablename = 'user_point_events') THEN
    CREATE POLICY "Users can read own point events" ON user_point_events
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage point events' AND tablename = 'user_point_events') THEN
    CREATE POLICY "Service role can manage point events" ON user_point_events
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_user_point_events_updated_at ON user_point_events;
CREATE TRIGGER update_user_point_events_updated_at
  BEFORE UPDATE ON user_point_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
