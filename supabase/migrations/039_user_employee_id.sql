-- supabase/migrations/039_user_employee_id.sql
-- 给 users 表加工号字段（部门字段已存在）
alter table users add column employee_id text;
create index users_employee_id_idx on users(employee_id) where employee_id is not null;
