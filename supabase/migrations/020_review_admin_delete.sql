-- 020_review_admin_delete.sql
-- 允许 admin/moderator 删除评审记录（用于清空评委评分）

CREATE POLICY "Admins can delete reviews" ON competition_reviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'moderator'))
  );
