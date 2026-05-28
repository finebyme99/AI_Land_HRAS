-- 大赛方案数据持久化：从飞书同步到 Supabase
CREATE TABLE IF NOT EXISTS competition_submissions (
  id TEXT PRIMARY KEY,                    -- 飞书 record_id
  period TEXT NOT NULL DEFAULT '2605',
  proposal_no INTEGER,
  title TEXT DEFAULT '',
  submitter TEXT[],
  team_members TEXT[],
  team TEXT[],
  track TEXT,
  scene_category TEXT,
  ai_tools TEXT[],
  efficiency_rate NUMERIC,
  monthly_saved_hours NUMERIC,
  before_process TEXT,
  pain_points TEXT[],
  after_process TEXT,
  before_hours_per_person NUMERIC,
  before_people_count INTEGER,
  after_hours_per_person NUMERIC,
  after_people_count INTEGER,
  ai_cost NUMERIC,
  extra_value TEXT,
  verifier TEXT[],
  source_url TEXT,
  status TEXT,
  attachments JSONB DEFAULT '[]',
  record_url TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competition_submissions_period ON competition_submissions(period);

ALTER TABLE competition_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated read' AND tablename = 'competition_submissions') THEN
    CREATE POLICY "authenticated read" ON competition_submissions
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service role write' AND tablename = 'competition_submissions') THEN
    CREATE POLICY "service role write" ON competition_submissions
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_competition_submissions_updated_at ON competition_submissions;
CREATE TRIGGER update_competition_submissions_updated_at
  BEFORE UPDATE ON competition_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
